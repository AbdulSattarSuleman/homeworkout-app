# Home Workout app: project status

Last updated: 2026-11-27

**For Claude, Antigravity or any AI helper:** read this file first. It says what is
already done, how we work, and what comes next. Keep it up to date when a phase finishes.

## What this app is

A simple gym / home-workout web app. The user picks a goal and gets a plan, logs
workouts, sees progress, and can install it on the phone.

- Live site: https://abdulsattarsuleman.github.io/homeworkout-app/
- GitHub: https://github.com/AbdulSattarSuleman/homeworkout-app
- Deploy: every push to `master` publishes the `web/` folder to GitHub Pages
  (GitHub Actions workflow). Check the Actions tab after a push.

## How the code is organised

- `web/index.html`: the one page of the app.
- `web/js/homeworkout.js`: main app (`HomeWorkoutApp`): screens, logger, rest timer, progress, phone app.
- `web/js/store.js`: saving data (`HomeWorkoutStore`): phone storage + Supabase.
- `web/js/plan.js`: goal-based training plan (`TrainingPlan`).
- `web/js/exercises.js`: exercise list (`ExerciseDataset`), data in `web/data/exercises_database.json`.
- `web/js/telemetry.js`, `web/js/visuals.js`: small helpers.
- `web/css/homeworkout.css`: styles.
- `web/sw.js`: service worker (offline mode). `web/manifest.json`: install to Home Screen.
- `web/admin.html`: admin page.
- `supabase/*.sql`: database security rules and tables (already run on Supabase).
- `docs/plans/*.md`: plans written for Antigravity, one per phase.

Plain JavaScript, no build step. Data is saved in Supabase (tables `profiles`,
`workout_logs`, `body_weights`, all private per user). The training plan is saved in
the user's account data (`training_plan`). Offline workouts are saved on the phone
and uploaded when back online.

## Rules that are easy to break

1. **Version numbers.** Files in `web/index.html` end with `?v=3.xx`. When you change
   a JS or CSS file, raise its number in `index.html` **and** use the same number in
   `PRECACHE_URLS` in `web/sw.js`, and raise `CACHE_NAME` in `web/sw.js`.
   Otherwise phones keep the old version.
2. **No duplicate function names** inside `HomeWorkoutApp` or `HomeWorkoutStore`.
   A second function with the same name silently replaces the first one.
   (This caused real bugs before.)
3. Never cache Supabase requests in the service worker.
4. Never put real passwords or secret keys in the code. (The Supabase "publishable"
   key in `index.html` is meant to be public.)
5. Test with fake data, not real user accounts.

## How we work

1. Claude writes a plan in `docs/plans/<phase>.md` and pushes it.
2. Antigravity builds it on a **new branch**. It must **not** merge or push to `master`.
3. Claude reviews the work, fixes problems, tests it in the browser.
4. Only when the user says so: commit, merge into `master`, push, check the live site.

Always run `git pull` before starting. Work on one computer at a time, and push
before switching computers.

## Done (all live)

- Security fixes + Supabase privacy rules (RLS)
- Goal-based plan + "Today" card
- Easy sign-up
- Quick fixes
- 3A: workout logger (sets, weight, reps, rest timer with beep + vibration)
- 3B: progress screen (charts, personal records, body weight)
- Phase 2: phone app (install to Home Screen, works offline, syncs later). Version 3.19.

## Next phases

1. **Phase 3: own images.** Replace the copied images, icon and badges that came
   from another app (Cali Move) with our own.
2. **Phase 4: reminders.** "Time to train" notifications.
3. **Phase 5: extras.** kg / lb setting, rest-week advice, simple food tips for
   lose-weight / gain-weight goals.

## Parked (later)

- Google sign-in: steps in `docs/GOOGLE_SIGN_IN.md`; switched off with `GOOGLE_SIGN_IN: false`.
- Check that the admin login works (the admin account did not exist in Supabase).
- Admin "activity" view needs an `activity_logs` table that does not exist yet.
