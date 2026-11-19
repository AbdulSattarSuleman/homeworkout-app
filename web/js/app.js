// Main Application Router & Controller for Cali Move Web
const App = {
  activeTab: 'home',
  scheduleCollapsed: false,

  init() {
    this.initTheme();
    WorkoutPlayer.init();
    this.bindNavigation();
    this.bindHeader();
    this.renderActiveTab();
    this.refreshHeaderStats();
  },

  initTheme() {
    const currentTheme = StorageManager.getTheme();
    document.documentElement.setAttribute('data-theme', currentTheme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
      themeBtn.title = currentTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }
  },

  toggleTheme() {
    const currentTheme = StorageManager.getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    StorageManager.setTheme(newTheme);
    
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
      themeBtn.title = newTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }
    this.showToast(newTheme === 'dark' ? 'Dark Theme Activated 🌙' : 'Light Theme Activated ☀️');
  },

  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });
  },

  bindHeader() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    const soundToggle = document.getElementById('soundToggleBtn');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        const settings = StorageManager.getSettings();
        settings.soundEnabled = !settings.soundEnabled;
        StorageManager.saveSettings(settings);
        soundToggle.textContent = settings.soundEnabled ? '🔊' : '🔇';
        this.showToast(settings.soundEnabled ? 'Workout Sound: ON' : 'Workout Sound: OFF');
      });
    }

    const brand = document.querySelector('.brand-section');
    if (brand) {
      brand.addEventListener('click', () => this.switchTab('home'));
    }
  },

  switchTab(tabId) {
    this.activeTab = tabId;
    
    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Render tab view
    this.renderActiveTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  refreshHeaderStats() {
    const profile = StorageManager.getProfile();
    const streakEl = document.getElementById('headerStreakCount');
    if (streakEl) {
      streakEl.textContent = `${profile.streakDays} Day Streak`;
    }

    const soundToggle = document.getElementById('soundToggleBtn');
    const settings = StorageManager.getSettings();
    if (soundToggle) {
      soundToggle.textContent = settings.soundEnabled ? '🔊' : '🔇';
    }

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
    }
  },

  refreshData() {
    this.refreshHeaderStats();
    this.renderActiveTab();
  },

  showToast(message) {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-msg';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  },

  renderActiveTab() {
    const container = document.getElementById('mainContentArea');
    if (!container) return;

    if (this.activeTab === 'home') {
      this.renderHomeTab(container);
    } else if (this.activeTab === 'programs') {
      this.renderProgramsTab(container);
    } else if (this.activeTab === 'exercises') {
      this.renderExercisesTab(container);
    } else if (this.activeTab === 'badges') {
      this.renderBadgesTab(container);
    } else if (this.activeTab === 'profile') {
      this.renderProfileTab(container);
    }
  },

  toggleScheduleCollapse() {
    this.scheduleCollapsed = !this.scheduleCollapsed;
    this.renderActiveTab();
  },

  setLevel(levelId) {
    StorageManager.setUserLevel(levelId);
    const label = levelId === 'intermediate' ? 'Level 2: Intermediate ★' : (levelId === 'beginner' ? 'Level 1: Beginner' : 'Level 3: Advanced');
    this.showToast(`${label} Activated! ⚡`);
    this.refreshData();
  },

  renderHomeTab(container) {
    const profile = StorageManager.getProfile();
    
    // Pick workout according to selected level
    let featuredWorkout;
    if (profile.userLevel === 'intermediate') {
      featuredWorkout = WORKOUTS_DATA.workouts.find(w => w.id === 'inter-push') || WORKOUTS_DATA.workouts[0];
    } else if (profile.userLevel === 'advanced') {
      featuredWorkout = WORKOUTS_DATA.workouts.find(w => w.id === 'adv-muscleup') || WORKOUTS_DATA.workouts[0];
    } else {
      featuredWorkout = WORKOUTS_DATA.workouts.find(w => w.id === 'basics-w1') || WORKOUTS_DATA.workouts[0];
    }

    container.innerHTML = `
      <!-- Top Schedule Section (From Reference Screenshot) -->
      <section class="schedule-section">
        <div class="schedule-header">
          <div class="dropdown-pill">
            Today <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
          </div>
          <button class="btn-secondary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="App.toggleScheduleCollapse()">
            ${this.scheduleCollapsed ? '⌄ Expand All' : '⌃ Collapse All'}
          </button>
        </div>

        <div class="schedule-list" style="display: ${this.scheduleCollapsed ? 'none' : 'block'};">
          <div class="schedule-item">
            <img class="schedule-thumb" src="assets/images/app_icon.png" alt="Breakfast">
            <div class="schedule-details">
              <h4 class="schedule-title">Don't be afraid to go bananas with breakfast!</h4>
              <span class="schedule-tag tag-green">Breakfast 09:30am today</span>
            </div>
          </div>

          <div class="schedule-item">
            <img class="schedule-thumb" src="assets/images/badges/2.0x/badge_early_bird.webp" alt="Lunch">
            <div class="schedule-details">
              <h4 class="schedule-title">Eating healthy is a piece of kale... I mean cake!</h4>
              <span class="schedule-tag tag-green">Lunch 12:30pm today</span>
            </div>
          </div>

          <div class="schedule-item" style="border-color: rgba(124, 58, 237, 0.4); background: var(--bg-card);">
            <img class="schedule-thumb" src="assets/images/badges/2.0x/badge_finished_workouts_amount_bronze_1.webp" alt="Workout">
            <div class="schedule-details">
              <h4 class="schedule-title">Legs don't skip day, and neither should you!</h4>
              <span class="schedule-tag tag-orange">GYM / Calisthenics 07:00pm today</span>
            </div>
            <button class="btn-primary" style="padding: 6px 14px; font-size: 0.75rem;" onclick="WorkoutPlayer.startWorkout('${featuredWorkout.id}')">
              START
            </button>
          </div>

          <div class="schedule-item">
            <img class="schedule-thumb" src="assets/images/badges/2.0x/badge_event_app_launch_anniversary.webp" alt="Dinner">
            <div class="schedule-details">
              <h4 class="schedule-title">Dinner: Don't be a couch potato, eat your veggies!</h4>
              <span class="schedule-tag tag-green">Dinner 09:00pm today</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Trackers Grid Widgets (From Reference Screenshot) -->
      <div class="trackers-title-bar">
        <h2 class="section-title" style="margin-bottom: 0;">Trackers</h2>
        <span class="section-subtitle">Real-Time Metrics</span>
      </div>

      <div class="trackers-grid">
        <!-- Calorie Tracker (Span Full) -->
        <div class="tracker-card span-full">
          <div class="progress-ring-container">
            <svg class="progress-ring-svg">
              <circle class="progress-ring-bg" stroke-width="5" fill="transparent" r="22" cx="28" cy="28"/>
              <circle class="progress-ring-bar" stroke="var(--color-primary)" stroke-width="5" stroke-dasharray="138" stroke-dashoffset="35" fill="transparent" r="22" cx="28" cy="28"/>
            </svg>
            <span class="progress-ring-icon" style="color: var(--color-primary);">☕</span>
          </div>
          <div class="tracker-info">
            <div class="tracker-val">eat upto 1500 Cal</div>
            <div class="tracker-lbl">⚓ Keeping track of calories helps you in eating right and clean food</div>
          </div>
          <button class="tracker-add-btn" onclick="App.showToast('+150 Cal Logged!')">+</button>
        </div>

        <!-- Weight Metric -->
        <div class="tracker-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div class="progress-ring-container">
              <svg class="progress-ring-svg">
                <circle class="progress-ring-bg" stroke-width="4" fill="transparent" r="22" cx="28" cy="28"/>
                <circle class="progress-ring-bar" stroke="var(--color-accent-blue)" stroke-width="4" stroke-dasharray="138" stroke-dashoffset="40" fill="transparent" r="22" cx="28" cy="28"/>
              </svg>
              <span class="progress-ring-icon" style="color: var(--color-accent-blue);">⚖️</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--color-accent-teal); font-weight: 700;">-1.6 kg</span>
          </div>
          <div style="margin-top: 10px;">
            <div class="tracker-val">76.8 kg</div>
            <div class="tracker-lbl">1.6 of 8 kg lost</div>
          </div>
        </div>

        <!-- Steps Metric -->
        <div class="tracker-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div class="progress-ring-container">
              <svg class="progress-ring-svg">
                <circle class="progress-ring-bg" stroke-width="4" fill="transparent" r="22" cx="28" cy="28"/>
                <circle class="progress-ring-bar" stroke="var(--color-accent-teal)" stroke-width="4" stroke-dasharray="138" stroke-dashoffset="60" fill="transparent" r="22" cx="28" cy="28"/>
              </svg>
              <span class="progress-ring-icon" style="color: var(--color-accent-teal);">👟</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--color-accent-teal); font-weight: 700;">40%</span>
          </div>
          <div style="margin-top: 10px;">
            <div class="tracker-val">405 of 10000</div>
            <div class="tracker-lbl">Steps Walked</div>
          </div>
        </div>
      </div>

      <!-- Level Selector Switcher Bar -->
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">TRAINING DIFFICULTY</span>
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--color-primary);">${profile.level}</span>
      </div>
      <div class="level-switcher-bar">
        <button class="level-pill-btn ${profile.userLevel === 'beginner' ? 'active' : ''}" onclick="App.setLevel('beginner')">
          Level 1: Beginner
        </button>
        <button class="level-pill-btn ${profile.userLevel === 'intermediate' ? 'active' : ''}" onclick="App.setLevel('intermediate')">
          Level 2: Intermediate ★
        </button>
        <button class="level-pill-btn ${profile.userLevel === 'advanced' ? 'active' : ''}" onclick="App.setLevel('advanced')">
          Level 3: Advanced
        </button>
      </div>

      <!-- Featured Workout For Selected Level -->
      <section class="hero-workout-card">
        <span class="hero-tag">${profile.userLevel.toUpperCase()} ROUTINE</span>
        <h1 class="hero-title">${featuredWorkout.title}</h1>
        <p class="hero-desc">${featuredWorkout.description}</p>
        
        <div class="hero-meta-grid">
          <div class="hero-meta-item">
            ⏱ <strong>${featuredWorkout.durationMin} mins</strong>
          </div>
          <div class="hero-meta-item">
            🔥 <strong>~${featuredWorkout.calories} kcal</strong>
          </div>
          <div class="hero-meta-item">
            💪 <strong>${featuredWorkout.exercises.length} Exercises</strong>
          </div>
          <div class="hero-meta-item">
            ⚡ <strong>${featuredWorkout.difficulty}</strong>
          </div>
        </div>

        <button class="btn-primary" id="startHeroWorkoutBtn">
          ▶ START THIS WORKOUT
        </button>
      </section>

      <!-- Quick Programs Overview -->
      <div class="section-header">
        <h2 class="section-title">TRAINING PROGRAMS</h2>
        <span class="section-subtitle">Progression Tracks</span>
      </div>

      <div class="cards-grid">
        ${WORKOUTS_DATA.programs.map(prog => `
          <div class="workout-card" onclick="App.openProgramCurriculum('${prog.id}')">
            <div>
              <div class="workout-card-badge" style="color: ${prog.themeColor};">${prog.badge} • ${prog.level}</div>
              <h3 class="workout-card-title">${prog.title}</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${prog.subtitle}</p>
            </div>
            <div>
              <div class="workout-card-meta">
                <span>📅 ${prog.weeks} Weeks</span>
                <span>⚡ ${prog.daysPerWeek} Days/Wk</span>
              </div>
              <button class="btn-secondary" style="width: 100%; margin-top: 12px; font-size: 0.8rem;" onclick="event.stopPropagation(); App.openProgramCurriculum('${prog.id}')">
                View ${prog.workouts.length} Routines ➔
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Technique Demos For Current Level -->
      <div class="section-header">
        <h2 class="section-title">LEVEL EXERCISES</h2>
        <span class="section-subtitle" style="cursor: pointer; color: var(--color-primary);" onclick="App.switchTab('exercises')">View All →</span>
      </div>

      <div class="cards-grid">
        ${featuredWorkout.exercises.map(ex => `
          <div class="exercise-item-card" onclick="WorkoutPlayer.startWorkout('${featuredWorkout.id}')">
            <div class="exercise-media-preview">
              <video src="${ex.video}" muted loop autoplay playsinline></video>
            </div>
            <div class="exercise-item-body">
              <h4 class="exercise-item-title">${ex.name}</h4>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">Tempo: ${ex.tempo}</p>
              <div class="exercise-item-tags">
                <span class="tag-chip">${ex.muscle}</span>
                <span class="tag-chip">${ex.targetReps}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('startHeroWorkoutBtn').addEventListener('click', () => {
      WorkoutPlayer.startWorkout(featuredWorkout.id);
    });
  },

  openProgramCurriculum(programId) {
    const prog = WORKOUTS_DATA.programs.find(p => p.id === programId) || WORKOUTS_DATA.programs[0];
    const programWorkouts = WORKOUTS_DATA.workouts.filter(w => prog.workouts.includes(w.id));

    const drawer = document.getElementById('programDrawer');
    const content = document.getElementById('programDrawerContent');
    if (!drawer || !content) return;

    content.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="hero-tag" style="background: ${prog.themeColor};">${prog.badge}</span>
          <h2 style="font-size: 1.4rem; font-weight: 800; margin-top: 6px;">${prog.title}</h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">${prog.subtitle}</p>
        </div>
        <button class="drawer-close-btn" onclick="App.closeProgramCurriculum()">✕</button>
      </div>

      <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">${prog.description}</p>

      <div class="section-header">
        <h3 class="section-title" style="font-size: 1.1rem;">CURRICULUM ROUTINES (${programWorkouts.length})</h3>
        <span class="section-subtitle">${prog.level}</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${programWorkouts.map(w => `
          <div class="curriculum-card">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
              <h4 style="font-size: 1.1rem; font-weight: 800;">${w.title}</h4>
              <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 700;">${w.durationMin} mins • ${w.difficulty}</span>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">${w.description}</p>

            <div style="margin-bottom: 14px;">
              <strong style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Exercises Included:</strong>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                ${w.exercises.map((e, idx) => `
                  <div style="display: flex; justify-content: space-between; font-size: 0.82rem; background: var(--bg-card); padding: 6px 10px; border-radius: var(--radius-sm);">
                    <span><strong>${idx + 1}.</strong> ${e.name}</span>
                    <span style="color: var(--text-muted);">${e.targetReps} (${e.targetSets} sets)</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <button class="btn-primary" style="width: 100%; padding: 10px;" onclick="App.closeProgramCurriculum(); WorkoutPlayer.startWorkout('${w.id}')">
              ▶ START THIS ROUTINE
            </button>
          </div>
        `).join('')}
      </div>
    `;

    drawer.classList.add('active');
  },

  closeProgramCurriculum() {
    const drawer = document.getElementById('programDrawer');
    if (drawer) drawer.classList.remove('active');
  },

  renderProgramsTab(container) {
    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">ALL PROGRAMS</h2>
        <span class="section-subtitle">Multi-Tier Calisthenics Tracks</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 18px;">
        ${WORKOUTS_DATA.programs.map(prog => {
          const pWorkouts = WORKOUTS_DATA.workouts.filter(w => prog.workouts.includes(w.id));
          return `
            <div class="hero-workout-card" style="margin-bottom: 0;">
              <span class="hero-tag" style="background: ${prog.themeColor};">${prog.badge}</span>
              <h3 class="hero-title" style="font-size: 1.4rem;">${prog.title}</h3>
              <p class="hero-desc" style="margin-bottom: 12px;">${prog.description}</p>
              
              <div class="hero-meta-grid" style="margin-bottom: 16px;">
                <div class="hero-meta-item">⏳ ${prog.weeks} Weeks Total</div>
                <div class="hero-meta-item">🎯 ${prog.daysPerWeek} Days/Week</div>
                <div class="hero-meta-item">📊 ${prog.level}</div>
              </div>

              <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div style="font-size: 0.78rem; font-weight: 700; color: #ffffff; margin-bottom: 6px; text-transform: uppercase;">
                  Included Routines (${pWorkouts.length}):
                </div>
                ${pWorkouts.map(w => `
                  <div style="font-size: 0.8rem; color: rgba(255,255,255,0.85); margin-bottom: 4px;">
                    • <strong>${w.title}</strong> (${w.exercises.length} exercises)
                  </div>
                `).join('')}
              </div>

              <button class="btn-primary" onclick="App.openProgramCurriculum('${prog.id}')">
                EXPLORE CURRICULUM & START ➔
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderExercisesTab(container) {
    const allExercises = [];
    WORKOUTS_DATA.workouts.forEach(w => {
      w.exercises.forEach(e => {
        if (!allExercises.some(item => item.id === e.id)) {
          allExercises.push(e);
        }
      });
    });

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">EXERCISE LIBRARY</h2>
        <span class="section-subtitle">Real Video Form Tutorials</span>
      </div>

      <div class="cards-grid">
        ${allExercises.map(ex => `
          <div class="exercise-item-card">
            <div class="exercise-media-preview">
              <video src="${ex.video}" muted loop autoplay playsinline></video>
            </div>
            <div class="exercise-item-body">
              <h4 class="exercise-item-title">${ex.name}</h4>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">Tempo: ${ex.tempo}</p>
              <div class="exercise-item-tags">
                <span class="tag-chip">${ex.muscle}</span>
                <span class="tag-chip">${ex.equipment}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderBadgesTab(container) {
    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">ACHIEVEMENT BADGES</h2>
        <span class="section-subtitle">Calisthenics Milestones</span>
      </div>

      <div class="badges-grid">
        ${WORKOUTS_DATA.badges.map(b => `
          <div class="badge-card ${b.unlocked ? 'unlocked' : 'locked'}">
            <img class="badge-icon-img" src="${b.icon}" alt="${b.title}" />
            <h4 class="badge-title">${b.title}</h4>
            <p class="badge-desc">${b.desc}</p>
            <span style="font-size: 0.65rem; color: ${b.unlocked ? '#27ae60' : 'var(--text-muted)'}; margin-top: 6px; font-weight: 700;">
              ${b.date}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderProfileTab(container) {
    const profile = StorageManager.getProfile();
    const history = StorageManager.getHistory();

    container.innerHTML = `
      <div class="hero-workout-card">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
          <img src="assets/images/app_icon.png" style="width: 64px; height: 64px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);" />
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800;">${profile.name}</h2>
            <p style="color: var(--color-primary); font-weight: 700; font-size: 0.9rem;">${profile.level}</p>
          </div>
        </div>

        <div class="hero-meta-grid">
          <div class="hero-meta-item">
            🔥 <strong>${profile.streakDays} Days</strong> Streak
          </div>
          <div class="hero-meta-item">
            🏋️ <strong>${profile.totalWorkouts}</strong> Workouts Logged
          </div>
          <div class="hero-meta-item">
            ⚡ <strong>${profile.caloriesBurned}</strong> kcal Burned
          </div>
        </div>
      </div>

      <div class="section-header">
        <h3 class="section-title">WORKOUT LOG HISTORY</h3>
        <span class="section-subtitle">${history.length} completed sessions</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${history.length > 0 ? history.map(h => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 14px 18px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="font-weight: 700; font-size: 1rem;">${h.title}</h4>
              <p style="font-size: 0.75rem; color: var(--text-muted);">${new Date(h.timestamp).toLocaleDateString()}</p>
            </div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-success);">
              +${h.calories} kcal
            </div>
          </div>
        `).join('') : `
          <p style="color: var(--text-muted); font-size: 0.9rem;">No workouts completed yet today. Start your first session!</p>
        `}
      </div>
    `;
  },

  openProgram(programId) {
    this.switchTab('programs');
  }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
