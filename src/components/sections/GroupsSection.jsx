import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import AvatarPickerOverlay from "../AvatarPickerOverlay";
import DashboardSection from "./DashboardSection";
import * as logoCatalog from "../../themes/logoCatalog";

function getPresetLogo(presetId) {
  if (typeof logoCatalog.getLogoPresetAsset === "function") {
    return logoCatalog.getLogoPresetAsset(presetId);
  }
  return (
    logoCatalog.DEFAULT_THEME_LOGO ??
    logoCatalog.getThemeLogoAsset?.("default", "light") ??
    ""
  );
}

const MESSAGE_LINK_REGEX = /(https?:\/\/[^\s]+)/gi;
const MAX_PENDING_ATTACHMENTS = 6;
const TYPING_STALE_MS = 5000;
const GROUP_CHAT_SCROLL_MEMORY = new Map();
const GROUP_CHAT_BOTTOM_THRESHOLD_PX = 48;
const GROUP_CHAT_SCROLL_RESTORE_ATTEMPTS = 8;
const GROUPS_UI_STATE_STORAGE_KEY = "inkling:groups-ui-state:v1";
const GROUPS_SCROLL_STORAGE_KEY = "inkling:groups-chat-scroll:v1";
const DEFAULT_GROUPS_UI_STATE = Object.freeze({
  leftMode: "discover",
  conversationMode: "groups",
  isListRailCollapsed: false,
  isInfoPanelOpen: true,
  selectedDirectMemberId: "",
  startedDirectMemberIds: [],
});

let didHydrateGroupChatScrollMemory = false;

function readStorageJson(key) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorageJson(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep current state in-memory.
  }
}

function sanitizeGroupsUiState(value) {
  const next = { ...DEFAULT_GROUPS_UI_STATE };
  const source = value && typeof value === "object" ? value : null;
  if (!source) {
    return next;
  }

  if (source.leftMode === "discover") {
    next.leftMode = source.leftMode;
  }
  if (
    source.conversationMode === "groups" ||
    source.conversationMode === "dms"
  ) {
    next.conversationMode = source.conversationMode;
  }
  if (typeof source.isListRailCollapsed === "boolean") {
    next.isListRailCollapsed = source.isListRailCollapsed;
  }
  if (typeof source.isInfoPanelOpen === "boolean") {
    next.isInfoPanelOpen = source.isInfoPanelOpen;
  }
  if (typeof source.selectedDirectMemberId === "string") {
    next.selectedDirectMemberId = source.selectedDirectMemberId.trim();
  }
  if (Array.isArray(source.startedDirectMemberIds)) {
    next.startedDirectMemberIds = Array.from(
      new Set(
        source.startedDirectMemberIds
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    );
  }
  if (!next.startedDirectMemberIds.includes(next.selectedDirectMemberId)) {
    next.selectedDirectMemberId = "";
  }
  if (next.conversationMode === "dms" && !next.selectedDirectMemberId) {
    next.conversationMode = "groups";
  }

  return next;
}

function readStoredGroupsUiState() {
  return sanitizeGroupsUiState(readStorageJson(GROUPS_UI_STATE_STORAGE_KEY));
}

function persistGroupsUiState(value) {
  writeStorageJson(
    GROUPS_UI_STATE_STORAGE_KEY,
    sanitizeGroupsUiState(value),
  );
}

function hydrateGroupChatScrollMemory() {
  if (didHydrateGroupChatScrollMemory) {
    return;
  }

  didHydrateGroupChatScrollMemory = true;
  const stored = readStorageJson(GROUPS_SCROLL_STORAGE_KEY);
  if (!stored || typeof stored !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(stored)) {
    const scrollTop = Number(value);
    if (!key || !Number.isFinite(scrollTop)) {
      continue;
    }
    GROUP_CHAT_SCROLL_MEMORY.set(key, Math.max(0, Math.round(scrollTop)));
  }
}

function persistGroupChatScrollMemory() {
  hydrateGroupChatScrollMemory();

  const payload = {};
  for (const [key, value] of GROUP_CHAT_SCROLL_MEMORY.entries()) {
    if (!key || !Number.isFinite(value)) {
      continue;
    }
    payload[key] = Math.max(0, Math.round(value));
  }

  writeStorageJson(GROUPS_SCROLL_STORAGE_KEY, payload);
}

function readStoredConversationScroll(key) {
  if (!key) {
    return null;
  }

  hydrateGroupChatScrollMemory();
  const value = GROUP_CHAT_SCROLL_MEMORY.get(key);
  return Number.isFinite(value) ? value : null;
}

function cacheConversationScroll(key, value) {
  if (!key || !Number.isFinite(value)) {
    return;
  }

  hydrateGroupChatScrollMemory();
  GROUP_CHAT_SCROLL_MEMORY.set(key, Math.max(0, Math.round(value)));
}

function persistConversationScroll(key, value) {
  cacheConversationScroll(key, value);
  persistGroupChatScrollMemory();
}

function buildConversationScrollKey(groupId, mode, directMemberId) {
  const safeGroupId = String(groupId || "").trim();
  if (!safeGroupId) {
    return "";
  }

  if (mode === "dms") {
    const safeDirectMemberId = String(directMemberId || "all").trim() || "all";
    return `dm:${safeGroupId}:${safeDirectMemberId}`;
  }

  return `group:${safeGroupId}`;
}

function isStreamNearBottom(element) {
  if (!element) {
    return true;
  }

  return (
    element.scrollHeight - (element.scrollTop + element.clientHeight) <=
    GROUP_CHAT_BOTTOM_THRESHOLD_PX
  );
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function matchesGroupQuery(group, query) {
  if (!query) {
    return true;
  }

  const haystack = `${group.name} ${group.inviteCode || ""}`;
  return normalizeText(haystack).includes(query);
}

function initialsFromName(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return "GR";
  }
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function formatMessageTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(value) {
  const bytes = Math.max(0, Math.floor(value || 0));
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function formatAttachmentBadge(value) {
  const normalized = String(value || "file")
    .trim()
    .toLowerCase();
  const labels = {
    document: "DOC",
    image: "IMG",
    video: "VID",
    spreadsheet: "XLS",
    presentation: "PPT",
    archive: "ZIP",
    text: "TXT",
  };
  return (labels[normalized] || normalized || "file")
    .slice(0, 3)
    .toUpperCase();
}

function extractMessageLinks(messages) {
  const items = [];
  const seen = new Set();

  for (const message of messages || []) {
    if (message?.isDeleted) {
      continue;
    }
    const links = String(message?.body || "").match(MESSAGE_LINK_REGEX) || [];
    for (const link of links) {
      const normalized = link.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      items.push({
        id: `link:${normalized}`,
        ext: "url",
        name: link,
        meta: `Shared by ${message?.author?.name || "member"}`,
        url: link,
      });
    }
  }

  return items;
}

function extractMessageAttachments(messages) {
  const items = [];
  for (const message of messages || []) {
    for (const attachment of message?.attachments || []) {
      const attachmentId =
        attachment.storageId || attachment.assetKey || attachment.url || attachment.name;
      items.push({
        id: `${message._id}:${attachmentId}`,
        ext: formatAttachmentBadge(attachment.kind),
        name: attachment.name,
        meta: `${formatFileSize(attachment.size)} - ${message?.author?.name || "member"}`,
        url: attachment.url,
        kind: attachment.kind || "document",
        mimeType: attachment.mimeType || "",
        size: attachment.size || 0,
        authorName: message?.author?.name || "member",
      });
    }
  }
  return items;
}

function toGroupEntry(group, source) {
  return {
    ...group,
    source,
  };
}

function messagePreviewText(message) {
  if (!message) {
    return "";
  }
  if (message.isDeleted) {
    return "Message deleted";
  }
  const body = String(message.body || "").trim();
  if (body) {
    return body.length > 90 ? `${body.slice(0, 90)}...` : body;
  }
  const attachment = message.attachments?.[0];
  return attachment?.name || "";
}

function roleLabel(member) {
  if (member?.role === "owner") {
    return "Owner";
  }
  if (member?.role === "admin") {
    return "Admin";
  }
  return member?.isYou ? "You" : "Member";
}

function typingText(members) {
  if (!members.length) {
    return "";
  }
  if (members.length === 1) {
    return `${members[0].name} is typing...`;
  }
  if (members.length === 2) {
    return `${members[0].name} and ${members[1].name} are typing...`;
  }
  return `${members[0].name} and ${members.length - 1} others are typing...`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M10.5 3.75a6.75 6.75 0 0 1 5.287 10.947l4.258 4.258a.75.75 0 1 1-1.06 1.06l-4.258-4.258A6.75 6.75 0 1 1 10.5 3.75Zm0 1.5a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 4.5a.75.75 0 0 1 .75.75v6h6a.75.75 0 0 1 0 1.5h-6v6a.75.75 0 0 1-1.5 0v-6h-6a.75.75 0 0 1 0-1.5h6v-6A.75.75 0 0 1 12 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 5.5A3.5 3.5 0 0 1 8.5 2h7A3.5 3.5 0 0 1 19 5.5v4A3.5 3.5 0 0 1 15.5 13H10l-4.36 3.63A1 1 0 0 1 4 15.86V5.5Zm4.5 9.5h6A5.5 5.5 0 0 0 21 9.5v-4A5.5 5.5 0 0 0 15.5 0h-7A5.5 5.5 0 0 0 3 5.5v9.29a3 3 0 0 0 4.92 2.3L9.5 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DmIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.24 0-8 2.48-8 5.5A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5c0-3.02-3.76-5.5-8-5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm2 0v14h3V5H6Zm5 0v14h7V5h-7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.7a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Zm1 10.3a1 1 0 1 1-2 0v-5a1 1 0 1 1 2 0v5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10.5c3.86 0 7 2.23 7 5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19c0-2.77 3.14-5 7-5Zm8.25-8a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5H21v1.5a.75.75 0 0 1-1.5 0v-1.5H18a.75.75 0 0 1 0-1.5h1.5v-1.5a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M10.7 6.3a1 1 0 0 1 0 1.4L8.4 10H14a6 6 0 0 1 6 6v1a1 1 0 1 1-2 0v-1a4 4 0 0 0-4-4H8.4l2.3 2.3a1 1 0 1 1-1.4 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.4 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M16.9 3.3a2.2 2.2 0 0 1 3.1 3.1L8.7 17.7a1 1 0 0 1-.45.26l-4 1a1 1 0 0 1-1.21-1.21l1-4a1 1 0 0 1 .26-.45L16.9 3.3Zm1.68 1.42a.2.2 0 0 0-.27 0L5.9 14.12l-.53 2.11 2.11-.53 12.4-12.4a.2.2 0 0 0 0-.28l-1.3-1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm1 2h4V5h-4Zm-3 4a1 1 0 0 1 1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8a1 1 0 1 1 2 0v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M18.4 6.1a4.4 4.4 0 0 0-6.22 0l-6.36 6.36a3.15 3.15 0 0 0 4.45 4.46l6.36-6.37a1.9 1.9 0 0 0-2.68-2.68l-5.83 5.82a1 1 0 1 1-1.41-1.41l5.82-5.83a3.9 3.9 0 0 1 5.52 5.52l-6.36 6.36a5.15 5.15 0 0 1-7.28-7.28l6.36-6.36a6.4 6.4 0 0 1 9.05 9.05l-6.36 6.36a1 1 0 1 1-1.41-1.41l6.36-6.36a4.4 4.4 0 0 0 0-6.22Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5a5.5 5.5 0 0 0-5.5 5.5v2.8c0 .66-.22 1.3-.63 1.82L4.3 14.6A1.5 1.5 0 0 0 5.48 17h13.04a1.5 1.5 0 0 0 1.18-2.4l-1.57-1.98a2.94 2.94 0 0 1-.63-1.82V8A5.5 5.5 0 0 0 12 2.5Zm2.2 16a2.25 2.25 0 0 1-4.4 0h4.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 12.8 4.1-4.1a1 1 0 0 1 1.4 0l2.2 2.2 1.1-1.1a1 1 0 0 1 1.4 0L19 17.6V6H5v10.8ZM8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6.22 4.8 12 10.59l5.78-5.8a1 1 0 0 1 1.42 1.42L13.41 12l5.8 5.78a1 1 0 0 1-1.42 1.42L12 13.41l-5.78 5.8a1 1 0 0 1-1.42-1.42L10.59 12l-5.8-5.78A1 1 0 0 1 6.22 4.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M20.7 6.3a1 1 0 0 1 0 1.4l-10 10a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l4.3 4.29L19.3 6.3a1 1 0 0 1 1.4 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M20.7 7.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.79 6.8-6.79a1 1 0 0 1 1.4 0ZM14.7 7.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5a1 1 0 0 1 .34.06l7 2.5a1 1 0 0 1 .66.94v5.2c0 4.5-2.78 8.52-7 10.1a1 1 0 0 1-.7 0c-4.22-1.58-7-5.6-7-10.1V6a1 1 0 0 1 .66-.94l7-2.5A1 1 0 0 1 12 2.5Zm0 2.07L7 6.36v4.84c0 3.43 1.96 6.52 5 7.98 3.04-1.46 5-4.55 5-7.98V6.36l-5-1.79Z"
        fill="currentColor"
      />
    </svg>
  );
}

function QuillIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M19.6 3.3a1 1 0 0 0-1.4 0l-9.9 9.9-2.5 6.2a1 1 0 0 0 1.3 1.3l6.2-2.5 9.9-9.9a1 1 0 0 0 0-1.4l-3.6-3.6zM12.9 17l-3.7 1.5L10.7 15l7.2-7.2 2.2 2.2L12.9 17z"
        fill="currentColor"
      />
    </svg>
  );
}

