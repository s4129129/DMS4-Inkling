import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_READING_MATERIAL_TITLE = "ENBJ Official Vol 1";
const DEFAULT_READING_MATERIAL_SOURCE = "official";
const MONTHLY_BOOK_PAGE_TARGET = 88;
const GROUP_WEEKLY_REQUIRED_MEMBERS = 3;
const GROUP_WEEKLY_BASE_HOURS = 80;
const GROUP_WEEKLY_BASE_MINUTES = GROUP_WEEKLY_BASE_HOURS * 60;
const GROUP_WEEKLY_QUILL_BREAKPOINTS = [
  { hours: 20, quills: 10 },
  { hours: 40, quills: 20 },
  { hours: 60, quills: 60 },
  { hours: 80, quills: 100 },
] as const;
const MIN_GROUP_NAME_LENGTH = 3;
const MAX_GROUP_NAME_LENGTH = 60;
const MIN_READING_MATERIAL_TITLE_LENGTH = 2;
const MAX_READING_MATERIAL_TITLE_LENGTH = 120;
const INVITE_CODE_LENGTH = 8;
const MAX_CHAT_MESSAGE_LENGTH = 1200;
const ROOM_MESSAGE_LIMIT = 120;
const MAX_ATTACHMENTS_PER_MESSAGE = 6;
const MAX_ATTACHMENT_NAME_LENGTH = 160;
const MAX_ATTACHMENT_MIME_LENGTH = 120;
const TYPING_VISIBLE_MS = 15_000;
const DEFAULT_TIME_ZONE = "UTC";

const GROUP_ATTACHMENT_VALIDATOR = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
  kind: v.string(),
});

async function requireUserId(ctx: {
  auth: { getUserIdentity: () => Promise<unknown> };
}) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
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

async function getUserTimeZone(ctx: any, userId: any) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  return normalizeTimeZone(profile?.timeZone);
}

