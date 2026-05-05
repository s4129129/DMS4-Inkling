import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_PATHS = 80;
const MAX_RECENT_SESSIONS = 30;

type SegmentKey = "all" | "local" | "production" | "other";

function sanitizePathCounts(input: unknown) {
  if (!input || typeof input !== "object") {
    return {} as Record<string, number>;
  }

  const entries = Object.entries(input as Record<string, unknown>)
    .filter(
      ([key, value]) => typeof key === "string" && typeof value === "number",
    )
    .slice(0, MAX_PATHS)
    .map(
      ([key, value]) =>
        [key.slice(0, 240), Math.max(0, Math.floor(value as number))] as const,
    );

  return Object.fromEntries(entries);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function classifyHost(sourceHost: string): Exclude<SegmentKey, "all"> {
  const host = (sourceHost || "").toLowerCase().replace(/:\d+$/, "");
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  ) {
    return "local";
  }
  if (
    host === "inklingreader.xyz" ||
    host === "www.inklingreader.xyz" ||
    host === "s4129129.github.io" ||
    host.includes("dms.onl")
  ) {
    return "production";
  }
  return "other";
}

function normalizeSegment(input?: string): SegmentKey {
  if (input === "local" || input === "production" || input === "other") {
    return input;
  }
  if (input === "namecheap") {
    return "production";
  }
  return "all";
}

function matchesSegment(sourceHost: string, segment: SegmentKey) {
  if (segment === "all") {
    return true;
  }
  return classifyHost(sourceHost) === segment;
}

function isAuthenticatedSession(sessionStage?: string) {
  return sessionStage === "authenticated";
}

function userIdentityKey(session: {
  googleAccountEmail?: string;
  appUserId?: string;
  visitorKey: string;
}) {
  return session.googleAccountEmail ?? session.appUserId ?? session.visitorKey;
}

