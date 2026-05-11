import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  userProfiles: defineTable({
    userId: v.id("users"),
    minutesPerPage: v.number(),
    dailyQuotaPages: v.number(),
    ink: v.number(),
    pageCredits: v.optional(v.number()),
    quills: v.optional(v.number()),
    selectedTheme: v.string(),
    selectedMode: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    accentColorSecondary: v.optional(v.string()),
    language: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    interactionMode: v.optional(v.string()),
    ownedThemes: v.array(v.string()),
    ownedFeatures: v.optional(v.array(v.string())),
    ownedOfficialBooks: v.optional(v.array(v.string())),
    userIconStorageId: v.optional(v.id("_storage")),
    userIconAssetUrl: v.optional(v.string()),
    userIconAssetKey: v.optional(v.string()),
    userIconAssetProvider: v.optional(v.string()),
    recentUserIconStorageIds: v.optional(v.array(v.id("_storage"))),
    recentUserIconAssets: v.optional(
      v.array(
        v.object({
          assetUrl: v.string(),
          assetKey: v.optional(v.string()),
          assetProvider: v.optional(v.string()),
        }),
      ),
    ),
    userIconPreset: v.optional(v.string()),
    economyResetVersion: v.optional(v.number()),
    customBannerStorageId: v.optional(v.id("_storage")),
    customBannerAssetUrl: v.optional(v.string()),
    customBannerAssetKey: v.optional(v.string()),
    customBannerAssetProvider: v.optional(v.string()),
    customBannerPositionX: v.optional(v.number()),
    customBannerPositionY: v.optional(v.number()),
    customBannerOpacity: v.optional(v.number()),
    customBannerScale: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  books: defineTable({
    userId: v.id("users"),
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
    unlockedPages: v.number(),
    landingPage: v.optional(v.number()),
    lastReadPage: v.optional(v.number()),
    thumbnailPage: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  pageUnlockEvents: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    pagesUnlocked: v.number(),
    inkEarned: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  timers: defineTable({
    userId: v.id("users"),
    label: v.string(),
    durationSeconds: v.number(),
    endsAt: v.number(),
    rewardPages: v.number(),
    rewardInk: v.optional(v.number()),
    pausedAt: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    claimedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  timerEvents: defineTable({
    userId: v.id("users"),
    timerId: v.id("timers"),
    eventType: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),
  groups: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    visibility: v.string(),
    inviteCode: v.optional(v.string()),
    monthlyBookTitle: v.string(),
    monthlyBookPageTarget: v.number(),
    readingMaterialTitle: v.optional(v.string()),
    readingMaterialSource: v.optional(v.string()),
    iconAssetUrl: v.optional(v.string()),
    iconAssetKey: v.optional(v.string()),
    iconAssetProvider: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_visibility", ["visibility"])
    .index("by_owner", ["ownerId"])
    .index("by_invite_code", ["inviteCode"]),
  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.optional(v.string()),
    mutedUntil: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"]),
  groupMessages: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    body: v.string(),
    parentMessageId: v.optional(v.id("groupMessages")),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.optional(v.id("_storage")),
          assetUrl: v.optional(v.string()),
          assetKey: v.optional(v.string()),
          assetProvider: v.optional(v.string()),
          name: v.string(),
          mimeType: v.string(),
          size: v.number(),
          kind: v.string(),
        }),
      ),
    ),
    readByUserIds: v.optional(v.array(v.id("users"))),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_created", ["groupId", "createdAt"]),
  directMessages: defineTable({
    conversationKey: v.string(),
    senderId: v.id("users"),
    recipientId: v.id("users"),
    body: v.string(),
    readByUserIds: v.optional(v.array(v.id("users"))),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_conversation_created", ["conversationKey", "createdAt"])
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_created", ["recipientId", "createdAt"]),
  groupTyping: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"]),
  groupBans: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    bannedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"])
    .index("by_user", ["userId"]),
  groupMonthlyProgress: defineTable({
    groupId: v.id("groups"),
    monthKey: v.string(),
    monthlyBookTitle: v.string(),
    monthlyBookPageTarget: v.number(),
    contributedMinutes: v.number(),
    unlockedPages: v.number(),
    awardedBreakpoints: v.optional(v.array(v.number())),
    completedAt: v.optional(v.number()),
    rewardedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_group_month", ["groupId", "monthKey"]),
  analyticsSessions: defineTable({
    sessionKey: v.string(),
    visitorKey: v.string(),
    appUserId: v.optional(v.string()),
    googleAccountName: v.optional(v.string()),
    googleAccountEmail: v.optional(v.string()),
    sessionStage: v.optional(v.string()),
    sourceHost: v.string(),
    firstSeen: v.number(),
    lastSeen: v.number(),
    lastActiveAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    durationSec: v.number(),
    pageViews: v.number(),
    maxScrollPercent: v.number(),
    lastPath: v.string(),
    pathCounts: v.any(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    endedBy: v.optional(v.string()),
  })
    .index("by_session_key", ["sessionKey"])
    .index("by_last_seen", ["lastSeen"])
    .index("by_visitor_key", ["visitorKey"]),
});
