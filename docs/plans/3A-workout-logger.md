# Plan 3A: Workout logger (weight & reps per set)

## Goal

Turn the plan workout player into a real gym tracker. Today it shows
"4 sets × 8–12 · rest 75s" and a clock; users can't record what they lifted.
After 3A, a user logs every set, gets an automatic rest timer, sees what they
did last time, gets told when to add weight, can swap a busy machine, and
finishes on a results screen instead of a browser pop-up.

Scope: **plan workouts only** (`activeWorkout.isPlanWorkout === true`). Body
Focus routines and single-exercise previews keep the current player.

## Where things are today

| What | Where |
|---|---|
| Plan workout starts | `HomeWorkoutApp.startTodayWorkout()` in `web/js/homeworkout.js` |
| Player screen (HTML) | `#workoutRunnerModal` in `web/index.html` |
| Player logic | `loadCurrentExercise()`, `startTimer()`, `nextExercise()`, `prevExercise()`, `completeWorkoutSession()`, `closeWorkoutRunner()` in `homeworkout.js` |
| Exercise targets | each plan exercise has `planSets`, `planReps` (e.g. `"8–12"`), `planRest` (seconds), `planSlot`, `equipment_tier` (from `TrainingPlan.buildSession()` in `web/js/plan.js`) |
| Saving a finished plan workout | `HomeWorkoutStore.completePlanSession()` in `web/js/store.js` |
| Cloud upload | `logWorkoutSessionToCloud()` and `uploadLocalWorkouts()` in `store.js`; exercises go into the `workout_logs.blocks` JSON column (no schema change needed) |
| Cloud download | `syncFromCloud()` in `store.js` maps cloud rows to local logs (`blocks`) |
| Swap choices | `TrainingPlan.SLOTS[slotKey].gym / .home` lists in `plan.js` |

**Important:** saved workout logs already store `sets` as a **number** (the
planned set count) in `exercises[]` / `blocks[]`. Do **not** reuse `sets` for
the new per-set data. Use a new field: `loggedSets`.

## Data model

Each exercise inside a saved workout log gets:

```js
loggedSets: [
  { weight: 60, reps: 10, done: true },   // weight in kg; null for bodyweight
  { weight: 60, reps: 9,  done: true },
  { weight: 60, reps: 8,  done: true }
]
```

- Units: kg only for now.
- Bodyweight exercises (`equipment_tier === 'bodyweight'`): `weight: null`, reps only.
- Cardio finisher (`planSlot === 'cardio'`): no set rows, just a "Done" button
  (log `loggedSets: [{ minutes: 10, done: true }]` or similar).
- `loggedSets` must be included everywhere exercises are saved or uploaded:
  `completePlanSession()`, `uploadLocalWorkouts()` (blocks mapping),
  `logWorkoutSessionToCloud()`; and read back from `blocks` after `syncFromCloud()`.

## Features to build (in this order)

### 1. Set rows in the player
- For each plan exercise show one row per planned set:
  `Set 1   [ 60 ] kg  ×  [ 10 ] reps   [✓]`
- Big, thumb-friendly inputs (numeric keyboard: `inputmode="decimal"` for kg,
  `inputmode="numeric"` for reps) and a big ✓ button.
- Pre-fill weight and reps from **last time this exercise was done** (see 3).
  If never done: weight empty, reps = low end of `planReps`.
- "+ Add set" and a way to remove an extra set.
- Show "Last time: 60 kg × 10, 10, 9" under the exercise name.
- NEXT stays available; when all sets are ticked, highlight NEXT.

### 2. Rest timer
- Ticking ✓ starts a countdown of `planRest` seconds, shown big, with
  "−15s", "+15s" and "Skip" buttons.
- At 0: short beep (Web Audio API oscillator; the old .aac files were deleted)
  and `navigator.vibrate(…)` where supported.
- Create/resume the AudioContext on the first ✓ tap (iPhones only allow sound
  after a user tap).
- The main clock becomes "total workout time" (counts up, keeps running).
- Optional but valuable: keep the screen on during a workout with the Screen
  Wake Lock API (`navigator.wakeLock.request('screen')`) when supported;
  release it when the workout ends or is quit.

