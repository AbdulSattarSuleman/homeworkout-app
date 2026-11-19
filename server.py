import os
import sqlite3
import hashlib
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DB_PATH = "homeworkout.db"

# ========================================================
# DATABASE INITIALIZATION
# ========================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    
    # 1. Users Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        fitness_level TEXT DEFAULT 'Intermediate',
        is_pro INTEGER DEFAULT 0,
        streak_count INTEGER DEFAULT 0,
        weekly_goal_target INTEGER DEFAULT 5,
        weekly_completed_count INTEGER DEFAULT 0,
        last_workout_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Sessions Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Workout Logs Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS workout_logs (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        challenge_id TEXT,
        workout_title TEXT NOT NULL,
        muscle_group TEXT,
        day_number INTEGER DEFAULT 1,
        duration_minutes INTEGER DEFAULT 18,
        calories_burned INTEGER DEFAULT 145,
        exercises_json TEXT,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_str TEXT NOT NULL
    );
    """)

    # 4. Muscle Rotation History Table (tracks what was trained last session/day/week)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS muscle_rotation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        muscle TEXT NOT NULL,
        exercise_ids_json TEXT NOT NULL,
        session_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_str TEXT NOT NULL
    );
    """)

    conn.commit()

    # Seed demo user if not exists
    cur.execute("SELECT id FROM users WHERE username = ?", ("athlete",))
    if not cur.fetchone():
        pwd_hash = hashlib.sha256("workout123".encode()).hexdigest()
        cur.execute("""
            INSERT INTO users (username, password_hash, fitness_level, is_pro, streak_count, weekly_goal_target, weekly_completed_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("athlete", pwd_hash, "Intermediate", 1, 3, 5, 2))
        conn.commit()

    conn.close()

init_db()

# ========================================================
# FASTAPI APPLICATION SETUP
# ========================================================
app = FastAPI(title="Home Workout Backend & Sync API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================================
# AUTH HELPERS & DEPENDENCIES
# ========================================================
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    
    token = authorization.split(" ")[1]
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.* FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.token = ?
    """, (token,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    return dict(row)

# ========================================================
# REQUEST / RESPONSE MODELS
# ========================================================
class RegisterRequest(BaseModel):
    username: str
    password: str
    fitness_level: Optional[str] = "Intermediate"

class LoginRequest(BaseModel):
    username: str
    password: str

class UpdateGoalRequest(BaseModel):
    target: int

class UpdateLevelRequest(BaseModel):
    level: str

class WorkoutCompleteRequest(BaseModel):
    workout_id: Optional[str] = "custom"
    workout_title: str
    muscle_group: Optional[str] = "Full Body"
    day_number: Optional[int] = 1
    duration_minutes: Optional[int] = 18
    calories_burned: Optional[int] = 145
    exercises: Optional[List[dict]] = []

# ========================================================
# AUTHENTICATION API ENDPOINTS
# ========================================================
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    username = req.username.strip()
    if len(username) < 3 or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Username must be at least 3 chars and password at least 4 chars")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists. Please pick another one or log in.")

    pwd_hash = hash_password(req.password)
    cur.execute("""
        INSERT INTO users (username, password_hash, fitness_level, weekly_goal_target, weekly_completed_count, streak_count)
        VALUES (?, ?, ?, 5, 0, 0)
    """, (username, pwd_hash, req.fitness_level))
    user_id = cur.lastrowid

    token = str(uuid.uuid4())
    cur.execute("INSERT INTO user_sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict(cur.fetchone())
    conn.close()
    user.pop("password_hash", None)

    return {"token": token, "user": user}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    username = req.username.strip()
    conn = get_db()
    cur = conn.cursor()
    pwd_hash = hash_password(req.password)

    cur.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?", (username, pwd_hash))
    user_row = cur.fetchone()

    if not user_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = dict(user_row)
    token = str(uuid.uuid4())
    cur.execute("INSERT INTO user_sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))
    conn.commit()
    conn.close()

    user.pop("password_hash", None)
    return {"token": token, "user": user}

@app.post("/api/auth/guest")
def guest_login():
    """Quick 1-tap gym access: creates or connects an instant device session"""
    guest_username = f"gym_user_{uuid.uuid4().hex[:6]}"
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO users (username, password_hash, fitness_level, weekly_goal_target, weekly_completed_count, streak_count)
        VALUES (?, ?, 'Intermediate', 5, 0, 1)
    """, (guest_username, hash_password("guest123")))
    user_id = cur.lastrowid

    token = str(uuid.uuid4())
    cur.execute("INSERT INTO user_sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict(cur.fetchone())
    conn.close()
    user.pop("password_hash", None)

    return {"token": token, "user": user}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    user.pop("password_hash", None)
    return {"user": user}

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"status": "success", "message": "Logged out successfully"}

# ========================================================
# USER PROGRESS & GOAL ENDPOINTS
# ========================================================
@app.patch("/api/user/goal")
def update_goal(req: UpdateGoalRequest, user: dict = Depends(get_current_user)):
    target = max(1, min(7, req.target))
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE users SET weekly_goal_target = ? WHERE id = ?", (target, user["id"]))
    conn.commit()
    user["weekly_goal_target"] = target
    conn.close()
    user.pop("password_hash", None)
    return {"user": user}

@app.patch("/api/user/level")
def update_level(req: UpdateLevelRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE users SET fitness_level = ? WHERE id = ?", (req.level, user["id"]))
    conn.commit()
    user["fitness_level"] = req.level
    conn.close()
    user.pop("password_hash", None)
    return {"user": user}

@app.post("/api/user/toggle-pro")
def toggle_pro(user: dict = Depends(get_current_user)):
    new_pro = 0 if user.get("is_pro") else 1
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_pro = ? WHERE id = ?", (new_pro, user["id"]))
    conn.commit()
    user["is_pro"] = new_pro
    conn.close()
    user.pop("password_hash", None)
    return {"user": user}

# ========================================================
# WORKOUT LOGS & SMART ROTATION PERSISTENCE
# ========================================================
@app.post("/api/workouts/complete")
def complete_workout(req: WorkoutCompleteRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    log_id = f"log_{uuid.uuid4().hex[:10]}"

    # Determine streak
    last_date = user.get("last_workout_date")
    new_streak = user.get("streak_count", 0)
    if not last_date:
        new_streak = 1
    elif last_date == today_str:
        # Same day workout, maintain current streak
        pass
    else:
        yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        if last_date == yesterday_str:
            new_streak += 1
        else:
            new_streak = 1

    new_weekly_count = user.get("weekly_completed_count", 0) + 1

    # Update user progress
    cur.execute("""
        UPDATE users 
        SET streak_count = ?, weekly_completed_count = ?, last_workout_date = ?
        WHERE id = ?
    """, (new_streak, new_weekly_count, today_str, user["id"]))

    # Save to workout_logs
    exercises_json = json.dumps(req.exercises or [])
    cur.execute("""
        INSERT INTO workout_logs (id, user_id, challenge_id, workout_title, muscle_group, day_number, duration_minutes, calories_burned, exercises_json, completed_at, date_str)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (log_id, user["id"], req.workout_id, req.workout_title, req.muscle_group, req.day_number, req.duration_minutes, req.calories_burned, exercises_json, now.isoformat(), today_str))

    # Save to muscle_rotation_history for smart recommendation rotation
    exercise_ids = [str(x.get("id")) for x in (req.exercises or []) if x.get("id")]
    if exercise_ids and req.muscle_group:
        cur.execute("""
            INSERT INTO muscle_rotation_history (user_id, muscle, exercise_ids_json, session_date, date_str)
            VALUES (?, ?, ?, ?, ?)
        """, (user["id"], req.muscle_group.lower(), json.dumps(exercise_ids), now.isoformat(), today_str))

    conn.commit()

    # Fetch updated user
    cur.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
    updated_user = dict(cur.fetchone())
    conn.close()
    updated_user.pop("password_hash", None)

    return {
        "status": "success",
        "user": updated_user,
        "log": {
            "id": log_id,
            "challengeTitle": req.workout_title,
            "dayNumber": req.day_number,
            "completedAt": now.isoformat(),
            "dateStr": today_str,
            "durationMinutes": req.duration_minutes,
            "caloriesBurned": req.calories_burned,
            "exercisesCount": len(req.exercises or [])
        }
    }

@app.get("/api/workouts/history")
def get_workout_history(user: dict = Depends(get_current_user)):
    """Returns past workout sessions grouped into a smart timeline: Today, Yesterday, This Week, Last Week, Older"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM workout_logs 
        WHERE user_id = ? 
        ORDER BY completed_at DESC
    """, (user["id"],))
    rows = cur.fetchall()
    conn.close()

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    seven_days_ago_str = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    fourteen_days_ago_str = (now - timedelta(days=14)).strftime("%Y-%m-%d")

    timeline = {
        "today": [],
        "yesterday": [],
        "this_week": [],
        "last_week": [],
        "older": [],
        "all_logs": []
    }

    for r in rows:
        item = dict(r)
        # Parse exercises json
        try:
            item["exercises"] = json.loads(item.get("exercises_json") or "[]")
        except Exception:
            item["exercises"] = []

        item["challengeTitle"] = item.get("workout_title")
        item["completedAt"] = item.get("completed_at")
        item["dayNumber"] = item.get("day_number")

        timeline["all_logs"].append(item)

        d = item.get("date_str")
        if d == today_str:
            timeline["today"].append(item)
        elif d == yesterday_str:
            timeline["yesterday"].append(item)
        elif d >= seven_days_ago_str:
            timeline["this_week"].append(item)
        elif d >= fourteen_days_ago_str:
            timeline["last_week"].append(item)
        else:
            timeline["older"].append(item)

    return timeline

@app.get("/api/workouts/rotation-history")
def get_rotation_history(muscle: str, user: dict = Depends(get_current_user)):
    """Returns what exercises this user completed previously for this muscle to power smart non-repeating routines"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT exercise_ids_json, session_date, date_str 
        FROM muscle_rotation_history
        WHERE user_id = ? AND muscle = ?
        ORDER BY session_date DESC LIMIT 5
    """, (user["id"], muscle.lower()))
    rows = cur.fetchall()
    conn.close()

    history = []
    for r in rows:
        try:
            ids = json.loads(r["exercise_ids_json"])
        except Exception:
            ids = []
        history.append({
            "date": r["session_date"],
            "dateStr": r["date_str"],
            "exerciseIds": ids
        })

    return {"muscle": muscle, "history": history}

@app.delete("/api/workouts/history")
def clear_workout_history(user: dict = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM workout_logs WHERE user_id = ?", (user["id"],))
    cur.execute("DELETE FROM muscle_rotation_history WHERE user_id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "History cleared"}

# ========================================================
# STATIC FILES SERVING (SAME PORT 8080)
# ========================================================
app.mount("/", StaticFiles(directory="web", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=False)
