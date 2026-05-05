import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MINUTES_PER_PAGE = 20;
const MAX_SESSION_MINUTES = 120;
const DEFAULT_DAILY_QUOTA_PAGES = 3;
const DEFAULT_THEME = "default";
const DEFAULT_MODE = "dark";
const DEFAULT_TIME_ZONE = "UTC";
const DEFAULT_OWNED_THEMES = ["default"];
const DEFAULT_OWNED_FEATURES: string[] = [];
const DEFAULT_BANNER_POSITION_X = 50;
const DEFAULT_BANNER_POSITION_Y = 50;
const DEFAULT_BANNER_OPACITY = 0.24;
const DEFAULT_BANNER_SCALE = 100;
const GROUP_WEEKLY_REQUIRED_MEMBERS = 3;
const GROUP_WEEKLY_BASE_MINUTES = 80 * 60;
const GROUP_WEEKLY_QUILL_BREAKPOINTS = [
  { hours: 20, quills: 10 },
  { hours: 40, quills: 20 },
  { hours: 60, quills: 60 },
  { hours: 80, quills: 100 },
] as const;
type TimerEventType =
  | "started"
  | "paused"
  | "resumed"
  | "removed"
  | "completed";

async function requireUserId(ctx: {
  auth: { getUserIdentity: () => Promise<unknown> };
}) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

async function getOrCreateProfile(ctx: any, userId: any) {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  if (existing) {
    return existing;
  }

  const profileId = await ctx.db.insert("userProfiles", {
    userId,
    minutesPerPage: DEFAULT_MINUTES_PER_PAGE,
    dailyQuotaPages: DEFAULT_DAILY_QUOTA_PAGES,
    ink: 0,
    pageCredits: 0,
    quills: 0,
    selectedTheme: DEFAULT_THEME,
    selectedMode: DEFAULT_MODE,
    timeZone: DEFAULT_TIME_ZONE,
    ownedThemes: DEFAULT_OWNED_THEMES,
    ownedFeatures: DEFAULT_OWNED_FEATURES,
    customBannerStorageId: undefined,
    customBannerPositionX: DEFAULT_BANNER_POSITION_X,
    customBannerPositionY: DEFAULT_BANNER_POSITION_Y,
    customBannerOpacity: DEFAULT_BANNER_OPACITY,
    customBannerScale: DEFAULT_BANNER_SCALE,
    updatedAt: Date.now(),
  });

  return await ctx.db.get(profileId);
}

async function recordTimerEvent(
  ctx: any,
  userId: any,
  timerId: any,
  eventType: TimerEventType,
  createdAt: number,
) {
  await ctx.db.insert("timerEvents", {
    userId,
    timerId,
    eventType,
    createdAt,
  });
}

function normalizeTimeZone(timeZone?: string | null) {
  const safeTimeZone = String(timeZone || "").trim();
  if (!safeTimeZone) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: safeTimeZone }).format(
      new Date(),
    );
    return safeTimeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function localDatePartsForTimeZone(ts: number, timeZone?: string | null) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "1970"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "1"),
  };
}

