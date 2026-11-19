// Interactive Workout Session Runner & Audio/Video Engine
const WorkoutPlayer = {
  // State
  currentWorkout: null,
  currentExerciseIndex: 0,
  currentSetIndex: 1,
  totalSetsForCurrentExercise: 3,
  
  // Phase: 'PREP' | 'WORK' | 'REST' | 'COMPLETED'
  phase: 'PREP',
  timeRemaining: 3,
  isPaused: false,
  timerInterval: null,
  
  // Audio Objects
  audioWork: null,
  audioRest: null,
  audioContext: null,
  
  init() {
    this.initAudio();
    this.bindEvents();
  },

  initAudio() {
    try {
      this.audioWork = new Audio('assets/audio/countdown_to_work.aac');
      this.audioRest = new Audio('assets/audio/countdown_to_rest.aac');
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    } catch (e) {
      console.warn("Audio initialization notice:", e);
    }
  },

  playChime(type) {
    const settings = StorageManager.getSettings();
    if (!settings.soundEnabled) return;

    try {
      if (type === 'work' && this.audioWork) {
        this.audioWork.currentTime = 0;
        this.audioWork.play().catch(() => this.playSyntheticBeep(880, 0.25));
      } else if (type === 'rest' && this.audioRest) {
        this.audioRest.currentTime = 0;
        this.audioRest.play().catch(() => this.playSyntheticBeep(440, 0.35));
      } else {
        this.playSyntheticBeep(660, 0.15);
      }
    } catch (e) {
      this.playSyntheticBeep(520, 0.15);
    }
  },

  playSyntheticBeep(freq = 600, duration = 0.15) {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      // Audio not permitted or unavailable
    }
  },

  bindEvents() {
    const closeBtn = document.getElementById('closePlayerBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.confirmExit());

    const actionBtn = document.getElementById('playerActionBtn');
    if (actionBtn) actionBtn.addEventListener('click', () => this.handleMainAction());

    const skipBtn = document.getElementById('playerSkipBtn');
    if (skipBtn) skipBtn.addEventListener('click', () => this.skipPhase());

    const pauseBtn = document.getElementById('playerPauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());

    const speedBtn = document.getElementById('videoSpeedBtn');
    if (speedBtn) speedBtn.addEventListener('click', () => this.toggleVideoSpeed());

    const angleBtn = document.getElementById('videoAngleBtn');
    if (angleBtn) angleBtn.addEventListener('click', () => this.toggleVideoAngle());
  },

  startWorkout(workoutId) {
    const workout = WORKOUTS_DATA.workouts.find(w => w.id === workoutId) || WORKOUTS_DATA.workouts[0];
    this.currentWorkout = workout;
    this.currentExerciseIndex = 0;
    this.currentSetIndex = 1;
    this.isPaused = false;

    // Show modal
    const modal = document.getElementById('playerModal');
    if (modal) modal.classList.add('active');

    // Title
    const titleEl = document.getElementById('playerWorkoutTitle');
    if (titleEl) titleEl.textContent = workout.title;

    // Start with PREP phase
    this.startPrepPhase();
  },

  getCurrentExercise() {
    if (!this.currentWorkout || !this.currentWorkout.exercises) return null;
    return this.currentWorkout.exercises[this.currentExerciseIndex];
  },

  startPrepPhase() {
    this.phase = 'PREP';
    this.timeRemaining = 3;
    this.updateBanner('PREPARE', 'prep', `Exercise 1 of ${this.currentWorkout.exercises.length}`);
    this.updateUI();
    this.loadVideo();
    this.startTimer(() => this.startWorkPhase());
  },

  startWorkPhase() {
    this.phase = 'WORK';
    const exercise = this.getCurrentExercise();
    this.totalSetsForCurrentExercise = exercise.targetSets || 3;
    this.timeRemaining = exercise.workDuration || 45;

    this.playChime('work');
    this.updateBanner('WORK', 'work', `Set ${this.currentSetIndex} of ${this.totalSetsForCurrentExercise}`);
    this.updateUI();

    const video = document.getElementById('stageVideo');
    if (video) {
      video.play().catch(() => {});
    }

    this.startTimer(() => this.startRestPhase());
  },

  startRestPhase() {
    this.phase = 'REST';
    const exercise = this.getCurrentExercise();
    this.timeRemaining = exercise.restDuration || 60;

    this.playChime('rest');

    const isLastSet = this.currentSetIndex >= this.totalSetsForCurrentExercise;
    const nextText = isLastSet 
      ? (this.currentExerciseIndex < this.currentWorkout.exercises.length - 1 
          ? `Next: ${this.currentWorkout.exercises[this.currentExerciseIndex + 1].name}` 
          : 'Final Stretch!')
      : `Rest before Set ${this.currentSetIndex + 1}`;

    this.updateBanner('REST', 'rest', nextText);
    this.updateUI();

    this.startTimer(() => {
      if (isLastSet) {
        // Move to next exercise
        if (this.currentExerciseIndex < this.currentWorkout.exercises.length - 1) {
          this.currentExerciseIndex++;
          this.currentSetIndex = 1;
          this.startWorkPhase();
        } else {
          this.finishWorkout();
        }
      } else {
        // Next set of current exercise
        this.currentSetIndex++;
        this.startWorkPhase();
      }
    });
  },

  startTimer(onComplete) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.renderDigits();

    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;

      this.timeRemaining--;

      // Audio countdown on last 3 seconds
      if (this.timeRemaining <= 3 && this.timeRemaining > 0) {
        this.playSyntheticBeep(520, 0.08);
      }

      this.renderDigits();

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        if (onComplete) onComplete();
      }
    }, 1000);
  },

  renderDigits() {
    const digitsEl = document.getElementById('timerDigits');
    if (!digitsEl) return;

    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    digitsEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  updateBanner(label, typeClass, setInfo) {
    const banner = document.getElementById('phaseBanner');
    const labelEl = document.getElementById('phaseLabel');
    const infoEl = document.getElementById('phaseSetInfo');

    if (banner) {
      banner.className = `phase-banner ${typeClass}`;
    }
    if (labelEl) labelEl.textContent = label;
    if (infoEl) infoEl.textContent = setInfo;
  },

  updateUI() {
    const exercise = this.getCurrentExercise();
    if (!exercise) return;

    const nameEl = document.getElementById('playerExerciseName');
    const instrEl = document.getElementById('playerExerciseInstructions');
    const targetEl = document.getElementById('timerTargetInfo');
    const progPill = document.getElementById('playerProgressPill');
    const actionBtn = document.getElementById('playerActionBtn');
    const angleBtn = document.getElementById('videoAngleBtn');

    if (nameEl) nameEl.textContent = exercise.name;
    if (instrEl) instrEl.innerHTML = `<strong>Cues:</strong> ${exercise.cues.join(' • ')}`;
    if (targetEl) targetEl.textContent = `Target: ${exercise.targetReps} • Tempo: ${exercise.tempo}`;
    
    if (progPill) {
      progPill.textContent = `Ex ${this.currentExerciseIndex + 1}/${this.currentWorkout.exercises.length}`;
    }

    if (actionBtn) {
      if (this.phase === 'WORK') {
        actionBtn.textContent = 'DONE SET ✓';
      } else if (this.phase === 'REST') {
        actionBtn.textContent = 'SKIP REST ⏩';
      } else {
        actionBtn.textContent = 'READY';
      }
    }

    // Toggle Angle button visibility if alternate angle exists
    if (angleBtn) {
      angleBtn.style.display = exercise.alternateVideo ? 'inline-block' : 'none';
    }
  },

  loadVideo() {
    const exercise = this.getCurrentExercise();
    const video = document.getElementById('stageVideo');
    if (!exercise || !video) return;

    video.src = exercise.video;
    video.playbackRate = 1.0;
    video.loop = true;
    video.muted = true; // allow autoplay
    video.load();
    video.play().catch(() => {});
  },

  toggleVideoAngle() {
    const exercise = this.getCurrentExercise();
    const video = document.getElementById('stageVideo');
    const angleBtn = document.getElementById('videoAngleBtn');
    if (!exercise || !exercise.alternateVideo || !video) return;

    if (video.src.includes(exercise.alternateVideo)) {
      video.src = exercise.video;
      if (angleBtn) angleBtn.textContent = 'Angle: Side';
    } else {
      video.src = exercise.alternateVideo;
      if (angleBtn) angleBtn.textContent = 'Angle: Rear';
    }
    video.play().catch(() => {});
  },

  toggleVideoSpeed() {
    const video = document.getElementById('stageVideo');
    const speedBtn = document.getElementById('videoSpeedBtn');
    if (!video || !speedBtn) return;

    if (video.playbackRate === 1.0) {
      video.playbackRate = 0.75;
      speedBtn.textContent = '0.75x';
    } else if (video.playbackRate === 0.75) {
      video.playbackRate = 0.5;
      speedBtn.textContent = '0.5x (Slow)';
    } else {
      video.playbackRate = 1.0;
      speedBtn.textContent = '1.0x';
    }
  },

  handleMainAction() {
    if (this.phase === 'WORK') {
      // User tapped complete set
      this.startRestPhase();
    } else if (this.phase === 'REST') {
      this.skipPhase();
    } else if (this.phase === 'PREP') {
      this.startWorkPhase();
    }
  },

  skipPhase() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.phase === 'REST') {
      const isLastSet = this.currentSetIndex >= this.totalSetsForCurrentExercise;
      if (isLastSet) {
        if (this.currentExerciseIndex < this.currentWorkout.exercises.length - 1) {
          this.currentExerciseIndex++;
          this.currentSetIndex = 1;
          this.startWorkPhase();
        } else {
          this.finishWorkout();
        }
      } else {
        this.currentSetIndex++;
        this.startWorkPhase();
      }
    } else if (this.phase === 'WORK') {
      this.startRestPhase();
    }
  },

  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseBtn = document.getElementById('playerPauseBtn');
    const video = document.getElementById('stageVideo');

    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
    }

    if (video) {
      if (this.isPaused) video.pause();
      else video.play().catch(() => {});
    }
  },

  finishWorkout() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Save summary
    const summary = {
      title: this.currentWorkout.title,
      durationMin: this.currentWorkout.durationMin || 30,
      calories: this.currentWorkout.calories || 240,
      exercisesCount: this.currentWorkout.exercises.length
    };
    const updatedProfile = StorageManager.logCompletedWorkout(summary);

    // Close player
    const modal = document.getElementById('playerModal');
    if (modal) modal.classList.remove('active');

    // Show celebration modal
    this.showCelebration(summary, updatedProfile);
  },

  showCelebration(summary, profile) {
    const celebModal = document.getElementById('celebrationModal');
    const streakVal = document.getElementById('celebStreakVal');
    const caloriesVal = document.getElementById('celebCaloriesVal');

    if (streakVal && profile) streakVal.textContent = `${profile.streakDays} Days`;
    if (caloriesVal) caloriesVal.textContent = `${summary.calories} kcal`;

    if (celebModal) celebModal.classList.add('active');

    const okBtn = document.getElementById('closeCelebrationBtn');
    if (okBtn) {
      okBtn.onclick = () => {
        celebModal.classList.remove('active');
        if (window.App) window.App.refreshData();
      };
    }
  },

  confirmExit() {
    if (confirm("Quit current workout session? Your progress for this session will not be saved.")) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      const modal = document.getElementById('playerModal');
      if (modal) modal.classList.remove('active');
    }
  }
};
