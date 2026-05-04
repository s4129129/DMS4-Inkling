import { useEffect, useMemo, useState } from "react";
import { getThemePalette } from "../themePreview";
import marketplaceBannerImage from "../../assets/Marketplace/Banner.png";
import marketplaceComicDarkImage from "../../assets/Marketplace/Comic D.png";
import marketplaceComicLightImage from "../../assets/Marketplace/Comic L.png";
import marketplaceMonoDarkImage from "../../assets/Marketplace/Mono D.png";
import marketplaceMonoLightImage from "../../assets/Marketplace/Mono L.png";
import marketplaceVintageDarkImage from "../../assets/Marketplace/VIntage D.png";
import marketplaceVintageLightImage from "../../assets/Marketplace/Vintage L.png";

const MECHANICAL_INTERACTION_FEATURE_ID = "sink-button-interactions";
const DEFAULT_INTERACTION_FEATURE_ID = "default-interaction-pack";
const CUSTOM_BANNER_FEATURE_ID = "custom-banner-upload";

const STORE_CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "featured", label: "Featured" },
  { id: "themes", label: "Themes" },
  { id: "interaction", label: "Interaction Packs" },
  { id: "utility", label: "Utilities" },
  { id: "owned", label: "Owned" },
];

const BOOK_CATEGORIES = [
  { id: "all", label: "All Books" },
  { id: "featured", label: "Featured" },
  { id: "available", label: "Available" },
  { id: "added", label: "Added" },
];

