// Main Controller for Home Workout Pixel-Accurate Clone
const HomeWorkoutApp = {
  currentTab: 'training',
  currentScreen: 'dashboard', // 'dashboard' | 'directory'
  activeChallengeFilter: 'All',
  activeBodyFocus: 'chest',
  activeFocusLocation: 'Home', // 'Home' | 'Gym' | 'All'
  activeFocusLevel: 'Intermediate', // 'Intermediate' | 'Beginner' | 'Advanced' | 'All'
  currentDailyRoutine: null,
  
  // Exercise Explorer State
  directoryMode: 'challenges', // 'challenges' | 'library'
  explorerLocation: 'All', // 'All' | 'Home' | 'Gym' | 'Hotel'
  explorerPattern: 'All', // 'All' | 'horizontal_push' | 'vertical_push' | ...
  explorerMuscle: 'All', // 'All' | 'Chest' | 'Warmup' | 'Abs' | 'Arms' | 'Legs' | 'Shoulders' | 'Back'
  explorerLevel: 'All', // 'All' | 'Beginner' | 'Intermediate' | 'Advanced'
  explorerSearch: '',

  // Swap Modal State
  swapTargetIndex: null,
  swapModalSearch: '',

  // Active Workout Player State
  activeWorkout: null,
  activeExerciseIndex: 0,
  timerSeconds: 30,
  timerInterval: null,
  isPaused: false,

  // History Multi-Select & Selective Delete State
  historySelectionMode: false,
  selectedLogIds: new Set(),
  cachedTimelineLogs: [],

  async init() {
    this.activeFocusLevel = HomeWorkoutStore.getUserLevel();

    // 0. Coming back from a sign-in link (Google, email confirmation, password reset)?
    //    Let Supabase read the details in the address before the navigation code tidies it.
    const initialHash = (typeof window !== 'undefined' && window.__hwInitialHash) || '';
    if (/access_token=|refresh_token=|error_description=/.test(initialHash)) {
      const client = HomeWorkoutStore.initSupabase();
      if (client) {
        try { await client.auth.getSession(); } catch (e) {}
      }
    }
    window.addEventListener('hw:password-recovery', () => this.showPasswordRecovery());

    // 1. Initialize HTML5 History API & popstate listeners for seamless native back button navigation
    this.initNavigation();

    // 2. Resilient session synchronization & background profile sync
    try {
      await HomeWorkoutStore.syncSession();
      await HomeWorkoutStore.syncFromCloud();
    } catch (e) {}

    // Workouts done on this device before signing in (or while offline) go into the account
    HomeWorkoutStore.moveLocalProgressToAccount().then(count => {
      if (count > 0) {
        this.renderTodayCard();
        if (this.currentTab === 'report') this.renderReportScreen();
      }
    }).catch(() => {});

    // Match the Body Focus filters to the training plan, if there is one
    const plan = HomeWorkoutStore.getPlan();
    if (plan) {
      this.activeFocusLevel = plan.level || this.activeFocusLevel;
      if (plan.location === 'home') this.activeFocusLocation = 'Home';
      if (plan.location === 'gym') this.activeFocusLocation = 'Gym';
    }

    this.renderHeader();
    this.renderTodayCard();
    this.renderWeeklyGoalCard();
    this.renderChallengeCarousel();
    this.renderBodyFocus();
    this.bindEvents();

    // 3. Detect if user opened the page from a password recovery link
    const isRecoveryLink = /type=recovery/.test(initialHash) || HomeWorkoutStore.pendingPasswordRecovery;
    if (isRecoveryLink) this.showPasswordRecovery();

    // A sign-in link that failed (e.g. Google cancelled, or the link expired)
    const errMatch = initialHash.match(/error_description=([^&]+)/);
    if (errMatch) {
      let message = errMatch[1];
      try { message = decodeURIComponent(message.replace(/\+/g, ' ')); } catch (e) {}
      this.openAuthModal('login');
      this.showAuthFeedback(`Sign-in didn't finish: ${message}`, 'error');
    }

    // 4. First visit: ask the 4 plan questions
    if (!isRecoveryLink && !errMatch) this.maybeShowOnboarding();
  },

  onDatabaseLoaded() {
    this.renderTodayCard();
    this.renderBodyFocus();
    this.renderExplorer();
  },

  bindEvents() {
    // Search input live query on dashboard
    const searchInput = document.getElementById('hwSearchInput');
    let searchDebounce = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        this.searchExercises(query);
        if (query.trim().length > 0) {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            if (typeof TelemetryTracker !== 'undefined' && query.trim().length >= 2) {
              TelemetryTracker.trackSearch(query.trim(), 'dashboard');
            }
          }, 600);
        }
      });
    }

    // Explorer search input
    const explorerSearch = document.getElementById('explorerSearchInput');
    let explorerDebounce = null;
    if (explorerSearch) {
      explorerSearch.addEventListener('input', (e) => {
        this.explorerSearch = e.target.value;
        this.renderExplorer();
        clearTimeout(explorerDebounce);
        explorerDebounce = setTimeout(() => {
          if (typeof TelemetryTracker !== 'undefined' && e.target.value.trim().length >= 2) {
            TelemetryTracker.trackSearch(e.target.value.trim(), 'explorer');
          }
        }, 600);
      });
    }

    // Swap modal search input
    const swapSearch = document.getElementById('swapModalSearchInput');
    let swapDebounce = null;
    if (swapSearch) {
      swapSearch.addEventListener('input', (e) => {
        this.swapModalSearch = e.target.value;
        this.renderSwapOptions();
        clearTimeout(swapDebounce);
        swapDebounce = setTimeout(() => {
          if (typeof TelemetryTracker !== 'undefined' && e.target.value.trim().length >= 2) {
            TelemetryTracker.trackSearch(e.target.value.trim(), 'swap_modal');
          }
        }, 600);
      });
    }

    // Weekly Goal Edit Pencil
    const pencilBtn = document.getElementById('editGoalPencilBtn');
    if (pencilBtn) {
      pencilBtn.addEventListener('click', () => this.openGoalModal());
    }

    // PRO Badge Button
    const proBtn = document.getElementById('headerProBtn');
    if (proBtn) {
      proBtn.addEventListener('click', () => this.openProModal());
    }

    // User Account / Sign In Badge Button
    const userBtn = document.getElementById('headerUserBtn');
    if (userBtn) {
      userBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openAuthModal();
      });
    }

    // More > Button
    const moreBtn = document.getElementById('challengeMoreBtn');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => this.openDirectory('All'));
    }

    // Directory Back Arrow
    const backBtn = document.getElementById('directoryBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closeDirectory());
    }

    // Bottom Navigation
    const navButtons = document.querySelectorAll('.hw-nav-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });
  },

  // The search bar at the top searches the exercise library
  searchExercises(query) {
    const q = (query || '').trim();
    this.explorerSearch = q;
    const expSearch = document.getElementById('explorerSearchInput');
    if (expSearch) expSearch.value = q;
    if (!q && this.currentScreen !== 'directory') return; // cleared on another screen: nothing to do
    if (this.currentScreen === 'directory') {
      this.renderExplorer();
    } else {
      this.openExerciseExplorer();
    }
  },

  renderHeader() {
    const user = HomeWorkoutStore.getUser();
    const token = HomeWorkoutStore.getToken();
    
    const streakEl = document.getElementById('streakFlameNum');
    if (streakEl) streakEl.textContent = user.streakCount || 0;

    const userNameEl = document.getElementById('headerUserName');
    if (userNameEl) {
      if (token && user.username && !user.isGuest) {
        userNameEl.textContent = user.username;
      } else if (user.isGuest && user.username) {
        userNameEl.textContent = `${user.username} (Guest)`;
      } else {
        userNameEl.textContent = 'Sign In';
      }
    }

    const proBtn = document.getElementById('headerProBtn');
    if (proBtn) {
      proBtn.style.display = 'none';
    }
  },

  renderWeeklyGoalCard() {
    const user = HomeWorkoutStore.getUser();

    // Counter: 0/5 (0 in blue)
    const countEl = document.getElementById('wgCountActive');
    const targetEl = document.getElementById('wgTargetTotal');
    if (countEl) countEl.textContent = (typeof user.weeklyCompletedCount === 'number' && !isNaN(user.weeklyCompletedCount)) ? user.weeklyCompletedCount : 0;
    if (targetEl) targetEl.textContent = `/${user.weeklyGoalTarget || 5}`;

    // This week's real dates (Monday to Sunday): filled = trained that day, ring = today
    const dateStrip = document.getElementById('wgDateStrip');
    const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const trainedDays = new Set(
      HomeWorkoutStore.getWorkoutLogs()
        .map(l => new Date(l && l.completedAt))
        .filter(d => !isNaN(d.getTime()))
        .map(dayKey)
    );
    const today = new Date();
    const weekStart = HomeWorkoutStore.getWeekStart(today);
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    if (dateStrip) {
      dateStrip.innerHTML = letters.map((letter, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const isToday = dayKey(d) === dayKey(today);
        const trained = trainedDays.has(dayKey(d));
        const isFuture = !isToday && d > today;
        const label = `${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${trained ? ', trained' : ''}${isToday ? ' (today)' : ''}`;
        return `
          <div class="date-col ${isToday ? 'active today' : ''} ${trained ? 'completed' : ''} ${isFuture ? 'future' : ''}" title="${label}" aria-label="${label}">
            <span class="date-day">${letter}</span>
            <span class="date-num">${d.getDate()}</span>
          </div>
        `;
      }).join('');
    }

    // Coach message that follows the week's progress
    const quote = document.getElementById('coachQuoteText');
    if (quote) {
      const done = user.weeklyCompletedCount || 0;
      const target = user.weeklyGoalTarget || 5;
      const trainedToday = trainedDays.has(dayKey(today));
      const left = Math.max(0, target - done);
      if (done >= target) {
        quote.textContent = `Weekly goal reached! 🎉 ${done} training days this week. Amazing consistency.`;
      } else if (trainedToday) {
        quote.textContent = `Great work today! 💪 ${left} more day${left === 1 ? '' : 's'} to hit your goal this week.`;
      } else if (done > 0) {
        quote.textContent = `${done} of ${target} days done. Let's keep the streak going today!`;
      } else {
        quote.textContent = 'Your workout awaits you! Time to make the first step!';
      }
    }

    // Coach Avatar
    const avatarBox = document.getElementById('coachAvatarBox');
    if (avatarBox) {
      avatarBox.innerHTML = HomeWorkoutVisuals.getCoachAvatarSvg();
    }
  },

  selectDay(dayNum) {
    const user = HomeWorkoutStore.getUser();
    user.currentDaySelected = dayNum;
    HomeWorkoutStore.saveUser(user);
    this.renderWeeklyGoalCard();
  },

  // ========================================================
  // GOAL-BASED PLAN: 4-QUESTION SETUP
  // ========================================================
  ob: null,

  maybeShowOnboarding() {
    const user = HomeWorkoutStore.getUser();
    if (!HomeWorkoutStore.getPlan() && !user.planSkipped) {
      this.openOnboarding();
    }
  },

  openOnboarding({ editing = false } = {}) {
    const overlay = document.getElementById('onboardingOverlay');
    if (!overlay || typeof TrainingPlan === 'undefined') return;
    const plan = HomeWorkoutStore.getPlan();
    this.ob = {
      step: 1,
      editing,
      answers: {
        goal: plan ? plan.goal : null,
        location: plan ? plan.location : null,
        level: plan ? plan.level : null,
        daysPerWeek: plan ? plan.daysPerWeek : 3,
        minutes: plan ? plan.minutes : 45
      }
    };
    overlay.classList.add('active');
    if (editing) this.pushNavState({ modal: 'onboardingOverlay' }, 'Plan setup', '#plan-setup');
    this.renderOnboarding();
    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('plan_setup', editing ? 'edit' : 'first_run');
    }
  },

  closeOnboarding(fromPop = false) {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.classList.remove('active');
    if (!fromPop && typeof window !== 'undefined' && window.history && window.history.state && window.history.state.modal === 'onboardingOverlay') {
      window.history.back();
    }
    this.ob = null;
  },

  skipOnboarding() {
    HomeWorkoutStore.skipPlanSetup();
    this.closeOnboarding();
    this.renderTodayCard();
  },

  obChoose(key, value) {
    if (!this.ob) return;
    this.ob.answers[key] = value;
    this.renderOnboarding();
    // Single-choice questions move on by themselves
    if (['goal', 'location', 'level'].includes(key)) {
      const stepAtTap = this.ob.step;
      setTimeout(() => {
        if (this.ob && this.ob.step === stepAtTap && this.ob.step < 4) {
          this.ob.step++;
          this.renderOnboarding();
        }
      }, 200);
    }
  },

  obBack() {
    if (this.ob && this.ob.step > 1 && this.ob.step <= 4) {
      this.ob.step--;
      this.renderOnboarding();
    }
  },

  obFinish() {
    if (!this.ob) return;
    const a = this.ob.answers;
    if (!a.goal || !a.location || !a.level || !a.daysPerWeek || !a.minutes) return;
    HomeWorkoutStore.savePlan(a);

    // Keep the rest of the app in line with the answers
    this.activeFocusLevel = a.level;
    if (a.location !== 'both') this.activeFocusLocation = a.location === 'home' ? 'Home' : 'Gym';

    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.logEvent('plan_created', 'onboarding', {
        goal: a.goal, location: a.location, level: a.level,
        daysPerWeek: Number(a.daysPerWeek), minutes: Number(a.minutes)
      });
    }
    this.ob.step = 5;
    this.renderOnboarding();
  },

  obDone() {
    this.closeOnboarding();
    this.renderHeader();
    this.renderWeeklyGoalCard();
    this.renderBodyFocus({ forceRefresh: true });
    if (this.currentTab !== 'training') {
      this.switchTab('training');
    } else {
      this.renderTodayCard();
      const scroller = document.querySelector('.hw-main-scroll');
      if (scroller) scroller.scrollTop = 0;
    }
  },

  renderOnboarding() {
    const overlay = document.getElementById('onboardingOverlay');
    if (!overlay || !this.ob) return;
    const P = TrainingPlan;
    const { step, answers, editing } = this.ob;

    const option = (key, opt) => `
      <button class="ob-option ${String(answers[key]) === String(opt.id) ? 'selected' : ''}" onclick="HomeWorkoutApp.obChoose('${key}', '${opt.id}')">
        <span class="ob-option-icon">${opt.icon}</span>
        <span class="ob-option-text"><strong>${opt.label}</strong><small>${opt.subtitle}</small></span>
        <span class="ob-option-check">✓</span>
      </button>`;

    const chip = (key, value, label) => `
      <button class="ob-chip ${Number(answers[key]) === value ? 'selected' : ''}" onclick="HomeWorkoutApp.obChoose('${key}', ${value})">${label}</button>`;

    let body = '';
    if (step === 1) {
      body = `
        <h2 class="ob-title">What's your main goal?</h2>
        <p class="ob-sub">Your workouts will be built around it.</p>
        <div class="ob-options">${Object.values(P.GOALS).map(g => option('goal', g)).join('')}</div>`;
    } else if (step === 2) {
      body = `
        <h2 class="ob-title">Where will you train?</h2>
        <p class="ob-sub">You'll only get exercises for the equipment you have.</p>
        <div class="ob-options">${Object.values(P.LOCATIONS).map(l => option('location', l)).join('')}</div>`;
    } else if (step === 3) {
      body = `
        <h2 class="ob-title">How experienced are you?</h2>
        <p class="ob-sub">This sets how hard your workouts are.</p>
        <div class="ob-options">${Object.values(P.LEVELS).map(l => option('level', l)).join('')}</div>`;
    } else if (step === 4) {
      body = `
        <h2 class="ob-title">How often can you train?</h2>
        <p class="ob-sub">Pick what you can really stick to. You can change it any time.</p>
        <div class="ob-field-label">Days per week</div>
        <div class="ob-chip-row">${P.DAY_OPTIONS.map(n => chip('daysPerWeek', n, n)).join('')}</div>
        <div class="ob-field-label">Time per workout</div>
        <div class="ob-chip-row">${P.MINUTE_OPTIONS.map(m => chip('minutes', m, `${m} min`)).join('')}</div>
        <div class="ob-split-hint">📅 ${P.getSplitName(answers.goal, answers.daysPerWeek)} plan · ${P.EXERCISES_PER_SESSION[answers.minutes] || 5} exercises per workout</div>
        <button class="ob-primary-btn" onclick="HomeWorkoutApp.obFinish()">Create my plan</button>`;
    } else {
      const plan = HomeWorkoutStore.getPlan();
      const goal = P.GOALS[plan.goal];
      const loc = P.LOCATIONS[plan.location];
      body = `
        <div class="ob-done-icon">🎉</div>
        <h2 class="ob-title" style="text-align: center;">Your plan is ready</h2>
        <div class="ob-summary-pills">
          <span>${goal.icon} ${goal.label}</span>
          <span>📅 ${plan.daysPerWeek} days a week</span>
          <span>${loc.icon} ${loc.label}</span>
          <span>⏱️ ${plan.minutes} min</span>
        </div>
        <div class="ob-week">
          <div class="ob-week-title">Your week · ${P.getSplitName(plan.goal, plan.daysPerWeek)}</div>
          ${P.getWeekOverview(plan).map(d => `
            <div class="ob-week-row">
              <span class="ob-day-num">Day ${d.dayNumber}</span>
              <div><strong>${d.name}</strong><small>${d.focus}</small></div>
            </div>`).join('')}
        </div>
        <p class="ob-tip">💡 ${goal.tip}</p>
        <button class="ob-primary-btn" onclick="HomeWorkoutApp.obDone()">Start training</button>`;
    }

    const showHeader = step <= 4;
    overlay.innerHTML = `
      <div class="ob-screen">
        ${showHeader ? `
          <div class="ob-header">
            <button class="ob-back-btn" onclick="HomeWorkoutApp.obBack()" style="visibility: ${step > 1 ? 'visible' : 'hidden'};" aria-label="Back">‹</button>
            <div class="ob-progress" aria-label="Step ${step} of 4"><div class="ob-progress-fill" style="width: ${step * 25}%;"></div></div>
            ${editing
              ? `<button class="ob-skip-btn" onclick="HomeWorkoutApp.closeOnboarding()">Cancel</button>`
              : `<button class="ob-skip-btn" onclick="HomeWorkoutApp.skipOnboarding()">Skip</button>`}
          </div>
          <div class="ob-step-count">Step ${step} of 4</div>` : ''}
        <div class="ob-body">${body}</div>
      </div>`;
  },

  // ========================================================
  // GOAL-BASED PLAN: TODAY'S WORKOUT CARD
  // ========================================================
  renderTodayCard() {
    const el = document.getElementById('todayPlanCard');
    if (!el || typeof TrainingPlan === 'undefined') return;
    const plan = HomeWorkoutStore.getPlan();

    if (!plan) {
      el.innerHTML = `
        <div class="today-card today-empty">
          <div class="today-empty-row">
            <span class="today-empty-icon">🎯</span>
            <div>
              <h3 class="today-empty-title">Get your personal plan</h3>
              <p class="today-empty-text">Answer 4 quick questions and every workout is planned for you.</p>
            </div>
          </div>
          <button class="today-start-btn" onclick="HomeWorkoutApp.openOnboarding({ editing: true })">Set up my plan</button>
        </div>`;
      return;
    }

    const session = TrainingPlan.buildSession(plan);
    const doneToday = plan.lastCompletedAt && new Date(plan.lastCompletedAt).toDateString() === new Date().toDateString();
    const thumbFallback = `this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'44\\' height=\\'44\\'><rect width=\\'44\\' height=\\'44\\' rx=\\'10\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'58%\\' text-anchor=\\'middle\\' font-size=\\'18\\'>💪</text></svg>'`;

    const locToggle = plan.location === 'both' ? `
      <div class="today-loc-toggle" role="group" aria-label="Where are you training today?">
        ${['gym', 'home'].map(l => `
          <button class="${session.location === l ? 'active' : ''}" onclick="HomeWorkoutApp.setTodayLocation('${l}')">
            ${TrainingPlan.LOCATIONS[l].icon} ${TrainingPlan.LOCATIONS[l].label}
          </button>`).join('')}
      </div>` : '';

    const list = session.loading
      ? `<div class="today-loading">Loading your exercises…</div>`
      : `<ol class="today-list">
          ${session.exercises.map(ex => `
            <li class="today-ex">
              <img class="today-ex-thumb" src="${ex.thumbnailUrl}" alt="" loading="lazy" onerror="${thumbFallback}">
              <div class="today-ex-info">
                <strong>${ex.name}</strong>
                <span>${ex.planSets} × ${ex.planReps}${ex.planRest ? ` · rest ${ex.planRest}s` : ''}</span>
              </div>
            </li>`).join('')}
        </ol>`;

    el.innerHTML = `
      <div class="today-card">
        ${doneToday ? `<div class="today-done-banner">✓ Today's workout is done. Great work!</div>` : ''}
        <div class="today-top-row">
          <span class="today-kicker">${doneToday ? 'Next up' : 'Today'} · Week ${session.week} · Day ${session.dayNumber} of ${session.totalDays}</span>
          <button class="today-edit-btn" onclick="HomeWorkoutApp.openOnboarding({ editing: true })">Edit plan</button>
        </div>
        <h2 class="today-title">${session.name}</h2>
        <p class="today-sub">${session.focus} · ~${session.estMinutes} min · ${session.exercises.length} exercises</p>
        <span class="today-goal-pill">${session.goalIcon} ${session.goalLabel}</span>
        ${locToggle}
        ${list}
        <button class="today-start-btn ${doneToday ? 'secondary' : ''}" ${session.loading ? 'disabled' : ''} onclick="HomeWorkoutApp.startTodayWorkout()">
          ▶ ${doneToday ? 'Start next workout' : 'Start workout'}
        </button>
        ${(!HomeWorkoutStore.isSignedIn() && HomeWorkoutStore.getWorkoutLogs().length > 0) ? `
          <button class="today-save-row" onclick="HomeWorkoutApp.openSavePrompt()">
            <span>⚠️ Saved on this phone only</span>
            <strong>Save my progress ›</strong>
          </button>` : ''}
      </div>`;
  },

  setTodayLocation(location) {
    HomeWorkoutStore.setPlanTodayLocation(location);
    this.renderTodayCard();
  },

  startTodayWorkout() {
    const plan = HomeWorkoutStore.getPlan();
    if (!plan) return;
    const session = TrainingPlan.buildSession(plan);
    if (!session || session.loading || session.exercises.length === 0) {
      alert('Your exercises are still loading. Please try again in a moment.');
      return;
    }

    this.activeWorkout = {
      id: `plan-w${session.week}-d${session.dayNumber}`,
      title: `Week ${session.week} · Day ${session.dayNumber}: ${session.name}`,
      isPlanWorkout: true,
      planSessionIndex: session.sessionIndex,
      dayNumber: session.dayNumber,
      currentDay: session.dayNumber,
      focus: session.focus,
      tip: session.tip,
      exercises: session.exercises
    };
    this.activeExerciseIndex = 0;
    this.isPaused = false;
    this.workoutStartedAt = Date.now();

    const modal = document.getElementById('workoutRunnerModal');
    if (!modal) return;
    modal.classList.add('active');
    this.pushNavState({ modal: 'workoutRunnerModal' }, 'Workout Runner', '#runner');
    this.loadCurrentExercise();

    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackWorkoutStart(this.activeWorkout.id, this.activeWorkout.title, session.focus, session.exercises.length);
    }
  },

  renderChallengeCarousel() {
    const carousel = document.getElementById('challengeCarousel');
    if (!carousel) return;

    const challenges = HomeWorkoutStore.getChallenges('All');

    carousel.innerHTML = challenges.map(ch => {
      let athleteSvg = '';
      if (ch.athleteVisual === 'athlete_shred') athleteSvg = HomeWorkoutVisuals.getAthleteShredSvg();
      else if (ch.athleteVisual === 'athlete_kegel') athleteSvg = HomeWorkoutVisuals.getAthleteKegelSvg();
      else if (ch.athleteVisual === 'athlete_dumbbell') athleteSvg = HomeWorkoutVisuals.getAthleteDumbbellSvg();
      else if (ch.athleteVisual === 'athlete_fullbody') athleteSvg = HomeWorkoutVisuals.getAthleteFullBodySvg();

      // Card 1 has 2x2 metric matrix
      let contentBlock = '';
      if (ch.metrics) {
        contentBlock = `
          <div class="metric-matrix-grid">
            <div class="metric-cell">
              <div class="metric-icon-box">📅</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.dailyTime}</span>
                <span class="metric-sub-lbl">Daily Time</span>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-icon-box">📊</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.level}</span>
                <span class="metric-sub-lbl">Level</span>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-icon-box">🎯</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.targetArea}</span>
                <span class="metric-sub-lbl">Target area</span>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-icon-box">☑️</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.equipment}</span>
                <span class="metric-sub-lbl">Equipment</span>
              </div>
            </div>
          </div>
        `;
      } else {
        contentBlock = `
          <p class="card-description-text">${ch.description}</p>
        `;
      }

      return `
        <div class="challenge-card" style="background: ${ch.bgGradient};">
          ${ch.badgeText ? `<span class="peach-customized-pill">${ch.badgeText}</span>` : ''}
          ${ch.subtitle ? `<span class="card-top-subtitle">${ch.subtitle}</span>` : ''}

          <div class="card-title-row">
            <h3 class="card-big-title">${ch.title}</h3>
            <span class="card-title-chevron">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </div>

          ${contentBlock}

          <div class="card-athlete-visual">
            ${athleteSvg}
          </div>

          <button class="start-day-pill-btn" onclick="HomeWorkoutApp.startWorkoutSession('${ch.id}', ${HomeWorkoutStore.getChallengeDay(ch)})">
            START DAY ${HomeWorkoutStore.getChallengeDay(ch)}
            <span class="start-arrow-circle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </button>
        </div>
      `;
    }).join('');
  },

  renderBodyFocus(options = {}) {
    const { forceRefresh = false, shuffle = false } = options;
    const segRow = document.getElementById('bodyFocusLocationSegment');
    const lvlRow = document.getElementById('bodyFocusLevelRow');
    const chipsRow = document.getElementById('categoryChipsRow');
    const workoutsList = document.getElementById('focusWorkoutsList');
    if (!workoutsList) return;

    // Update location segment active state
    if (segRow) {
      segRow.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-loc') === this.activeFocusLocation);
      });
    }

    // Update level pills active state
    if (lvlRow) {
      lvlRow.querySelectorAll('.exp-level-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lvl') === (this.activeFocusLevel || 'Intermediate'));
      });
    }

    // Update muscle category chips
    if (chipsRow) {
      chipsRow.innerHTML = HomeWorkoutStore.initialState.bodyFocusCategories.map(cat => `
        <button class="focus-chip-btn ${this.activeBodyFocus === cat.id ? 'active' : ''}" onclick="HomeWorkoutApp.switchBodyFocus('${cat.id}')">
          ${cat.name}
        </button>
      `).join('');
    }

    // Preserve existing routine unless filters changed, forceRefresh was requested, or shuffle was clicked
    const routineMatchesFilter = this.currentDailyRoutine &&
      this.currentDailyRoutine.muscle === this.activeBodyFocus &&
      this.currentDailyRoutine.location === this.activeFocusLocation &&
      this.currentDailyRoutine.level === this.activeFocusLevel &&
      Array.isArray(this.currentDailyRoutine.exercises) &&
      this.currentDailyRoutine.exercises.length > 0;

    if (!routineMatchesFilter || forceRefresh || shuffle) {
      this.currentDailyRoutine = HomeWorkoutStore.getRecommendedDailyRoutine({
        muscle: this.activeBodyFocus,
        location: this.activeFocusLocation,
        level: this.activeFocusLevel,
        forceShuffle: shuffle,
        count: 5
      });
    }

    const routineData = this.currentDailyRoutine || {};
    const exercises = routineData.exercises || [];
    
    if (!exercises || exercises.length === 0) {
      workoutsList.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; color: var(--text-muted); background: #FFFFFF; border-radius: 16px;">
          <p style="font-weight: 700; margin-bottom: 6px;">No exercises found for this filter</p>
          <button class="fw-start-btn" style="background: var(--brand-blue); color: #FFF;" onclick="HomeWorkoutApp.switchFocusLocation('All'); HomeWorkoutApp.switchFocusLevel('All');">Show All Exercises</button>
        </div>
      `;
      return;
    }

    const muscleName = this.activeBodyFocus.toUpperCase();
    const isRotated = routineData.isRotated;

    // Sleek, minimal routine card
    const bannerHtml = `
      <div class="routine-card">
        <div class="routine-card-header">
          <div class="routine-card-info">
            <span class="routine-pill-badge ${isRotated ? 'fresh' : ''}">
              ${isRotated ? '✨ Fresh Routine (Unrepeated)' : '🎯 Today\'s Routine'}
            </span>
            <h3 class="routine-card-title">${muscleName} (${exercises.length} Exercises)</h3>
          </div>
          <button class="routine-shuffle-btn" onclick="HomeWorkoutApp.shuffleRoutine()" title="Shuffle 5 different exercises">
            🔀 Shuffle
          </button>
        </div>
        <button class="routine-card-start-btn" onclick="HomeWorkoutApp.startFullDailyRoutine()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>START DAY 1 (${exercises.length} EXERCISES)</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    `;

    // Roomy, beautiful exercise items with numbered badge, wide title, and clean actions
    const cardsHtml = exercises.map((ex, idx) => `
      <div class="focus-workout-card" onclick="HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
        <div class="fw-left-wrap">
          <div class="fw-thumb-box">
            <img class="fw-thumb-img" src="${ex.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'56\\' height=\\'56\\' viewBox=\\'0 0 56 56\\'><rect width=\\'56\\' height=\\'56\\' rx=\\'12\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'22\\'>💪</text></svg>'">
            <span class="fw-num-badge">${idx + 1}</span>
          </div>
          <div class="fw-info-wrap">
            <h4 class="fw-title">${ex.name}</h4>
            <div class="fw-details-row">
              <span class="fw-reps-tag">${ex.reps || '12-15 reps'}</span>
              <span class="fw-meta-dot">•</span>
              <span class="fw-detail-target">🎯 ${ex.target || ex.muscle}</span>
            </div>
          </div>
        </div>
        <div class="fw-card-actions">
          <button class="fw-swap-btn" onclick="event.stopPropagation(); HomeWorkoutApp.openSwapModal(${idx})" title="Swap this exercise">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Swap</span>
          </button>
          <button class="fw-circle-play-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')" title="Play exercise">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    workoutsList.innerHTML = bannerHtml + cardsHtml;
  },

  switchFocusLocation(loc) {
    this.activeFocusLocation = loc;
    this.renderBodyFocus({ forceRefresh: true });
  },

  switchFocusLevel(lvl) {
    this.activeFocusLevel = lvl;
    this.renderBodyFocus({ forceRefresh: true });
  },

  switchBodyFocus(catId) {
    this.activeBodyFocus = catId;
    this.renderBodyFocus({ forceRefresh: true });
  },

  shuffleRoutine() {
    this.renderBodyFocus({ shuffle: true });
  },

  // ========================================================
  // SINGLE EXERCISE SWAP & REPLACEMENT SYSTEM
  // ========================================================
  openSwapModal(index) {
    if (!this.currentDailyRoutine || !this.currentDailyRoutine.exercises || !this.currentDailyRoutine.exercises[index]) {
      return;
    }
    this.swapTargetIndex = index;
    this.swapModalSearch = '';

    const currentEx = this.currentDailyRoutine.exercises[index];
    const modal = document.getElementById('swapExerciseModalBackdrop');
    const titleEl = document.getElementById('swapModalTitle');
    const thumbEl = document.getElementById('swapCurrentThumb');
    const nameEl = document.getElementById('swapCurrentName');
    const searchInput = document.getElementById('swapModalSearchInput');

    if (titleEl) titleEl.textContent = `Replace Exercise #${index + 1}`;
    if (nameEl) nameEl.textContent = currentEx.name;
    if (thumbEl) {
      thumbEl.src = currentEx.thumbnailUrl || '';
      thumbEl.alt = currentEx.name;
      thumbEl.onerror = () => {
        thumbEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="10" fill="%23F3F4F6"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="18">💪</text></svg>';
      };
    }
    if (searchInput) searchInput.value = '';

    this.openModal('swapExerciseModalBackdrop', 'swap');
    if (typeof TelemetryTracker !== 'undefined' && currentEx) {
      TelemetryTracker.trackScreen('swap_exercise_modal', currentEx.name);
    }
    this.renderSwapOptions();
  },

  closeSwapModal(fromPop = false) {
    this.swapTargetIndex = null;
    this.closeModal('swapExerciseModalBackdrop', fromPop);
  },

  getAvailableSwapCandidates() {
    if (typeof ExerciseDataset === 'undefined' || !ExerciseDataset.queryExercises) {
      return [];
    }

    const currentRoutineIds = (this.currentDailyRoutine && this.currentDailyRoutine.exercises)
      ? this.currentDailyRoutine.exercises.map(e => String(e.id))
      : [];

    // Query exercises matching current muscle and location
    let candidates = ExerciseDataset.queryExercises({
      muscle: this.activeBodyFocus,
      location: this.activeFocusLocation,
      level: this.activeFocusLevel !== 'All' ? this.activeFocusLevel : 'All',
      search: this.swapModalSearch,
      limit: 150
    });

    // If query has few results and level was specified, broaden level
    if (candidates.length < 8 && this.activeFocusLevel !== 'All' && !this.swapModalSearch) {
      candidates = ExerciseDataset.queryExercises({
        muscle: this.activeBodyFocus,
        location: this.activeFocusLocation,
        search: this.swapModalSearch,
        limit: 150
      });
    }

    // Exclude exercises already present in current routine
    return candidates.filter(ex => !currentRoutineIds.includes(String(ex.id)));
  },

  renderSwapOptions() {
    const listContainer = document.getElementById('swapOptionsList');
    if (!listContainer) return;

    const currentEx = (this.currentDailyRoutine && this.currentDailyRoutine.exercises)
      ? this.currentDailyRoutine.exercises[this.swapTargetIndex]
      : null;

    let swapResult = null;
    let patObj = null;
    if (currentEx && typeof ExerciseDataset !== 'undefined') {
      const patternId = currentEx.movement_pattern || ExerciseDataset.inferPattern(currentEx);
      patObj = ExerciseDataset.getPattern(patternId);
      if (ExerciseDataset.resolveSwap) {
        swapResult = ExerciseDataset.resolveSwap({
          currentExercise: currentEx,
          targetLocation: this.activeFocusLocation,
          preserveVolume: true
        });
      }
    }

    const candidates = this.getAvailableSwapCandidates();

    if (candidates.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 0.82rem;">
          <p style="font-weight: 700; margin-bottom: 4px;">No alternative exercises found</p>
          <p style="font-size: 0.74rem;">Try searching for a different keyword or broaden filters.</p>
        </div>
      `;
      return;
    }

    const bannerHtml = swapResult ? `
      <div style="background: rgba(0, 82, 255, 0.08); border: 1px solid rgba(0, 82, 255, 0.2); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
        <div style="font-size: 0.72rem; font-weight: 800; color: var(--brand-blue); text-transform: uppercase;">
          ${patObj ? patObj.icon : '⚡'} Movement Pattern: ${patObj ? patObj.name : 'Target Pattern'}
        </div>
        <div style="font-size: 0.74rem; color: #4B5563; margin-top: 2px;">
          💡 ${swapResult.volumeRecommendation}
        </div>
      </div>
    ` : '';

    listContainer.innerHTML = bannerHtml + candidates.map(cand => {
      const patternId = cand.movement_pattern || (typeof ExerciseDataset !== 'undefined' ? ExerciseDataset.inferPattern(cand) : null);
      const candPat = (patternId && typeof ExerciseDataset !== 'undefined' && ExerciseDataset.getPattern) ? ExerciseDataset.getPattern(patternId) : null;
      const patBadge = candPat ? `<span style="background: rgba(0, 82, 255, 0.08); color: var(--brand-blue); font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">${candPat.icon} ${candPat.name}</span>` : '';
      const proBadge = ''; // Hidden while all exercises are free

      return `
        <div class="swap-option-card" onclick="HomeWorkoutApp.selectReplacementExercise('${cand.id}')">
          <div class="swap-option-left">
            <img class="swap-option-thumb" src="${cand.thumbnailUrl}" alt="${cand.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'44\\' height=\\'44\\' viewBox=\\'0 0 44 44\\'><rect width=\\'44\\' height=\\'44\\' rx=\\'10\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>💪</text></svg>'">
            <div class="swap-option-info">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <div class="swap-option-title">${cand.name}</div>
                ${proBadge}
              </div>
              <div class="swap-option-meta" style="margin-top: 3px;">
                ${patBadge}
                <span>🎯 ${cand.target || cand.muscle}</span>
                ${cand.equipment ? ` • <span>${cand.equipment}</span>` : ''}
              </div>
            </div>
          </div>
          <button class="swap-select-btn" onclick="event.stopPropagation(); HomeWorkoutApp.selectReplacementExercise('${cand.id}')">
            <span>Choose</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  },

  findExerciseObject(id) {
    if (typeof ExerciseDataset !== 'undefined') {
      if (ExerciseDataset.allExercises && ExerciseDataset.allExercises.length > 0) {
        const found = ExerciseDataset.allExercises.find(x => String(x.id) === String(id));
        if (found) return found;
      }
      if (ExerciseDataset.bodyFocus) {
        for (const list of Object.values(ExerciseDataset.bodyFocus)) {
          const found = list.find(x => String(x.id) === String(id));
          if (found) return found;
        }
      }
      if (ExerciseDataset.challenges) {
        for (const list of Object.values(ExerciseDataset.challenges)) {
          const found = list.find(x => String(x.id) === String(id));
          if (found) return found;
        }
      }
    }
    return null;
  },

  selectReplacementExercise(exerciseId) {
    if (this.swapTargetIndex === null || !this.currentDailyRoutine || !this.currentDailyRoutine.exercises) {
      return;
    }

    const replacement = this.findExerciseObject(exerciseId);
    if (!replacement) {
      alert('Could not load exercise details.');
      return;
    }

    const oldEx = this.currentDailyRoutine.exercises[this.swapTargetIndex];

    // Replace in current daily routine
    this.currentDailyRoutine.exercises[this.swapTargetIndex] = replacement;
    this.closeSwapModal();
    this.renderBodyFocus();

    if (typeof TelemetryTracker !== 'undefined' && oldEx) {
      TelemetryTracker.trackExerciseSwap(
        oldEx.id,
        oldEx.name,
        replacement.id,
        replacement.name,
        this.activeBodyFocus
      );
    }
  },

  quickRandomSwapCurrent() {
    if (this.swapTargetIndex === null || !this.currentDailyRoutine || !this.currentDailyRoutine.exercises) {
      return;
    }

    const candidates = this.getAvailableSwapCandidates();
    if (candidates.length === 0) {
      alert('No alternate exercises available to swap.');
      return;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const chosen = candidates[randomIndex];
    this.selectReplacementExercise(chosen.id);
  },

  startFullDailyRoutine() {
    if (!this.currentDailyRoutine || !this.currentDailyRoutine.exercises || this.currentDailyRoutine.exercises.length === 0) {
      alert('No exercises available in routine.');
      return;
    }

    const muscleName = this.activeBodyFocus.toUpperCase();
    this.activeWorkout = {
      id: `daily-${this.activeBodyFocus}`,
      muscle: this.activeBodyFocus,
      title: `${muscleName} DAILY ROUTINE (${this.activeFocusLevel.toUpperCase()})`,
      currentDay: 1,
      isDailyMuscleRoutine: true,
      exercises: this.currentDailyRoutine.exercises
    };
    this.activeExerciseIndex = 0;
    this.isPaused = false;

    const modal = document.getElementById('workoutRunnerModal');
    if (modal) modal.classList.add('active');
    this.loadCurrentExercise();

    if (typeof TelemetryTracker !== 'undefined' && this.activeWorkout) {
      TelemetryTracker.trackWorkoutStart(
        this.activeWorkout.id,
        this.activeWorkout.title,
        this.activeWorkout.muscle,
        this.activeWorkout.exercises ? this.activeWorkout.exercises.length : 5
      );
    }
  },

  // ========================================================
  // SCREEN NAVIGATION: CHALLENGE & EXERCISE LIBRARY DIRECTORY
  // ========================================================
  switchDirectoryMode(mode) {
    // The old multi-day "Challenges" list was replaced by the goal-based plan:
    // this screen is now always the exercise library.
    mode = 'library';
    this.directoryMode = mode;
    const tabCh = document.getElementById('tabChallengesBtn');
    const tabLib = document.getElementById('tabLibraryBtn');
    const chContainer = document.getElementById('challengesModeContainer');
    const libContainer = document.getElementById('libraryModeContainer');
    const titleEl = document.getElementById('directoryScreenTitle');

    if (tabCh) tabCh.classList.toggle('active', mode === 'challenges');
    if (tabLib) tabLib.classList.toggle('active', mode === 'library');

    if (mode === 'challenges') {
      if (chContainer) chContainer.style.display = 'block';
      if (libContainer) libContainer.style.display = 'none';
      if (titleEl) titleEl.textContent = 'Challenge Plans';
      this.renderDirectoryFilters();
      this.renderDirectoryCards();
    } else {
      if (chContainer) chContainer.style.display = 'none';
      if (libContainer) libContainer.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Exercises';
      // Sync search query if user typed into top dashboard search bar
      const topSearch = document.getElementById('hwSearchInput');
      const expSearch = document.getElementById('explorerSearchInput');
      if (topSearch && topSearch.value.trim().length > 0 && expSearch && (!expSearch.value || expSearch.value !== topSearch.value)) {
        expSearch.value = topSearch.value.trim();
        this.explorerSearch = expSearch.value;
      }
      this.renderExplorer();
    }
  },

  openDirectory(category = 'All', searchQuery = '') {
    // Old entry point to the removed Challenges list: send people to the exercise library
    if (searchQuery) {
      this.searchExercises(searchQuery);
    } else {
      this.openExerciseExplorer();
    }
  },

  openExerciseExplorer(muscle = 'All', location = 'All') {
    this.currentScreen = 'directory';
    this.currentTab = 'discover';
    if (muscle) this.explorerMuscle = muscle;
    if (location) this.explorerLocation = location;

    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('exercise_library', muscle || 'All');
    }

    // Update bottom nav active state
    document.querySelectorAll('.hw-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === 'discover');
    });

    ['dashboardScreen', 'directoryScreen', 'reportScreen', 'settingsScreen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const dirView = document.getElementById('directoryScreen');
    if (dirView) dirView.classList.add('active');

    this.switchDirectoryMode('library');

    const scrollContainer = document.querySelector('.hw-main-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  filterExplorerLocation(loc) {
    this.explorerLocation = loc;
    this.renderExplorer();
  },

  filterExplorerLevel(lvl) {
    this.explorerLevel = (this.explorerLevel === lvl && lvl !== 'All') ? 'All' : lvl;
    this.renderExplorer();
  },

  filterExplorerPattern(pattern) {
    this.explorerPattern = (this.explorerPattern === pattern && pattern !== 'All') ? 'All' : pattern;
    this.renderExplorer();
  },

  filterExplorerMuscle(muscle) {
    this.explorerMuscle = (this.explorerMuscle === muscle && muscle !== 'All') ? 'All' : muscle;
    this.renderExplorer();
  },

  resetExplorerFilters() {
    this.explorerLocation = 'All';
    this.explorerLevel = 'All';
    this.explorerPattern = 'All';
    this.explorerMuscle = 'All';
    this.explorerSearch = '';
    const expSearch = document.getElementById('explorerSearchInput');
    if (expSearch) expSearch.value = '';
    const topSearch = document.getElementById('hwSearchInput');
    if (topSearch) topSearch.value = '';
    this.renderExplorer();
  },

  renderExplorer() {
    // 1. Update location buttons
    const locRow = document.getElementById('explorerLocationRow');
    if (locRow) {
      locRow.querySelectorAll('.exp-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-loc') === this.explorerLocation);
      });
    }

    // 2. Update level buttons
    const lvlRow = document.getElementById('explorerLevelRow');
    if (lvlRow) {
      lvlRow.querySelectorAll('.exp-level-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lvl') === this.explorerLevel);
      });
    }

    // 3. Render Movement Pattern Filter Pills (Milestone 1)
    const patternRow = document.getElementById('explorerPatternPills');
    if (patternRow) {
      const existingBtns = patternRow.querySelectorAll('.exp-filter-pill');
      if (existingBtns && existingBtns.length > 0) {
        existingBtns.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-pat') === this.explorerPattern);
        });
      } else if (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.getMovementPatterns) {
        const patterns = [
          { id: 'All', name: 'All Patterns', icon: '⚡' },
          ...ExerciseDataset.getMovementPatterns().map(p => ({ id: p.id, name: p.name, icon: p.icon }))
        ];
        patternRow.innerHTML = patterns.map(p => `
          <button class="exp-filter-pill ${this.explorerPattern === p.id ? 'active' : ''}" data-pat="${p.id}" onclick="HomeWorkoutApp.filterExplorerPattern('${p.id}')">
            ${p.icon} ${p.name}
          </button>
        `).join('');
      }
    }

    // 4. Render Muscle Pills
    const pillsRow = document.getElementById('explorerMusclePills');
    if (pillsRow) {
      const existingMuscles = pillsRow.querySelectorAll('.exp-filter-pill');
      if (existingMuscles && existingMuscles.length > 0) {
        existingMuscles.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-muscle') === this.explorerMuscle);
        });
      } else {
        const muscles = [
          { id: 'All', name: 'All Muscles' },
          { id: 'Chest', name: '🏋️ Chest' },
          { id: 'Back', name: '🧗 Back' },
          { id: 'Warmup', name: '🔥 Warmup' },
          { id: 'Abs & Core', name: '🍫 Abs & Core' },
          { id: 'Arms', name: '🦾 Arms' },
          { id: 'Legs', name: '🦵 Legs' },
          { id: 'Shoulders', name: '🛡️ Shoulders' }
        ];

        pillsRow.innerHTML = muscles.map(m => `
          <button class="exp-filter-pill ${this.explorerMuscle === m.id ? 'active' : ''}" data-muscle="${m.id}" onclick="HomeWorkoutApp.filterExplorerMuscle('${m.id}')">
            ${m.name}
          </button>
        `).join('');
      }
    }

    // 5. Query exercises
    const stack = document.getElementById('explorerExercisesStack');
    const countEl = document.getElementById('explorerResultsCount');
    if (!stack) return;

    let exercises = [];
    if (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.queryExercises) {
      exercises = ExerciseDataset.queryExercises({
        pattern: this.explorerPattern,
        muscle: this.explorerMuscle,
        location: this.explorerLocation,
        level: this.explorerLevel,
        search: this.explorerSearch,
        limit: 80
      });
    }

    if (countEl) {
      const locText = this.explorerLocation === 'All' ? 'All Environments' : (this.explorerLocation === 'Home' ? 'Home' : (this.explorerLocation === 'Hotel' ? 'Hotel' : 'Gym'));
      const lvlText = this.explorerLevel === 'All' ? 'All Levels' : `${this.explorerLevel}`;
      
      const filterChips = [];
      if (this.explorerPattern !== 'All') {
        const patObj = (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.getPattern) ? ExerciseDataset.getPattern(this.explorerPattern) : null;
        filterChips.push(`<strong>${patObj ? `${patObj.icon} ${patObj.name}` : this.explorerPattern.replace(/_/g, ' ').toUpperCase()}</strong>`);
      }
      if (this.explorerMuscle !== 'All') {
        filterChips.push(`<strong>🎯 ${this.explorerMuscle}</strong>`);
      }
      filterChips.push(lvlText);
      filterChips.push(locText);

      countEl.innerHTML = `Showing <strong style="color: var(--brand-blue); font-weight: 800;">${exercises.length}</strong> exercises • ${filterChips.join(' • ')}`;
    }

    if (exercises.length === 0) {
      stack.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">No exercises match your filters</p>
          <p style="font-size: 0.82rem; margin-bottom: 14px;">Try clearing filters or switching level/environment.</p>
          <button class="exp-filter-pill active" style="margin: 0 auto; display: inline-flex;" onclick="HomeWorkoutApp.resetExplorerFilters()">
            🔄 Reset All Filters
          </button>
        </div>
      `;
      return;
    }

    stack.innerHTML = exercises.map(ex => {
      const lvl = ex.level || 'Intermediate';
      const lvlClass = lvl.toLowerCase();
      const lvlIcon = lvl === 'Beginner' ? '🟢' : (lvl === 'Advanced' ? '🔴' : '🟡');
      const patternId = ex.movement_pattern || (typeof ExerciseDataset !== 'undefined' ? ExerciseDataset.inferPattern(ex) : null);
      const patObj = (patternId && typeof ExerciseDataset !== 'undefined' && ExerciseDataset.getPattern) ? ExerciseDataset.getPattern(patternId) : null;
      const patternBadge = patObj ? `<span class="pattern-pill-tag">${patObj.icon} ${patObj.name}</span>` : '';

      return `
        <div class="focus-workout-card" onclick="HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
          <div class="fw-left-wrap">
            <img class="fw-thumb-img" src="${ex.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'56\\' height=\\'56\\' viewBox=\\'0 0 56 56\\'><rect width=\\'56\\' height=\\'56\\' rx=\\'12\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'22\\'>💪</text></svg>'">
            <div class="fw-info-wrap">
              <h4 class="fw-title">${ex.name}</h4>
              <div class="fw-badges-row">
                ${patternBadge}
                <span class="level-tag ${lvlClass}">${lvlIcon} ${lvl}</span>
              </div>
              <div class="fw-details-row">
                <span class="fw-detail-target">🎯 ${ex.target || ex.muscle}</span>
                <span class="fw-meta-dot">•</span>
                <span class="fw-detail-equip">☑️ ${ex.equipment}</span>
              </div>
            </div>
          </div>
          <button class="fw-start-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')" title="Preview Exercise">
            <span>Preview</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  },

  closeDirectory() {
    this.goToHome();
  },

  renderDirectoryFilters() {
    const filtersRow = document.getElementById('directoryFilterPills');
    if (!filtersRow) return;

    const categories = ['All', 'Build Muscle', 'Lose Weight', 'Full Body'];
    filtersRow.innerHTML = categories.map(cat => `
      <button class="filter-pill-btn ${this.activeChallengeFilter === cat ? 'active' : ''}" onclick="HomeWorkoutApp.filterDirectoryCategory('${cat}')">
        ${cat}
      </button>
    `).join('');
  },

  filterDirectoryCategory(category) {
    this.activeChallengeFilter = category;
    this.renderDirectoryFilters();
    this.renderDirectoryCards();
  },

  renderDirectoryCards(searchQuery = '') {
    const stack = document.getElementById('directoryCardsStack');
    if (!stack) return;

    const challenges = HomeWorkoutStore.getChallenges(this.activeChallengeFilter, searchQuery);

    if (challenges.length === 0) {
      stack.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 1.1rem; font-weight: 700;">No workouts found</p>
          <p style="font-size: 0.85rem;">Try a different keyword or category filter.</p>
        </div>
      `;
      return;
    }

    stack.innerHTML = challenges.map(ch => {
      let athleteSvg = '';
      if (ch.athleteVisual === 'athlete_shred') athleteSvg = HomeWorkoutVisuals.getAthleteShredSvg();
      else if (ch.athleteVisual === 'athlete_kegel') athleteSvg = HomeWorkoutVisuals.getAthleteKegelSvg();
      else if (ch.athleteVisual === 'athlete_dumbbell') athleteSvg = HomeWorkoutVisuals.getAthleteDumbbellSvg();
      else if (ch.athleteVisual === 'athlete_fullbody') athleteSvg = HomeWorkoutVisuals.getAthleteFullBodySvg();

      let contentBlock = '';
      if (ch.metrics) {
        contentBlock = `
          <div class="metric-matrix-grid">
            <div class="metric-cell">
              <div class="metric-icon-box">📅</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.dailyTime}</span>
                <span class="metric-sub-lbl">Daily Time</span>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-icon-box">📊</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.level}</span>
                <span class="metric-sub-lbl">Level</span>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-icon-box">🎯</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.targetArea}</span>
                <span class="metric-sub-lbl">Target area</span>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-icon-box">☑️</div>
              <div class="metric-text-wrap">
                <span class="metric-main-val">${ch.metrics.equipment}</span>
                <span class="metric-sub-lbl">Equipment</span>
              </div>
            </div>
          </div>
        `;
      } else {
        contentBlock = `
          <p class="card-description-text">${ch.description}</p>
        `;
      }

      return `
        <div class="challenge-card" style="background: ${ch.bgGradient}; flex: 0 0 100%; max-width: 100%;">
          ${ch.badgeText ? `<span class="peach-customized-pill">${ch.badgeText}</span>` : ''}
          ${ch.subtitle ? `<span class="card-top-subtitle">${ch.subtitle}</span>` : ''}

          <div class="card-title-row">
            <h3 class="card-big-title">${ch.title}</h3>
            <span class="card-title-chevron">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </div>

          ${contentBlock}

          <div class="card-athlete-visual">
            ${athleteSvg}
          </div>

          <button class="start-day-pill-btn" onclick="HomeWorkoutApp.startWorkoutSession('${ch.id}', ${HomeWorkoutStore.getChallengeDay(ch)})">
            START DAY ${HomeWorkoutStore.getChallengeDay(ch)}
            <span class="start-arrow-circle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </button>
        </div>
      `;
    }).join('');

    // Append individual matching exercises from dataset if query is active
    if (searchQuery && searchQuery.trim().length > 0 && typeof ExerciseDataset !== 'undefined') {
      const matchedEx = ExerciseDataset.queryExercises ? ExerciseDataset.queryExercises({ search: searchQuery, limit: 30 }) : [];

      if (matchedEx.length > 0) {
        stack.innerHTML += `
          <div style="margin-top: 24px; padding-bottom: 20px;">
            <h3 class="section-bold-title" style="font-size: 1rem; margin-bottom: 12px;">
              Individual Exercises (${matchedEx.length})
            </h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${matchedEx.map(ex => `
                <div class="focus-workout-card" onclick="HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
                  <div class="fw-left-wrap">
                    <img class="fw-thumb-img" src="${ex.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="this.style.opacity='0.5'">
                    <div class="fw-info-wrap">
                      <h4 class="fw-title">${ex.name}</h4>
                      <div class="fw-meta">
                        <span>${ex.reps}</span>
                        <span>•</span>
                        <span>🎯 ${ex.target}</span>
                        <span>•</span>
                        <span>${ex.equipment}</span>
                      </div>
                    </div>
                  </div>
                  <button class="fw-start-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')" title="Start Exercise">
                    <span>Start</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
  },

  startSingleExerciseRunner(exerciseId) {
    if (typeof ExerciseDataset === 'undefined') return;
    let found = null;
    if (ExerciseDataset.allExercises && ExerciseDataset.allExercises.length > 0) {
      found = ExerciseDataset.allExercises.find(x => x.id === exerciseId);
    }
    if (!found) {
      const all = [];
      if (ExerciseDataset.bodyFocus) Object.values(ExerciseDataset.bodyFocus).forEach(list => all.push(...list));
      if (ExerciseDataset.challenges) Object.values(ExerciseDataset.challenges).forEach(list => all.push(...list));
      found = all.find(x => x.id === exerciseId);
    }
    if (!found) return;

    const muscleGroup = found.target || found.muscle || (this.activeBodyFocus ? this.activeBodyFocus.toUpperCase() : 'FITNESS');
    this.activeWorkout = {
      id: `ex-${found.id}`,
      title: `${found.name} (${muscleGroup})`,
      muscle: muscleGroup,
      currentDay: 1,
      isSingleExercise: true,
      exercises: [found]
    };
    this.activeExerciseIndex = 0;
    this.isPaused = false;

    const modal = document.getElementById('workoutRunnerModal');
    if (modal) {
      modal.classList.add('active');
      this.pushNavState({ modal: 'workoutRunnerModal' }, 'Workout Runner', '#runner');
    }
    this.loadCurrentExercise();
  },

  // ========================================================
  // INTERACTIVE WORKOUT SESSION RUNNER (START DAY 1 & FOCUS)
  // ========================================================
  startWorkoutSession(challengeId, dayNumber = 1) {
    const challenge = HomeWorkoutStore.getChallengeById(challengeId);
    this.activeWorkout = { ...challenge, currentDay: dayNumber, title: `${challenge.title} · DAY ${dayNumber}` };
    this.activeExerciseIndex = 0;
    this.isPaused = false;

    const modal = document.getElementById('workoutRunnerModal');
    if (!modal) return;

    modal.classList.add('active');
    this.pushNavState({ modal: 'workoutRunnerModal' }, 'Workout Runner', '#runner');
    this.loadCurrentExercise();
  },

  startFocusRoutine(catId, startIndex = 0) {
    let exercises = [];
    if (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.queryExercises) {
      exercises = ExerciseDataset.queryExercises({
        muscle: catId,
        location: this.activeFocusLocation,
        limit: 12
      });
    }
    if (!exercises || exercises.length === 0) {
      exercises = HomeWorkoutStore.getBodyFocusExercises(catId);
    }
    if (!exercises || exercises.length === 0) return;

    const catName = catId.toUpperCase();
    this.activeWorkout = {
      id: `focus-${catId}`,
      title: `${catName} FOCUS WORKOUT`,
      currentDay: 1,
      exercises: exercises
    };
    this.activeExerciseIndex = Math.max(0, Math.min(startIndex, exercises.length - 1));
    this.isPaused = false;

    const modal = document.getElementById('workoutRunnerModal');
    if (modal) modal.classList.add('active');
    this.loadCurrentExercise();
  },

  loadCurrentExercise() {
    const exercise = this.activeWorkout.exercises[this.activeExerciseIndex];
    if (!exercise) {
      this.completeWorkoutSession();
      return;
    }

    const isPlan = Boolean(this.activeWorkout.isPlanWorkout && exercise.planSets);
    // Plan workouts: the clock counts up (time on this exercise) and you tap NEXT when your sets are done
    this.timerSeconds = isPlan ? 0 : (exercise.durationSeconds || 30);

    const titleEl = document.getElementById('runnerExTitle');
    const subEl = document.getElementById('runnerExSub');
    const badgeEl = document.getElementById('runnerWorkoutBadge');
    const gifImg = document.getElementById('runnerGifImg');
    const emojiFallback = document.getElementById('runnerEmojiFallback');
    const targetBadge = document.getElementById('runnerTargetBadge');
    const equipBadge = document.getElementById('runnerEquipBadge');
    const instructionsBox = document.getElementById('runnerInstructionsBox');

    if (titleEl) titleEl.textContent = exercise.name;
    if (subEl) {
      subEl.textContent = isPlan
        ? `${exercise.planSets} sets × ${exercise.planReps}${exercise.planRest ? ` • rest ${exercise.planRest}s between sets` : ''}`
        : `${exercise.reps} • ${exercise.durationSeconds}s duration`;
    }
    if (badgeEl) badgeEl.textContent = `${this.activeWorkout.title} (${this.activeExerciseIndex + 1}/${this.activeWorkout.exercises.length})`;

    if (targetBadge) targetBadge.textContent = `🎯 ${exercise.target || exercise.muscle || 'Full Body'}`;
    if (equipBadge) equipBadge.textContent = `☑️ ${exercise.equipment || 'No Equipment'}`;

    // Looping Animated GIF
    if (gifImg && exercise.gifUrl) {
      gifImg.src = exercise.gifUrl;
      gifImg.style.display = 'block';
      if (emojiFallback) emojiFallback.style.display = 'none';
    } else {
      if (gifImg) gifImg.style.display = 'none';
      if (emojiFallback) {
        emojiFallback.style.display = 'block';
        emojiFallback.textContent = '🏃‍♂️';
      }
    }

    // Instructions Steps Box
    if (instructionsBox) {
      let instContent = '';
      if (typeof exercise.instructions === 'string' && exercise.instructions.trim().length > 0) {
        instContent = `<div class="runner-instruction-step">${exercise.instructions}</div>`;
      } else if (Array.isArray(exercise.instructions) && exercise.instructions.length > 0) {
        instContent = exercise.instructions.map((step, idx) => `
          <div class="runner-instruction-step">
            <strong>Step ${idx + 1}:</strong> ${step}
          </div>
        `).join('');
      } else {
        instContent = `<div class="runner-instruction-step">Perform ${exercise.name} in steady rhythm, engaging your target muscles throughout.</div>`;
      }

      const planTip = isPlan && this.activeWorkout.tip
        ? `<div class="runner-plan-tip">💡 ${this.activeWorkout.tip}<br>Tap <strong>NEXT</strong> when all ${exercise.planSets} sets are done.</div>`
        : '';
      instructionsBox.innerHTML = `
        ${planTip}
        <div style="font-weight: 800; font-size: 0.74rem; color: var(--text-main); margin-bottom: 6px; text-transform: uppercase;">
          Movement Instructions:
        </div>
        ${instContent}
      `;
    }

    // Reset Pause button state
    this.isPaused = false;
    const pauseBtn = document.getElementById('runnerPauseBtn');
    if (pauseBtn) pauseBtn.textContent = '⏸ PAUSE';

    this.startTimer();
  },

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;

      if (this.activeWorkout && this.activeWorkout.isPlanWorkout) {
        this.timerSeconds++;
        this.updateTimerDisplay();
        return;
      }

      this.timerSeconds--;
      this.updateTimerDisplay();

      if (this.timerSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.nextExercise();
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const timerEl = document.getElementById('runnerTimerNum');
    if (!timerEl) return;
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  toggleTimerPause() {
    this.isPaused = !this.isPaused;
    const pauseBtn = document.getElementById('runnerPauseBtn');
    if (pauseBtn) {
      pauseBtn.innerHTML = this.isPaused
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>RESUME</span>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>PAUSE</span>`;
    }
  },

  prevExercise() {
    if (this.activeExerciseIndex > 0) {
      this.activeExerciseIndex--;
      this.loadCurrentExercise();
    }
  },

  nextExercise() {
    this.activeExerciseIndex++;
    if (this.activeExerciseIndex < this.activeWorkout.exercises.length) {
      this.loadCurrentExercise();
    } else {
      this.completeWorkoutSession();
    }
  },

  completeWorkoutSession() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    let result;
    const isPlan = this.activeWorkout && this.activeWorkout.isPlanWorkout;
    const isDaily = this.activeWorkout && this.activeWorkout.isDailyMuscleRoutine;
    const isSingle = this.activeWorkout && this.activeWorkout.isSingleExercise;

    if (isPlan) {
      const elapsedSeconds = (Date.now() - (this.workoutStartedAt || Date.now())) / 1000;
      result = HomeWorkoutStore.completePlanSession(this.activeWorkout, elapsedSeconds);
    } else if (isDaily) {
      const exerciseIds = this.activeWorkout.exercises.map(e => e.id);
      result = HomeWorkoutStore.logMuscleSessionCompleted(this.activeWorkout.muscle, exerciseIds, this.activeWorkout.exercises);
    } else if (isSingle && this.activeWorkout.exercises && this.activeWorkout.exercises.length > 0) {
      const ex = this.activeWorkout.exercises[0];
      result = HomeWorkoutStore.logSingleExerciseCompleted(ex, this.activeWorkout.muscle);
    } else {
      result = HomeWorkoutStore.logWorkoutCompletion(
        this.activeWorkout.id,
        this.activeWorkout.currentDay || 1,
        this.activeWorkout.title
      );
    }

    const modal = document.getElementById('workoutRunnerModal');
    if (modal) modal.classList.remove('active');

    // Refresh all UI states
    this.renderHeader();
    this.renderTodayCard();
    this.renderWeeklyGoalCard();
    this.renderChallengeCarousel();
    this.renderBodyFocus({ forceRefresh: true });

    const workoutTitle = result && result.log ? result.log.challengeTitle : (this.activeWorkout.title || 'WORKOUT');
    if (typeof TelemetryTracker !== 'undefined' && this.activeWorkout) {
      TelemetryTracker.trackWorkoutComplete(
        this.activeWorkout.id,
        workoutTitle,
        result && result.log ? result.log.durationMinutes : 18,
        result && result.log ? result.log.caloriesBurned : 145,
        this.activeWorkout.exercises ? this.activeWorkout.exercises.length : 1
      );
    }

    if (isPlan) {
      const next = result.plan ? TrainingPlan.buildSession(result.plan) : null;
      alert(`🎉 WORKOUT COMPLETE!\n\n${workoutTitle}\n• Time: ${result.log.durationMinutes} min\n• Weekly goal: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget} days\n• Streak: ${result.user.streakCount} 🔥${next ? `\n\nNext up: Week ${next.week} · Day ${next.dayNumber}: ${next.name}` : ''}`);
    } else if (isDaily) {
      const mName = this.activeWorkout.muscle.toUpperCase();
      alert(`🎉 ${mName} ROUTINE COMPLETED!\n\nAwesome work! All 5 exercises finished.\n• Logged: ${workoutTitle}\n• Weekly Goal Progress: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget}\n• Streak updated: ${result.user.streakCount} 🔥\n\n✨ Rotation Saved: Next time you do ${mName}, 5 fresh, unrepeated exercises will be recommended!`);
    } else {
      alert(`🎉 WORKOUT COMPLETED!\n\nAwesome work!\n• Logged: "${workoutTitle}"\n• Weekly Goal Progress: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget}\n• Streak updated: ${result.user.streakCount} 🔥`);
    }

    // No account yet? Offer to save their progress now that there is something worth keeping
    this.maybeShowSavePrompt();
  },

  closeWorkoutRunner(fromPop = false) {
    if (fromPop || confirm('Quit current workout session?')) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      const modal = document.getElementById('workoutRunnerModal');
      if (modal) modal.classList.remove('active');
      if (!fromPop && typeof window !== 'undefined' && window.history) {
        if (window.history.state && window.history.state.modal === 'workoutRunnerModal') {
          window.history.back();
        }
      }
    }
  },

  // ========================================================
  // CENTRAL MODAL & HISTORY MANAGEMENT SYSTEM
  // ========================================================
  openModal(modalId, hash) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.add('active');
    this.pushNavState({ modal: modalId }, '', '#' + (hash || modalId));
  },

  closeModal(modalId, fromPop = false) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
    if (!fromPop && typeof window !== 'undefined' && window.history) {
      if (window.history.state && window.history.state.modal === modalId) {
        window.history.back();
      }
    }
  },

  // ========================================================
  // FITNESS LEVEL SELECTION MODAL
  // ========================================================
  openLevelModal() {
    const currentLevel = HomeWorkoutStore.getUserLevel();
    const modal = document.getElementById('levelModalBackdrop');
    if (!modal) return;

    const list = document.getElementById('levelModalOptionsList');
    if (list) {
      list.querySelectorAll('.level-select-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-lvl') === currentLevel);
      });
    }

    this.openModal('levelModalBackdrop', 'level');
    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('fitness_level_modal', currentLevel);
    }
  },

  closeLevelModal(fromPop = false) {
    this.closeModal('levelModalBackdrop', fromPop);
  },

  setUserLevel(lvl) {
    HomeWorkoutStore.setUserLevel(lvl);
    this.activeFocusLevel = lvl;
    this.renderHeader();
    this.renderBodyFocus({ forceRefresh: true });
    this.closeLevelModal();
  },

  // ========================================================
  // EDIT WEEKLY GOAL MODAL
  // ========================================================
  openGoalModal() {
    const user = HomeWorkoutStore.getUser();
    const modal = document.getElementById('goalModalBackdrop');
    if (!modal) return;

    const grid = document.getElementById('goalOptionsGrid');
    if (grid) {
      grid.innerHTML = [3, 4, 5, 6, 7].map(num => `
        <button class="goal-day-btn ${user.weeklyGoalTarget === num ? 'active' : ''}" onclick="HomeWorkoutApp.selectGoalTarget(${num})">
          ${num}
        </button>
      `).join('');
    }

    this.openModal('goalModalBackdrop', 'goal');
    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('weekly_goal_modal', `${user.weeklyGoalTarget || 5}_days`);
    }
  },

  selectGoalTarget(target) {
    HomeWorkoutStore.updateWeeklyGoal(target);
    this.renderWeeklyGoalCard();
    this.closeGoalModal();
  },

  closeGoalModal(fromPop = false) {
    this.closeModal('goalModalBackdrop', fromPop);
  },

  // ========================================================
  // PRO MEMBERSHIP MODAL
  // ========================================================
  openProModal() {
    this.openModal('proModalBackdrop', 'pro');
    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('pro_membership_modal');
    }
  },

  closeProModal(fromPop = false) {
    this.closeModal('proModalBackdrop', fromPop);
  },

  activatePro() {
    const user = HomeWorkoutStore.togglePro();
    this.renderHeader();
    this.closeProModal();
    alert(user.isPro ? '👑 PRO ACCESS ACTIVATED! All premium workouts and features are now unlocked.' : 'PRO deactivated.');
  },

  // ========================================================
  // SET NEW PASSWORD MODAL (FROM RESET EMAIL LINK)
  // ========================================================
  openNewPasswordModal() {
    this.openModal('newPasswordModalBackdrop', 'recovery');
  },

  closeNewPasswordModal(fromPop = false) {
    this.closeModal('newPasswordModalBackdrop', fromPop);
  },

  async submitNewPassword() {
    const p1 = document.getElementById('newPasswordInput')?.value?.trim();
    const p2 = document.getElementById('newPasswordConfirmInput')?.value?.trim();
    const feedback = document.getElementById('newPassFeedback');

    const showMsg = (msg, isErr = true) => {
      if (!feedback) return;
      feedback.style.display = 'block';
      feedback.style.background = isErr ? '#FEE2E2' : '#ECFDF5';
      feedback.style.color = isErr ? '#B91C1C' : '#047857';
      feedback.textContent = (isErr ? '⚠️ ' : '✅ ') + msg;
    };

    if (!p1 || p1.length < 8) {
      showMsg('Password must be at least 8 characters long.');
      return;
    }
    if (p1 !== p2) {
      showMsg('Passwords do not match. Please re-enter.');
      return;
    }

    const btn = document.getElementById('newPassSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Updating Password...'; }

    try {
      await HomeWorkoutStore.updateNewPassword(p1);
      showMsg('Password updated successfully! Welcome to your account.', false);
      setTimeout(() => {
        this.closeNewPasswordModal();
        this.renderHeader();
        this.renderWeeklyGoalCard();
        this.renderBodyFocus();
        this.renderSettingsScreen();
        if (btn) { btn.disabled = false; btn.textContent = 'Update Password & Sign In'; }
      }, 1200);
    } catch (err) {
      showMsg(err.message || 'Failed to update password.');
      if (btn) { btn.disabled = false; btn.textContent = 'Update Password & Sign In'; }
    }
  },

  // Opens "Set new password" once, when the user arrives from a password reset email.
  // (Only for type=recovery links: Google sign-in and email confirmation links also carry
  // tokens in the address and must NOT open this.)
  showPasswordRecovery() {
    if (this._recoveryShown) return;
    this._recoveryShown = true;
    setTimeout(() => this.openNewPasswordModal(), 350);
  },

  // ========================================================
  // HTML5 HISTORY & POPSTATE NAVIGATION (MOBILE BACK BUTTON)
  // ========================================================
  initNavigation() {
    if (typeof window === 'undefined' || !window.history) return;

    // Set initial baseline state on launch
    const initialHash = (window.location.hash || '').replace(/^#/, '');
    const validTabs = ['training', 'discover', 'report', 'settings'];
    const activeTab = validTabs.includes(initialHash) ? initialHash : 'training';

    try {
      window.history.replaceState({ tab: activeTab, screen: activeTab }, '', '#' + activeTab);
    } catch (e) {}

    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });
  },

  pushNavState(state, title, hash) {
    if (typeof window === 'undefined' || !window.history) return;
    try {
      window.history.pushState(state, title || '', hash || ('#' + (state.tab || state.modal || 'training')));
    } catch (e) {}
  },

  handlePopState(event) {
    // 1. Check if workout runner modal is active
    const runnerModal = document.getElementById('workoutRunnerModal');
    if (runnerModal && runnerModal.classList.contains('active')) {
      if (confirm('Quit current workout session?')) {
        this.closeWorkoutRunner(true);
      } else {
        // Re-push state so user remains inside runner
        this.pushNavState({ modal: 'workoutRunnerModal' }, 'Workout Runner', '#runner');
      }
      return;
    }

    // 1b. Plan setup opened from the app (first-visit setup has no history entry to go back to)
    const onboarding = document.getElementById('onboardingOverlay');
    if (onboarding && onboarding.classList.contains('active')) {
      if (this.ob && this.ob.editing) this.closeOnboarding(true);
      return;
    }

    // 2. Check if any overlay modal is open (close modal, stay on screen)
    const modalBackdrops = [
      'accountSecurityModalBackdrop',
      'authModalBackdrop',
      'newPasswordModalBackdrop',
      'levelModalBackdrop',
      'goalModalBackdrop',
      'proModalBackdrop',
      'swapExerciseModalBackdrop',
      'saveProgressBackdrop'
    ];
    for (const id of modalBackdrops) {
      const modal = document.getElementById(id);
      if (modal && modal.classList.contains('active')) {
        this.closeModal(id, true);
        return;
      }
    }

    // 3. Tab switching from browser history
    if (event.state && event.state.tab) {
      this.switchTab(event.state.tab, false);
    } else {
      if (this.currentTab !== 'training') {
        this.switchTab('training', false);
      }
    }
  },

  navigateBack() {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      window.history.back();
    } else {
      this.goToHome();
    }
  },

  goToHome() {
    this.switchTab('training', true);
  },

  switchTab(tabId, pushHistory = true) {
    this.currentTab = tabId;

    if (pushHistory) {
      this.pushNavState({ tab: tabId, screen: tabId }, tabId, '#' + tabId);
    }

    // Update bottom navigation active button
    document.querySelectorAll('.hw-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Hide all 4 top-level screen sections
    const screens = ['dashboardScreen', 'directoryScreen', 'reportScreen', 'settingsScreen'];
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    // Activate the selected screen
    if (tabId === 'training') {
      const dash = document.getElementById('dashboardScreen');
      if (dash) dash.classList.add('active');
      this.currentScreen = 'dashboard';
      this.renderHeader();
      this.renderTodayCard();
      this.renderWeeklyGoalCard();
      this.renderChallengeCarousel();
      this.renderBodyFocus();
    } else if (tabId === 'discover') {
      const dir = document.getElementById('directoryScreen');
      if (dir) dir.classList.add('active');
      this.currentScreen = 'directory';
      this.openExerciseExplorer();
    } else if (tabId === 'report') {
      const rep = document.getElementById('reportScreen');
      if (rep) rep.classList.add('active');
      this.currentScreen = 'report';
      this.renderReportScreen();
    } else if (tabId === 'settings') {
      const set = document.getElementById('settingsScreen');
      if (set) set.classList.add('active');
      this.currentScreen = 'settings';
      this.renderSettingsScreen();
    }

    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen(this.currentScreen, tabId);
    }

    const scrollContainer = document.querySelector('.hw-main-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  async renderReportScreen() {
    const user = HomeWorkoutStore.getUser();
    const container = document.getElementById('reportScreenContent');
    if (!container) return;

    const timeline = await HomeWorkoutStore.getTimelineHistory();
    const allLogs = timeline.all_logs || [];
    this.cachedTimelineLogs = allLogs;

    // Prune selectedLogIds that no longer exist
    const validIds = new Set(allLogs.map(l => String(l.id)));
    for (const sid of Array.from(this.selectedLogIds)) {
      if (!validIds.has(sid)) this.selectedLogIds.delete(sid);
    }

    const self = this;
    const isSelectionMode = this.historySelectionMode;

    function renderLogCards(logsList) {
      if (!logsList || logsList.length === 0) return '';
      return logsList.map(l => {
        const timeStr = l.completedAt ? new Date(l.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const dateStr = l.completedAt ? new Date(l.completedAt).toLocaleDateString() : '';
        const exCount = l.exercises ? l.exercises.length : 0;
        const isSelected = self.selectedLogIds.has(String(l.id));

        return `
          <div class="timeline-card ${isSelected ? 'selected' : ''}" style="${isSelectionMode ? 'cursor: pointer;' : ''}" onclick="${isSelectionMode ? `HomeWorkoutApp.toggleLogSelect('${l.id}')` : ''}">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              ${isSelectionMode ? `
                <div style="padding-top: 2px;">
                  <input type="checkbox" class="log-select-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); HomeWorkoutApp.toggleLogSelect('${l.id}')" style="width: 19px; height: 19px; accent-color: var(--brand-blue); cursor: pointer;">
                </div>
              ` : ''}
              <div style="flex: 1; min-width: 0;">
                <div class="timeline-card-header">
                  <div>
                    <h4 style="font-weight: 800; font-size: 0.95rem; margin: 0; color: var(--text-main);">${l.challengeTitle || l.workout_title}</h4>
                    <div class="timeline-card-meta">
                      ${dateStr} ${timeStr ? '• ' + timeStr : ''} • ${l.durationMinutes || 18} Min • ${l.caloriesBurned || 140} kcal
                    </div>
                  </div>
                  <span style="font-size: 0.85rem; font-weight: 800; color: #10B981;">✓ Done</span>
                </div>
                ${exCount > 0 ? `
                  <button class="timeline-accordion-btn" onclick="event.stopPropagation(); HomeWorkoutApp.toggleTimelineAccordion('${l.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <span>View ${exCount} Exercises</span>
                  </button>
                  <div class="timeline-exercises-list" id="tl-ex-${l.id}">
                    ${l.exercises.map(ex => `
                      <div class="timeline-ex-item">
                        <span class="timeline-ex-item-dot"></span>
                        <span>${ex.name}</span>
                        ${ex.target ? `<span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">(🎯 ${ex.target})</span>` : ''}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    const hasAny = allLogs.length > 0;
    const allSelected = hasAny && (this.selectedLogIds.size === allLogs.length);
    const selectedCount = this.selectedLogIds.size;

    let historySectionsHtml = '';
    if (hasAny) {
      if (timeline.today && timeline.today.length > 0) {
        historySectionsHtml += `
          <div class="timeline-group-header">⚡ Today's Sessions (${timeline.today.length})</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderLogCards(timeline.today)}
          </div>
        `;
      }
      if (timeline.yesterday && timeline.yesterday.length > 0) {
        historySectionsHtml += `
          <div class="timeline-group-header">📅 Yesterday / Last Day (${timeline.yesterday.length})</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderLogCards(timeline.yesterday)}
          </div>
        `;
      }
      if (timeline.this_week && timeline.this_week.length > 0) {
        historySectionsHtml += `
          <div class="timeline-group-header">🗓️ Earlier This Week (${timeline.this_week.length})</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderLogCards(timeline.this_week)}
          </div>
        `;
      }
      if (timeline.last_week && timeline.last_week.length > 0) {
        historySectionsHtml += `
          <div class="timeline-group-header">📆 Last Week (${timeline.last_week.length})</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderLogCards(timeline.last_week)}
          </div>
        `;
      }
      if (timeline.older && timeline.older.length > 0) {
        historySectionsHtml += `
          <div class="timeline-group-header">📦 Older Workouts (${timeline.older.length})</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderLogCards(timeline.older)}
          </div>
        `;
      }
    } else {
      historySectionsHtml = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted); background: #FFF; border-radius: 16px; margin-top: 10px;">
          <p style="font-weight: 700; margin-bottom: 6px;">No workout sessions logged yet</p>
          <p style="font-size: 0.78rem; margin-bottom: 16px;">Complete your first workout to see your daily & weekly timeline!</p>
          <button class="start-day-pill-btn" style="background: var(--brand-blue); color: #FFF; max-width: 200px; margin: 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onclick="HomeWorkoutApp.goToHome()">
            <span>Go to Workouts</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="background: #FFFFFF; border-radius: 18px; padding: 20px; box-shadow: var(--shadow-card); margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <div>
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;">WORKOUTS</span>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--brand-blue);">${allLogs.length}</div>
          </div>
          <div>
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;">STREAK</span>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--accent-flame);">${user.streakCount} Days</div>
          </div>
          <div>
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;">WEEKLY GOAL</span>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--brand-blue);">${user.weeklyCompletedCount}/${user.weeklyGoalTarget}</div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <h3 class="section-bold-title" style="font-size: 1.05rem; margin: 0;">Workout Timeline</h3>
        ${hasAny ? `
          <button onclick="HomeWorkoutApp.toggleHistorySelectMode()" style="background: ${isSelectionMode ? 'var(--brand-blue)' : '#EFF6FF'}; color: ${isSelectionMode ? '#FFF' : 'var(--brand-blue)'}; border: 1px solid rgba(0, 82, 255, 0.25); font-size: 0.72rem; font-weight: 800; padding: 5px 12px; border-radius: 9999px; cursor: pointer;">
            ${isSelectionMode ? '✕ Cancel' : '☑ Manage / Select'}
          </button>
        ` : ''}
      </div>

      ${isSelectionMode && hasAny ? `
        <div class="timeline-manage-toolbar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="masterSelectAllCheck" ${allSelected ? 'checked' : ''} onchange="HomeWorkoutApp.toggleSelectAllHistory(this.checked)" style="width: 18px; height: 18px; accent-color: var(--brand-blue); cursor: pointer;">
            <label for="masterSelectAllCheck" style="font-size: 0.82rem; font-weight: 800; color: var(--text-main); cursor: pointer;">
              Select All (${selectedCount}/${allLogs.length} selected)
            </label>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="bulk-delete-btn" onclick="HomeWorkoutApp.deleteSelectedHistory()" ${selectedCount === 0 ? 'disabled' : ''}>
              🗑️ Delete Selected (${selectedCount})
            </button>
          </div>
        </div>
      ` : ''}

      ${historySectionsHtml}
    `;
  },

  toggleHistorySelectMode() {
    this.historySelectionMode = !this.historySelectionMode;
    if (!this.historySelectionMode) {
      this.selectedLogIds.clear();
    }
    this.renderReportScreen();
  },

  toggleSelectAllHistory(checked) {
    if (checked) {
      this.cachedTimelineLogs.forEach(l => this.selectedLogIds.add(String(l.id)));
    } else {
      this.selectedLogIds.clear();
    }
    this.renderReportScreen();
  },

  toggleLogSelect(logId) {
    const sid = String(logId);
    if (this.selectedLogIds.has(sid)) {
      this.selectedLogIds.delete(sid);
    } else {
      this.selectedLogIds.add(sid);
    }
    this.renderReportScreen();
  },

  async deleteSelectedHistory() {
    const count = this.selectedLogIds.size;
    if (count === 0) return;

    if (confirm(`Are you sure you want to delete ${count} selected workout session(s)?`)) {
      try {
        const ids = Array.from(this.selectedLogIds);
        await HomeWorkoutStore.deleteSelectedWorkoutLogs(ids);
        this.selectedLogIds.clear();
        this.historySelectionMode = false;
        await this.renderReportScreen();
        this.renderWeeklyGoalCard();
        this.renderHeader();
        alert(`🗑️ ${count} workout session(s) successfully deleted.`);
      } catch (err) {
        console.error('Delete error:', err);
        alert('Could not delete workouts: ' + (err.message || 'Unknown error'));
      }
    }
  },

  toggleTimelineAccordion(logId) {
    const list = document.getElementById(`tl-ex-${logId}`);
    if (list) {
      list.classList.toggle('open');
    }
  },

  clearReportHistory() {
    if (confirm('Clear your completed workout history?')) {
      HomeWorkoutStore.clearWorkoutLogs();
      this.renderReportScreen();
    }
  },

  // ========================================================
  // USER ACCOUNT & CLOUD SESSION SYNC MODAL
  // ========================================================
  authMode: 'login',

  openAuthModal(mode = 'login') {
    const user = HomeWorkoutStore.getUser();
    const loggedInView = document.getElementById('authLoggedInView');
    const formView = document.getElementById('authFormView');
    const usernameEl = document.getElementById('authLoggedInUsername');
    const avatarEl = document.getElementById('authAvatarLetter');
    const intro = document.getElementById('authModalIntro');

    if (HomeWorkoutStore.isSignedIn()) {
      if (loggedInView) loggedInView.style.display = 'block';
      if (formView) formView.style.display = 'none';
      if (usernameEl) usernameEl.textContent = user.username;
      if (avatarEl) avatarEl.textContent = (user.username[0] || 'A').toUpperCase();
      if (intro) intro.textContent = 'Your plan, workouts and streak are saved to your account.';
    } else {
      if (loggedInView) loggedInView.style.display = 'none';
      if (formView) formView.style.display = 'block';
      if (intro) intro.textContent = 'Save your plan, workouts and streak to a free account, so you never lose them and can use them on any device.';
      this.switchAuthMode(mode === 'register' ? 'register' : 'login');
    }

    this.openModal('authModalBackdrop', 'auth');
    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('auth_modal', this.authMode || 'login');
    }
  },

  closeAuthModal(fromPop = false) {
    this.closeModal('authModalBackdrop', fromPop);
  },

  showAuthFeedback(message, type = 'error') {
    const box = document.getElementById('authInlineFeedback');
    if (!box) return;
    box.style.display = 'block';
    // textContent (not innerHTML): messages can contain typed names or text from the address bar
    if (type === 'error') {
      box.style.background = '#FEE2E2';
      box.style.border = '1px solid #FCA5A5';
      box.style.color = '#B91C1C';
      box.textContent = `⚠️ ${message}`;
    } else if (type === 'success') {
      box.style.background = '#ECFDF5';
      box.style.border = '1px solid #6EE7B7';
      box.style.color = '#047857';
      box.textContent = `✅ ${message}`;
    } else {
      box.style.background = '#EFF6FF';
      box.style.border = '1px solid #BFDBFE';
      box.style.color = '#1D4ED8';
      box.textContent = `ℹ️ ${message}`;
    }
  },

  clearAuthFeedback() {
    const box = document.getElementById('authInlineFeedback');
    if (box) {
      box.style.display = 'none';
      box.innerHTML = '';
    }
  },

  switchAuthMode(mode) {
    this.authMode = mode;
    this.clearAuthFeedback();
    const loginBtn = document.getElementById('authTabLoginBtn');
    const regBtn = document.getElementById('authTabRegisterBtn');
    const tabSwitcher = document.getElementById('authTabSwitcher');
    const forgotNavRow = document.getElementById('authForgotNavRow');
    const forgotNotice = document.getElementById('authForgotNotice');
    const forgotBackWrap = document.getElementById('authForgotBackWrap');
    const submitBtn = document.getElementById('authSubmitBtn');
    const emailGroup = document.getElementById('authEmailGroup');
    const usernameLabel = document.getElementById('authUsernameLabel');
    const usernameInput = document.getElementById('authUsernameInput');
    const forgotLinkWrap = document.getElementById('authForgotLinkWrap');
    const passwordGroup = document.getElementById('authPasswordGroup');
    const orGuestWrap = document.getElementById('authOrGuestWrap');
    const authModalTitle = document.getElementById('authModalTitle');
    const googleWrap = document.getElementById('authGoogleWrap');
    if (googleWrap) {
      googleWrap.style.display = (mode !== 'forgot' && HomeWorkoutStore.isGoogleSignInEnabled()) ? 'block' : 'none';
    }

    if (mode === 'forgot') {
      if (authModalTitle) authModalTitle.textContent = 'Account Recovery';
      if (tabSwitcher) tabSwitcher.style.display = 'none';
      if (forgotNavRow) forgotNavRow.style.display = 'flex';
      if (forgotNotice) forgotNotice.style.display = 'block';
      if (forgotBackWrap) forgotBackWrap.style.display = 'block';
      if (loginBtn) loginBtn.classList.remove('active');
      if (regBtn) regBtn.classList.remove('active');
      if (emailGroup) emailGroup.style.display = 'none';
      if (passwordGroup) passwordGroup.style.display = 'none';
      if (forgotLinkWrap) forgotLinkWrap.style.display = 'none';
      if (orGuestWrap) orGuestWrap.style.display = 'none';
      if (usernameLabel) usernameLabel.textContent = 'Registered Email or Username';
      if (usernameInput) {
        usernameInput.placeholder = 'you@example.com or athlete_name';
        usernameInput.focus();
      }
      if (submitBtn) submitBtn.textContent = 'Send Password Reset Link';
    } else if (mode === 'register') {
      if (authModalTitle) authModalTitle.textContent = 'Create your free account';
      if (tabSwitcher) tabSwitcher.style.display = 'flex';
      if (forgotNavRow) forgotNavRow.style.display = 'none';
      if (forgotNotice) forgotNotice.style.display = 'none';
      if (forgotBackWrap) forgotBackWrap.style.display = 'none';
      if (loginBtn) loginBtn.classList.remove('active');
      if (regBtn) regBtn.classList.add('active');
      if (emailGroup) emailGroup.style.display = 'block';
      if (passwordGroup) passwordGroup.style.display = 'block';
      if (forgotLinkWrap) forgotLinkWrap.style.display = 'none';
      if (orGuestWrap) orGuestWrap.style.display = 'block';
      if (usernameLabel) usernameLabel.textContent = 'Your name (optional)';
      if (usernameInput) usernameInput.placeholder = 'e.g. Sara';
      if (submitBtn) submitBtn.textContent = 'Create free account';
    } else {
      // login mode
      if (authModalTitle) authModalTitle.textContent = 'Sign In to Your Account';
      if (tabSwitcher) tabSwitcher.style.display = 'flex';
      if (forgotNavRow) forgotNavRow.style.display = 'none';
      if (forgotNotice) forgotNotice.style.display = 'none';
      if (forgotBackWrap) forgotBackWrap.style.display = 'none';
      if (loginBtn) loginBtn.classList.add('active');
      if (regBtn) regBtn.classList.remove('active');
      if (emailGroup) emailGroup.style.display = 'none';
      if (passwordGroup) passwordGroup.style.display = 'block';
      if (forgotLinkWrap) forgotLinkWrap.style.display = 'block';
      if (orGuestWrap) orGuestWrap.style.display = 'block';
      if (usernameLabel) usernameLabel.textContent = 'Email';
      if (usernameInput) usernameInput.placeholder = 'you@example.com';
      if (submitBtn) submitBtn.textContent = 'Sign In';
    }
  },

  async startGoogleSignIn() {
    if (typeof TelemetryTracker !== 'undefined') TelemetryTracker.trackAuth('google_start', null);
    try {
      await HomeWorkoutStore.signInWithGoogle(); // leaves the page for Google
    } catch (err) {
      const authOpen = document.getElementById('authModalBackdrop')?.classList.contains('active');
      if (!authOpen) {
        this.closeSavePrompt();
        this.openAuthModal('login');
      }
      this.showAuthFeedback(err.message || 'Google sign-in failed. Please try email instead.', 'error');
    }
  },

  // ========================================================
  // "SAVE YOUR PROGRESS" PROMPT (people without an account)
  // ========================================================
  maybeShowSavePrompt() {
    if (HomeWorkoutStore.shouldShowSavePrompt()) {
      setTimeout(() => this.openSavePrompt(), 400);
    }
  },

  openSavePrompt() {
    const count = HomeWorkoutStore.getWorkoutLogs().length;
    const text = document.getElementById('saveProgressText');
    if (text) {
      text.textContent = count > 0
        ? `Nice work! You've done ${count} workout${count === 1 ? '' : 's'}. Right now your plan and workouts are only saved on this phone.`
        : 'Right now your plan and workouts are only saved on this phone.';
    }
    const googleWrap = document.getElementById('saveProgressGoogleWrap');
    if (googleWrap) googleWrap.style.display = HomeWorkoutStore.isGoogleSignInEnabled() ? 'block' : 'none';
    this.openModal('saveProgressBackdrop', 'save-progress');
    if (typeof TelemetryTracker !== 'undefined') TelemetryTracker.trackScreen('save_progress_prompt', String(count));
  },

  closeSavePrompt(fromPop = false) {
    this.closeModal('saveProgressBackdrop', fromPop);
  },

  // Swap the prompt for the sign-up/sign-in sheet without a "back" step in between
  savePromptCreateAccount() {
    this.closeModal('saveProgressBackdrop', true);
    this.openAuthModal('register');
  },

  savePromptSignIn() {
    this.closeModal('saveProgressBackdrop', true);
    this.openAuthModal('login');
  },

  savePromptNotNow() {
    HomeWorkoutStore.dismissSavePrompt();
    this.closeSavePrompt();
  },

  // Re-draw everything that depends on who is signed in
  refreshAfterAuthChange() {
    this.renderHeader();
    this.renderTodayCard();
    this.renderWeeklyGoalCard();
    this.renderChallengeCarousel();
    this.renderBodyFocus();
    this.renderSettingsScreen();
    if (this.currentTab === 'report') this.renderReportScreen();
  },

  async submitAuthForm() {
    this.clearAuthFeedback();
    const usernameInput = document.getElementById('authUsernameInput');
    const emailInput = document.getElementById('authEmailInput');
    const passwordInput = document.getElementById('authPasswordInput');
    const u = usernameInput ? usernameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const p = passwordInput ? passwordInput.value.trim() : '';

    const submitBtn = document.getElementById('authSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';
    }

    try {
      if (this.authMode === 'forgot') {
        const target = u;
        if (!target) {
          throw new Error('Please enter your email address or athlete username.');
        }
        const res = await HomeWorkoutStore.sendPasswordResetEmail(target);
        const masked = res.email ? res.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : target;
        this.showAuthFeedback(`📩 Password reset link sent to ${masked}! Check your email inbox (and spam folder) to reset your password.`, 'success');
      } else if (this.authMode === 'login') {
        const res = await HomeWorkoutStore.login(u, p);
        const moved = res && res.uploaded ? ` ${res.uploaded} workout${res.uploaded === 1 ? '' : 's'} from this phone ${res.uploaded === 1 ? 'was' : 'were'} saved to your account.` : '';
        this.showAuthFeedback(`Welcome back, ${res.user.username}!${moved}`, 'success');
        setTimeout(() => {
          this.closeAuthModal();
          this.refreshAfterAuthChange();
        }, moved ? 1600 : 700);
      } else {
        // register mode: name is optional, email + password are required
        if (u && u.length < 3) {
          throw new Error('Name must be at least 3 characters (or leave it empty).');
        }
        if (!email || !email.includes('@') || !email.includes('.')) {
          throw new Error('Please enter a valid email address (e.g. you@example.com).');
        }
        if (!p || p.length < 8) {
          throw new Error('Please enter a password with at least 8 characters.');
        }
        const res = await HomeWorkoutStore.register(u, email, p, this.activeFocusLevel || 'Intermediate');
        if (res.status === 'confirm_email') {
          this.switchAuthMode('login');
          const idField = document.getElementById('authUsernameInput');
          if (idField) idField.value = res.email;
          this.showAuthFeedback(`Almost done! We sent a link to ${res.email}. Open it to confirm your email, then sign in here. Your workouts on this phone will be saved to your account when you sign in.`, 'info');
        } else {
          const moved = res.uploaded ? ` ${res.uploaded} workout${res.uploaded === 1 ? '' : 's'} from this phone ${res.uploaded === 1 ? 'was' : 'were'} saved to it.` : '';
          this.showAuthFeedback(`Your account is ready, ${res.user.username}!${moved}`, 'success');
          setTimeout(() => {
            this.closeAuthModal();
            this.refreshAfterAuthChange();
          }, moved ? 1600 : 900);
        }
      }

      if (typeof TelemetryTracker !== 'undefined' && this.authMode !== 'forgot') {
        TelemetryTracker.trackAuth(this.authMode, u);
      }
    } catch (err) {
      this.showAuthFeedback(err.message || 'Authentication error. Please check your details.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    }
  },

  async handle1TapGuestLogin() {
    this.clearAuthFeedback();
    try {
      const data = await HomeWorkoutStore.guestLogin();
      if (typeof TelemetryTracker !== 'undefined') {
        TelemetryTracker.trackAuth('guest_login', data.user.username);
      }
      this.showAuthFeedback(`⚡ Guest session ready as "${data.user.username}". Starting session...`, 'success');
      setTimeout(() => {
        this.closeAuthModal();
        this.refreshAfterAuthChange();
      }, 500);
    } catch (err) {
      this.showAuthFeedback('Could not start guest session: ' + err.message, 'error');
    }
  },

  showLogoutPrompt() {
    const wrap = document.getElementById('authLogoutConfirmWrap');
    const initBtn = document.getElementById('authLogoutInitialBtn');
    if (wrap) wrap.style.display = 'block';
    if (initBtn) initBtn.style.display = 'none';
  },

  cancelLogoutPrompt() {
    const wrap = document.getElementById('authLogoutConfirmWrap');
    const initBtn = document.getElementById('authLogoutInitialBtn');
    if (wrap) wrap.style.display = 'none';
    if (initBtn) initBtn.style.display = 'block';
  },

  confirmLogout() {
    const user = HomeWorkoutStore.getUser();
    if (typeof TelemetryTracker !== 'undefined' && user) {
      TelemetryTracker.trackAuth('logout', user.username);
    }
    HomeWorkoutStore.logout();
    this.cancelLogoutPrompt();
    this.closeAuthModal();
    this.refreshAfterAuthChange();
  },

  handleLogout() {
    this.showLogoutPrompt();
  },

  // ========================================================
  // ACCOUNT SECURITY & RECOVERY EMAIL MODAL
  // ========================================================
  openAccountSecurityModal() {
    const user = HomeWorkoutStore.getUser();
    const usernameEl = document.getElementById('secActiveUsername');
    const avatarEl = document.getElementById('secAvatarLetter');
    if (usernameEl) {
      usernameEl.textContent = user.username ? '@' + user.username : 'Athlete';
    }
    if (avatarEl) {
      avatarEl.textContent = (user.username ? user.username[0] : 'A').toUpperCase();
    }

    const emailInput = document.getElementById('secRecoveryEmailInput');
    if (emailInput) {
      const currentEmail = (user.email && !user.email.endsWith('@homeworkout.app')) ? user.email : '';
      emailInput.value = currentEmail;
    }

    const passInput = document.getElementById('secNewPasswordInput');
    if (passInput) passInput.value = '';
    const confirmInput = document.getElementById('secConfirmPasswordInput');
    if (confirmInput) confirmInput.value = '';

    const feedback = document.getElementById('accountSecurityFeedback');
    if (feedback) {
      feedback.style.display = 'none';
      feedback.innerHTML = '';
    }

    this.openModal('accountSecurityModalBackdrop', 'security');
    if (typeof TelemetryTracker !== 'undefined') {
      TelemetryTracker.trackScreen('account_security_modal');
    }
  },

  closeAccountSecurityModal(fromPop = false) {
    this.closeModal('accountSecurityModalBackdrop', fromPop);
  },

  async submitAccountSecurityUpdate() {
    const emailInput = document.getElementById('secRecoveryEmailInput');
    const passInput = document.getElementById('secNewPasswordInput');
    const confirmInput = document.getElementById('secConfirmPasswordInput');
    const feedback = document.getElementById('accountSecurityFeedback');
    const btn = document.getElementById('secSubmitBtn');

    const showMsg = (msg, isErr = true) => {
      if (!feedback) return;
      feedback.style.display = 'block';
      feedback.style.background = isErr ? '#FEE2E2' : '#ECFDF5';
      feedback.style.border = isErr ? '1px solid #FCA5A5' : '1px solid #6EE7B7';
      feedback.style.color = isErr ? '#B91C1C' : '#047857';
      feedback.innerHTML = (isErr ? '⚠️ ' : '✅ ') + msg;
    };

    const newEmail = emailInput ? emailInput.value.trim() : '';
    const newPass = passInput ? passInput.value.trim() : '';
    const confirmPass = confirmInput ? confirmInput.value.trim() : '';

    if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
      showMsg('Please enter a valid personal email address (e.g. you@example.com).');
      return;
    }

    if (newPass) {
      if (newPass.length < 8) {
        showMsg('Password must be at least 8 characters long.');
        return;
      }
      if (newPass !== confirmPass) {
        showMsg('New passwords do not match. Please re-enter.');
        return;
      }
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving Changes...';
    }

    try {
      await HomeWorkoutStore.updateUserAccount(newEmail, newPass || null);
      showMsg('Account security updated successfully! Recovery email linked.', false);
      this.renderSettingsScreen();
      setTimeout(() => {
        this.closeAccountSecurityModal();
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Save Security Settings';
        }
      }, 1200);
    } catch (err) {
      showMsg(err.message || 'Could not update account security.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Security Settings';
      }
    }
  },

  renderSettingsScreen() {
    const user = HomeWorkoutStore.getUser();
    const token = HomeWorkoutStore.getToken();
    const container = document.getElementById('settingsScreenContent');
    if (!container) return;

    const hasRealEmail = user.email && !user.email.endsWith('@homeworkout.app');
    const plan = HomeWorkoutStore.getPlan();
    const planSummary = (plan && typeof TrainingPlan !== 'undefined')
      ? `${TrainingPlan.GOALS[plan.goal].icon} ${TrainingPlan.GOALS[plan.goal].label} · ${plan.daysPerWeek} days/week · ${TrainingPlan.LOCATIONS[plan.location].label} · ${plan.minutes} min`
      : 'Not set up yet';

    container.innerHTML = `
      <!-- User Profile Card -->
      <div style="background: #FFFFFF; border-radius: 18px; padding: 18px; box-shadow: var(--shadow-card); margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0052FF, #3B82F6); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.15rem; box-shadow: 0 4px 10px rgba(0, 82, 255, 0.25);">
              ${(user.username ? user.username[0] : 'U').toUpperCase()}
            </div>
            <div>
              <h4 style="font-weight: 800; font-size: 1rem; color: var(--text-main); margin: 0 0 2px 0;">${user.username ? user.username : 'Guest Athlete'}</h4>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${HomeWorkoutStore.isSignedIn() ? '🟢 Saved to your account' : '⚪ Saved on this phone only'}</span>
            </div>
          </div>
          <button class="level-select-pill" onclick="HomeWorkoutApp.openAuthModal('${HomeWorkoutStore.isSignedIn() ? 'login' : 'register'}')" style="font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <span>${HomeWorkoutStore.isSignedIn() ? 'Account' : 'Save progress'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <!-- Settings & Controls Card -->
      <div style="background: #FFFFFF; border-radius: 18px; padding: 18px; box-shadow: var(--shadow-card); margin-bottom: 20px;">
        <!-- Training Plan Row -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 14px;">
          <div>
            <h4 style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); margin: 0 0 2px 0;">Training Plan</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${planSummary}</span>
          </div>
          <button class="level-select-pill" onclick="HomeWorkoutApp.openOnboarding({ editing: true })" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <span>${plan ? 'Change' : 'Set up'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <!-- Account Security / Recovery Row (If Signed In) -->
        ${token && user.username && !user.isGuest ? `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 14px;">
            <div>
              <h4 style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); margin: 0 0 2px 0;">Account & Recovery Email</h4>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${hasRealEmail ? '📧 ' + user.email : '⚠️ No recovery email linked'}</span>
            </div>
            <button class="level-select-pill" onclick="HomeWorkoutApp.openAccountSecurityModal()" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              <span>${hasRealEmail ? 'Edit' : 'Link Email'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        ` : ''}

        <!-- Fitness Level Row -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 14px;">
          <div>
            <h4 style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); margin: 0 0 2px 0;">Fitness Level</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Current: ${user.fitnessLevel || 'Intermediate'}</span>
          </div>
          <button class="level-select-pill" onclick="HomeWorkoutApp.openLevelModal()" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <span>Change</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        <!-- Reset All Progress Row -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px;">
          <div>
            <h4 style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); margin: 0 0 2px 0;">Reset All Progress</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Clear workout history and start your plan again</span>
          </div>
          <button class="fw-start-btn" style="background: #FEE2E2; color: #DC2626; border: none; font-weight: 800; font-size: 0.8rem; padding: 6px 14px; border-radius: 9999px; cursor: pointer;" onclick="HomeWorkoutApp.resetData()">
            RESET
          </button>
        </div>
      </div>

      <!-- Privacy & Anonymous Telemetry Notice -->
      <div style="background: #F8FAFC; border: 1px solid var(--border-divider); border-radius: 16px; padding: 14px 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 0.95rem;">🔒</span>
          <h5 style="font-weight: 800; font-size: 0.85rem; color: var(--text-main); margin: 0;">Privacy & Anonymous Telemetry</h5>
        </div>
        <p style="font-size: 0.74rem; color: var(--text-muted); margin: 0; line-height: 1.45;">
          Anonymous performance, screen size, and workout telemetry are recorded to synchronize cross-device sessions and maintain streak accuracy. Personal passwords are never stored in plain text and athlete data is protected.
        </p>
      </div>
    `;
  },

  async resetData() {
    if (confirm('Are you sure you want to reset all your workout progress, streak, and history back to 0/5?')) {
      await HomeWorkoutStore.resetAllProgress();
      this.renderHeader();
      this.renderTodayCard();
      this.renderWeeklyGoalCard();
      this.renderChallengeCarousel();
      this.renderBodyFocus({ forceRefresh: true });
      this.renderSettingsScreen();
      alert(HomeWorkoutStore.getPlan()
        ? '✅ All progress, streaks and history have been reset. Your training plan starts again from Week 1, Day 1.'
        : '✅ All progress, streaks (0), and weekly workouts (0/5) have been reset.');
    }
  }
};

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
  HomeWorkoutApp.init();
});
