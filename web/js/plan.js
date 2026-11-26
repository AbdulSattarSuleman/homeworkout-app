// Goal-based training plan generator.
// Turns 4 onboarding answers (goal, location, level, days per week + session length)
// into a repeating weekly schedule of workouts built from well-known exercises.
const TrainingPlan = {
  GOALS: {
    lose_weight: {
      id: 'lose_weight', icon: '🔥', label: 'Lose weight', subtitle: 'Burn fat and get leaner',
      sets: 3, reps: '12–15', rest: 45, finisher: true, kcalPerMin: 8,
      tip: 'Keep rests short and move quickly between exercises. Finish with the cardio.'
    },
    build_muscle: {
      id: 'build_muscle', icon: '💪', label: 'Build muscle', subtitle: 'Look bigger and more defined',
      sets: 3, reps: '8–12', rest: 75, compoundSets: 4, kcalPerMin: 6,
      tip: 'Pick a weight where the last 2 reps of each set feel hard.'
    },
    gain_weight: {
      id: 'gain_weight', icon: '🍽️', label: 'Gain weight', subtitle: 'Add size and healthy weight',
      sets: 4, reps: '6–10', rest: 105, kcalPerMin: 6,
      tip: 'Lift heavy and eat more than you burn: 3 meals and 2 snacks with protein every day.'
    },
    get_stronger: {
      id: 'get_stronger', icon: '🏋️', label: 'Get stronger', subtitle: 'Lift heavier on the big lifts',
      sets: 3, reps: '8–10', rest: 90, mainSets: 5, mainReps: '3–5', mainRest: 150, mainCount: 2, kcalPerMin: 5,
      tip: 'The first 2 lifts are your main lifts: go heavy, rest fully, and keep perfect form.'
    },
    stay_fit: {
      id: 'stay_fit', icon: '⚡', label: 'Stay fit', subtitle: 'Daily workouts to stay active and healthy',
      sets: 3, reps: '10–12', rest: 60, kcalPerMin: 6,
      tip: 'Work at a steady pace. You should finish feeling energised, not exhausted.'
    }
  },

  LOCATIONS: {
    gym: { id: 'gym', icon: '🏋️', label: 'Gym', subtitle: 'Machines, barbells and dumbbells' },
    home: { id: 'home', icon: '🏠', label: 'Home', subtitle: 'Dumbbells, bands and bodyweight' },
    both: { id: 'both', icon: '🔁', label: 'Both', subtitle: 'Choose gym or home each day' }
  },

  LEVELS: {
    Beginner: { id: 'Beginner', icon: '🟢', label: 'Beginner', subtitle: 'New, or training for less than 6 months' },
    Intermediate: { id: 'Intermediate', icon: '🟡', label: 'Intermediate', subtitle: 'Training regularly for 6+ months' },
    Advanced: { id: 'Advanced', icon: '🔴', label: 'Advanced', subtitle: '2+ years of consistent training' }
  },

  DAY_OPTIONS: [2, 3, 4, 5, 6],
  MINUTE_OPTIONS: [30, 45, 60],
  EXERCISES_PER_SESSION: { 30: 4, 45: 5, 60: 6 },

  // Exercise choices for each part of a workout, by exercise id in data/exercises_database.json.
  // Lists are in order of preference; later entries are used for variety (every 4 weeks)
  // and when the same movement appears twice in a week.
  SLOTS: {
    chest_press: { label: 'Chest press', compound: true,
      gym: ['0025', '0289', '0047', '0314'], gymBeginner: ['0289', '2144', '0577'],
      home: ['0662', '0289', '0279'], homeBeginner: ['0493', '0659'] },
    incline_press: { label: 'Upper chest press', compound: true,
      gym: ['0314', '0047', '1299'], home: ['0279', '0314', '0662'], homeBeginner: ['0662', '0493'] },
    chest_fly: { label: 'Chest fly',
      gym: ['0596', '0155', '0308'], home: ['0308', '0319', '1254'] },
    shoulder_press: { label: 'Shoulder press', compound: true,
      gym: ['0405', '0091', '0603'], home: ['0426', '0405', '0997'], homeBeginner: ['0997', '0405'] },
    lateral_raise: { label: 'Side shoulders',
      gym: ['0334', '0178'], home: ['0334', '0977'] },
    rear_delt: { label: 'Rear shoulders',
      gym: ['0378', '0203'], home: ['0378', '1022'] },
    vertical_pull: { label: 'Back: pulldown', compound: true,
      gym: ['0150', '0652', '2616', '1326'], gymBeginner: ['0150', '0017', '2616'],
      home: ['0652', '1326', '1013'], homeBeginner: ['0974', '0970', '1013'] },
    row: { label: 'Back: row', compound: true,
      gym: ['0027', '0861', '0293', '1350'], gymBeginner: ['0861', '0180', '0293'],
      home: ['0293', '0499', '3144'], homeBeginner: ['3144', '3165', '0293'] },
    squat: { label: 'Squat', compound: true,
      gym: ['0043', '1463', '0042', '1760'], gymBeginner: ['1760', '1463'],
      home: ['1760', '0413', '1004'], homeBeginner: ['1004', '1760'] },
    leg_press: { label: 'Leg press', compound: true,
      gym: ['1463', '0743', '1760'], home: ['0431', '3769', '1760'] },
    deadlift: { label: 'Deadlift', compound: true,
      gym: ['0032', '0117', '0085'], gymBeginner: ['1459', '1409'],
      home: ['1459', '1009'], homeBeginner: ['3013', '1009'] },
    hinge: { label: 'Hamstrings & glutes', compound: true,
      gym: ['0085', '1459', '0032'], gymBeginner: ['1459', '1409'],
      home: ['1459', '1009', '3561'], homeBeginner: ['3013', '3561', '1009'] },
    lunge: { label: 'Lunge', compound: true,
      gym: ['0336', '0431', '0410', '0114'], gymBeginner: ['1460', '0431'],
      home: ['0336', '1460', '2368', '3470'], homeBeginner: ['1460', '3470'] },
    glutes: { label: 'Glutes',
      gym: ['1409', '3562'], home: ['3561', '3013'] },
    leg_ext: { label: 'Front thighs',
      gym: ['0585'], home: ['3007', '3769'] },
    leg_curl: { label: 'Back thighs',
      gym: ['0586', '0599'], home: ['0496', '1459'] },
    calves: { label: 'Calves',
      gym: ['0605', '0417', '1372'], home: ['0417', '1373'] },
    biceps: { label: 'Biceps',
      gym: ['0031', '0294', '0313', '0868'], home: ['0294', '0313', '0968'] },
    triceps: { label: 'Triceps',
      gym: ['0241', '0200', '0060', '2188'], home: ['2188', '0333', '0129', '1399'] },
    core: { label: 'Core',
      gym: ['0175', '0472', '0276', '0687'], gymBeginner: ['0276', '0274', '0175'],
      home: ['0276', '0274', '0687'], homeBeginner: ['0274', '0276'] },
    cardio: { label: 'Cardio finisher', cardio: true,
      gym: ['3666', '2138', '2141', '2311'],
      home: ['0630', '0685', '3361'], homeBeginner: ['3636', '3672', '0685'] }
  },

  // "slot:2" means "use the 3rd choice for this slot" so repeated movements get a different exercise.
  DAY_TEMPLATES: {
    full_a: { name: 'Full Body A', focus: 'Legs, chest & back',
      slots: ['squat', 'chest_press', 'row', 'shoulder_press', 'leg_curl', 'triceps', 'core'] },
    full_b: { name: 'Full Body B', focus: 'Hips, back & shoulders',
      slots: ['deadlift', 'vertical_pull', 'incline_press', 'lunge', 'lateral_raise', 'biceps', 'core:1'] },
    full_c: { name: 'Full Body C', focus: 'Legs, chest & arms',
      slots: ['leg_press', 'chest_press:1', 'row:1', 'rear_delt', 'calves', 'biceps:1', 'core:2'] },
    upper_a: { name: 'Upper Body A', focus: 'Chest, back & shoulders',
      slots: ['chest_press', 'row', 'shoulder_press', 'vertical_pull', 'biceps', 'triceps', 'lateral_raise'] },
    lower_a: { name: 'Lower Body A', focus: 'Quads, glutes & hamstrings',
      slots: ['squat', 'hinge', 'lunge', 'leg_curl', 'calves', 'core', 'leg_ext'] },
    upper_b: { name: 'Upper Body B', focus: 'Back, chest & arms',
      slots: ['vertical_pull', 'incline_press', 'row:1', 'lateral_raise', 'chest_fly', 'triceps:1', 'biceps:1'] },
    lower_b: { name: 'Lower Body B', focus: 'Hips, glutes & quads',
      slots: ['deadlift', 'leg_press', 'lunge:1', 'leg_ext', 'calves:1', 'core:1', 'glutes'] },
    push: { name: 'Push Day', focus: 'Chest, shoulders & triceps',
      slots: ['chest_press', 'shoulder_press', 'incline_press', 'lateral_raise', 'triceps', 'chest_fly', 'triceps:1'] },
    pull: { name: 'Pull Day', focus: 'Back, rear shoulders & biceps',
      slots: ['vertical_pull', 'row', 'row:1', 'rear_delt', 'biceps', 'biceps:2', 'core'] },
    legs: { name: 'Leg Day', focus: 'Quads, glutes, hamstrings & calves',
      slots: ['squat', 'hinge', 'leg_press', 'leg_curl', 'calves', 'lunge', 'core'] }
  },

  ISOLATION_REPS: { core: '10–15', calves: '12–15', cardio: null },

  // ---------------------------------------------------------------------------
  // Schedule
  // ---------------------------------------------------------------------------
  getSchedule(goal, daysPerWeek) {
    const days = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
    const full = ['full_a', 'full_b', 'full_c'];
    if (goal === 'stay_fit' || days <= 3) {
      return Array.from({ length: days }, (_, i) => full[i % full.length]);
    }
    if (days === 4) return ['upper_a', 'lower_a', 'upper_b', 'lower_b'];
    if (days === 5) return ['push', 'pull', 'legs', 'upper_a', 'lower_b'];
    return ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
  },

  getSplitName(goal, daysPerWeek) {
    const schedule = this.getSchedule(goal, daysPerWeek);
    if (schedule[0].startsWith('full')) return 'Full body';
    if (schedule[0] === 'upper_a') return 'Upper / lower';
    return 'Push / pull / legs';
  },

  getWeekOverview(plan) {
    return this.getSchedule(plan.goal, plan.daysPerWeek).map((key, i) => ({
      dayNumber: i + 1,
      key,
      name: this.DAY_TEMPLATES[key].name,
      focus: this.DAY_TEMPLATES[key].focus
    }));
  },

  getPosition(plan, sessionIndex = null) {
    const days = this.getSchedule(plan.goal, plan.daysPerWeek).length;
    const index = sessionIndex === null ? (Number(plan.completedSessions) || 0) : sessionIndex;
    return {
      sessionIndex: index,
      week: Math.floor(index / days) + 1,
      dayIndex: index % days,
      dayNumber: (index % days) + 1,
      totalDays: days
    };
  },

  // ---------------------------------------------------------------------------
  // Exercise lookup
  // ---------------------------------------------------------------------------
  _index: null,
  _indexSize: 0,

  lookup(id) {
    const all = (typeof ExerciseDataset !== 'undefined' && ExerciseDataset.allExercises) || [];
    if (!this._index || this._indexSize !== all.length) {
      this._index = new Map(all.map(ex => [String(ex.id), ex]));
      this._indexSize = all.length;
    }
    return this._index.get(String(id)) || null;
  },

  isReady() {
    return typeof ExerciseDataset !== 'undefined' && Array.isArray(ExerciseDataset.allExercises) && ExerciseDataset.allExercises.length > 0;
  },

  cleanName(name) {
    return String(name || '')
      .replace(/\s*\((Male|Female|Side Pov|Back Pov)\)/gi, '')
      .replace(/\s+V\.\s*\d+$/i, '')
      .trim();
  },

  pickExercise(slotKey, location, level, variant, usedIds) {
    const slot = this.SLOTS[slotKey];
    if (!slot) return null;
    const base = slot[location] || slot.gym;
    const list = (level === 'Beginner' && slot[location + 'Beginner']) || base;
    for (let i = 0; i < list.length; i++) {
      const id = list[(variant + i) % list.length];
      if (usedIds.has(id)) continue;
      const ex = this.lookup(id);
      if (ex) return ex;
    }
    return null;
  },

  prescribe(goalId, level, slotKey, position, location) {
    const goal = this.GOALS[goalId] || this.GOALS.stay_fit;
    const slot = this.SLOTS[slotKey] || {};

    if (slot.cardio) {
      return location === 'gym'
        ? { sets: 1, reps: '10 min', rest: 0 }
        : { sets: 3, reps: '40 sec', rest: 20 };
    }

    let sets = goal.sets;
    let reps = this.ISOLATION_REPS[slotKey] || goal.reps;
    let rest = goal.rest;

    if (goal.mainCount && position < goal.mainCount && slot.compound) {
      sets = goal.mainSets;
      reps = goal.mainReps;
      rest = goal.mainRest;
    } else if (goal.compoundSets && position < 2 && slot.compound) {
      sets = goal.compoundSets;
    }

    if (slotKey === 'core' || slotKey === 'calves') rest = Math.min(rest, 60);
    if (level === 'Beginner') sets = Math.max(2, sets - 1);
    if (level === 'Advanced' && position < 2) sets = Math.min(5, sets + 1);

    return { sets, reps, rest };
  },

  // ---------------------------------------------------------------------------
  // Build one workout session
  // ---------------------------------------------------------------------------
  buildSession(plan, { sessionIndex = null, location = null } = {}) {
    if (!plan) return null;
    const pos = this.getPosition(plan, sessionIndex);
    const schedule = this.getSchedule(plan.goal, plan.daysPerWeek);
    const templateKey = schedule[pos.dayIndex];
    const template = this.DAY_TEMPLATES[templateKey];
    const goal = this.GOALS[plan.goal] || this.GOALS.stay_fit;
    const loc = location || (plan.location === 'both' ? (plan.todayLocation || 'gym') : plan.location) || 'gym';

    // Same template twice in a week (e.g. 6-day push/pull/legs) -> use different exercises
    const repeatOffset = schedule.slice(0, pos.dayIndex).filter(k => k === templateKey).length;
    // New exercise choices every 4 weeks for variety; same exercises within a block so you can add weight
    const blockOffset = Math.floor((pos.week - 1) / 4);

    const count = this.EXERCISES_PER_SESSION[plan.minutes] || 5;
    let slotSpecs = template.slots.slice(0, count);
    if (goal.finisher) slotSpecs = slotSpecs.slice(0, count - 1).concat(['cardio']);

    const usedIds = new Set();
    const exercises = [];
    let loading = false;

    slotSpecs.forEach((spec, position) => {
      const [slotKey, variantStr] = spec.split(':');
      const variant = (Number(variantStr) || 0) + repeatOffset + blockOffset;
      const ex = this.pickExercise(slotKey, loc, plan.level, variant, usedIds);
      if (!ex) {
        loading = true;
        return;
      }
      usedIds.add(String(ex.id));
      const rx = this.prescribe(plan.goal, plan.level, slotKey, position, loc);
      exercises.push({
        ...ex,
        name: this.cleanName(ex.name),
        planSlot: slotKey,
        planLabel: this.SLOTS[slotKey].label,
        planSets: rx.sets,
        planReps: rx.reps,
        planRest: rx.rest,
        reps: rx.reps
      });
    });

    // Rough session length: ~45s per set plus rests, plus 1 min to set up each exercise
    const seconds = exercises.reduce((sum, ex) => sum + ex.planSets * (45 + ex.planRest) + 60, 0);
    const estMinutes = Math.max(10, Math.round(seconds / 60 / 5) * 5);

    return {
      ...pos,
      templateKey,
      name: template.name,
      focus: template.focus,
      goal: goal.id,
      goalLabel: goal.label,
      goalIcon: goal.icon,
      tip: goal.tip,
      location: loc,
      exercises,
      estMinutes,
      loading: loading || !this.isReady()
    };
  }
};

if (typeof window !== 'undefined') {
  window.TrainingPlan = TrainingPlan;
}
