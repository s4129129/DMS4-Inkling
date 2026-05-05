import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MINUTES_PER_PAGE = 20;
const DEFAULT_DAILY_QUOTA_PAGES = 3;
const DEFAULT_THEME = "default";
const DEFAULT_MODE = "dark";
const DEFAULT_TIME_ZONE = "UTC";
const DEFAULT_INTERACTION_MODE = "classic";
const DEFAULT_OWNED_THEMES = ["default"];
const DEFAULT_INTERACTION_FEATURE_ID = "default-interaction-pack";
const DEFAULT_OWNED_FEATURES: string[] = [];
const CUSTOM_BANNER_FEATURE_ID = "custom-banner-upload";
const MECHANICAL_INTERACTION_FEATURE_ID = "sink-button-interactions";
const ECONOMY_RESET_VERSION = 2;
const DEFAULT_USER_ICON_PRESET = "default-light";
const OFFICIAL_ENBJ_BOOK_ID = "enbj01";
const OFFICIAL_BOOK_ITEMS = [
  {
    id: OFFICIAL_ENBJ_BOOK_ID,
    title: "ENBJ Official Vol 1",
    cost: 0,
  },
  {
    id: "enbj002",
    title: "ENBJ Official Vol 2",
    cost: 1500,
  },
];
const DEFAULT_BANNER_POSITION_X = 50;
const DEFAULT_BANNER_POSITION_Y = 50;
const DEFAULT_BANNER_OPACITY = 0.24;
const DEFAULT_BANNER_SCALE = 100;
const MIN_BANNER_POSITION = -150;
const MAX_BANNER_POSITION = 250;
const MIN_BANNER_SCALE = 50;
const MAX_BANNER_SCALE = 320;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

const LEGACY_THEME_MAP: Record<string, string> = {
  comic: "default",
  mono: "command",
  ocean: "vintage",
  amber: "vintage",
  forest: "vintage",
  rose: "vintage",
};

const MARKET_ITEMS = [
  {
    id: "default",
    type: "theme",
    name: "Default",
    cost: 0,
    description: "Bold default reader theme",
  },
  {
    id: "vintage",
    type: "theme",
    name: "Vintage",
    cost: 180,
    description: "For coffee addicts",
  },
  {
    id: "command",
    type: "theme",
    name: "Monochrome",
    cost: 180,
    description: "Simple mono palette",
  },
  {
    id: DEFAULT_INTERACTION_FEATURE_ID,
    type: "feature",
    name: "Default Interaction Pack",
    cost: 90,
    description: "Classic hover button animation used across the dashboard.",
  },
  {
    id: CUSTOM_BANNER_FEATURE_ID,
    type: "feature",
    name: "Custom PNG Banner",
    cost: 180,
    description:
      "Unlock your own PNG dashboard banner and customize it from Settings.",
  },
  {
    id: MECHANICAL_INTERACTION_FEATURE_ID,
    type: "feature",
    name: "Mechanical Interaction Pack",
    cost: 90,
    description:
      "Unlocks tactile controls with configurable Pop Up and Sink Down behavior in Settings.",
  },
];

function themeItemIds() {
  return MARKET_ITEMS.filter((item) => item.type === "theme").map(
    (item) => item.id,
  );
}

function featureItemIds() {
  return MARKET_ITEMS.filter((item) => item.type === "feature").map(
    (item) => item.id,
  );
}

function normalizeThemeId(themeId?: string | null) {
  if (!themeId) {
    return DEFAULT_THEME;
  }
  return LEGACY_THEME_MAP[themeId] ?? themeId;
}

function normalizeThemeMode(mode?: string | null) {
  return mode === "light" ? "light" : "dark";
}

function normalizeInteractionMode(mode?: string | null) {
  if (mode === "popup") {
    return "popup";
  }
  if (mode === "sinkdown") {
    return "sinkdown";
  }
  return DEFAULT_INTERACTION_MODE;
}

