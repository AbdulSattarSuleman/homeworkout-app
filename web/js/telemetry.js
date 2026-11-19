// Client-Side Telemetry & Activity Tracker for Admin Monitoring
const TelemetryTracker = {
  sessionId: null,
  heartbeatInterval: null,
  activeSeconds: 0,
  lastHeartbeatTime: Date.now(),
  currentScreen: 'dashboard',

  init() {
    try {
      this.sessionId = sessionStorage.getItem('hw_telemetry_sid');
      if (!this.sessionId) {
        this.sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        sessionStorage.setItem('hw_telemetry_sid', this.sessionId);
      }

      const device = this.getDeviceInfo();

      // Log initial session start
      this.logEvent('session_start', 'lifecycle', {
        userAgent: navigator.userAgent,
        screenResolution: `${device.screenWidth}x${device.screenHeight}`,
        viewportSize: `${device.viewportWidth}x${device.viewportHeight}`,
        deviceType: device.deviceType,
        pixelRatio: device.pixelRatio,
        isTouch: device.isTouch
      });

      // Start active screen-time ticker (every 15s)
      this.startHeartbeat();

      // Listen for tab visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushHeartbeat();
        } else {
          this.lastHeartbeatTime = Date.now();
        }
      });

      window.addEventListener('pagehide', () => this.flushHeartbeat());
      window.addEventListener('beforeunload', () => this.flushHeartbeat());
    } catch (e) {
      console.warn('[Telemetry] Init warning:', e);
    }
  },

  getDeviceInfo() {
    const sw = window.screen ? window.screen.width : 0;
    const sh = window.screen ? window.screen.height : 0;
    const vw = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
    const vh = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0);
    const dpr = window.devicePixelRatio || 1;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const ua = navigator.userAgent || '';

    let deviceType = 'Desktop / Browser';
    if (/iPhone/i.test(ua)) deviceType = 'Mobile (iPhone)';
    else if (/iPad/i.test(ua)) deviceType = 'Tablet (iPad)';
    else if (/Android/i.test(ua)) {
      deviceType = (sw >= 600 || vw >= 600) ? 'Tablet (Android)' : 'Mobile (Android)';
    } else if (/Windows/i.test(ua)) deviceType = 'Desktop (Windows)';
    else if (/Macintosh/i.test(ua)) deviceType = 'Desktop (Mac)';
    else if (/Linux/i.test(ua)) deviceType = 'Desktop (Linux)';

    return {
      screenWidth: sw,
      screenHeight: sh,
      viewportWidth: vw,
      viewportHeight: vh,
      pixelRatio: dpr,
      isTouch: isTouch,
      deviceType: deviceType
    };
  },

  getApiBase() {
    if (typeof HomeWorkoutStore !== 'undefined' && HomeWorkoutStore.getApiBase) {
      return HomeWorkoutStore.getApiBase();
    }
    if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
      return window.APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');
    }
    try {
      const custom = localStorage.getItem('hw_api_base_url');
      if (custom) return custom.replace(/\/+$/, '');
    } catch (e) {}
    if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
      return 'https://cost-elizabeth-minneapolis-long.trycloudflare.com';
    }
    return '';
  },

  async logEvent(eventType, eventCategory = 'interaction', eventDetails = {}) {
    try {
      const device = this.getDeviceInfo();
      const token = (typeof HomeWorkoutStore !== 'undefined' && HomeWorkoutStore.getToken) 
        ? HomeWorkoutStore.getToken() 
        : null;

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        session_id: this.sessionId,
        event_type: eventType,
        event_category: eventCategory,
        event_details: eventDetails,
        screen_width: device.screenWidth,
        screen_height: device.screenHeight,
        viewport_width: device.viewportWidth,
        viewport_height: device.viewportHeight,
        device_type: device.deviceType
      };

      const base = this.getApiBase();
      const url = base ? `${base}/api/telemetry/event` : '/api/telemetry/event';

      fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {}
  },

  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.lastHeartbeatTime = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const elapsed = Math.round((now - this.lastHeartbeatTime) / 1000);
        this.lastHeartbeatTime = now;
        this.sendHeartbeat(elapsed);
      }
    }, 15000);
  },

  flushHeartbeat() {
    const now = Date.now();
    const elapsed = Math.round((now - this.lastHeartbeatTime) / 1000);
    this.lastHeartbeatTime = now;
    if (elapsed > 0) {
      this.sendHeartbeat(elapsed);
    }
  },

  sendHeartbeat(elapsedSeconds) {
    if (elapsedSeconds <= 0) return;
    try {
      const device = this.getDeviceInfo();
      const token = (typeof HomeWorkoutStore !== 'undefined' && HomeWorkoutStore.getToken) 
        ? HomeWorkoutStore.getToken() 
        : null;

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        session_id: this.sessionId,
        elapsed_seconds: elapsedSeconds,
        current_screen: this.currentScreen,
        screen_width: device.screenWidth,
        screen_height: device.screenHeight,
        viewport_width: device.viewportWidth,
        viewport_height: device.viewportHeight,
        device_type: device.deviceType
      };

      const base = this.getApiBase();
      const url = base ? `${base}/api/telemetry/heartbeat` : '/api/telemetry/heartbeat';

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  },

  // Telemetry Helper Methods
  trackScreen(screenName, tabName = '') {
    this.currentScreen = screenName;
    this.logEvent('screen_view', 'navigation', { screen: screenName, tab: tabName });
  },

  trackWorkoutStart(workoutId, title, muscle, exercisesCount) {
    this.logEvent('workout_start', 'workout', {
      workoutId,
      workoutTitle: title,
      muscle,
      exercisesCount
    });
  },

  trackWorkoutComplete(workoutId, title, duration, calories, exercisesCount) {
    this.logEvent('workout_complete', 'workout', {
      workoutId,
      workoutTitle: title,
      durationMinutes: duration,
      caloriesBurned: calories,
      exercisesCount
    });
  },

  trackExerciseSwap(originalId, originalName, replacementId, replacementName, muscle) {
    this.logEvent('exercise_swap', 'workout', {
      originalId,
      originalName,
      replacementId,
      replacementName,
      muscle
    });
  },

  trackFilterChange(filterType, value) {
    this.logEvent('filter_change', 'interaction', { filterType, value });
  },

  trackAuth(action, username) {
    this.logEvent(`auth_${action}`, 'auth', { action, username });
  },

  trackSearch(query, originScreen = 'dashboard') {
    if (query && query.trim()) {
      this.logEvent('search_query', 'interaction', { query: query.trim(), originScreen });
    }
  }
};

// Auto initialize on load
if (typeof window !== 'undefined') {
  TelemetryTracker.init();
}