function GroupListItem({ group, selected, busy, onSelect, onJoin }) {
  const canJoin = group.source === "discover" && !group.isMember;

  return (
    <article className={`groups-room-item${selected ? " active" : ""}`}>
      <button type="button" className="groups-room-main" onClick={onSelect}>
        <span className="groups-room-avatar">
          {group.iconUrl ? (
            <img src={group.iconUrl} alt="" />
          ) : (
            initialsFromName(group.name)
          )}
        </span>
        <span className="groups-room-meta">
          <strong>{group.name}</strong>
          <span>{Math.max(1, Math.floor(group.memberCount ?? 1))} members</span>
        </span>
      </button>

      {canJoin ? (
        <button
          type="button"
          className="ghost groups-room-join"
          disabled={busy}
          onClick={() => onJoin(group._id)}
        >
          Join
        </button>
      ) : null}
    </article>
  );
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function formatProgressHours(value) {
  const hours = Math.max(0, Number(value || 0));
  return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(1)}`;
}

function activationRequirementText(memberCount, requiredMembers = 3) {
  return `Requires ${Math.max(0, Math.floor(memberCount ?? 0))}/${Math.max(
    1,
    Math.floor(requiredMembers ?? 3),
  )} members to activate`;
}

function parseWeekKeyDate(weekKey) {
  const parts = String(weekKey || "")
    .split("-")
    .map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatWeekRangeLabel(weekKey, language = "en", fallback = "This week") {
  const start = parseWeekKeyDate(weekKey);
  if (!start) {
    return fallback;
  }

  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  if (language === "vi") {
    const format = (date) =>
      date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
    return `${format(start)} - ${format(end)}`;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const startFormat = sameMonth
    ? { month: "short", day: "numeric", timeZone: "UTC" }
    : {
        month: "short",
        day: "numeric",
        year: sameYear ? undefined : "numeric",
        timeZone: "UTC",
      };

  return `${start.toLocaleDateString(
    "en-US",
    startFormat,
  )} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function WeeklyGroupProgress({ group, periodLabel, language = "en" }) {
  const percent = clampPercent(group?.completionPercent);
  const targetHours = Math.max(1, Math.floor(group?.weeklyHourTarget ?? 80));
  const progressHours = formatProgressHours(group?.weeklyProgressHours ?? 0);
  const weekRangeLabel = formatWeekRangeLabel(
    group?.weekKey,
    language,
    periodLabel || "This week",
  );
  const memberCount = Math.max(0, Math.floor(group?.memberCount ?? 0));
  const requiredMembers = Math.max(
    1,
    Math.floor(group?.weeklyRequiredMembers ?? 3),
  );
  const breakpoints = Array.isArray(group?.weeklyBreakpoints)
    ? group.weeklyBreakpoints
    : [
        { hours: 20, quills: 10 },
        { hours: 40, quills: 20 },
        { hours: 60, quills: 60 },
        { hours: 80, quills: 100 },
      ];

  if (!group?.isWeeklyEligible) {
    return (
      <div className="groups-weekly-progress">
        <p className="status-text">
          {activationRequirementText(memberCount, requiredMembers)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="groups-weekly-progress"
      style={{ "--groups-weekly-progress": `${percent}%` }}
    >
      <div className="groups-weekly-progress-head">
        <span>{weekRangeLabel}</span>
        <strong>
          {progressHours}/{targetHours}h
        </strong>
      </div>
      <div className="groups-weekly-track" aria-hidden="true">
        <span className="groups-weekly-fill" />
        {breakpoints.map((breakpoint) => (
          <i
            key={breakpoint.hours}
            className={breakpoint.isReached ? "is-reached" : ""}
            style={{
              "--groups-weekly-marker": `${clampPercent(
                (Number(breakpoint.hours || 0) / targetHours) * 100,
              )}%`,
            }}
          />
        ))}
      </div>
      <div className="groups-weekly-breakpoints">
        {breakpoints.map((breakpoint) => (
          <span
            key={`${breakpoint.hours}-${breakpoint.quills}`}
            className={breakpoint.isReached ? "is-reached" : ""}
            style={{
              "--groups-weekly-marker": `${clampPercent(
                (Number(breakpoint.hours || 0) / targetHours) * 100,
              )}%`,
            }}
          >
            +{breakpoint.quills}
            <QuillIcon />
          </span>
        ))}
      </div>
    </div>
  );
}

function MessageAuthorAvatar({ author, onOpenPersonMenu }) {
  const authorName = author?.name || "Member";
  const authorImage = author?.image || getPresetLogo(author?.iconPreset);
  const avatarContent = authorImage ? (
    <img src={authorImage} alt="" />
  ) : (
    <span>{author?.initials || initialsFromName(authorName)}</span>
  );

  if (typeof onOpenPersonMenu === "function") {
    return (
      <button
        type="button"
        className="groups-message-author-avatar groups-person-trigger"
        onClick={(event) => onOpenPersonMenu(author, event)}
        aria-label={`Open ${authorName} options`}
        title={authorName}
      >
        {avatarContent}
      </button>
    );
  }

  return (
    <span className="groups-message-author-avatar" aria-hidden="true">
      {avatarContent}
    </span>
  );
}

function ReadReceiptAvatar({ profile, onOpenPersonMenu }) {
  const image = profile?.image || getPresetLogo(profile?.iconPreset);
  const name = profile?.name || "Member";

  if (typeof onOpenPersonMenu === "function") {
    return (
      <button
        type="button"
        className="groups-read-avatar groups-person-trigger"
        onClick={(event) => onOpenPersonMenu(profile, event)}
        aria-label={`Open ${name} options`}
        title={name}
      >
        <img src={image} alt="" />
      </button>
    );
  }

  return <img src={image} alt={name} className="groups-read-avatar-image" />;
}

function MessageStatus({ message, onOpenPersonMenu }) {
  if (!message?.author?.isYou || message.isDeleted) {
    return null;
  }

  const readers = (message.readBy || []).filter((profile) => !profile.isYou);
  const isRead = message.status === "read" || Number(message.readByCount || 0) > 1;
  return (
    <span className="groups-message-status" title={message.status}>
      {isRead ? (
        <>
          <DoubleCheckIcon />
          {readers.length ? (
            <span className="groups-read-stack">
              {readers.slice(0, 4).map((profile) => (
                <ReadReceiptAvatar
                  key={`${profile.userId}`}
                  profile={profile}
                  onOpenPersonMenu={onOpenPersonMenu}
                />
              ))}
            </span>
          ) : null}
        </>
      ) : (
        <CheckIcon />
      )}
    </span>
  );
}

function AttachmentPreview({ attachment }) {
  const kind = attachment.kind || "document";
  if (kind === "image" && attachment.url) {
    return (
      <a
        className="groups-message-media image"
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
      >
        <img src={attachment.url} alt={attachment.name} />
      </a>
    );
  }

  if (kind === "video" && attachment.url) {
    return (
      <video className="groups-message-media" controls preload="metadata">
        <source src={attachment.url} type={attachment.mimeType} />
      </video>
    );
  }

  const content = (
    <>
      <span className="groups-attachment-icon">
        {formatAttachmentBadge(kind)}
      </span>
      <span className="groups-attachment-copy">
        <strong>{attachment.name}</strong>
        <span>{formatFileSize(attachment.size)}</span>
      </span>
    </>
  );

  if (attachment.url) {
    return (
      <a
        className="groups-file-card"
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return <span className="groups-file-card">{content}</span>;
}

function MessageBubble({
  message,
  canReply,
  onReply,
  onEdit,
  onDelete,
  onOpenPersonMenu,
}) {
  const isOutgoing = Boolean(message?.author?.isYou);
  const hasAttachments = Boolean(message?.attachments?.length);

  return (
    <article
      className={`groups-message ${isOutgoing ? "outgoing" : "incoming"}${message.isDeleted ? " deleted" : ""}`}
    >
      <div className="groups-message-topline">
        <div className="groups-message-author-line">
          <MessageAuthorAvatar
            author={message?.author}
            onOpenPersonMenu={onOpenPersonMenu}
          />
          <p className="groups-message-author">
            {message?.author?.name || "Member"}
          </p>
        </div>
        <div className="groups-message-actions">
          {canReply && !message.isDeleted ? (
            <button
              type="button"
              className="groups-mini-icon-button"
              onClick={() => onReply(message)}
              aria-label="Reply"
              title="Reply"
            >
              <ReplyIcon />
            </button>
          ) : null}
          {message.canEdit ? (
            <button
              type="button"
              className="groups-mini-icon-button"
              onClick={() => onEdit(message)}
              aria-label="Edit"
              title="Edit"
            >
              <EditIcon />
            </button>
          ) : null}
          {message.canDelete ? (
            <button
              type="button"
              className="groups-mini-icon-button danger"
              onClick={() => onDelete(message)}
              aria-label="Delete"
              title="Delete"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>

      {message.replyTo ? (
        <div className="groups-message-reply-preview">
          <strong>{message.replyTo.authorName}</strong>
          <span>{messagePreviewText(message.replyTo)}</span>
        </div>
      ) : null}

      {message.isDeleted ? (
        <p className="groups-message-text groups-message-deleted">
          Message deleted
        </p>
      ) : message.body ? (
        <p className="groups-message-text">{message.body}</p>
      ) : null}

      {hasAttachments ? (
        <div className="groups-message-attachments">
          {message.attachments.map((attachment) => (
            <AttachmentPreview
              key={`${message._id}:${attachment.storageId || attachment.assetKey || attachment.url || attachment.name}`}
              attachment={attachment}
            />
          ))}
        </div>
      ) : null}

      <div className="groups-message-footer">
        {message.replyCount ? (
          <span className="groups-thread-count">
            {message.replyCount} replies
          </span>
        ) : null}
        {message.editedAt && !message.isDeleted ? (
          <span className="groups-message-edited">Edited</span>
        ) : null}
        <span className="groups-message-time">
          {formatMessageTime(message?.createdAt)}
        </span>
        <MessageStatus
          message={message}
          onOpenPersonMenu={onOpenPersonMenu}
        />
      </div>
    </article>
  );
}

function clampMenuCoordinate(value, size, viewportSize) {
  const viewportPadding = 12;
  return Math.max(
    viewportPadding,
    Math.min(value, viewportSize - size - viewportPadding),
  );
}

function MemberActionMenu({
  menu,
  onClose,
  onMessage,
  onViewProfile,
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({
    x: menu?.x ?? 12,
    y: menu?.y ?? 12,
    ready: false,
  });
  const member = menu?.member ?? null;
  const isSelf = Boolean(member?.isYou);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || !menu?.anchorRect || !menuRef.current) {
      return;
    }

    const anchor = menu.anchorRect;
    const menuRect = menuRef.current.getBoundingClientRect();
    const width = Math.min(menuRect.width || 230, window.innerWidth - 24);
    const height = Math.min(menuRect.height || 154, window.innerHeight - 24);
    const viewportPadding = 12;
    const gap = 10;
    const spaceRight = window.innerWidth - anchor.right - viewportPadding;
    const spaceLeft = anchor.left - viewportPadding;
    const hasRoomRight = spaceRight >= width + gap;
    const hasRoomLeft = spaceLeft >= width + gap;
    const preferredX = hasRoomRight
      ? anchor.right + gap
      : hasRoomLeft
        ? anchor.left - width - gap
        : anchor.left + anchor.width / 2 - width / 2;
    const preferredY =
      anchor.top + anchor.height / 2 - height / 2;

    setPosition({
      x: clampMenuCoordinate(preferredX, width, window.innerWidth),
      y: clampMenuCoordinate(preferredY, height, window.innerHeight),
      ready: true,
    });
  }, [menu?.anchorRect]);

  useLayoutEffect(() => {
    setPosition({
      x: menu?.x ?? 12,
      y: menu?.y ?? 12,
      ready: false,
    });
  }, [menu?.x, menu?.y, menu?.member]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, member]);

  useEffect(() => {
    if (!menu?.member || typeof window === "undefined") {
      return undefined;
    }

    let frameId = 0;
    const scheduleUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updatePosition();
      });
    };

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [menu?.member, updatePosition]);

  if (!menu?.member) {
    return null;
  }

  const menuStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    opacity: position.ready ? 1 : 0,
  };

  return createPortal(
    <>
      <button
        type="button"
        className="groups-person-menu-scrim"
        aria-label="Close member menu"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className="groups-person-menu"
        style={menuStyle}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          disabled={isSelf}
          onClick={() => onMessage(member)}
        >
          <DmIcon />
          <span>Message</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => onViewProfile(member)}
        >
          <ProfileIcon />
          <span>{isSelf ? "View your profile" : "View profile"}</span>
        </button>
        <button type="button" role="menuitem" disabled>
          <ShieldIcon />
          <span>Block</span>
        </button>
      </div>
    </>,
    document.body,
  );
}

