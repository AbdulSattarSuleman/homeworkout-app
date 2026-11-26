import os
import sqlite3
import hashlib
import hmac
import secrets
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Header, HTTPException, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

DB_PATH = "homeworkout.db"

# Login sessions expire after this long
USER_SESSION_MAX_AGE = "-30 days"
ADMIN_SESSION_MAX_AGE = "-12 hours"

# Largest telemetry "details" payload accepted (characters of JSON)
MAX_TELEMETRY_DETAILS_CHARS = 4000

ALLOWED_FITNESS_LEVELS = {"Beginner", "Intermediate", "Advanced"}

# ========================================================
# PASSWORD HASHING (salted PBKDF2; old unsalted SHA-256 hashes still verify and get upgraded)
# ========================================================
PBKDF2_ITERATIONS = 260_000
_LEGACY_DEFAULT_ADMIN_HASH = hashlib.sha256(b"admin123").hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    stored_hash = stored_hash or ""
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, digest = stored_hash.split("$", 3)
            check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
        except ValueError:
            return False
        return hmac.compare_digest(check, digest)
    legacy = hashlib.sha256(password.encode()).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)


def needs_rehash(stored_hash: Optional[str]) -> bool:
    return not (stored_hash or "").startswith("pbkdf2_sha256$")


def new_session_token() -> str:
    return secrets.token_urlsafe(32)

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

    # 5. Activity Events Telemetry Table (tracks every single user action)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        session_id TEXT,
        event_type TEXT NOT NULL,
        event_category TEXT,
        event_details_json TEXT,
        screen_width INTEGER DEFAULT 0,
        screen_height INTEGER DEFAULT 0,
        viewport_width INTEGER DEFAULT 0,
        viewport_height INTEGER DEFAULT 0,
        device_type TEXT,
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. Session Telemetry Table (tracks screen time, device specs, active durations)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS session_telemetry (
        session_id TEXT PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        device_type TEXT,
        screen_resolution TEXT,
        viewport_size TEXT,
        user_agent TEXT,
        ip_address TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active_screen_seconds INTEGER DEFAULT 0,
        total_events_count INTEGER DEFAULT 0
    );
    """)

    # Ensure is_admin column exists on users
    try:
        cur.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
    except Exception:
        pass

    conn.commit()

    # Optional demo user (only when HW_SEED_DEMO=1)
    if os.environ.get("HW_SEED_DEMO") == "1":
        cur.execute("SELECT id FROM users WHERE username = ?", ("athlete",))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (username, password_hash, fitness_level, is_pro, streak_count, weekly_goal_target, weekly_completed_count, is_admin)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            """, ("athlete", hash_password("workout123"), "Intermediate", 1, 3, 5, 2))
            conn.commit()

    # Admin account: password comes from HW_ADMIN_PASSWORD, or a random one is generated
    # and printed once. The old built-in "admin123" password is replaced automatically.
    env_admin_password = os.environ.get("HW_ADMIN_PASSWORD")
    cur.execute("SELECT id, password_hash FROM users WHERE username = ?", ("admin",))
    row = cur.fetchone()
    if not row:
        admin_password = env_admin_password or secrets.token_urlsafe(12)
        cur.execute("""
            INSERT INTO users (username, password_hash, fitness_level, is_pro, streak_count, weekly_goal_target, weekly_completed_count, is_admin)
            VALUES (?, ?, 'Advanced', 1, 0, 7, 0, 1)
        """, ("admin", hash_password(admin_password)))
        conn.commit()
        if not env_admin_password:
            print(f"[setup] Created admin account 'admin' with password: {admin_password}")
            print("[setup] Save it now, or set HW_ADMIN_PASSWORD before starting the server to choose your own.")
    else:
        cur.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (row["id"],))
        uses_old_default = row["password_hash"] == _LEGACY_DEFAULT_ADMIN_HASH
        env_mismatch = bool(env_admin_password) and not verify_password(env_admin_password, row["password_hash"])
        if uses_old_default or env_mismatch:
            admin_password = env_admin_password or secrets.token_urlsafe(12)
            cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(admin_password), row["id"]))
            cur.execute("DELETE FROM user_sessions WHERE user_id = ?", (row["id"],))
            if not env_admin_password:
                print(f"[setup] Replaced the old default admin password. New password for 'admin': {admin_password}")
                print("[setup] Save it now, or set HW_ADMIN_PASSWORD before starting the server to choose your own.")
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
    allow_credentials=False,  # auth uses Bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================================