function normalizeAccentColor(color?: string | null) {
  const safeColor = String(color || "").trim();
  if (/^#[0-9a-fA-F]{3}$/.test(safeColor)) {
    return `#${safeColor
      .slice(1)
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(safeColor)) {
    return safeColor.toLowerCase();
  }
  return "";
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

function zonedParts(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const valueFor = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: valueFor("year"),
    month: valueFor("month"),
    day: valueFor("day"),
    hour: valueFor("hour") % 24,
    minute: valueFor("minute"),
    second: valueFor("second"),
  };
}

function timeZoneOffsetMs(timeZone: string, ts: number) {
  const parts = zonedParts(ts, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - ts;
}

function dayKeyForTimeZone(ts: number, timeZone: string) {
  const parts = zonedParts(ts, timeZone);
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function hourKeyForTimeZone(ts: number, timeZone: string) {
  const parts = zonedParts(ts, timeZone);
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
    String(parts.hour).padStart(2, "0"),
  ].join("-");
}

function minuteKeyForTimeZone(ts: number, timeZone: string) {
  const parts = zonedParts(ts, timeZone);
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
    String(parts.hour).padStart(2, "0"),
    String(parts.minute).padStart(2, "0"),
  ].join("-");
}

function hourLabelForTimeZone(ts: number, timeZone: string) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

function startOfDayForTimeZone(ts: number, timeZone: string) {
  const parts = zonedParts(ts, timeZone);
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const firstPass = localMidnightAsUtc - timeZoneOffsetMs(timeZone, ts);
  return localMidnightAsUtc - timeZoneOffsetMs(timeZone, firstPass);
}

function startOfWeekMondayForTimeZone(ts: number, timeZone: string) {
  const startOfDay = startOfDayForTimeZone(ts, timeZone);
  const parts = zonedParts(ts, timeZone);
  const utcDay = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
  const daysFromMonday = (utcDay + 6) % 7;
  return startOfDay - daysFromMonday * ONE_DAY_MS;
}

function normalizeOwnedThemes(ownedThemes?: string[] | null) {
  const validThemeIds = new Set(themeItemIds());
  return Array.from(
    new Set([
      ...(ownedThemes ?? []).map((themeId) => normalizeThemeId(themeId)),
      ...DEFAULT_OWNED_THEMES,
    ]),
  ).filter((themeId) => validThemeIds.has(themeId));
}

function normalizeOwnedFeatures(ownedFeatures?: string[] | null) {
  const validFeatureIds = new Set(featureItemIds());
  return Array.from(
    new Set([...(ownedFeatures ?? []), ...DEFAULT_OWNED_FEATURES]),
  ).filter((featureId) => validFeatureIds.has(featureId));
}

function normalizeOwnedOfficialBooks(ownedOfficialBooks?: string[] | null) {
  const validBookIds = new Set(OFFICIAL_BOOK_ITEMS.map((book) => book.id));
  return Array.from(new Set(ownedOfficialBooks ?? [])).filter((bookId) =>
    validBookIds.has(bookId),
  );
}

function normalizeBannerPosition(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(
    MIN_BANNER_POSITION,
    Math.min(MAX_BANNER_POSITION, Number(value)),
  );
}

function normalizeBannerOpacity(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_BANNER_OPACITY;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function normalizeBannerScale(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_BANNER_SCALE;
  }
  return Math.max(MIN_BANNER_SCALE, Math.min(MAX_BANNER_SCALE, Number(value)));
}

function normalizeTimerLabel(label?: string | null) {
  const safe = String(label || "").trim();
  return safe || "Reading session";
}

function addUniqueLabel(target: string[], label?: string | null) {
  const safeLabel = normalizeTimerLabel(label);
  if (!target.includes(safeLabel)) {
    target.push(safeLabel);
  }
}

function buildTimerSessionRows({
  timerEvents,
  timerLabelById,
  rangeStart,
  rangeEnd,
}: {
  timerEvents: Array<{ timerId: unknown; eventType: string; createdAt: number }>;
  timerLabelById: Map<string, string>;
  rangeStart: number;
  rangeEnd: number;
}) {
  const eventsByTimer = new Map<
    string,
    Array<{ createdAt: number; eventType: string }>
  >();

  for (const event of timerEvents) {
    const timerId = String(event.timerId);
    if (!eventsByTimer.has(timerId)) {
      eventsByTimer.set(timerId, []);
    }
    eventsByTimer.get(timerId)?.push({
      createdAt: Number(event.createdAt || 0),
      eventType: String(event.eventType || "").toLowerCase(),
    });
  }

  const rows: Array<{
    eventKey: string;
    timerId: string;
    timerLabel: string;
    startAt: number;
    endAt: number;
    durationSeconds: number;
    durationMinutes: number;
    startedBy: string;
    endedBy: string;
  }> = [];

  for (const [timerId, events] of eventsByTimer.entries()) {
    events.sort((a, b) => a.createdAt - b.createdAt);

    let activeStartAt: number | null = null;
    let activeStartType = "";

    for (const event of events) {
      const eventType = event.eventType;

      if (eventType === "started" || eventType === "resumed") {
        activeStartAt = event.createdAt;
        activeStartType = eventType;
        continue;
      }

      if (
        eventType !== "paused" &&
        eventType !== "removed" &&
        eventType !== "completed"
      ) {
        continue;
      }

      if (activeStartAt !== null && event.createdAt > activeStartAt) {
        const clippedStart = Math.max(rangeStart, activeStartAt);
        const clippedEnd = Math.min(rangeEnd, event.createdAt);

        if (clippedEnd > clippedStart) {
          const durationMs = clippedEnd - clippedStart;
          rows.push({
            eventKey: `${timerId}:${activeStartAt}:${event.createdAt}:${eventType}`,
            timerId,
            timerLabel: timerLabelById.get(timerId) || "Reading session",
            startAt: clippedStart,
            endAt: clippedEnd,
            durationSeconds: Math.max(1, Math.floor(durationMs / 1000)),
            durationMinutes: durationMs / ONE_MINUTE_MS,
            startedBy: activeStartType || "started",
            endedBy: eventType,
          });
        }
      }

      activeStartAt = null;
      activeStartType = "";
    }
  }

  return rows.sort((a, b) => {
    if (a.startAt !== b.startAt) {
      return a.startAt - b.startAt;
    }
    return a.endAt - b.endAt;
  });
}

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

  // Queries are read-only in Convex and cannot insert records.
  if (typeof ctx.db.insert !== "function") {
    return {
      _id: null,
      userId,
      minutesPerPage: DEFAULT_MINUTES_PER_PAGE,
      dailyQuotaPages: DEFAULT_DAILY_QUOTA_PAGES,
      ink: 0,
      pageCredits: 0,
      quills: 0,
      selectedTheme: DEFAULT_THEME,
      selectedMode: DEFAULT_MODE,
      accentColor: "",
      accentColorSecondary: "",
      interactionMode: DEFAULT_INTERACTION_MODE,
      ownedThemes: DEFAULT_OWNED_THEMES,
      ownedFeatures: DEFAULT_OWNED_FEATURES,
      ownedOfficialBooks: [],
      userIconStorageId: undefined,
      userIconPreset: DEFAULT_USER_ICON_PRESET,
      economyResetVersion: ECONOMY_RESET_VERSION,
      customBannerStorageId: undefined,
      customBannerPositionX: DEFAULT_BANNER_POSITION_X,
      customBannerPositionY: DEFAULT_BANNER_POSITION_Y,
      customBannerOpacity: DEFAULT_BANNER_OPACITY,
      customBannerScale: DEFAULT_BANNER_SCALE,
      updatedAt: Date.now(),
    };
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
    accentColor: "",
    accentColorSecondary: "",
    timeZone: DEFAULT_TIME_ZONE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    ownedThemes: DEFAULT_OWNED_THEMES,
    ownedFeatures: DEFAULT_OWNED_FEATURES,
    ownedOfficialBooks: [],
    userIconStorageId: undefined,
    userIconPreset: DEFAULT_USER_ICON_PRESET,
    economyResetVersion: ECONOMY_RESET_VERSION,
    customBannerStorageId: undefined,
    customBannerPositionX: DEFAULT_BANNER_POSITION_X,
    customBannerPositionY: DEFAULT_BANNER_POSITION_Y,
    customBannerOpacity: DEFAULT_BANNER_OPACITY,
    customBannerScale: DEFAULT_BANNER_SCALE,
    updatedAt: Date.now(),
  });

  return await ctx.db.get(profileId);
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);

    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const events = await ctx.db
      .query("pageUnlockEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const timerEvents = await ctx.db
      .query("timerEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const timers = await ctx.db
      .query("timers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const timerLabelById = new Map(
      timers.map((timer) => [
        String(timer._id),
        normalizeTimerLabel(timer.label),
      ]),
    );

    const now = Date.now();
    const timeZone = normalizeTimeZone(profile.timeZone);
    const dayMap = new Map<string, number>();
    for (const event of events) {
      const key = dayKeyForTimeZone(event.createdAt, timeZone);
      dayMap.set(key, (dayMap.get(key) ?? 0) + event.pagesUnlocked);
    }

    const weekly = [] as Array<{ day: string; pages: number }>;
    const weekStart = startOfWeekMondayForTimeZone(now, timeZone);
    for (let i = 0; i < 7; i += 1) {
      const ts = weekStart + i * ONE_DAY_MS;
      const key = dayKeyForTimeZone(ts, timeZone);
      weekly.push({
        day: new Date(ts).toLocaleDateString("en-US", {
          weekday: "short",
          timeZone,
        }),
        pages: dayMap.get(key) ?? 0,
      });
    }

    const todayKey = dayKeyForTimeZone(now, timeZone);
    const todayUnlockedPages = dayMap.get(todayKey) ?? 0;

    let streak = 0;
    for (let i = 0; i < 365; i += 1) {
      const key = dayKeyForTimeZone(now - i * ONE_DAY_MS, timeZone);
      const pages = dayMap.get(key) ?? 0;
      if (pages >= profile.dailyQuotaPages) {
        streak += 1;
      } else {
        break;
      }
    }

    const progressBooks = books
      .map((book) => ({
        _id: book._id,
        title: book.title?.trim() || "Untitled",
        unlockedPages: book.unlockedPages,
        pageCount: book.pageCount,
        progressPercent: Math.min(
          100,
          Math.round((book.unlockedPages / book.pageCount) * 100),
        ),
      }))
      .sort((a, b) => b.progressPercent - a.progressPercent);

    const totalUnlockedPagesEver = progressBooks.reduce(
      (sum, book) => sum + Math.max(0, book.unlockedPages),
      0,
    );

    const firstHourStart = startOfDayForTimeZone(now, timeZone);
    const rangeEnd = firstHourStart + ONE_DAY_MS;
    const timerSessions24h = buildTimerSessionRows({
      timerEvents,
      timerLabelById,
      rangeStart: firstHourStart,
      rangeEnd,
    });
    const timerSessionsEver = buildTimerSessionRows({
      timerEvents,
      timerLabelById,
      rangeStart: 0,
      rangeEnd: now,
    });
    const totalSessionSecondsEver = timerSessionsEver.reduce(
      (sum, session) => sum + Math.max(0, session.durationSeconds || 0),
      0,
    );
    const hourlyRows = [] as Array<{
      key: string;
      hourLabel: string;
      started: number;
      paused: number;
      removed: number;
      completed: number;
      pagesUnlocked: number;
      timerLabels: string[];
      eventTimes: {
        started: string[];
        paused: string[];
        removed: string[];
        completed: string[];
        pagesUnlocked: string[];
      };
    }>;
    const hourlyMap = new Map<string, (typeof hourlyRows)[number]>();
    const minuteRowsMap = new Map<
      string,
      {
        minuteIndex: number;
        minuteLabel: string;
        started: number;
        paused: number;
        removed: number;
        completed: number;
        pagesUnlocked: number;
        timerLabels: string[];
      }
    >();

    const ensureMinuteBucket = (createdAt: number) => {
      const key = minuteKeyForTimeZone(createdAt, timeZone);
      const existing = minuteRowsMap.get(key);
      if (existing) {
        return existing;
      }

      const minuteIndex = Math.max(
        0,
        Math.min(
          1439,
          Math.floor((createdAt - firstHourStart) / ONE_MINUTE_MS),
        ),
      );
      const bucket = {
        minuteIndex,
        minuteLabel: hourLabelForTimeZone(createdAt, timeZone),
        started: 0,
        paused: 0,
        removed: 0,
        completed: 0,
        pagesUnlocked: 0,
        timerLabels: [],
      };
      minuteRowsMap.set(key, bucket);
      return bucket;
    };

    for (let index = 0; index < 24; index += 1) {
      const ts = firstHourStart + index * ONE_HOUR_MS;
      const key = hourKeyForTimeZone(ts, timeZone);
      const row = {
        key,
        hourLabel: hourLabelForTimeZone(ts, timeZone),
        started: 0,
        paused: 0,
        removed: 0,
        completed: 0,
        pagesUnlocked: 0,
        timerLabels: [],
        eventTimes: {
          started: [],
          paused: [],
          removed: [],
          completed: [],
          pagesUnlocked: [],
        },
      };
      hourlyRows.push(row);
      hourlyMap.set(key, row);
    }

    for (const event of timerEvents) {
      if (event.createdAt < firstHourStart || event.createdAt >= rangeEnd) {
        continue;
      }
      const bucket = hourlyMap.get(
        hourKeyForTimeZone(event.createdAt, timeZone),
      );
      if (!bucket) {
        continue;
      }

      const minuteLabel = hourLabelForTimeZone(event.createdAt, timeZone);
      const minuteBucket = ensureMinuteBucket(event.createdAt);
      const timerLabel =
        timerLabelById.get(String(event.timerId)) || "Reading session";
      addUniqueLabel(bucket.timerLabels, timerLabel);
      addUniqueLabel(minuteBucket.timerLabels, timerLabel);
      if (event.eventType === "started" || event.eventType === "resumed") {
        bucket.started += 1;
        bucket.eventTimes.started.push(minuteLabel);
        minuteBucket.started += 1;
      } else if (event.eventType === "paused") {
        bucket.paused += 1;
        bucket.eventTimes.paused.push(minuteLabel);
        minuteBucket.paused += 1;
      } else if (event.eventType === "removed") {
        bucket.removed += 1;
        bucket.eventTimes.removed.push(minuteLabel);
        minuteBucket.removed += 1;
      } else if (event.eventType === "completed") {
        bucket.completed += 1;
        bucket.eventTimes.completed.push(minuteLabel);
        minuteBucket.completed += 1;
      }
    }

    for (const event of events) {
      if (event.createdAt < firstHourStart || event.createdAt >= rangeEnd) {
        continue;
      }
      const bucket = hourlyMap.get(
        hourKeyForTimeZone(event.createdAt, timeZone),
      );
      if (!bucket) {
        continue;
      }

      const unlockedPages = Math.max(0, Math.floor(event.pagesUnlocked || 0));
      if (unlockedPages <= 0) {
        continue;
      }

      const minuteLabel = hourLabelForTimeZone(event.createdAt, timeZone);
      const minuteBucket = ensureMinuteBucket(event.createdAt);

      bucket.pagesUnlocked += unlockedPages;
      minuteBucket.pagesUnlocked += unlockedPages;

      for (let index = 0; index < unlockedPages; index += 1) {
        bucket.eventTimes.pagesUnlocked.push(minuteLabel);
      }
    }

    const dailyActivity = hourlyRows.map((row) => ({
      hourLabel: row.hourLabel,
      started: row.started,
      paused: row.paused,
      removed: row.removed,
      completed: row.completed,
      pagesUnlocked: row.pagesUnlocked,
      timerLabels: [...row.timerLabels],
      eventTimes: {
        started: row.eventTimes.started,
        paused: row.eventTimes.paused,
        removed: row.eventTimes.removed,
        completed: row.eventTimes.completed,
        pagesUnlocked: row.eventTimes.pagesUnlocked,
      },
    }));

    const minuteActivity = Array.from(minuteRowsMap.values()).sort(
      (a, b) => a.minuteIndex - b.minuteIndex,
    );

    const validThemeIds = new Set(themeItemIds());
    const ownedThemes = normalizeOwnedThemes(profile.ownedThemes);
    const ownedFeatures = normalizeOwnedFeatures(profile.ownedFeatures);
    const ownedOfficialBooks = normalizeOwnedOfficialBooks(
      profile.ownedOfficialBooks,
    );

    const normalizedSelectedTheme = normalizeThemeId(profile.selectedTheme);
    const selectedTheme = validThemeIds.has(normalizedSelectedTheme)
      ? normalizedSelectedTheme
      : DEFAULT_THEME;
    const selectedMode = normalizeThemeMode(profile.selectedMode);
    const interactionMode = normalizeInteractionMode(profile.interactionMode);
    const accentColor = normalizeAccentColor(profile.accentColor);
    const accentColorSecondary = normalizeAccentColor(
      profile.accentColorSecondary,
    );

    const customBannerUrl = profile.customBannerStorageId
      ? await ctx.storage.getUrl(profile.customBannerStorageId)
      : null;
    const userIconUrl = profile.userIconStorageId
      ? await ctx.storage.getUrl(profile.userIconStorageId)
      : null;
    const recentUserIcons = (
      await Promise.all(
        (profile.recentUserIconStorageIds ?? []).slice(0, 3).map(
          async (storageId) => ({
            storageId,
            url: await ctx.storage.getUrl(storageId),
          }),
        ),
      )
    ).filter((item) => item.url);
    const customBannerPositionX = normalizeBannerPosition(
      profile.customBannerPositionX,
      DEFAULT_BANNER_POSITION_X,
    );
    const customBannerPositionY = normalizeBannerPosition(
      profile.customBannerPositionY,
      DEFAULT_BANNER_POSITION_Y,
    );
    const customBannerOpacity = normalizeBannerOpacity(
      profile.customBannerOpacity,
    );
    const customBannerScale = normalizeBannerScale(profile.customBannerScale);

    const market = MARKET_ITEMS.map((item) => ({
      ...item,
      owned:
        item.type === "theme"
          ? ownedThemes.includes(item.id)
          : ownedFeatures.includes(item.id),
      selected: item.type === "theme" ? selectedTheme === item.id : false,
      affordable: (profile.ink ?? 0) >= item.cost,
    }));
    const officialBooks = OFFICIAL_BOOK_ITEMS.map((book) => ({
      ...book,
      owned: ownedOfficialBooks.includes(book.id),
      affordable: (profile.quills ?? 0) >= book.cost,
    }));

    return {
      profile: {
        minutesPerPage: profile.minutesPerPage,
        dailyQuotaPages: profile.dailyQuotaPages,
        timeZone,
        ink: profile.ink ?? 0,
        pageCredits: profile.pageCredits ?? 0,
        quills: profile.quills ?? 0,
        selectedTheme,
        selectedMode,
        accentColor,
        accentColorSecondary,
        interactionMode,
        ownedThemes,
        ownedFeatures,
        ownedOfficialBooks,
        economyResetVersion: profile.economyResetVersion ?? 0,
        userIconStorageId: profile.userIconStorageId,
        userIconUrl,
        recentUserIcons,
        userIconPreset: profile.userIconPreset ?? DEFAULT_USER_ICON_PRESET,
        customBannerUrl,
        customBannerPositionX,
        customBannerPositionY,
        customBannerOpacity,
        customBannerScale,
      },
      streak,
      todayUnlockedPages,
      weekly,
      dailyActivity,
      minuteActivity,
      timerSessions24h,
      timerSessionsEver,
      totalSessionSecondsEver,
      progressBooks,
      totalUnlockedPagesEver,
      market,
      officialBooks,
    };
  },
});

export const publicOverview = query({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const viewerId = await requireUserId(ctx);
    if (!args.targetUserId) {
      return null;
    }

    const targetUserId = args.targetUserId;
    const viewerMemberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", viewerId))
      .collect();
    const targetMemberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", targetUserId))
      .collect();
    const viewerGroupIds = new Set(
      viewerMemberships.map((membership: any) => `${membership.groupId}`),
    );
    const sharesGroup =
      `${viewerId}` === `${targetUserId}` ||
      targetMemberships.some((membership: any) =>
        viewerGroupIds.has(`${membership.groupId}`),
      );

    if (!sharesGroup) {
      return null;
    }

    const targetUser = await ctx.db.get(targetUserId);
    if (!targetUser) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", targetUserId))
      .unique();
    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q: any) => q.eq("userId", targetUserId))
      .collect();
    const events = await ctx.db
      .query("pageUnlockEvents")
      .withIndex("by_user", (q: any) => q.eq("userId", targetUserId))
      .collect();
    const timerEvents = await ctx.db
      .query("timerEvents")
      .withIndex("by_user", (q: any) => q.eq("userId", targetUserId))
      .collect();
    const timers = await ctx.db
      .query("timers")
      .withIndex("by_user", (q: any) => q.eq("userId", targetUserId))
      .collect();

    const now = Date.now();
    const timeZone = normalizeTimeZone(profile?.timeZone);
    const dayMap = new Map<string, number>();
    for (const event of events) {
      const key = dayKeyForTimeZone(event.createdAt, timeZone);
      dayMap.set(key, (dayMap.get(key) ?? 0) + event.pagesUnlocked);
    }

    const weekly = [] as Array<{ day: string; pages: number }>;
    const weekStart = startOfWeekMondayForTimeZone(now, timeZone);
    for (let i = 0; i < 7; i += 1) {
      const ts = weekStart + i * ONE_DAY_MS;
      const key = dayKeyForTimeZone(ts, timeZone);
      weekly.push({
        day: new Date(ts).toLocaleDateString("en-US", {
          weekday: "short",
          timeZone,
        }),
        pages: dayMap.get(key) ?? 0,
      });
    }

    const todayKey = dayKeyForTimeZone(now, timeZone);
    const todayUnlockedPages = dayMap.get(todayKey) ?? 0;
    const timerLabelById = new Map(
      timers.map((timer) => [
        String(timer._id),
        normalizeTimerLabel(timer.label),
      ]),
    );
    const totalSessionSecondsEver = buildTimerSessionRows({
      timerEvents,
      timerLabelById,
      rangeStart: 0,
      rangeEnd: now,
    }).reduce(
      (sum, session) => sum + Math.max(0, session.durationSeconds || 0),
      0,
    );

    const progressBooks = books
      .map((book) => ({
        _id: book._id,
        title: book.title?.trim() || "Untitled",
        unlockedPages: book.unlockedPages,
        pageCount: book.pageCount,
        progressPercent: Math.min(
          100,
          Math.round((book.unlockedPages / book.pageCount) * 100),
        ),
      }))
      .sort((a, b) => b.progressPercent - a.progressPercent);
    const totalUnlockedPagesEver = progressBooks.reduce(
      (sum, book) => sum + Math.max(0, book.unlockedPages),
      0,
    );
    const userIconUrl = profile?.userIconStorageId
      ? await ctx.storage.getUrl(profile.userIconStorageId)
      : null;

    return {
      displayName:
        targetUser.name || targetUser.email || "Group member",
      profile: {
        timeZone,
        userIconUrl,
        userIconPreset: profile?.userIconPreset ?? DEFAULT_USER_ICON_PRESET,
      },
      weekly,
      dailyActivity: [
        {
          hourLabel: "Today",
          started: 0,
          paused: 0,
          removed: 0,
          completed: 0,
          pagesUnlocked: todayUnlockedPages,
          timerLabels: [],
          eventTimes: {
            started: [],
            paused: [],
            removed: [],
            completed: [],
            pagesUnlocked: [],
          },
        },
      ],
      progressBooks,
      totalUnlockedPagesEver,
      totalSessionSecondsEver,
    };
  },
});

export const updatePreferences = mutation({
  args: {
    minutesPerPage: v.optional(v.number()),
    dailyQuotaPages: v.optional(v.number()),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);

    const patch: Record<string, number | string> = {};
    if (typeof args.minutesPerPage === "number") {
      patch.minutesPerPage = Math.max(1, Math.floor(args.minutesPerPage));
    }
    if (typeof args.dailyQuotaPages === "number") {
      patch.dailyQuotaPages = Math.max(1, Math.floor(args.dailyQuotaPages));
    }
    if (typeof args.timeZone === "string") {
      patch.timeZone = normalizeTimeZone(args.timeZone);
    }

    await ctx.db.patch(profile._id, {
      ...patch,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const applyEconomyReset = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);

    if ((profile.economyResetVersion ?? 0) >= ECONOMY_RESET_VERSION) {
      return { reset: false };
    }

    const userBooks = await ctx.db
      .query("books")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();

    for (const book of userBooks) {
      if (
        String(book.title || "")
          .trim()
          .toLowerCase() === "enbj official vol 1"
      ) {
        await ctx.db.delete(book._id);
      }
    }

    await ctx.db.patch(profile._id, {
      ink: 0,
      pageCredits: 0,
      quills: 0,
      ownedOfficialBooks: [],
      economyResetVersion: ECONOMY_RESET_VERSION,
      updatedAt: Date.now(),
    });

    return { reset: true };
  },
});

export const generateUserIconUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setUserIcon = mutation({
  args: {
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const recentUserIconStorageIds = args.storageId
      ? [
          args.storageId,
          ...(profile.recentUserIconStorageIds ?? []).filter(
            (storageId) => storageId !== args.storageId,
          ),
        ].slice(0, 3)
      : (profile.recentUserIconStorageIds ?? []).slice(0, 3);

    await ctx.db.patch(profile._id, {
      userIconStorageId: args.storageId,
      recentUserIconStorageIds,
      userIconPreset: args.storageId
        ? profile.userIconPreset ?? DEFAULT_USER_ICON_PRESET
        : DEFAULT_USER_ICON_PRESET,
      updatedAt: Date.now(),
    });

    return {
      userIconStorageId: args.storageId,
      userIconUrl: args.storageId ? await ctx.storage.getUrl(args.storageId) : null,
      recentUserIcons: (
        await Promise.all(
          recentUserIconStorageIds.map(async (storageId) => ({
            storageId,
            url: await ctx.storage.getUrl(storageId),
          })),
        )
      ).filter((item) => item.url),
      userIconPreset: args.storageId
        ? profile.userIconPreset ?? DEFAULT_USER_ICON_PRESET
        : DEFAULT_USER_ICON_PRESET,
    };
  },
});

export const selectUserIconPreset = mutation({
  args: {
    preset: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const preset = String(args.preset || "").trim() || DEFAULT_USER_ICON_PRESET;

    await ctx.db.patch(profile._id, {
      userIconPreset: preset,
      userIconStorageId: undefined,
      updatedAt: Date.now(),
    });

    return { userIconPreset: preset, userIconUrl: null };
  },
});

export const buyTheme = mutation({
  args: {
    themeId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const item = MARKET_ITEMS.find(
      (candidate) => candidate.id === args.themeId,
    );

    if (!item) {
      throw new Error("Unknown market item");
    }

    const ownedThemes = normalizeOwnedThemes(profile.ownedThemes);
    const ownedFeatures = normalizeOwnedFeatures(profile.ownedFeatures);

    const alreadyOwned =
      item.type === "theme"
        ? ownedThemes.includes(item.id)
        : ownedFeatures.includes(item.id);
    if (alreadyOwned) {
      return { owned: true, type: item.type };
    }

    if ((profile.ink ?? 0) < item.cost) {
      throw new Error("Not enough Ink");
    }

    const nextInk = (profile.ink ?? 0) - item.cost;
    if (item.type === "theme") {
      await ctx.db.patch(profile._id, {
        ink: nextInk,
        ownedThemes: [...ownedThemes, item.id],
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(profile._id, {
        ink: nextInk,
        ownedFeatures: [...ownedFeatures, item.id],
        updatedAt: Date.now(),
      });
    }

    return { bought: true, type: item.type };
  },
});

export const buyOfficialBook = mutation({
  args: {
    bookId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const book = OFFICIAL_BOOK_ITEMS.find((item) => item.id === args.bookId);

    if (!book) {
      throw new Error("Unknown official book");
    }

    const ownedOfficialBooks = normalizeOwnedOfficialBooks(
      profile.ownedOfficialBooks,
    );

    if (ownedOfficialBooks.includes(book.id)) {
      return { owned: true };
    }

    if ((profile.quills ?? 0) < book.cost) {
      throw new Error("Not enough Quills");
    }

    await ctx.db.patch(profile._id, {
      quills: Math.max(0, (profile.quills ?? 0) - book.cost),
      ownedOfficialBooks: [...ownedOfficialBooks, book.id],
      updatedAt: Date.now(),
    });

    return { bought: true };
  },
});

export const selectTheme = mutation({
  args: {
    themeId: v.string(),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const validThemeIds = new Set(themeItemIds());
    const ownedThemes = normalizeOwnedThemes(profile.ownedThemes);

    const normalizedThemeId = normalizeThemeId(args.themeId);

    if (!ownedThemes.includes(normalizedThemeId)) {
      throw new Error("Theme not owned");
    }

    await ctx.db.patch(profile._id, {
      selectedTheme: normalizedThemeId,
      selectedMode: normalizeThemeMode(args.mode ?? profile.selectedMode),
      updatedAt: Date.now(),
    });

    return {
      selectedTheme: normalizedThemeId,
      selectedMode: normalizeThemeMode(args.mode ?? profile.selectedMode),
    };
  },
});

export const updateInteractionMode = mutation({
  args: {
    mode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const ownedFeatures = normalizeOwnedFeatures(profile.ownedFeatures);

    const interactionMode = normalizeInteractionMode(args.mode);

    if (
      interactionMode !== "classic" &&
      !ownedFeatures.includes(MECHANICAL_INTERACTION_FEATURE_ID)
    ) {
      throw new Error("Feature not owned");
    }

    await ctx.db.patch(profile._id, {
      interactionMode,
      updatedAt: Date.now(),
    });

    return { interactionMode };
  },
});

export const updateAccentColor = mutation({
  args: {
    accentColor: v.string(),
    accentColorSecondary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const accentColor = normalizeAccentColor(args.accentColor);
    const accentColorSecondary = normalizeAccentColor(
      args.accentColorSecondary,
    );

    await ctx.db.patch(profile._id, {
      accentColor,
      accentColorSecondary,
      updatedAt: Date.now(),
    });

    return { accentColor, accentColorSecondary };
  },
});

export const generateBannerUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const ownedFeatures = normalizeOwnedFeatures(profile.ownedFeatures);

    if (!ownedFeatures.includes(CUSTOM_BANNER_FEATURE_ID)) {
      throw new Error("Feature not owned");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const setCustomBanner = mutation({
  args: {
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const ownedFeatures = normalizeOwnedFeatures(profile.ownedFeatures);

    if (!ownedFeatures.includes(CUSTOM_BANNER_FEATURE_ID)) {
      throw new Error("Feature not owned");
    }

    await ctx.db.patch(profile._id, {
      customBannerStorageId: args.storageId,
      updatedAt: Date.now(),
    });

    const customBannerUrl = args.storageId
      ? await ctx.storage.getUrl(args.storageId)
      : null;
    return { customBannerUrl };
  },
});

export const updateBannerSettings = mutation({
  args: {
    positionX: v.optional(v.number()),
    positionY: v.optional(v.number()),
    opacity: v.optional(v.number()),
    scale: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await getOrCreateProfile(ctx, userId);
    const ownedFeatures = normalizeOwnedFeatures(profile.ownedFeatures);

    if (!ownedFeatures.includes(CUSTOM_BANNER_FEATURE_ID)) {
      throw new Error("Feature not owned");
    }

    const positionX =
      typeof args.positionX === "number"
        ? normalizeBannerPosition(args.positionX, DEFAULT_BANNER_POSITION_X)
        : normalizeBannerPosition(
            profile.customBannerPositionX,
            DEFAULT_BANNER_POSITION_X,
          );
    const positionY =
      typeof args.positionY === "number"
        ? normalizeBannerPosition(args.positionY, DEFAULT_BANNER_POSITION_Y)
        : normalizeBannerPosition(
            profile.customBannerPositionY,
            DEFAULT_BANNER_POSITION_Y,
          );
    const opacity =
      typeof args.opacity === "number"
        ? normalizeBannerOpacity(args.opacity)
        : normalizeBannerOpacity(profile.customBannerOpacity);
    const scale =
      typeof args.scale === "number"
        ? normalizeBannerScale(args.scale)
        : normalizeBannerScale(profile.customBannerScale);

    await ctx.db.patch(profile._id, {
      customBannerPositionX: positionX,
      customBannerPositionY: positionY,
      customBannerOpacity: opacity,
      customBannerScale: scale,
      updatedAt: Date.now(),
    });

    return {
      customBannerPositionX: positionX,
      customBannerPositionY: positionY,
      customBannerOpacity: opacity,
      customBannerScale: scale,
    };
  },
});

