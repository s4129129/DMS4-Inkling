import { useCallback, useMemo, useState } from "react";
import {
  OFFICIAL_BOOKS,
  OFFICIAL_BOOK_BY_ID,
  getOfficialBookAsset,
} from "../reader/officialBooks";

function normalizeTitleKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOfficialBook(book, optimisticOwnedBookIds, ownedTitleKeys) {
  const fallbackBook =
    OFFICIAL_BOOK_BY_ID[book.id] ?? getOfficialBookAsset(book) ?? {};
  const title = book.title ?? fallbackBook.title ?? "Official Book";
  const cost = book.cost ?? fallbackBook.cost ?? 0;
  const bookId = book.id ?? fallbackBook.id ?? "";
  const owned =
    Boolean(book.owned) ||
    cost === 0 ||
    optimisticOwnedBookIds.has(bookId);

  return {
    ...fallbackBook,
    ...book,
    id: bookId,
    title,
    cost,
    owned,
    affordable: owned || book.affordable || cost === 0,
    fileType: book.fileType ?? fallbackBook.fileType ?? "pdf",
    pageCount: book.pageCount ?? fallbackBook.pageCount ?? 1,
    pdfUrl: book.pdfUrl ?? fallbackBook.pdfUrl ?? null,
    coverUrl: book.coverUrl ?? fallbackBook.coverUrl ?? "",
    added: ownedTitleKeys.has(normalizeTitleKey(title)),
  };
}

export function useOfficialBookLibrary({
  bookList,
  officialBookMarket,
  createBook,
  buyOfficialBook,
  setUploadState,
  setMarketMessage,
}) {
  const [optimisticOwnedBookIds, setOptimisticOwnedBookIds] = useState(
    () => new Set(),
  );

  const ownedTitleKeys = useMemo(
    () => new Set(bookList.map((book) => normalizeTitleKey(book.title))),
    [bookList],
  );

  const officialBooksWithState = useMemo(() => {
    const sourceBooks = officialBookMarket.length
      ? officialBookMarket
      : OFFICIAL_BOOKS;

    return sourceBooks.map((book) =>
      normalizeOfficialBook(book, optimisticOwnedBookIds, ownedTitleKeys),
    );
  }, [officialBookMarket, optimisticOwnedBookIds, ownedTitleKeys]);

  const officialBooksInLibrary = useMemo(
    () => officialBooksWithState.filter((book) => book.added),
    [officialBooksWithState],
  );

  const markOwnedOptimistically = useCallback((bookId) => {
    const safeBookId = String(bookId || "").trim();
    if (!safeBookId) {
      return;
    }

    setOptimisticOwnedBookIds((previousIds) => {
      if (previousIds.has(safeBookId)) {
        return previousIds;
      }

      const nextIds = new Set(previousIds);
      nextIds.add(safeBookId);
      return nextIds;
    });
  }, []);

  const importOfficialBookToLibrary = useCallback(
    async (officialBook) => {
      if (ownedTitleKeys.has(normalizeTitleKey(officialBook.title))) {
        setUploadState({
          busy: false,
          message: "Official book already in your library.",
        });
        return { added: false, alreadyAdded: true };
      }

      setUploadState({ busy: true, message: "Importing official book..." });

      try {
        const officialAsset = getOfficialBookAsset(officialBook);
        const sourceUrl = officialAsset?.pdfUrl ?? officialBook.pdfUrl;
        const pageCount = Math.max(
          1,
          Math.floor(officialAsset?.pageCount ?? officialBook.pageCount ?? 1),
        );

        if (!sourceUrl) {
          throw new Error("Missing official book asset.");
        }

        await createBook({
          title: officialBook.title,
          sourceUrl,
          pageCount,
          fileType: officialAsset?.fileType ?? officialBook.fileType ?? "pdf",
        });

        setUploadState({
          busy: false,
          message: `Added official book: ${officialBook.title}`,
        });
        return { added: true };
      } catch {
        setUploadState({
          busy: false,
          message: "Could not add official book.",
        });
        return { added: false, error: true };
      }
    },
    [createBook, ownedTitleKeys, setUploadState],
  );

  const onBuyOfficialBook = useCallback(
    async (officialBook) => {
      setMarketMessage("");
      try {
        const result = await buyOfficialBook({ bookId: officialBook.id });
        markOwnedOptimistically(officialBook.id);
        setMarketMessage(result?.owned ? "Already owned." : "Book purchased.");
        await importOfficialBookToLibrary({ ...officialBook, owned: true });
      } catch {
        setMarketMessage("Purchase failed. Not enough Quills.");
      }
    },
    [
      buyOfficialBook,
      importOfficialBookToLibrary,
      markOwnedOptimistically,
      setMarketMessage,
    ],
  );

  const onAddOfficialBook = useCallback(
    async (officialBook) => {
      if (!officialBook.owned) {
        setUploadState({
          busy: false,
          message: "Buy first.",
        });
        return;
      }

      await importOfficialBookToLibrary(officialBook);
    },
    [importOfficialBookToLibrary, setUploadState],
  );

  return {
    officialBooksWithState,
    officialBooksInLibrary,
    onBuyOfficialBook,
    onAddOfficialBook,
  };
}
