# Deploying Inkling to GitHub Pages

This replaces Namecheap for the frontend app only.

Keep the split:

- GitHub Pages: React/Vite app shell
- Convex: auth, database, functions
- Cloudflare R2: official books and uploaded book files

## 1. Create The GitHub Repo

1. Go to GitHub.
2. Create a new repository, for example `inkling-reader`.
3. Keep it private or public, either is fine.
4. Do not add a README from GitHub if you are pushing this existing project.

## 2. Push This Project

From this folder:

```powershell
Set-Location "D:\gitlocal\DMS4-Inkling"
git add .
git commit -m "Prepare GitHub Pages deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/DMS4-Inkling.git
git push -u origin main
```

If `git init` says the repo already exists, skip it.

If `remote add origin` says origin already exists, use:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/DMS4-Inkling.git
```

## 3. Enable GitHub Pages

In the GitHub repo:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.

The workflow in `.github/workflows/github-pages.yml` will handle the build and deploy.

## 4. Add GitHub Repository Variables

In the GitHub repo:

1. Open `Settings`.
2. Open `Secrets and variables`.
3. Open `Actions`.
4. Go to the `Variables` tab.
5. Add these repository variables:

```txt
VITE_CONVEX_URL=https://tame-hare-319.convex.cloud
VITE_CONVEX_SITE_URL=https://tame-hare-319.convex.site
VITE_BOOK_ASSET_BASE_URL=https://assets.inklingreader.xyz/official
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_API_KEY=your-google-api-key
```

Use variables, not secrets, for `VITE_*` values. Vite puts these values into the browser bundle.

That means official assets should exist in R2 like:

```txt
official/enbj01.pdf
official/enbj002.pdf
official/covers/enbj01.svg
official/covers/enbj002.svg
```

## 5. Set Convex Production Env Vars

In the Convex dashboard for `tame-hare-319`, set:

```txt
SITE_URL=https://inklingreader.xyz
```

If you use a different repo name, replace `DMS4-Inkling`.

For R2 uploads, set these Convex backend env vars:

```txt
BOOK_ASSET_PROVIDER=r2
BOOK_ASSET_BUCKET=timer-reader-tracker
BOOK_ASSET_ENDPOINT=https://5ef3213701ae8987f3134898e470c4b7.r2.cloudflarestorage.com
BOOK_ASSET_REGION=auto
BOOK_ASSET_ACCESS_KEY_ID=your-r2-access-key-id
BOOK_ASSET_SECRET_ACCESS_KEY=your-r2-secret-access-key
BOOK_ASSET_PUBLIC_BASE_URL=https://assets.inklingreader.xyz
```

Important distinction:

- `VITE_BOOK_ASSET_BASE_URL` points to the official book folder, usually `/official`.
- `BOOK_ASSET_PUBLIC_BASE_URL` points to the R2 bucket root.

## 6. Update Google OAuth

In Google Cloud Console, update the OAuth client.

Authorized JavaScript origins:

```txt
https://inklingreader.xyz
```

Authorized redirect URI:

```txt
https://tame-hare-319.convex.site/api/auth/callback/google
```

Do not add a path to the JavaScript origin. Google wants only the origin.

## 7. Deploy

Push to `main`:

```powershell
git add .
git commit -m "Deploy frontend with GitHub Pages"
git push
```

Then open:

```txt
https://github.com/YOUR_USERNAME/DMS4-Inkling/actions
```

Wait for `Deploy to GitHub Pages` to finish.

Your site will be:

```txt
https://inklingreader.xyz/
```

## 8. Check The Site

Test:

1. App loads.
2. Google login opens and returns correctly.
3. Official book cover loads from R2.
4. Official PDF opens from R2.
5. Uploading a new book creates a file in R2, not Convex storage.
6. Convex file bandwidth does not spike.

## Local Production Build Check

To simulate GitHub Pages locally:

```powershell
$env:VITE_BASE_PATH="/"
$env:VITE_BOOK_ASSET_BASE_URL="https://assets.inklingreader.xyz/official"
npm run build
npm run preview
```

Open the preview URL and make sure the app loads.
