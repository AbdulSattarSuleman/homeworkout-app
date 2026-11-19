// Storage Manager for Cali Move Web Clone
const StorageManager = {
  KEYS: {
    USER_PROFILE: 'cm_user_profile',
    WORKOUT_HISTORY: 'cm_workout_history',
    APP_SETTINGS: 'cm_settings',
    UNLOCKED_BADGES: 'cm_badges'
  },

  getProfile() {
    const defaultProfile = {
      name: "Athlete",
      userLevel: "intermediate", // 'beginner' | 'intermediate' | 'advanced'
      level: "Level 2 • Intermediate",
      streakDays: 4,
      totalWorkouts: 8,
      activeProgramId: "hypertrophy",
      caloriesBurned: 1840
    };
    try {
      const data = localStorage.getItem(this.KEYS.USER_PROFILE);
      return data ? { ...defaultProfile, ...JSON.parse(data) } : defaultProfile;
    } catch (e) {
      return defaultProfile;
    }
  },

  setUserLevel(levelId) {
    const profile = this.getProfile();
    profile.userLevel = levelId;
    if (levelId === 'beginner') {
      profile.level = "Level 1 • Beginner (Foundation)";
      profile.activeProgramId = "basics";
    } else if (levelId === 'intermediate') {
      profile.level = "Level 2 • Intermediate (Hypertrophy)";
      profile.activeProgramId = "hypertrophy";
    } else if (levelId === 'advanced') {
      profile.level = "Level 3 • Advanced (Skills)";
      profile.activeProgramId = "skills";
    }
    this.saveProfile(profile);
    return profile;
  },

  saveProfile(profile) {
    try {
      localStorage.setItem(this.KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn("Storage failed:", e);
    }
  },

  getSettings() {
    const defaultSettings = {
      soundEnabled: true,
      autoAdvance: true,
      videoPlaybackRate: 1.0,
      theme: 'dark' // 'dark' | 'light'
    };
    try {
      const data = localStorage.getItem(this.KEYS.APP_SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch (e) {
      return defaultSettings;
    }
  },

  getTheme() {
    const settings = this.getSettings();
    return settings.theme || 'dark';
  },

  setTheme(theme) {
    const settings = this.getSettings();
    settings.theme = theme;
    this.saveSettings(settings);
    document.documentElement.setAttribute('data-theme', theme);
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(this.KEYS.APP_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn("Storage failed:", e);
    }
  },

  logCompletedWorkout(workoutSummary) {
    try {
      const history = this.getHistory();
      history.unshift({
        ...workoutSummary,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(this.KEYS.WORKOUT_HISTORY, JSON.stringify(history));

      // Update user streak and stats
      const profile = this.getProfile();
      profile.totalWorkouts += 1;
      profile.streakDays += 1;
      profile.caloriesBurned += workoutSummary.calories || 200;
      this.saveProfile(profile);

      return profile;
    } catch (e) {
      console.warn("History save failed:", e);
      return null;
    }
  },

  getHistory() {
    try {
      const data = localStorage.getItem(this.KEYS.WORKOUT_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
};
