import { useEffect, useMemo, useRef, useState } from "react";
import { useLayoutEffect } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./styles/adaptive-values.css";
import "./App.css";
import AppHeader from "./components/AppHeader";
import LandingPage from "./components/LandingPage";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardTopbar, {
  DASHBOARD_READING_TAB_ID,
  DashboardMetaStrip,
} from "./components/DashboardTopbar";
import InkFlyLayer from "./components/InkFlyLayer";
import TimersSection from "./components/sections/TimersSection";
import DashboardSection from "./components/sections/DashboardSection";
import LibrarySection from "./components/sections/LibrarySection";
import CalendarSection from "./components/sections/CalendarSection";
import MarketSection from "./components/sections/MarketSection";
import GroupsSection from "./components/sections/GroupsSection";
import SettingsSection from "./components/sections/SettingsSection";
import ProfileSection from "./components/sections/ProfileSection";
import SupportOverlay from "./components/SupportOverlay";
import TutorialOverlay from "./components/TutorialOverlay";
import AdPlaceholderPopup from "./components/AdPlaceholderPopup";
import BillingOverlay from "./components/BillingOverlay";
import AvatarPickerOverlay from "./components/AvatarPickerOverlay";
import FaqOverlay from "./components/FaqOverlay";
import { getThemeSaturatedColors } from "./themes";
import {
  OFFICIAL_BOOKS,
  OFFICIAL_BOOK_BY_ID,
  getOfficialBookAsset,
} from "./reader/officialBooks";
import { useVietnameseDomTranslation } from "./i18n/useVietnameseDomTranslation";

GlobalWorkerOptions.workerSrc = workerSrc;

const GOOGLE_AUTH_PARAMS = { prompt: "select_account" };
const APP_TITLE = "Inkling";
const DEFAULT_THEME_ID = "default";
const DEFAULT_THEME_MODE = "dark";
const THEME_STORAGE_KEY = "inkling:active-theme:v1";
const DEFAULT_WORKSPACE_NAME = "Inkling";
const WORKSPACE_NAME_STORAGE_KEY = "inkling:workspace-name:v1";
const TIMER_NOTIFICATION_TAG = "timer-reader-live-countdown";
const TIMER_NOTIFICATION_MILESTONES_SECONDS = [
  3600, 1800, 900, 300, 120, 60, 30, 10, 5, 4, 3, 2, 1,
];
const DEFAULT_INTERACTION_FEATURE_ID = "default-interaction-pack";
const MECHANICAL_INTERACTION_FEATURE_ID = "sink-button-interactions";
const DEFAULT_INTERACTION_MODE = "classic";
const DEFAULT_BANNER_POSITION_X = 50;
const DEFAULT_BANNER_POSITION_Y = 50;
const DEFAULT_BANNER_OPACITY = 0.24;
const DEFAULT_BANNER_SCALE = 100;
const DEFAULT_ACCENT_COLOR = "";
const LEGACY_THEME_ID_MAP = {
  comic: "default",
};
const DASHBOARD_SIDEBAR_WIDTH_STORAGE_KEY = "inkling:dashboard-sidebar-width:v1";
const DEFAULT_DASHBOARD_SIDEBAR_WIDTH = 300;
const MIN_DASHBOARD_SIDEBAR_WIDTH = 220;
const MAX_DASHBOARD_SIDEBAR_WIDTH = 430;
const MIN_BANNER_POSITION = -150;
const MAX_BANNER_POSITION = 250;
const MIN_BANNER_SCALE = 50;
const MAX_BANNER_SCALE = 320;
const PDF_PAGE_PRELOAD_RADIUS = 3;
const SUPPORTED_BOOK_FILE_TYPES = new Set([
  "pdf",
  "epub",
  "mobi",
  "azw3",
  "cbz",
  "cbr",
]);
const SUPPORTED_UPLOAD_ACCEPT = [
  ".pdf",
  ".epub",
  ".mobi",
  ".azw3",
  ".cbz",
  ".cbr",
  "application/pdf",
  "application/epub+zip",
  "application/x-mobipocket-ebook",
  "application/vnd.comicbook+zip",
  "application/x-cbz",
  "application/x-cbr",
  "application/vnd.comicbook-rar",
].join(",");
const LOCAL_BOOK_UPLOAD_LIMIT = 3;

function normalizeThemePreference(value) {
  const themeIdRaw =
    String(value?.themeId || DEFAULT_THEME_ID).trim() || DEFAULT_THEME_ID;
  const themeId = LEGACY_THEME_ID_MAP[themeIdRaw] ?? themeIdRaw;
  return {
    themeId,
    mode: value?.mode === "light" ? "light" : DEFAULT_THEME_MODE,
  };
}

function readSavedThemePreference() {
  if (typeof window === "undefined") {
    return normalizeThemePreference();
  }

  try {
    return normalizeThemePreference(
      JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY) || "null"),
    );
  } catch {
    return normalizeThemePreference();
  }
}

function writeSavedThemePreference(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify(normalizeThemePreference(value)),
    );
  } catch {
    // Local storage can be unavailable in stricter browser modes.
  }
}

function resolveBookFileUrl(book) {
  if (!book) {
    return null;
  }
  const officialAsset = getOfficialBookAsset(book);
  return officialAsset?.pdfUrl ?? book.pdfUrl ?? book.sourceUrl ?? null;
}

function resolveBookCoverUrl(book) {
  if (!book) {
    return "";
  }
  const officialAsset = getOfficialBookAsset(book);
  return book.coverUrl ?? officialAsset?.coverUrl ?? "";
}

const DASHBOARD_SECTION_KEYS = new Set([
  "dashboard",
  "timers",
  "library",
  "calendar",
  "market",
  "groups",
]);

const TUTORIAL_STORAGE_PREFIX = "inkling-dashboard-tutorial-complete:v1:";
const AD_POPUP_DURATION_SECONDS = 30;
const MAX_SESSION_MINUTES = 120;
const LONG_SESSION_WARNING =
  "Any more than 2hours of work per session is not recommended by scientfic research";
const FAQ_STORAGE_PREFIX = "inkling-dashboard-faq-complete:v1:";
const DEFAULT_LANGUAGE = "vi";

const DASHBOARD_TUTORIAL_STEP_TARGETS = [
  {
    id: "library-upload",
    section: "library",
    targetSelector: '[data-tutorial-anchor="library-upload"]',
  },
  {
    id: "timers-create",
    section: "timers",
    targetSelector: '[data-tutorial-anchor="timers-create"]',
  },
  {
    id: "timers-ratio",
    section: "timers",
    targetSelector: '[data-tutorial-anchor="timers-ratio"]',
  },
  {
    id: "timers-claim",
    section: "timers",
    targetSelector: '[data-tutorial-anchor="timers-claim"]',
  },
  {
    id: "marketplace-hub",
    section: "market",
    targetSelector: '[data-tutorial-anchor="marketplace-hub"]',
  },
];

const DASHBOARD_TUTORIAL_COPY = {
  en: [
    {
      title: "Upload a book",
      description:
        "Upload a book from your device or select a free book in the Marketplace.",
    },
    {
      title: "Create your timer",
      description: "Create a timer and set it for how long you want to work.",
    },
    {
      title: "Adjust unlock ratio",
      description: "Set how much time it takes to unlock a page.",
    },
    {
      title: "Claim unlock rewards",
      description:
        "When your session is complete, press Claim to unlock pages for your book.",
    },
    {
      title: "Explore the Marketplace",
      description:
        "Check out the Marketplace to customize your dashboard and buy books.",
    },
  ],
  vi: [
    {
      title: "Tải sách lên",
      description:
        "Tải sách từ thiết bị của bạn hoặc chọn một cuốn sách miễn phí tại Cửa hàng (Marketplace).",
    },
    {
      title: "Thiết lập thời gian làm việc của bạn",
      description:
        "Hãy tạo một bộ đếm giờ và cài đặt thời lượng mà bạn muốn làm việc.",
    },
    {
      title: "Điều chỉnh tỷ lệ mở khóa",
      description:
        "Thiết lập khoảng thời gian cần thiết (làm việc) để mở khóa được một trang sách.",
    },
    {
      title: "Nhận thưởng",
      description:
        'Sau khi hoàn thành phiên làm việc, hãy nhấn "Nhận" để mở khóa các trang sách của bạn.',
    },
    {
      title: "Khám phá Cửa hàng",
      description:
        "Ghé thăm Cửa hàng để tùy chỉnh bảng điều khiển của bạn và chọn mua những cuốn sách mới.",
    },
  ],
};

const TUTORIAL_UI_COPY = {
  en: {
    ariaLabel: "Dashboard tutorial",
    progressLabel: "Step",
    skip: "Skip Tutorial",
    back: "Back",
    next: "Next Step",
    finish: "Finish Tutorial",
  },
  vi: {
    ariaLabel: "Hướng dẫn bảng điều khiển",
    progressLabel: "Bước",
    skip: "Bỏ qua hướng dẫn",
    back: "Quay lại",
    next: "Bước tiếp theo",
    finish: "Hoàn thành hướng dẫn",
  },
};

function normalizeLanguagePreference(language) {
  return language === "en" ? "en" : DEFAULT_LANGUAGE;
}

function getDashboardTutorialSteps(language) {
  const normalizedLanguage = normalizeLanguagePreference(language);
  const copy =
    DASHBOARD_TUTORIAL_COPY[normalizedLanguage] ?? DASHBOARD_TUTORIAL_COPY.vi;
  return DASHBOARD_TUTORIAL_STEP_TARGETS.map((step, index) => ({
    ...step,
    ...copy[index],
  }));
}

function getFaqStorageKey(scopeId) {
  const safeScope = String(scopeId || "")
    .trim()
    .toLowerCase();
  if (!safeScope) {
    return "";
  }
  return `${FAQ_STORAGE_PREFIX}${safeScope}`;
}

