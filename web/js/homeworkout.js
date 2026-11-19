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
  explorerLocation: 'All', // 'All' | 'Home' | 'Gym'
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

  async init() {
    this.activeFocusLevel = HomeWorkoutStore.getUserLevel();
    this.renderHeader();
    this.renderWeeklyGoalCard();
    this.renderChallengeCarousel();
    this.renderBodyFocus();
    this.bindEvents();

    // Background sync user session from server if token exists
    try {
      const serverUser = await HomeWorkoutStore.syncSession();
      if (serverUser) {
        this.renderHeader();
        this.renderWeeklyGoalCard();
        this.renderBodyFocus();
      }
    } catch (e) {}
  },

  onDatabaseLoaded() {
    this.renderBodyFocus();
    if (this.currentScreen === 'directory' && this.directoryMode === 'library') {
      this.renderExplorer();
    }
  },

  bindEvents() {
    // Search input live query on dashboard
    const searchInput = document.getElementById('hwSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.trim().length > 0) {
          this.openDirectory('All', query);
        }
      });
    }

    // Explorer search input
    const explorerSearch = document.getElementById('explorerSearchInput');
    if (explorerSearch) {
      explorerSearch.addEventListener('input', (e) => {
        this.explorerSearch = e.target.value;
        this.renderExplorer();
      });
    }

    // Swap modal search input
    const swapSearch = document.getElementById('swapModalSearchInput');
    if (swapSearch) {
      swapSearch.addEventListener('input', (e) => {
        this.swapModalSearch = e.target.value;
        this.renderSwapOptions();
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

  renderHeader() {
    const user = HomeWorkoutStore.getUser();
    
    const streakEl = document.getElementById('streakFlameNum');
    if (streakEl) streakEl.textContent = user.streakCount;

    const userNameEl = document.getElementById('headerUserName');
    if (userNameEl) {
      userNameEl.textContent = user.username || 'Sign In';
    }

    const proBtn = document.getElementById('headerProBtn');
    if (proBtn) {
      proBtn.innerHTML = user.isPro 
        ? `👑 PRO ACTIVE` 
        : `👑 PRO ↗`;
    }
  },

  renderWeeklyGoalCard() {
    const user = HomeWorkoutStore.getUser();

    // Counter: 0/5 (0 in blue)
    const countEl = document.getElementById('wgCountActive');
    const targetEl = document.getElementById('wgTargetTotal');
    if (countEl) countEl.textContent = user.weeklyCompletedCount;
    if (targetEl) targetEl.textContent = `/${user.weeklyGoalTarget}`;

    // 7-Day Date Strip
    const dateStrip = document.getElementById('wgDateStrip');
    if (dateStrip) {
      dateStrip.innerHTML = user.activeWeekDays.map(dayNum => {
        const isActive = dayNum === user.currentDaySelected;
        const isCompleted = dayNum < user.currentDaySelected || (isActive && user.weeklyCompletedCount > 0);
        return `
          <div class="date-col ${isActive ? 'active' : ''} ${isCompleted && !isActive ? 'completed' : ''}" onclick="HomeWorkoutApp.selectDay(${dayNum})">
            <span class="date-num">${dayNum}</span>
          </div>
        `;
      }).join('');
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
            <span class="card-title-chevron">❯</span>
          </div>

          ${contentBlock}

          <div class="card-athlete-visual">
            ${athleteSvg}
          </div>

          <button class="start-day-pill-btn" onclick="HomeWorkoutApp.startWorkoutSession('${ch.id}', ${ch.currentDay})">
            START DAY ${ch.currentDay} <span class="start-arrow-circle">➔</span>
          </button>
        </div>
      `;
    }).join('');
  },

  renderBodyFocus(options = {}) {
    const { forceRefresh = false, shuffle = false } = options;
    const segRow = document.getElementById('bodyFocusLocationSegment');
    const lvlBtnText = document.getElementById('bfLevelText');
    const chipsRow = document.getElementById('categoryChipsRow');
    const workoutsList = document.getElementById('focusWorkoutsList');
    if (!workoutsList) return;

    // Update location segment active state
    if (segRow) {
      segRow.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-loc') === this.activeFocusLocation);
      });
    }

    // Update level pill text
    if (lvlBtnText) {
      const lvl = this.activeFocusLevel || 'Intermediate';
      const icon = lvl === 'Beginner' ? '🟢' : (lvl === 'Advanced' ? '🔴' : '🟡');
      lvlBtnText.innerHTML = `${icon} ${lvl}`;
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
          ▶ START DAY 1 (${exercises.length} EXERCISES) ➔
        </button>
      </div>
    `;

    // Clean, roomy, non-overlapping exercise items with single Swap button
    const cardsHtml = exercises.map((ex, idx) => `
      <div class="focus-workout-card" onclick="HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
        <div class="fw-left-wrap">
          <img class="fw-thumb-img" src="${ex.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'54\\' height=\\'54\\' viewBox=\\'0 0 54 54\\'><rect width=\\'54\\' height=\\'54\\' rx=\\'12\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'22\\'>💪</text></svg>'">
          <div class="fw-info-wrap">
            <h4 class="fw-title">${idx + 1}. ${ex.name}</h4>
            <div class="fw-meta">
              <span>${ex.reps || '12-15 reps'}</span>
              <span class="fw-meta-dot">•</span>
              <span>🎯 ${ex.target || ex.muscle}</span>
            </div>
          </div>
        </div>
        <div class="fw-card-actions">
          <button class="fw-swap-btn" onclick="event.stopPropagation(); HomeWorkoutApp.openSwapModal(${idx})" title="Swap this exercise with another one">
            🔄 Swap
          </button>
          <button class="fw-start-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
            START ➔
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

    if (modal) modal.classList.add('active');
    this.renderSwapOptions();
  },

  closeSwapModal() {
    this.swapTargetIndex = null;
    const modal = document.getElementById('swapExerciseModalBackdrop');
    if (modal) modal.classList.remove('active');
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

    listContainer.innerHTML = candidates.map(cand => `
      <div class="swap-option-card" onclick="HomeWorkoutApp.selectReplacementExercise('${cand.id}')">
        <div class="swap-option-left">
          <img class="swap-option-thumb" src="${cand.thumbnailUrl}" alt="${cand.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'44\\' height=\\'44\\' viewBox=\\'0 0 44 44\\'><rect width=\\'44\\' height=\\'44\\' rx=\\'10\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>💪</text></svg>'">
          <div class="swap-option-info">
            <div class="swap-option-title">${cand.name}</div>
            <div class="swap-option-meta">
              <span>🎯 ${cand.target || cand.muscle}</span>
              ${cand.equipment ? ` • <span>${cand.equipment}</span>` : ''}
              ${cand.level ? ` • <span>${cand.level}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="swap-select-btn" onclick="event.stopPropagation(); HomeWorkoutApp.selectReplacementExercise('${cand.id}')">
          Choose ➔
        </button>
      </div>
    `).join('');
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
      if (titleEl) titleEl.textContent = '1,324 Exercise Library';
      this.renderExplorer();
    }
  },

  openDirectory(category = 'All', searchQuery = '') {
    this.currentScreen = 'directory';
    this.currentTab = 'discover';
    this.activeChallengeFilter = category;

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

    this.switchDirectoryMode('challenges');
    this.renderDirectoryFilters();
    this.renderDirectoryCards(searchQuery);

    const scrollContainer = document.querySelector('.hw-main-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  openExerciseExplorer(muscle = 'All', location = 'All') {
    this.currentScreen = 'directory';
    this.currentTab = 'discover';
    if (muscle) this.explorerMuscle = muscle;
    if (location) this.explorerLocation = location;

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
    this.explorerLevel = lvl;
    this.renderExplorer();
  },

  filterExplorerMuscle(muscle) {
    this.explorerMuscle = muscle;
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

    // 3. Render Muscle Pills
    const pillsRow = document.getElementById('explorerMusclePills');
    if (pillsRow) {
      const muscles = [
        { id: 'All', name: 'All Muscles' },
        { id: 'Chest', name: '🫁 Chest' },
        { id: 'Back', name: '🧗 Back' },
        { id: 'Warmup', name: '🔥 Warmup' },
        { id: 'Abs & Core', name: '🍫 Abs & Core' },
        { id: 'Arms', name: '🦾 Arms' },
        { id: 'Legs', name: '🦵 Legs' },
        { id: 'Shoulders', name: '🛡️ Shoulders' }
      ];

      pillsRow.innerHTML = muscles.map(m => `
        <button class="exp-filter-pill ${this.explorerMuscle === m.id ? 'active' : ''}" onclick="HomeWorkoutApp.filterExplorerMuscle('${m.id}')">
          ${m.name}
        </button>
      `).join('');
    }

    // 4. Query exercises
    const stack = document.getElementById('explorerExercisesStack');
    const countEl = document.getElementById('explorerResultsCount');
    if (!stack) return;

    let exercises = [];
    if (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.queryExercises) {
      exercises = ExerciseDataset.queryExercises({
        muscle: this.explorerMuscle,
        location: this.explorerLocation,
        level: this.explorerLevel,
        search: this.explorerSearch,
        limit: 80
      });
    }

    if (countEl) {
      const locText = this.explorerLocation === 'All' ? 'All Environments' : (this.explorerLocation === 'Home' ? 'Home' : 'Gym');
      const lvlText = this.explorerLevel === 'All' ? 'All Levels' : `${this.explorerLevel}`;
      countEl.innerHTML = `Showing <strong style="color: var(--brand-blue);">${exercises.length}</strong> exercises • <span>${this.explorerMuscle}</span> • <span>${lvlText}</span> <span>(${locText})</span>`;
    }

    if (exercises.length === 0) {
      stack.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 1rem; font-weight: 700;">No exercises match your filters</p>
          <p style="font-size: 0.82rem;">Try switching from Home to Gym or clearing the search keyword.</p>
        </div>
      `;
      return;
    }

    stack.innerHTML = exercises.map(ex => {
      const lvl = ex.level || 'Intermediate';
      const lvlClass = lvl.toLowerCase();
      const lvlIcon = lvl === 'Beginner' ? '🟢' : (lvl === 'Advanced' ? '🔴' : '🟡');
      return `
        <div class="focus-workout-card" onclick="HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
          <div class="fw-left-wrap">
            <img class="fw-thumb-img" src="${ex.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'54\\' height=\\'54\\' viewBox=\\'0 0 54 54\\'><rect width=\\'54\\' height=\\'54\\' rx=\\'10\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'22\\'>💪</text></svg>'">
            <div class="fw-info-wrap">
              <h4 class="fw-title">${ex.name}</h4>
              <div class="fw-meta">
                <span class="level-tag ${lvlClass}">${lvlIcon} ${lvl}</span>
                <span>•</span>
                <span>🎯 ${ex.target || ex.muscle}</span>
                <span>•</span>
                <span style="color: ${ex.location === 'Home' ? '#10B981' : '#0052FF'}; font-weight: 700;">${ex.location === 'Home' ? '🏠 Home' : '🏋️ Gym'}</span>
                <span>•</span>
                <span>${ex.equipment}</span>
              </div>
            </div>
          </div>
          <button class="fw-start-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
            PREVIEW ➔
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
            <span class="card-title-chevron">❯</span>
          </div>

          ${contentBlock}

          <div class="card-athlete-visual">
            ${athleteSvg}
          </div>

          <button class="start-day-pill-btn" onclick="HomeWorkoutApp.startWorkoutSession('${ch.id}', ${ch.currentDay})">
            START DAY ${ch.currentDay} <span class="start-arrow-circle">➔</span>
          </button>
        </div>
      `;
    }).join('');

    // Append individual matching exercises from dataset if query is active
    if (searchQuery && searchQuery.trim().length > 0 && typeof ExerciseDataset !== 'undefined') {
      const q = searchQuery.toLowerCase().trim();
      const allEx = [];
      if (ExerciseDataset.bodyFocus) Object.values(ExerciseDataset.bodyFocus).forEach(list => allEx.push(...list));
      if (ExerciseDataset.challenges) Object.values(ExerciseDataset.challenges).forEach(list => allEx.push(...list));

      const seen = new Set();
      const matchedEx = allEx.filter(ex => {
        if (seen.has(ex.id)) return false;
        const hit = ex.name.toLowerCase().includes(q) || ex.target.toLowerCase().includes(q) || ex.equipment.toLowerCase().includes(q);
        if (hit) seen.add(ex.id);
        return hit;
      });

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
                  <button class="fw-start-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
                    START ➔
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
    if (modal) modal.classList.add('active');
    this.loadCurrentExercise();
  },

  // ========================================================
  // INTERACTIVE WORKOUT SESSION RUNNER (START DAY 1 & FOCUS)
  // ========================================================
  startWorkoutSession(challengeId, dayNumber = 1) {
    const challenge = HomeWorkoutStore.getChallengeById(challengeId);
    this.activeWorkout = challenge;
    this.activeExerciseIndex = 0;
    this.isPaused = false;

    const modal = document.getElementById('workoutRunnerModal');
    if (!modal) return;

    modal.classList.add('active');
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

    this.timerSeconds = exercise.durationSeconds || 30;

    const titleEl = document.getElementById('runnerExTitle');
    const subEl = document.getElementById('runnerExSub');
    const badgeEl = document.getElementById('runnerWorkoutBadge');
    const gifImg = document.getElementById('runnerGifImg');
    const emojiFallback = document.getElementById('runnerEmojiFallback');
    const targetBadge = document.getElementById('runnerTargetBadge');
    const equipBadge = document.getElementById('runnerEquipBadge');
    const instructionsBox = document.getElementById('runnerInstructionsBox');

    if (titleEl) titleEl.textContent = exercise.name;
    if (subEl) subEl.textContent = `${exercise.reps} • ${exercise.durationSeconds}s duration`;
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

      instructionsBox.innerHTML = `
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
      pauseBtn.textContent = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
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
    const isDaily = this.activeWorkout && this.activeWorkout.isDailyMuscleRoutine;
    const isSingle = this.activeWorkout && this.activeWorkout.isSingleExercise;

    if (isDaily) {
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
    this.renderWeeklyGoalCard();
    this.renderBodyFocus({ forceRefresh: true });

    const workoutTitle = result && result.log ? result.log.challengeTitle : (this.activeWorkout.title || 'WORKOUT');
    if (typeof TelemetryTracker !== 'undefined' && this.activeWorkout) {
      TelemetryTracker.trackWorkoutComplete(
        this.activeWorkout.id,
        workoutTitle,
        18,
        145,
        this.activeWorkout.exercises ? this.activeWorkout.exercises.length : 1
      );
    }

    if (isDaily) {
      const mName = this.activeWorkout.muscle.toUpperCase();
      alert(`🎉 ${mName} ROUTINE COMPLETED!\n\nAwesome work! All 5 exercises finished.\n• Logged: ${workoutTitle}\n• Weekly Goal Progress: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget}\n• Streak updated: ${result.user.streakCount} 🔥\n\n✨ Rotation Saved: Next time you do ${mName}, 5 fresh, unrepeated exercises will be recommended!`);
    } else {
      alert(`🎉 WORKOUT COMPLETED!\n\nAwesome work!\n• Logged: "${workoutTitle}"\n• Weekly Goal Progress: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget}\n• Streak updated: ${result.user.streakCount} 🔥`);
    }
  },

  closeWorkoutRunner() {
    if (confirm('Quit current workout session?')) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      const modal = document.getElementById('workoutRunnerModal');
      if (modal) modal.classList.remove('active');
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

    modal.classList.add('active');
  },

  closeLevelModal() {
    const modal = document.getElementById('levelModalBackdrop');
    if (modal) modal.classList.remove('active');
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

    modal.classList.add('active');
  },

  selectGoalTarget(target) {
    HomeWorkoutStore.updateWeeklyGoal(target);
    this.renderWeeklyGoalCard();
    this.closeGoalModal();
  },

  closeGoalModal() {
    const modal = document.getElementById('goalModalBackdrop');
    if (modal) modal.classList.remove('active');
  },

  // ========================================================
  // PRO MEMBERSHIP MODAL
  // ========================================================
  openProModal() {
    const modal = document.getElementById('proModalBackdrop');
    if (modal) modal.classList.add('active');
  },

  closeProModal() {
    const modal = document.getElementById('proModalBackdrop');
    if (modal) modal.classList.remove('active');
  },

  activatePro() {
    const user = HomeWorkoutStore.togglePro();
    this.renderHeader();
    this.closeProModal();
    alert(user.isPro ? '👑 PRO ACCESS ACTIVATED! All premium workouts and features are now unlocked.' : 'PRO deactivated.');
  },

  // ========================================================
  // ========================================================
  // NAVIGATION & TAB SWITCHING
  // ========================================================
  goToHome() {
    this.switchTab('training');
  },

  switchTab(tabId) {
    this.currentTab = tabId;

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
      this.renderWeeklyGoalCard();
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

    container.innerHTML = `
      <div style="text-align: center; padding: 28px; color: var(--text-muted); font-size: 0.85rem;">
        ⌛ Syncing timeline history...
      </div>
    `;

    const timeline = await HomeWorkoutStore.getTimelineHistory();
    const allLogs = timeline.all_logs || [];

    function renderLogCards(logsList) {
      if (!logsList || logsList.length === 0) return '';
      return logsList.map(l => {
        const timeStr = l.completedAt ? new Date(l.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const dateStr = l.completedAt ? new Date(l.completedAt).toLocaleDateString() : '';
        const exCount = l.exercises ? l.exercises.length : 0;
        return `
          <div class="timeline-card">
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
              <button class="timeline-accordion-btn" onclick="HomeWorkoutApp.toggleTimelineAccordion('${l.id}')">
                <span>▶ View ${exCount} Exercises</span>
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
        `;
      }).join('');
    }

    const hasAny = allLogs.length > 0;

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
          <button class="start-day-pill-btn" style="background: var(--brand-blue); color: #FFF; max-width: 200px; margin: 0 auto;" onclick="HomeWorkoutApp.goToHome()">
            Go to Workouts ➔
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
          <button onclick="HomeWorkoutApp.clearReportHistory()" style="background: #FEE2E2; color: #DC2626; border: none; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 9999px; cursor: pointer;">
            🗑️ Clear History
          </button>
        ` : ''}
      </div>

      ${historySectionsHtml}
    `;
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

  openAuthModal() {
    const user = HomeWorkoutStore.getUser();
    const token = HomeWorkoutStore.getToken();
    const modal = document.getElementById('authModalBackdrop');
    const loggedInView = document.getElementById('authLoggedInView');
    const formView = document.getElementById('authFormView');
    const usernameEl = document.getElementById('authLoggedInUsername');
    const avatarEl = document.getElementById('authAvatarLetter');

    if (token && user.username) {
      if (loggedInView) loggedInView.style.display = 'block';
      if (formView) formView.style.display = 'none';
      if (usernameEl) usernameEl.textContent = user.username;
      if (avatarEl) avatarEl.textContent = (user.username[0] || 'A').toUpperCase();
      const adminBtn = document.getElementById('authAdminPortalBtn');
      if (adminBtn) adminBtn.style.display = (user.is_admin || user.username === 'admin') ? 'block' : 'none';
    } else {
      if (loggedInView) loggedInView.style.display = 'none';
      if (formView) formView.style.display = 'block';
      const adminBtn = document.getElementById('authAdminPortalBtn');
      if (adminBtn) adminBtn.style.display = 'none';
      this.switchAuthMode('login');
    }

    if (modal) modal.classList.add('active');
  },

  closeAuthModal() {
    const modal = document.getElementById('authModalBackdrop');
    if (modal) modal.classList.remove('active');
  },

  switchAuthMode(mode) {
    this.authMode = mode;
    const loginBtn = document.getElementById('authTabLoginBtn');
    const regBtn = document.getElementById('authTabRegisterBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    if (loginBtn) loginBtn.classList.toggle('active', mode === 'login');
    if (regBtn) regBtn.classList.toggle('active', mode === 'register');
    if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  },

  async submitAuthForm() {
    const usernameInput = document.getElementById('authUsernameInput');
    const passwordInput = document.getElementById('authPasswordInput');
    const u = usernameInput ? usernameInput.value.trim() : '';
    const p = passwordInput ? passwordInput.value.trim() : '';

    if (!u || !p) {
      alert('Please enter both username and password.');
      return;
    }

    try {
      if (this.authMode === 'login') {
        await HomeWorkoutStore.login(u, p);
      } else {
        await HomeWorkoutStore.register(u, p, this.activeFocusLevel);
      }
      if (typeof TelemetryTracker !== 'undefined') {
        TelemetryTracker.trackAuth(this.authMode, u);
      }
      this.closeAuthModal();
      this.renderHeader();
      this.renderWeeklyGoalCard();
      this.renderBodyFocus();
      alert(`🎉 Welcome ${u}! Your workout sessions and streaks are now connected and syncing across your phone and gym.`);
    } catch (err) {
      alert(err.message || 'Authentication error.');
    }
  },

  async handle1TapGuestLogin() {
    try {
      const data = await HomeWorkoutStore.guestLogin();
      if (typeof TelemetryTracker !== 'undefined') {
        TelemetryTracker.trackAuth('guest_login', data.user.username);
      }
      this.closeAuthModal();
      this.renderHeader();
      this.renderWeeklyGoalCard();
      this.renderBodyFocus();
      alert(`⚡ 1-Tap Gym Session Connected as "${data.user.username}"! Ready to train.`);
    } catch (err) {
      alert('Could not start 1-tap gym session: ' + err.message);
    }
  },

  handleLogout() {
    const user = HomeWorkoutStore.getUser();
    if (confirm('Log out of this device?')) {
      if (typeof TelemetryTracker !== 'undefined' && user) {
        TelemetryTracker.trackAuth('logout', user.username);
      }
      HomeWorkoutStore.logout();
      this.closeAuthModal();
      this.renderHeader();
      this.renderWeeklyGoalCard();
      this.renderBodyFocus();
    }
  },

  renderSettingsScreen() {
    const user = HomeWorkoutStore.getUser();
    const container = document.getElementById('settingsScreenContent');
    if (!container) return;

    container.innerHTML = `
      <div style="background: #FFFFFF; border-radius: 18px; padding: 18px; box-shadow: var(--shadow-card); margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 14px;">
          <div>
            <h4 style="font-weight: 800; font-size: 1rem;">Fitness Level</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Current: ${user.fitnessLevel || 'Intermediate'}</span>
          </div>
          <button class="level-select-pill" onclick="HomeWorkoutApp.openLevelModal()">
            Change ▾
          </button>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 14px;">
          <div>
            <h4 style="font-weight: 800; font-size: 1rem;">PRO Subscription</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${user.isPro ? 'Active Member' : 'Free Plan'}</span>
          </div>
          <button class="pro-badge-btn" onclick="HomeWorkoutApp.openProModal()">
            ${user.isPro ? 'MANAGE' : 'UPGRADE ↗'}
          </button>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 14px;">
          <div>
            <h4 style="font-weight: 800; font-size: 1rem;">🛡️ Admin Command Center</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Real-time user monitoring & analytics</span>
          </div>
          <button class="level-select-pill" style="background: #0F172A; color: #38BDF8; border: 1px solid #38BDF8;" onclick="window.open('/admin.html', '_blank')">
            Portal ↗
          </button>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px;">
          <div>
            <h4 style="font-weight: 800; font-size: 1rem;">Reset All Progress</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Restore original 0/5 state</span>
          </div>
          <button class="fw-start-btn" style="background: #FEE2E2; color: #DC2626;" onclick="HomeWorkoutApp.resetData()">
            RESET
          </button>
        </div>
      </div>
    `;
  },

  resetData() {
    if (confirm('Reset your weekly goal count and streak back to 0/5?')) {
      HomeWorkoutStore.resetAllProgress();
      location.reload();
    }
  }
};

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
  HomeWorkoutApp.init();
});
