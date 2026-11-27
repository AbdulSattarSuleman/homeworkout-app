# Plan 4: Phone app (install to Home Screen + works offline)

## Goal

Gym users want the app on their Home Screen like a normal app, and gyms
(basements!) often have no signal. After this plan:

1. The app can be **installed** ("Add to Home Screen") on Android and iPhone,
   opens full screen with its own icon and name.
2. It **opens and works without internet**: Today's workout, the workout
   player, logging sets, the Progress tab.
3. Workouts and body weights done offline are **saved on the phone and
   uploaded automatically** when the connection comes back.

This is a "Progressive Web App" (PWA). No app stores, no new libraries.

## Where things are today

| What | Where / state |
|---|---|
| Site | Static files in `web/`, published by GitHub Pages at `https://abdulsattarsuleman.github.io/homeworkout-app/` (note the `/homeworkout-app/` sub-path) |
| Manifest | `web/manifest.json` exists but **`index.html` does not link it** |
| Icon | `web/assets/images/app_icon.png` (512×512, used for both sizes). It will be replaced with the owner's own icon later (Phase 3); keep paths easy to swap |
| Service worker | none |
| Scripts | `web/js/*.js` and `web/css/homeworkout.css`, loaded with `?v=3.17` style version numbers in `web/index.html` |
| Exercise data | `web/data/exercises_database.json` (~1.4 MB), loaded by `ExerciseDataset.loadFullDatabase()` in `web/js/exercises.js` |
| External files | Supabase JS from `cdn.jsdelivr.net` (pinned `@supabase/supabase-js@2.48.1`), Google Fonts, exercise GIFs/thumbnails from `raw.githubusercontent.com` |
| Saving data | Everything is saved to `localStorage` first (`hw_workout_logs`, `hw_user_progress`, `hw_body_weights`, `hw_active_workout`), then sent to Supabase when signed in |
| Upload of pending data | `HomeWorkoutStore.moveLocalProgressToAccount()` (uploads workouts not yet `cloudSynced`, and body weights) runs on page load (`HomeWorkoutApp.init`) |

## Features to build (in this order)

### 1. Installable
- Link the manifest in `web/index.html` `<head>`:
  `<link rel="manifest" href="manifest.json">`, plus
  `<meta name="theme-color" content="#0052FF">`,
  `<link rel="apple-touch-icon" href="assets/images/app_icon.png">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-title" content="Home Workout">`.