### 3. Last time + "add weight" suggestion
- Add `HomeWorkoutStore.getLastPerformance(exerciseId)`: scan saved logs newest
  first (look in both `log.exercises` and `log.blocks`) and return that
  exercise's `loggedSets` from the most recent workout that has them.
- Suggestion rule (progressive overload):
  - If **every** set last time reached the **top** of the rep range
    (e.g. 12 for "8–12"): suggest more weight.
    - Lower-body compound slots (`squat`, `leg_press`, `deadlift`, `hinge`, `lunge`): +5 kg barbell/machine
    - Other barbell / machine / cable: +2.5 kg
    - Dumbbell: +2 kg
    - Bodyweight: +1 rep per set
  - Otherwise: "Same weight, aim for one more rep."
- Pre-fill uses the suggested weight. Show it as a small hint, e.g.
  "💡 You hit 12, 12, 12 last time: try 62.5 kg".

### 4. Swap exercise ("Machine busy?")
- A "Swap" button in the player opens a short list: the other exercises in the
  same `TrainingPlan.SLOTS[planSlot]` list for the current location, plus up to
  3 dataset exercises with the same `movement_pattern` and allowed equipment.
- Choosing one replaces the exercise **for this workout only**, keeping
  `planSets`, `planReps`, `planRest`, `planSlot`.

### 5. Results screen (replaces the `alert()` for plan workouts)
- Full-screen or bottom-sheet summary:
  - Workout name, total time, exercises done, sets done
  - Total volume (sum of weight × reps)
  - New personal records (see below)
  - "Next up: Week X · Day Y: …"
  - A "Done" button
- After closing it, the existing "Save your progress" prompt logic still runs
  (`maybeShowSavePrompt()`).
- Personal record = a set whose estimated 1-rep max
  (`weight × (1 + reps / 30)`) beats every earlier logged set of that exercise.

### 6. Don't lose a workout in progress
- Save the in-progress workout (exercises, logged sets, current index, start
  time) to `localStorage` key `hw_active_workout` on every change.
- On app start, if it exists and is less than 12 hours old, show
  "Resume your workout?" with Resume / Discard.
- Clear it when the workout is completed or quit.

## Must keep working (regression checklist)

- Plan moves forward exactly one day per completed workout (`planSessionIndex`).
- Weekly goal, streak, week strip, coach message update after a workout.
- "Save your progress" prompt for people without an account.
- Workouts upload to Supabase once (no duplicates), including offline/late upload.
- Quitting a workout does not log it or move the plan.
- Body Focus routines and single-exercise previews still work as before.
- Progress tab history still shows old workouts (logs without `loggedSets`).

## Rules for the implementation

- Work on a new git branch `workout-logger`. Do not push, merge or deploy.
- Plain JavaScript, no new libraries. Follow the existing CSS variables and
  styles in `web/css/homeworkout.css`.
- Read a whole function before changing it. `HomeWorkoutApp` and
  `HomeWorkoutStore` are big object literals: before finishing, check there are
  **no method names defined twice** (a later duplicate silently replaces the
  earlier one; this already caused bugs in this project).
- Never put typed text (names, notes) into `innerHTML` without escaping.
- Don't change the Supabase database schema.
- Bump the `?v=` numbers in `web/index.html` for every changed CSS/JS file.
- Phone first: test at 375×812.

## How to test (show evidence for each)

1. Fresh visitor → set up a plan → start today's workout.
2. Log weight/reps for every set; check the rest timer starts, beeps at 0,
   and −15s / +15s / Skip work.
3. Swap one exercise; finish the workout; check the results screen numbers
   (volume = sum of weight × reps).
4. Start the next workout containing the same exercise: weights are pre-filled
   and "Last time" is shown. Repeat with all sets at the top of the range and
   check the "+2.5 kg" style suggestion and a new personal record.
5. Mid-workout, reload the page: "Resume your workout?" appears and restores
   the logged sets.
6. Quit a workout: nothing is logged and the plan day doesn't change.
7. Run through the regression checklist above.
8. Browser console: no errors.

Finish with: what was built, the evidence for each test, anything not done or
not verified, and the list of changed files.
