# Plan 3B: Progress screen (charts, records, body weight)

## Goal

Since 3A, every plan workout saves the weight and reps of each set. 3B turns
that data into a **Progress** tab that shows people they are getting stronger:
a chart per exercise, a personal-records list, and body-weight tracking for the
"lose weight" and "gain weight" goals. Seeing progress is what keeps gym users
coming back.

## Where things are today

| What | Where |
|---|---|
| Progress tab (tab id `report`, title "Progress") | `HomeWorkoutApp.renderReportScreen()` in `web/js/homeworkout.js`, container `#reportScreenContent` in `web/index.html` |
| What it shows now | 3 summary numbers (workouts, streak, weekly goal) and the workout timeline grouped by date with "Manage / Select" delete |
| Saved workouts | `HomeWorkoutStore.getWorkoutLogs()` in `web/js/store.js` (newest first after sorting by `completedAt`) |
| Per-set data | each log's `exercises[]` (saved on this device) **or** `blocks[]` (downloaded from the cloud) items have `id`, `name`, `target`, `planSlot`, `equipment_tier`, `sets` (planned count, a number) and `loggedSets: [{ weight, reps, done }]`. Cardio uses `{ minutes, done }` or `{ rounds, seconds, done }` |
| Existing helpers to reuse | `getLastPerformance(exerciseId)`, `getExerciseBest1RM(exerciseId)` in `store.js`; `computePlanResults()` in `homeworkout.js` (Epley 1RM = `weight × (1 + reps / 30)`) |
| User's goal | `HomeWorkoutStore.getPlan().goal` (`lose_weight`, `build_muscle`, `gain_weight`, `get_stronger`, `stay_fit`) |
| Cloud | Supabase tables `profiles` and `workout_logs` with row-level security (`supabase/security.sql`). There is **no** body-weight table yet |

**Read both `log.exercises` and `log.blocks`** everywhere (like
`getLastPerformance` does). Only count sets with `done: true`. Skip cardio
(`planSlot === 'cardio'`) for weights, volume and records.

## Features to build (in this order)

### 1. History helpers (store.js, no UI yet)
- `getLoggedExercises()`: every exercise that has at least one done weighted or
  bodyweight set, with `{ id, name, target, sessions, lastDate }`, sorted by
  most recently trained.
- `getExerciseHistory(exerciseId)`: one entry per workout, oldest first:
  `{ date, sets: [{weight, reps}], topWeight, bestReps, best1RM, volume }`.
  For bodyweight exercises `topWeight` is null and progress is measured in reps.
- `getPersonalRecords()`: per exercise, the best set by estimated 1RM
  (`{ exerciseId, name, weight, reps, est1RM, date }`); bodyweight exercises use
  most reps in one set.

### 2. Progress tab layout (top to bottom)
1. **Summary row** (keep the existing 3 numbers) plus **"kg lifted this week"**.
2. **Body weight card** (feature 5): shown first for `lose_weight` and
   `gain_weight` plans, lower down for other goals.
3. **Exercise progress** (feature 3): list of logged exercises.
4. **Personal records** (feature 4).
5. **Workout history**: the existing timeline. When a workout is expanded, show
   its logged sets, e.g. "Barbell Bench Press: 40 kg × 10, 10, 9".
- Empty state for new users: "Finish your first workout to see your progress here."

### 3. Exercise progress chart
- Tapping an exercise opens a detail view (bottom sheet or full screen):
  - Line chart of **best estimated 1RM per workout** over time (reps for
    bodyweight exercises). X axis = dates, Y axis = kg (or reps).
  - Headline: "Up 6.5 kg since Nov 3" (or "+3 reps").
  - List of past sessions: date and sets ("27 Nov · 65 kg × 10, 10, 10, 10").