# AUTH HELPERS & DEPENDENCIES
# ========================================================
def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    parts = authorization.split(" ", 1)
    token = parts[1].strip() if len(parts) == 2 else ""
    return token or None


def lookup_session_user(token: Optional[str], admin_only: bool = False) -> Optional[dict]:
    """Returns the user for a non-expired session token, or None."""
    if not token:
        return None
    max_age = ADMIN_SESSION_MAX_AGE if admin_only else USER_SESSION_MAX_AGE
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT u.* FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.token = ? AND s.created_at >= datetime('now', ?)
        {"AND u.is_admin = 1" if admin_only else ""}
    """, (token, max_age))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def count_workout_days_this_week(cur, user_id: int) -> int:
    today = datetime.now().date()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    cur.execute(
        "SELECT COUNT(DISTINCT date_str) AS c FROM workout_logs WHERE user_id = ? AND date_str >= ?",
        (user_id, week_start),
    )
    return cur.fetchone()["c"]


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    user = lookup_session_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user

def extract_client_info(request: Request) -> tuple:
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        ip = cf_ip.strip()
    else:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            ip = xff.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "Unknown Device")
    return ip, ua

def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    return lookup_session_user(_bearer_token(authorization))

def get_admin_user(authorization: Optional[str] = Header(None)) -> dict:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Admin authorization token required")
    admin = lookup_session_user(token, admin_only=True)
    if not admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    return admin

# ========================================================
# REQUEST / RESPONSE MODELS
# ========================================================
class RegisterRequest(BaseModel):
    username: str = Field(..., max_length=40)
    password: str = Field(..., max_length=200)
    fitness_level: Optional[str] = "Intermediate"

class LoginRequest(BaseModel):
    username: str = Field(..., max_length=40)
    password: str = Field(..., max_length=200)

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

class DeleteSelectedLogsRequest(BaseModel):
    log_ids: List[str]

class TelemetryEventRequest(BaseModel):
    session_id: str = Field(..., max_length=64)
    event_type: str = Field(..., max_length=64)
    event_category: Optional[str] = Field("general", max_length=32)
    event_details: Optional[Dict[str, Any]] = {}
    screen_width: Optional[int] = Field(0, ge=0, le=20000)
    screen_height: Optional[int] = Field(0, ge=0, le=20000)
    viewport_width: Optional[int] = Field(0, ge=0, le=20000)
    viewport_height: Optional[int] = Field(0, ge=0, le=20000)
    device_type: Optional[str] = Field("Unknown", max_length=64)

class TelemetryHeartbeatRequest(BaseModel):
    session_id: str = Field(..., max_length=64)
    elapsed_seconds: Optional[int] = 15
    current_screen: Optional[str] = Field("dashboard", max_length=64)
    screen_width: Optional[int] = Field(0, ge=0, le=20000)
    screen_height: Optional[int] = Field(0, ge=0, le=20000)
    viewport_width: Optional[int] = Field(0, ge=0, le=20000)
    viewport_height: Optional[int] = Field(0, ge=0, le=20000)
    device_type: Optional[str] = Field("Unknown", max_length=64)

class AdminLoginRequest(BaseModel):
    username: str = Field(..., max_length=40)
    password: str = Field(..., max_length=200)

# ========================================================
# AUTHENTICATION API ENDPOINTS
# ========================================================
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    username = req.username.strip()
    if len(username) < 3 or len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Username must be at least 3 chars and password at least 8 chars")
    fitness_level = req.fitness_level or "Intermediate"
    if fitness_level not in ALLOWED_FITNESS_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid fitness level")

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
    """, (username, pwd_hash, fitness_level))
    user_id = cur.lastrowid

    token = new_session_token()
    cur.execute("INSERT INTO user_sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict(cur.fetchone())
    conn.close()
    user.pop("password_hash", None)

    return {"token": token, "user": user}

def _authenticate(cur, username: str, password: str, admin_only: bool = False) -> Optional[dict]:
    """Checks a username/password; upgrades old SHA-256 hashes on success."""
    query = "SELECT * FROM users WHERE LOWER(username) = LOWER(?)"
    if admin_only:
        query += " AND is_admin = 1"
    cur.execute(query, (username.strip(),))
    row = cur.fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        return None
    user = dict(row)
    if needs_rehash(user["password_hash"]):
        cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user["id"]))
    return user

