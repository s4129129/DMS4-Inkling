# Focus Reader (Convex + React)

This app is a timer-gated PDF reader:

- Users sign in with Google.
- Users upload local PDF files.
- Timers count down.
- Completed timers unlock additional reading pages.

## Stack

- Frontend: React + Vite
- Backend/DB/Auth: Convex + Convex Auth
- PDF rendering: pdfjs-dist

## Required URLs

- Convex Cloud URL: `https://tame-hare-319.convex.cloud`
- Convex HTTP Actions URL: `https://tame-hare-319.convex.site`

## 1) Install

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd install
```

## 2) Frontend environment

Create `.env.local` in `react-template`:

```env
VITE_CONVEX_URL=https://tame-hare-319.convex.cloud
```

## 3) Configure Convex auth variables

In your Convex deployment, set these environment variables:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `SITE_URL`

`SITE_URL` should point to your frontend origin, for example:

- Local: `http://127.0.0.1:5173`
- Production: `https://your-domain.com`

Use the CLI:

```powershell
npm.cmd run convex:dev
```

And set env vars when prompted (or via Convex dashboard).

## 4) Run locally

Run Convex in one terminal:

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd run convex:dev
```

Run React in another terminal:

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd run dev
```

Open `https://localhost:5173/`.

If you specifically want HTTP mode, run:

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd run dev:http
```

If you need HTTPS during local testing (for secure-context checks), run:

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd run dev:https
```

Open `https://localhost:5173/`.

## Local HTTPS + Google notes

- Google allows `http://localhost` origins for local development.
- For published/production use, your real domain must be HTTPS.
- If you test locally with HTTPS, add these to Authorized JavaScript origins:
  - `https://localhost:5173`
  - `https://127.0.0.1:5173`
- Convex Auth Google redirect URI remains your Convex callback URL, for example:
  - `https://tame-hare-319.convex.site/api/auth/callback/google`

## 5) Deploy frontend to Namecheap cPanel

1. Confirm production auth URLs first:

- Convex `SITE_URL` must equal your production URL (example: `https://yourdomain.com`).
- Google OAuth must include your production origin and callback URL.

2. Build and package for cPanel:

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd run ship:namecheap
```

This generates `deploy-namecheap.zip` containing your production site.

3. In cPanel File Manager, upload `deploy-namecheap.zip` into `public_html`.
4. Extract the zip in `public_html`.
5. Confirm `.htaccess` exists after extraction for SPA routing support.
6. If using a subfolder deployment, set Vite base path in `vite.config.js` before rebuilding.

## 6) Backend and auth production checks

1. Ensure Convex deployment is current:

```powershell
Set-Location "c:\Users\PC\Desktop\DMS4 TEST 1\react-template"
npm.cmd run convex:deploy
```

2. In Convex dashboard env vars, verify:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `SITE_URL=https://yourdomain.com`

3. In Google Cloud OAuth app:

- Authorized redirect URI for Convex Auth must be:
  `https://tame-hare-319.convex.site/api/auth/callback/google`
  (or `${VITE_CONVEX_SITE_URL}/api/auth/callback/google` for your deployment).
- Authorized JavaScript origins should include each frontend origin you use,
  for example:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `https://dms.onl`

## Notes

- Page unlock state, timers, and uploaded books are stored in Convex.
- Page turns are handled in React state; the app does not reload into a new instance.