function localDatePartsForTimeZone(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
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

function weekStartUtcForTimeZone(ts: number, timeZone: string) {
  const { year, month, day } = localDatePartsForTimeZone(ts, timeZone);
  const localDateUtc = Date.UTC(year, month - 1, day);
  const dayOfWeek = new Date(localDateUtc).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return localDateUtc - daysSinceMonday * 24 * 60 * 60 * 1000;
}

function weekKeyForTimeZone(ts: number, timeZone: string) {
  const monday = new Date(weekStartUtcForTimeZone(ts, timeZone));
  return [
    monday.getUTCFullYear(),
    String(monday.getUTCMonth() + 1).padStart(2, "0"),
    String(monday.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function weekLabelForTimeZone(ts: number, timeZone: string) {
  return `Week of ${new Date(weekStartUtcForTimeZone(ts, timeZone)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function completionPercent(unlockedPages: number, pageTarget: number) {
  if (pageTarget <= 0) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((unlockedPages / pageTarget) * 100)),
  );
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

function normalizeVisibility(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase() === "private"
    ? "private"
    : "public";
}

function normalizeInviteCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeReadingMaterialSource(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase() === "local"
    ? "local"
    : "official";
}

function normalizeMemberRole(value?: string) {
  return String(value || "").trim().toLowerCase() === "admin"
    ? "admin"
    : "member";
}

function buildInitials(label: string) {
  const initials = String(label || "")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "U";
}

function normalizeMessageBody(value: string) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normalizeAttachmentKind(value: string, mimeType: string) {
  const kind = String(value || "").trim().toLowerCase();
  if (kind === "image" || kind === "video" || kind === "document") {
    return kind;
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "document";
}

function normalizeAttachmentName(value: string) {
  const name = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "");
  return (name || "attachment").slice(0, MAX_ATTACHMENT_NAME_LENGTH);
}

function normalizeAttachments(value: Array<any> | undefined) {
  const attachments = Array.isArray(value) ? value : [];
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new Error("Too many attachments.");
  }

  return attachments.map((attachment) => {
    const mimeType = String(attachment.mimeType || "application/octet-stream")
      .trim()
      .slice(0, MAX_ATTACHMENT_MIME_LENGTH);
    const size = Math.max(0, Math.floor(attachment.size || 0));

    return {
      storageId: attachment.storageId,
      name: normalizeAttachmentName(attachment.name),
      mimeType,
      size,
      kind: normalizeAttachmentKind(attachment.kind, mimeType),
    };
  });
}

function uniqueIdList(ids: Array<any>) {
  const seen = new Set<string>();
  const next = [];
  for (const id of ids) {
    const key = `${id}`;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(id);
  }
  return next;
}

function resolveMembershipRole(group: any, membership: any, userId: any) {
  if (`${group.ownerId}` === `${userId}`) {
    return "owner";
  }
  return normalizeMemberRole(membership?.role);
}

function canManageGroup(role: string) {
  return role === "owner" || role === "admin";
}

function canModerateTarget(actorRole: string, targetRole: string) {
  if (actorRole === "owner") {
    return targetRole !== "owner";
  }
  if (actorRole === "admin") {
    return targetRole === "member";
  }
  return false;
}

async function getGroupMembership(ctx: any, groupId: any, userId: any) {
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q: any) =>
      q.eq("groupId", groupId).eq("userId", userId),
    )
    .unique();
}

async function getGroupBan(ctx: any, groupId: any, userId: any) {
  return await ctx.db
    .query("groupBans")
    .withIndex("by_group_user", (q: any) =>
      q.eq("groupId", groupId).eq("userId", userId),
    )
    .unique();
}

async function requireGroupMembership(ctx: any, groupId: any, userId: any) {
  const group = await ctx.db.get(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  const ban = await getGroupBan(ctx, group._id, userId);
  if (ban) {
    throw new Error("You cannot access this group.");
  }

  const membership = await getGroupMembership(ctx, group._id, userId);
  if (!membership) {
    throw new Error("Join this group before using this action.");
  }

  const role = resolveMembershipRole(group, membership, userId);
  return {
    group,
    membership,
    role,
    isMuted: (membership.mutedUntil ?? 0) > Date.now(),
  };
}

async function requireGroupManager(ctx: any, groupId: any, userId: any) {
  const state = await requireGroupMembership(ctx, groupId, userId);
  if (!canManageGroup(state.role)) {
    throw new Error("Only group owners and admins can do that.");
  }
  return state;
}

async function requireGroupOwner(ctx: any, groupId: any, userId: any) {
  const state = await requireGroupMembership(ctx, groupId, userId);
  if (state.role !== "owner") {
    throw new Error("Only the group owner can do that.");
  }
  return state;
}

async function getUserIconPayload(ctx: any, userId: any) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  return {
    image: profile?.userIconStorageId
      ? await ctx.storage.getUrl(profile.userIconStorageId)
      : null,
    iconPreset: profile?.userIconPreset ?? "default-light",
  };
}

async function toPublicMemberProfile(
  ctx: any,
  group: any,
  member: any,
  viewerId: any,
  viewerRole: string,
) {
  const user = await ctx.db.get(member.userId);
  const name = user?.name ?? "";
  const email = user?.email ?? "";
  const label = name || email || "Group member";
  const icon = await getUserIconPayload(ctx, member.userId);
  const role = resolveMembershipRole(group, member, member.userId);
  const isYou = `${member.userId}` === `${viewerId}`;
  const canModerate = !isYou && canModerateTarget(viewerRole, role);

  return {
    userId: member.userId,
    name: label,
    image: icon.image,
    iconPreset: icon.iconPreset,
    initials: buildInitials(label),
    joinedAt: member.joinedAt,
    role,
    mutedUntil: member.mutedUntil ?? null,
    isMuted: (member.mutedUntil ?? 0) > Date.now(),
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isYou,
    canMute: canModerate,
    canBan: canModerate,
    canChangeRole: viewerRole === "owner" && role !== "owner" && !isYou,
  };
}

async function collectRoomMembers(
  ctx: any,
  group: any,
  viewerId: any,
  viewerRole: string,
) {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q: any) => q.eq("groupId", group._id))
    .collect();

  const members = await Promise.all(
    memberships.map((member: any) =>
      toPublicMemberProfile(ctx, group, member, viewerId, viewerRole),
    ),
  );

  return members.sort((a, b) => {
    const roleRank: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    const rankDiff = (roleRank[a.role] ?? 3) - (roleRank[b.role] ?? 3);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    if (a.isYou !== b.isYou) {
      return a.isYou ? -1 : 1;
    }
    return a.joinedAt - b.joinedAt;
  });
}

async function toReadProfiles(ctx: any, readByUserIds: Array<any>, viewerId: any) {
  const uniqueIds = uniqueIdList(readByUserIds);
  const profiles = await Promise.all(
    uniqueIds.map(async (userId: any) => {
      const user = await ctx.db.get(userId);
      const name = user?.name ?? "";
      const email = user?.email ?? "";
      const label = name || email || "Member";
      const icon = await getUserIconPayload(ctx, userId);
      return {
        userId,
        name: label,
        image: icon.image,
        iconPreset: icon.iconPreset,
        initials: buildInitials(label),
        isYou: `${userId}` === `${viewerId}`,
      };
    }),
  );
  return profiles;
}

async function toAttachmentPayload(ctx: any, attachments: Array<any>) {
  return await Promise.all(
    (attachments || []).map(async (attachment: any) => ({
      ...attachment,
      url: await ctx.storage.getUrl(attachment.storageId),
    })),
  );
}

async function toReplyPreview(ctx: any, parentMessageId: any) {
  if (!parentMessageId) {
    return null;
  }

  const parent = await ctx.db.get(parentMessageId);
  if (!parent) {
    return null;
  }

  const user = await ctx.db.get(parent.userId);
  const label = user?.name || user?.email || "Member";
  return {
    _id: parent._id,
    body: parent.deletedAt ? "" : parent.body,
    isDeleted: Boolean(parent.deletedAt),
    authorName: label,
  };
}

async function collectRoomMessages(
  ctx: any,
  groupId: any,
  ownerId: any,
  viewerId: any,
  viewerRole: string,
) {
  const allMessages = await ctx.db
    .query("groupMessages")
    .withIndex("by_group_created", (q: any) => q.eq("groupId", groupId))
    .collect();

  const replyCountByParent = new Map<string, number>();
  for (const message of allMessages) {
    if (!message.parentMessageId || message.deletedAt) {
      continue;
    }
    const parentKey = `${message.parentMessageId}`;
    replyCountByParent.set(parentKey, (replyCountByParent.get(parentKey) ?? 0) + 1);
  }

  const latestMessages = allMessages.slice(-ROOM_MESSAGE_LIMIT);

  const messages = await Promise.all(
    latestMessages.map(async (message: any) => {
      const user = await ctx.db.get(message.userId);
      const name = user?.name ?? "";
      const email = user?.email ?? "";
      const label = name || email || "Member";
      const icon = await getUserIconPayload(ctx, message.userId);
      const isAuthor = `${message.userId}` === `${viewerId}`;
      const isDeleted = Boolean(message.deletedAt);
      const readByProfiles = await toReadProfiles(
        ctx,
        message.readByUserIds ?? [message.userId],
        viewerId,
      );

      return {
        _id: message._id,
        body: isDeleted ? "" : message.body,
        parentMessageId: message.parentMessageId ?? null,
        replyTo: await toReplyPreview(ctx, message.parentMessageId),
        replyCount: replyCountByParent.get(`${message._id}`) ?? 0,
        attachments: isDeleted
          ? []
          : await toAttachmentPayload(ctx, message.attachments ?? []),
        readBy: readByProfiles,
        readByCount: readByProfiles.length,
        status: readByProfiles.some((profile) => !profile.isYou)
          ? "read"
          : "sent",
        createdAt: message.createdAt,
        editedAt: message.editedAt ?? null,
        deletedAt: message.deletedAt ?? null,
        isDeleted,
        canEdit: isAuthor && !isDeleted,
        canDelete: !isDeleted && (isAuthor || canManageGroup(viewerRole)),
        author: {
          userId: message.userId,
          name: label,
          image: icon.image,
          iconPreset: icon.iconPreset,
          initials: buildInitials(label),
          isOwner: `${message.userId}` === `${ownerId}`,
          isYou: isAuthor,
        },
      };
    }),
  );

  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

function directConversationKey(firstUserId: any, secondUserId: any) {
  return [`${firstUserId}`, `${secondUserId}`].sort().join(":");
}

async function usersShareGroup(ctx: any, firstUserId: any, secondUserId: any) {
  if (`${firstUserId}` === `${secondUserId}`) {
    return true;
  }

  const firstMemberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", firstUserId))
    .collect();
  const secondMemberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", secondUserId))
    .collect();
  const firstGroupIds = new Set(
    firstMemberships.map((membership: any) => `${membership.groupId}`),
  );
  return secondMemberships.some((membership: any) =>
    firstGroupIds.has(`${membership.groupId}`),
  );
}

async function requireDirectAccess(ctx: any, viewerId: any, targetUserId: any) {
  if (`${viewerId}` === `${targetUserId}`) {
    throw new Error("Choose another member to message.");
  }

  const targetUser = await ctx.db.get(targetUserId);
  if (!targetUser) {
    throw new Error("Member not found.");
  }
  if (!(await usersShareGroup(ctx, viewerId, targetUserId))) {
    throw new Error("You can only message members who share a group with you.");
  }

  return targetUser;
}

async function collectDirectMessages(ctx: any, targetUserId: any, viewerId: any) {
  const conversationKey = directConversationKey(viewerId, targetUserId);
  const rows = await ctx.db
    .query("directMessages")
    .withIndex("by_conversation_created", (q: any) =>
      q.eq("conversationKey", conversationKey),
    )
    .collect();
  const latestMessages = rows.slice(-ROOM_MESSAGE_LIMIT);

  const messages = await Promise.all(
    latestMessages.map(async (message: any) => {
      const user = await ctx.db.get(message.senderId);
      const name = user?.name ?? "";
      const email = user?.email ?? "";
      const label = name || email || "Member";
      const icon = await getUserIconPayload(ctx, message.senderId);
      const isAuthor = `${message.senderId}` === `${viewerId}`;
      const isDeleted = Boolean(message.deletedAt);
      const readByProfiles = await toReadProfiles(
        ctx,
        message.readByUserIds ?? [message.senderId],
        viewerId,
      );

      return {
        _id: message._id,
        body: isDeleted ? "" : message.body,
        parentMessageId: null,
        replyTo: null,
        replyCount: 0,
        attachments: [],
        readBy: readByProfiles,
        readByCount: readByProfiles.length,
        status: readByProfiles.some((profile) => !profile.isYou)
          ? "read"
          : "sent",
        createdAt: message.createdAt,
        editedAt: message.editedAt ?? null,
        deletedAt: message.deletedAt ?? null,
        isDeleted,
        canEdit: isAuthor && !isDeleted,
        canDelete: isAuthor && !isDeleted,
        author: {
          userId: message.senderId,
          name: label,
          image: icon.image,
          iconPreset: icon.iconPreset,
          initials: buildInitials(label),
          isOwner: false,
          isYou: isAuthor,
        },
      };
    }),
  );

  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

async function collectTypingMembers(ctx: any, groupId: any, viewerId: any) {
  const now = Date.now();
  const typingRows = await ctx.db
    .query("groupTyping")
    .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
    .collect();

  const activeRows = typingRows.filter(
    (row: any) =>
      `${row.userId}` !== `${viewerId}` && now - row.updatedAt <= TYPING_VISIBLE_MS,
  );

  const profiles = await Promise.all(
    activeRows.map(async (row: any) => {
      const user = await ctx.db.get(row.userId);
      const name = user?.name ?? "";
      const email = user?.email ?? "";
      const label = name || email || "Member";
      const icon = await getUserIconPayload(ctx, row.userId);
      return {
        userId: row.userId,
        name: label,
        image: icon.image,
        iconPreset: icon.iconPreset,
        initials: buildInitials(label),
        updatedAt: row.updatedAt,
      };
    }),
  );

  return profiles.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function isGroupMember(ctx: any, groupId: any, userId: any) {
  const membership = await getGroupMembership(ctx, groupId, userId);
  return Boolean(membership);
}

function inviteCodeCandidate() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }
  return code;
}

async function generateUniqueInviteCode(ctx: any) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = inviteCodeCandidate();
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q: any) => q.eq("inviteCode", candidate))
      .unique();
    if (!existing) {
      return candidate;
    }
  }

  return `${Date.now().toString(36).toUpperCase().slice(-INVITE_CODE_LENGTH)}`;
}

async function ensureMembership(
  ctx: any,
  groupId: any,
  userId: any,
  joinedAt: number,
  role = "member",
) {
  const ban = await getGroupBan(ctx, groupId, userId);
  if (ban) {
    throw new Error("You cannot join this group.");
  }

  const existing = await getGroupMembership(ctx, groupId, userId);
  if (existing) {
    return false;
  }

  await ctx.db.insert("groupMembers", {
    groupId,
    userId,
    role: normalizeMemberRole(role) === "admin" ? "admin" : role,
    joinedAt,
  });
  return true;
}

async function toGroupSummary(
  ctx: any,
  group: any,
  weekKey: string,
  membership: any,
) {
  const members = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q: any) => q.eq("groupId", group._id))
    .collect();

  const monthlyProgress = await ctx.db
    .query("groupMonthlyProgress")
    .withIndex("by_group_month", (q: any) =>
      q.eq("groupId", group._id).eq("monthKey", weekKey),
    )
    .unique();

  const isWeeklyEligible = members.length >= GROUP_WEEKLY_REQUIRED_MEMBERS;
  const weeklyTargetMinutes = groupWeeklyTargetMinutes(members.length);
  const weeklyTargetHours = Math.floor(weeklyTargetMinutes / 60);
  const targetMultiplier = groupWeeklyTargetMultiplier(members.length);
  const contributedMinutes = Math.max(
    0,
    Math.min(
      weeklyTargetMinutes,
      isWeeklyEligible ? (monthlyProgress?.contributedMinutes ?? 0) : 0,
    ),
  );
  const contributedHours = Math.round((contributedMinutes / 60) * 10) / 10;
  const awardedBreakpoints = new Set(
    normalizeAwardedBreakpoints(monthlyProgress?.awardedBreakpoints),
  );
  const weeklyBreakpoints = GROUP_WEEKLY_QUILL_BREAKPOINTS.map((breakpoint) => ({
    baseHours: breakpoint.hours,
    hours: Math.floor(breakpoint.hours * targetMultiplier),
    quills: breakpoint.quills,
    isReached:
      isWeeklyEligible &&
      contributedMinutes >= Math.floor(breakpoint.hours * 60 * targetMultiplier),
    isAwarded: awardedBreakpoints.has(breakpoint.hours),
  }));
  const nextBreakpoint =
    weeklyBreakpoints.find((breakpoint) => !breakpoint.isReached) ?? null;
  const isMember = Boolean(membership);
  const viewerRole = isMember
    ? resolveMembershipRole(group, membership, membership.userId)
    : "visitor";

  return {
    _id: group._id,
    ownerId: group.ownerId,
    name: group.name,
    visibility: group.visibility,
    inviteCode:
      isMember && group.visibility === "private" ? (group.inviteCode ?? "") : "",
    memberCount: members.length,
    monthlyBookTitle: "Weekly group timer progress",
    monthlyBookPageTarget: weeklyTargetHours,
    weekKey,
    weeklyBaseHourTarget: GROUP_WEEKLY_BASE_HOURS,
    weeklyTargetMultiplier: targetMultiplier,
    weeklyHourTarget: weeklyTargetHours,
    weeklyRequiredMembers: GROUP_WEEKLY_REQUIRED_MEMBERS,
    weeklyProgressHours: contributedHours,
    weeklyProgressMinutes: contributedMinutes,
    weeklyQuillTotal: GROUP_WEEKLY_QUILL_BREAKPOINTS.reduce(
      (sum, breakpoint) => sum + breakpoint.quills,
      0,
    ),
    weeklyBreakpoints,
    nextWeeklyBreakpoint: nextBreakpoint,
    isWeeklyEligible,
    contributedMinutes,
    unlockedPages: Math.floor(contributedMinutes / 60),
    completionPercent: completionPercent(
      contributedMinutes,
      weeklyTargetMinutes,
    ),
    isCompleted: isWeeklyEligible && contributedMinutes >= weeklyTargetMinutes,
    isMember,
    viewerRole,
    canManageGroup: canManageGroup(viewerRole),
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const timeZone = await getUserTimeZone(ctx, userId);
    const weekKey = weekKeyForTimeZone(now, timeZone);

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const membershipByGroupId = new Map(
      memberships.map((membership) => [`${membership.groupId}`, membership]),
    );

    const myGroupsRaw = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) {
          return null;
        }
        return toGroupSummary(ctx, group, weekKey, membership);
      }),
    );

    const publicGroupsRaw = await ctx.db
      .query("groups")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();
    const publicGroupsVisible = [];
    for (const group of publicGroupsRaw) {
      const ban = await getGroupBan(ctx, group._id, userId);
      if (!ban) {
        publicGroupsVisible.push(group);
      }
    }

    const publicGroups = await Promise.all(
      publicGroupsVisible.map((group) =>
        toGroupSummary(
          ctx,
          group,
          weekKey,
          membershipByGroupId.get(`${group._id}`) ?? null,
        ),
      ),
    );

    const myGroups = myGroupsRaw
      .filter((group): group is NonNullable<typeof group> => group !== null)
      .sort(
        (a, b) =>
          b.completionPercent - a.completionPercent ||
          a.name.localeCompare(b.name),
      );

    return {
      monthLabel: weekLabelForTimeZone(now, timeZone),
      weekLabel: weekLabelForTimeZone(now, timeZone),
      monthlyBookTitle: "Weekly group timer progress",
      weeklyBaseHourTarget: GROUP_WEEKLY_BASE_HOURS,
      weeklyRequiredMembers: GROUP_WEEKLY_REQUIRED_MEMBERS,
      weeklyBreakpoints: GROUP_WEEKLY_QUILL_BREAKPOINTS,
      myGroups,
      publicGroups: publicGroups.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const room = query({
  args: {
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!args.groupId) {
      return null;
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return null;
    }

    const ban = await getGroupBan(ctx, group._id, userId);
    if (ban) {
      throw new Error("You cannot access this group.");
    }

    const membership = await getGroupMembership(ctx, group._id, userId);
    const isMember = Boolean(membership);
    if (group.visibility === "private" && !isMember) {
      throw new Error("This private group is only visible to members.");
    }

    const viewerRole = isMember
      ? resolveMembershipRole(group, membership, userId)
      : "visitor";
    const isMuted = (membership?.mutedUntil ?? 0) > Date.now();
    const members = await collectRoomMembers(ctx, group, userId, viewerRole);
    const messages = await collectRoomMessages(
      ctx,
      group._id,
      group.ownerId,
      userId,
      viewerRole,
    );

    return {
      groupId: group._id,
      canPost: isMember && !isMuted,
      canManageGroup: canManageGroup(viewerRole),
      viewerRole,
      mutedUntil: membership?.mutedUntil ?? null,
      members,
      messages,
      typingMembers: await collectTypingMembers(ctx, group._id, userId),
    };
  },
});

export const markMessagesRead = mutation({
  args: {
    groupId: v.id("groups"),
    messageIds: v.optional(v.array(v.id("groupMessages"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireGroupMembership(ctx, args.groupId, userId);

    const requestedIds = new Set(
      (args.messageIds ?? []).map((messageId) => `${messageId}`),
    );
    const messages = await ctx.db
      .query("groupMessages")
      .withIndex("by_group_created", (q: any) => q.eq("groupId", args.groupId))
      .collect();

    const latestMessages = messages.slice(-ROOM_MESSAGE_LIMIT);
    for (const message of latestMessages) {
      if (requestedIds.size && !requestedIds.has(`${message._id}`)) {
        continue;
      }
      if (`${message.userId}` === `${userId}` || message.deletedAt) {
        continue;
      }
      const readByUserIds = uniqueIdList(message.readByUserIds ?? [message.userId]);
      if (readByUserIds.some((id) => `${id}` === `${userId}`)) {
        continue;
      }
      await ctx.db.patch(message._id, {
        readByUserIds: [...readByUserIds, userId],
      });
    }

    return { ok: true };
  },
});

export const directRoom = query({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!args.targetUserId) {
      return null;
    }

    if (`${userId}` === `${args.targetUserId}`) {
      return null;
    }

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      return null;
    }

    if (!(await usersShareGroup(ctx, userId, args.targetUserId))) {
      return null;
    }

    const name = targetUser?.name ?? "";
    const email = targetUser?.email ?? "";
    const label = name || email || "Member";
    const icon = await getUserIconPayload(ctx, args.targetUserId);

    return {
      target: {
        userId: args.targetUserId,
        name: label,
        image: icon.image,
        iconPreset: icon.iconPreset,
        initials: buildInitials(label),
      },
      messages: await collectDirectMessages(ctx, args.targetUserId, userId),
    };
  },
});

export const sendDirectMessage = mutation({
  args: {
    targetUserId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireDirectAccess(ctx, userId, args.targetUserId);

    const body = normalizeMessageBody(args.body);
    if (!body) {
      throw new Error("Message cannot be empty.");
    }
    if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new Error("Message is too long.");
    }

    const messageId = await ctx.db.insert("directMessages", {
      conversationKey: directConversationKey(userId, args.targetUserId),
      senderId: userId,
      recipientId: args.targetUserId,
      body,
      readByUserIds: [userId],
      createdAt: Date.now(),
    });

    return { messageId };
  },
});

export const editDirectMessage = mutation({
  args: {
    messageId: v.id("directMessages"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) {
      throw new Error("Message not found.");
    }
    if (`${message.senderId}` !== `${userId}`) {
      throw new Error("Only the message author can edit it.");
    }

    const body = normalizeMessageBody(args.body);
    if (!body) {
      throw new Error("Message cannot be empty.");
    }
    if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new Error("Message is too long.");
    }

    await ctx.db.patch(message._id, {
      body,
      editedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteDirectMessage = mutation({
  args: {
    messageId: v.id("directMessages"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) {
      return { ok: true };
    }
    if (`${message.senderId}` !== `${userId}`) {
      throw new Error("Only the message author can delete it.");
    }

    await ctx.db.patch(message._id, {
      body: "",
      deletedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setTyping = mutation({
  args: {
    groupId: v.id("groups"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupMembership(ctx, args.groupId, userId);
    if (state.isMuted) {
      return { ok: false };
    }

    const existing = await ctx.db
      .query("groupTyping")
      .withIndex("by_group_user", (q: any) =>
        q.eq("groupId", args.groupId).eq("userId", userId),
      )
      .unique();

    if (!args.isTyping) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return { ok: true };
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now });
    } else {
      await ctx.db.insert("groupTyping", {
        groupId: args.groupId,
        userId,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});

export const generateAttachmentUploadUrl = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupMembership(ctx, args.groupId, userId);
    if (state.isMuted) {
      throw new Error("You are muted in this group.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: {
    groupId: v.id("groups"),
    body: v.string(),
    parentMessageId: v.optional(v.id("groupMessages")),
    attachments: v.optional(v.array(GROUP_ATTACHMENT_VALIDATOR)),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupMembership(ctx, args.groupId, userId);
    if (state.isMuted) {
      throw new Error("You are muted in this group.");
    }

    const body = normalizeMessageBody(args.body);
    const attachments = normalizeAttachments(args.attachments);
    if (!body && attachments.length === 0) {
      throw new Error("Message cannot be empty.");
    }
    if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new Error("Message is too long.");
    }

    if (args.parentMessageId) {
      const parentMessage = await ctx.db.get(args.parentMessageId);
      if (!parentMessage || `${parentMessage.groupId}` !== `${state.group._id}`) {
        throw new Error("Reply target not found.");
      }
    }

    const messageId = await ctx.db.insert("groupMessages", {
      groupId: state.group._id,
      userId,
      body,
      parentMessageId: args.parentMessageId,
      attachments: attachments.length ? attachments : undefined,
      readByUserIds: [userId],
      createdAt: Date.now(),
    });

    await ctx.db.patch(state.group._id, {
      updatedAt: Date.now(),
    });

    return { messageId };
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("groupMessages"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) {
      throw new Error("Message not found.");
    }
    if (`${message.userId}` !== `${userId}`) {
      throw new Error("Only the message author can edit it.");
    }

    await requireGroupMembership(ctx, message.groupId, userId);
    const body = normalizeMessageBody(args.body);
    if (!body && !(message.attachments ?? []).length) {
      throw new Error("Message cannot be empty.");
    }
    if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new Error("Message is too long.");
    }

    const now = Date.now();
    await ctx.db.patch(message._id, {
      body,
      editedAt: now,
    });
    await ctx.db.patch(message.groupId, { updatedAt: now });
    return { ok: true };
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("groupMessages"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) {
      return { ok: true };
    }

    const state = await requireGroupMembership(ctx, message.groupId, userId);
    if (`${message.userId}` !== `${userId}` && !canManageGroup(state.role)) {
      throw new Error("Only the author or a group admin can delete it.");
    }

    const now = Date.now();
    await ctx.db.patch(message._id, {
      body: "",
      attachments: [],
      deletedAt: now,
    });
    await ctx.db.patch(message.groupId, { updatedAt: now });
    return { ok: true };
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    visibility: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const name = args.name.trim();

    if (
      name.length < MIN_GROUP_NAME_LENGTH ||
      name.length > MAX_GROUP_NAME_LENGTH
    ) {
      throw new Error("Group name must be between 3 and 60 characters.");
    }

    const visibility = normalizeVisibility(args.visibility);
    const inviteCode =
      visibility === "private"
        ? await generateUniqueInviteCode(ctx)
        : undefined;

    const groupId = await ctx.db.insert("groups", {
      ownerId: userId,
      name,
      visibility,
      inviteCode,
      monthlyBookTitle: DEFAULT_READING_MATERIAL_TITLE,
      monthlyBookPageTarget: MONTHLY_BOOK_PAGE_TARGET,
      readingMaterialTitle: DEFAULT_READING_MATERIAL_TITLE,
      readingMaterialSource: DEFAULT_READING_MATERIAL_SOURCE,
      createdAt: now,
      updatedAt: now,
    });

    await ensureMembership(ctx, groupId, userId, now, "owner");

    await ctx.db.insert("groupMessages", {
      groupId,
      userId,
      body: `Group "${name}" created. Welcome to the room.`,
      readByUserIds: [userId],
      createdAt: now,
    });

    return {
      groupId,
      visibility,
      inviteCode: inviteCode ?? "",
    };
  },
});

export const joinPublicGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found.");
    }
    if (group.visibility !== "public") {
      throw new Error("Only public groups can be joined directly.");
    }

    const joined = await ensureMembership(ctx, group._id, userId, Date.now());
    return { groupId: group._id, joined };
  },
});

export const joinPrivateGroup = mutation({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const inviteCode = normalizeInviteCode(args.inviteCode);

    if (!inviteCode) {
      throw new Error("Invite code is required.");
    }

    const group = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode))
      .unique();

    if (!group || group.visibility !== "private") {
      throw new Error("Invalid private group invite code.");
    }

    const joined = await ensureMembership(ctx, group._id, userId, Date.now());
    return {
      groupId: group._id,
      joined,
      groupName: group.name,
    };
  },
});

export const leaveGroup = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(args.groupId);

    if (!group) {
      throw new Error("Group not found.");
    }

    const membership = await getGroupMembership(ctx, group._id, userId);
    if (!membership) {
      return { left: false, disbanded: false };
    }

    await ctx.db.delete(membership._id);

    const typing = await ctx.db
      .query("groupTyping")
      .withIndex("by_group_user", (q: any) =>
        q.eq("groupId", group._id).eq("userId", userId),
      )
      .unique();
    if (typing) {
      await ctx.db.delete(typing._id);
    }

    const remainingMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();

    if (!remainingMembers.length) {
      const allMonthlyProgress = await ctx.db
        .query("groupMonthlyProgress")
        .collect();
      const roomMessages = await ctx.db
        .query("groupMessages")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      const typingRows = await ctx.db
        .query("groupTyping")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      const bans = await ctx.db
        .query("groupBans")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();

      await Promise.all(
        allMonthlyProgress
          .filter((progress) => `${progress.groupId}` === `${group._id}`)
          .map((progress) => ctx.db.delete(progress._id)),
      );
      await Promise.all(roomMessages.map((message) => ctx.db.delete(message._id)));
      await Promise.all(typingRows.map((row) => ctx.db.delete(row._id)));
      await Promise.all(bans.map((ban) => ctx.db.delete(ban._id)));
      await ctx.db.delete(group._id);
      return { left: true, disbanded: true };
    }

    if (`${group.ownerId}` === `${userId}`) {
      const nextOwner = remainingMembers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      await ctx.db.patch(group._id, {
        ownerId: nextOwner.userId,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(nextOwner._id, { role: "owner" });
    }

    return {
      left: true,
      disbanded: false,
      transferredOwner: `${group.ownerId}` === `${userId}`,
    };
  },
});

export const updateGroupMetadata = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupManager(ctx, args.groupId, userId);

    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (typeof args.name === "string") {
      const name = args.name.trim();
      if (
        name.length < MIN_GROUP_NAME_LENGTH ||
        name.length > MAX_GROUP_NAME_LENGTH
      ) {
        throw new Error("Group name must be between 3 and 60 characters.");
      }
      patch.name = name;
    }

    if (typeof args.visibility === "string") {
      const visibility = normalizeVisibility(args.visibility);
      patch.visibility = visibility;
      if (visibility === "private" && !state.group.inviteCode) {
        patch.inviteCode = await generateUniqueInviteCode(ctx);
      }
    }

    await ctx.db.patch(state.group._id, patch);
    return { groupId: state.group._id };
  },
});

export const setMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    targetUserId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupOwner(ctx, args.groupId, userId);
    const targetMembership = await getGroupMembership(
      ctx,
      state.group._id,
      args.targetUserId,
    );
    if (!targetMembership) {
      throw new Error("Member not found.");
    }

    const targetRole = resolveMembershipRole(
      state.group,
      targetMembership,
      args.targetUserId,
    );
    if (targetRole === "owner") {
      throw new Error("The group owner role cannot be changed here.");
    }

    await ctx.db.patch(targetMembership._id, {
      role: normalizeMemberRole(args.role),
    });
    await ctx.db.patch(state.group._id, { updatedAt: Date.now() });
    return { ok: true };
  },
});

export const muteMember = mutation({
  args: {
    groupId: v.id("groups"),
    targetUserId: v.id("users"),
    mutedUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupManager(ctx, args.groupId, userId);
    const targetMembership = await getGroupMembership(
      ctx,
      state.group._id,
      args.targetUserId,
    );
    if (!targetMembership) {
      throw new Error("Member not found.");
    }

    const targetRole = resolveMembershipRole(
      state.group,
      targetMembership,
      args.targetUserId,
    );
    if (!canModerateTarget(state.role, targetRole)) {
      throw new Error("You cannot moderate that member.");
    }

    const mutedUntil =
      typeof args.mutedUntil === "number" && args.mutedUntil > Date.now()
        ? args.mutedUntil
        : undefined;
    await ctx.db.patch(targetMembership._id, { mutedUntil });
    await ctx.db.patch(state.group._id, { updatedAt: Date.now() });
    return { ok: true, mutedUntil: mutedUntil ?? null };
  },
});

export const banMember = mutation({
  args: {
    groupId: v.id("groups"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupManager(ctx, args.groupId, userId);
    const targetMembership = await getGroupMembership(
      ctx,
      state.group._id,
      args.targetUserId,
    );
    if (!targetMembership) {
      throw new Error("Member not found.");
    }

    const targetRole = resolveMembershipRole(
      state.group,
      targetMembership,
      args.targetUserId,
    );
    if (!canModerateTarget(state.role, targetRole)) {
      throw new Error("You cannot moderate that member.");
    }

    const existingBan = await getGroupBan(ctx, state.group._id, args.targetUserId);
    if (!existingBan) {
      await ctx.db.insert("groupBans", {
        groupId: state.group._id,
        userId: args.targetUserId,
        bannedByUserId: userId,
        createdAt: Date.now(),
      });
    }

    await ctx.db.delete(targetMembership._id);
    const typing = await ctx.db
      .query("groupTyping")
      .withIndex("by_group_user", (q: any) =>
        q.eq("groupId", state.group._id).eq("userId", args.targetUserId),
      )
      .unique();
    if (typing) {
      await ctx.db.delete(typing._id);
    }
    await ctx.db.patch(state.group._id, { updatedAt: Date.now() });
    return { ok: true };
  },
});

export const setGroupReadingMaterial = mutation({
  args: {
    groupId: v.id("groups"),
    title: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = await requireGroupManager(ctx, args.groupId, userId);

    const nextTitle = String(args.title || "").trim();
    if (
      nextTitle.length < MIN_READING_MATERIAL_TITLE_LENGTH ||
      nextTitle.length > MAX_READING_MATERIAL_TITLE_LENGTH
    ) {
      throw new Error(
        "Reading material title must be between 2 and 120 characters.",
      );
    }

    const nextSource = normalizeReadingMaterialSource(args.source);
    const now = Date.now();

    await ctx.db.patch(state.group._id, {
      readingMaterialTitle: nextTitle,
      readingMaterialSource: nextSource,
      monthlyBookTitle: nextTitle,
      updatedAt: now,
    });

    await ctx.db.insert("groupMessages", {
      groupId: state.group._id,
      userId,
      body: `Reading material changed to ${nextTitle} (${nextSource}).`,
      readByUserIds: [userId],
      createdAt: now,
    });

    return {
      groupId: state.group._id,
      readingMaterialTitle: nextTitle,
      readingMaterialSource: nextSource,
    };
  },
});