export const ingestSnapshot = internalMutation({
  args: {
    sessionKey: v.string(),
    visitorKey: v.string(),
    appUserId: v.optional(v.string()),
    googleAccountName: v.optional(v.string()),
    googleAccountEmail: v.optional(v.string()),
    sessionStage: v.optional(v.string()),
    sourceHost: v.string(),
    timestamp: v.number(),
    durationSec: v.number(),
    pageViews: v.number(),
    maxScrollPercent: v.number(),
    lastPath: v.string(),
    pathCounts: v.any(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    endedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analyticsSessions")
      .withIndex("by_session_key", (q) => q.eq("sessionKey", args.sessionKey))
      .unique();

    const incomingPathCounts = sanitizePathCounts(args.pathCounts);
    const ts = Math.max(0, Math.floor(args.timestamp));
    const durationSec = Math.max(0, Math.floor(args.durationSec));
    const pageViews = Math.max(0, Math.floor(args.pageViews));
    const maxScrollPercent = clampNumber(
      Math.floor(args.maxScrollPercent),
      0,
      100,
    );

    if (!existing) {
      await ctx.db.insert("analyticsSessions", {
        sessionKey: args.sessionKey,
        visitorKey: args.visitorKey,
        appUserId: args.appUserId?.slice(0, 120),
        googleAccountName: args.googleAccountName?.slice(0, 160),
        googleAccountEmail: args.googleAccountEmail?.slice(0, 240),
        sessionStage: args.sessionStage?.slice(0, 40),
        sourceHost: args.sourceHost,
        firstSeen: ts,
        lastSeen: ts,
        durationSec,
        pageViews,
        maxScrollPercent,
        lastPath: args.lastPath.slice(0, 320),
        pathCounts: incomingPathCounts,
        referrer: args.referrer?.slice(0, 400),
        userAgent: args.userAgent?.slice(0, 600),
        endedBy: args.endedBy?.slice(0, 40),
      });
      return { ok: true, inserted: true };
    }

    const mergedPathCounts = {
      ...(existing.pathCounts ?? {}),
      ...incomingPathCounts,
    } as Record<string, number>;

    await ctx.db.patch(existing._id, {
      appUserId: args.appUserId?.slice(0, 120) ?? existing.appUserId,
      googleAccountName:
        args.googleAccountName?.slice(0, 160) ?? existing.googleAccountName,
      googleAccountEmail:
        args.googleAccountEmail?.slice(0, 240) ?? existing.googleAccountEmail,
      sessionStage: args.sessionStage?.slice(0, 40) ?? existing.sessionStage,
      sourceHost: args.sourceHost || existing.sourceHost,
      lastSeen: Math.max(existing.lastSeen, ts),
      durationSec: Math.max(existing.durationSec, durationSec),
      pageViews: Math.max(existing.pageViews, pageViews),
      maxScrollPercent: Math.max(existing.maxScrollPercent, maxScrollPercent),
      lastPath: args.lastPath.slice(0, 320),
      pathCounts: sanitizePathCounts(mergedPathCounts),
      referrer: args.referrer?.slice(0, 400) ?? existing.referrer,
      userAgent: args.userAgent?.slice(0, 600) ?? existing.userAgent,
      endedBy: args.endedBy?.slice(0, 40),
    });

    return { ok: true, inserted: false };
  },
});

export const summary = query({
  args: {
    windowHours: v.optional(v.number()),
    limit: v.optional(v.number()),
    segment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowHours = clampNumber(
      Math.floor(args.windowHours ?? 24 * 30),
      1,
      24 * 365,
    );
    const limit = clampNumber(Math.floor(args.limit ?? 2000), 1, 5000);
    const since = now - windowHours * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("analyticsSessions")
      .withIndex("by_last_seen", (q) => q.gte("lastSeen", since))
      .order("desc")
      .take(limit);

    const segment = normalizeSegment(args.segment);
    const filteredSessions = sessions.filter((session) =>
      matchesSegment(session.sourceHost, segment),
    );

    const breakdown = {
      local: { sessions: 0, users: 0, pageViews: 0 },
      production: { sessions: 0, users: 0, pageViews: 0 },
      other: { sessions: 0, users: 0, pageViews: 0 },
    };
    const breakdownVisitors = {
      local: new Set<string>(),
      production: new Set<string>(),
      other: new Set<string>(),
    };

    for (const session of sessions) {
      const bucket = classifyHost(session.sourceHost);
      breakdown[bucket].sessions += 1;
      breakdown[bucket].pageViews += session.pageViews;
      if (isAuthenticatedSession(session.sessionStage)) {
        breakdownVisitors[bucket].add(userIdentityKey(session));
      }
    }

    breakdown.local.users = breakdownVisitors.local.size;
    breakdown.production.users = breakdownVisitors.production.size;
    breakdown.other.users = breakdownVisitors.other.size;

    const visitorSet = new Set<string>();
    const activeVisitorSet = new Set<string>();
    let totalDuration = 0;
    let totalPageViews = 0;
    let bounceCount = 0;

    const pathMap = new Map<string, number>();
    const durationBuckets = [
      { label: "0-1m", min: 0, max: 60, count: 0 },
      { label: "1-5m", min: 60, max: 300, count: 0 },
      { label: "5-15m", min: 300, max: 900, count: 0 },
      { label: "15-30m", min: 900, max: 1800, count: 0 },
      { label: "30-60m", min: 1800, max: 3600, count: 0 },
      { label: "60-120m", min: 3600, max: 7200, count: 0 },
      { label: "2-4h", min: 7200, max: 14400, count: 0 },
      { label: "4-8h", min: 14400, max: 28800, count: 0 },
      { label: "8-12h", min: 28800, max: 43200, count: 0 },
      { label: "12h+", min: 43200, max: Number.POSITIVE_INFINITY, count: 0 },
    ];

    const groupedUsersMap = new Map<
      string,
      {
        userId: string;
        googleAccountName?: string;
        googleAccountEmail?: string;
        appUserId?: string;
        sessionCount: number;
        totalDurationSec: number;
        totalPageViews: number;
        lastSeen: number;
        sessions: Array<{
          id: string;
          sessionStage?: string;
          durationSec: number;
          pageViews: number;
          maxScrollPercent: number;
          sourceHost: string;
          lastPath: string;
          lastSeen: number;
        }>;
      }
    >();

    for (const session of filteredSessions) {
      const isAuthenticated = isAuthenticatedSession(session.sessionStage);
      if (isAuthenticated) {
        const identityKey = userIdentityKey(session);
        visitorSet.add(identityKey);
        if (now - session.lastSeen <= 5 * 60 * 1000) {
          activeVisitorSet.add(identityKey);
        }
      }
      totalDuration += session.durationSec;
      totalPageViews += session.pageViews;

      if (session.pageViews <= 1) {
        bounceCount += 1;
      }

      const counts = sanitizePathCounts(session.pathCounts);
      const entries = Object.entries(counts);

      if (entries.length === 0 && session.lastPath) {
        pathMap.set(
          session.lastPath,
          (pathMap.get(session.lastPath) ?? 0) + Math.max(1, session.pageViews),
        );
      } else {
        for (const [path, hits] of entries) {
          pathMap.set(path, (pathMap.get(path) ?? 0) + Math.max(0, hits));
        }
      }

      for (const bucket of durationBuckets) {
        if (
          session.durationSec >= bucket.min &&
          session.durationSec < bucket.max
        ) {
          bucket.count += 1;
          break;
        }
      }

      if (!isAuthenticated) {
        continue;
      }

      const groupKey = userIdentityKey(session);
      const group = groupedUsersMap.get(groupKey) ?? {
        userId: session.visitorKey,
        googleAccountName: session.googleAccountName,
        googleAccountEmail: session.googleAccountEmail,
        appUserId: session.appUserId,
        sessionCount: 0,
        totalDurationSec: 0,
        totalPageViews: 0,
        lastSeen: 0,
        sessions: [],
      };
      group.sessionCount += 1;
      group.totalDurationSec += session.durationSec;
      group.totalPageViews += session.pageViews;
      group.lastSeen = Math.max(group.lastSeen, session.lastSeen);
      group.sessions.push({
        id: session.sessionKey,
        sessionStage: session.sessionStage,
        durationSec: session.durationSec,
        pageViews: session.pageViews,
        maxScrollPercent: session.maxScrollPercent,
        sourceHost: session.sourceHost,
        lastPath: session.lastPath,
        lastSeen: session.lastSeen,
      });
      groupedUsersMap.set(groupKey, group);
    }

    const totalSessions = filteredSessions.length;
    const avgSessionSec = totalSessions > 0 ? totalDuration / totalSessions : 0;
    const bounceRate =
      totalSessions > 0 ? (bounceCount / totalSessions) * 100 : 0;

    const topPages = Array.from(pathMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([path, hits]) => ({ path, hits }));

    const recentSessions = filteredSessions
      .slice(0, MAX_RECENT_SESSIONS)
      .map((session) => ({
        id: session.sessionKey,
        userId: session.visitorKey,
        appUserId: session.appUserId,
        googleAccountName: session.googleAccountName,
        googleAccountEmail: session.googleAccountEmail,
        sessionStage: session.sessionStage,
        durationSec: session.durationSec,
        pageViews: session.pageViews,
        maxScrollPercent: session.maxScrollPercent,
        lastPath: session.lastPath,
        lastSeen: session.lastSeen,
        sourceHost: session.sourceHost,
      }));

    const groupedUsers = Array.from(groupedUsersMap.values())
      .map((group) => ({
        ...group,
        sessions: group.sessions
          .sort((a, b) => b.lastSeen - a.lastSeen)
          .slice(0, 10),
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 40);

    return {
      source: "convex",
      segment,
      windowHours,
      generatedAt: now,
      totalUsers: visitorSet.size,
      activeUsers: activeVisitorSet.size,
      totalSessions,
      totalPageViews,
      avgSessionSec,
      bounceRate,
      breakdown,
      topPages,
      durationBuckets,
      recentSessions,
      groupedUsers,
    };
  },
});

export const clearSessions = internalMutation({
  args: {
    sourceHost: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("analyticsSessions").collect();
    let deleted = 0;

    for (const session of all) {
      if (args.sourceHost && session.sourceHost !== args.sourceHost) {
        continue;
      }
      await ctx.db.delete(session._id);
      deleted += 1;
    }

    return { ok: true, deleted };
  },
});