function weekKeyForTimeZone(ts: number, timeZone?: string | null) {
  const { year, month, day } = localDatePartsForTimeZone(ts, timeZone);
  const localDateUtc = Date.UTC(year, month - 1, day);
  const dayOfWeek = new Date(localDateUtc).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayUtc = localDateUtc - daysSinceMonday * 24 * 60 * 60 * 1000;
  const monday = new Date(mondayUtc);
  return [
    monday.getUTCFullYear(),
    String(monday.getUTCMonth() + 1).padStart(2, "0"),
    String(monday.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeAwardedBreakpoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Math.floor(Number(item)))
    .filter((item) =>
      GROUP_WEEKLY_QUILL_BREAKPOINTS.some((breakpoint) => breakpoint.hours === item),
    );
}

function groupWeeklyTargetMultiplier(memberCount: number) {
  if (memberCount >= 5) {
    return 3.5;
  }
  if (memberCount === 4) {
    return 3;
  }
  if (memberCount >= 3) {
    return 2;
  }
  return 0;
}

function groupWeeklyTargetMinutes(memberCount: number) {
  return Math.floor(GROUP_WEEKLY_BASE_MINUTES * groupWeeklyTargetMultiplier(memberCount));
}

async function syncGroupWeeklyProgressFromClaim(
  ctx: any,
  userId: any,
  claimedMinutes: number,
  now: number,
) {
  if (claimedMinutes <= 0) {
    return;
  }

  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (!memberships.length) {
    return;
  }

  const userProfile = await getOrCreateProfile(ctx, userId);
  const weekKey = weekKeyForTimeZone(now, userProfile?.timeZone);

  for (const membership of memberships) {
    const group = await ctx.db.get(membership.groupId);
    if (!group) {
      continue;
    }

    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q: any) => q.eq("groupId", group._id))
      .collect();
    if (members.length < GROUP_WEEKLY_REQUIRED_MEMBERS) {
      continue;
    }

    const existingProgress = await ctx.db
      .query("groupMonthlyProgress")
      .withIndex("by_group_month", (q: any) =>
        q.eq("groupId", group._id).eq("monthKey", weekKey),
      )
      .unique();

    const weeklyTargetMinutes = groupWeeklyTargetMinutes(members.length);
    const targetMultiplier = groupWeeklyTargetMultiplier(members.length);
    const previousMinutes = Math.min(
      weeklyTargetMinutes,
      Math.max(0, existingProgress?.contributedMinutes ?? 0),
    );
    const nextMinutes = Math.min(
      weeklyTargetMinutes,
      previousMinutes + Math.max(0, Math.floor(claimedMinutes)),
    );
    const reachedCompletion = nextMinutes >= weeklyTargetMinutes;
    const awardedBreakpoints = new Set(
      normalizeAwardedBreakpoints(existingProgress?.awardedBreakpoints),
    );
    const newlyReachedBreakpoints = GROUP_WEEKLY_QUILL_BREAKPOINTS.filter(
      (breakpoint) => {
        const breakpointMinutes = Math.floor(
          breakpoint.hours * 60 * targetMultiplier,
        );
        return (
          nextMinutes >= breakpointMinutes &&
          previousMinutes < breakpointMinutes &&
          !awardedBreakpoints.has(breakpoint.hours)
        );
      },
    );
    const quillsEarned = newlyReachedBreakpoints.reduce(
      (sum, breakpoint) => sum + breakpoint.quills,
      0,
    );
    for (const breakpoint of newlyReachedBreakpoints) {
      awardedBreakpoints.add(breakpoint.hours);
    }

    let progressId = existingProgress?._id;
    if (existingProgress) {
      await ctx.db.patch(existingProgress._id, {
        monthlyBookTitle: "Weekly group timer progress",
        monthlyBookPageTarget: Math.floor(weeklyTargetMinutes / 60),
        contributedMinutes: nextMinutes,
        unlockedPages: Math.floor(nextMinutes / 60),
        awardedBreakpoints: Array.from(awardedBreakpoints).sort((a, b) => a - b),
        completedAt:
          existingProgress.completedAt ?? (reachedCompletion ? now : undefined),
        rewardedAt: existingProgress.rewardedAt ?? (reachedCompletion ? now : undefined),
        updatedAt: now,
      });
    } else {
      progressId = await ctx.db.insert("groupMonthlyProgress", {
        groupId: group._id,
        monthKey: weekKey,
        monthlyBookTitle: "Weekly group timer progress",
        monthlyBookPageTarget: Math.floor(weeklyTargetMinutes / 60),
        contributedMinutes: nextMinutes,
        unlockedPages: Math.floor(nextMinutes / 60),
        awardedBreakpoints: Array.from(awardedBreakpoints).sort((a, b) => a - b),
        completedAt: reachedCompletion ? now : undefined,
        rewardedAt: reachedCompletion ? now : undefined,
        updatedAt: now,
      });
    }

    if (!progressId || quillsEarned <= 0) {
      continue;
    }

    for (const member of members) {
      const memberProfile = await getOrCreateProfile(ctx, member.userId);
      await ctx.db.patch(memberProfile._id, {
        quills: Math.max(0, memberProfile.quills ?? 0) + quillsEarned,
        updatedAt: now,
      });
    }
  }
}

