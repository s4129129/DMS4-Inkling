# Reader Asset Architecture

Inkling should treat Convex as the application brain, not the book file server.

## Production Model

- Convex stores users, timers, purchases, groups, progress, analytics, and book records.
- Large reader assets live on static hosting, object storage, or a CDN.
- The app stores URLs and metadata for those files, not the file bytes.
- Covers and thumbnails are generated once and served as tiny static assets.
- The reader opens a full PDF only when the user actively opens that book.

## Official Books

Official book metadata lives in `src/reader/officialBooks.js`.

Each official book has:

- `id`
- `title`
- `cost`
- `fileType`
- `pageCount`
- `pdfUrl`
- `coverUrl`
- `delivery`
- `byteSize`

The import flow uses catalog `pageCount`, so adding an official book does not open the PDF just to count pages.

## Asset Base URL

Set this in production:

```env
VITE_BOOK_ASSET_BASE_URL=/s4129129-Inkling/official
```

Later, if books move to a CDN or object-storage bucket, change it to something like:

```env
VITE_BOOK_ASSET_BASE_URL=https://cdn.example.com/inkling/official
```

The app will read:

- `${VITE_BOOK_ASSET_BASE_URL}/enbj01.pdf`
- `${VITE_BOOK_ASSET_BASE_URL}/enbj002.pdf`
- `${VITE_BOOK_ASSET_BASE_URL}/covers/enbj01.svg`
- `${VITE_BOOK_ASSET_BASE_URL}/covers/enbj002.svg`

## Namecheap Packaging

For the old all-in-one upload:

```powershell
npm run ship:namecheap
```

For an industry-style split deploy:

```powershell
npm run ship:namecheap:split
```

That creates:

- `deploy-namecheap-app.zip`: app shell, JavaScript, CSS, images, and covers, excluding large official PDFs.
- `deploy-namecheap-book-assets.zip`: the `official/` book asset folder.

Upload book assets less often than the app shell. When a CDN is available, upload `official/` there and set `VITE_BOOK_ASSET_BASE_URL` to the CDN URL.

## Uploads

User book uploads now support S3-compatible object storage through `convex/bookAssets.ts`.

When object storage is configured:

- The browser asks Convex for a short-lived signed upload URL.
- The browser uploads the book directly to the bucket.
- Convex stores only the public URL, asset key, provider, content type, size, and reading metadata.

When object storage is not configured:

- The app falls back to the old Convex storage upload path.

## Object Storage Env

Set these in Convex environment variables, not in the public frontend env:

```env
BOOK_ASSET_PROVIDER=r2
BOOK_ASSET_BUCKET=your-bucket-name
BOOK_ASSET_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
BOOK_ASSET_REGION=auto
BOOK_ASSET_ACCESS_KEY_ID=...
BOOK_ASSET_SECRET_ACCESS_KEY=...
BOOK_ASSET_PUBLIC_BASE_URL=https://cdn.example.com
```

For AWS S3, `BOOK_ASSET_ENDPOINT` can be `https://s3.<region>.amazonaws.com`, and `BOOK_ASSET_REGION` should match the bucket region.

Configure bucket CORS to allow browser uploads from your site. Example:

```json
[
  {
    "AllowedOrigins": ["https://dms.onl", "https://www.dms.onl", "http://localhost:5173", "https://localhost:5173"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep `BOOK_ASSET_PUBLIC_BASE_URL` pointed at a CDN/custom domain in production. Do not expose bucket access keys to the frontend.

## Rules To Keep

- Do not render thumbnails by opening full PDFs in the browser.
- Do not load background reader tabs.
- Do not count pages by downloading official PDFs on user actions.
- Do not store official books in Convex storage.
- Do not package every deploy as the only copy of large book assets once a CDN is available.
- Do not put object-storage secret keys in `VITE_*` env vars.
