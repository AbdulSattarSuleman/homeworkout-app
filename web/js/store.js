// Central Data Store & State Synchronization Layer
const HomeWorkoutStore = {
  KEYS: {
    USER_PROGRESS: 'hw_user_progress',
    WORKOUT_LOGS: 'hw_workout_logs',
    CHALLENGES: 'hw_challenges',
    AUTH_TOKEN: 'hw_auth_token'
  },

  supabaseClient: null,

  initSupabase() {
    // Proactively purge any legacy client-side accounts vault so password hashes are never stored locally
    try { localStorage.removeItem('hw_accounts_vault'); } catch (e) {}

    if (this.supabaseClient) return this.supabaseClient;
    if (typeof window !== 'undefined' && typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      const url = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || localStorage.getItem('hw_supabase_url');
      const anonKey = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || localStorage.getItem('hw_supabase_anon_key');
      if (url && anonKey) {
        try {
          this.supabaseClient = window.supabase.createClient(url, anonKey);
          console.log('[Store] Supabase Cloud Client Connected');
          return this.supabaseClient;
        } catch (e) {
          console.warn('[Store] Supabase connection notice:', e);
        }
      }
    }
    return null;
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

  getApiBase() {
    if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
      return window.APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');
    }
    try {
      const custom = localStorage.getItem('hw_api_base_url');
      if (custom) return custom.replace(/\/+$/, '');
    } catch (e) {}

    return '';
  },

  async apiRequest(endpoint, method = 'GET', body = null) {
    const base = this.getApiBase();
    if (!base && !endpoint.startsWith('http')) {
      // In static GitHub Pages hosting without custom backend, operate 100% locally
      return null;
    }

    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;

    try {
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      // Offline or network unreachable - handled gracefully by local-first logic
      return null;
    }
  },

  async register(username, password, fitnessLevel = 'Intermediate') {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    // 1. Strict Input Validations
    if (!cleanUser) {
      throw new Error('Please enter a username or email.');
    }
    if (cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!cleanPass) {
      throw new Error('Please enter a password.');
    }
    if (cleanPass.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const client = this.initSupabase();
    if (!client) {
      throw new Error('Authentication service is currently unavailable. Please check your network connection.');
    }

    const email = this.formatAuthEmail(cleanUser);

    // Call Supabase Cloud Auth: Passwords and hashes are NEVER stored in localStorage!
    const { data: supaData, error: supaErr } = await client.auth.signUp({
      email: email,
      password: cleanPass,
      options: {
        data: { username: cleanUser, fitness_level: fitnessLevel }
      }
    });

    if (supaErr) {
      if (supaErr.message.includes('already registered') || supaErr.message.includes('user_already_exists') || supaErr.message.includes('already taken')) {
        throw new Error('Username already taken. Please choose another or sign in.');
      }
      throw new Error(supaErr.message || 'Registration failed.');
    }

    if (supaData && supaData.user && Array.isArray(supaData.user.identities) && supaData.user.identities.length === 0) {
      throw new Error('Username already taken. Please choose another or sign in.');
    }

    const token = (supaData && supaData.session) ? supaData.session.access_token : null;
    if (token) {
      this.setToken(token);
    }

    const user = this.getUser();
    user.id = (supaData && supaData.user) ? supaData.user.id : ('usr_' + Date.now().toString(36));
    user.username = cleanUser;
    user.name = cleanUser;
    user.fitnessLevel = fitnessLevel;
    user.isGuest = false;
    this.saveUser(user);

    // Clean up any legacy vault from localStorage
    try { localStorage.removeItem('hw_accounts_vault'); } catch (e) {}

    return { status: 'success', user, token };
  },

  formatAuthEmail(cleanUser) {
    if (!cleanUser) return 'athlete@homeworkout.app';
    if (cleanUser.includes('@')) return cleanUser.trim().toLowerCase();
    const sanitized = cleanUser.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return (sanitized || ('athlete_' + Date.now().toString(36))) + '@homeworkout.app';
  },

  async login(username, password) {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      throw new Error('Please enter both username and password.');
    }

    const client = this.initSupabase();
    if (!client) {
      throw new Error('Authentication service is currently unavailable. Please check your network connection.');
    }

    const email = this.formatAuthEmail(cleanUser);
    const { data, error } = await client.auth.signInWithPassword({
      email: email,
      password: cleanPass
    });

    if (error || !data || !data.user) {
      throw new Error('No account found with this username or password was incorrect. Please check your credentials or create an account.');
    }

    const token = data.session ? data.session.access_token : null;
    if (token) {
      this.setToken(token);
    }

    const user = this.getUser();
    user.id = data.user.id;
    user.username = cleanUser;
    user.name = cleanUser;
    user.isGuest = false;
    this.saveUser(user);

    // Clean up any legacy vault from localStorage
    try { localStorage.removeItem('hw_accounts_vault'); } catch (e) {}

    // Sync profile & workout logs from Supabase cloud
    await this.syncFromCloud();

    return { status: 'success', user, token };
  },

  async guestLogin() {
    const guestId = 'guest_' + Math.random().toString(36).substr(2, 6);
    const guestUsername = 'Athlete_' + Math.random().toString(36).substr(2, 4).toUpperCase();
    const token = 'guest_token_' + Date.now().toString(36);
    this.setToken(token);

    const user = this.getUser();
    user.id = guestId;
    user.username = guestUsername;
    user.name = guestUsername;
    user.isGuest = true;
    this.saveUser(user);

    return { status: 'success', user, token };
  },

  async syncSession() {
    const token = this.getToken();
    const user = this.getUser();

    // 1. If no token is stored
    if (!token) {
      if (user && user.username && !user.isGuest) {
        // Lingering username in local state without token - reset
        this.logout();
      }
      return this.getUser();
    }

    // 2. If it's a guest token, keep guest session
    if (token.startsWith('guest_token_') || user.isGuest) {
      return this.getUser();
    }

    // 3. Cloud Supabase Cryptographic Verification
    const client = this.initSupabase();
    if (client) {
      try {
        const { data: userData, error: userErr } = await client.auth.getUser(token);
        if (userErr || !userData || !userData.user) {
          console.warn('[Security] Invalid or spoofed session token detected. Purging unverified session:', userErr ? userErr.message : 'No verified user');
          this.logout();
          return this.getUser();
        }

        // Token is genuine! User is cryptographically verified by Supabase
        const verifiedUser = userData.user;
        user.id = verifiedUser.id;
        user.isGuest = false;

        // Fetch verified profile from database
        const { data: profile } = await client
          .from('profiles')
          .select('*')
          .eq('id', verifiedUser.id)
          .maybeSingle();

        if (profile) {
          user.username = profile.username || user.username;
          user.name = profile.username || user.name;
          user.fitnessLevel = profile.fitness_level || user.fitnessLevel || 'Intermediate';
          user.isPro = Boolean(profile.is_pro);
          user.weeklyGoalTarget = Number(profile.weekly_goal_target) || 5;
          user.weeklyCompletedCount = Number(profile.weekly_completed_count) || 0;
          user.createdAt = profile.created_at || user.createdAt;
        } else {
          // Profile row doesn't exist yet in Supabase profiles table! Auto-create it now:
          const username = (verifiedUser.user_metadata && verifiedUser.user_metadata.username) 
            || user.username 
            || (verifiedUser.email ? verifiedUser.email.split('@')[0] : 'Athlete');
          const nowIso = new Date().toISOString();
          user.username = username;
          user.name = username;
          await client.from('profiles').upsert({
            id: verifiedUser.id,
            username: username,
            fitness_level: user.fitnessLevel || 'Intermediate',
            is_pro: Boolean(user.isPro),
            streak_count: user.streakCount || 0,
            weekly_goal_target: user.weeklyGoalTarget || 5,
            weekly_completed_count: user.weeklyCompletedCount || 0,
            created_at: verifiedUser.created_at || nowIso,
            updated_at: nowIso
          }).catch(e => console.warn('[Supabase] Auto-create profile notice:', e));
        }

        this.saveUser(user);
        return user;
      } catch (err) {
        console.warn('[Security] Token verification error:', err);
        this.logout();
        return this.getUser();
      }
    }

    // 4. If Supabase is not active, verify against local vault
    const vault = this.getAccountsVault();
    const userKey = (user.username || '').toLowerCase();
    if (!vault[userKey]) {
      // Fake local user not in vault - purge
      this.logout();
    }

    return this.getUser();
  },

  syncUserFromServer(serverUser) {
    const user = this.getUser();
    user.id = serverUser.id;
    user.username = serverUser.username;
    user.name = serverUser.username;
    user.fitnessLevel = serverUser.fitness_level || user.fitnessLevel;
    user.isPro = Boolean(serverUser.is_pro);
    user.streakCount = serverUser.streak_count || 0;
    user.weeklyGoalTarget = Number(serverUser.weekly_goal_target) || 5;
    user.weeklyCompletedCount = Number(serverUser.weekly_completed_count) || 0;
    this.saveUser(user);
    return user;
  },

  logout() {
    const client = this.initSupabase();
    if (client) {
      try { client.auth.signOut(); } catch (e) {}
    }
    this.setToken(null);
    try {
      localStorage.removeItem(this.KEYS.USER_PROGRESS);
    } catch (e) {}
    const user = JSON.parse(JSON.stringify(this.initialState.user));
    user.username = null;
    user.name = 'Athlete';
    user.isGuest = false;
    try {
      localStorage.setItem(this.KEYS.USER_PROGRESS, JSON.stringify(user));
    } catch (e) {}
    return true;
  },

  calculateStreak(logs = null) {
    try {
      const workoutLogs = logs || this.getWorkoutLogs();
      if (!workoutLogs || workoutLogs.length === 0) return 0;

      const dateSet = new Set();
      workoutLogs.forEach(log => {
        if (log && log.completedAt) {
          const d = new Date(log.completedAt);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateSet.add(`${y}-${m}-${day}`);
          }
        }
      });

      if (dateSet.size === 0) return 0;

      const sortedDates = Array.from(dateSet).sort().reverse();
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

      const latest = sortedDates[0];
      if (latest !== todayStr && latest !== yesterdayStr) {
        return 0; // Streak broken
      }

      let streak = 0;
      let checkDate = new Date(latest.split('-')[0], parseInt(latest.split('-')[1], 10) - 1, latest.split('-')[2]);

      for (const dStr of sortedDates) {
        const curStr = `${checkDate.getFullYear()}-${pad(checkDate.getMonth() + 1)}-${pad(checkDate.getDate())}`;
        if (dStr === curStr) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    } catch (e) {
      return 0;
    }
  },

  getUser() {
    let user;
    try {
      const data = localStorage.getItem(this.KEYS.USER_PROGRESS);
      user = data ? JSON.parse(data) : JSON.parse(JSON.stringify(this.initialState.user));
    } catch (e) {
      user = JSON.parse(JSON.stringify(this.initialState.user));
    }
    if (!user || typeof user !== 'object') {
      user = JSON.parse(JSON.stringify(this.initialState.user));
    }
    user.weeklyGoalTarget = Number(user.weeklyGoalTarget) || 5;
    user.weeklyCompletedCount = Number(user.weeklyCompletedCount) || 0;
    user.activeWeekDays = Array.isArray(user.activeWeekDays) ? user.activeWeekDays : [16, 17, 18, 19, 20, 21, 22];
    user.streakCount = this.calculateStreak();
    return user;
  },

  saveUser(user) {
    try {
      user.updatedAt = new Date().toISOString();
      user.streakCount = this.calculateStreak();
      localStorage.setItem(this.KEYS.USER_PROGRESS, JSON.stringify(user));

      // Supabase Cloud Profile Sync
      const client = this.initSupabase();
      if (client && !user.isGuest && user.username) {
        const uid = (user.id && user.id.length === 36) ? user.id : null;
        if (uid) {
          client.from('profiles').upsert({
            id: uid,
            username: user.username,
            fitness_level: user.fitnessLevel || 'Intermediate',
            is_pro: Boolean(user.isPro),
            streak_count: user.streakCount || 0,
            weekly_goal_target: user.weeklyGoalTarget || 5,
            weekly_completed_count: user.weeklyCompletedCount || 0,
            updated_at: new Date().toISOString()
          }).then(() => {}).catch(err => console.warn('[Supabase] profile sync notice:', err));
        } else {
          client.auth.getSession().then(({ data }) => {
            if (data && data.session && data.session.user) {
              client.from('profiles').upsert({
                id: data.session.user.id,
                username: user.username,
                fitness_level: user.fitnessLevel || 'Intermediate',
                is_pro: Boolean(user.isPro),
                streak_count: user.streakCount || 0,
                weekly_goal_target: user.weeklyGoalTarget || 5,
                weekly_completed_count: user.weeklyCompletedCount || 0,
                updated_at: new Date().toISOString()
              }).then(() => {}).catch(err => console.warn('[Supabase] profile sync notice:', err));
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to save user:', e);
    }
  },

  async syncFromCloud() {
    const client = this.initSupabase();
    if (!client) return;

    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData || !sessionData.session || !sessionData.session.user) return;

      const userId = sessionData.session.user.id;
      const token = sessionData.session.access_token;
      this.setToken(token);

      // 1. Fetch Cloud Profile
      const { data: profile, error: pErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile && !pErr) {
        const user = this.getUser();
        user.id = profile.id;
        user.username = profile.username;
        user.name = profile.username;
        user.fitnessLevel = profile.fitness_level || user.fitnessLevel;
        user.isPro = Boolean(profile.is_pro);
        user.weeklyGoalTarget = profile.weekly_goal_target || user.weeklyGoalTarget;
        user.weeklyCompletedCount = profile.weekly_completed_count || user.weeklyCompletedCount;
        user.isGuest = false;
        this.saveUser(user);
      }

      // 2. Fetch Cloud Workout Logs
      const { data: logs, error: lErr } = await client
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (logs && !lErr && logs.length > 0) {
        const localLogs = this.getWorkoutLogs();
        const mergedMap = new Map();
        localLogs.forEach(l => mergedMap.set(l.id, l));
        logs.forEach(l => {
          mergedMap.set(l.id, {
            id: l.id,
            challengeId: l.title,
            challengeTitle: l.title,
            dayNumber: 1,
            completedAt: l.completed_at,
            durationMinutes: l.duration_minutes,
            caloriesBurned: l.calories_burned,
            blocks: l.blocks || []
          });
        });
        const mergedList = Array.from(mergedMap.values()).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        this.saveWorkoutLogs(mergedList);
        const user = this.getUser();
        user.streakCount = this.calculateStreak(mergedList);
        this.saveUser(user);
      }
    } catch (err) {
      console.warn('[Supabase] syncFromCloud error:', err);
    }
  },

  updateWeeklyGoal(target) {
    const user = this.getUser();
    user.weeklyGoalTarget = Math.max(1, Math.min(7, parseInt(target, 10)));
    this.saveUser(user);
    return user;
  },

  // Initial Seed Data matching screenshots exactly
  initialState: {
    user: {
      id: 'usr_001',
      name: 'Athlete',
      fitnessLevel: 'Intermediate', // 'Beginner' | 'Intermediate' | 'Advanced'
      streakCount: 0,
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

    // 1. Save to workout history with accurate title
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

    // 2. Increment weekly completed count and recalculate streak based on logs
    user.weeklyCompletedCount += 1;
    this.saveUser(user);

    // 3. Cloud background sync
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
      caloriesBurned: 35
    };
    logs.unshift(newLog);

    try {
      localStorage.setItem(this.KEYS.WORKOUT_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save logs:', e);
    }

    // Increment progress counters and recalculate streak from logs
    user.weeklyCompletedCount += 1;
    this.saveUser(user);

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

  saveWorkoutLogs(logs) {
    try {
      localStorage.setItem(this.KEYS.WORKOUT_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save workout logs:', e);
    }
  },

  getWorkoutLogs() {
    try {
      const data = localStorage.getItem(this.KEYS.WORKOUT_LOGS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  async clearWorkoutLogs() {
    localStorage.removeItem(this.KEYS.WORKOUT_LOGS);
    if (this.getToken()) {
      await this.apiRequest('/api/workouts/history', 'DELETE');
    }
    const user = this.getUser();
    user.weeklyCompletedCount = 0;
    this.saveUser(user);
    return [];
  },

  async deleteSelectedWorkoutLogs(logIds = []) {
    if (!logIds || logIds.length === 0) return this.getWorkoutLogs();
    
    // Update local storage
    const current = this.getWorkoutLogs();
    const filtered = current.filter(l => !logIds.includes(String(l.id)));
    this.saveWorkoutLogs(filtered);

    // Sync to cloud if authenticated
    if (this.getToken()) {
      try {
        const res = await this.apiRequest('/api/workouts/history/delete-selected', 'POST', {
          log_ids: logIds.map(String)
        });
        if (res && typeof res.remaining_count === 'number') {
          const user = this.getUser();
          user.weeklyCompletedCount = res.remaining_count;
          this.saveUser(user);
        }
      } catch (err) {
        console.warn('Failed cloud delete sync:', err);
      }
    } else {
      const user = this.getUser();
      user.weeklyCompletedCount = Math.max(0, user.weeklyCompletedCount - logIds.length);
      this.saveUser(user);
    }

    return filtered;
  },

  async resetAllProgress() {
    localStorage.removeItem(this.KEYS.USER_PROGRESS);
    localStorage.removeItem(this.KEYS.WORKOUT_LOGS);

    if (this.getToken()) {
      await this.apiRequest('/api/user/reset-progress', 'POST');
    }

    const currentUser = this.getUser();
    const freshUser = JSON.parse(JSON.stringify(this.initialState.user));
    freshUser.streakCount = 0;
    freshUser.weeklyCompletedCount = 0;
    if (currentUser && currentUser.username) {
      freshUser.username = currentUser.username;
      freshUser.id = currentUser.id;
      freshUser.fitnessLevel = currentUser.fitnessLevel || 'Intermediate';
    }
    this.saveUser(freshUser);
    return freshUser;
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

    // 1. Save to workout history logs
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

    // 2. Increment weekly completed counter and recalculate streak
    user.weeklyCompletedCount += 1;
    this.saveUser(user);

    // 3. Cloud background sync
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
    // 1. Supabase Cloud Sync
    const client = this.initSupabase();
    if (client) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData && sessionData.session && sessionData.session.user) {
          const { error } = await client.from('workout_logs').insert({
            user_id: sessionData.session.user.id,
            title: title || 'Workout Session',
            location_slug: 'home',
            duration_minutes: durationMinutes || 18,
            calories_burned: caloriesBurned || 145,
            blocks: exercises || []
          });
          if (error) console.warn('[Supabase] workout log insert error:', error.message);
        }
      } catch (e) {
        console.warn('[Supabase] workout log sync notice:', e);
      }
    }

    // 2. Custom API fallback
    if (this.getToken()) {
      return await this.apiRequest('/api/workouts/complete', 'POST', {
        workout_id: workoutId,
        workout_title: title,
        muscle_group: muscle,
        day_number: dayNumber || 1,
        duration_minutes: durationMinutes || 18,
        calories_burned: caloriesBurned || 145,
        exercises: exercises || []
      });
    }
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
