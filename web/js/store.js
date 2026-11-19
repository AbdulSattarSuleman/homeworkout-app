// Central Data Store & State Synchronization Layer
const HomeWorkoutStore = {
  KEYS: {
    USER_PROGRESS: 'hw_user_progress',
    WORKOUT_LOGS: 'hw_workout_logs',
    CHALLENGES: 'hw_challenges',
    AUTH_TOKEN: 'hw_auth_token'
  },

  getToken() {
    try {
      return localStorage.getItem(this.KEYS.AUTH_TOKEN);
    } catch (e) {
      return null;
    }
  },

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(this.KEYS.AUTH_TOKEN, token);
      } else {
        localStorage.removeItem(this.KEYS.AUTH_TOKEN);
      }
    } catch (e) {}
  },

  async apiRequest(endpoint, method = 'GET', body = null) {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(endpoint, opts);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      console.warn(`[Store API] ${method} ${endpoint} failed:`, e.message);
      return null;
    }
  },

  async register(username, password, fitnessLevel = 'Intermediate') {
    const data = await this.apiRequest('/api/auth/register', 'POST', {
      username,
      password,
      fitness_level: fitnessLevel
    });
    if (data && data.token) {
      this.setToken(data.token);
      this.syncUserFromServer(data.user);
      return data;
    }
    throw new Error('Registration failed');
  },

  async login(username, password) {
    const data = await this.apiRequest('/api/auth/login', 'POST', { username, password });
    if (data && data.token) {
      this.setToken(data.token);
      this.syncUserFromServer(data.user);
      return data;
    }
    throw new Error('Invalid username or password');
  },

  async guestLogin() {
    const data = await this.apiRequest('/api/auth/guest', 'POST');
    if (data && data.token) {
      this.setToken(data.token);
      this.syncUserFromServer(data.user);
      return data;
    }
    throw new Error('Guest login failed');
  },

  async syncSession() {
    const token = this.getToken();
    if (!token) return null;
    const data = await this.apiRequest('/api/auth/me', 'GET');
    if (data && data.user) {
      this.syncUserFromServer(data.user);
      return data.user;
    }
    return null;
  },

  syncUserFromServer(serverUser) {
    const user = this.getUser();
    user.id = serverUser.id;
    user.username = serverUser.username;
    user.name = serverUser.username;
    user.fitnessLevel = serverUser.fitness_level || user.fitnessLevel;
    user.isPro = Boolean(serverUser.is_pro);
    user.streakCount = serverUser.streak_count || 0;
    user.weeklyGoalTarget = serverUser.weekly_goal_target || 5;
    user.weeklyCompletedCount = serverUser.weekly_completed_count || 0;
    this.saveUser(user);
    return user;
  },

  logout() {
    this.apiRequest('/api/auth/logout', 'POST');
    this.setToken(null);
    const user = this.getUser();
    user.username = null;
    user.name = 'Athlete';
    this.saveUser(user);
  },

  getUser() {
    try {
      const data = localStorage.getItem(this.KEYS.USER_PROGRESS);
      return data ? JSON.parse(data) : this.initialState.user;
    } catch (e) {
      return this.initialState.user;
    }
  },

  saveUser(user) {
    try {
      user.updatedAt = new Date().toISOString();
      localStorage.setItem(this.KEYS.USER_PROGRESS, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user:', e);
    }
  },

  updateWeeklyGoal(target) {
    const user = this.getUser();
    user.weeklyGoalTarget = Math.max(1, Math.min(7, parseInt(target, 10)));
    this.saveUser(user);
    // Background sync to cloud
    if (this.getToken()) {
      this.apiRequest('/api/user/goal', 'PATCH', { target: user.weeklyGoalTarget });
    }
    return user;
  },

  // Initial Seed Data matching screenshots exactly
  initialState: {
    user: {
      id: 'usr_001',
      name: 'Athlete',
      fitnessLevel: 'Intermediate', // 'Beginner' | 'Intermediate' | 'Advanced'
      streakCount: 1,
      isPro: false,
      weeklyGoalTarget: 5,
      weeklyCompletedCount: 0,
      activeWeekDays: [16, 17, 18, 19, 20, 21, 22],
      currentDaySelected: 18,
      completedMuscleHistory: {}, // { chest: [{ date: '...', exerciseIds: [...] }] }
      updatedAt: new Date().toISOString()
    },

    challenges: [
      {
        id: 'full-body-shred',
        slug: 'full-body-shred',
        title: 'FULL BODY SHRED',
        subtitle: null,
        badgeText: 'CUSTOMIZED FOR YOU',
        durationDays: 28,
        currentDay: 1,
        themeColor: '#0052FF',
        bgGradient: 'linear-gradient(135deg, #0052FF 0%, #0066FF 50%, #0080FF 100%)',
        athleteVisual: 'athlete_shred',
        description: 'Comprehensive high-intensity full body conditioning to torch fat and carve muscle definition without any gym gear.',
        categoryTags: ['All', 'Full Body', 'Build Muscle', 'Lose Weight'],
        metrics: {
          dailyTime: '9-22 Min',
          level: 'Intermediate',
          targetArea: 'Full Body',
          equipment: 'No Equipment'
        },
        exercises: [
          {
            id: 'jumping-jacks',
            name: 'Jumping Jacks',
            durationSeconds: 30,
            reps: '30s',
            restSeconds: 20,
            muscle: 'Full Body Warmup',
            animation: 'jumping_jacks'
          },
          {
            id: 'push-ups',
            name: 'Classic Push-Ups',
            durationSeconds: 40,
            reps: '14 reps',
            restSeconds: 30,
            muscle: 'Chest & Triceps',
            animation: 'pushups'
          },
          {
            id: 'squats',
            name: 'Air Squats',
            durationSeconds: 45,
            reps: '18 reps',
            restSeconds: 30,
            muscle: 'Quads & Glutes',
            animation: 'squats'
          },
          {
            id: 'mountain-climbers',
            name: 'Mountain Climbers',
            durationSeconds: 30,
            reps: '20 reps',
            restSeconds: 25,
            muscle: 'Core & Cardio',
            animation: 'climbers'
          },
          {
            id: 'plank',
            name: 'Forearm Plank',
            durationSeconds: 45,
            reps: '45s',
            restSeconds: 30,
            muscle: 'Abdominal Core',
            animation: 'plank'
          }
        ]
      },
      {
        id: 'kegel-power-boost',
        slug: 'kegel-power-boost',
        title: 'KEGEL POWER BOOST',
        subtitle: '14 DAYS',
        badgeText: null,
        durationDays: 14,
        currentDay: 1,
        themeColor: '#6B8299',
        bgGradient: 'linear-gradient(135deg, #6B8299 0%, #5B7288 100%)',
        athleteVisual: 'athlete_kegel',
        description: 'Strengthen your pelvic floor with Kegel exercises for better sex and intimacy!',
        categoryTags: ['All', 'Full Body', 'Build Muscle'],
        metrics: {
          dailyTime: '5-12 Min',
          level: 'All Levels',
          targetArea: 'Pelvic Floor & Core',
          equipment: 'Floor Mat'
        },
        exercises: [
          {
            id: 'glute-bridge',
            name: 'Pelvic Floor Glute Bridge',
            durationSeconds: 45,
            reps: '15 reps',
            restSeconds: 20,
            muscle: 'Pelvic Floor & Glutes',
            animation: 'bridge'
          },
          {
            id: 'kegel-hold',
            name: 'Deep Kegel Isometric Hold',
            durationSeconds: 30,
            reps: '30s hold',
            restSeconds: 20,
            muscle: 'Deep Pelvic Core',
            animation: 'kegel'
          },
          {
            id: 'bird-dog',
            name: 'Bird-Dog Contractions',
            durationSeconds: 40,
            reps: '12 reps / side',
            restSeconds: 20,
            muscle: 'Lower Back & Pelvis',
            animation: 'birddog'
          }
        ]
      },
      {
        id: 'get-ripped-dumbbell',
        slug: 'get-ripped-dumbbell',
        title: 'GET RIPPED WITH DUMBBELL',
        subtitle: '30 DAYS',
        badgeText: null,
        durationDays: 30,
        currentDay: 1,
        themeColor: '#009FB7',
        bgGradient: 'linear-gradient(135deg, #009FB7 0%, #00879B 100%)',
        athleteVisual: 'athlete_dumbbell',
        description: 'Use dumbbells to build bigger muscles and boost full-body strength in 30 days!',
        categoryTags: ['All', 'Build Muscle'],
        metrics: {
          dailyTime: '15-25 Min',
          level: 'Intermediate',
          targetArea: 'Biceps, Shoulders & Chest',
          equipment: 'Pair of Dumbbells'
        },
        exercises: [
          {
            id: 'bicep-curls',
            name: 'Dumbbell Bicep Curls',
            durationSeconds: 40,
            reps: '12 reps',
            restSeconds: 30,
            muscle: 'Biceps Brachii',
            animation: 'curls'
          },
          {
            id: 'overhead-press',
            name: 'Dumbbell Shoulder Press',
            durationSeconds: 45,
            reps: '10 reps',
            restSeconds: 30,
            muscle: 'Deltoids & Triceps',
            animation: 'press'
          },
          {
            id: 'goblet-squat',
            name: 'Dumbbell Goblet Squats',
            durationSeconds: 45,
            reps: '14 reps',
            restSeconds: 30,
            muscle: 'Quads & Glutes',
            animation: 'goblet'
          }
        ]
      },
      {
        id: 'full-body-challenge',
        slug: 'full-body-challenge',
        title: 'FULL BODY CHALLENGE',
        subtitle: '28 DAYS',
        badgeText: null,
        durationDays: 28,
        currentDay: 1,
        themeColor: '#0052FF',
        bgGradient: 'linear-gradient(135deg, #0052FF 0%, #0044D6 100%)',
        athleteVisual: 'athlete_fullbody',
        description: 'Start your body-toning journey to target all muscle groups and build your dream body in 4 weeks!',
        categoryTags: ['All', 'Full Body', 'Lose Weight', 'Build Muscle'],
        metrics: {
          dailyTime: '12-20 Min',
          level: 'Intermediate',
          targetArea: 'Total Body',
          equipment: 'No Equipment'
        },
        exercises: [
          {
            id: 'burpees',
            name: 'Full Body Burpees',
            durationSeconds: 35,
            reps: '10 reps',
            restSeconds: 35,
            muscle: 'Total Body Cardiovascular',
            animation: 'burpees'
          },
          {
            id: 'pike-pushups',
            name: 'Pike Push-Ups',
            durationSeconds: 40,
            reps: '10 reps',
            restSeconds: 30,
            muscle: 'Shoulders & Triceps',
            animation: 'pike'
          },
          {
            id: 'bicycle-crunches',
            name: 'Bicycle Crunches',
            durationSeconds: 40,
            reps: '20 reps',
            restSeconds: 25,
            muscle: 'Obliques & Abs',
            animation: 'bicycle'
          }
        ]
      }
    ],

    bodyFocusCategories: [
      { id: 'chest', name: '🫁 Chest', active: true },
      { id: 'warmup', name: '🔥 Warmup', active: false },
      { id: 'abs', name: '🍫 Abs', active: false },
      { id: 'arm', name: '🦾 Arms', active: false },
      { id: 'leg', name: '🦵 Legs', active: false },
      { id: 'shoulders', name: '🛡️ Shoulders', active: false },
      { id: 'back', name: '🧗 Back', active: false }
    ],

    bodyFocusWorkouts: [
      {
        id: 'abs-beginner',
        category: 'abs',
        title: 'Abs Beginner',
        level: 'Beginner',
        time: '16 Min',
        exercisesCount: 14,
        calories: 120,
        gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
      },
      {
        id: 'abs-intermediate',
        category: 'abs',
        title: 'Six Pack Intermediate',
        level: 'Intermediate',
        time: '24 Min',
        exercisesCount: 18,
        calories: 190,
        gradient: 'linear-gradient(135deg, #0052FF 0%, #0066FF 100%)'
      },
      {
        id: 'arm-power',
        category: 'arm',
        title: 'Arm Muscle Booster',
        level: 'Intermediate',
        time: '18 Min',
        exercisesCount: 15,
        calories: 160,
        gradient: 'linear-gradient(135deg, #6B8299 0%, #4B637B 100%)'
      },
      {
        id: 'chest-builder',
        category: 'chest',
        title: 'Chest Sculptor',
        level: 'Intermediate',
        time: '20 Min',
        exercisesCount: 16,
        calories: 180,
        gradient: 'linear-gradient(135deg, #009FB7 0%, #007C91 100%)'
      },
      {
        id: 'leg-explosive',
        category: 'leg',
        title: 'Lower Body Blast',
        level: 'Intermediate',
        time: '22 Min',
        exercisesCount: 16,
        calories: 210,
        gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
      }
    ]
  },

  getUser() {
    try {
      const data = localStorage.getItem(this.KEYS.USER_PROGRESS);
      return data ? JSON.parse(data) : this.initialState.user;
    } catch (e) {
      return this.initialState.user;
    }
  },

  saveUser(user) {
    try {
      user.updatedAt = new Date().toISOString();
      localStorage.setItem(this.KEYS.USER_PROGRESS, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user:', e);
    }
  },

  updateWeeklyGoal(target) {
    const user = this.getUser();
    user.weeklyGoalTarget = Math.max(1, Math.min(7, parseInt(target, 10)));
    this.saveUser(user);
    return user;
  },

  togglePro() {
    const user = this.getUser();
    user.isPro = !user.isPro;
    this.saveUser(user);
    return user;
  },

  getChallenges(category = 'All', searchQuery = '') {
    let list = this.initialState.challenges;

    if (category && category !== 'All') {
      list = list.filter(c => c.categoryTags.includes(category));
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.description.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q))
      );
    }

    return list;
  },

  getChallengeById(id) {
    return this.initialState.challenges.find(c => c.id === id) || this.initialState.challenges[0];
  },

  logWorkoutCompletion(challengeId, dayNumber = 1, customTitle = null) {
    const challenge = this.getChallengeById(challengeId);
    const user = this.getUser();

    // Increment weekly completed count
    user.weeklyCompletedCount += 1;
    user.streakCount += 1;
    this.saveUser(user);

    // Save to workout history with accurate title
    const logs = this.getWorkoutLogs();
    const title = customTitle || (challenge ? challenge.title : 'Workout Session');
    const newLog = {
      id: 'log_' + Date.now(),
      challengeId: challengeId,
      challengeTitle: title,
      dayNumber: dayNumber,
      completedAt: new Date().toISOString(),
      durationMinutes: 18,
      caloriesBurned: 145
    };
    logs.unshift(newLog);

    try {
      localStorage.setItem(this.KEYS.WORKOUT_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save logs:', e);
    }

    // Cloud background sync
    this.logWorkoutSessionToCloud({
      workoutId: challengeId,
      title: title,
      muscle: challenge ? challenge.metrics.targetArea : 'Workout',
      dayNumber: dayNumber,
      durationMinutes: 18,
      caloriesBurned: 145,
      exercises: challenge ? challenge.exercises : []
    });

    return { user, log: newLog };
  },

  logSingleExerciseCompleted(exercise, muscleName = null) {
    const user = this.getUser();
    const muscle = muscleName || exercise.target || exercise.muscle || 'Exercise';
    const mKey = (exercise.muscle || muscle || 'all').toLowerCase();

    // Record into user muscle history
    if (!user.completedMuscleHistory) user.completedMuscleHistory = {};
    if (!user.completedMuscleHistory[mKey]) user.completedMuscleHistory[mKey] = [];
    user.completedMuscleHistory[mKey].push({
      date: new Date().toISOString(),
      exerciseIds: [exercise.id],
      count: 1
    });

    // Increment progress counters
    user.weeklyCompletedCount += 1;
    user.streakCount += 1;
    this.saveUser(user);

    // Save to workout history logs with the EXACT exercise name and muscle
    const logs = this.getWorkoutLogs();
    const title = `${exercise.name} (${muscle.toUpperCase()})`;
    const newLog = {
      id: 'log_' + Date.now(),
      challengeId: `ex-${exercise.id}`,
      challengeTitle: title,
      dayNumber: 1,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.round((exercise.durationSeconds || 40) / 60) || 4,
      caloriesBurned: 35,
      exercises: [exercise]
    };
    logs.unshift(newLog);

    try {
      localStorage.setItem(this.KEYS.WORKOUT_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save log:', e);
    }

    // Cloud background sync
    this.logWorkoutSessionToCloud({
      workoutId: `ex-${exercise.id}`,
      title: title,
      muscle: muscle,
      dayNumber: 1,
      durationMinutes: Math.round((exercise.durationSeconds || 40) / 60) || 4,
      caloriesBurned: 35,
      exercises: [exercise]
    });

    return { user, log: newLog };
  },

  getWorkoutLogs() {
    try {
      const data = localStorage.getItem(this.KEYS.WORKOUT_LOGS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  clearWorkoutLogs() {
    localStorage.removeItem(this.KEYS.WORKOUT_LOGS);
    return [];
  },

  resetAllProgress() {
    localStorage.removeItem(this.KEYS.USER_PROGRESS);
    localStorage.removeItem(this.KEYS.WORKOUT_LOGS);
    return this.initialState.user;
  },

  // Link and synchronize authentic dataset exercises
  initExercises() {
    if (typeof ExerciseDataset === 'undefined') return;

    // Synchronize challenge exercise lists
    this.initialState.challenges.forEach(ch => {
      if (ExerciseDataset.challenges && ExerciseDataset.challenges[ch.id]) {
        ch.exercises = ExerciseDataset.challenges[ch.id];
      }
    });
  },

  setUserLevel(level) {
    const user = this.getUser();
    user.fitnessLevel = level;
    this.saveUser(user);
    return user;
  },

  getUserLevel() {
    const user = this.getUser();
    return user.fitnessLevel || 'Intermediate';
  },

  getBodyFocusExercises(catId) {
    if (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.bodyFocus && ExerciseDataset.bodyFocus[catId]) {
      return ExerciseDataset.bodyFocus[catId];
    }
    return [];
  },

  // ========================================================
  // SMART DAILY 5-EXERCISE ROUTINE ENGINE (ROTATION ENGINE)
  // ========================================================
  getRecommendedDailyRoutine({ muscle = 'chest', location = 'Home', level = null, forceShuffle = false, count = 5 } = {}) {
    const user = this.getUser();
    const effectiveLevel = level || user.fitnessLevel || 'Intermediate';
    const mKey = muscle.toLowerCase();

    // 1. Read history of completed exercises for this muscle
    if (!user.completedMuscleHistory) user.completedMuscleHistory = {};
    const muscleHistory = user.completedMuscleHistory[mKey] || [];
    const lastSession = muscleHistory.length > 0 ? muscleHistory[muscleHistory.length - 1] : null;
    const lastCompletedIds = lastSession ? (lastSession.exerciseIds || []) : [];

    // 2. Query available exercises from dataset matching muscle, location, and level
    let pool = [];
    if (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.queryExercises) {
      pool = ExerciseDataset.queryExercises({
        muscle: muscle,
        location: location,
        level: effectiveLevel !== 'All' ? effectiveLevel : 'All',
        limit: 120
      });

      // If pool is smaller than 5, broaden to all levels in this environment
      if (pool.length < count && effectiveLevel !== 'All') {
        pool = ExerciseDataset.queryExercises({
          muscle: muscle,
          location: location,
          limit: 120
        });
      }
    }

    // Fallback if full dataset is loading
    if (!pool || pool.length === 0) {
      pool = this.getBodyFocusExercises(mKey);
    }

    // 3. Smart Rotation: Filter out exercises performed in the previous session
    let fresh = pool.filter(x => !lastCompletedIds.includes(x.id));
    let previous = pool.filter(x => lastCompletedIds.includes(x.id));

    let selected = [];
    let isRotated = false;

    function trueShuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    if (fresh.length >= count) {
      // We have enough fresh exercises!
      isRotated = lastCompletedIds.length > 0;
      selected = forceShuffle 
        ? trueShuffle(fresh).slice(0, count)
        : fresh.slice(0, count);
    } else {
      // Blend fresh with oldest previous movements
      const blended = [...fresh, ...previous];
      selected = forceShuffle ? trueShuffle(blended).slice(0, count) : blended.slice(0, count);
      isRotated = fresh.length > 0 && lastCompletedIds.length > 0;
    }

    return {
      muscle: muscle,
      location: location,
      level: effectiveLevel,
      exercises: selected,
      isRotated: isRotated,
      lastSessionDate: lastSession ? lastSession.date : null,
      totalPoolCount: pool.length
    };
  },

  logMuscleSessionCompleted(muscle, exerciseIds, exercises = []) {
    const user = this.getUser();
    if (!user.completedMuscleHistory) user.completedMuscleHistory = {};
    const mKey = muscle.toLowerCase();
    if (!user.completedMuscleHistory[mKey]) user.completedMuscleHistory[mKey] = [];

    const record = {
      date: new Date().toISOString(),
      exerciseIds: exerciseIds,
      count: exerciseIds.length
    };
    user.completedMuscleHistory[mKey].push(record);

    // Increment progress counters
    user.weeklyCompletedCount += 1;
    user.streakCount += 1;
    this.saveUser(user);

    // Save to workout history logs
    const logs = this.getWorkoutLogs();
    const title = `${muscle.toUpperCase()} Routine (5 Exercises)`;
    const newLog = {
      id: 'log_' + Date.now(),
      challengeId: `daily-${mKey}`,
      challengeTitle: title,
      dayNumber: 1,
      completedAt: new Date().toISOString(),
      durationMinutes: 20,
      caloriesBurned: 165,
      exercises: exercises
    };
    logs.unshift(newLog);

    try {
      localStorage.setItem(this.KEYS.WORKOUT_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save log:', e);
    }

    // Cloud background sync
    this.logWorkoutSessionToCloud({
      workoutId: `daily-${mKey}`,
      title: title,
      muscle: muscle,
      dayNumber: 1,
      durationMinutes: 20,
      caloriesBurned: 165,
      exercises: exercises
    });

    return { user, log: newLog };
  },

  async logWorkoutSessionToCloud({ workoutId, title, muscle, dayNumber, durationMinutes, caloriesBurned, exercises }) {
    if (!this.getToken()) return null;
    return await this.apiRequest('/api/workouts/complete', 'POST', {
      workout_id: workoutId,
      workout_title: title,
      muscle_group: muscle,
      day_number: dayNumber || 1,
      duration_minutes: durationMinutes || 18,
      calories_burned: caloriesBurned || 145,
      exercises: exercises || []
    });
  },

  async getTimelineHistory() {
    if (this.getToken()) {
      const data = await this.apiRequest('/api/workouts/history', 'GET');
      if (data && data.today) {
        return data;
      }
    }
    const local = this.getWorkoutLogs();
    return {
      today: local.slice(0, 5),
      yesterday: [],
      this_week: [],
      last_week: [],
      older: [],
      all_logs: local
    };
  }
};

// Auto initialize exercises on load
HomeWorkoutStore.initExercises();
