const DEFAULT_OFFICIAL_ASSET_BASE = `${import.meta.env.BASE_URL}official`;

function normalizeAssetBase(value) {
  const raw = String(value || DEFAULT_OFFICIAL_ASSET_BASE).trim();
  return raw.replace(/\/+$/, "");
}

const officialAssetBase = normalizeAssetBase(
  import.meta.env.VITE_BOOK_ASSET_BASE_URL,
);

function assetUrl(path) {
  return `${officialAssetBase}/${String(path || "").replace(/^\/+/, "")}`;
}

export const OFFICIAL_BOOKS = [
  {
    id: "enbj01",
    title: "ENBJ Official Vol 1",
    cost: 0,
    fileType: "pdf",
    pageCount: 213,
    pdfUrl: assetUrl("enbj01.pdf"),
    coverUrl: assetUrl("covers/enbj01.webp"),
    delivery: "static-cdn",
    byteSize: 179991550,
  },
  {
    id: "enbj002",
    title: "ENBJ Official Vol 2",
    cost: 1500,
    fileType: "pdf",
    pageCount: 199,
    pdfUrl: assetUrl("enbj002.pdf"),
    coverUrl: assetUrl("covers/enbj002.webp"),
    delivery: "static-cdn",
    byteSize: 395294646,
  },
];

export const OFFICIAL_BOOK_BY_ID = Object.fromEntries(
  OFFICIAL_BOOKS.map((book) => [book.id, book]),
);

export const OFFICIAL_BOOK_BY_TITLE = Object.fromEntries(
  OFFICIAL_BOOKS.map((book) => [book.title.trim().toLowerCase(), book]),
);

export function getOfficialBookAsset(book) {
  if (!book) {
    return null;
  }

  const byId = OFFICIAL_BOOK_BY_ID[String(book.id || book.bookId || "")];
  if (byId) {
    return byId;
  }

  return (
    OFFICIAL_BOOK_BY_TITLE[
      String(book.title || "")
        .trim()
        .toLowerCase()
    ] ?? null
  );
}