- Update `web/manifest.json`:
  - `"start_url": "./index.html#training"`, `"scope": "./"`, `"id": "./"`,
    `"display": "standalone"`, `"orientation": "portrait"`,
    `"background_color": "#F8F9FB"` (the app's light background), keep `theme_color`.
  - Icons: create `web/assets/icons/icon-192.png` and `icon-512.png` (resize the
    current app icon) and a **maskable** 512 icon with extra padding
    (`"purpose": "maskable"`). Keep the old file untouched.
- All paths must be **relative** so they work under `/homeworkout-app/`.

### 2. Service worker (offline app shell)
- New file `web/sw.js`, registered from `index.html` (or `homeworkout.js`)
  with `navigator.serviceWorker.register('sw.js')` — only when supported and
  only on `https:` or `localhost`.
- Caching strategy:
  - **App files** (`index.html`, all `js/*.js`, `css/homeworkout.css`,
    `manifest.json`, icons, `data/exercises_database.json`): pre-cache on install
    into a versioned cache (e.g. `hw-app-v3.18`). Use the same file URLs the page
    requests, including their `?v=` query strings.
  - **Page navigations**: network first, fall back to the cached `index.html`
    when offline.
  - **Exercise GIFs/thumbnails** (`raw.githubusercontent.com`) and **Google
    Fonts**: "stale-while-revalidate" in a separate runtime cache with a size
    limit (e.g. keep the newest 150 entries) so storage doesn't grow forever.
  - **Supabase API calls** (`*.supabase.co`) and anything that is not GET:
    **never cache**, always go to the network.
  - Supabase JS from jsdelivr: cache it (it is pinned to one version), so the
    app still starts offline.
- Updating: when a new version is deployed, the new service worker must take
  over cleanly: delete old `hw-app-*` caches in `activate`, and show a small
  "New version available · Refresh" banner in the app instead of reloading by
  surprise. **Never** leave users stuck on an old version.
- The cache version must change whenever the `?v=` numbers change (keep both in
  sync and write a comment in `sw.js` explaining this).

### 3. Offline behaviour in the app
- A small "You're offline · your workouts are saved on this phone" pill at the
  top when `navigator.onLine` is false (listen to `online` / `offline`).
- Starting, logging and finishing a plan workout must work offline. The results
  screen and the Progress tab must work offline (they use local data).
- Sign-in, sign-up and password reset need internet: when offline, show a clear
  message ("Connect to the internet to sign in") instead of a confusing error.
- Exercise pictures that were never loaded may be missing offline: show the
  existing 💪 fallback, don't break the layout.

### 4. Upload when back online
- On the `online` event (and on page load, as today), call
  `HomeWorkoutStore.moveLocalProgressToAccount()` and the plan sync, so workouts
  and body weights done offline reach the account without reopening the app.
- Make sure nothing is uploaded twice (`cloudSynced` / in-flight checks already
  exist — reuse them, don't add a second upload path).

### 5. "Install the app" hint
- Android/Chrome: listen for `beforeinstallprompt`, keep the event, and show an
  "📲 Install app" button in the Profile tab; on tap call `prompt()`.
- iPhone (Safari has no prompt): in the Profile tab show short instructions:
  "Tap Share ⬆️ then 'Add to Home Screen'". Only show on iOS Safari and only when
  not already installed (`window.matchMedia('(display-mode: standalone)')` or
  `navigator.standalone`).
- Hide the hint once installed.

## Must keep working (regression checklist)

- Everything works normally online, signed in and signed out.
- Password-reset and Google/email-confirmation links (`#access_token=…`,
  `#type=recovery`) still work. The service worker must not interfere with the
  address hash or with `window.__hwInitialHash` in `index.html`.
- Admin page `web/admin.html` keeps working (don't cache Supabase responses).
- After a new deploy, users get the new version (the "New version" banner, then
  the new files load).
- Workouts upload once, not twice.

## Rules for the implementation

- Work on a new git branch `phone-app`. **Do not merge, push or deploy.** The
  owner will have it reviewed first (last time the work was merged and deployed
  without review; please don't).
- Plain JavaScript, no new libraries (no Workbox).
- Read a whole function before changing it; check that **no method name is
  defined twice** in `HomeWorkoutApp` / `HomeWorkoutStore`.
- Every new function must be wired up and every new CSS class must exist.
- Bump the `?v=` numbers in `web/index.html` for changed files, and the cache
  version in `sw.js` to match.
- Don't change Supabase tables, don't run SQL, don't write to the live project.
- Serve `web/` with `python -m http.server 8765 --directory web` (service
  workers work on `localhost`); never run `server.py`.
- Phone first: test at 375×812.

## How to test (show evidence for each)

1. Chrome DevTools → Application: manifest has no errors, icons load, the
   service worker is "activated", the cache contains the app files and the
   exercise JSON.
2. Lighthouse (or DevTools "Installability"): the app is installable.
3. Load the app once, then switch DevTools to **Offline** and reload: the app
   opens, the offline pill shows, a plan workout can be started, sets logged and
   finished, and the Progress tab shows it.
4. Go back **Online**: the offline pill disappears and the offline workout is
   uploaded once (use a fake Supabase client in the console, signed in, to
   count insert calls).
5. Change a `?v=` number and the cache version (simulate a new deploy), reload:
   the "New version available" banner appears; tapping Refresh loads the new
   files; old caches are deleted.
6. Supabase requests are never served from the cache (check the Network tab).
7. Reset-password link test: open `index.html#type=recovery` → "Set new
   password" still opens.
8. Install hint: shown in Profile on Chrome (fake the `beforeinstallprompt`
   event if needed) and the iPhone instructions on an iOS user agent; hidden in
   standalone mode.
9. Regression checklist. Browser console: no errors.

Finish with: what was built, the evidence for each test, anything not done or
not verified, and the list of changed files.
