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

  // Active Workout Player State
  activeWorkout: null,
  activeExerciseIndex: 0,
  timerSeconds: 30,
  timerInterval: null,
  isPaused: false,

  init() {
    this.activeFocusLevel = HomeWorkoutStore.getUserLevel();
    this.renderHeader();
    this.renderWeeklyGoalCard();
    this.renderChallengeCarousel();
    this.renderBodyFocus();
    this.bindEvents();
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

    const levelBtn = document.getElementById('headerLevelBtn');
    if (levelBtn) {
      const lvl = user.fitnessLevel || 'Intermediate';
      const icon = lvl === 'Beginner' ? '🟢' : (lvl === 'Advanced' ? '🔴' : '🟡');
      levelBtn.innerHTML = `${icon} ${lvl} ▾`;
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

  renderBodyFocus() {
    const locRow = document.getElementById('bodyFocusLocationRow');
    const lvlRow = document.getElementById('bodyFocusLevelRow');
    const chipsRow = document.getElementById('categoryChipsRow');
    const workoutsList = document.getElementById('focusWorkoutsList');
    if (!workoutsList) return;

    // Update location toggle buttons active state
    if (locRow) {
      locRow.querySelectorAll('.loc-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-loc') === this.activeFocusLocation);
      });
    }

    // Update level toggle buttons active state
    if (lvlRow) {
      lvlRow.querySelectorAll('.level-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lvl') === this.activeFocusLevel);
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

    // Query recommended 5-exercise daily routine with smart non-repeating rotation
    const routineData = HomeWorkoutStore.getRecommendedDailyRoutine({
      muscle: this.activeBodyFocus,
      location: this.activeFocusLocation,
      level: this.activeFocusLevel,
      forceShuffle: false,
      count: 5
    });
    this.currentDailyRoutine = routineData;

    const exercises = routineData.exercises || [];
    
    if (!exercises || exercises.length === 0) {
      workoutsList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted);">
          <p style="font-weight: 700;">No exercises found for this level and environment</p>
          <button class="fw-start-btn" style="margin-top: 8px;" onclick="HomeWorkoutApp.switchFocusLocation('All'); HomeWorkoutApp.switchFocusLevel('All');">Show All Exercises</button>
        </div>
      `;
      return;
    }

    const locLabel = this.activeFocusLocation === 'All' ? 'Home & Gym' : (this.activeFocusLocation === 'Home' ? '🏠 Home (No Gear)' : '🏋️ Gym');
    const muscleName = this.activeBodyFocus.toUpperCase();
    const isRotated = routineData.isRotated;
    const routineBadgeText = isRotated 
      ? `✨ Fresh Routine Active (Unrepeated from last session)` 
      : `🎯 Personalized ${this.activeFocusLevel} Routine`;

    const bannerHtml = `
      <div class="routine-header-banner">
        <div class="routine-top-row">
          <div class="routine-title-box">
            <span class="routine-sub-badge ${isRotated ? 'routine-badge-rotated' : ''}">${routineBadgeText}</span>
            <h3 class="routine-main-title">Today's ${muscleName} Routine (${exercises.length} Exercises)</h3>
          </div>
          <button class="routine-shuffle-btn" onclick="HomeWorkoutApp.shuffleRoutine()" title="Get 5 different unrepeated exercises">
            🔀 Shuffle New 5
          </button>
        </div>
        <p class="routine-desc-text">
          Level: <strong>${this.activeFocusLevel}</strong> • ${locLabel}. When you complete this session, 5 new exercises will be rotated next week!
        </p>
        <button class="routine-primary-start-btn" onclick="HomeWorkoutApp.startFullDailyRoutine()">
          ▶ START TODAY'S ${exercises.length} EXERCISES (DAY 1) ➔
        </button>
      </div>
    `;

    const cardsHtml = exercises.map((ex, idx) => {
      const lvl = ex.level || 'Intermediate';
      const lvlClass = lvl.toLowerCase();
      const lvlIcon = lvl === 'Beginner' ? '🟢' : (lvl === 'Advanced' ? '🔴' : '🟡');
      return `
        <div class="focus-workout-card" onclick="HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
          <div class="fw-left-wrap">
            <img class="fw-thumb-img" src="${ex.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'54\\' height=\\'54\\' viewBox=\\'0 0 54 54\\'><rect width=\\'54\\' height=\\'54\\' rx=\\'10\\' fill=\\'%23F3F4F6\\'/><text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'22\\'>💪</text></svg>'">
            <div class="fw-info-wrap">
              <h4 class="fw-title">${idx + 1}. ${ex.name}</h4>
              <div class="fw-meta">
                <span class="level-tag ${lvlClass}">${lvlIcon} ${lvl}</span>
                <span>•</span>
                <span>${ex.reps || '12-15 reps'}</span>
                <span>•</span>
                <span>🎯 ${ex.target || ex.muscle}</span>
                <span>•</span>
                <span style="color: ${ex.location === 'Home' ? '#10B981' : '#0052FF'}; font-weight: 700;">${ex.location === 'Home' ? '🏠 Home' : '🏋️ Gym'}</span>
              </div>
            </div>
          </div>
          <button class="fw-start-btn" onclick="event.stopPropagation(); HomeWorkoutApp.startSingleExerciseRunner('${ex.id}')">
            START ➔
          </button>
        </div>
      `;
    }).join('');

    workoutsList.innerHTML = bannerHtml + cardsHtml;
  },

  switchFocusLocation(loc) {
    this.activeFocusLocation = loc;
    this.renderBodyFocus();
  },

  switchFocusLevel(lvl) {
    this.activeFocusLevel = lvl;
    this.renderBodyFocus();
  },

  switchBodyFocus(catId) {
    this.activeBodyFocus = catId;
    this.renderBodyFocus();
  },

  shuffleRoutine() {
    const routineData = HomeWorkoutStore.getRecommendedDailyRoutine({
      muscle: this.activeBodyFocus,
      location: this.activeFocusLocation,
      level: this.activeFocusLevel,
      forceShuffle: true,
      count: 5
    });
    this.currentDailyRoutine = routineData;
    this.renderBodyFocus();
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
    this.activeChallengeFilter = category;

    const dashView = document.getElementById('dashboardScreen');
    const dirView = document.getElementById('directoryScreen');
    if (dashView && dirView) {
      dashView.classList.remove('active');
      dirView.classList.add('active');
    }

    this.switchDirectoryMode('challenges');
    this.renderDirectoryFilters();
    this.renderDirectoryCards(searchQuery);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openExerciseExplorer(muscle = 'All', location = 'All') {
    this.currentScreen = 'directory';
    if (muscle) this.explorerMuscle = muscle;
    if (location) this.explorerLocation = location;

    const dashView = document.getElementById('dashboardScreen');
    const dirView = document.getElementById('directoryScreen');
    if (dashView && dirView) {
      dashView.classList.remove('active');
      dirView.classList.add('active');
    }

    this.switchDirectoryMode('library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      locRow.querySelectorAll('.loc-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-loc') === this.explorerLocation);
      });
    }

    // 2. Update level buttons
    const lvlRow = document.getElementById('explorerLevelRow');
    if (lvlRow) {
      lvlRow.querySelectorAll('.level-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lvl') === this.explorerLevel);
      });
    }

    // 3. Render Muscle Pills
    const pillsRow = document.getElementById('explorerMusclePills');
    if (pillsRow) {
      const muscles = [
        { id: 'All', name: 'All Muscles' },
        { id: 'Chest', name: '🫁 Chest' },
        { id: 'Warmup', name: '🔥 Warmup & Mobility' },
        { id: 'Abs & Core', name: '🍫 Abs & Core' },
        { id: 'Arms', name: '🦾 Arms' },
        { id: 'Legs', name: '🦵 Legs' },
        { id: 'Shoulders', name: '🛡️ Shoulders' },
        { id: 'Back', name: '🧗 Back' }
      ];

      pillsRow.innerHTML = muscles.map(m => `
        <button class="filter-pill-btn ${this.explorerMuscle === m.id ? 'active' : ''}" onclick="HomeWorkoutApp.filterExplorerMuscle('${m.id}')">
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
      const locText = this.explorerLocation === 'All' ? 'All Environments' : (this.explorerLocation === 'Home' ? '🏠 Home' : '🏋️ Gym');
      const lvlText = this.explorerLevel === 'All' ? 'All Levels' : `${this.explorerLevel}`;
      countEl.textContent = `Found ${exercises.length} Exercises • ${this.explorerMuscle} • ${lvlText} (${locText})`;
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
    this.currentScreen = 'dashboard';
    const dashView = document.getElementById('dashboardScreen');
    const dirView = document.getElementById('directoryScreen');
    if (dashView && dirView) {
      dirView.classList.remove('active');
      dashView.classList.add('active');
    }
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

    this.activeWorkout = {
      id: `ex-${found.id}`,
      title: found.name.toUpperCase(),
      currentDay: 1,
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

    if (isDaily) {
      const exerciseIds = this.activeWorkout.exercises.map(e => e.id);
      result = HomeWorkoutStore.logMuscleSessionCompleted(this.activeWorkout.muscle, exerciseIds);
    } else {
      result = HomeWorkoutStore.logWorkoutCompletion(this.activeWorkout.id, 1);
    }

    const modal = document.getElementById('workoutRunnerModal');
    if (modal) modal.classList.remove('active');

    // Refresh all UI states
    this.renderHeader();
    this.renderWeeklyGoalCard();
    this.renderBodyFocus();

    if (isDaily) {
      const mName = this.activeWorkout.muscle.toUpperCase();
      alert(`🎉 ${mName} WORKOUT COMPLETED!\n\nAwesome work! All 5 exercises finished.\n• Weekly Goal Progress: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget}\n• Streak updated: ${result.user.streakCount} 🔥\n\n✨ Rotation Saved: Next time you do ${mName}, 5 fresh, unrepeated exercises will be recommended!`);
    } else {
      alert(`🎉 WORKOUT COMPLETED!\n\nAwesome work! Day 1 is logged.\n• Weekly Goal Progress: ${result.user.weeklyCompletedCount}/${result.user.weeklyGoalTarget}\n• Streak updated: ${result.user.streakCount} 🔥`);
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
    this.renderBodyFocus();
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
  // BOTTOM TAB NAVIGATION
  // ========================================================
  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.hw-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    if (tabId === 'training') {
      this.closeDirectory();
    } else if (tabId === 'discover') {
      this.openExerciseExplorer();
    } else if (tabId === 'report') {
      this.renderReportScreen();
    } else if (tabId === 'settings') {
      this.renderSettingsScreen();
    }
  },

  renderReportScreen() {
    const user = HomeWorkoutStore.getUser();
    const logs = HomeWorkoutStore.getWorkoutLogs();

    const dashView = document.getElementById('dashboardScreen');
    if (dashView) {
      dashView.classList.add('active');
      dashView.innerHTML = `
        <div style="padding: 18px 0;">
          <h2 class="section-bold-title" style="margin-bottom: 16px;">Workout Report</h2>
          <div style="background: #FFFFFF; border-radius: 18px; padding: 20px; box-shadow: var(--shadow-card); margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
              <div>
                <span style="font-size: 0.78rem; color: var(--text-muted);">WORKOUTS</span>
                <div style="font-size: 1.6rem; font-weight: 800; color: var(--brand-blue);">${logs.length}</div>
              </div>
              <div>
                <span style="font-size: 0.78rem; color: var(--text-muted);">STREAK</span>
                <div style="font-size: 1.6rem; font-weight: 800; color: var(--accent-flame);">${user.streakCount} Days</div>
              </div>
              <div>
                <span style="font-size: 0.78rem; color: var(--text-muted);">WEEKLY GOAL</span>
                <div style="font-size: 1.6rem; font-weight: 800; color: var(--brand-blue);">${user.weeklyCompletedCount}/${user.weeklyGoalTarget}</div>
              </div>
            </div>
          </div>

          <h3 class="section-bold-title" style="font-size: 1.05rem; margin-bottom: 12px;">History</h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${logs.length > 0 ? logs.map(l => `
              <div style="background: #FFFFFF; border-radius: 14px; padding: 14px 16px; box-shadow: var(--shadow-card); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h4 style="font-weight: 800; font-size: 0.95rem;">${l.challengeTitle}</h4>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Day ${l.dayNumber} • ${new Date(l.completedAt).toLocaleDateString()}</span>
                </div>
                <span style="font-size: 0.85rem; font-weight: 800; color: #10B981;">✓ Done</span>
              </div>
            `).join('') : `
              <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <p>No workouts completed yet. Start your first session today!</p>
              </div>
            `}
          </div>
        </div>
      `;
    }
  },

  renderSettingsScreen() {
    const user = HomeWorkoutStore.getUser();
    const dashView = document.getElementById('dashboardScreen');
    if (dashView) {
      dashView.classList.add('active');
      dashView.innerHTML = `
        <div style="padding: 18px 0;">
          <h2 class="section-bold-title" style="margin-bottom: 16px;">Settings</h2>
          <div style="background: #FFFFFF; border-radius: 18px; padding: 18px; box-shadow: var(--shadow-card); margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-divider); padding-bottom: 12px;">
              <div>
                <h4 style="font-weight: 800; font-size: 1rem;">PRO Subscription</h4>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${user.isPro ? 'Active Member' : 'Free Plan'}</span>
              </div>
              <button class="pro-badge-btn" onclick="HomeWorkoutApp.openProModal()">
                ${user.isPro ? 'MANAGE' : 'UPGRADE ↗'}
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
        </div>
      `;
    }
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