const MARKETPLACE_ITEM_IMAGES = {
  themes: {
    comic: {
      light: marketplaceComicLightImage,
      dark: marketplaceComicDarkImage,
    },
    vintage: {
      light: marketplaceVintageLightImage,
      dark: marketplaceVintageDarkImage,
    },
    command: {
      light: marketplaceMonoLightImage,
      dark: marketplaceMonoDarkImage,
    },
  },
  features: {
    [CUSTOM_BANNER_FEATURE_ID]: marketplaceBannerImage,
  },
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function itemBadge(item) {
  if (item.owned) {
    return "Owned";
  }
  return item.affordable ? "Buy" : "Need Ink";
}

function paletteStyle(themeId, mode) {
  const palette = getThemePalette(themeId, mode);
  return {
    "--preview-bg": palette.bg,
    "--preview-surface": palette.surface,
    "--preview-accent": palette.accent,
    "--preview-text": palette.text,
  };
}

function StoreItemPreview({
  item,
  selectedThemeId,
  selectedThemeMode,
  previewMode,
  onPreviewModeChange,
  onOpenPreview,
}) {
  if (item.type === "theme") {
    const previewImage = MARKETPLACE_ITEM_IMAGES.themes[item.id]?.[previewMode];

    return (
      <div
        className="market-item-preview market-theme-preview"
        style={paletteStyle(item.id, previewMode)}
      >
        <figure className="market-item-art-frame">
          {previewImage ? (
            <button
              type="button"
              className="market-preview-image-button"
              onClick={() =>
                onOpenPreview?.({
                  src: previewImage,
                  alt: `${item.name} ${previewMode} preview`,
                })
              }
            >
              <img
                src={previewImage}
                alt={`${item.name} ${previewMode} marketplace preview`}
                className="market-item-art-image"
                loading="lazy"
              />
            </button>
          ) : (
            <span>{item.name}</span>
          )}
        </figure>

        <div className="market-preview-controls market-theme-mode-controls">
          <button
            type="button"
            className={`mode-pill${previewMode === "light" ? " active" : ""}`}
            onClick={() => onPreviewModeChange(item.id, "light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`mode-pill${previewMode === "dark" ? " active" : ""}`}
            onClick={() => onPreviewModeChange(item.id, "dark")}
          >
            Dark
          </button>
        </div>

      </div>
    );
  }

  if (item.id === CUSTOM_BANNER_FEATURE_ID) {
    const previewImage = MARKETPLACE_ITEM_IMAGES.features[item.id];

    return (
      <div
        className="market-item-preview market-feature-preview"
        style={paletteStyle(selectedThemeId, selectedThemeMode)}
      >
        <button
          type="button"
          className="market-banner-sample-frame market-preview-image-button"
          onClick={() =>
            onOpenPreview?.({
              src: previewImage,
              alt: `${item.name} preview`,
            })
          }
        >
          <img
            src={previewImage}
            alt={`${item.name} marketplace preview`}
            className="market-banner-sample-image"
            loading="lazy"
          />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`market-item-preview market-feature-preview${item.id === MECHANICAL_INTERACTION_FEATURE_ID ? " market-interaction-preview" : " market-default-interaction-preview"}`}
      style={paletteStyle(selectedThemeId, selectedThemeMode)}
    >
      <div className="market-preview-controls">
        {item.id === MECHANICAL_INTERACTION_FEATURE_ID ? (
          <>
            <button
              type="button"
              className="ghost market-preview-btn market-interaction-sample-popup"
            >
              Pop Up
            </button>
            <button
              type="button"
              className="ghost market-preview-btn market-interaction-sample-sinkdown"
            >
              Sink
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ghost market-preview-btn market-interaction-sample-default"
          >
            Hover
          </button>
        )}
      </div>
    </div>
  );
}

function OfficialBookPreview({ book, thumbnailSrc = "" }) {
  return (
    <div className="market-item-preview market-book-preview">
      <div className="market-book-thumb-art">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={`${book.title} cover thumbnail`}
            className="market-book-thumb-canvas"
          />
        ) : (
          <div className="market-book-cover-fallback" aria-hidden>
            <span>{book.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketSection({
  marketMessage,
  market,
  selectedThemeId,
  selectedThemeMode,
  onBuyTheme,
  onBuyOfficialBook,
  onOpenSettings,
  officialBooksWithState,
  officialBookThumbnailMap = {},
  uploadState,
  onAddOfficialBook,
  interactionLocked = false,
  interactionLockReason = "",
  initialView = "store",
}) {
  const [activeView, setActiveView] = useState("store");
  const [storeCategory, setStoreCategory] = useState("all");
  const [bookCategory, setBookCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [themePreviewModeById, setThemePreviewModeById] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const normalizedQuery = normalizeText(query);

  useEffect(() => {
    setActiveView(initialView === "books" ? "books" : "store");
  }, [initialView]);

  useEffect(() => {
    if (!previewImage) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

  const storeItems = useMemo(
    () =>
      market.map((item, index) => ({
        ...item,
        featured:
          item.id === MECHANICAL_INTERACTION_FEATURE_ID ||
          (item.type === "theme" && index === 0) ||
          item.id === CUSTOM_BANNER_FEATURE_ID,
      })),
    [market],
  );

  const filteredStoreItems = useMemo(
    () =>
      storeItems.filter((item) => {
        const matchesText =
          !normalizedQuery ||
          normalizeText(item.name).includes(normalizedQuery);

        if (!matchesText) {
          return false;
        }

        if (storeCategory === "featured") {
          return item.featured;
        }
        if (storeCategory === "themes") {
          return item.type === "theme";
        }
        if (storeCategory === "interaction") {
          return (
            item.type === "feature" &&
            (item.id === MECHANICAL_INTERACTION_FEATURE_ID ||
              item.id === DEFAULT_INTERACTION_FEATURE_ID)
          );
        }
        if (storeCategory === "utility") {
          return (
            item.type === "feature" &&
            item.id !== MECHANICAL_INTERACTION_FEATURE_ID &&
            item.id !== DEFAULT_INTERACTION_FEATURE_ID
          );
        }
        if (storeCategory === "owned") {
          return Boolean(item.owned);
        }
        return true;
      }),
    [normalizedQuery, storeCategory, storeItems],
  );

  const books = useMemo(
    () =>
      officialBooksWithState.map((book, index) => ({
        ...book,
        featured: index === 0,
      })),
    [officialBooksWithState],
  );

  const filteredBooks = useMemo(
    () =>
      books.filter((book) => {
        const matchesText =
          !normalizedQuery ||
          normalizeText(book.title).includes(normalizedQuery);
        if (!matchesText) {
          return false;
        }

        if (bookCategory === "featured") {
          return book.featured;
        }
        if (bookCategory === "available") {
          return !book.added;
        }
        if (bookCategory === "added") {
          return book.added;
        }
        return true;
      }),
    [bookCategory, books, normalizedQuery],
  );

  const activeCategories =
    activeView === "store" ? STORE_CATEGORIES : BOOK_CATEGORIES;
  const activeCategory = activeView === "store" ? storeCategory : bookCategory;

  return (
    <div className="dash-grid market-layout">
      <section
        className="panel market-unified-panel"
        data-tutorial-anchor="marketplace-hub"
      >
        {interactionLocked ? (
          <p className="status-text section-preview-lock-banner">
            {interactionLockReason}
          </p>
        ) : null}

        <div
          className={`market-reference-shell${interactionLocked ? " section-preview-locked" : ""}`}
          aria-disabled={interactionLocked}
        >
          <aside className="market-category-column">
            <p className="dash-kicker">Categories</p>
            <div
              className="market-category-list"
              role="tablist"
              aria-label="Market categories"
            >
              {activeCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`market-category-item${activeCategory === category.id ? " active" : ""}`}
                  onClick={() => {
                    if (activeView === "store") {
                      setStoreCategory(category.id);
                    } else {
                      setBookCategory(category.id);
                    }
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="market-content-column">
            <div className="market-top-row">
              <label className="market-search-field">
                Search
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div
                className="market-view-switch"
                role="tablist"
                aria-label="Store view switch"
              >
                <button
                  type="button"
                  className={`ghost${activeView === "store" ? " active" : ""}`}
                  onClick={() => setActiveView("store")}
                >
                  Marketplace
                </button>
                <button
                  type="button"
                  className={`ghost${activeView === "books" ? " active" : ""}`}
                  onClick={() => setActiveView("books")}
                >
                  Official Books
                </button>
              </div>
            </div>

            <div className="market-headline-row">
              <div>
                <h2>Marketplace</h2>
              </div>
            </div>

            {marketMessage ? (
              <p className="status-text">{marketMessage}</p>
            ) : null}

            {activeView === "store" ? (
              <div className="market-card-grid">
                {filteredStoreItems.map((item) => {
                  const previewMode =
                    themePreviewModeById[item.id] ?? selectedThemeMode;

                  return (
                    <article
                      key={item.id}
                      className={`market-card market-listing-card${item.featured ? " featured" : ""}`}
                    >
                      <StoreItemPreview
                        item={item}
                        selectedThemeId={selectedThemeId}
                        selectedThemeMode={selectedThemeMode}
                        previewMode={previewMode}
                        onPreviewModeChange={(themeId, mode) =>
                          setThemePreviewModeById((prev) => ({
                            ...prev,
                            [themeId]: mode,
                          }))
                        }
                        onOpenPreview={setPreviewImage}
                      />

                      <div className="market-listing-head">
                        <h3>{item.name}</h3>
                        <span className="mode-pill">{itemBadge(item)}</span>
                      </div>

                      <p className="market-price-row">
                        <strong>{item.cost}</strong> Ink
                      </p>

                      {item.type === "theme" ? (
                        item.owned ? (
                          <div className="market-actions-row">
                            <button
                              type="button"
                              className="ghost"
                              onClick={onOpenSettings}
                            >
                              Manage in Settings
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="action"
                            disabled={!item.affordable}
                            onClick={() => onBuyTheme(item.id, item.type)}
                          >
                            Buy Theme
                          </button>
                        )
                      ) : item.owned ? (
                        <div className="market-actions-row">
                          {item.id === CUSTOM_BANNER_FEATURE_ID ? (
                            <button
                              type="button"
                              className="ghost"
                              onClick={onOpenSettings}
                            >
                              Open Settings
                            </button>
                          ) : (
                            <button type="button" className="ghost" disabled>
                              Active
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="action"
                          disabled={!item.affordable}
                          onClick={() => onBuyTheme(item.id, item.type)}
                        >
                          Buy Feature
                        </button>
                      )}
                    </article>
                  );
                })}

                {filteredStoreItems.length === 0 ? (
                  <article className="market-card market-listing-card">
                    <h3>No items</h3>
                  </article>
                ) : null}
              </div>
            ) : (
              <div className="market-card-grid market-book-card-grid">
                {filteredBooks.map((book) => (
                  <article
                    key={book.id}
                    className={`market-card market-listing-card market-book-listing${book.featured ? " featured" : ""}`}
                  >
                    <OfficialBookPreview
                      book={book}
                      thumbnailSrc={
                        officialBookThumbnailMap[book.id]?.src || book.coverUrl
                      }
                    />
                    <div className="market-listing-head">
                      <h3>{book.title}</h3>
                      <span className="mode-pill">
                        {book.added
                          ? "Added"
                          : book.owned
                            ? "Owned"
                            : book.cost === 0
                              ? "Free"
                              : "Locked"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={book.added ? "ghost" : "action"}
                      disabled={
                        uploadState.busy ||
                        book.added ||
                        (!book.owned && !book.affordable)
                      }
                      onClick={() =>
                        book.owned
                          ? onAddOfficialBook(book)
                          : onBuyOfficialBook?.(book)
                      }
                    >
                      {book.added
                        ? "Added"
                        : book.owned
                          ? "Add"
                          : book.cost === 0
                            ? "Free"
                            : `${book.cost} Quills`}
                    </button>
                  </article>
                ))}

                {filteredBooks.length === 0 ? (
                  <article className="market-card market-listing-card">
                    <h3>No books</h3>
                  </article>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
      {previewImage ? (
        <button
          type="button"
          className="market-image-lightbox"
          onClick={() => setPreviewImage(null)}
          aria-label="Close preview"
        >
          <img src={previewImage.src} alt={previewImage.alt || "Preview"} />
        </button>
      ) : null}
    </div>
  );
}
