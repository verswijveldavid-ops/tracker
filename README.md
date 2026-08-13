# Tracker

A small dark PWA for tracking daily productive hours, checkable tasks/habits, and a diary. Syncs across devices via Firebase.

## Setup (do these once)

### 1. Firebase project (~10 minutes)

Open `firebase-config.js` — every step is listed there. Short version:

1. Create a free Firebase project at https://console.firebase.google.com
2. Add a **Web app** (`</>` icon), copy the config object → paste into `firebase-config.js`
3. Enable **Google sign-in** under Build → Authentication
4. Create a **Firestore database** in production mode
5. Paste the security rules from `firebase-config.js` into the Rules tab and Publish
6. Add your GitHub Pages domain (e.g. `yourname.github.io`) to Authentication → Settings → Authorized domains

### 2. Try it locally

Any static server works. Easiest:

```bash
cd "/Users/davidverswijvel/Documents/All/Tracking app"
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser. Sign in with Google — that's your account.

### 3. Deploy to GitHub Pages (free, ~5 min)

1. Create a new repo on github.com — public or private both work.
2. In this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. On GitHub: repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main / (root)** → Save.
4. Wait 1-2 min, then visit `https://YOUR_USERNAME.github.io/YOUR_REPO/` on your phone.
5. Chrome menu → **Add to Home screen**. Tap the icon — installs like a native app.

### 4. Sign in on your PC too

Same URL, sign in with the same Google account. Data syncs automatically both ways.

## Features

- **Today tab** — check off tasks, drag the hours slider (0–12h in 15-min steps), write notes.
- **Edit** button next to Tasks — add/rename/reorder/delete tasks.
- **Calendar tab** — tap any past day to see or edit what happened.
- **Last 7 days / Last 30 days** — totals, average, best day, streak, bar charts, habit completion, and a 30-day heatmap.
- **Settings** (gear icon top-right) — sign out, export your data as JSON, import from JSON.

## Data model

Data lives in Firestore under `users/{your uid}/`. Only you can read or write it (enforced by the security rules).

## Costs

Firebase's free tier (Spark plan) covers this app essentially forever at personal-use volume. No credit card required.

## Files

- `index.html` — app shell
- `styles.css` — dark theme
- `app.js` — logic (vanilla JS, no build step)
- `firebase-config.js` — your Firebase credentials (edit this)
- `manifest.json` — PWA manifest
- `sw.js` — service worker for offline use
- `icon.svg` / `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` — app icons

## Modifying

Everything is plain HTML/CSS/JS — no build step, no framework. Edit a file, refresh the browser, done.

To force the service worker to pick up changes, bump `CACHE_VERSION` in `sw.js`.
