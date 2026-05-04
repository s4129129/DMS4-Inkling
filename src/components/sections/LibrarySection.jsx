import { useEffect, useRef, useState } from "react";
import HintPopover from "../common/HintPopover";

export default function LibrarySection({
  uploadState,
  onUploadBook,
  uploadAccept,
  localBookCount = 0,
  localBookLimit = 3,
  bookList,
  onOpenOfficialMarketplace,
  selectedBookId,
  setSelectedBookId,
  onRemoveBook,
  selectedBook,
  landingPageInput,
  setLandingPageInput,
  onSaveLandingPage,
  thumbnailPageInput,
  setThumbnailPageInput,
  onSaveThumbnailPage,
  currentPage,
  setCurrentPage,
  onRequestPage,
  pageCredits = 0,
  maxReachable,
  pageCount,
  landingPage,
  unlockedPages,
  bookThumbnailMap,
  isRendering,
  renderError,
  canvasRef,
  isLandscapePage,
  selectedBookFileType,
  selectedBookFileUrl,
  usesPageNavigation,
  altViewerLoading,
  altViewerError,
  epubContainerRef,
  cbzImageUrl,
  onOpenReadingTab,
  activeReadingTabId,
  isReaderExpanded,
  readerLoading = false,
  readerLoadingProgress = 0,
  readerOnlyMode = false,
}) {
  const progressHideTimerRef = useRef(null);
  const progressHoverRef = useRef(false);
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const isUnsupportedInline =
    selectedBookFileType === "mobi" ||
    selectedBookFileType === "azw3" ||
    selectedBookFileType === "cbr";

  const isActiveBookTabOpen = Boolean(
    selectedBook?._id &&
    activeReadingTabId === selectedBook._id &&
    isReaderExpanded,
  );
  const hasReachedLocalLimit = localBookCount >= localBookLimit;
  const localBooks = bookList.filter((book) => book.storageId);
  const officialBooks = bookList.filter((book) => !book.storageId);
  const normalizedReaderLoadingProgress = Math.max(
    0,
    Math.min(100, Math.round(Number(readerLoadingProgress || 0))),
  );

  const onSelectBook = (bookId) => {
    if (onOpenReadingTab) {
      onOpenReadingTab(bookId);
    }

    setSelectedBookId(bookId);
  };

  const requestPage = async (page) => {
    if (!usesPageNavigation) {
      return false;
    }
    const targetPage = Math.max(1, Math.min(pageCount || 1, Math.floor(page)));
    if (targetPage <= maxReachable) {
      setCurrentPage(targetPage);
      return true;
    }
    if (pageCredits <= 0) {
      return false;
    }
    return Boolean(await onRequestPage?.(targetPage));
  };

  const goPrevPage = () => {
    if (!usesPageNavigation) {
      return;
    }
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goNextPage = () => {
    if (!usesPageNavigation) {
      return;
    }
    void requestPage(currentPage + 1);
  };

  const pageProgressSegments =
    selectedBook && usesPageNavigation
      ? Array.from({ length: Math.max(0, pageCount) }, (_, index) => {
          const page = index + 1;
          const isCurrent = page === currentPage;
          const isLanding = page === landingPage;
          const isUnlocked = page <= maxReachable;
          const state = isCurrent
            ? "current"
            : isLanding
              ? "landing"
              : isUnlocked
                ? "unlocked"
                : "locked";

          return {
            page,
            state,
            isUnlocked,
            canOpen: isUnlocked || pageCredits > 0,
          };
        })
      : [];

  useEffect(() => {
    if (!readerOnlyMode || !pageProgressSegments.length) {
      setIsProgressVisible(false);
      return undefined;
    }

    const clearProgressTimer = () => {
      if (progressHideTimerRef.current) {
        window.clearTimeout(progressHideTimerRef.current);
        progressHideTimerRef.current = null;
      }
    };

    const scheduleProgressHide = () => {
      clearProgressTimer();
      progressHideTimerRef.current = window.setTimeout(() => {
        if (!progressHoverRef.current) {
          setIsProgressVisible(false);
        }
      }, 4000);
    };

    const showProgress = () => {
      setIsProgressVisible(true);
      scheduleProgressHide();
    };

    const onPointerMove = (event) => {
      const distanceFromBottom = window.innerHeight - event.clientY;
      if (distanceFromBottom <= 96) {
        showProgress();
      }
    };

    showProgress();
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      clearProgressTimer();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [currentPage, pageProgressSegments.length, readerOnlyMode]);

  return (
    <div
      className={`dash-grid${readerOnlyMode ? " library-reader-only-grid" : ""}`}
    >
      {!readerOnlyMode && (
        <section className="panel local-books-panel">
          <h2>Local Books</h2>
          <label className="upload-box" data-tutorial-anchor="library-upload">
            <span>
              {uploadState.busy
                ? "Uploading..."
                : hasReachedLocalLimit
                  ? "Limit reached"
                  : "Upload"}
            </span>
            <input
              type="file"
              accept={uploadAccept}
              onChange={onUploadBook}
              disabled={uploadState.busy || hasReachedLocalLimit}
            />
          </label>
          {uploadState.message && (
            <p className="status-text">{uploadState.message}</p>
          )}

          <div className="book-list" role="list">
            {localBooks.map((book) => (
              <article
                key={book._id}
                className={`book-card${book._id === selectedBookId ? " active" : ""}`}
              >
                <button
                  type="button"
                  className="book-card-select"
                  onClick={() => onSelectBook(book._id)}
                >
                  <div className="book-card-row">
                    <div className="book-card-thumb" aria-hidden>
                      {bookThumbnailMap?.[book._id]?.src ? (
                        <img
                          src={bookThumbnailMap[book._id].src}
                          alt={`${book.title} thumbnail`}
                          className="book-thumb-image"
                        />
                      ) : (
                        <span className="book-thumb-placeholder">
                          {String(book.fileType || "pdf").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="book-card-meta">
                      <span className="book-card-title-row">
                        <strong>{book.title}</strong>
                      </span>
                      <span>
                        Unlocked: {book.unlockedPages}/{book.pageCount}
                      </span>
                      <span>
                        Thumbnail page {Math.max(1, book.thumbnailPage ?? 1)}
                      </span>
                    </div>
                  </div>
                </button>
                {onRemoveBook ? (
                  <button
                    type="button"
                    className="ghost book-card-remove"
                    onClick={() => onRemoveBook(book._id)}
                    disabled={uploadState.busy}
                  >
                    Remove
                  </button>
                ) : null}
              </article>
            ))}
            {!localBooks.length && (
              <p className="status-text">No local books</p>
            )}
          </div>
        </section>
      )}

      {!readerOnlyMode && (
        <section className="panel official-books-panel">
          <div className="library-panel-head">
            <h2>Official Books</h2>
            <button
              type="button"
              className="ghost"
              onClick={() => onOpenOfficialMarketplace?.()}
            >
              Marketplace
            </button>
          </div>

          <div className="book-list" role="list">
            {officialBooks.map((book) => (
              <article
                key={book._id}
                className={`book-card${book._id === selectedBookId ? " active" : ""}`}
              >
                <button
                  type="button"
                  className="book-card-select"
                  onClick={() => onSelectBook(book._id)}
                >
                  <div className="book-card-row">
                    <div className="book-card-thumb" aria-hidden>
                      {bookThumbnailMap?.[book._id]?.src ? (
                        <img
                          src={bookThumbnailMap[book._id].src}
                          alt={`${book.title} thumbnail`}
                          className="book-thumb-image"
                        />
                      ) : (
                        <span className="book-thumb-placeholder">
                          {String(book.fileType || "pdf").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="book-card-meta">
                      <span className="book-card-title-row">
                        <strong>{book.title}</strong>
                      </span>
                      <span>
                        Unlocked: {book.unlockedPages}/{book.pageCount}
                      </span>
                      <span>
                        Thumbnail page {Math.max(1, book.thumbnailPage ?? 1)}
                      </span>
                    </div>
                  </div>
                </button>
                {onRemoveBook ? (
                  <button
                    type="button"
                    className="ghost book-card-remove"
                    onClick={() => onRemoveBook(book._id)}
                    disabled={uploadState.busy}
                  >
                    Remove
                  </button>
                ) : null}
              </article>
            ))}
            {!officialBooks.length && (
              <p className="status-text">No official books</p>
            )}
          </div>
        </section>
      )}

      {readerOnlyMode && (
      <section
        className="panel reader-panel library-reader-panel reader-only-panel"
      >
        {!readerOnlyMode && <h2>{selectedBook?.title ?? "Reader"}</h2>}
        {!selectedBook && (
          <p className="status-text">
            Select or upload a book to begin reading.
          </p>
        )}

        {selectedBook && (
          <>
            {!readerOnlyMode && (
              <div className="landing-control">
                <label>
                  Landing page
                  <input
                    type="number"
                    min={1}
                    max={selectedBook.pageCount}
                    value={landingPageInput}
                    onChange={(event) =>
                      setLandingPageInput(Number(event.target.value))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ghost"
                  onClick={onSaveLandingPage}
                  title="Sets the first page you can always start from, even when later pages are locked."
                >
                  Save Landing Page
                </button>
                <HintPopover
                  label="Landing page info"
                  message="The landing page is your guaranteed restart point. Pages after it can stay locked until earned through reading time."
                />
              </div>
            )}

            {!readerOnlyMode && (
              <div className="landing-control thumbnail-control">
                <label>
                  Thumbnail page
                  <input
                    type="number"
                    min={1}
                    max={selectedBook.pageCount}
                    value={thumbnailPageInput ?? 1}
                    onChange={(event) =>
                      setThumbnailPageInput?.(Number(event.target.value))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ghost"
                  onClick={onSaveThumbnailPage}
                  title="Pick which page appears as this book card thumbnail."
                  disabled={!onSaveThumbnailPage}
                >
                  Save Thumbnail
                </button>
                <HintPopover
                  label="Thumbnail page info"
                  message="Choose which page appears on the book card so your library grid shows the visual you want."
                />
              </div>
            )}

            {!readerOnlyMode && (
              <div className="reader-toolbar">
                <button
                  type="button"
                  className="ghost"
                  onClick={goPrevPage}
                  disabled={!usesPageNavigation || currentPage <= 1}
                >
                  Prev
                </button>

                {usesPageNavigation ? (
                  <select
                    value={currentPage}
                    onChange={(event) => {
                      const page = Number(event.target.value);
                      if (page < 1 || page > selectedBook.pageCount) {
                        return;
                      }
                      void requestPage(page);
                    }}
                  >
                    {Array.from(
                      { length: selectedBook.pageCount },
                      (_, index) => index + 1,
                    ).map((pageOption) => (
                      <option
                        key={pageOption}
                        value={pageOption}
                        disabled={pageOption > maxReachable && pageCredits <= 0}
                      >
                        Page {pageOption}
                        {pageOption > maxReachable ? " (locked)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="reader-format-pill">
                    {String(selectedBookFileType || "").toUpperCase()} file
                  </div>
                )}

                <button
                  type="button"
                  className="ghost"
                  onClick={goNextPage}
                  disabled={!usesPageNavigation || currentPage >= pageCount}
                >
                  Next
                </button>

                <button
                  type="button"
                  className="ghost fullscreen-btn"
                  onClick={() => {
                    if (!selectedBook?._id || isActiveBookTabOpen) {
                      return;
                    }

                    onOpenReadingTab?.(selectedBook._id);
                  }}
                  disabled={!usesPageNavigation || isActiveBookTabOpen}
                >
                  Open Reader
                </button>
              </div>
            )}

            {!readerOnlyMode && (
              <p className="status-text">
                Showing page {currentPage} of {pageCount}. Landing page{" "}
                {landingPage}. Accessible pages 1-{maxReachable}. Unlocked{" "}
                {unlockedPages} pages.
              </p>
            )}

            <div
              className={`page-stage${readerOnlyMode ? " reader-only-page-stage" : ""}`}
              data-reader-stage={readerOnlyMode ? "true" : undefined}
            >
              {readerOnlyMode && readerLoading && (
                <div
                  className="reader-loading-screen"
                  role="status"
                  aria-label={`Loading ${normalizedReaderLoadingProgress}%`}
                  style={{
                    "--reader-loading-progress": `${normalizedReaderLoadingProgress}%`,
                  }}
                >
                  <span>
                    <b>{normalizedReaderLoadingProgress}</b>
                  </span>
                </div>
              )}
              {!readerOnlyMode && (isRendering || altViewerLoading) && (
                <p className="status-text">Rendering page...</p>
              )}
              {renderError && <p className="error-text">{renderError}</p>}
              {altViewerError && <p className="error-text">{altViewerError}</p>}
              <div
                className={`page-frame${isReaderExpanded ? " fullscreen" : ""}${isReaderExpanded && isLandscapePage ? " landscape-page" : ""}${readerOnlyMode ? " reader-only-frame" : ""}`}
              >
                {isReaderExpanded && usesPageNavigation && !readerOnlyMode && (
                  <div className="fullscreen-overlay-controls">
                    <button
                      type="button"
                      className="ghost"
                      onClick={goPrevPage}
                      disabled={currentPage <= 1}
                    >
                      Prev
                    </button>

                    <select
                      value={currentPage}
                      onChange={(event) => {
                        const page = Number(event.target.value);
                        if (page < 1 || page > selectedBook.pageCount) {
                          return;
                        }
                        void requestPage(page);
                      }}
                    >
                      {Array.from(
                        { length: selectedBook.pageCount },
                        (_, index) => index + 1,
                      ).map((pageOption) => (
                        <option
                          key={`fullscreen-${pageOption}`}
                          value={pageOption}
                          disabled={pageOption > maxReachable && pageCredits <= 0}
                        >
                          Page {pageOption}
                          {pageOption > maxReachable ? " (locked)" : ""}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="ghost"
                      onClick={goNextPage}
                      disabled={currentPage >= pageCount}
                    >
                      Next
                    </button>
                  </div>
                )}
                {isReaderExpanded && usesPageNavigation && (
                  <div className="fullscreen-page-zones" aria-hidden="true">
                    <button
                      type="button"
                      className="page-zone page-zone-prev"
                      onClick={goPrevPage}
                      disabled={currentPage <= 1}
                      title="Go to previous page"
                    >
                      <span>Prev</span>
                    </button>
                    <div className="page-zone-center" />
                    <button
                      type="button"
                      className="page-zone page-zone-next"
                      onClick={goNextPage}
                      disabled={currentPage >= pageCount}
                      title="Go to next page"
                    >
                      <span>Next</span>
                    </button>
                  </div>
                )}
                {selectedBookFileType === "pdf" && (
                  <canvas ref={canvasRef} aria-label={`Page ${currentPage}`} />
                )}

                {selectedBookFileType === "epub" && (
                  <div ref={epubContainerRef} className="epub-viewer" />
                )}

                {selectedBookFileType === "cbz" && (
                  <div className="cbz-viewer">
                    {cbzImageUrl ? (
                      <img
                        src={cbzImageUrl}
                        alt={`Comic page ${currentPage}`}
                        className="cbz-page-image"
                      />
                    ) : (
                      <p className="status-text">
                        This CBZ file has no readable image pages.
                      </p>
                    )}
                  </div>
                )}

                {isUnsupportedInline && (
                  <div className="compatibility-viewer">
                    <p className="status-text">
                      {String(selectedBookFileType || "").toUpperCase()} files
                      are supported in your library. If the embedded preview
                      fails, use Open or Download below.
                    </p>
                    {selectedBookFileUrl && (
                      <>
                        <iframe
                          src={selectedBookFileUrl}
                          title={`${selectedBook?.title || "Book"} preview`}
                          className="generic-file-preview"
                        />
                        <div className="market-actions-row">
                          <a
                            href={selectedBookFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ghost inline-link-button"
                          >
                            Open File
                          </a>
                          <a
                            href={selectedBookFileUrl}
                            download
                            className="ghost inline-link-button"
                          >
                            Download File
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {readerOnlyMode && pageProgressSegments.length > 0 && (
                <div
                  className={`reader-page-progress${isProgressVisible ? "" : " is-hidden"}`}
                  style={{
                    "--reader-page-count": pageProgressSegments.length,
                  }}
                  aria-label="Page progress"
                  onMouseEnter={() => {
                    progressHoverRef.current = true;
                    setIsProgressVisible(true);
                    if (progressHideTimerRef.current) {
                      window.clearTimeout(progressHideTimerRef.current);
                      progressHideTimerRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    progressHoverRef.current = false;
                    if (progressHideTimerRef.current) {
                      window.clearTimeout(progressHideTimerRef.current);
                    }
                    progressHideTimerRef.current = window.setTimeout(() => {
                      setIsProgressVisible(false);
                    }, 4000);
                  }}
                >
                  {pageProgressSegments.map((segment) => (
                    <button
                      key={segment.page}
                      type="button"
                      className={`reader-page-segment is-${segment.state}`}
                      onClick={() => {
                        if (!segment.canOpen) {
                          return;
                        }
                        void requestPage(segment.page);
                      }}
                      aria-disabled={!segment.canOpen}
                      aria-label={`Page ${segment.page}`}
                      aria-current={
                        segment.state === "current" ? "page" : undefined
                      }
                    >
                      <span>{segment.page}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
      )}
    </div>
  );
}
