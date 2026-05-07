import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const LOCAL_BOOK_LIMIT = 3;

async function requireUserId(ctx: {
  auth: { getUserIdentity: () => Promise<unknown> };
}) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

export const listBooks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const booksWithUrls = await Promise.all(
      books.map(async (book) => ({
        ...book,
        landingPage: book.landingPage ?? 1,
        lastReadPage: book.lastReadPage ?? book.landingPage ?? 1,
        thumbnailPage: book.thumbnailPage ?? 1,
        fileType: book.fileType ?? "pdf",
        pdfUrl:
          book.sourceUrl ??
          (book.storageId ? await ctx.storage.getUrl(book.storageId) : null),
      })),
    );

    return booksWithUrls.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createBook = mutation({
  args: {
    title: v.string(),
    storageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()),
    assetKey: v.optional(v.string()),
    assetHash: v.optional(v.string()),
    assetProvider: v.optional(v.string()),
    assetContentType: v.optional(v.string()),
    assetSize: v.optional(v.number()),
    coverUrl: v.optional(v.string()),
    coverAssetKey: v.optional(v.string()),
    fileType: v.optional(v.string()),
    pageCount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const pageCount = Math.max(1, Math.floor(args.pageCount));
    const title = args.title.trim() || "Untitled";

    if (!args.storageId && !args.sourceUrl) {
      throw new Error("Book source is required");
    }

    const userBooks = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (args.assetKey) {
      const existingBook = userBooks.find(
        (book) => book.assetKey === args.assetKey,
      );
      if (existingBook) {
        if (args.coverUrl && !existingBook.coverUrl) {
          await ctx.db.patch(existingBook._id, {
            coverUrl: args.coverUrl,
            coverAssetKey: args.coverAssetKey,
          });
        }
        return existingBook._id;
      }
    }

    if (args.storageId) {
      const localBookCount = userBooks.filter((book) => book.storageId).length;
      if (localBookCount >= LOCAL_BOOK_LIMIT) {
        throw new Error("Local file limit reached");
      }
    }

    return await ctx.db.insert("books", {
      userId,
      title,
      storageId: args.storageId,
      sourceUrl: args.sourceUrl,
      assetKey: args.assetKey,
      assetHash: args.assetHash,
      assetProvider: args.assetProvider,
      assetContentType: args.assetContentType,
      assetSize: args.assetSize,
      coverUrl: args.coverUrl,
      coverAssetKey: args.coverAssetKey,
      fileType: args.fileType,
      pageCount,
      unlockedPages: 1,
      landingPage: 1,
      lastReadPage: 1,
      thumbnailPage: 1,
      createdAt: Date.now(),
    });
  },
});

export const setLandingPage = mutation({
  args: {
    bookId: v.id("books"),
    landingPage: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error("Book not found");
    }

    const landingPage = Math.max(
      1,
      Math.min(book.pageCount, Math.floor(args.landingPage)),
    );
    await ctx.db.patch(args.bookId, { landingPage });
    return { landingPage };
  },
});

export const setLastReadPage = mutation({
  args: {
    bookId: v.id("books"),
    page: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error("Book not found");
    }

    const lastReadPage = Math.max(
      1,
      Math.min(book.pageCount, Math.floor(args.page)),
    );
    await ctx.db.patch(args.bookId, { lastReadPage });
    return { lastReadPage };
  },
});

export const unlockPageWithCredit = mutation({
  args: {
    bookId: v.id("books"),
    page: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error("Book not found");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      throw new Error("Profile not found");
    }

    const targetPage = Math.max(
      1,
      Math.min(book.pageCount, Math.floor(args.page)),
    );
    const currentUnlocked = Math.max(1, Math.floor(book.unlockedPages ?? 1));
    const availableCredits = Math.max(0, Math.floor(profile.pageCredits ?? 0));
    if (targetPage <= currentUnlocked) {
      return {
        unlockedPages: currentUnlocked,
        pageCredits: availableCredits,
        spent: 0,
      };
    }

    const pagesNeeded = targetPage - currentUnlocked;
    if (availableCredits < pagesNeeded) {
      throw new Error("Not enough pages");
    }

    const now = Date.now();
    await ctx.db.patch(args.bookId, {
      unlockedPages: targetPage,
      lastReadPage: targetPage,
    });
    await ctx.db.patch(profile._id, {
      pageCredits: availableCredits - pagesNeeded,
      updatedAt: now,
    });
    await ctx.db.insert("pageUnlockEvents", {
      userId,
      bookId: args.bookId,
      pagesUnlocked: pagesNeeded,
      inkEarned: 0,
      createdAt: now,
    });

    return {
      unlockedPages: targetPage,
      pageCredits: availableCredits - pagesNeeded,
      spent: pagesNeeded,
    };
  },
});

export const setThumbnailPage = mutation({
  args: {
    bookId: v.id("books"),
    page: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error("Book not found");
    }

    const thumbnailPage = Math.max(
      1,
      Math.min(book.pageCount, Math.floor(args.page)),
    );
    await ctx.db.patch(args.bookId, { thumbnailPage });
    return { thumbnailPage };
  },
});

export const removeBook = mutation({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new Error("Book not found");
    }

    await ctx.db.delete(args.bookId);
    if (book.storageId) {
      await ctx.storage.delete(book.storageId);
    }

    return { ok: true };
  },
});