- Chart rules:
  - Inline **SVG**, no chart library. Must look right with 1, 2 and 50 points.
  - One clear line in the app's blue (`var(--brand-blue)`), dots on each
    workout, light grid lines, readable labels at 375 px wide.
  - Tapping a dot shows that workout's value and date.
  - The SVG needs an `aria-label` describing the trend (e.g. "Estimated max rose
    from 60 to 66.5 kg over 4 workouts").
  - With one point, show the dot and "Do this exercise again to see a trend".

### 4. Personal records list
- Top section: up to 5 most recent records, then "See all".
- Each row: exercise name, "65 kg × 10", estimated 1RM, date, 🏆.
- A record only counts when it beats an **earlier** best for that exercise
  (the first ever log of an exercise is not a record) — the same rule as the
  results screen.

### 5. Body weight tracking
- Card with: latest weight, change since first entry ("−2.4 kg since Nov 3"),
  a small line chart (same SVG chart component), and a "Log weight" button.
- "Log weight" opens a small sheet: kg input (`inputmode="decimal"`, 30–300 kg),
  date (defaults to today), Save. One entry per day (saving again the same day
  replaces it). Entries can be deleted from a list.
- Hint text: "Weigh yourself once a week, same day, first thing in the morning."
- For `lose_weight` a downward trend is shown in green; for `gain_weight` an
  upward trend is green.
- Storage:
  - Always save locally first: `localStorage` key `hw_body_weights`,
    `[{ id, date: 'YYYY-MM-DD', kg, updatedAt }]`.
  - Cloud: create **`supabase/body-weights.sql`** (do NOT run it) with a
    `body_weights` table (`id uuid default gen_random_uuid() primary key`,
    `user_id uuid references auth.users not null`, `measured_on date not null`,
    `weight_kg numeric(5,2) not null`, `created_at timestamptz default now()`,
    unique `(user_id, measured_on)`) and row-level security so users can only
    select / insert / update / delete their own rows.
  - Sync only when signed in (`HomeWorkoutStore.isSignedIn()`): upsert on save,
    delete on delete, download and merge on sign-in / page load.
  - If the table does not exist yet, keep working locally and stop trying for
    this visit after the first error (no request on every tap).
  - Log out must remove `hw_body_weights` from the device (like workout logs).

## Must keep working (regression checklist)

- Workout history list, expand, "Manage / Select" and delete still work.
- Today card, plan progress, weekly goal, streak and week strip unchanged.
- The workout player, rest timer, results screen and resume from 3A unchanged.
- Workouts logged before 3A (no `loggedSets`) don't break anything; they just
  don't appear in charts or records.
- Signed-out users can use everything locally.

## Rules for the implementation

- Work on a new git branch `progress-screen`. Do not push, merge or deploy.
- Plain JavaScript, no new libraries. Follow the existing CSS variables and
  styles in `web/css/homeworkout.css`.
- Read a whole function before changing it. `HomeWorkoutApp` and
  `HomeWorkoutStore` are big object literals: before finishing, check that **no
  method name is defined twice** (a later duplicate silently replaces the
  earlier one).
- Never put typed text into `innerHTML` without escaping (use the existing
  `HomeWorkoutApp.escapeHtml`).
- Don't change existing Supabase tables. Don't run any SQL against the live
  project and don't create accounts or write data there.
- Bump the `?v=` numbers in `web/index.html` for every changed CSS/JS file.
- Every new CSS class used in the HTML must exist in the stylesheet, and every
  new function must actually be called (wire it up, don't leave half-done
  features — in 3A the "resume" feature was written but never connected).
- Phone first: test at 375×812. Serve `web/` with
  `python -m http.server 8765 --directory web`; never run `server.py`.

## How to test (show evidence for each)

1. Clear `localStorage`. Create test data in the browser console: a plan, and
   about 8 past plan workouts over 4 weeks with `loggedSets` for 3–4 exercises
   (rising weights), plus one workout from before 3A without `loggedSets`.
2. Progress tab: summary numbers, exercise list sorted by last trained, and
   records are correct (check one by hand: Epley 1RM).
3. Open an exercise: chart shows the right number of points in date order;
   tap a dot; headline "Up X kg since …" is correct. Check 1-point and
   bodyweight (reps) exercises too.
4. Body weight: log 3 weights on different dates, change one, delete one; chart
   and "change since" update; reload keeps them; invalid input (0, 500, text) is
   rejected.
5. Lose-weight vs gain-weight plan: the body-weight card is shown first and the
   trend colour is right.
6. Cloud: replace `HomeWorkoutStore.initSupabase` with a fake client in the
   console (signed in) and confirm body-weight upsert/delete calls; make the
   fake return a "table not found" error and confirm the app keeps working with
   only one failed request.
7. Log out: body weights and workouts are removed from the device.
8. Regression checklist above. Browser console: no errors.

Finish with: what was built, the evidence for each test, anything not done or
not verified, the SQL file the owner must run, and the list of changed files.
