# Turning on "Continue with Google"

The button is already built into the app but hidden. It needs a Google "OAuth client"
and the Google provider switched on in Supabase. This takes about 10 minutes and must be
done with your own Google and Supabase accounts.

App address: `https://abdulsattarsuleman.github.io/homeworkout-app/`
Supabase project: `rpjyrbbbqrehrkpckyuv`

## 1. Create the Google login keys (Google Cloud Console)

1. Go to https://console.cloud.google.com/ and create a project (e.g. "Home Workout").
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create
   - App name: `Home Workout`, support email: your email
   - Authorised domains: add `supabase.co` and `github.io`
   - Save. While testing, add your own Gmail under **Test users**
     (or press **Publish app** when you are ready for everyone).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://abdulsattarsuleman.github.io`
   - Authorised redirect URIs: `https://rpjyrbbbqrehrkpckyuv.supabase.co/auth/v1/callback`
   - Create, then copy the **Client ID** and **Client secret**.

## 2. Switch on Google in Supabase

1. Supabase dashboard → **Authentication → Sign In / Providers → Google**
2. Turn it **on**, paste the Client ID and Client secret, **Save**.

## 3. Allow the app's address (Supabase)

Supabase dashboard → **Authentication → URL Configuration**

- **Site URL:** `https://abdulsattarsuleman.github.io/homeworkout-app/`
- **Redirect URLs** → add:
  - `https://abdulsattarsuleman.github.io/homeworkout-app/`
  - `https://abdulsattarsuleman.github.io/homeworkout-app/index.html`

This is also what makes the links in "confirm your email" and "reset password" emails
come back to the app.

## 4. Show the button in the app

In `web/index.html`, change

```js
GOOGLE_SIGN_IN: false
```

to

```js
GOOGLE_SIGN_IN: true
```

then commit and push.

## 5. Check it works

1. Open the app in a private/incognito window.
2. Answer the plan questions and finish one workout.
3. In the "Save your progress" sheet, tap **Continue with Google** and pick your account.
4. You should come back to the app signed in:
   - Settings shows **"Saved to your account"**
   - Report still shows the workout you did
   - Supabase → Table Editor → `workout_logs` has a new row for it

If Google shows an error such as `redirect_uri_mismatch`, re-check the redirect URI in
step 1.3. If the app shows "Sign-in didn't finish: ...", the message says what Supabase
rejected (often a missing Redirect URL from step 3).