function isFaqCompleted(scopeId) {
  const key = getFaqStorageKey(scopeId);
  if (!key || typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markFaqCompleted(scopeId) {
  const key = getFaqStorageKey(scopeId);
  if (!key || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // FAQ is informational, so storage failures should not block the app.
  }
}

function getTutorialStorageKey(scopeId) {
  const safeScope = String(scopeId || "")
    .trim()
    .toLowerCase();
  if (!safeScope) {
    return "";
  }
  return `${TUTORIAL_STORAGE_PREFIX}${safeScope}`;
}

function isTutorialCompleted(scopeId) {
  const key = getTutorialStorageKey(scopeId);
  if (!key || typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markTutorialCompleted(scopeId) {
  const key = getTutorialStorageKey(scopeId);
  if (!key || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Ignore storage failures; tutorial can still run in-memory for this session.
  }
}

function getFileExtension(value) {
  const match = String(value || "")
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)(?:$|[?#])/i);
  return match ? match[1] : "";
}

function normalizeBookFileType(value) {
  const lowered = String(value || "")
    .trim()
    .toLowerCase();
  if (lowered === "azw") {
    return "azw3";
  }
  return SUPPORTED_BOOK_FILE_TYPES.has(lowered) ? lowered : "pdf";
}

function detectBookFileType({ fileName = "", mimeType = "", hintedType = "" }) {
  const normalizedHint = String(hintedType || "").toLowerCase();
  if (SUPPORTED_BOOK_FILE_TYPES.has(normalizedHint)) {
    return normalizeBookFileType(normalizedHint);
  }

  const lowerMimeType = String(mimeType || "").toLowerCase();
  if (lowerMimeType.includes("epub")) {
    return "epub";
  }
  if (lowerMimeType.includes("mobi")) {
    return "mobi";
  }
  if (lowerMimeType.includes("azw3")) {
    return "azw3";
  }
  if (
    lowerMimeType.includes("cbz") ||
    lowerMimeType.includes("comicbook+zip")
  ) {
    return "cbz";
  }
  if (
    lowerMimeType.includes("cbr") ||
    lowerMimeType.includes("comicbook-rar")
  ) {
    return "cbr";
  }
  if (lowerMimeType.includes("pdf")) {
    return "pdf";
  }

  const extension = getFileExtension(fileName);
  if (extension === "epub") {
    return "epub";
  }
  if (extension === "mobi") {
    return "mobi";
  }
  if (extension === "azw3" || extension === "azw") {
    return "azw3";
  }
  if (extension === "cbz") {
    return "cbz";
  }
  if (extension === "cbr") {
    return "cbr";
  }
  return "pdf";
}

function normalizeBannerPosition(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(MIN_BANNER_POSITION, Math.min(MAX_BANNER_POSITION, value));
}

function normalizeBannerOpacity(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_BANNER_OPACITY;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeBannerScale(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_BANNER_SCALE;
  }
  return Math.max(MIN_BANNER_SCALE, Math.min(MAX_BANNER_SCALE, value));
}

function normalizeInteractionMode(value) {
  if (value === "popup") {
    return "popup";
  }
  if (value === "sinkdown") {
    return "sinkdown";
  }
  return DEFAULT_INTERACTION_MODE;
}

function normalizeAccentColor(value) {
  const safeValue = String(value || "").trim();
  if (/^#[0-9a-fA-F]{3}$/.test(safeValue)) {
    return `#${safeValue
      .slice(1)
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(safeValue)) {
    return safeValue.toLowerCase();
  }
  return DEFAULT_ACCENT_COLOR;
}

function hexToRgb(hexColor) {
  const safeColor = normalizeAccentColor(hexColor);
  if (!safeColor) {
    return null;
  }
  return {
    red: Number.parseInt(safeColor.slice(1, 3), 16),
    green: Number.parseInt(safeColor.slice(3, 5), 16),
    blue: Number.parseInt(safeColor.slice(5, 7), 16),
  };
}

function rgbToHex({ red, green, blue }) {
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function mixHexColor(baseColor, blendColor, blendAmount) {
  const base = hexToRgb(baseColor);
  const blend = hexToRgb(blendColor);
  if (!base || !blend) {
    return normalizeAccentColor(baseColor);
  }
  const ratio = Math.max(0, Math.min(1, Number(blendAmount) || 0));
  return rgbToHex({
    red: base.red * (1 - ratio) + blend.red * ratio,
    green: base.green * (1 - ratio) + blend.green * ratio,
    blue: base.blue * (1 - ratio) + blend.blue * ratio,
  });
}

function readableTextForHex(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return "";
  }
  const channelToLinear = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channelToLinear(rgb.red) +
    0.7152 * channelToLinear(rgb.green) +
    0.0722 * channelToLinear(rgb.blue);
  return luminance > 0.48 ? "#161616" : "#fff7eb";
}

function getAccentStyle(accentColor, accentColorSecondary, themeId, mode) {
  const safeAccentColor = normalizeAccentColor(accentColor);
  const safeAccentColorSecondary = normalizeAccentColor(accentColorSecondary);
  if (!safeAccentColor && !safeAccentColorSecondary) {
    return undefined;
  }
  const themeAccentDefaults = getThemeSaturatedColors(themeId, mode);
  const primaryAccent = safeAccentColor || themeAccentDefaults.primary;
  const secondaryAccent =
    safeAccentColorSecondary || themeAccentDefaults.secondary;

  if (themeId === "command") {
    return {
      "--theme-asset-accent": primaryAccent,
      "--theme-saturated-primary": primaryAccent,
      "--theme-saturated-secondary": secondaryAccent,
      "--on-theme-saturated-primary": readableTextForHex(primaryAccent),
      "--on-theme-saturated-secondary": readableTextForHex(secondaryAccent),
    };
  }

  const isDark = mode === "dark";
  const primaryContainer = mixHexColor(
    secondaryAccent,
    isDark ? "#ffffff" : "#000000",
    isDark ? 0.24 : 0.18,
  );
  const gradientTail = mixHexColor(primaryAccent, "#000000", 0.36);

  return {
    "--dashboard-accent": primaryAccent,
    "--theme-saturated-primary": primaryAccent,
    "--theme-saturated-secondary": secondaryAccent,
    "--on-theme-saturated-primary": readableTextForHex(primaryAccent),
    "--on-theme-saturated-secondary": readableTextForHex(secondaryAccent),
    "--theme-saturated-gradient": `linear-gradient(135deg, ${secondaryAccent} 0%, ${primaryContainer} 58%, ${gradientTail} 100%)`,
    "--theme-asset-accent": primaryAccent,
  };
}

function clampNumber(value, min, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return min;
  }
  return Math.min(Math.max(numberValue, min), Math.max(min, max));
}

function readDashboardSidebarWidth() {
  if (typeof window === "undefined") {
    return DEFAULT_DASHBOARD_SIDEBAR_WIDTH;
  }

  try {
    return clampNumber(
      Number(window.localStorage.getItem(DASHBOARD_SIDEBAR_WIDTH_STORAGE_KEY)),
      MIN_DASHBOARD_SIDEBAR_WIDTH,
      MAX_DASHBOARD_SIDEBAR_WIDTH,
    );
  } catch {
    return DEFAULT_DASHBOARD_SIDEBAR_WIDTH;
  }
}

function writeDashboardSidebarWidth(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DASHBOARD_SIDEBAR_WIDTH_STORAGE_KEY,
      String(
        clampNumber(
          value,
          MIN_DASHBOARD_SIDEBAR_WIDTH,
          MAX_DASHBOARD_SIDEBAR_WIDTH,
        ),
      ),
    );
  } catch {
    // Ignore storage failures; resizing still works for the current session.
  }
}

function getThumbnailCacheKey(book) {
  const page = Math.max(
    1,
    Math.floor(book?.thumbnailPage ?? book?.landingPage ?? 1),
  );
  const fileType = normalizeBookFileType(book?.fileType ?? "pdf");
  const source = book?.coverUrl ?? book?.pdfUrl ?? book?.sourceUrl ?? "";
  return `${book?._id ?? "unknown"}:${fileType}:${page}:${source}`;
}

function convertImageFileToPng(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.type === "image/png") {
      resolve(file);
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("Unsupported image type"));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.naturalWidth || image.width || 1);
      canvas.height = Math.max(1, image.naturalHeight || image.height || 1);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error("Image conversion failed"));
          return;
        }
        resolve(
          new File([blob], `${file.name || "avatar"}.png`, {
            type: "image/png",
          }),
        );
      }, "image/png");
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image decode failed"));
    };

    image.src = objectUrl;
  });
}

function getBookThumbnailRequest(book) {
  if (!book) {
    return null;
  }

  const fileUrl = resolveBookFileUrl(book) ?? "";
  const coverUrl = resolveBookCoverUrl(book);
  const fileType = detectBookFileType({
    fileName: fileUrl || book.title || "",
    hintedType: book.fileType || "",
  });
  const thumbnailPage = Math.max(
    1,
    Math.min(
      book.pageCount || 1,
      Math.floor(book.thumbnailPage ?? book.landingPage ?? 1),
    ),
  );

  return {
    book,
    fileUrl,
    fileType,
    page: thumbnailPage,
    coverUrl,
    cacheKey: getThumbnailCacheKey({
      ...book,
      fileType,
      pdfUrl: fileUrl,
      coverUrl,
      thumbnailPage,
    }),
  };
}

function normalizeDashboardSection(value) {
  const lowered = String(value || "").toLowerCase();
  if (lowered === "marketplace") {
    return "market";
  }
  if (lowered === "data") {
    return "calendar";
  }
  return DASHBOARD_SECTION_KEYS.has(lowered) ? lowered : "dashboard";
}

function getDashboardSectionFromLocation() {
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashValue = hash.startsWith("section=") ? hash.slice(8) : hash;
  const queryValue = url.searchParams.get("section");
  return normalizeDashboardSection(hashValue || queryValue || "dashboard");
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTimerRemainingMs(timer, now) {
  if (!timer) {
    return 0;
  }
  if (timer.isPaused) {
    const pausedCheckpoint = timer.pausedAt ?? now;
    return Math.max(0, timer.remainingMs ?? timer.endsAt - pausedCheckpoint);
  }
  return Math.max(0, timer.endsAt - now);
}

function getAuthRedirectUrl() {
  const url = new URL(window.location.href);
  if (url.hostname === "www.inklingreader.xyz") {
    return "https://inklingreader.xyz/";
  }
  return `${url.origin}${url.pathname}`;
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getWorkspaceNameStorageKey(scopeId) {
  const safeScope = String(scopeId || "")
    .trim()
    .toLowerCase();
  if (!safeScope) {
    return "";
  }
  return `${WORKSPACE_NAME_STORAGE_KEY}:${safeScope}`;
}

function readWorkspaceName(scopeId) {
  const key = getWorkspaceNameStorageKey(scopeId);
  if (!key || typeof window === "undefined") {
    return DEFAULT_WORKSPACE_NAME;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value?.trim() || DEFAULT_WORKSPACE_NAME;
  } catch {
    return DEFAULT_WORKSPACE_NAME;
  }
}

function writeWorkspaceName(scopeId, value) {
  const key = getWorkspaceNameStorageKey(scopeId);
  if (!key || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, String(value || DEFAULT_WORKSPACE_NAME));
  } catch {
    // Ignore storage failures and keep in-memory label.
  }
}

function useTimerCompletionAdPopup(activeTimers) {
  const completedTimerIdsRef = useRef(new Set());
  const [popupState, setPopupState] = useState({
    isOpen: false,
    secondsLeft: 0,
    timerId: "",
    timerLabel: "",
  });

  useEffect(() => {
    if (popupState.isOpen) {
      return;
    }

    const completedTimer = activeTimers.find(
      (timer) =>
        timer?.completedAt &&
        !timer?.claimedAt &&
        !completedTimerIdsRef.current.has(timer._id),
    );

    if (!completedTimer) {
      return;
    }

    completedTimerIdsRef.current.add(completedTimer._id);
    setPopupState({
      isOpen: true,
      secondsLeft: AD_POPUP_DURATION_SECONDS,
      timerId: completedTimer._id,
      timerLabel: String(completedTimer.label || "Reading session"),
    });
  }, [activeTimers, popupState.isOpen]);

  useEffect(() => {
    if (!popupState.isOpen) {
      return;
    }

    const countdownId = window.setInterval(() => {
      setPopupState((previous) => {
        if (!previous.isOpen) {
          return previous;
        }

        const nextSeconds = previous.secondsLeft - 1;
        if (nextSeconds <= 0) {
          return {
            ...previous,
            isOpen: false,
            secondsLeft: 0,
          };
        }

        return {
          ...previous,
          secondsLeft: nextSeconds,
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(countdownId);
    };
  }, [popupState.isOpen]);

  return popupState;
}

function App() {
  const { isAuthenticated } = useConvexAuth();
  const [activeTheme, setActiveTheme] = useState(() =>
    readSavedThemePreference(),
  );

  useEffect(() => {
    writeSavedThemePreference(activeTheme);
  }, [activeTheme]);

  return (
    <div
      className={`app-shell ${isAuthenticated ? "dashboard-view" : "landing-view"} theme-${activeTheme.themeId} mode-${activeTheme.mode}`}
    >
      <Authenticated>
        <AppHeader />
      </Authenticated>

      <AuthLoading>
        <section className="center-card">
          <p>Checking your session...</p>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <SignedOutView />
      </Unauthenticated>

      <Authenticated>
        <ReaderWorkspace onThemeChange={setActiveTheme} />
      </Authenticated>
    </div>
  );
}

function SignedOutView() {
  const { signIn } = useAuthActions();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const onGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage("");
    try {
      await signIn("google", {
        redirectTo: getAuthRedirectUrl(),
        ...GOOGLE_AUTH_PARAMS,
      });
    } catch {
      setErrorMessage(
        "Sign-in failed. Check your Google Auth consent screen, authorized origins, and Convex callback setup.",
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <LandingPage
      isSigningIn={isSigningIn}
      errorMessage={errorMessage}
      onGoogleSignIn={onGoogleSignIn}
    />
  );
}

function ReaderWorkspace({ onThemeChange }) {
  const { signOut } = useAuthActions();
  const me = useQuery("users:me");
  const books = useQuery("books:listBooks");
  const timers = useQuery("timers:listTimers");
  const overview = useQuery("dashboard:overview");
  const groupsOverview = useQuery("groups:overview");
  const createUploadUrl = useMutation("books:generateUploadUrl");
  const createExternalBookUploadTarget = useAction(
    "bookAssets:generateUploadTarget",
  );
  const createBook = useMutation("books:createBook");
  const removeBook = useMutation("books:removeBook");
  const setBookLandingPage = useMutation("books:setLandingPage");
  const setLastReadPage = useMutation("books:setLastReadPage");
  const setThumbnailPage = useMutation("books:setThumbnailPage");
  const unlockPageWithCredit = useMutation("books:unlockPageWithCredit");
  const createTimer = useMutation("timers:createTimer");
  const togglePauseTimer = useMutation("timers:togglePauseTimer");
  const cancelTimer = useMutation("timers:cancelTimer");
  const completeTimer = useMutation("timers:completeTimer");
  const claimTimerReward = useMutation("timers:claimTimerReward");
  const updatePreferences = useMutation("dashboard:updatePreferences");
  const applyEconomyReset = useMutation("dashboard:applyEconomyReset");
  const buyTheme = useMutation("dashboard:buyTheme");
  const buyOfficialBook = useMutation("dashboard:buyOfficialBook");
  const selectTheme = useMutation("dashboard:selectTheme");
  const updateInteractionMode = useMutation("dashboard:updateInteractionMode");
  const updateAccentColor = useMutation("dashboard:updateAccentColor");
  const generateUserIconUploadUrl = useMutation(
    "dashboard:generateUserIconUploadUrl",
  );
  const setUserIcon = useMutation("dashboard:setUserIcon");
  const selectUserIconPreset = useMutation("dashboard:selectUserIconPreset");
  const generateBannerUploadUrl = useMutation(
    "dashboard:generateBannerUploadUrl",
  );
  const setCustomBanner = useMutation("dashboard:setCustomBanner");
  const updateBannerSettings = useMutation("dashboard:updateBannerSettings");
  const createGroup = useMutation("groups:createGroup");
  const joinPublicGroup = useMutation("groups:joinPublicGroup");
  const joinPrivateGroup = useMutation("groups:joinPrivateGroup");
  const leaveGroup = useMutation("groups:leaveGroup");
  const sendGroupMessage = useMutation("groups:sendMessage");
  const editGroupMessage = useMutation("groups:editMessage");
  const deleteGroupMessage = useMutation("groups:deleteMessage");
  const markGroupMessagesRead = useMutation("groups:markMessagesRead");
  const setGroupTyping = useMutation("groups:setTyping");
  const generateGroupAttachmentUploadUrl = useMutation(
    "groups:generateAttachmentUploadUrl",
  );
  const updateGroupMetadata = useMutation("groups:updateGroupMetadata");
  const setGroupMemberRole = useMutation("groups:setMemberRole");
  const muteGroupMember = useMutation("groups:muteMember");
  const banGroupMember = useMutation("groups:banMember");
  const setDisplayName = useMutation("users:setDisplayName");

  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfDocRef = useRef(null);
  const pdfDocCacheRef = useRef(new Map());
  const preloadedPdfPagesRef = useRef(new Map());
  const epubContainerRef = useRef(null);
  const epubBookRef = useRef(null);
  const epubRenditionRef = useRef(null);
  const cbzObjectUrlsRef = useRef([]);
  const bannerSettingsTimeoutRef = useRef(null);
  const lastReadPageTimeoutRef = useRef(null);
  const readerInitializedBookRef = useRef(null);
  const readerScrollPendingIdsRef = useRef(new Set());
  const notificationRegistrationRef = useRef(null);
  const selectedBookIdRef = useRef(null);
  const lastNotifiedTimerIdRef = useRef("");
  const notifiedMilestonesRef = useRef(new Set());
  const lastNotifiedSecondRef = useRef(-1);
  const completionNotifiedRef = useRef(false);
  const completedTimerSyncIdsRef = useRef(new Set());
  const tutorialEnforcedScopeRef = useRef("");

  const [pdfDoc, setPdfDoc] = useState(null);
  const [cbzImages, setCbzImages] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [openReadingTabIds, setOpenReadingTabIds] = useState([]);
  const [activeReadingTabId, setActiveReadingTabId] = useState(
    DASHBOARD_READING_TAB_ID,
  );
  const [lastDashboardSection, setLastDashboardSection] = useState(
    "dashboard",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [isReaderDocumentLoading, setIsReaderDocumentLoading] = useState(false);
  const [readerDocumentLoadingProgress, setReaderDocumentLoadingProgress] =
    useState(0);
  const [pdfLoadStates, setPdfLoadStates] = useState({});
  const [renderError, setRenderError] = useState("");
  const [altViewerState, setAltViewerState] = useState({
    loading: false,
    error: "",
  });
  const [uploadState, setUploadState] = useState({ busy: false, message: "" });
  const [marketInitialView, setMarketInitialView] = useState("store");
  const [bannerUploadState, setBannerUploadState] = useState({
    busy: false,
    message: "",
  });
  const [userIconState, setUserIconState] = useState({
    busy: false,
    message: "",
  });
  const [bannerPositionXInput, setBannerPositionXInput] = useState(
    DEFAULT_BANNER_POSITION_X,
  );
  const [bannerPositionYInput, setBannerPositionYInput] = useState(
    DEFAULT_BANNER_POSITION_Y,
  );
  const [bannerOpacityInput, setBannerOpacityInput] = useState(
    DEFAULT_BANNER_OPACITY,
  );
  const [bannerScaleInput, setBannerScaleInput] =
    useState(DEFAULT_BANNER_SCALE);
  const [timerState, setTimerState] = useState({ busy: false, message: "" });
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [timerLabel, setTimerLabel] = useState("");
  const [now, setNow] = useState(Date.now());
  const [viewerResizeTick, setViewerResizeTick] = useState(0);
  const [isCurrentPageLandscape, setIsCurrentPageLandscape] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [activeSection, setActiveSection] = useState(() =>
    getDashboardSectionFromLocation(),
  );
  const [calendarFocusRequest, setCalendarFocusRequest] = useState(null);
  const [minutesPerPageInput, setMinutesPerPageInput] = useState(20);
  const [dailyQuotaInput, setDailyQuotaInput] = useState(3);
  const [landingPageInput, setLandingPageInput] = useState(1);
  const [thumbnailPageInput, setThumbnailPageInput] = useState(1);
  const [appliedLandingPage, setAppliedLandingPage] = useState(1);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [marketMessage, setMarketMessage] = useState("");
  const [groupState, setGroupState] = useState({ busy: false, message: "" });
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [bookThumbnailMap, setBookThumbnailMap] = useState({});
  const bookThumbnailMapRef = useRef({});
  const [officialBookThumbnailMap, setOfficialBookThumbnailMap] = useState({});
  const officialBookThumbnailMapRef = useRef({});
  const [inkBursts, setInkBursts] = useState([]);
  const [workspaceName, setWorkspaceName] = useState(DEFAULT_WORKSPACE_NAME);
  const [dashboardSidebarWidth, setDashboardSidebarWidth] = useState(
    readDashboardSidebarWidth,
  );

  const bookList = useMemo(() => books ?? [], [books]);
  const localBookCount = useMemo(
    () => bookList.filter((book) => book.storageId).length,
    [bookList],
  );

  useEffect(() => {
    bookThumbnailMapRef.current = bookThumbnailMap;
  }, [bookThumbnailMap]);

  useEffect(() => {
    officialBookThumbnailMapRef.current = officialBookThumbnailMap;
  }, [officialBookThumbnailMap]);
  const timerList = useMemo(() => timers ?? [], [timers]);
  const profile = overview?.profile;
  const streak = overview?.streak ?? 0;
  const weekly = useMemo(() => overview?.weekly ?? [], [overview?.weekly]);
  const dailyActivity = useMemo(
    () => overview?.dailyActivity ?? [],
    [overview?.dailyActivity],
  );
  const timerSessions24h = useMemo(
    () => overview?.timerSessions24h ?? [],
    [overview?.timerSessions24h],
  );
  const timerSessionsEver = useMemo(
    () => overview?.timerSessionsEver ?? timerSessions24h,
    [overview?.timerSessionsEver, timerSessions24h],
  );
  const progressBooks = useMemo(
    () => overview?.progressBooks ?? [],
    [overview?.progressBooks],
  );
  const totalUnlockedPagesEver = overview?.totalUnlockedPagesEver ?? 0;
  const market = useMemo(() => overview?.market ?? [], [overview?.market]);
  const officialBookMarket = useMemo(
    () => overview?.officialBooks ?? [],
    [overview?.officialBooks],
  );
  const themeOptions = useMemo(
    () => market.filter((item) => item.type === "theme"),
    [market],
  );
  const inkBalance = profile?.ink ?? 0;
  const pageCredits = profile?.pageCredits ?? 0;
  const quillsBalance = profile?.quills ?? 0;
  const myGroups = useMemo(
    () => groupsOverview?.myGroups ?? [],
    [groupsOverview?.myGroups],
  );
  const publicGroups = useMemo(
    () => groupsOverview?.publicGroups ?? [],
    [groupsOverview?.publicGroups],
  );
  const selectedGroupRoom = useQuery(
    "groups:room",
    selectedGroupId ? { groupId: selectedGroupId } : {},
  );
  const isGroupRoomLoading =
    Boolean(selectedGroupId) && selectedGroupRoom === undefined;
  const groupsMonthLabel =
    groupsOverview?.monthLabel ??
    new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  const selectedThemeId = profile?.selectedTheme ?? DEFAULT_THEME_ID;
  const selectedThemeMode = profile?.selectedMode ?? DEFAULT_THEME_MODE;
  const selectedAccentColor = normalizeAccentColor(profile?.accentColor);
  const selectedAccentColorSecondary = normalizeAccentColor(
    profile?.accentColorSecondary,
  );
  const selectedLanguage = normalizeLanguagePreference(profile?.language);
  useVietnameseDomTranslation(selectedLanguage);
  const dashboardTutorialSteps = useMemo(
    () => getDashboardTutorialSteps(selectedLanguage),
    [selectedLanguage],
  );
  const tutorialLabels =
    TUTORIAL_UI_COPY[selectedLanguage] ?? TUTORIAL_UI_COPY.vi;
  const accentStyle = getAccentStyle(
    selectedAccentColor,
    selectedAccentColorSecondary,
    selectedThemeId,
    selectedThemeMode,
  );
  const selectedInteractionMode = normalizeInteractionMode(
    profile?.interactionMode,
  );
  const hasCustomBannerFeature = Boolean(
    (profile?.ownedFeatures ?? []).includes("custom-banner-upload"),
  );
  const hasMechanicalInteractionFeature = Boolean(
    (profile?.ownedFeatures ?? []).includes(MECHANICAL_INTERACTION_FEATURE_ID),
  );
  const readerMechanicalClassName =
    hasMechanicalInteractionFeature && selectedInteractionMode !== "classic"
      ? ` interactive-mechanical-enabled interactive-mode-${selectedInteractionMode}`
      : "";
  const customBannerUrl = profile?.customBannerUrl ?? "";
  const userIconUrl = profile?.userIconUrl ?? me?.image ?? "";
  const recentUserIcons = useMemo(
    () => profile?.recentUserIcons ?? [],
    [profile?.recentUserIcons],
  );
  const userIconPreset =
    profile?.userIconPreset ?? me?.iconPreset ?? "default-light";
  const userIconStorageId = profile?.userIconStorageId ?? "";
  const customBannerPositionX = normalizeBannerPosition(
    profile?.customBannerPositionX,
    DEFAULT_BANNER_POSITION_X,
  );
  const customBannerPositionY = normalizeBannerPosition(
    profile?.customBannerPositionY,
    DEFAULT_BANNER_POSITION_Y,
  );
  const customBannerOpacity = normalizeBannerOpacity(
    profile?.customBannerOpacity,
  );
  const customBannerScale = normalizeBannerScale(profile?.customBannerScale);
  const tutorialScope = me?._id ? `user:${me._id}` : "";
  const isWorkspaceDataLoading =
    me === undefined ||
    books === undefined ||
    timers === undefined ||
    overview === undefined ||
    groupsOverview === undefined;
  const workspaceScope = me?._id ? `user:${me._id}` : "user:guest";

  useLayoutEffect(() => {
    onThemeChange({
      themeId: selectedThemeId,
      mode: selectedThemeMode,
    });
  }, [selectedThemeId, selectedThemeMode, onThemeChange]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const nextHash = `section=${normalizeDashboardSection(activeSection)}`;
    if (url.hash.replace(/^#/, "") === nextHash) {
      return;
    }
    url.hash = nextHash;
    window.history.replaceState(null, "", url.toString());
  }, [activeSection]);

  useEffect(() => {
    if (me === undefined) {
      return;
    }

    if (me === null) {
      window.__dms4PendingAnalyticsAccount = null;
      if (typeof window.__dms4AnalyticsSetAccount === "function") {
        window.__dms4AnalyticsSetAccount(null);
      }
      return;
    }

    const payload = {
      appUserId: me._id,
      googleAccountName: me.name,
      googleAccountEmail: me.email,
    };

    window.__dms4PendingAnalyticsAccount = payload;

    const sendIfReady = () => {
      if (typeof window.__dms4AnalyticsSetAccount === "function") {
        window.__dms4AnalyticsSetAccount(payload);
        return true;
      }
      return false;
    };

    if (sendIfReady()) {
      return;
    }

    const onReady = () => {
      sendIfReady();
    };

    window.addEventListener("dms4-analytics-ready", onReady);
    const retryId = window.setTimeout(sendIfReady, 250);

    return () => {
      window.removeEventListener("dms4-analytics-ready", onReady);
      window.clearTimeout(retryId);
    };
  }, [me]);

  useEffect(() => {
    if (!tutorialScope) {
      return;
    }

    if (!isFaqCompleted(tutorialScope)) {
      setIsSettingsOpen(false);
      setIsAvatarPickerOpen(false);
      setIsProfileOpen(false);
      setIsSupportOpen(false);
      setIsTutorialOpen(false);
      setIsFaqOpen(true);
      return;
    }

    if (tutorialEnforcedScopeRef.current === tutorialScope) {
      return;
    }
    tutorialEnforcedScopeRef.current = tutorialScope;

    if (!isTutorialCompleted(tutorialScope)) {
      setIsSettingsOpen(false);
      setIsProfileOpen(false);
      setIsSupportOpen(false);
      setTutorialStepIndex(0);
      setIsTutorialOpen(true);
    }
  }, [isFaqOpen, tutorialScope]);

  useEffect(() => {
    if (!workspaceScope || me === undefined) {
      return;
    }

    const savedName = readWorkspaceName(workspaceScope);
    const googleName =
      String(me?.name || "").trim() ||
      String(me?.email || "")
        .split("@")
        .shift() ||
      DEFAULT_WORKSPACE_NAME;
    const resolvedName =
      savedName && savedName !== DEFAULT_WORKSPACE_NAME
        ? savedName
        : googleName;

    setWorkspaceName(resolvedName);
    writeWorkspaceName(workspaceScope, resolvedName);
  }, [me, workspaceScope]);

  useEffect(() => {
    if (!isTutorialOpen) {
      return;
    }

    const step = dashboardTutorialSteps[tutorialStepIndex];
    if (!step) {
      return;
    }

    if (step.section !== activeSection) {
      setActiveSection(step.section);
    }
  }, [activeSection, dashboardTutorialSteps, isTutorialOpen, tutorialStepIndex]);

  useEffect(() => {
    if (!isTutorialOpen) {
      return;
    }

    setIsSettingsOpen(false);
    setIsProfileOpen(false);
    setIsSupportOpen(false);
  }, [isTutorialOpen]);

  useEffect(
    () => () => {
      onThemeChange({
        themeId: DEFAULT_THEME_ID,
        mode: DEFAULT_THEME_MODE,
      });
    },
    [onThemeChange],
  );

  const ownedTitles = useMemo(
    () => new Set(bookList.map((book) => book.title.trim().toLowerCase())),
    [bookList],
  );

  const officialBooksWithState = useMemo(
    () => {
      const sourceBooks = officialBookMarket.length
        ? officialBookMarket
        : OFFICIAL_BOOKS;

      return sourceBooks.map((book) => {
        const fallbackBook =
          OFFICIAL_BOOK_BY_ID[book.id] ?? getOfficialBookAsset(book) ?? {};
        const title = book.title ?? fallbackBook.title ?? "Official Book";
        const cost = book.cost ?? fallbackBook.cost ?? 0;

        return {
          ...fallbackBook,
          ...book,
          title,
          cost,
          affordable: book.affordable ?? cost === 0,
          fileType: book.fileType ?? fallbackBook.fileType ?? "pdf",
          pageCount: book.pageCount ?? fallbackBook.pageCount ?? 1,
          pdfUrl: book.pdfUrl ?? fallbackBook.pdfUrl ?? null,
          coverUrl: book.coverUrl ?? fallbackBook.coverUrl ?? "",
          added: ownedTitles.has(title.trim().toLowerCase()),
        };
      });
    },
    [officialBookMarket, ownedTitles],
  );

  const officialBooksInLibrary = useMemo(
    () => officialBooksWithState.filter((book) => book.added),
    [officialBooksWithState],
  );

  useEffect(() => {
    if (!bookList.length) {
      return undefined;
    }

    const requests = bookList.map(getBookThumbnailRequest).filter(Boolean);
    setBookThumbnailMap((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const request of requests) {
        const { book, cacheKey, coverUrl, fileType, page } = request;
        const current = next[book._id];
        const error = !coverUrl;
        if (
          current?.cacheKey === cacheKey &&
          current?.src === coverUrl &&
          Boolean(current?.error) === error
        ) {
          continue;
        }

        changed = true;
        next[book._id] = {
          src: coverUrl,
          cacheKey,
          page,
          fileType,
          error,
        };
      }

      return changed ? next : prev;
    });

    return undefined;
  }, [bookList]);

  useEffect(() => {
    if (!officialBooksWithState.length) {
      return undefined;
    }

    setOfficialBookThumbnailMap((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const book of officialBooksWithState) {
        if (!book.id || !book.pdfUrl) {
          continue;
        }

        const cacheKey = `${book.id}:cover:${book.coverUrl || book.pdfUrl}`;
        if (next[book.id]?.cacheKey === cacheKey) {
          continue;
        }

        changed = true;
        next[book.id] = {
          src: book.coverUrl || "",
          cacheKey,
          error: !book.coverUrl,
        };
      }

      return changed ? next : prev;
    });

    return undefined;
  }, [officialBooksWithState]);

  const selectedBook = useMemo(
    () => bookList.find((book) => book._id === selectedBookId) ?? null,
    [bookList, selectedBookId],
  );

  const continueReadingBook = useMemo(() => {
    if (!bookList.length) {
      return null;
    }

    return [...bookList].sort((a, b) => {
      const aLastRead = Math.max(
        1,
        Math.floor(Number(a?.lastReadPage ?? a?.landingPage ?? 1)),
      );
      const bLastRead = Math.max(
        1,
        Math.floor(Number(b?.lastReadPage ?? b?.landingPage ?? 1)),
      );
      if (aLastRead !== bLastRead) {
        return bLastRead - aLastRead;
      }

      return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
    })[0];
  }, [bookList]);

  const readingTabs = useMemo(
    () =>
      openReadingTabIds
        .map((bookId) => bookList.find((book) => book._id === bookId))
        .filter(Boolean)
        .map((book) => ({
          id: book._id,
          title: String(book.title || "Untitled").trim() || "Untitled",
        })),
    [openReadingTabIds, bookList],
  );

  const selectedBookFileUrl = useMemo(
    () => resolveBookFileUrl(selectedBook),
    [selectedBook],
  );

  const selectedBookFileType = useMemo(
    () =>
      detectBookFileType({
        fileName: selectedBookFileUrl ?? selectedBook?.title ?? "",
        hintedType: selectedBook?.fileType ?? "",
      }),
    [selectedBook?.fileType, selectedBook?.title, selectedBookFileUrl],
  );

  const isPdfBook = selectedBookFileType === "pdf";
  const isEpubBook = selectedBookFileType === "epub";
  const isCbzBook = selectedBookFileType === "cbz";

  const pageCount = selectedBook?.pageCount ?? 0;
  const unlockedPages = selectedBook?.unlockedPages ?? 0;
  const landingPage = Math.max(
    1,
    Math.min(pageCount || 1, appliedLandingPage || 1),
  );
  const maxReachable = Math.max(
    landingPage,
    Math.min(
      pageCount || landingPage,
      landingPage + Math.max(1, unlockedPages) - 1,
    ),
  );
  const cbzCurrentImageUrl = cbzImages[Math.max(0, currentPage - 1)] ?? "";
  const usesPageNavigation = isPdfBook || isEpubBook || isCbzBook;
  const isReaderExpanded = Boolean(
    activeSection === "library" &&
    selectedBook?._id &&
    openReadingTabIds.includes(selectedBook._id) &&
    activeReadingTabId === selectedBook._id,
  );
  const isReaderTabView =
    activeSection === "library" &&
    Boolean(activeReadingTabId) &&
    activeReadingTabId !== DASHBOARD_READING_TAB_ID;

  useEffect(() => {
    selectedBookIdRef.current = selectedBookId;
  }, [selectedBookId]);

  const activeTimers = timerList.filter(
    (timer) => !timer.claimedAt && !timer.canceledAt,
  );
  const readerAdPopup = useTimerCompletionAdPopup(activeTimers);

  useEffect(() => {
    const readyTimers = activeTimers.filter(
      (timer) =>
        !timer.isPaused &&
        !timer.completedAt &&
        getTimerRemainingMs(timer, now) <= 0 &&
        !completedTimerSyncIdsRef.current.has(timer._id),
    );

    if (!readyTimers.length) {
      return;
    }

    for (const timer of readyTimers) {
      completedTimerSyncIdsRef.current.add(timer._id);
      completeTimer({ timerId: timer._id }).catch(() => {
        completedTimerSyncIdsRef.current.delete(timer._id);
      });
    }
  }, [activeTimers, completeTimer, now]);

  const leadTimer = useMemo(() => {
    if (!activeTimers.length) {
      return null;
    }
    const runningTimers = activeTimers.filter((timer) => !timer.isPaused);
    const pool = runningTimers.length ? runningTimers : activeTimers;
    return [...pool].sort(
      (a, b) => getTimerRemainingMs(a, now) - getTimerRemainingMs(b, now),
    )[0];
  }, [activeTimers, now]);

  // Keep a live clock for countdown timers and UI refresh.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setViewerResizeTick((prev) => prev + 1);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!profile || profile.economyResetVersion >= 2) {
      return;
    }
    void applyEconomyReset().catch(() => {});
  }, [applyEconomyReset, profile]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let isCancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => {
        if (!isCancelled) {
          notificationRegistrationRef.current = registration;
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookList.length) {
      setSelectedBookId(null);
      return;
    }
    if (
      !selectedBookId ||
      !bookList.some((book) => book._id === selectedBookId)
    ) {
      setSelectedBookId(bookList[0]._id);
    }
  }, [bookList, selectedBookId]);

  useEffect(() => {
    const validBookIds = new Set(bookList.map((book) => book._id));
    setOpenReadingTabIds((prev) =>
      prev.filter((bookId) => validBookIds.has(bookId)),
    );
  }, [bookList]);

  useEffect(() => {
    if (
      !activeReadingTabId ||
      activeReadingTabId === DASHBOARD_READING_TAB_ID
    ) {
      return;
    }

    if (openReadingTabIds.includes(activeReadingTabId)) {
      return;
    }

    const fallbackTabId =
      openReadingTabIds[openReadingTabIds.length - 1] ||
      DASHBOARD_READING_TAB_ID;
    setActiveReadingTabId(fallbackTabId);
  }, [activeReadingTabId, openReadingTabIds]);

  useEffect(() => {
    if (activeReadingTabId === DASHBOARD_READING_TAB_ID) {
      setLastDashboardSection(activeSection);
    }
  }, [activeReadingTabId, activeSection]);

  useEffect(() => {
    if (
      activeSection !== "library" &&
      activeReadingTabId !== DASHBOARD_READING_TAB_ID
    ) {
      setActiveReadingTabId(DASHBOARD_READING_TAB_ID);
    }
  }, [activeReadingTabId, activeSection]);

  useEffect(() => {
    if (
      !isReaderTabView ||
      !selectedBookId ||
      !readerScrollPendingIdsRef.current.has(selectedBookId)
    ) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      document
        .querySelector('[data-reader-stage="true"]')
        ?.scrollIntoView({ block: "start" });
      readerScrollPendingIdsRef.current.delete(selectedBookId);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeReadingTabId, isReaderTabView, selectedBookId]);

  useEffect(() => {
    const bookIds = new Set(bookList.map((book) => book._id));
    setBookThumbnailMap((prev) => {
      const next = {};
      let changed = false;

      for (const [bookId, entry] of Object.entries(prev)) {
        if (bookIds.has(bookId)) {
          next[bookId] = entry;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [bookList]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setMinutesPerPageInput(profile.minutesPerPage ?? 20);
    setDailyQuotaInput(profile.dailyQuotaPages ?? 3);
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const browserTimeZone = getBrowserTimeZone();
    if (!browserTimeZone || profile.timeZone === browserTimeZone) {
      return;
    }

    updatePreferences({ timeZone: browserTimeZone }).catch(() => {});
  }, [profile, updatePreferences]);

  useEffect(() => {
    setBannerPositionXInput(customBannerPositionX);
    setBannerPositionYInput(customBannerPositionY);
    setBannerOpacityInput(customBannerOpacity);
    setBannerScaleInput(customBannerScale);
  }, [
    customBannerOpacity,
    customBannerPositionX,
    customBannerPositionY,
    customBannerScale,
  ]);

  useEffect(() => {
    const pdfDocCache = pdfDocCacheRef.current;
    return () => {
      if (bannerSettingsTimeoutRef.current) {
        window.clearTimeout(bannerSettingsTimeoutRef.current);
      }
      if (lastReadPageTimeoutRef.current) {
        window.clearTimeout(lastReadPageTimeoutRef.current);
      }
      cbzObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      cbzObjectUrlsRef.current = [];
      if (epubRenditionRef.current) {
        epubRenditionRef.current.destroy();
        epubRenditionRef.current = null;
      }
      if (epubBookRef.current) {
        epubBookRef.current.destroy?.();
        epubBookRef.current = null;
      }
      for (const entry of pdfDocCache.values()) {
        entry.loadingTask?.destroy?.();
        if (entry.doc) {
          void entry.doc.destroy();
        }
      }
      pdfDocCache.clear();
    };
  }, []);

  useEffect(() => {
    if (!selectedBookId || !selectedBook) {
      readerInitializedBookRef.current = null;
      setCurrentPage(1);
      setRenderError("");
      setAltViewerState({ loading: false, error: "" });
      return;
    }

    if (readerInitializedBookRef.current === selectedBookId) {
      return;
    }

    const rememberedPage = Math.max(
      1,
      Math.floor(selectedBook.lastReadPage ?? selectedBook.landingPage ?? 1),
    );
    readerInitializedBookRef.current = selectedBookId;
    setCurrentPage(rememberedPage);
    setRenderError("");
    setAltViewerState({ loading: false, error: "" });
  }, [selectedBook, selectedBookId]);

  useEffect(() => {
    setLandingPageInput(selectedBook?.landingPage ?? 1);
    setThumbnailPageInput(selectedBook?.thumbnailPage ?? 1);
    setAppliedLandingPage(selectedBook?.landingPage ?? 1);
  }, [
    selectedBook?.landingPage,
    selectedBook?.thumbnailPage,
  ]);

  // Load full PDFs only for the active reader tab. Convex file bandwidth gets
  // expensive quickly when large documents are fetched for background tabs.
  useEffect(() => {
    const pdfBooksToLoad = new Map();
    const candidateIds = new Set();
    if (isReaderTabView && selectedBookId) {
      candidateIds.add(selectedBookId);
    }

    for (const bookId of candidateIds) {
      const book = bookList.find((entry) => entry._id === bookId);
      if (!book) {
        continue;
      }
      const pdfUrl = resolveBookFileUrl(book);
      const fileType = detectBookFileType({
        fileName: pdfUrl ?? book.title ?? "",
        hintedType: book.fileType ?? "",
      });
      if (pdfUrl && fileType === "pdf") {
        pdfBooksToLoad.set(bookId, { book, pdfUrl });
      }
    }

    for (const [bookId, { pdfUrl }] of pdfBooksToLoad.entries()) {
      const existing = pdfDocCacheRef.current.get(bookId);
      if (
        existing?.url === pdfUrl &&
        (existing.doc || existing.loadingTask || existing.error)
      ) {
        continue;
      }

      if (existing?.url !== pdfUrl) {
        existing?.loadingTask?.destroy?.();
        if (existing?.doc) {
          void existing.doc.destroy();
        }
      }

      const entry = {
        url: pdfUrl,
        doc: null,
        loadingTask: null,
        progress: 0,
        error: "",
      };
      const loadingTask = getDocument({
        url: pdfUrl,
        rangeChunkSize: 1 << 16,
        disableAutoFetch: true,
        disableStream: true,
        disableRange: false,
      });
      entry.loadingTask = loadingTask;
      pdfDocCacheRef.current.set(bookId, entry);

      setPdfLoadStates((prev) => ({
        ...prev,
        [bookId]: { loading: true, progress: 0, error: "" },
      }));

      loadingTask.onProgress = ({ loaded, total }) => {
        const currentEntry = pdfDocCacheRef.current.get(bookId);
        if (currentEntry !== entry || entry.doc || entry.error) {
          return;
        }
        const progress =
          Number.isFinite(total) && total > 0
            ? Math.max(5, Math.min(95, Math.round((loaded / total) * 100)))
            : Math.max(entry.progress, 12);
        entry.progress = Math.max(entry.progress, progress);
        setPdfLoadStates((prev) => ({
          ...prev,
          [bookId]: {
            ...(prev[bookId] || {}),
            loading: true,
            progress: entry.progress,
            error: "",
          },
        }));
      };

      loadingTask.promise
        .then((doc) => {
          const currentEntry = pdfDocCacheRef.current.get(bookId);
          if (currentEntry !== entry) {
            void doc.destroy();
            return;
          }
          entry.doc = doc;
          entry.loadingTask = null;
          entry.progress = 100;
          setPdfLoadStates((prev) => ({
            ...prev,
            [bookId]: { loading: false, progress: 100, error: "" },
          }));
          if (selectedBookIdRef.current === bookId) {
            pdfDocRef.current = doc;
            setPdfDoc(doc);
            setIsReaderDocumentLoading(false);
            setReaderDocumentLoadingProgress(100);
          }
        })
        .catch(() => {
          const currentEntry = pdfDocCacheRef.current.get(bookId);
          if (currentEntry !== entry) {
            return;
          }
          entry.loadingTask = null;
          entry.error = "Could not load this PDF from storage.";
          setPdfLoadStates((prev) => ({
            ...prev,
            [bookId]: { loading: false, progress: 0, error: entry.error },
          }));
          if (selectedBookIdRef.current === bookId) {
            setIsReaderDocumentLoading(false);
            setReaderDocumentLoadingProgress(0);
            setRenderError(entry.error);
          }
        });
    }

    for (const [bookId, entry] of pdfDocCacheRef.current.entries()) {
      if (pdfBooksToLoad.has(bookId)) {
        continue;
      }
      entry.loadingTask?.destroy?.();
      if (entry.doc) {
        void entry.doc.destroy();
      }
      pdfDocCacheRef.current.delete(bookId);
      preloadedPdfPagesRef.current.delete(bookId);
      setPdfLoadStates((prev) => {
        if (!(bookId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[bookId];
        return next;
      });
    }
  }, [bookList, isReaderTabView, selectedBookId]);

  useEffect(() => {
    if (!selectedBookId || !isPdfBook) {
      setIsReaderDocumentLoading(false);
      setReaderDocumentLoadingProgress(0);
      pdfDocRef.current = null;
      setPdfDoc(null);
      return;
    }

    const entry = pdfDocCacheRef.current.get(selectedBookId);
    const loadState = pdfLoadStates[selectedBookId];
    if (entry?.doc) {
      pdfDocRef.current = entry.doc;
      setPdfDoc(entry.doc);
      setIsReaderDocumentLoading(false);
      setReaderDocumentLoadingProgress(100);
      return;
    }

    pdfDocRef.current = null;
    setPdfDoc(null);
    setIsReaderDocumentLoading(Boolean(entry?.loadingTask || loadState?.loading));
    setReaderDocumentLoadingProgress(
      Math.max(0, Math.min(100, Math.round(loadState?.progress ?? entry?.progress ?? 0))),
    );
    if (loadState?.error || entry?.error) {
      setRenderError(loadState?.error || entry?.error);
    }
  }, [isPdfBook, pdfLoadStates, selectedBookId]);

  // Render the active page into canvas whenever page index or document changes.
  useEffect(() => {
    if (!isPdfBook || !pdfDoc || !canvasRef.current) {
      return undefined;
    }

    let isCancelled = false;

    const renderPage = async () => {
      setIsRendering(true);
      setRenderError("");

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled || !canvasRef.current) {
          return;
        }

        const canvas = canvasRef.current;
        const viewport = page.getViewport({ scale: 1 });
        const frame = canvas.parentElement;
        const isReaderExpandedLayout = frame?.classList.contains("fullscreen");
        const isReaderOnlyLayout =
          frame?.classList.contains("reader-only-frame");
        const frameWidth = frame?.clientWidth ?? viewport.width;
        const viewportHeight =
          window.visualViewport?.height || window.innerHeight || viewport.height;
        const frameHeight = isReaderOnlyLayout
          ? viewportHeight
          : frame?.clientHeight ?? viewport.height;
        const isLandscapePage = viewport.width > viewport.height;
        setIsCurrentPageLandscape((prev) =>
          prev === isLandscapePage ? prev : isLandscapePage,
        );
        const toolbarReserve =
          isReaderExpandedLayout && !isReaderOnlyLayout ? 96 : 20;
        const safeWidth = Math.max(280, frameWidth - 24);
        const safeHeight = Math.max(220, frameHeight - toolbarReserve);
        const scaleByWidth = safeWidth / viewport.width;
        const scaleByHeight = safeHeight / viewport.height;
        const fullscreenScale = isLandscapePage
          ? Math.max(scaleByWidth, scaleByHeight) * 0.96
          : Math.min(scaleByWidth, scaleByHeight);
        const regularScale = Math.min(scaleByWidth, scaleByHeight);
        const pageAspect = viewport.height / Math.max(1, viewport.width);
        const readerOnlyScale =
          pageAspect > 1.65 ? Math.min(scaleByWidth, 1.45) : regularScale;
        const scale = isReaderOnlyLayout
          ? readerOnlyScale
          : isReaderExpandedLayout
            ? fullscreenScale
            : regularScale;
        const scaledViewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          throw new Error("Canvas context unavailable");
        }

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        canvas.width = Math.floor(scaledViewport.width * pixelRatio);
        canvas.height = Math.floor(scaledViewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
        canvas.style.height = `${Math.floor(scaledViewport.height)}px`;
        frame?.style.setProperty(
          "--reader-page-width",
          `${Math.floor(scaledViewport.width)}px`,
        );

        const renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport,
          transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (error) {
        if (error?.name !== "RenderingCancelledException" && !isCancelled) {
          setRenderError("Page render failed. Please try another page.");
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [
    activeSection,
    currentPage,
    isPdfBook,
    isReaderExpanded,
    pdfDoc,
    viewerResizeTick,
  ]);

  useEffect(() => {
    setCurrentPage((prev) => Math.max(1, Math.min(prev, pageCount || 1)));
  }, [pageCount]);

  useEffect(() => {
    if (!isPdfBook || !pdfDoc || !selectedBookId || !isReaderTabView) {
      return undefined;
    }

    let cancelled = false;
    const cacheKey = String(selectedBookId);
    const cachedPages =
      preloadedPdfPagesRef.current.get(cacheKey) ?? new Set();
    preloadedPdfPagesRef.current.set(cacheKey, cachedPages);

    const pagesToPreload = [];
    const startPage = Math.max(1, currentPage - PDF_PAGE_PRELOAD_RADIUS);
    const endPage = Math.min(maxReachable, currentPage + PDF_PAGE_PRELOAD_RADIUS);
    for (const page of cachedPages) {
      if (page < startPage || page > endPage) {
        cachedPages.delete(page);
      }
    }
    for (let page = startPage; page <= endPage; page += 1) {
      if (!cachedPages.has(page)) {
        pagesToPreload.push(page);
      }
    }

    const preloadPages = async () => {
      for (const page of pagesToPreload) {
        if (cancelled) {
          return;
        }
        try {
          await pdfDoc.getPage(page);
          cachedPages.add(page);
        } catch {
          return;
        }
      }
    };

    void preloadPages();

    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    isPdfBook,
    isReaderTabView,
    maxReachable,
    pdfDoc,
    selectedBookId,
  ]);

  useEffect(() => {
    if (!selectedBookId || !selectedBook || activeSection !== "library") {
      return;
    }

    const nextPage = Math.max(1, Math.min(pageCount || 1, currentPage || 1));
    if (selectedBook.lastReadPage === nextPage) {
      return;
    }

    if (lastReadPageTimeoutRef.current) {
      window.clearTimeout(lastReadPageTimeoutRef.current);
    }

    lastReadPageTimeoutRef.current = window.setTimeout(() => {
      void setLastReadPage({ bookId: selectedBookId, page: nextPage }).catch(
        () => {},
      );
    }, 280);

    return () => {
      if (lastReadPageTimeoutRef.current) {
        window.clearTimeout(lastReadPageTimeoutRef.current);
      }
    };
  }, [
    activeSection,
    currentPage,
    pageCount,
    selectedBook,
    selectedBookId,
    setLastReadPage,
  ]);

  useEffect(() => {
    if (bannerSettingsTimeoutRef.current) {
      window.clearTimeout(bannerSettingsTimeoutRef.current);
    }

    if (!hasCustomBannerFeature) {
      return;
    }

    const x = normalizeBannerPosition(
      bannerPositionXInput,
      DEFAULT_BANNER_POSITION_X,
    );
    const y = normalizeBannerPosition(
      bannerPositionYInput,
      DEFAULT_BANNER_POSITION_Y,
    );
    const opacity = normalizeBannerOpacity(bannerOpacityInput);
    const scale = normalizeBannerScale(bannerScaleInput);
    const unchanged =
      x === customBannerPositionX &&
      y === customBannerPositionY &&
      Math.abs(opacity - customBannerOpacity) < 0.0001 &&
      Math.abs(scale - customBannerScale) < 0.0001;

    if (unchanged) {
      return;
    }

    bannerSettingsTimeoutRef.current = window.setTimeout(() => {
      void updateBannerSettings({
        positionX: x,
        positionY: y,
        opacity,
        scale,
      }).catch(() => {});
    }, 260);

    return () => {
      if (bannerSettingsTimeoutRef.current) {
        window.clearTimeout(bannerSettingsTimeoutRef.current);
      }
    };
  }, [
    bannerOpacityInput,
    bannerPositionXInput,
    bannerPositionYInput,
    bannerScaleInput,
    customBannerOpacity,
    customBannerPositionX,
    customBannerPositionY,
    customBannerScale,
    hasCustomBannerFeature,
    updateBannerSettings,
  ]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const onEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    let cancelled = false;

    if (
      activeSection !== "library" ||
      !isEpubBook ||
      !selectedBookFileUrl ||
      !selectedBookId ||
      !epubContainerRef.current
    ) {
      if (epubRenditionRef.current) {
        epubRenditionRef.current.destroy();
        epubRenditionRef.current = null;
      }
      if (epubBookRef.current) {
        epubBookRef.current.destroy?.();
        epubBookRef.current = null;
      }
      return;
    }

    const setupEpub = async () => {
      setAltViewerState({ loading: true, error: "" });

      const module = await import("epubjs");
      const createEpub = module.default;
      const book = createEpub(selectedBookFileUrl);
      await book.ready;
      if (cancelled) {
        book.destroy?.();
        return;
      }

      if (epubBookRef.current) {
        epubBookRef.current.destroy?.();
      }
      if (epubRenditionRef.current) {
        epubRenditionRef.current.destroy();
      }

      epubBookRef.current = book;
      const rendition = book.renderTo(epubContainerRef.current, {
        width: "100%",
        height: "100%",
      });
      epubRenditionRef.current = rendition;

      rendition.on("relocated", (location) => {
        const nextPage = Math.max(1, (location?.start?.index ?? 0) + 1);
        setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
      });

      const startPage = Math.max(
        1,
        Math.min(pageCount || 1, selectedBook?.lastReadPage ?? 1),
      );
      const target = book.spine.get(startPage - 1);
      await rendition.display(target?.href || undefined);

      if (!cancelled) {
        setAltViewerState({ loading: false, error: "" });
      }
    };

    void setupEpub().catch(() => {
      if (!cancelled) {
        setAltViewerState({
          loading: false,
          error: "Could not render this EPUB file.",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    isEpubBook,
    pageCount,
    selectedBook?.lastReadPage,
    selectedBookFileUrl,
    selectedBookId,
  ]);

  useEffect(() => {
    if (
      activeSection !== "library" ||
      !isEpubBook ||
      !epubBookRef.current ||
      !epubRenditionRef.current
    ) {
      return;
    }

    const targetIndex = Math.max(0, Math.min(pageCount || 1, currentPage) - 1);
    const target = epubBookRef.current.spine.get(targetIndex);
    if (!target) {
      return;
    }
    void epubRenditionRef.current.display(target.href).catch(() => {});
  }, [activeSection, currentPage, isEpubBook, pageCount, selectedBookId]);

  useEffect(() => {
    let cancelled = false;
    cbzObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    cbzObjectUrlsRef.current = [];
    setCbzImages([]);

    if (activeSection !== "library" || !isCbzBook || !selectedBookFileUrl) {
      return;
    }

    const loadCbz = async () => {
      setAltViewerState({ loading: true, error: "" });
      const response = await fetch(selectedBookFileUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const { default: JSZip } = await import("jszip");
      const archive = await JSZip.loadAsync(await response.arrayBuffer());
      const imageEntries = Object.values(archive.files)
        .filter(
          (entry) =>
            !entry.dir && /\.(png|jpe?g|webp|gif|bmp)$/i.test(entry.name),
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        );

      const urls = [];
      for (const entry of imageEntries) {
        const blob = await entry.async("blob");
        urls.push(URL.createObjectURL(blob));
      }

      if (cancelled) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      cbzObjectUrlsRef.current = urls;
      setCbzImages(urls);
      setCurrentPage((prev) => Math.max(1, Math.min(prev, urls.length || 1)));
      setAltViewerState({ loading: false, error: "" });
    };

    void loadCbz().catch(() => {
      if (!cancelled) {
        setAltViewerState({
          loading: false,
          error: "Could not render this CBZ archive.",
        });
      }
    });

    return () => {
      cancelled = true;
      cbzObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      cbzObjectUrlsRef.current = [];
      setCbzImages([]);
    };
  }, [activeSection, isCbzBook, selectedBookFileUrl, selectedBookId]);

  useEffect(() => {
    if (!leadTimer) {
      document.title = APP_TITLE;
      lastNotifiedTimerIdRef.current = "";
      notifiedMilestonesRef.current = new Set();
      lastNotifiedSecondRef.current = -1;
      completionNotifiedRef.current = false;
      return;
    }

    const remaining = getTimerRemainingMs(leadTimer, now);
    document.title = leadTimer.isPaused
      ? `Paused ${formatRemaining(remaining)} - ${leadTimer.label}`
      : `${formatRemaining(remaining)} - ${leadTimer.label}`;
  }, [leadTimer, now]);

  useEffect(() => {
    return () => {
      document.title = APP_TITLE;
    };
  }, []);

  useEffect(() => {
    if (!leadTimer || !("Notification" in window)) {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }
    if (!notificationRegistrationRef.current) {
      return;
    }

    const remaining = getTimerRemainingMs(leadTimer, now);
    const remainingSeconds = Math.max(0, Math.floor(remaining / 1000));

    if (lastNotifiedTimerIdRef.current !== leadTimer._id) {
      lastNotifiedTimerIdRef.current = leadTimer._id;
      notifiedMilestonesRef.current = new Set();
      completionNotifiedRef.current = false;
      lastNotifiedSecondRef.current = remainingSeconds + 1;
    }

    const previousSeconds = lastNotifiedSecondRef.current;
    lastNotifiedSecondRef.current = remainingSeconds;

    if (leadTimer.isPaused) {
      return;
    }

    const notificationTag = `${TIMER_NOTIFICATION_TAG}-${leadTimer._id}`;

    if (remainingSeconds <= 0) {
      if (completionNotifiedRef.current) {
        return;
      }

      completionNotifiedRef.current = true;
      notificationRegistrationRef.current
        .showNotification("Timer complete", {
          body: `${leadTimer.label} is ready to claim.`,
          tag: notificationTag,
          renotify: true,
          requireInteraction: true,
          data: { url: getAuthRedirectUrl() },
        })
        .catch(() => {});
      return;
    }

    const milestone = TIMER_NOTIFICATION_MILESTONES_SECONDS.find(
      (threshold) =>
        previousSeconds > threshold &&
        remainingSeconds <= threshold &&
        !notifiedMilestonesRef.current.has(threshold),
    );

    if (!milestone) {
      return;
    }

    notifiedMilestonesRef.current.add(milestone);
    notificationRegistrationRef.current
      .showNotification(`${formatRemaining(remaining)} remaining`, {
        body: leadTimer.label,
        tag: notificationTag,
        renotify: false,
        requireInteraction: false,
        data: { url: getAuthRedirectUrl() },
      })
      .catch(() => {});
  }, [leadTimer, now]);

  const onUploadBook = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (localBookCount >= LOCAL_BOOK_UPLOAD_LIMIT) {
      setUploadState({
        busy: false,
        message: `Local file limit reached (${LOCAL_BOOK_UPLOAD_LIMIT}).`,
      });
      event.target.value = "";
      return;
    }

    setUploadState({ busy: true, message: "" });

    try {
      const fileType = detectBookFileType({
        fileName: file.name,
        mimeType: file.type,
      });
      const data = await file.arrayBuffer();
      let detectedPageCount = 1;

      if (fileType === "pdf") {
        const loadingTask = getDocument({ data });
        const pdf = await loadingTask.promise;
        detectedPageCount = Math.max(1, pdf.numPages);
        await loadingTask.destroy();
      } else if (fileType === "epub") {
        try {
          const module = await import("epubjs");
          const createEpub = module.default;
          const book = createEpub(data);
          await book.ready;
          detectedPageCount = Math.max(1, book.spine?.length ?? 1);
          book.destroy?.();
        } catch {
          detectedPageCount = 200;
        }
      } else if (fileType === "cbz") {
        try {
          const { default: JSZip } = await import("jszip");
          const archive = await JSZip.loadAsync(data);
          const imageEntries = Object.values(archive.files).filter(
            (entry) =>
              !entry.dir && /\.(png|jpe?g|webp|gif|bmp)$/i.test(entry.name),
          );
          detectedPageCount = Math.max(1, imageEntries.length);
        } catch {
          detectedPageCount = 120;
        }
      }

      const title = file.name.replace(/\.(pdf|epub|mobi|azw3|cbz|cbr)$/i, "");
      const contentType = file.type || "application/octet-stream";
      let uploadedVia = "convex";
      let externalTarget = null;

      try {
        externalTarget = await createExternalBookUploadTarget({
          fileName: file.name,
          contentType,
          fileType,
          byteSize: file.size || 0,
        });
      } catch {
        externalTarget = null;
      }

      if (externalTarget?.configured && externalTarget.uploadUrl) {
        const uploadResponse = await fetch(externalTarget.uploadUrl, {
          method: externalTarget.method || "PUT",
          headers: externalTarget.headers || { "Content-Type": contentType },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("External upload failed");
        }

        uploadedVia = externalTarget.provider || "object-storage";
        await createBook({
          title,
          sourceUrl: externalTarget.assetUrl,
          assetKey: externalTarget.assetKey,
          assetProvider: uploadedVia,
          assetContentType: contentType,
          assetSize: file.size || 0,
          pageCount: detectedPageCount,
          fileType,
        });
      } else {
        const uploadUrl = await createUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = await uploadResponse.json();
        await createBook({
          title,
          storageId,
          assetProvider: "convex",
          assetContentType: contentType,
          assetSize: file.size || 0,
          pageCount: detectedPageCount,
          fileType,
        });
      }

      event.target.value = "";
      setUploadState({
        busy: false,
        message:
          fileType === "mobi" || fileType === "azw3" || fileType === "cbr"
            ? `${fileType.toUpperCase()} uploaded via ${uploadedVia}. Use the reader panel links to open it if your browser cannot preview it.`
            : `${fileType.toUpperCase()} uploaded via ${uploadedVia} and ready to read.`,
      });
    } catch {
      setUploadState({
        busy: false,
        message:
          "Book upload failed. Confirm the file is a supported format and your Convex setup is healthy.",
      });
    }
  };

  const onRemoveBook = async (bookId) => {
    if (!bookId) {
      return;
    }

    setUploadState({ busy: true, message: "" });
    try {
      await removeBook({ bookId });
      setOpenReadingTabIds((prev) => prev.filter((id) => id !== bookId));
      setBookThumbnailMap((prev) => {
        const next = { ...prev };
        delete next[bookId];
        return next;
      });
      if (selectedBookId === bookId) {
        const fallback =
          bookList.find((book) => book._id !== bookId)?._id ?? null;
        setSelectedBookId(fallback);
        setActiveReadingTabId(DASHBOARD_READING_TAB_ID);
      }
      setUploadState({ busy: false, message: "Book removed." });
    } catch {
      setUploadState({ busy: false, message: "Could not remove book." });
    }
  };

  const onCreateTimer = async (event) => {
    event?.preventDefault?.();
    const safeLabel = timerLabel.trim();
    if (!safeLabel) {
      setTimerState({ busy: false, message: "" });
      return;
    }
    const normalizedDurationMinutes = Math.max(
      1,
      Math.floor(Number(durationMinutes) || 1),
    );
    if (normalizedDurationMinutes > MAX_SESSION_MINUTES) {
      setTimerState({ busy: false, message: LONG_SESSION_WARNING });
      return;
    }
    setTimerState({ busy: true, message: "" });
    try {
      await createTimer({
        label: safeLabel,
        durationMinutes: Math.min(
          MAX_SESSION_MINUTES,
          normalizedDurationMinutes,
        ),
      });
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }
      setTimerState({ busy: false, message: "" });
    } catch {
      setTimerState({ busy: false, message: "" });
    }
  };

  const onSavePreferences = async (dailyQuotaPagesOverride) => {
    setSettingsMessage("");
    const normalizedMinutesPerPage = Math.max(
      1,
      Math.floor(Number(minutesPerPageInput) || 1),
    );
    const normalizedDailyQuota =
      Number.isFinite(Number(dailyQuotaPagesOverride))
        ? Math.max(1, Math.floor(Number(dailyQuotaPagesOverride)))
        : dailyQuotaInput;
    try {
      await updatePreferences({
        minutesPerPage: normalizedMinutesPerPage,
        dailyQuotaPages: normalizedDailyQuota,
        timeZone: getBrowserTimeZone(),
      });
      setSettingsMessage("Preferences updated.");
    } catch {
      setSettingsMessage("Could not update preferences.");
    }
  };

  const onSelectLanguage = async (nextLanguage) => {
    const language = normalizeLanguagePreference(nextLanguage);
    setSettingsMessage("");
    try {
      await updatePreferences({ language });
      setSettingsMessage(
        language === "vi"
          ? "Đã cập nhật ngôn ngữ."
          : "Language updated.",
      );
    } catch {
      setSettingsMessage(
        language === "vi"
          ? "Không thể cập nhật ngôn ngữ."
          : "Could not update language.",
      );
    }
  };

  const onPauseOrResume = async (timerId) => {
    try {
      await togglePauseTimer({ timerId });
      setNow(Date.now());
    } catch {
      setTimerState({ busy: false, message: "" });
    }
  };

  const onCancelTimer = async (timerId) => {
    try {
      await cancelTimer({ timerId });
    } catch {
      setTimerState({ busy: false, message: "" });
    }
  };

  const onSaveLandingPage = async () => {
    if (!selectedBookId || !selectedBook) {
      return;
    }
    const clampedLandingPage = Math.max(
      1,
      Math.min(selectedBook.pageCount, Math.floor(landingPageInput || 1)),
    );
    try {
      await setBookLandingPage({
        bookId: selectedBookId,
        landingPage: clampedLandingPage,
      });
      setAppliedLandingPage(clampedLandingPage);
      setLandingPageInput(clampedLandingPage);
      setCurrentPage(clampedLandingPage);
      setRenderError("");
    } catch {
      setRenderError("Could not save landing page.");
    }
  };

  const onSaveThumbnailPage = async () => {
    if (!selectedBookId || !selectedBook) {
      return;
    }
    const clampedThumbnailPage = Math.max(
      1,
      Math.min(selectedBook.pageCount, Math.floor(thumbnailPageInput || 1)),
    );

    try {
      await setThumbnailPage({
        bookId: selectedBookId,
        page: clampedThumbnailPage,
      });
      setThumbnailPageInput(clampedThumbnailPage);
      setBookThumbnailMap((prev) => {
        if (!prev[selectedBookId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[selectedBookId];
        return next;
      });
      setRenderError("");
    } catch {
      setRenderError("Could not save thumbnail page.");
    }
  };

  const onRequestPage = async (page) => {
    if (!selectedBookId || !selectedBook) {
      return false;
    }

    const targetPage = Math.max(
      1,
      Math.min(selectedBook.pageCount, Math.floor(page || 1)),
    );
    if (targetPage <= maxReachable) {
      setCurrentPage(targetPage);
      setRenderError("");
      return true;
    }

    try {
      await unlockPageWithCredit({ bookId: selectedBookId, page: targetPage });
      setCurrentPage(targetPage);
      setRenderError("");
      return true;
    } catch {
      setRenderError("");
      return false;
    }
  };

  const onBuyMarketItem = async (itemId, itemType) => {
    setMarketMessage("");
    try {
      const result = await buyTheme({ themeId: itemId });

      if (result?.owned) {
        if (itemType === "feature") {
          setMarketMessage("Custom banner is already unlocked.");
        } else {
          setMarketMessage("Theme already owned.");
        }
        return;
      }

      if (itemType === "theme") {
        await selectTheme({ themeId: itemId, mode: selectedThemeMode });
        setMarketMessage("");
        return;
      }

      if (itemId === "custom-banner-upload") {
        setMarketMessage("Custom banner unlocked. Customizable in Settings.");
        return;
      }

      if (itemId === MECHANICAL_INTERACTION_FEATURE_ID) {
        setMarketMessage(
          "Mechanical Interaction Pack unlocked. Configure Pop Up or Sink Down in Settings.",
        );
        return;
      }

      setMarketMessage("Item purchased.");
    } catch {
      setMarketMessage("Purchase failed. Not enough Ink or invalid item.");
    }
  };

  const onBuyOfficialBook = async (officialBook) => {
    setMarketMessage("");
    try {
      const result = await buyOfficialBook({ bookId: officialBook.id });
      setMarketMessage(result?.owned ? "Already owned." : "Book purchased.");
    } catch {
      setMarketMessage("Purchase failed. Not enough Quills.");
    }
  };

  const onSelectTheme = async (themeId, mode = selectedThemeMode) => {
    setMarketMessage("");
    try {
      await selectTheme({ themeId, mode });
    } catch {
      setMarketMessage("Could not apply theme.");
    }
  };

  const onSelectAccentColors = async (color, colorSecondary) => {
    const accentColor = normalizeAccentColor(color);
    const accentColorSecondary = normalizeAccentColor(colorSecondary);
    try {
      await updateAccentColor({ accentColor, accentColorSecondary });
      setSettingsMessage("Accent colors updated.");
    } catch {
      setSettingsMessage("Could not update accent.");
    }
  };

  const onToggleMode = async () => {
    const nextMode = selectedThemeMode === "dark" ? "light" : "dark";
    await onSelectTheme(selectedThemeId, nextMode);
  };

  const onSelectInteractionMode = async (mode) => {
    const nextMode = normalizeInteractionMode(mode);

    if (nextMode !== "classic" && !hasMechanicalInteractionFeature) {
      setMarketMessage(
        "Unlock Mechanical Interaction Pack in Marketplace first.",
      );
      return;
    }

    try {
      await updateInteractionMode({ mode: nextMode });
    } catch {
      setMarketMessage("Could not update interaction behavior.");
    }
  };

  const launchInkBurst = (inkAmount, sourceElement) => {
    const amount = Math.max(1, Math.floor(inkAmount || 0));
    if (amount <= 0) {
      return;
    }

    const sourceRect = sourceElement?.getBoundingClientRect?.();
    const targetRect = document
      .querySelector('[data-ink-target="true"]')
      ?.getBoundingClientRect?.();

    const startX = sourceRect
      ? sourceRect.left + sourceRect.width / 2
      : window.innerWidth * 0.5;
    const startY = sourceRect
      ? sourceRect.top + sourceRect.height / 2
      : window.innerHeight * 0.72;
    const endX = targetRect
      ? targetRect.left + targetRect.width / 2
      : window.innerWidth * 0.78;
    const endY = targetRect ? targetRect.top + targetRect.height / 2 : 88;

    const id = `ink-burst-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setInkBursts((prev) => [
      ...prev,
      {
        id,
        amount,
        startX,
        startY,
        deltaX: endX - startX,
        deltaY: endY - startY,
      },
    ]);
  };

  const onClaim = async (timerId, sourceElement) => {
    const target = activeTimers.find((timer) => timer._id === timerId);
    if (
      !target ||
      target.canceledAt ||
      target.isPaused ||
      getTimerRemainingMs(target, now) > 0
    ) {
      setTimerState({ busy: false, message: "Could not claim reward yet." });
      return;
    }

    setTimerState({ busy: true, message: "" });
    try {
      const claimResult = await claimTimerReward({
        timerId,
        ...(selectedBookId ? { bookId: selectedBookId } : {}),
      });
      if (claimResult?.inkEarned) {
        launchInkBurst(claimResult.inkEarned, sourceElement);
      }
      setTimerState({
        busy: false,
        message: "Reward claimed.",
      });
    } catch {
      setTimerState({ busy: false, message: "Could not claim reward yet." });
    }
  };

  const onAddOfficialBook = async (officialBook) => {
    if (!officialBook.owned) {
      setUploadState({
        busy: false,
        message: "Buy first.",
      });
      return;
    }

    if (ownedTitles.has(officialBook.title.trim().toLowerCase())) {
      setUploadState({
        busy: false,
        message: "Official book already in your library.",
      });
      return;
    }

    setUploadState({ busy: true, message: "Importing official book..." });

    try {
      const officialAsset = getOfficialBookAsset(officialBook);
      const sourceUrl = officialAsset?.pdfUrl ?? officialBook.pdfUrl;
      const pageCount = Math.max(
        1,
        Math.floor(officialAsset?.pageCount ?? officialBook.pageCount ?? 1),
      );

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
    } catch {
      setUploadState({ busy: false, message: "Could not add official book." });
    }
  };

  const onCreateGroup = async (name, visibility) => {
    setGroupState({ busy: true, message: "" });
    try {
      const result = await createGroup({
        name,
        visibility,
      });
      setGroupState({
        busy: false,
        message:
          result?.visibility === "private" && result?.inviteCode
            ? `Private group created. Invite code: ${result.inviteCode}`
            : "Public group created.",
      });
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error ? error.message : "Could not create group.",
      });
    }
  };

  const onJoinPublicReadingGroup = async (groupId) => {
    setGroupState({ busy: true, message: "" });
    try {
      const result = await joinPublicGroup({ groupId });
      setGroupState({
        busy: false,
        message: result?.joined
          ? "Joined public group."
          : "You are already a member of this public group.",
      });
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not join public group.",
      });
    }
  };

  const onJoinPrivateReadingGroup = async (inviteCode) => {
    setGroupState({ busy: true, message: "" });
    try {
      const result = await joinPrivateGroup({ inviteCode });
      setGroupState({
        busy: false,
        message: result?.joined
          ? `Joined private group: ${result.groupName || "Group"}.`
          : "You are already a member of this private group.",
      });
    } catch {
      setGroupState({
        busy: false,
        message: "Unable to find group.",
      });
    }
  };

  const onLeaveReadingGroup = async (groupId) => {
    setGroupState({ busy: true, message: "" });
    try {
      const result = await leaveGroup({ groupId });
      setGroupState({
        busy: false,
        message: result?.left
          ? result?.disbanded
            ? "You left and the group was closed because it had no members left."
            : "You left the group."
          : "You are no longer a member of that group.",
      });
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error ? error.message : "Could not leave group.",
      });
    }
  };

  const onSendGroupChatMessage = async (groupId, body, options = {}) => {
    try {
      await sendGroupMessage({
        groupId,
        body,
        parentMessageId: options.parentMessageId,
        attachments: options.attachments,
      });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not send group message.",
      });
      return false;
    }
  };

  const onEditGroupChatMessage = async (messageId, body) => {
    try {
      await editGroupMessage({ messageId, body });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not update group message.",
      });
      return false;
    }
  };

  const onDeleteGroupChatMessage = async (messageId) => {
    try {
      await deleteGroupMessage({ messageId });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not delete group message.",
      });
      return false;
    }
  };

  const onMarkGroupChatMessagesRead = async (groupId, messageIds) => {
    try {
      await markGroupMessagesRead({ groupId, messageIds });
    } catch {
      // Read receipts are non-blocking for the chat stream.
    }
  };

  const onSetGroupTyping = async (groupId, isTyping) => {
    try {
      await setGroupTyping({ groupId, isTyping });
    } catch {
      // Typing indicators are non-blocking presence updates.
    }
  };

  const onUploadGroupAttachment = async (groupId, file) => {
    try {
      const uploadUrl = await generateGroupAttachmentUploadUrl({ groupId });
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await uploadResponse.json();
      const mimeType = file.type || "application/octet-stream";
      return {
        storageId,
        name: file.name || "attachment",
        mimeType,
        size: file.size || 0,
        kind: mimeType.startsWith("image/")
          ? "image"
          : mimeType.startsWith("video/")
            ? "video"
            : "document",
      };
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not upload attachment.",
      });
      return null;
    }
  };

  const onUpdateGroupDetails = async (groupId, updates) => {
    setGroupState({ busy: true, message: "" });
    try {
      await updateGroupMetadata({ groupId, ...updates });
      setGroupState({ busy: false, message: "Group updated." });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error ? error.message : "Could not update group.",
      });
      return false;
    }
  };

  const onSetGroupMemberRole = async (groupId, targetUserId, role) => {
    setGroupState({ busy: true, message: "" });
    try {
      await setGroupMemberRole({ groupId, targetUserId, role });
      setGroupState({ busy: false, message: "Member updated." });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error ? error.message : "Could not update member.",
      });
      return false;
    }
  };

  const onMuteGroupMember = async (groupId, targetUserId, mutedUntil) => {
    setGroupState({ busy: true, message: "" });
    try {
      await muteGroupMember({ groupId, targetUserId, mutedUntil });
      setGroupState({ busy: false, message: "Member updated." });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error ? error.message : "Could not mute member.",
      });
      return false;
    }
  };

  const onBanGroupMember = async (groupId, targetUserId) => {
    setGroupState({ busy: true, message: "" });
    try {
      await banGroupMember({ groupId, targetUserId });
      setGroupState({ busy: false, message: "Member removed." });
      return true;
    } catch (error) {
      setGroupState({
        busy: false,
        message:
          error instanceof Error ? error.message : "Could not remove member.",
      });
      return false;
    }
  };

  const onUploadCustomBanner = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!hasCustomBannerFeature) {
      setBannerUploadState({
        busy: false,
        message: "Unlock this feature in Marketplace first.",
      });
      event.target.value = "";
      return;
    }

    if (file.type !== "image/png") {
      setBannerUploadState({
        busy: false,
        message: "Only PNG files are supported for this banner.",
      });
      event.target.value = "";
      return;
    }

    setBannerUploadState({ busy: true, message: "" });

    try {
      const uploadUrl = await generateBannerUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await uploadResponse.json();
      await setCustomBanner({ storageId });
      setBannerUploadState({
        busy: false,
        message: "Custom banner updated.",
      });
    } catch {
      setBannerUploadState({
        busy: false,
        message: "Could not upload custom banner.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const onClearCustomBanner = async () => {
    if (!hasCustomBannerFeature) {
      setBannerUploadState({
        busy: false,
        message: "Unlock this feature in Marketplace first.",
      });
      return;
    }

    setBannerUploadState({ busy: true, message: "" });
    try {
      await setCustomBanner({});
      setBannerUploadState({
        busy: false,
        message: "Custom banner removed.",
      });
    } catch {
      setBannerUploadState({
        busy: false,
        message: "Could not remove custom banner.",
      });
    }
  };

  const onUploadUserIcon = async (eventOrFile) => {
    const inputTarget = eventOrFile?.target;
    const sourceFile =
      eventOrFile instanceof File ? eventOrFile : inputTarget?.files?.[0];
    if (!sourceFile) {
      return;
    }

    if (!String(sourceFile.type || "").startsWith("image/")) {
      setUserIconState({ busy: false, message: "Image only." });
      if (inputTarget) {
        inputTarget.value = "";
      }
      return;
    }

    if (sourceFile.size > 10 * 1024 * 1024) {
      setUserIconState({ busy: false, message: "10MB max." });
      if (inputTarget) {
        inputTarget.value = "";
      }
      return;
    }

    setUserIconState({ busy: true, message: "" });

    try {
      const file = await convertImageFileToPng(sourceFile);
      const uploadUrl = await generateUserIconUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await uploadResponse.json();
      await setUserIcon({ storageId });
      setUserIconState({ busy: false, message: "Icon updated." });
    } catch {
      setUserIconState({ busy: false, message: "Upload failed." });
    } finally {
      if (inputTarget) {
        inputTarget.value = "";
      }
    }
  };

  const onSelectUserIconStorageId = async (storageId) => {
    if (!storageId) {
      return;
    }
    setUserIconState({ busy: true, message: "" });
    try {
      await setUserIcon({ storageId });
      setUserIconState({ busy: false, message: "Icon updated." });
    } catch {
      setUserIconState({ busy: false, message: "Update failed." });
    }
  };

  const onSelectUserIconPreset = async (preset) => {
    setUserIconState({ busy: true, message: "" });
    try {
      await selectUserIconPreset({ preset });
      setUserIconState({ busy: false, message: "Icon updated." });
    } catch {
      setUserIconState({ busy: false, message: "Update failed." });
    }
  };

  const onBannerPositionXChange = (value) => {
    setBannerPositionXInput(
      normalizeBannerPosition(value, DEFAULT_BANNER_POSITION_X),
    );
  };

  const onBannerPositionYChange = (value) => {
    setBannerPositionYInput(
      normalizeBannerPosition(value, DEFAULT_BANNER_POSITION_Y),
    );
  };

  const onBannerOpacityChange = (value) => {
    setBannerOpacityInput(normalizeBannerOpacity(value));
  };

  const onBannerScaleChange = (value) => {
    setBannerScaleInput(normalizeBannerScale(value));
  };

  const onStartTutorial = () => {
    setIsSupportOpen(false);
    setIsSettingsOpen(false);
    setIsProfileOpen(false);
    setTutorialStepIndex(0);
    setIsTutorialOpen(true);
  };

  const onBackTutorialStep = () => {
    setTutorialStepIndex((prev) => Math.max(0, prev - 1));
  };

  const onNextTutorialStep = () => {
    setTutorialStepIndex((prev) =>
      Math.min(dashboardTutorialSteps.length - 1, prev + 1),
    );
  };

  const onCloseTutorial = () => {
    if (tutorialScope) {
      markTutorialCompleted(tutorialScope);
    }
    setIsTutorialOpen(false);
  };

  const onCompleteTutorial = () => {
    if (tutorialScope) {
      markTutorialCompleted(tutorialScope);
    }
    setIsTutorialOpen(false);
    setMarketMessage("Tutorial complete. You are ready to unlock pages.");
  };

  const onRenameWorkspaceName = async (nextName) => {
    const safeName = String(nextName || "").trim() || DEFAULT_WORKSPACE_NAME;
    setWorkspaceName(safeName);
    writeWorkspaceName(workspaceScope, safeName);

    if (!me?._id) {
      return;
    }

    try {
      await setDisplayName({ name: safeName });
    } catch {
      // Keep local display name even if remote profile update fails.
    }
  };

  const onOpenReadingTab = (bookId) => {
    if (!bookId) {
      return;
    }

    setLastDashboardSection(activeSection);
    readerScrollPendingIdsRef.current.add(bookId);
    setSelectedBookId(bookId);
    setActiveSection("library");
    setOpenReadingTabIds((prev) =>
      prev.includes(bookId) ? prev : [...prev, bookId],
    );
    setActiveReadingTabId(bookId);
  };

  const onSelectReadingTab = (bookId) => {
    if (!bookId) {
      return;
    }

    setSelectedBookId(bookId);
    setActiveSection("library");
    setActiveReadingTabId(bookId);
  };

  const onSelectDashboardTab = () => {
    setActiveReadingTabId(DASHBOARD_READING_TAB_ID);
    setActiveSection(lastDashboardSection || "dashboard");
  };

  const onCloseReadingTab = (bookId) => {
    if (!bookId) {
      return;
    }

    const remainingTabs = openReadingTabIds.filter((id) => id !== bookId);
    setOpenReadingTabIds(remainingTabs);

    if (activeReadingTabId !== bookId) {
      return;
    }

    const fallbackTabId = remainingTabs[remainingTabs.length - 1] || "";
    const nextActiveTabId = fallbackTabId || DASHBOARD_READING_TAB_ID;
    setActiveReadingTabId(nextActiveTabId);

    if (fallbackTabId) {
      setSelectedBookId(fallbackTabId);
      setActiveSection("library");
      return;
    }

    setActiveSection(lastDashboardSection || "dashboard");
  };

  const onResizeDashboardSidebar = (nextWidth) => {
    const clampedWidth = clampNumber(
      nextWidth,
      MIN_DASHBOARD_SIDEBAR_WIDTH,
      MAX_DASHBOARD_SIDEBAR_WIDTH,
    );
    setDashboardSidebarWidth(clampedWidth);
    writeDashboardSidebarWidth(clampedWidth);
  };

  const onOpenCalendarDate = (date) => {
    const targetDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(targetDate.getTime())) {
      return;
    }
    setCalendarFocusRequest({
      id: targetDate.getTime(),
      date: targetDate.toISOString(),
    });
    setActiveReadingTabId(DASHBOARD_READING_TAB_ID);
    setActiveSection("calendar");
  };

  const isWorkspaceLoading = isWorkspaceDataLoading;

  if (isWorkspaceLoading) {
    return (
      <main
        className={`dashboard-shell theme-${selectedThemeId} mode-${selectedThemeMode}${readerMechanicalClassName}`}
        style={accentStyle}
      >
        <section className="center-card dashboard-loading-card">
          <p>Checking your session...</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`dashboard-shell theme-${selectedThemeId} mode-${selectedThemeMode}${readerMechanicalClassName}${isReaderTabView ? " reader-tab-shell" : ""}`}
      style={{
        ...accentStyle,
        "--dashboard-sidebar-width": `${dashboardSidebarWidth}px`,
      }}
    >
      <DashboardMetaStrip
        inkBalance={inkBalance}
        pageCredits={pageCredits}
        quillsBalance={quillsBalance}
        streak={streak}
        mode={selectedThemeMode}
        onToggleMode={() => void onToggleMode()}
        selectedThemeId={selectedThemeId}
        selectedThemeMode={selectedThemeMode}
        displayName={
          workspaceName || me?.name || me?.email || "Signed-in reader"
        }
        onRenameDisplayName={(nextName) => void onRenameWorkspaceName(nextName)}
        userIconUrl={userIconUrl}
        userIconPreset={userIconPreset}
        dashboardTabId={DASHBOARD_READING_TAB_ID}
        readingTabs={readingTabs}
        activeReadingTabId={activeReadingTabId}
        onSelectDashboardTab={onSelectDashboardTab}
        onSelectReadingTab={onSelectReadingTab}
        onCloseReadingTab={onCloseReadingTab}
        onOpenPremium={() => {
          setIsSettingsOpen(false);
          setIsProfileOpen(false);
          setIsSupportOpen(false);
          setIsBillingOpen(true);
        }}
        onOpenSupport={() => {
          setIsSettingsOpen(false);
          setIsProfileOpen(false);
          setIsSupportOpen(true);
        }}
        onOpenSettings={() => {
          setIsAvatarPickerOpen(false);
          setIsProfileOpen(false);
          setIsSupportOpen(false);
          setIsSettingsOpen(true);
        }}
        onOpenProfile={() => {
          setIsSettingsOpen(false);
          setIsAvatarPickerOpen(false);
          setIsSupportOpen(false);
          setIsProfileOpen(true);
        }}
        onOpenAvatarPicker={() => {
          setIsSettingsOpen(false);
          setIsProfileOpen(false);
          setIsSupportOpen(false);
          setIsAvatarPickerOpen(true);
        }}
        onSignOut={() => void signOut()}
      />

      {!isReaderTabView && (
        <DashboardSidebar
          activeSection={activeSection}
          onSelectSection={(nextSection) => {
            setActiveSection(nextSection);
            if (nextSection !== "library") {
              setActiveReadingTabId(DASHBOARD_READING_TAB_ID);
            }
          }}
          onOpenSupport={() => {
            setIsSettingsOpen(false);
            setIsAvatarPickerOpen(false);
            setIsProfileOpen(false);
            setIsSupportOpen(true);
          }}
          onOpenSettings={() => {
            setIsAvatarPickerOpen(false);
            setIsProfileOpen(false);
            setIsSupportOpen(false);
            setIsSettingsOpen(true);
          }}
          onSignOut={() => void signOut()}
          sidebarWidth={dashboardSidebarWidth}
          onResizeSidebar={onResizeDashboardSidebar}
        />
      )}

      <section
        className={`dash-main${isReaderTabView ? " reader-tab-main" : ""}`}
      >
        {!isReaderTabView && (
          <DashboardTopbar
            customBannerUrl={customBannerUrl}
            customBannerPositionX={bannerPositionXInput}
            customBannerPositionY={bannerPositionYInput}
            customBannerOpacity={bannerOpacityInput}
            customBannerScale={bannerScaleInput}
          />
        )}

        {!isReaderTabView && (
          <InkFlyLayer
            bursts={inkBursts}
            onDone={(id) =>
              setInkBursts((prev) => prev.filter((burst) => burst.id !== id))
            }
          />
        )}

        {activeSection === "timers" && (
          <TimersSection
            timerLabel={timerLabel}
            setTimerLabel={setTimerLabel}
            durationMinutes={durationMinutes}
            setDurationMinutes={setDurationMinutes}
            onCreateTimer={onCreateTimer}
            timerState={timerState}
            minutesPerPageInput={minutesPerPageInput}
            setMinutesPerPageInput={setMinutesPerPageInput}
            onSavePreferences={(nextDailyQuota) =>
              void onSavePreferences(nextDailyQuota)
            }
            settingsMessage={settingsMessage}
            activeTimers={activeTimers}
            now={now}
            formatRemaining={formatRemaining}
            onPauseOrResume={(timerId) => void onPauseOrResume(timerId)}
            onCancelTimer={(timerId) => void onCancelTimer(timerId)}
            onClaim={(timerId, sourceElement) =>
              void onClaim(timerId, sourceElement)
            }
            selectedBookId={selectedBookId}
            showTutorialClaimPlaceholder={isTutorialOpen}
          />
        )}

        {activeSection === "dashboard" && (
          <DashboardSection
            progressBooks={progressBooks}
            weekly={weekly}
            dailyActivity={dailyActivity}
            timerSessions={timerSessionsEver}
            timerSessions24h={timerSessions24h}
            totalUnlockedPagesEver={totalUnlockedPagesEver}
            totalSessionSecondsEver={overview?.totalSessionSecondsEver ?? 0}
            continueReadingBook={continueReadingBook}
            bookThumbnailMap={bookThumbnailMap}
            onContinueReading={onOpenReadingTab}
            onAddBook={() => setActiveSection("library")}
            onOpenCalendarDate={onOpenCalendarDate}
            themeId={selectedThemeId}
            themeMode={selectedThemeMode}
            accentColor={selectedAccentColor}
          />
        )}

        {activeSection === "library" && (
          <LibrarySection
            uploadState={uploadState}
            onUploadBook={onUploadBook}
            uploadAccept={SUPPORTED_UPLOAD_ACCEPT}
            localBookCount={localBookCount}
            localBookLimit={LOCAL_BOOK_UPLOAD_LIMIT}
            bookList={bookList}
            onOpenOfficialMarketplace={() => {
              setMarketInitialView("books");
              setActiveSection("market");
            }}
            selectedBookId={selectedBookId}
            setSelectedBookId={setSelectedBookId}
            onRemoveBook={(bookId) => void onRemoveBook(bookId)}
            officialBooksWithState={officialBooksInLibrary}
            onAddOfficialBook={(book) => void onAddOfficialBook(book)}
            selectedBook={selectedBook}
            landingPageInput={landingPageInput}
            setLandingPageInput={setLandingPageInput}
            onSaveLandingPage={() => void onSaveLandingPage()}
            thumbnailPageInput={thumbnailPageInput}
            setThumbnailPageInput={setThumbnailPageInput}
            onSaveThumbnailPage={() => void onSaveThumbnailPage()}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onRequestPage={(page) => onRequestPage(page)}
            pageCredits={pageCredits}
            maxReachable={maxReachable}
            pageCount={pageCount}
            landingPage={landingPage}
            unlockedPages={unlockedPages}
            bookThumbnailMap={bookThumbnailMap}
            isRendering={isRendering}
            renderError={renderError}
            canvasRef={canvasRef}
            isLandscapePage={isCurrentPageLandscape}
            selectedBookFileType={selectedBookFileType}
            selectedBookFileUrl={selectedBookFileUrl}
            usesPageNavigation={usesPageNavigation}
            altViewerLoading={altViewerState.loading}
            altViewerError={altViewerState.error}
            epubContainerRef={epubContainerRef}
            cbzImageUrl={cbzCurrentImageUrl}
            onOpenReadingTab={onOpenReadingTab}
            onCloseReadingTab={onCloseReadingTab}
            activeReadingTabId={activeReadingTabId}
            isReaderExpanded={isReaderExpanded}
            readerLoading={
              isReaderTabView &&
              (isReaderDocumentLoading || altViewerState.loading || isRendering)
            }
            readerLoadingProgress={
              isReaderDocumentLoading
                ? readerDocumentLoadingProgress
                : altViewerState.loading
                  ? 12
                  : 100
            }
            readerOnlyMode={isReaderTabView}
          />
        )}

        {activeSection === "calendar" && (
          <CalendarSection
            timerSessions={timerSessionsEver}
            timerSessions24h={timerSessions24h}
            focusRequest={calendarFocusRequest}
          />
        )}

        {activeSection === "market" && (
          <MarketSection
            marketMessage={marketMessage}
            market={market}
            selectedThemeId={selectedThemeId}
            selectedThemeMode={selectedThemeMode}
            onBuyTheme={(itemId, itemType) =>
              void onBuyMarketItem(itemId, itemType)
            }
            onBuyOfficialBook={(book) => void onBuyOfficialBook(book)}
            onOpenSettings={() => {
              setIsProfileOpen(false);
              setIsSupportOpen(false);
              setIsSettingsOpen(true);
            }}
            officialBooksWithState={officialBooksWithState}
            officialBookThumbnailMap={officialBookThumbnailMap}
            uploadState={uploadState}
            onAddOfficialBook={(book) => void onAddOfficialBook(book)}
            initialView={marketInitialView}
          />
        )}

        {activeSection === "groups" && (
          <GroupsSection
            myGroups={myGroups}
            publicGroups={publicGroups}
            monthLabel={groupsMonthLabel}
            groupState={groupState}
            isLoading={groupsOverview === undefined}
            onCreateGroup={onCreateGroup}
            onJoinPublicGroup={onJoinPublicReadingGroup}
            onJoinPrivateGroup={onJoinPrivateReadingGroup}
            onLeaveGroup={onLeaveReadingGroup}
            selectedGroupId={selectedGroupId}
            onSelectGroupId={setSelectedGroupId}
            selectedGroupRoom={selectedGroupRoom ?? null}
            isGroupRoomLoading={isGroupRoomLoading}
            onSendGroupMessage={onSendGroupChatMessage}
            onEditGroupMessage={onEditGroupChatMessage}
            onDeleteGroupMessage={onDeleteGroupChatMessage}
            onMarkGroupMessagesRead={onMarkGroupChatMessagesRead}
            onSetGroupTyping={onSetGroupTyping}
            onUploadGroupAttachment={onUploadGroupAttachment}
            onUpdateGroupMetadata={onUpdateGroupDetails}
            onSetGroupMemberRole={onSetGroupMemberRole}
            onMuteGroupMember={onMuteGroupMember}
            onBanGroupMember={onBanGroupMember}
            themeId={selectedThemeId}
            themeMode={selectedThemeMode}
            accentColor={selectedAccentColor}
          />
        )}

        {isSettingsOpen && (
          <SettingsSection
            themeOptions={themeOptions}
            selectedThemeId={selectedThemeId}
            selectedThemeMode={selectedThemeMode}
            selectedAccentColor={selectedAccentColor}
            selectedAccentColorSecondary={selectedAccentColorSecondary}
            onApplyAccentColors={(color, colorSecondary) =>
              void onSelectAccentColors(color, colorSecondary)
            }
            dailyQuotaInput={dailyQuotaInput}
            setDailyQuotaInput={setDailyQuotaInput}
            selectedLanguage={selectedLanguage}
            onSelectLanguage={(language) => void onSelectLanguage(language)}
            onSavePreferences={() => void onSavePreferences()}
            settingsMessage={settingsMessage}
            userIconUrl={userIconUrl}
            userIconPreset={userIconPreset}
            userIconState={userIconState}
            onUploadUserIcon={(event) => void onUploadUserIcon(event)}
            onSelectUserIconPreset={(preset) =>
              void onSelectUserIconPreset(preset)
            }
            hasMechanicalInteractionFeature={hasMechanicalInteractionFeature}
            selectedInteractionMode={selectedInteractionMode}
            onApplyInteractionMode={(mode) =>
              void onSelectInteractionMode(mode)
            }
            hasCustomBannerFeature={hasCustomBannerFeature}
            customBannerUrl={customBannerUrl}
            bannerUploadState={bannerUploadState}
            bannerPositionX={bannerPositionXInput}
            bannerPositionY={bannerPositionYInput}
            bannerOpacity={bannerOpacityInput}
            bannerScale={bannerScaleInput}
            onChangeBannerPositionX={onBannerPositionXChange}
            onChangeBannerPositionY={onBannerPositionYChange}
            onChangeBannerOpacity={onBannerOpacityChange}
            onChangeBannerScale={onBannerScaleChange}
            onUploadCustomBanner={(event) => void onUploadCustomBanner(event)}
            onClearCustomBanner={() => void onClearCustomBanner()}
            onOpenMarketplace={() => setActiveSection("market")}
            onApplyThemeChoice={(themeId, mode) =>
              void onSelectTheme(themeId, mode)
            }
            onClose={() => setIsSettingsOpen(false)}
          />
        )}

        {isAvatarPickerOpen && (
          <AvatarPickerOverlay
            userIconUrl={userIconUrl}
            userIconStorageId={userIconStorageId}
            recentUserIcons={recentUserIcons}
            userIconPreset={userIconPreset}
            userIconState={userIconState}
            onUploadUserIcon={(event) => void onUploadUserIcon(event)}
            onSelectUserIconStorageId={(storageId) =>
              void onSelectUserIconStorageId(storageId)
            }
            onSelectUserIconPreset={(preset) =>
              void onSelectUserIconPreset(preset)
            }
            onClose={() => setIsAvatarPickerOpen(false)}
          />
        )}

        {isSupportOpen && (
          <SupportOverlay
            language={selectedLanguage}
            onClose={() => setIsSupportOpen(false)}
            onStartTutorial={onStartTutorial}
          />
        )}

        {isFaqOpen && (
          <FaqOverlay
            language={selectedLanguage}
            onClose={() => {
              if (tutorialScope) {
                markFaqCompleted(tutorialScope);
              }
              setIsFaqOpen(false);
            }}
          />
        )}

        {isProfileOpen && (
          <ProfileSection
            me={me}
            onClose={() => setIsProfileOpen(false)}
            onSignOut={() => void signOut()}
          />
        )}

        {isBillingOpen && (
          <BillingOverlay onClose={() => setIsBillingOpen(false)} />
        )}

        {isTutorialOpen && (
          <TutorialOverlay
            steps={dashboardTutorialSteps}
            stepIndex={tutorialStepIndex}
            labels={tutorialLabels}
            onBack={onBackTutorialStep}
            onNext={onNextTutorialStep}
            onComplete={onCompleteTutorial}
            onSkip={onCloseTutorial}
          />
        )}

        <AdPlaceholderPopup
          isOpen={readerAdPopup.isOpen}
          secondsLeft={readerAdPopup.secondsLeft}
          timerLabel={readerAdPopup.timerLabel}
        />
      </section>
    </main>
  );
}

export default App;