@app.post("/api/auth/login")
def login(req: LoginRequest):
    conn = get_db()
    cur = conn.cursor()
    user = _authenticate(cur, req.username, req.password)

    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = new_session_token()
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
    """, (guest_username, hash_password(secrets.token_urlsafe(24))))
    user_id = cur.lastrowid

    token = new_session_token()
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
    token = _bearer_token(authorization)
    if token:
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
    if req.level not in ALLOWED_FITNESS_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid fitness level")
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE users SET fitness_level = ? WHERE id = ?", (req.level, user["id"]))
    conn.commit()
    user["fitness_level"] = req.level
    conn.close()
    user.pop("password_hash", None)
    return {"user": user}

# Note: the old /api/user/toggle-pro endpoint was removed. It let any user give
# themselves Pro, and the web app never called it.

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

    # Update user progress (weekly goal = days with a workout since Monday)
    new_weekly_count = count_workout_days_this_week(cur, user["id"])
    cur.execute("""
        UPDATE users
        SET streak_count = ?, weekly_completed_count = ?, last_workout_date = ?
        WHERE id = ?
    """, (new_streak, new_weekly_count, today_str, user["id"]))

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
    cur.execute("UPDATE users SET weekly_completed_count = 0 WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "All workout history cleared", "remaining_count": 0}

@app.post("/api/workouts/history/delete-selected")
def delete_selected_workout_history(req: DeleteSelectedLogsRequest, user: dict = Depends(get_current_user)):
    """Deletes only user-selected workout session logs (custom or bulk)"""
    if not req.log_ids:
        return {"status": "success", "deleted_count": 0, "remaining_count": 0}
    
    conn = get_db()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(req.log_ids))
    params = list(req.log_ids) + [user["id"]]
    cur.execute(f"DELETE FROM workout_logs WHERE id IN ({placeholders}) AND user_id = ?", tuple(params))
    deleted_count = cur.rowcount

    # Recalculate remaining workouts and this week's goal progress
    cur.execute("SELECT COUNT(*) as c FROM workout_logs WHERE user_id = ?", (user["id"],))
    remaining_count = cur.fetchone()["c"]
    weekly_count = count_workout_days_this_week(cur, user["id"])
    cur.execute("UPDATE users SET weekly_completed_count = ? WHERE id = ?", (weekly_count, user["id"]))
    conn.commit()
    conn.close()

    return {"status": "success", "deleted_count": deleted_count, "remaining_count": remaining_count}

@app.post("/api/user/reset-progress")
def reset_user_progress(user: dict = Depends(get_current_user)):
    """Resets user streak to 0, weekly completed workouts to 0, and purges past workout logs"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET streak_count = 0, weekly_completed_count = 0, last_workout_date = NULL 
        WHERE id = ?
    """, (user["id"],))
    cur.execute("DELETE FROM workout_logs WHERE user_id = ?", (user["id"],))
    cur.execute("DELETE FROM muscle_rotation_history WHERE user_id = ?", (user["id"],))
    conn.commit()
    cur.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
    updated_user = dict(cur.fetchone())
    conn.close()
    updated_user.pop("password_hash", None)
    return {"status": "success", "message": "All user progress has been reset", "user": updated_user}

# ========================================================
# TELEMETRY & ACTIVITY TRACKING ENDPOINTS
# ========================================================
@app.post("/api/telemetry/event")
def record_telemetry_event(
    req: TelemetryEventRequest, 
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Tracks every user interaction, navigation, screen size, and device telemetry"""
    ip_addr, user_agent = extract_client_info(request)
    user = get_optional_user(authorization)
    user_id = user["id"] if user else None
    username = user["username"] if user else None

    screen_res = f"{req.screen_width}x{req.screen_height}" if (req.screen_width and req.screen_height) else None
    viewport_sz = f"{req.viewport_width}x{req.viewport_height}" if (req.viewport_width and req.viewport_height) else None
    details_str = json.dumps(req.event_details or {})
    if len(details_str) > MAX_TELEMETRY_DETAILS_CHARS:
        raise HTTPException(status_code=413, detail="Telemetry details too large")
    user_agent = (user_agent or "")[:300]

    conn = get_db()
    cur = conn.cursor()

    # 1. Insert into activity_events
    cur.execute("""
        INSERT INTO activity_events 
        (user_id, username, session_id, event_type, event_category, event_details_json, 
         screen_width, screen_height, viewport_width, viewport_height, device_type, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, username, req.session_id, req.event_type, req.event_category, details_str,
        req.screen_width or 0, req.screen_height or 0, req.viewport_width or 0, req.viewport_height or 0,
        req.device_type or "Unknown", user_agent, ip_addr
    ))

    # 2. Upsert into session_telemetry
    cur.execute("""
        INSERT INTO session_telemetry 
        (session_id, user_id, username, device_type, screen_resolution, viewport_size, user_agent, ip_address, active_screen_seconds, total_events_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
        ON CONFLICT(session_id) DO UPDATE SET
            user_id = COALESCE(excluded.user_id, session_telemetry.user_id),
            username = COALESCE(excluded.username, session_telemetry.username),
            device_type = CASE WHEN excluded.device_type != 'Unknown' THEN excluded.device_type ELSE session_telemetry.device_type END,
            screen_resolution = COALESCE(excluded.screen_resolution, session_telemetry.screen_resolution),
            viewport_size = COALESCE(excluded.viewport_size, session_telemetry.viewport_size),
            user_agent = excluded.user_agent,
            ip_address = excluded.ip_address,
            total_events_count = session_telemetry.total_events_count + 1,
            last_active_at = CURRENT_TIMESTAMP
    """, (
        req.session_id, user_id, username, req.device_type or "Unknown", 
        screen_res, viewport_sz, user_agent, ip_addr
    ))

    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/telemetry/heartbeat")
def record_telemetry_heartbeat(
    req: TelemetryHeartbeatRequest,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Heartbeat ticker recording exact screen time usage (in seconds) and active screen state"""
    ip_addr, user_agent = extract_client_info(request)
    user = get_optional_user(authorization)
    user_id = user["id"] if user else None
    username = user["username"] if user else None

    screen_res = f"{req.screen_width}x{req.screen_height}" if (req.screen_width and req.screen_height) else None
    viewport_sz = f"{req.viewport_width}x{req.viewport_height}" if (req.viewport_width and req.viewport_height) else None
    elapsed = max(1, min(120, req.elapsed_seconds or 15))
    user_agent = (user_agent or "")[:300]

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO session_telemetry 
        (session_id, user_id, username, device_type, screen_resolution, viewport_size, user_agent, ip_address, active_screen_seconds, total_events_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(session_id) DO UPDATE SET
            user_id = COALESCE(excluded.user_id, session_telemetry.user_id),
            username = COALESCE(excluded.username, session_telemetry.username),
            active_screen_seconds = session_telemetry.active_screen_seconds + excluded.active_screen_seconds,
            last_active_at = CURRENT_TIMESTAMP
    """, (
        req.session_id, user_id, username, req.device_type or "Unknown",
        screen_res, viewport_sz, user_agent, ip_addr, elapsed
    ))

    conn.commit()
    conn.close()
    return {"status": "success"}

# ========================================================
# ADMIN DASHBOARD & MONITORING ENDPOINTS (ADMIN-ONLY)
# ========================================================
@app.post("/api/admin/login")
def admin_login(req: AdminLoginRequest):
    """Admin-only authentication gate"""
    conn = get_db()
    cur = conn.cursor()
    user = _authenticate(cur, req.username, req.password, admin_only=True)

    if not user:
        conn.close()
        raise HTTPException(status_code=403, detail="Invalid admin credentials or not authorized as admin")

    token = new_session_token()
    cur.execute("INSERT INTO user_sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "admin_token": token,
        "username": user["username"],
        "is_admin": 1
    }

@app.get("/api/admin/verify")
def verify_admin_session(admin: dict = Depends(get_admin_user)):
    """Verifies active admin token"""
    return {
        "status": "authenticated",
        "username": admin["username"],
        "is_admin": 1
    }

@app.get("/api/admin/stats")
def get_admin_dashboard_stats(admin: dict = Depends(get_admin_user)):
    """Comprehensive high-level KPI metrics for the Admin Command Center"""
    conn = get_db()
    cur = conn.cursor()

    # User counts
    cur.execute("SELECT COUNT(*) as c FROM users WHERE is_admin = 0")
    total_users = cur.fetchone()["c"]

    cur.execute("SELECT COUNT(*) as c FROM users WHERE is_admin = 0 AND username NOT LIKE 'gym_user_%'")
    registered_users = cur.fetchone()["c"]

    cur.execute("SELECT COUNT(*) as c FROM users WHERE username LIKE 'gym_user_%'")
    guest_users = cur.fetchone()["c"]

    # Sessions & Screen Time
    cur.execute("SELECT COUNT(*) as c, COALESCE(SUM(active_screen_seconds), 0) as s, COALESCE(AVG(active_screen_seconds), 0) as avg_s FROM session_telemetry")
    sess_row = cur.fetchone()
    total_sessions = sess_row["c"]
    total_screen_time_seconds = sess_row["s"]
    avg_screen_time_seconds = round(sess_row["avg_s"], 1)

    # Workouts & Events count
    cur.execute("SELECT COUNT(*) as c FROM workout_logs")
    total_workouts = cur.fetchone()["c"]

    cur.execute("SELECT COUNT(*) as c FROM activity_events")
    total_events = cur.fetchone()["c"]

    # Screen resolutions breakdown
    cur.execute("""
        SELECT screen_resolution, COUNT(*) as count 
        FROM session_telemetry 
        WHERE screen_resolution IS NOT NULL AND screen_resolution != ''
        GROUP BY screen_resolution 
        ORDER BY count DESC LIMIT 8
    """)
    screen_resolutions = [dict(r) for r in cur.fetchall()]

    # Device types breakdown
    cur.execute("""
        SELECT COALESCE(device_type, 'Unknown') as device_type, COUNT(*) as count 
        FROM session_telemetry 
        GROUP BY device_type 
        ORDER BY count DESC
    """)
    device_types = [dict(r) for r in cur.fetchall()]

    # Active users today
    today_str = datetime.now().strftime("%Y-%m-%d")
    cur.execute("SELECT COUNT(DISTINCT user_id) as c FROM activity_events WHERE created_at >= ? AND user_id IS NOT NULL", (today_str,))
    active_today = cur.fetchone()["c"]

    conn.close()

    return {
        "total_users": total_users,
        "registered_users": registered_users,
        "guest_users": guest_users,
        "active_today": active_today,
        "total_sessions": total_sessions,
        "total_screen_time_seconds": total_screen_time_seconds,
        "avg_screen_time_seconds": avg_screen_time_seconds,
        "total_workouts": total_workouts,
        "total_events": total_events,
        "screen_resolutions": screen_resolutions,
        "device_types": device_types
    }

@app.get("/api/admin/activities")
def get_admin_activities(
    admin: dict = Depends(get_admin_user),
    limit: int = Query(100, ge=1, le=500),
    category: Optional[str] = None,
    user_id: Optional[int] = None,
    search: Optional[str] = None
):
    """Real-time chronological activity stream of every single user action"""
    conn = get_db()
    cur = conn.cursor()

    query = "SELECT * FROM activity_events WHERE 1=1"
    params = []

    if category and category != "all":
        query += " AND event_category = ?"
        params.append(category)

    if user_id:
        query += " AND user_id = ?"
        params.append(user_id)

    if search:
        query += " AND (username LIKE ? OR event_type LIKE ? OR event_details_json LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s])

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cur.execute(query, tuple(params))
    rows = cur.fetchall()
    conn.close()

    activities = []
    for r in rows:
        item = dict(r)
        try:
            item["details"] = json.loads(item.get("event_details_json") or "{}")
        except Exception:
            item["details"] = {}
        activities.append(item)

    return {"count": len(activities), "activities": activities}

@app.get("/api/admin/users")
def get_admin_users(admin: dict = Depends(get_admin_user)):
    """Fleet overview of all users, their screen time, device, workouts, and activity"""
    conn = get_db()
    cur = conn.cursor()

    today = datetime.now().date()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    cur.execute("""
        SELECT
            u.id, u.username, u.fitness_level, u.is_pro, u.is_admin,
            u.streak_count, u.weekly_goal_target,
            (SELECT COUNT(DISTINCT w.date_str) FROM workout_logs w WHERE w.user_id = u.id AND w.date_str >= ?) as weekly_completed_count,
            u.last_workout_date, u.created_at,
            (SELECT COUNT(*) FROM workout_logs w WHERE w.user_id = u.id) as workout_count,
            (SELECT COALESCE(SUM(s.active_screen_seconds), 0) FROM session_telemetry s WHERE s.user_id = u.id) as total_screen_time_seconds,
            (SELECT COUNT(*) FROM session_telemetry s WHERE s.user_id = u.id) as total_sessions_count,
            (SELECT s.screen_resolution FROM session_telemetry s WHERE s.user_id = u.id ORDER BY s.last_active_at DESC LIMIT 1) as last_screen_resolution,
            (SELECT s.device_type FROM session_telemetry s WHERE s.user_id = u.id ORDER BY s.last_active_at DESC LIMIT 1) as last_device_type,
            (SELECT a.created_at FROM activity_events a WHERE a.user_id = u.id ORDER BY a.id DESC LIMIT 1) as last_activity_at
        FROM users u
        ORDER BY u.id DESC
    """, (week_start,))
    rows = cur.fetchall()
    conn.close()

    users = [dict(r) for r in rows]
    return {"count": len(users), "users": users}

@app.get("/api/admin/user/{target_user_id}/detail")
def get_admin_user_detail(target_user_id: int, admin: dict = Depends(get_admin_user)):
    """Deep-dive audit into a specific user: all workouts, actions, screen sizes, and events"""
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, username, fitness_level, is_pro, is_admin, streak_count, weekly_goal_target, weekly_completed_count, last_workout_date, created_at FROM users WHERE id = ?", (target_user_id,))
    user_row = cur.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    user_info = dict(user_row)

    # Sessions
    cur.execute("SELECT * FROM session_telemetry WHERE user_id = ? ORDER BY last_active_at DESC", (target_user_id,))
    sessions = [dict(r) for r in cur.fetchall()]

    # Workouts
    cur.execute("SELECT * FROM workout_logs WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20", (target_user_id,))
    workouts = []
    for w in cur.fetchall():
        wd = dict(w)
        try:
            wd["exercises"] = json.loads(wd.get("exercises_json") or "[]")
        except Exception:
            wd["exercises"] = []
        workouts.append(wd)

    # Activities
    cur.execute("SELECT * FROM activity_events WHERE user_id = ? ORDER BY id DESC LIMIT 100", (target_user_id,))
    activities = []
    for a in cur.fetchall():
        ad = dict(a)
        try:
            ad["details"] = json.loads(ad.get("event_details_json") or "{}")
        except Exception:
            ad["details"] = {}
        activities.append(ad)

    conn.close()

    return {
        "user": user_info,
        "sessions": sessions,
        "workouts": workouts,
        "activities": activities
    }

@app.delete("/api/admin/activities")
def purge_admin_activities(admin: dict = Depends(get_admin_user)):
    """Admin purge utility for clearing test activity logs"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM activity_events")
    cur.execute("DELETE FROM session_telemetry")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Telemetry activity logs purged"}

# ========================================================
# STATIC FILES SERVING (SAME PORT 8080)
# ========================================================
app.mount("/", StaticFiles(directory="web", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Listens only on this computer by default (a cloudflared tunnel to localhost still works).
    # Set HW_HOST=0.0.0.0 to allow other devices on your network to connect.
    uvicorn.run("server:app", host=os.environ.get("HW_HOST", "127.0.0.1"), port=8080, reload=False)
