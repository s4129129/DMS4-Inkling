import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const name = user.name ?? "";
    const email = user.email ?? "";
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const image = profile?.userIconStorageId
      ? await ctx.storage.getUrl(profile.userIconStorageId)
      : null;
    const label = name || email || "Signed-in user";

    const initials = label
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return {
      _id: user._id,
      name,
      email,
      image,
      iconPreset: profile?.userIconPreset ?? "comic-light",
      initials: initials || "U",
    };
  },
});

export const setDisplayName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const trimmed = String(args.name || "").trim();
    const safeName = trimmed.slice(0, 48);
    if (!safeName) {
      throw new Error("Display name cannot be empty.");
    }

    await ctx.db.patch(userId, { name: safeName });
    return { ok: true, name: safeName };
  },
});