export const listTimers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const timers = await ctx.db
      .query("timers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return timers
      .map((timer) => {
        const pausedAt = timer.pausedAt ?? null;
        const canceledAt = timer.canceledAt ?? null;
        const checkpoint = pausedAt ?? now;
        const remainingMs = Math.max(0, timer.endsAt - checkpoint);

        return {
          ...timer,
          rewardInk:
            timer.rewardInk ??
            Math.max(1, Math.floor((timer.durationSeconds ?? 0) / 60)),
          pausedAt,
          canceledAt,
          completedAt: timer.completedAt ?? null,
          remainingMs,
          isPaused: Boolean(pausedAt),
          isCanceled: Boolean(canceledAt),
          isClaimable:
            !timer.claimedAt &&
            !canceledAt &&
            !pausedAt &&
            remainingMs <= 0,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createTimer = mutation({
  args: {
    label: v.string(),
    durationMinutes: v.number(),
    rewardPages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const requestedMinutes = Number.isFinite(args.durationMinutes)
      ? args.durationMinutes
      : 1;
    const minutes = Math.min(
      MAX_SESSION_MINUTES,
      Math.max(1, Math.floor(requestedMinutes)),
    );
    const ratio = Math.max(
      1,
      Math.floor(profile.minutesPerPage ?? DEFAULT_MINUTES_PER_PAGE),
    );
    const rewardPages = Math.max(
      1,
      Math.floor((args.rewardPages ?? minutes) / ratio),
    );
    const rewardInk = minutes;
    const now = Date.now();

    const timerId = await ctx.db.insert("timers", {
      userId,
      label: args.label.trim() || "Reading session",
      durationSeconds: minutes * 60,
      endsAt: now + minutes * 60 * 1000,
      rewardPages,
      rewardInk,
      pausedAt: undefined,
      canceledAt: undefined,
      completedAt: undefined,
      createdAt: now,
      claimedAt: undefined,
    });

    await recordTimerEvent(ctx, userId, timerId, "started", now);
    return timerId;
  },
});

export const togglePauseTimer = mutation({
  args: {
    timerId: v.id("timers"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const timer = await ctx.db.get(args.timerId);
    if (!timer || timer.userId !== userId) {
      throw new Error("Timer not found");
    }
    if (timer.canceledAt || timer.claimedAt) {
      throw new Error("Timer can no longer be changed");
    }

    const now = Date.now();
    if (timer.pausedAt) {
      const pausedDuration = now - timer.pausedAt;
      await ctx.db.patch(args.timerId, {
        pausedAt: undefined,
        endsAt: timer.endsAt + pausedDuration,
      });
      await recordTimerEvent(ctx, userId, args.timerId, "resumed", now);
      return { isPaused: false };
    }

    await ctx.db.patch(args.timerId, { pausedAt: now });
    await recordTimerEvent(ctx, userId, args.timerId, "paused", now);
    return { isPaused: true };
  },
});

export const cancelTimer = mutation({
  args: {
    timerId: v.id("timers"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const timer = await ctx.db.get(args.timerId);
    if (!timer || timer.userId !== userId) {
      throw new Error("Timer not found");
    }
    if (timer.claimedAt) {
      throw new Error("Cannot cancel a claimed timer");
    }

    const now = Date.now();

    await ctx.db.patch(args.timerId, {
      canceledAt: now,
      pausedAt: undefined,
    });
    await recordTimerEvent(ctx, userId, args.timerId, "removed", now);
    return { canceled: true };
  },
});

export const completeTimer = mutation({
  args: {
    timerId: v.id("timers"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const timer = await ctx.db.get(args.timerId);
    if (!timer || timer.userId !== userId) {
      throw new Error("Timer not found");
    }
    if (timer.canceledAt) {
      throw new Error("Canceled timer cannot complete");
    }
    if (timer.claimedAt || timer.completedAt) {
      return { completedAt: timer.completedAt ?? timer.endsAt };
    }
    if (timer.pausedAt) {
      throw new Error("Paused timer cannot complete");
    }
    if (timer.endsAt > now) {
      throw new Error("Timer not finished yet");
    }

    const completedAt = timer.endsAt;
    await ctx.db.patch(args.timerId, { completedAt });
    await recordTimerEvent(ctx, userId, args.timerId, "completed", completedAt);
    return { completedAt };
  },
});

export const claimTimerReward = mutation({
  args: {
    timerId: v.id("timers"),
    bookId: v.optional(v.id("books")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const timer = await ctx.db.get(args.timerId);
    if (!timer || timer.userId !== userId) {
      throw new Error("Timer not found");
    }
    if (timer.canceledAt) {
      throw new Error("Canceled timer has no reward");
    }
    if (timer.pausedAt) {
      throw new Error("Resume timer before claiming");
    }
    if (timer.claimedAt) {
      throw new Error("Reward already claimed");
    }
    if (timer.endsAt > now) {
      throw new Error("Timer not finished yet");
    }

    if (args.bookId) {
      const book = await ctx.db.get(args.bookId);
      if (!book || book.userId !== userId) {
        throw new Error("Book not found");
      }
    }

    const earnedPageCredits = Math.max(0, Math.floor(timer.rewardPages ?? 0));
    const rewardInk =
      timer.rewardInk ??
      Math.max(1, Math.floor((timer.durationSeconds ?? 0) / 60));
    const profile = await getOrCreateProfile(ctx, userId);

    const completedAt = timer.completedAt ?? timer.endsAt;

    await ctx.db.patch(args.timerId, {
      claimedAt: now,
      completedAt,
    });
    if (!timer.completedAt) {
      await recordTimerEvent(
        ctx,
        userId,
        args.timerId,
        "completed",
        completedAt,
      );
    }
    await ctx.db.patch(profile._id, {
      ink: Math.max(0, (profile.ink ?? 0) + rewardInk),
      pageCredits: Math.max(0, profile.pageCredits ?? 0) + earnedPageCredits,
      updatedAt: now,
    });

    await syncGroupWeeklyProgressFromClaim(
      ctx,
      userId,
      Math.max(1, Math.floor((timer.durationSeconds ?? 0) / 60)),
      completedAt,
    );

    return {
      pageCreditsEarned: earnedPageCredits,
      pageCredits: Math.max(0, profile.pageCredits ?? 0) + earnedPageCredits,
      inkEarned: rewardInk,
    };
  },
});