function PublicProfileModal({
  member,
  overview,
  onClose,
  themeId,
  themeMode,
  accentColor,
}) {
  if (!member) {
    return null;
  }

  const isLoading = overview === undefined;
  const profile = overview?.profile ?? {};
  const avatarSrc =
    profile.userIconUrl || member.image || getPresetLogo(profile.userIconPreset || member.iconPreset);
  const displayName = overview?.displayName || member.name || "Member";

  return (
    <div className="settings-overlay groups-profile-overlay" role="dialog" aria-modal="true">
      <section className="faq-card groups-profile-modal">
        <header className="faq-card-header groups-profile-modal-header">
          <div className="groups-profile-title-cluster">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="groups-profile-avatar-image" />
            ) : (
              <span className="groups-profile-avatar">
                {member.initials || initialsFromName(displayName)}
              </span>
            )}
            <div>
              <p className="dash-kicker">{member.role || "Member"}</p>
              <h2>{displayName}</h2>
            </div>
          </div>
          <button
            type="button"
            className="ghost settings-close-btn"
            onClick={onClose}
            aria-label="Close profile"
          >
            <XIcon />
          </button>
        </header>

        <div className="groups-profile-overview-shell">
          {isLoading ? (
            <p className="status-text">Loading profile...</p>
          ) : overview ? (
            <DashboardSection
              title={`${displayName}'s Overview`}
              progressBooks={overview.progressBooks}
              weekly={overview.weekly}
              dailyActivity={overview.dailyActivity}
              timerSessions={[]}
              timerSessions24h={[]}
              totalUnlockedPagesEver={overview.totalUnlockedPagesEver}
              totalSessionSecondsEver={overview.totalSessionSecondsEver}
              bookThumbnailMap={{}}
              themeId={themeId}
              themeMode={themeMode}
              accentColor={accentColor}
              hidePrivatePanels
              disableContinueAction
            />
          ) : (
            <p className="status-text">Profile unavailable.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function GroupsSection({
  myGroups,
  publicGroups,
  monthLabel,
  groupState,
  isLoading,
  onCreateGroup,
  onJoinPublicGroup,
  onJoinPrivateGroup,
  onLeaveGroup,
  selectedGroupId,
  onSelectGroupId,
  selectedGroupRoom,
  selectedGroupTypingMembers = [],
  isGroupRoomLoading,
  onSendGroupMessage,
  onEditGroupMessage,
  onDeleteGroupMessage,
  onMarkGroupMessagesRead,
  onSetGroupTyping,
  onUploadGroupAttachment,
  onUploadGroupIcon,
  onUpdateGroupMetadata,
  onSetGroupMemberRole,
  onMuteGroupMember,
  onBanGroupMember,
  interactionLocked = false,
  interactionLockReason = "",
  themeId = "ink",
  themeMode = "light",
  accentColor = "",
  selectedLanguage = "en",
}) {
  const initialUiStateRef = useRef(null);
  if (initialUiStateRef.current === null) {
    initialUiStateRef.current = readStoredGroupsUiState();
  }
  const initialUiState = initialUiStateRef.current;
  const [groupNameInput, setGroupNameInput] = useState("");
  const [visibilityInput, setVisibilityInput] = useState("public");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [findInput, setFindInput] = useState("");
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [leftMode, setLeftMode] = useState(initialUiState.leftMode);
  const [conversationMode, setConversationMode] = useState(
    initialUiState.conversationMode,
  );
  const [isListRailCollapsed, setIsListRailCollapsed] = useState(
    initialUiState.isListRailCollapsed,
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(
    initialUiState.isInfoPanelOpen,
  );
  const [selectedDirectMemberId, setSelectedDirectMemberId] = useState(
    initialUiState.selectedDirectMemberId,
  );
  const [startedDirectMemberIds, setStartedDirectMemberIds] = useState(
    initialUiState.startedDirectMemberIds,
  );
  const [personMenu, setPersonMenu] = useState(null);
  const [profileMember, setProfileMember] = useState(null);
  const [internalSelectedGroupId, setInternalSelectedGroupId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isMobileConversationOpen, setIsMobileConversationOpen] = useState(false);
  const [typingNow, setTypingNow] = useState(Date.now());
  const [groupEditName, setGroupEditName] = useState("");
  const [mutedConversationKeys, setMutedConversationKeys] = useState(() => {
    const stored = readStorageJson("inkling:groups-muted-conversations:v1");
    return Array.isArray(stored) ? stored.map((item) => String(item)) : [];
  });
  const [isUploadingGroupIcon, setIsUploadingGroupIcon] = useState(false);
  const [activeInfoPanelView, setActiveInfoPanelView] = useState("main");
  const [isGroupIconPickerOpen, setIsGroupIconPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const streamConversationKeyRef = useRef("");
  const typingTimeoutRef = useRef(null);
  const typingThrottleRef = useRef(0);
  const scrollPersistTimeoutRef = useRef(null);
  const scrollRestoreFrameRef = useRef(0);
  const shouldStickToBottomRef = useRef(true);
  const pendingScrollRestoreKeyRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1128px)");
    const syncCompactLayout = () => {
      if (!mediaQuery.matches) {
        return;
      }

      setIsListRailCollapsed(false);
      setIsInfoPanelOpen(false);
      setActiveInfoPanelView("main");
    };

    syncCompactLayout();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncCompactLayout);
      return () =>
        mediaQuery.removeEventListener("change", syncCompactLayout);
    }

    mediaQuery.addListener(syncCompactLayout);
    return () => mediaQuery.removeListener(syncCompactLayout);
  }, []);

  const isControlledSelection = typeof selectedGroupId === "string";
  const effectiveSelectedGroupId = isControlledSelection
    ? selectedGroupId
    : internalSelectedGroupId;
  const selectGroupId = onSelectGroupId ?? setInternalSelectedGroupId;

  const busy = Boolean(groupState?.busy);
  const message = groupState?.message ?? "";
  const myGroupsList = useMemo(() => myGroups ?? [], [myGroups]);
  const publicGroupsList = useMemo(() => publicGroups ?? [], [publicGroups]);
  const normalizedQuery = normalizeText(findInput);

  const myGroupEntries = useMemo(
    () => myGroupsList.map((group) => toGroupEntry(group, "mine")),
    [myGroupsList],
  );

  const discoverGroupEntries = useMemo(() => {
    const myGroupIds = new Set(myGroupsList.map((group) => group._id));
    return publicGroupsList
      .filter((group) => !myGroupIds.has(group._id))
      .map((group) => toGroupEntry(group, "discover"));
  }, [myGroupsList, publicGroupsList]);

  const allGroupEntries = useMemo(
    () => [...myGroupEntries, ...discoverGroupEntries],
    [myGroupEntries, discoverGroupEntries],
  );

  useEffect(() => {
    if (allGroupEntries.length === 0) {
      if (effectiveSelectedGroupId) {
        selectGroupId("");
      }
      return;
    }

    if (
      !effectiveSelectedGroupId ||
      !allGroupEntries.some((group) => group._id === effectiveSelectedGroupId)
    ) {
      selectGroupId(allGroupEntries[0]._id);
    }
  }, [allGroupEntries, effectiveSelectedGroupId, selectGroupId]);

  const filteredMyGroupEntries = useMemo(
    () =>
      myGroupEntries.filter((group) =>
        matchesGroupQuery(group, normalizedQuery),
      ),
    [myGroupEntries, normalizedQuery],
  );

  const filteredDiscoverGroupEntries = useMemo(
    () =>
      discoverGroupEntries.filter((group) =>
        matchesGroupQuery(group, normalizedQuery),
      ),
    [discoverGroupEntries, normalizedQuery],
  );

  const selectedGroup = useMemo(
    () =>
      allGroupEntries.find((group) => group._id === effectiveSelectedGroupId) ??
      null,
    [allGroupEntries, effectiveSelectedGroupId],
  );
  const selectedGroupKey = selectedGroup?._id ?? "";
  const selectedGroupName = selectedGroup?.name ?? "";

  const activeRoom = useMemo(() => {
    if (!selectedGroup || !selectedGroupRoom) {
      return null;
    }
    return `${selectedGroupRoom.groupId}` === `${selectedGroup._id}`
      ? selectedGroupRoom
      : null;
  }, [selectedGroup, selectedGroupRoom]);

  const canManageSelectedGroup = Boolean(
    activeRoom?.canManageGroup || selectedGroup?.canManageGroup,
  );

  const canPostToRoom = Boolean(activeRoom?.canPost);

  const selectedMembers = useMemo(
    () => activeRoom?.members ?? [],
    [activeRoom?.members],
  );
  const startedDirectMemberIdSet = useMemo(
    () => new Set(startedDirectMemberIds),
    [startedDirectMemberIds],
  );

  const directMessageEntries = useMemo(
    () =>
      selectedMembers
        .filter(
          (member) =>
            !member.isYou && startedDirectMemberIdSet.has(`${member.userId}`),
        )
        .map((member) => ({
          id: `${member.userId}`,
          userId: member.userId,
          name: member.name,
          role: roleLabel(member),
          initials: member.initials || initialsFromName(member.name),
          image: member.image,
          iconPreset: member.iconPreset,
          isMuted: member.isMuted,
        })),
    [selectedMembers, startedDirectMemberIdSet],
  );

  const selectedDirectMember = useMemo(
    () =>
      directMessageEntries.find(
        (member) => member.id === selectedDirectMemberId,
      ) ?? null,
    [directMessageEntries, selectedDirectMemberId],
  );
  const publicProfileOverview = useQuery("dashboard:publicOverview", {
    ...(profileMember?.userId ? { targetUserId: profileMember.userId } : {}),
  });
  const directRoom = useQuery("groups:directRoom", {
    ...(selectedDirectMember?.userId
      ? { targetUserId: selectedDirectMember.userId }
      : {}),
  });
  const sendDirectMessage = useMutation("groups:sendDirectMessage");
  const editDirectMessage = useMutation("groups:editDirectMessage");
  const deleteDirectMessage = useMutation("groups:deleteDirectMessage");
  const isDirectConversation = conversationMode === "dms";
  const isDirectRoomLoading =
    isDirectConversation && Boolean(selectedDirectMember) && directRoom === undefined;
  const canUseDirectRoom =
    Boolean(selectedDirectMember) && directRoom !== undefined && directRoom !== null;

  const openGroupsList = useCallback(() => {
    setIsMobileConversationOpen(false);
  }, []);

  const closeCompactInfoPanel = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1128px)").matches
    ) {
      setIsInfoPanelOpen(false);
    }
  }, []);

  const selectGroupConversation = useCallback(
    (groupId) => {
      setConversationMode("groups");
      selectGroupId(groupId);
      closeCompactInfoPanel();
      setIsMobileConversationOpen(true);
    },
    [closeCompactInfoPanel, selectGroupId],
  );

  const selectDirectConversation = useCallback((memberId) => {
    setSelectedDirectMemberId(memberId);
    setConversationMode("dms");
    closeCompactInfoPanel();
    setIsMobileConversationOpen(true);
  }, [closeCompactInfoPanel]);

  const filteredDirectMessageEntries = useMemo(
    () =>
      directMessageEntries.filter((member) =>
        normalizeText(`${member.name} ${member.role}`).includes(normalizedQuery),
      ),
    [directMessageEntries, normalizedQuery],
  );

  const selectedChatMessages = useMemo(
    () =>
      isDirectConversation
        ? directRoom?.messages ?? []
        : activeRoom?.messages ?? [],
    [activeRoom?.messages, directRoom?.messages, isDirectConversation],
  );

  const stackedMessages = useMemo(
    () =>
      [...selectedChatMessages].sort(
        (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0),
      ),
    [selectedChatMessages],
  );

  const visibleTypingMembers = useMemo(
    () =>
      (selectedGroupTypingMembers ?? []).filter(
        (member) => typingNow - member.updatedAt <= TYPING_STALE_MS,
      ),
    [selectedGroupTypingMembers, typingNow],
  );

  const selectedAttachments = useMemo(() => {
    if (!selectedGroup && !selectedDirectMember) {
      return [];
    }
    return [
      ...extractMessageAttachments(selectedChatMessages),
      ...extractMessageLinks(selectedChatMessages),
    ];
  }, [selectedChatMessages, selectedDirectMember, selectedGroup]);
  const selectedImageAttachments = useMemo(
    () =>
      selectedAttachments.filter(
        (attachment) =>
          attachment.kind === "image" ||
          String(attachment.mimeType || "").startsWith("image/"),
      ),
    [selectedAttachments],
  );
  const selectedFileAttachments = useMemo(
    () =>
      selectedAttachments.filter(
        (attachment) =>
          attachment.kind !== "image" &&
          !String(attachment.mimeType || "").startsWith("image/"),
      ),
    [selectedAttachments],
  );
  const activeInfoKey = isDirectConversation
    ? `dm:${selectedDirectMember?.id || ""}`
    : `group:${selectedGroupKey}`;
  const notificationsMuted = mutedConversationKeys.includes(activeInfoKey);
  const selectedGroupIconUrl = activeRoom?.iconUrl || selectedGroup?.iconUrl || "";

  const toggleNotificationsMuted = useCallback(() => {
    if (!activeInfoKey || activeInfoKey === "group:" || activeInfoKey === "dm:") {
      return;
    }
    setMutedConversationKeys((prev) => {
      const exists = prev.includes(activeInfoKey);
      const next = exists
        ? prev.filter((item) => item !== activeInfoKey)
        : [...prev, activeInfoKey];
      writeStorageJson("inkling:groups-muted-conversations:v1", next);
      return next;
    });
  }, [activeInfoKey]);

  useEffect(() => {
    setActiveInfoPanelView("main");
  }, [activeInfoKey]);

  const unreadMessageIds = useMemo(
    () => {
      if (isDirectConversation) {
        return [];
      }
      return selectedChatMessages
        .filter(
          (item) =>
            !item.author?.isYou &&
            !(item.readBy || []).some((reader) => reader.isYou),
        )
        .map((item) => item._id);
    },
    [isDirectConversation, selectedChatMessages],
  );
  const unreadMessageKey = unreadMessageIds.map((id) => `${id}`).join(",");
  const activeConversationKey = useMemo(
    () =>
      buildConversationScrollKey(
        selectedGroupKey,
        conversationMode,
        selectedDirectMember?.id,
      ),
    [conversationMode, selectedDirectMember?.id, selectedGroupKey],
  );

  const scheduleConversationScrollPersist = useCallback(
    (conversationKey, scrollTop) => {
      cacheConversationScroll(conversationKey, scrollTop);
      if (typeof window === "undefined") {
        return;
      }
      if (scrollPersistTimeoutRef.current) {
        window.clearTimeout(scrollPersistTimeoutRef.current);
      }
      scrollPersistTimeoutRef.current = window.setTimeout(() => {
        scrollPersistTimeoutRef.current = null;
        persistGroupChatScrollMemory();
      }, 140);
    },
    [],
  );

  const flushConversationScrollPersist = useCallback(
    (conversationKey, scrollTop) => {
      if (typeof window !== "undefined" && scrollPersistTimeoutRef.current) {
        window.clearTimeout(scrollPersistTimeoutRef.current);
        scrollPersistTimeoutRef.current = null;
      }
      persistConversationScroll(conversationKey, scrollTop);
    },
    [],
  );

  const cancelPendingScrollRestore = useCallback(() => {
    if (typeof window === "undefined" || !scrollRestoreFrameRef.current) {
      return;
    }

    window.cancelAnimationFrame(scrollRestoreFrameRef.current);
    scrollRestoreFrameRef.current = 0;
  }, []);

  const saveCurrentStreamPosition = useCallback(() => {
    const stream = streamRef.current;
    const conversationKey = streamConversationKeyRef.current;
    if (!stream || !conversationKey) {
      return;
    }

    flushConversationScrollPersist(conversationKey, stream.scrollTop);
    shouldStickToBottomRef.current = isStreamNearBottom(stream);
  }, [flushConversationScrollPersist]);

  const setChatStreamElement = useCallback(
    (node) => {
      if (streamRef.current && streamRef.current !== node) {
        saveCurrentStreamPosition();
      }

      streamRef.current = node;
      streamConversationKeyRef.current = node ? activeConversationKey : "";

      if (node && activeConversationKey) {
        pendingScrollRestoreKeyRef.current = activeConversationKey;
      }
    },
    [activeConversationKey, saveCurrentStreamPosition],
  );

  useEffect(() => {
    if (
      selectedDirectMemberId &&
      !directMessageEntries.some((member) => member.id === selectedDirectMemberId)
    ) {
      setSelectedDirectMemberId("");
      if (conversationMode === "dms") {
        setConversationMode("groups");
      }
    }
  }, [conversationMode, directMessageEntries, selectedDirectMemberId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTypingNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    persistGroupsUiState({
      leftMode,
      conversationMode,
      isListRailCollapsed,
      isInfoPanelOpen,
      selectedDirectMemberId,
      startedDirectMemberIds,
    });
  }, [
    conversationMode,
    isInfoPanelOpen,
    isListRailCollapsed,
    leftMode,
    selectedDirectMemberId,
    startedDirectMemberIds,
  ]);

  useEffect(() => {
    if (!selectedGroupKey || !onMarkGroupMessagesRead || !unreadMessageIds.length) {
      return;
    }
    void onMarkGroupMessagesRead(selectedGroupKey, unreadMessageIds);
  }, [
    onMarkGroupMessagesRead,
    selectedGroupKey,
    unreadMessageIds,
    unreadMessageKey,
  ]);

  useEffect(() => {
    if (!selectedGroupKey) {
      setGroupEditName("");
      return;
    }
    setGroupEditName(selectedGroupName);
    setReplyTarget(null);
    setEditingMessage(null);
    setPendingAttachments([]);
    setChatInput("");
  }, [selectedGroupKey, selectedGroupName]);

  useEffect(() => {
    if (!activeConversationKey) {
      pendingScrollRestoreKeyRef.current = "";
      return undefined;
    }

    streamConversationKeyRef.current = activeConversationKey;
    pendingScrollRestoreKeyRef.current = activeConversationKey;

    return () => {
      saveCurrentStreamPosition();
    };
  }, [activeConversationKey, saveCurrentStreamPosition]);

  useLayoutEffect(() => {
    if (!activeConversationKey || isGroupRoomLoading) {
      return undefined;
    }
    if (pendingScrollRestoreKeyRef.current !== activeConversationKey) {
      return undefined;
    }

    cancelPendingScrollRestore();

    let attempt = 0;
    const savedTop = readStoredConversationScroll(activeConversationKey);
    const shouldRestoreSavedTop = typeof savedTop === "number";

    const applyScroll = () => {
      const stream = streamRef.current;
      if (!stream) {
        return;
      }

      if (shouldRestoreSavedTop) {
        const maxScrollTop = Math.max(0, stream.scrollHeight - stream.clientHeight);
        stream.scrollTop = Math.min(savedTop, maxScrollTop);
      } else {
        stream.scrollTop = stream.scrollHeight;
      }

      attempt += 1;
      if (attempt < GROUP_CHAT_SCROLL_RESTORE_ATTEMPTS) {
        scrollRestoreFrameRef.current = window.requestAnimationFrame(applyScroll);
        return;
      }

      scrollRestoreFrameRef.current = 0;
      shouldStickToBottomRef.current = isStreamNearBottom(stream);
      pendingScrollRestoreKeyRef.current = "";
      persistConversationScroll(activeConversationKey, stream.scrollTop);
    };

    scrollRestoreFrameRef.current = window.requestAnimationFrame(applyScroll);
    return cancelPendingScrollRestore;
  }, [
    activeConversationKey,
    cancelPendingScrollRestore,
    isGroupRoomLoading,
    selectedChatMessages.length,
  ]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || !activeConversationKey) {
      return;
    }

    if (
      pendingScrollRestoreKeyRef.current === activeConversationKey ||
      !shouldStickToBottomRef.current
    ) {
      return;
    }

    stream.scrollTo({
      top: stream.scrollHeight,
      behavior: "smooth",
    });
    scheduleConversationScrollPersist(
      activeConversationKey,
      stream.scrollHeight,
    );
  }, [
    activeConversationKey,
    scheduleConversationScrollPersist,
    selectedChatMessages.length,
  ]);

  useEffect(() => {
    return () => {
      saveCurrentStreamPosition();
      cancelPendingScrollRestore();
      if (scrollPersistTimeoutRef.current) {
        window.clearTimeout(scrollPersistTimeoutRef.current);
        scrollPersistTimeoutRef.current = null;
        persistGroupChatScrollMemory();
      }
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      if (effectiveSelectedGroupId && onSetGroupTyping) {
        void onSetGroupTyping(effectiveSelectedGroupId, false);
      }
    };
  }, [
    cancelPendingScrollRestore,
    effectiveSelectedGroupId,
    onSetGroupTyping,
    saveCurrentStreamPosition,
  ]);

  const onSubmitCreate = async (event) => {
    event.preventDefault();
    const name = groupNameInput.trim();
    if (!name || !onCreateGroup) {
      return;
    }

    await onCreateGroup(name, visibilityInput);
    setGroupNameInput("");
    setIsCreateGroupModalOpen(false);
  };

  const onSubmitInvite = async (event) => {
    event.preventDefault();
    const inviteCode = inviteCodeInput.trim();
    if (!inviteCode || !onJoinPrivateGroup) {
      return;
    }

    await onJoinPrivateGroup(inviteCode);
    setInviteCodeInput("");
    setIsCreateGroupModalOpen(false);
  };

  const onJoinGroup = async (groupId) => {
    if (!onJoinPublicGroup) {
      return;
    }

    await onJoinPublicGroup(groupId);
  };

  const signalTyping = () => {
    if (!selectedGroup || !canPostToRoom || !onSetGroupTyping || editingMessage) {
      return;
    }

    const now = Date.now();
    if (now - typingThrottleRef.current > 3000) {
      typingThrottleRef.current = now;
      void onSetGroupTyping(selectedGroup._id, true);
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      void onSetGroupTyping(selectedGroup._id, false);
    }, 4200);
  };

  const onChatInputChange = (event) => {
    setChatInput(event.target.value);
    signalTyping();
  };

  const revokePendingAttachmentPreview = (attachment) => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  };

  const clearPendingAttachments = () => {
    pendingAttachments.forEach(revokePendingAttachmentPreview);
    setPendingAttachments([]);
  };

  const onSubmitMessage = async (event) => {
    event.preventDefault();
    const body = chatInput.trim();
    if (!canWriteToActiveConversation) {
      return;
    }
    if (
      isDirectConversation
        ? !body
        : !body && !pendingAttachments.length && !editingMessage?.attachments?.length
    ) {
      return;
    }

    setIsSendingMessage(true);
    try {
      let result = false;
      if (isDirectConversation) {
        if (!selectedDirectMember?.userId) {
          return;
        }
        result = editingMessage
          ? await editDirectMessage({
              messageId: editingMessage._id,
              body,
            })
          : await sendDirectMessage({
              targetUserId: selectedDirectMember.userId,
              body,
            });
      } else {
        if (!selectedGroup) {
          return;
        }
        if (editingMessage && !onEditGroupMessage) {
          return;
        }
        if (!editingMessage && !onSendGroupMessage) {
          return;
        }
        result = editingMessage
          ? await onEditGroupMessage(editingMessage._id, body)
          : await onSendGroupMessage(selectedGroup._id, body, {
              parentMessageId: replyTarget?._id,
              attachments: pendingAttachments.map((attachment) => ({
                storageId: attachment.storageId,
                assetUrl: attachment.assetUrl,
                assetKey: attachment.assetKey,
                assetProvider: attachment.assetProvider,
                name: attachment.name,
                mimeType: attachment.mimeType,
                size: attachment.size,
                kind: attachment.kind,
              })),
            });
      }
      if (result !== false) {
        setChatInput("");
        setReplyTarget(null);
        setEditingMessage(null);
        clearPendingAttachments();
        if (!isDirectConversation && selectedGroup && onSetGroupTyping) {
          void onSetGroupTyping(selectedGroup._id, false);
        }
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const addPendingAttachmentFiles = async (files) => {
    if (!selectedGroup || !onUploadGroupAttachment || !files.length) {
      return;
    }
    if (!canAttachToActiveConversation || editingMessage) {
      return;
    }

    const availableSlots = Math.max(
      0,
      MAX_PENDING_ATTACHMENTS - pendingAttachments.length,
    );
    const selectedFiles = files.slice(0, availableSlots);
    if (!selectedFiles.length) {
      return;
    }

    setIsUploadingAttachment(true);
    try {
      for (const file of selectedFiles) {
        const attachment = await onUploadGroupAttachment(selectedGroup._id, file);
        if (!attachment) {
          continue;
        }
        const previewUrl =
          attachment.kind === "image" ? URL.createObjectURL(file) : "";
        setPendingAttachments((prev) => [
          ...prev,
          {
            ...attachment,
            previewUrl,
            localId: `${Date.now()}:${file.name}:${prev.length}`,
          },
        ]);
      }
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const onAttachFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await addPendingAttachmentFiles(files);
  };

  const onPasteComposer = async (event) => {
    if (!canAttachToActiveConversation || editingMessage) {
      return;
    }

    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => String(item.type || "").startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean)
      .map((file, index) => {
        const extension = String(file.type || "").split("/")[1] || "png";
        const hasName = String(file.name || "").trim();
        return hasName
          ? file
          : new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
              type: file.type || "image/png",
            });
      });

    if (!files.length) {
      return;
    }

    event.preventDefault();
    await addPendingAttachmentFiles(files);
  };

  const onStartReply = (messageItem) => {
    if (isDirectConversation || !canPostToRoom) {
      return;
    }
    setEditingMessage(null);
    setReplyTarget(messageItem);
  };

  const onStartEdit = (messageItem) => {
    setReplyTarget(null);
    clearPendingAttachments();
    setEditingMessage(messageItem);
    setChatInput(messageItem.body || "");
  };

  const onCancelComposerMode = () => {
    setReplyTarget(null);
    setEditingMessage(null);
    clearPendingAttachments();
    setChatInput("");
  };

  const onDeleteMessage = async (messageItem) => {
    if (isDirectConversation) {
      await deleteDirectMessage({ messageId: messageItem._id });
      return;
    }
    if (!onDeleteGroupMessage) {
      return;
    }
    await onDeleteGroupMessage(messageItem._id);
  };

  const onApplyGroupMetadata = async (event) => {
    event.preventDefault();
    if (!selectedGroup || !canManageSelectedGroup || !onUpdateGroupMetadata) {
      return;
    }
    await onUpdateGroupMetadata(selectedGroup._id, {
      name: groupEditName.trim(),
    });
  };

  const onSelectGroupIconFile = async (eventOrFile) => {
    const inputTarget = eventOrFile?.target;
    const file =
      eventOrFile instanceof File ? eventOrFile : inputTarget?.files?.[0];
    if (inputTarget) {
      inputTarget.value = "";
    }
    if (
      !file ||
      !selectedGroup ||
      !canManageSelectedGroup ||
      !onUploadGroupIcon
    ) {
      return;
    }

    setIsUploadingGroupIcon(true);
    try {
      const didUpload = await onUploadGroupIcon(selectedGroup._id, file);
      if (didUpload) {
        setIsGroupIconPickerOpen(false);
      }
    } finally {
      setIsUploadingGroupIcon(false);
    }
  };

  const onToggleMemberRole = async (member) => {
    if (!selectedGroup || !onSetGroupMemberRole) {
      return;
    }
    await onSetGroupMemberRole(
      selectedGroup._id,
      member.userId,
      member.role === "admin" ? "member" : "admin",
    );
  };

  const onToggleMemberMute = async (member) => {
    if (!selectedGroup || !onMuteGroupMember) {
      return;
    }
    const mutedUntil = member.isMuted
      ? undefined
      : Date.now() + 60 * 60 * 1000;
    await onMuteGroupMember(selectedGroup._id, member.userId, mutedUntil);
  };

  const onBanMember = async (member) => {
    if (!selectedGroup || !onBanGroupMember) {
      return;
    }
    await onBanGroupMember(selectedGroup._id, member.userId);
  };

  const openPersonMenu = useCallback((member, event) => {
    if (!member || !event?.currentTarget) {
      return;
    }

    event?.preventDefault?.();
    event?.stopPropagation?.();

    const rect = event.currentTarget.getBoundingClientRect();
    const anchorRect = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };

    setPersonMenu({
      member: {
        ...member,
        id: `${member.userId ?? member.id}`,
        userId: member.userId ?? member.id,
        role: member.role || roleLabel(member),
        initials: member.initials || initialsFromName(member.name),
      },
      anchorRect,
      x: rect.right + 10,
      y: rect.top,
    });
  }, []);

  const startDirectMessage = useCallback((member) => {
    if (!member?.userId || member.isYou) {
      return;
    }
    const memberId = `${member.userId}`;
    setStartedDirectMemberIds((prev) =>
      prev.includes(memberId) ? prev : [...prev, memberId],
    );
    selectDirectConversation(memberId);
    setIsInfoPanelOpen(true);
    setPersonMenu(null);
  }, [selectDirectConversation]);

  const openPublicProfile = useCallback((member) => {
    if (!member?.userId) {
      return;
    }
    setProfileMember({
      ...member,
      id: `${member.userId}`,
      role: member.role || roleLabel(member),
      initials: member.initials || initialsFromName(member.name),
    });
    setPersonMenu(null);
  }, []);

  const canWriteToActiveConversation = isDirectConversation
    ? canUseDirectRoom
    : canPostToRoom;
  const canAttachToActiveConversation =
    !isDirectConversation && canWriteToActiveConversation;
  const groupsShellClass = [
    "groups-social-shell",
    "messenger-groups-shell",
    interactionLocked ? "section-preview-locked" : "",
    isListRailCollapsed ? "list-rail-collapsed" : "",
    isInfoPanelOpen ? "info-panel-open" : "info-panel-closed",
    isMobileConversationOpen ? "mobile-conversation-open" : "mobile-list-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="dash-grid groups-layout">
      <section className="panel groups-social-panel">
        {interactionLocked ? (
          <p className="status-text section-preview-lock-banner">
            {interactionLockReason}
          </p>
        ) : null}

        <div
          className={groupsShellClass}
          aria-disabled={interactionLocked}
        >
          <aside className="groups-mode-rail" aria-label="Conversation tools">
            <button
              type="button"
              className={`groups-icon-button${conversationMode === "groups" ? " active" : ""}`}
              onClick={() => {
                setConversationMode("groups");
                openGroupsList();
              }}
              aria-label="Groups"
              title="Groups"
            >
              <ChatIcon />
            </button>
            <button
              type="button"
              className={`groups-icon-button${conversationMode === "dms" ? " active" : ""}`}
              onClick={() => {
                setConversationMode("dms");
                openGroupsList();
              }}
              aria-label="DMs"
              title="DMs"
            >
              <DmIcon />
            </button>
            {conversationMode === "groups" && !isListRailCollapsed ? (
              <div className="groups-mode-rail-tools" aria-label="Group tools">
                <button
                  type="button"
                  className={`groups-icon-button${leftMode === "discover" ? " active" : ""}`}
                  onClick={() => setLeftMode("discover")}
                  aria-label="Find groups"
                  title="Find groups"
                >
                  <SearchIcon />
                </button>
                <button
                  type="button"
                  className="groups-icon-button"
                  onClick={() => setIsCreateGroupModalOpen(true)}
                  aria-label="Create group"
                  title="Create group"
                >
                  <PlusIcon />
                </button>
              </div>
            ) : null}
          </aside>

          <aside className="groups-left-column">
            <header className="groups-rail-header">
              <div>
                <p className="dash-kicker">
                  {conversationMode === "dms" ? "DMs" : "Groups"}
                </p>
                <h3>{conversationMode === "dms" ? "Messages" : "Chats"}</h3>
              </div>
              <button
                type="button"
                className="groups-mini-icon-button"
                onClick={() => setIsListRailCollapsed((value) => !value)}
                aria-label="Toggle"
                title="Toggle"
              >
                <PanelIcon />
              </button>
            </header>

            {isListRailCollapsed ? (
              <div className="groups-compact-list">
                {(conversationMode === "dms"
                  ? filteredDirectMessageEntries
                  : filteredMyGroupEntries
                ).map((item) => (
                  <button
                    key={item.id || item._id}
                    type="button"
                    className="groups-room-avatar"
                    onClick={() => {
                      if (conversationMode === "dms") {
                        selectDirectConversation(item.id);
                        return;
                      }
                      selectGroupConversation(item._id);
                    }}
                    aria-label={item.name}
                    title={item.name}
                  >
                    {item.initials || initialsFromName(item.name)}
                  </button>
                ))}
              </div>
            ) : conversationMode === "groups" ? (
              <>
                <label className="groups-find-field">
                  Find groups
                  <input
                    type="search"
                    value={findInput}
                    onChange={(event) => setFindInput(event.target.value)}
                  />
                </label>

                <div className="groups-room-scroll">
                  <section className="groups-room-section">
                    <p className="dash-kicker">Your Groups</p>
                    {isLoading ? (
                      <p className="status-text">Loading...</p>
                    ) : null}
                    {!isLoading && filteredMyGroupEntries.length === 0 ? (
                      <p className="status-text">No groups</p>
                    ) : null}

                    <div className="groups-room-list">
                      {filteredMyGroupEntries.map((group) => (
                        <GroupListItem
                          key={group._id}
                          group={group}
                          selected={group._id === effectiveSelectedGroupId}
                          busy={busy}
                          onSelect={() => selectGroupConversation(group._id)}
                          onJoin={onJoinGroup}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="groups-room-section">
                    <p className="dash-kicker">Discover</p>
                    {filteredDiscoverGroupEntries.length === 0 ? (
                      <p className="status-text">No results</p>
                    ) : null}

                    <div className="groups-room-list">
                      {filteredDiscoverGroupEntries.map((group) => (
                        <GroupListItem
                          key={group._id}
                          group={group}
                          selected={group._id === effectiveSelectedGroupId}
                          busy={busy}
                          onSelect={() => selectGroupConversation(group._id)}
                          onJoin={onJoinGroup}
                        />
                      ))}
                    </div>
                  </section>
                </div>

                {message ? (
                  <p className="status-text groups-status-line">{message}</p>
                ) : null}
              </>
            ) : (
              <>
                <label className="groups-find-field">
                  Find DMs
                  <input
                    type="search"
                    value={findInput}
                    onChange={(event) => setFindInput(event.target.value)}
                  />
                </label>
                <div className="groups-room-scroll">
                  <section className="groups-room-section">
                    <p className="dash-kicker">Started Chats</p>
                    {filteredDirectMessageEntries.length === 0 ? (
                      <p className="status-text">No chats</p>
                    ) : null}
                    <div className="groups-room-list">
                      {filteredDirectMessageEntries.map((member) => (
                        <article
                          key={member.id}
                          className={`groups-room-item groups-room-item-with-avatar${member.id === selectedDirectMember?.id ? " active" : ""}`}
                        >
                          <button
                            type="button"
                            className="groups-member-avatar-button groups-room-person-button"
                            onClick={(event) => openPersonMenu(member, event)}
                            aria-label={`Open ${member.name} options`}
                            title={member.name}
                          >
                            <img
                              src={
                                member.image ||
                                getPresetLogo(member.iconPreset)
                              }
                              alt=""
                              className="groups-member-avatar-image"
                            />
                          </button>
                          <button
                            type="button"
                            className="groups-room-main"
                            onClick={() => selectDirectConversation(member.id)}
                          >
                            <span className="groups-room-meta">
                              <strong>{member.name}</strong>
                              <span>{member.role}</span>
                              <span className="groups-room-material">
                                {member.isMuted ? "Muted" : "Active"}
                              </span>
                            </span>
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
          </aside>

          <section className="groups-chat-column">
            {selectedGroup ? (
              <>
                <div className="groups-chat-top">
                <header className="groups-chat-header">
                  <button
                    type="button"
                    className="groups-mobile-back-button"
                    onClick={openGroupsList}
                    aria-label="Back to chats"
                    title="Back"
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <div>
                    <p className="dash-kicker">
                      {isDirectConversation ? "DM" : "Group Chat"}
                    </p>
                    <h2>
                      {isDirectConversation
                        ? selectedDirectMember?.name || "Messages"
                        : selectedGroup.name}
                    </h2>
                    <p className="status-text">
                      {isDirectConversation
                        ? selectedDirectMember?.role || "Member"
                        : `${Math.max(1, Math.floor(selectedGroup.memberCount ?? 1))} members - ${
                            selectedGroup.visibility === "private"
                              ? "Private room"
                              : "Public room"
                          }`}
                    </p>
                  </div>

                  <div className="groups-chat-header-actions">
                    {!isDirectConversation ? (
                      <>
                        <span
                          className={`mode-pill${selectedGroup.visibility === "private" ? " active" : ""}`}
                        >
                          {selectedGroup.visibility === "private"
                            ? "Private"
                            : "Public"}
                        </span>

                        {selectedGroup.source === "discover" &&
                        !selectedGroup.isMember ? (
                          <button
                            type="button"
                            className="action"
                            disabled={busy}
                            onClick={() => onJoinGroup(selectedGroup._id)}
                          >
                            Join
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost"
                            disabled={!selectedGroup.isMember || busy}
                            onClick={() => onLeaveGroup?.(selectedGroup._id)}
                          >
                            Leave
                          </button>
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className={`groups-icon-button${isInfoPanelOpen ? " active" : ""}`}
                      onClick={() => setIsInfoPanelOpen((value) => !value)}
                      aria-label="Info"
                      title="Info"
                    >
                      <InfoIcon />
                    </button>
                  </div>
                </header>

                {!isDirectConversation ? (
                  <WeeklyGroupProgress
                    group={selectedGroup}
                    periodLabel={monthLabel}
                    language={selectedLanguage}
                  />
                ) : null}
                </div>

                <div
                  className="groups-chat-stream"
                  ref={setChatStreamElement}
                  onScroll={() => {
                    const stream = streamRef.current;
                    if (!stream || !activeConversationKey) {
                      return;
                    }

                    scheduleConversationScrollPersist(
                      activeConversationKey,
                      stream.scrollTop,
                    );
                    shouldStickToBottomRef.current = isStreamNearBottom(stream);
                  }}
                >
                  {isDirectConversation ? (
                    <>
                      {isDirectRoomLoading ? (
                        <p className="status-text">Loading...</p>
                      ) : null}

                      {!isDirectRoomLoading && !selectedDirectMember ? (
                        <p className="status-text">No chat selected</p>
                      ) : null}

                      {!isDirectRoomLoading &&
                      selectedDirectMember &&
                      directRoom === null ? (
                        <p className="status-text">Unavailable</p>
                      ) : null}

                      {!isDirectRoomLoading &&
                      selectedDirectMember &&
                      directRoom !== null &&
                      selectedChatMessages.length === 0 ? (
                        <p className="status-text">No messages</p>
                      ) : null}

                      {stackedMessages.map((messageItem) => (
                        <MessageBubble
                          key={messageItem._id}
                          message={messageItem}
                          canReply={false}
                          onReply={onStartReply}
                          onEdit={onStartEdit}
                          onDelete={onDeleteMessage}
                          onOpenPersonMenu={openPersonMenu}
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      {isGroupRoomLoading ? (
                        <p className="status-text">Loading...</p>
                      ) : null}

                      {!isGroupRoomLoading &&
                      selectedChatMessages.length === 0 ? (
                        <p className="status-text">No messages</p>
                      ) : null}

                      {stackedMessages.map((messageItem) => (
                        <MessageBubble
                          key={messageItem._id}
                          message={messageItem}
                          canReply={!isDirectConversation && canWriteToActiveConversation}
                          onReply={onStartReply}
                          onEdit={onStartEdit}
                          onDelete={onDeleteMessage}
                          onOpenPersonMenu={openPersonMenu}
                        />
                      ))}

                      {visibleTypingMembers.length ? (
                        <p className="groups-typing-line">
                          {typingText(visibleTypingMembers)}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <form
                  className="groups-chat-composer"
                  onSubmit={onSubmitMessage}
                  onPaste={onPasteComposer}
                >
                  {replyTarget || editingMessage || pendingAttachments.length ? (
                    <div className="groups-composer-context">
                      {replyTarget ? (
                        <span className="groups-context-pill">
                          <ReplyIcon />
                          <span>{messagePreviewText(replyTarget)}</span>
                        </span>
                      ) : null}
                      {editingMessage ? (
                        <span className="groups-context-pill">
                          <EditIcon />
                          <span>{messagePreviewText(editingMessage)}</span>
                        </span>
                      ) : null}
                      {pendingAttachments.map((attachment) => (
                        (() => {
                          const previewSrc =
                            attachment.kind === "image"
                              ? attachment.previewUrl || attachment.url
                              : "";

                          return (
                            <span
                              key={attachment.localId}
                              className={`groups-context-pill${previewSrc ? " groups-context-image-preview" : ""}`}
                            >
                              {previewSrc ? (
                                <img src={previewSrc} alt="" />
                              ) : (
                                <PaperclipIcon />
                              )}
                              <span>{attachment.name}</span>
                              <button
                                type="button"
                                className="groups-mini-icon-button"
                                onClick={() =>
                                  setPendingAttachments((prev) => {
                                    const removed = prev.find(
                                      (item) =>
                                        item.localId === attachment.localId,
                                    );
                                    revokePendingAttachmentPreview(removed);
                                    return prev.filter(
                                      (item) =>
                                        item.localId !== attachment.localId,
                                    );
                                  })
                                }
                                aria-label="Remove attachment"
                                title="Remove"
                              >
                                <XIcon />
                              </button>
                            </span>
                          );
                        })()
                      ))}
                      {replyTarget || editingMessage ? (
                        <button
                          type="button"
                          className="groups-mini-icon-button"
                          onClick={onCancelComposerMode}
                          aria-label="Cancel"
                          title="Cancel"
                        >
                          <XIcon />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="groups-composer-row">
                    <button
                      type="button"
                      className="groups-icon-button groups-attach-button"
                      disabled={
                        !canAttachToActiveConversation ||
                        isUploadingAttachment ||
                        Boolean(editingMessage)
                      }
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Attach file"
                      title="Attach file"
                    >
                      <PaperclipIcon />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="groups-file-input"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                      multiple
                      onChange={onAttachFiles}
                    />
                    <input
                      type="text"
                      value={chatInput}
                      disabled={!canWriteToActiveConversation || isSendingMessage}
                      maxLength={1200}
                      onChange={onChatInputChange}
                    />
                    <button
                      type="submit"
                      className="ghost"
                      disabled={
                        !canWriteToActiveConversation ||
                        isSendingMessage ||
                        isUploadingAttachment ||
                        (!chatInput.trim() &&
                          !pendingAttachments.length &&
                          !editingMessage?.attachments?.length)
                      }
                    >
                      {isSendingMessage ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="groups-empty-state">
                <h3>No groups</h3>
              </div>
            )}
          </section>

          {isInfoPanelOpen ? (
            <aside className="groups-right-column">
              <button
                type="button"
                className="groups-info-mobile-back-button"
                onClick={() => setIsInfoPanelOpen(false)}
                aria-label="Back to chat"
                title="Chat"
              >
                <span aria-hidden="true">←</span>
                <span>Chat</span>
              </button>
              {isDirectConversation ? (
                <>
                  {activeInfoPanelView === "main" ? (
                    <>
                      <section className="groups-side-card groups-profile-card">
                        <button
                          type="button"
                          className="groups-profile-avatar-button groups-person-trigger"
                          onClick={(event) =>
                            selectedDirectMember
                              ? openPersonMenu(selectedDirectMember, event)
                              : undefined
                          }
                          aria-label={`Open ${selectedDirectMember?.name || "Messages"} options`}
                          title={selectedDirectMember?.name || "Messages"}
                        >
                          <img
                            src={
                              selectedDirectMember?.image ||
                              getPresetLogo(selectedDirectMember?.iconPreset)
                            }
                            alt=""
                            className="groups-profile-avatar-image"
                          />
                        </button>
                        <h3>{selectedDirectMember?.name || "Messages"}</h3>
                        <p className="status-text">
                          {selectedDirectMember?.role || "Member"}
                        </p>
                      </section>

                      <section className="groups-side-card groups-info-menu-card">
                        <button
                          type="button"
                          className="groups-info-menu-button"
                          onClick={() => setActiveInfoPanelView("notifications")}
                        >
                          <span><BellIcon /></span>
                          <strong>Notifications</strong>
                          <em>{notificationsMuted ? "Muted" : "On"}</em>
                        </button>
                        <div className="groups-info-menu-heading">Attachments</div>
                        <button
                          type="button"
                          className="groups-info-menu-button"
                          onClick={() => setActiveInfoPanelView("images")}
                        >
                          <span><ImageIcon /></span>
                          <strong>Images</strong>
                          <em>{selectedImageAttachments.length}</em>
                        </button>
                        <button
                          type="button"
                          className="groups-info-menu-button"
                          onClick={() => setActiveInfoPanelView("files")}
                        >
                          <span><PaperclipIcon /></span>
                          <strong>Files</strong>
                          <em>{selectedFileAttachments.length}</em>
                        </button>
                      </section>
                    </>
                  ) : (
                    <section className="groups-side-card groups-info-subpanel">
                      <header className="groups-info-subpanel-head">
                        <button
                          type="button"
                          className="groups-mini-icon-button"
                          onClick={() => setActiveInfoPanelView("main")}
                          aria-label="Back"
                          title="Back"
                        >
                          <ReplyIcon />
                        </button>
                        <h3>
                          {activeInfoPanelView === "notifications"
                            ? "Notifications"
                            : activeInfoPanelView === "images"
                              ? "Images"
                              : "Files"}
                        </h3>
                      </header>

                      {activeInfoPanelView === "notifications" ? (
                        <button
                          type="button"
                          className="groups-notification-toggle"
                          onClick={toggleNotificationsMuted}
                        >
                          {notificationsMuted ? "Muted" : "On"}
                        </button>
                      ) : null}

                      {activeInfoPanelView === "images" ? (
                        selectedImageAttachments.length === 0 ? (
                          <p className="status-text">No images</p>
                        ) : (
                          <div className="groups-media-grid groups-media-grid-large">
                            {selectedImageAttachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                className="groups-media-thumb"
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                title={attachment.name}
                              >
                                <img src={attachment.url} alt="" />
                              </a>
                            ))}
                          </div>
                        )
                      ) : null}

                      {activeInfoPanelView === "files" ? (
                        selectedFileAttachments.length === 0 ? (
                          <p className="status-text">No files</p>
                        ) : (
                          <ul className="groups-attachment-list">
                            {selectedFileAttachments.map((attachment) => (
                              <li
                                key={attachment.id}
                                className="groups-attachment-item"
                              >
                                <span className="groups-attachment-icon">
                                  {attachment.ext}
                                </span>
                                {attachment.url ? (
                                  <a
                                    className="groups-attachment-copy"
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <strong>{attachment.name}</strong>
                                    <span>{attachment.meta}</span>
                                  </a>
                                ) : (
                                  <span className="groups-attachment-copy">
                                    <strong>{attachment.name}</strong>
                                    <span>{attachment.meta}</span>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )
                      ) : null}
                    </section>
                  )}
                </>
              ) : selectedGroup ? (
              <>
                {activeInfoPanelView === "main" ? (
                  <>
                    <section className="groups-side-card groups-info-profile-card">
                      {canManageSelectedGroup ? (
                        <button
                          type="button"
                          className={`groups-info-avatar-shell groups-info-avatar-button${isUploadingGroupIcon ? " is-disabled" : ""}`}
                          onClick={() => setIsGroupIconPickerOpen(true)}
                          disabled={isUploadingGroupIcon}
                          aria-label="Change group icon"
                          title="Change"
                        >
                          {selectedGroupIconUrl ? (
                            <img
                              src={selectedGroupIconUrl}
                              alt=""
                              className="groups-info-avatar-image"
                            />
                          ) : (
                            <span className="groups-info-avatar-fallback">
                              {initialsFromName(selectedGroup.name)}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="groups-info-avatar-shell">
                          {selectedGroupIconUrl ? (
                            <img
                              src={selectedGroupIconUrl}
                              alt=""
                              className="groups-info-avatar-image"
                            />
                          ) : (
                            <span className="groups-info-avatar-fallback">
                              {initialsFromName(selectedGroup.name)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="groups-info-profile-copy">
                        <h3>{selectedGroup.name}</h3>
                        <p className="status-text">
                          {selectedMembers.length || selectedGroup.memberCount} members -{" "}
                          {selectedGroup.visibility === "private" ? "Private" : "Public"} room
                        </p>
                      </div>
                    </section>

                    <section className="groups-side-card groups-info-menu-card">
                      <button
                        type="button"
                        className="groups-info-menu-button"
                        onClick={() => setActiveInfoPanelView("notifications")}
                      >
                        <span><BellIcon /></span>
                        <strong>Notifications</strong>
                        <em>{notificationsMuted ? "Muted" : "On"}</em>
                      </button>
                      <div className="groups-info-menu-heading">Attachments</div>
                      <button
                        type="button"
                        className="groups-info-menu-button"
                        onClick={() => setActiveInfoPanelView("images")}
                      >
                        <span><ImageIcon /></span>
                        <strong>Images</strong>
                        <em>{selectedImageAttachments.length}</em>
                      </button>
                      <button
                        type="button"
                        className="groups-info-menu-button"
                        onClick={() => setActiveInfoPanelView("files")}
                      >
                        <span><PaperclipIcon /></span>
                        <strong>Files</strong>
                        <em>{selectedFileAttachments.length}</em>
                      </button>
                      <button
                        type="button"
                        className="groups-info-menu-button"
                        onClick={() => setActiveInfoPanelView("members")}
                      >
                        <span><DmIcon /></span>
                        <strong>Members</strong>
                        <em>{selectedMembers.length || selectedGroup.memberCount}</em>
                      </button>
                      <button
                        type="button"
                        className="groups-info-menu-button"
                        onClick={() => setActiveInfoPanelView("group")}
                      >
                        <span><InfoIcon /></span>
                        <strong>Group</strong>
                        <em>{selectedGroup.visibility === "private" ? "Private" : "Public"}</em>
                      </button>
                    </section>
                  </>
                ) : (
                  <section className="groups-side-card groups-info-subpanel">
                    <header className="groups-info-subpanel-head">
                      <button
                        type="button"
                        className="groups-mini-icon-button"
                        onClick={() => setActiveInfoPanelView("main")}
                        aria-label="Back"
                        title="Back"
                      >
                        <ReplyIcon />
                      </button>
                      <h3>
                        {activeInfoPanelView === "notifications"
                          ? "Notifications"
                          : activeInfoPanelView === "images"
                            ? "Images"
                            : activeInfoPanelView === "files"
                              ? "Files"
                              : activeInfoPanelView === "members"
                                ? "Members"
                                : "Group"}
                      </h3>
                    </header>

                    {activeInfoPanelView === "notifications" ? (
                      <button
                        type="button"
                        className="groups-notification-toggle"
                        onClick={toggleNotificationsMuted}
                      >
                        {notificationsMuted ? "Muted" : "On"}
                      </button>
                    ) : null}

                    {activeInfoPanelView === "images" ? (
                      selectedImageAttachments.length === 0 ? (
                        <p className="status-text">No images</p>
                      ) : (
                        <div className="groups-media-grid groups-media-grid-large">
                          {selectedImageAttachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              className="groups-media-thumb"
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              title={attachment.name}
                            >
                              <img src={attachment.url} alt="" />
                            </a>
                          ))}
                        </div>
                      )
                    ) : null}

                    {activeInfoPanelView === "files" ? (
                      selectedFileAttachments.length === 0 ? (
                        <p className="status-text">No files</p>
                      ) : (
                        <ul className="groups-attachment-list">
                          {selectedFileAttachments.map((attachment) => (
                            <li
                              key={attachment.id}
                              className="groups-attachment-item"
                            >
                              <span className="groups-attachment-icon">
                                {attachment.ext}
                              </span>
                              {attachment.url ? (
                                <a
                                  className="groups-attachment-copy"
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <strong>{attachment.name}</strong>
                                  <span>{attachment.meta}</span>
                                </a>
                              ) : (
                                <span className="groups-attachment-copy">
                                  <strong>{attachment.name}</strong>
                                  <span>{attachment.meta}</span>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}

                    {activeInfoPanelView === "members" ? (
                      isGroupRoomLoading ? (
                        <p className="status-text">Loading...</p>
                      ) : selectedMembers.length === 0 ? (
                        <p className="status-text">
                          No members found for this group.
                        </p>
                      ) : (
                        <ul className="groups-member-list">
                          {selectedMembers.map((member) => (
                            <li
                              key={`${member.userId}`}
                              className="groups-member-item"
                            >
                              <button
                                type="button"
                                className="groups-member-avatar-button"
                                onClick={(event) => openPersonMenu(member, event)}
                                aria-label={`Open ${member.name} options`}
                                title={member.name}
                              >
                                {member.image || getPresetLogo(member.iconPreset) ? (
                                  <img
                                    src={
                                      member.image ||
                                      getPresetLogo(member.iconPreset)
                                    }
                                    alt=""
                                    className="groups-member-avatar-image"
                                  />
                                ) : (
                                  <span className="groups-member-avatar">
                                    {member.initials || initialsFromName(member.name)}
                                  </span>
                                )}
                              </button>
                              <span className="groups-member-copy">
                                <strong>{member.name}</strong>
                                <span>
                                  {roleLabel(member)}
                                  {member.isMuted ? " - Muted" : ""}
                                </span>
                              </span>

                              {canManageSelectedGroup &&
                              (member.canMute ||
                                member.canBan ||
                                member.canChangeRole) ? (
                                <span className="groups-member-actions">
                                  {member.canChangeRole ? (
                                    <button
                                      type="button"
                                      className="groups-mini-icon-button"
                                      onClick={() => onToggleMemberRole(member)}
                                      aria-label="Change role"
                                      title="Role"
                                    >
                                      <ShieldIcon />
                                    </button>
                                  ) : null}
                                  {member.canMute ? (
                                    <button
                                      type="button"
                                      className="groups-mini-icon-button"
                                      onClick={() => onToggleMemberMute(member)}
                                      aria-label="Mute"
                                      title="Mute"
                                    >
                                      <XIcon />
                                    </button>
                                  ) : null}
                                  {member.canBan ? (
                                    <button
                                      type="button"
                                      className="groups-mini-icon-button danger"
                                      onClick={() => onBanMember(member)}
                                      aria-label="Ban"
                                      title="Ban"
                                    >
                                      <TrashIcon />
                                    </button>
                                  ) : null}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}

                    {activeInfoPanelView === "group" ? (
                      canManageSelectedGroup ? (
                        <form
                          className="groups-admin-grid groups-admin-grid-full"
                          onSubmit={onApplyGroupMetadata}
                        >
                          <label>
                            Name
                            <input
                              type="text"
                              value={groupEditName}
                              maxLength={60}
                              onChange={(event) =>
                                setGroupEditName(event.target.value)
                              }
                            />
                          </label>
                          <span className="groups-readonly-field">
                            <span>Privacy</span>
                            <strong>
                              {selectedGroup.visibility === "private"
                                ? "Private"
                                : "Public"}
                            </strong>
                          </span>
                          <button
                            type="submit"
                            className="groups-icon-button groups-admin-save"
                            disabled={busy || groupEditName.trim().length < 3}
                            aria-label="Save"
                            title="Save"
                          >
                            <CheckIcon />
                          </button>
                        </form>
                      ) : (
                        <div className="groups-admin-grid groups-admin-grid-full">
                          <span className="groups-readonly-field">
                            <span>Name</span>
                            <strong>{selectedGroup.name}</strong>
                          </span>
                          <span className="groups-readonly-field">
                            <span>Privacy</span>
                            <strong>
                              {selectedGroup.visibility === "private"
                                ? "Private"
                                : "Public"}
                            </strong>
                          </span>
                        </div>
                      )
                    ) : null}
                  </section>
                )}

              </>
            ) : (
              <section className="groups-side-card">
                <h3>Group Details</h3>
                <p className="status-text">No group selected</p>
              </section>
              )}
            </aside>
          ) : null}

          <MemberActionMenu
            menu={personMenu}
            onClose={() => setPersonMenu(null)}
            onMessage={startDirectMessage}
            onViewProfile={openPublicProfile}
          />
        </div>

        {isCreateGroupModalOpen ? (
          <div
            className="settings-overlay groups-create-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsCreateGroupModalOpen(false);
              }
            }}
          >
            <section
              className="panel groups-create-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="groups-create-title"
            >
              <header className="groups-create-modal-header">
                <div>
                  <p className="dash-kicker">Groups</p>
                  <h2 id="groups-create-title">Create Group</h2>
                </div>
                <button
                  type="button"
                  className="groups-mini-icon-button"
                  onClick={() => setIsCreateGroupModalOpen(false)}
                  aria-label="Close"
                  title="Close"
                >
                  <XIcon />
                </button>
              </header>

              <form className="groups-create-modal-form" onSubmit={onSubmitCreate}>
                <label>
                  Group name
                  <input
                    type="text"
                    value={groupNameInput}
                    maxLength={60}
                    autoFocus
                    onChange={(event) => setGroupNameInput(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Privacy
                  <select
                    value={visibilityInput}
                    onChange={(event) => setVisibilityInput(event.target.value)}
                    disabled={busy}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="action"
                  disabled={busy || groupNameInput.trim().length < 3}
                >
                  Create
                </button>
              </form>

              <div className="groups-create-divider" />

              <form
                className="groups-create-modal-form groups-create-join-form"
                onSubmit={onSubmitInvite}
              >
                <label>
                  Invite code
                  <input
                    type="text"
                    value={inviteCodeInput}
                    maxLength={24}
                    onChange={(event) => setInviteCodeInput(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <button
                  type="submit"
                  className="ghost"
                  disabled={busy || inviteCodeInput.trim().length < 4}
                >
                  Join
                </button>
              </form>
            </section>
          </div>
        ) : null}

        <PublicProfileModal
          member={profileMember}
          overview={publicProfileOverview}
          onClose={() => setProfileMember(null)}
          themeId={themeId}
          themeMode={themeMode}
          accentColor={accentColor}
        />

        {isGroupIconPickerOpen &&
        selectedGroup &&
        typeof document !== "undefined" &&
        document.body
          ? createPortal(
              <div
                className={`groups-avatar-picker-theme mode-${themeMode} theme-${themeId}`}
                style={
                  accentColor
                    ? {
                        "--dashboard-accent": accentColor,
                        "--theme-asset-accent": accentColor,
                        "--theme-saturated-primary": accentColor,
                        "--theme-saturated-secondary": accentColor,
                        "--theme-saturated-gradient": `linear-gradient(135deg, ${accentColor} 0%, ${accentColor} 100%)`,
                      }
                    : undefined
                }
              >
                <AvatarPickerOverlay
                  title="Select Group Avatar"
                  editTitle="Edit Group Avatar"
                  userIconUrl={selectedGroupIconUrl}
                  userIconStorageId={
                    activeRoom?.iconAssetKey ||
                    selectedGroup?.iconAssetKey ||
                    ""
                  }
                  recentUserIcons={[]}
                  userIconPreset="default-light"
                  userIconState={{
                    busy: isUploadingGroupIcon,
                    message: message || "",
                  }}
                  onUploadUserIcon={(eventOrFile) =>
                    void onSelectGroupIconFile(eventOrFile)
                  }
                  onSelectUserIconStorageId={() => {}}
                  onSelectUserIconPreset={() => {}}
                  onClose={() => setIsGroupIconPickerOpen(false)}
                />
              </div>,
            document.body,
          )
          : null}
      </section>
    </div>
  );
}
