import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatGoogleCalendarErrorDetails } from "./googleCalendarDiagnostics";

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_CONNECTION_STORAGE_KEY = "inkling:google-calendar:connected:v1";
const CALENDAR_TOKEN_STORAGE_KEY = "inkling:google-calendar:token:v1";
const CALENDAR_AUTO_SYNC_INTERVAL_MS = 60 * 1000;
const CALENDAR_MIN_EVENT_DURATION_MS = 60 * 1000;

const CALENDAR_WEEK_HEADERS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

let googleClientLoaderPromise = null;
let calendarAccessToken = "";
let calendarAccessTokenExpiresAt = 0;

function readCalendarTokenCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CALENDAR_TOKEN_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const token = String(parsed?.token || "").trim();
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!token || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
      return null;
    }

    return { token, expiresAt };
  } catch {
    return null;
  }
}

function writeCalendarTokenCache(token, expiresAt) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CALENDAR_TOKEN_STORAGE_KEY,
      JSON.stringify({ token, expiresAt }),
    );
  } catch {
    // Ignore storage failures in private/blocked contexts.
  }
}

function clearCalendarTokenCache() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(CALENDAR_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures in private/blocked contexts.
  }
}

function loadExternalScript(src) {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Calendar only works in the browser."),
    );
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      if (src === GOOGLE_GSI_SRC && window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function setCalendarAccessToken(token, expiresAt = 0) {
  calendarAccessToken = String(token || "").trim();
  calendarAccessTokenExpiresAt = Number(expiresAt || 0);

  if (calendarAccessToken && Date.now() < calendarAccessTokenExpiresAt) {
    writeCalendarTokenCache(calendarAccessToken, calendarAccessTokenExpiresAt);
    return;
  }

  clearCalendarTokenCache();
}

function clearCalendarAccessToken() {
  setCalendarAccessToken("", 0);
}

function hasUsableCalendarAccessToken() {
  return (
    Boolean(calendarAccessToken) && Date.now() < calendarAccessTokenExpiresAt
  );
}

function hydrateCalendarAccessTokenFromStorage() {
  if (hasUsableCalendarAccessToken()) {
    return true;
  }

  const cached = readCalendarTokenCache();
  if (!cached) {
    return false;
  }

  setCalendarAccessToken(cached.token, cached.expiresAt);
  return hasUsableCalendarAccessToken();
}

async function ensureGoogleCalendarClient({ clientId }) {
  if (!clientId) {
    throw new Error("Google Calendar client ID is missing.");
  }

  if (googleClientLoaderPromise) {
    await googleClientLoaderPromise;
    return;
  }

  googleClientLoaderPromise = (async () => {
    await loadExternalScript(GOOGLE_GSI_SRC);
    if (!window.google?.accounts?.oauth2?.initTokenClient) {
      throw new Error("Google Identity Services is unavailable.");
    }
  })();

  try {
    await googleClientLoaderPromise;
  } catch (error) {
    googleClientLoaderPromise = null;
    throw error;
  }
}

function requestCalendarAccessToken(clientId, prompt = "") {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2?.initTokenClient) {
      reject(new Error("Google Identity Services is unavailable."));
      return;
    }

    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response) => {
        if (!response || response.error) {
          reject(
            new Error(response?.error || "Google access token was denied."),
          );
          return;
        }

        const accessToken = String(response.access_token || "").trim();
        if (!accessToken) {
          reject(new Error("Google access token response was empty."));
          return;
        }

        const expiresInSeconds = Math.max(0, Number(response.expires_in || 0));
        const refreshSkewSeconds = 30;
        const expiresAt =
          Date.now() +
          Math.max(0, expiresInSeconds - refreshSkewSeconds) * 1000;
        setCalendarAccessToken(accessToken, expiresAt);
        resolve(accessToken);
      },
    });

    tokenClient.requestAccessToken({ prompt });
  });
}

async function ensureCalendarAccessToken(
  clientId,
  { forceConsent = false } = {},
) {
  if (!forceConsent && hasUsableCalendarAccessToken()) {
    return calendarAccessToken;
  }

  if (!forceConsent && hydrateCalendarAccessTokenFromStorage()) {
    return calendarAccessToken;
  }

  return requestCalendarAccessToken(clientId, forceConsent ? "consent" : "");
}

function createCalendarApiUrl(path, query = {}) {
  const url = new URL(`https://www.googleapis.com/calendar/v3${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function requestGoogleCalendar({
  accessToken,
  path,
  method = "GET",
  query,
  body,
}) {
  const url = createCalendarApiUrl(path, query);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `Google Calendar request failed with status ${response.status}.`;
    const requestError = new Error(message);
    requestError.result = payload;
    requestError.status = response.status;
    throw requestError;
  }

  return payload || {};
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseEventDayKey(event) {
  const value = event?.start?.dateTime || event?.start?.date || "";
  return String(value).slice(0, 10);
}

function createMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstWeekday;
    const dayNumber = offset + 1;

    if (dayNumber < 1) {
      return {
        date: new Date(year, month - 1, daysInPreviousMonth + dayNumber),
        inCurrentMonth: false,
      };
    }

    if (dayNumber > daysInMonth) {
      return {
        date: new Date(year, month + 1, dayNumber - daysInMonth),
        inCurrentMonth: false,
      };
    }

    return {
      date: new Date(year, month, dayNumber),
      inCurrentMonth: true,
    };
  });
}

function formatMonthLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatSyncTimestamp(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function buildGoogleCalendarDayUrl(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `https://calendar.google.com/calendar/u/0/r/day/${year}/${month}/${day}`;
}

function formatTimeframeLabel(start, end) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(start)}-${formatter.format(end)}`;
}

function formatDurationLabel(durationMs) {
  const totalMinutes = Math.max(1, Math.round(durationMs / (60 * 1000)));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

function buildTimerSessionCalendarDrafts(timerSessions24h, targetDate) {
  const dayKey = toDayKey(targetDate);
  if (!Array.isArray(timerSessions24h)) {
    return [];
  }

  const drafts = [];
  for (const row of timerSessions24h) {
    const startAt = Number(row?.startAt || 0);
    const endAt = Number(row?.endAt || 0);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      continue;
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (toDayKey(start) !== dayKey && toDayKey(end) !== dayKey) {
      continue;
    }

    const timerLabel = String(row?.timerLabel || "").trim() || "Reading session";
    const durationMs = endAt - startAt;
    const timerId = String(row?.timerId || "");
    drafts.push({
      eventKey:
        String(row?.eventKey || "").trim() ||
        `${timerId || "timer"}:${startAt}:${endAt}`,
      timerId,
      timerLabels: [timerLabel],
      timeframeLabel: formatTimeframeLabel(start, end),
      durationMs,
      durationLabel: formatDurationLabel(durationMs),
      startedBy: String(row?.startedBy || "started").toLowerCase(),
      endedBy: String(row?.endedBy || "paused").toLowerCase(),
      start,
      end,
    });
  }

  return drafts.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function readCalendarConnectionPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(CALENDAR_CONNECTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCalendarConnectionPreference(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CALENDAR_CONNECTION_STORAGE_KEY,
      value ? "1" : "0",
    );
  } catch {
    // Ignore storage failures in private/blocked contexts.
  }
}

function normalizeTimerLabels(timerLabels) {
  if (!Array.isArray(timerLabels)) {
    return [];
  }

  return timerLabels.map((label) => String(label || "").trim()).filter(Boolean);
}

function formatTimerLabelLine(timerLabels) {
  const labels = normalizeTimerLabels(timerLabels);
  if (!labels.length) {
    return "Timer label: Reading session";
  }
  if (labels.length === 1) {
    return `Timer label: ${labels[0]}`;
  }

  const visible = labels.slice(0, 2);
  const suffix =
    labels.length > visible.length ? ` +${labels.length - visible.length}` : "";
  return `Timer labels: ${visible.join(", ")}${suffix}`;
}

function formatTimerLabelForHeading(timerLabels) {
  const labels = normalizeTimerLabels(timerLabels);
  if (!labels.length) {
    return "Reading Session";
  }
  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]} +${labels.length - 1}`;
}

function normalizePageNumber(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function compactStatusMessage(value, maxLength = 180) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export default function DataDashboardPanel({
  progressBooks,
  dailyActivity,
  timerSessions24h,
  totalUnlocked,
  heading = "Dashboard Snapshot",
  continueReadingBook,
  onContinueReading,
  calendarLocked = false,
  calendarLockedReason = "",
}) {
  const isCalendarLocked = Boolean(calendarLocked);
  const calendarLockMessage =
    String(calendarLockedReason || "").trim() ||
    "Google Calendar sync requires a signed-in account.";
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleCalendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID || "primary";
  const hasGoogleSetup = Boolean(googleClientId);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarState, setCalendarState] = useState({
    connected: false,
    busy: false,
    message: "",
    lastSyncedAt: "",
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() =>
    readCalendarConnectionPreference(),
  );
  const autoConnectAttemptedRef = useRef(false);
  const autoSyncInFlightRef = useRef(false);

  const favoriteBook = useMemo(() => {
    if (!progressBooks.length) {
      return null;
    }
    return [...progressBooks].sort((a, b) => {
      const aValue = Math.max(0, Number(a.unlockedPages || 0));
      const bValue = Math.max(0, Number(b.unlockedPages || 0));
      return bValue - aValue;
    })[0];
  }, [progressBooks]);

  const activitySummary = useMemo(
    () =>
      dailyActivity.reduce(
        (summary, row) => {
          summary.started += Math.max(0, Number(row.started || 0));
          summary.paused += Math.max(0, Number(row.paused || 0));
          summary.removed += Math.max(0, Number(row.removed || 0));
          summary.completed += Math.max(0, Number(row.completed || 0));
          summary.pagesUnlocked += Math.max(0, Number(row.pagesUnlocked || 0));
          return summary;
        },
        { started: 0, paused: 0, removed: 0, completed: 0, pagesUnlocked: 0 },
      ),
    [dailyActivity],
  );

  const totalTimerEvents =
    activitySummary.started +
    activitySummary.paused +
    activitySummary.removed +
    activitySummary.completed;

  const timerSessionDrafts = useMemo(
    () => buildTimerSessionCalendarDrafts(timerSessions24h, new Date()),
    [timerSessions24h],
  );
  const syncableTimerSessionDrafts = useMemo(
    () =>
      timerSessionDrafts.filter(
        (draft) => draft.durationMs >= CALENDAR_MIN_EVENT_DURATION_MS,
      ),
    [timerSessionDrafts],
  );
  const showContinueCard = continueReadingBook !== undefined;
  const continueBook = continueReadingBook || null;
  const continuePageCount = normalizePageNumber(continueBook?.pageCount, 1);
  const continueLastReadPage = Math.min(
    continuePageCount,
    normalizePageNumber(
      continueBook?.lastReadPage ?? continueBook?.landingPage,
      1,
    ),
  );
  const continueUnlockedPages = Math.max(
    0,
    Number(continueBook?.unlockedPages || 0),
  );
  const continueProgressPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (continueUnlockedPages / Math.max(1, continuePageCount)) * 100,
      ),
    ),
  );

  const monthGrid = useMemo(
    () => createMonthGrid(calendarMonth),
    [calendarMonth],
  );

  const eventCountByDay = useMemo(() => {
    const map = new Map();
    for (const item of calendarEvents) {
      const key = parseEventDayKey(item);
      if (!key) {
        continue;
      }
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [calendarEvents]);

  const loadMonthEvents = useCallback(
    async (targetMonth, tokenOverride = "") => {
      const accessToken =
        tokenOverride ||
        (hasUsableCalendarAccessToken()
          ? calendarAccessToken
          : await ensureCalendarAccessToken(googleClientId));

      const monthStart = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth(),
        1,
        0,
        0,
        0,
        0,
      );
      const monthEnd = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth() + 1,
        1,
        0,
        0,
        0,
        0,
      );

      const response = await requestGoogleCalendar({
        accessToken,
        path: `/calendars/${encodeURIComponent(googleCalendarId)}/events`,
        query: {
          singleEvents: true,
          showDeleted: false,
          maxResults: 2500,
          orderBy: "startTime",
          timeMin: monthStart.toISOString(),
          timeMax: monthEnd.toISOString(),
        },
      });

      setCalendarEvents(Array.isArray(response.items) ? response.items : []);
    },
    [googleCalendarId, googleClientId],
  );

  useEffect(() => {
    if (!calendarState.connected || !hasGoogleSetup || isCalendarLocked) {
      return;
    }

    let cancelled = false;

    const refreshMonth = async () => {
      try {
        await loadMonthEvents(calendarMonth);
      } catch (error) {
        if (cancelled) {
          return;
        }
        clearCalendarAccessToken();
        const detailedMessage = formatGoogleCalendarErrorDetails(error, {
          origin: typeof window !== "undefined" ? window.location.origin : "",
          calendarId: googleCalendarId,
        });
        setCalendarState((prev) => ({
          ...prev,
          connected: false,
          message: detailedMessage,
        }));
      }
    };

    void refreshMonth();
    return () => {
      cancelled = true;
    };
  }, [
    calendarMonth,
    calendarState.connected,
    googleCalendarId,
    hasGoogleSetup,
    isCalendarLocked,
    loadMonthEvents,
  ]);

  useEffect(() => {
    if (
      !hasGoogleSetup ||
      isCalendarLocked ||
      !autoSyncEnabled ||
      autoConnectAttemptedRef.current
    ) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    let cancelled = false;

    const autoConnect = async () => {
      try {
        await ensureGoogleCalendarClient({
          clientId: googleClientId,
        });

        const accessToken = await ensureCalendarAccessToken(googleClientId);
        if (cancelled) {
          return;
        }

        await loadMonthEvents(calendarMonth, accessToken);
        if (cancelled) {
          return;
        }

        setCalendarState((prev) => ({
          ...prev,
          connected: true,
          busy: false,
          message:
            prev.message ||
            "Google Calendar remembered. Auto sync will keep timeline entries updated.",
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setCalendarState((prev) => ({
          ...prev,
          connected: false,
          busy: false,
        }));
      }
    };

    void autoConnect();
    return () => {
      cancelled = true;
    };
  }, [
    autoSyncEnabled,
    calendarMonth,
    googleClientId,
    hasGoogleSetup,
    isCalendarLocked,
    loadMonthEvents,
  ]);

  const connectGoogleCalendar = async () => {
    if (isCalendarLocked) {
      setCalendarState((prev) => ({
        ...prev,
        message: calendarLockMessage,
      }));
      return;
    }

    if (!hasGoogleSetup) {
      setCalendarState((prev) => ({
        ...prev,
        message:
          "Add VITE_GOOGLE_CLIENT_ID in your .env file to enable Google Calendar sync.",
      }));
      return;
    }

    setCalendarState((prev) => ({ ...prev, busy: true, message: "" }));

    try {
      await ensureGoogleCalendarClient({
        clientId: googleClientId,
      });

      const accessToken = await ensureCalendarAccessToken(googleClientId, {
        forceConsent: true,
      });

      await loadMonthEvents(calendarMonth, accessToken);

      setAutoSyncEnabled(true);
      writeCalendarConnectionPreference(true);

      setCalendarState((prev) => ({
        ...prev,
        busy: false,
        connected: true,
        message: "Google Calendar connected. Auto sync is enabled.",
      }));
    } catch (error) {
      clearCalendarAccessToken();
      const detailedMessage = formatGoogleCalendarErrorDetails(error, {
        origin: typeof window !== "undefined" ? window.location.origin : "",
        calendarId: googleCalendarId,
      });
      setCalendarState((prev) => ({
        ...prev,
        busy: false,
        connected: false,
        message: detailedMessage,
      }));
    }
  };

  const syncToday24hData = useCallback(
    async ({ silent = false } = {}) => {
      if (autoSyncInFlightRef.current) {
        return;
      }

      autoSyncInFlightRef.current = true;

      if (!hasGoogleSetup) {
        if (!silent) {
          setCalendarState((prev) => ({
            ...prev,
            message:
              "Add VITE_GOOGLE_CLIENT_ID in your .env file to enable Google Calendar sync.",
          }));
        }
        autoSyncInFlightRef.current = false;
        return;
      }

      if (isCalendarLocked) {
        if (!silent) {
          setCalendarState((prev) => ({
            ...prev,
            message: calendarLockMessage,
          }));
        }
        autoSyncInFlightRef.current = false;
        return;
      }

      if (!syncableTimerSessionDrafts.length) {
        if (!silent) {
          setCalendarState((prev) => ({
            ...prev,
            message:
              "No timer sessions reached the 1-minute minimum yet. Calendar sync will create events once a session lasts at least 1 minute.",
          }));
        }
        autoSyncInFlightRef.current = false;
        return;
      }

      setCalendarState((prev) => ({
        ...prev,
        busy: true,
        message: silent ? prev.message : "",
      }));

      try {
        await ensureGoogleCalendarClient({
          clientId: googleClientId,
        });

        const accessToken = await ensureCalendarAccessToken(googleClientId);

        const today = new Date();
        const dayStart = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0,
        );
        const dayEnd = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
          0,
          0,
          0,
          0,
        );

        const existingResponse = await requestGoogleCalendar({
          accessToken,
          path: `/calendars/${encodeURIComponent(googleCalendarId)}/events`,
          query: {
            singleEvents: true,
            showDeleted: false,
            maxResults: 2500,
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
          },
        });

        const existingKeys = new Set(
          (existingResponse.items || [])
            .map(
              (item) =>
                item?.extendedProperties?.private?.inklingTimerSessionKey ||
                item?.extendedProperties?.private?.inklingMinuteKey ||
                item?.extendedProperties?.private?.inklingHourKey,
            )
            .filter(Boolean),
        );

        let createdCount = 0;
        let skippedCount = 0;
        const timeZone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        for (const draft of syncableTimerSessionDrafts) {
          if (existingKeys.has(draft.eventKey)) {
            skippedCount += 1;
            continue;
          }

          const timerLabelLine = formatTimerLabelLine(draft.timerLabels);
          const headingTimerLabel = formatTimerLabelForHeading(
            draft.timerLabels,
          );

          await requestGoogleCalendar({
            accessToken,
            path: `/calendars/${encodeURIComponent(googleCalendarId)}/events`,
            method: "POST",
            body: {
              summary: `IK ${headingTimerLabel} - ${draft.timeframeLabel}`,
              description: [
                timerLabelLine,
                `Duration: ${draft.durationLabel}`,
                `Started at: ${formatSyncTimestamp(draft.start.toISOString())}`,
                `Ended at: ${formatSyncTimestamp(draft.end.toISOString())}`,
                `Start state: ${draft.startedBy}`,
                `End state: ${draft.endedBy}`,
              ].join("\n"),
              start: {
                dateTime: draft.start.toISOString(),
                timeZone,
              },
              end: {
                dateTime: draft.end.toISOString(),
                timeZone,
              },
              extendedProperties: {
                private: {
                  inklingTimerSessionKey: draft.eventKey,
                  inklingMinuteKey: draft.eventKey,
                  inklingHourKey: draft.eventKey,
                },
              },
            },
          });

          createdCount += 1;
        }

        await loadMonthEvents(calendarMonth);

        const successMessage = `Synced ${createdCount} timer sessions to Google Calendar${
          skippedCount > 0 ? `, skipped ${skippedCount} existing` : ""
        }.`;

        setCalendarState((prev) => ({
          ...prev,
          busy: false,
          connected: true,
          lastSyncedAt: new Date().toISOString(),
          message: silent
            ? prev.message || "Auto sync completed."
            : successMessage,
        }));
      } catch (error) {
        if (Number(error?.status || 0) === 401) {
          clearCalendarAccessToken();
        }
        const detailedMessage = formatGoogleCalendarErrorDetails(error, {
          origin: typeof window !== "undefined" ? window.location.origin : "",
          calendarId: googleCalendarId,
        });
        setCalendarState((prev) => ({
          ...prev,
          busy: false,
          message: silent ? prev.message || detailedMessage : detailedMessage,
        }));
      } finally {
        autoSyncInFlightRef.current = false;
      }
    },
    [
      calendarMonth,
      googleCalendarId,
      googleClientId,
      hasGoogleSetup,
      isCalendarLocked,
      calendarLockMessage,
      loadMonthEvents,
      syncableTimerSessionDrafts,
    ],
  );

  useEffect(() => {
    if (!calendarState.connected || !autoSyncEnabled || isCalendarLocked) {
      return;
    }

    void syncToday24hData({ silent: true });
    const intervalId = window.setInterval(() => {
      void syncToday24hData({ silent: true });
    }, CALENDAR_AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    autoSyncEnabled,
    calendarState.connected,
    isCalendarLocked,
    syncToday24hData,
  ]);

  const todayKey = toDayKey(new Date());
  const calendarStatusMessage = isCalendarLocked
    ? calendarLockMessage
    : !hasGoogleSetup
      ? "Google Calendar credentials are missing for this workspace."
      : compactStatusMessage(calendarState.message) ||
        (calendarState.connected
          ? "Calendar is connected and ready to receive your focus sessions."
          : "Connect Google Calendar to sync your reading sessions.");
  const calendarSyncSummary = `${
    syncableTimerSessionDrafts.length
  } session${syncableTimerSessionDrafts.length === 1 ? "" : "s"} ready to sync today.`;

  return (
    <section className="panel data-overview-panel">
      <div className="section-head">
        <h2>{heading}</h2>
      </div>

      <div className="data-overview-grid">
        {showContinueCard && (
          <article className="data-overview-card dashboard-continue-card">
            <p className="data-overview-kicker">Continue reading</p>
            {continueBook ? (
              <>
                <h3>
                  {String(continueBook.title || "Untitled").trim() ||
                    "Untitled"}
                </h3>
                <p>
                  Last page {continueLastReadPage} of {continuePageCount}
                </p>
                <div className="progress-track data-favorite-progress">
                  <div
                    className="progress-fill"
                    style={{ width: `${continueProgressPercent}%` }}
                  />
                </div>
                <div className="market-actions-row dashboard-continue-actions">
                  <button
                    type="button"
                    className="action"
                    onClick={() => onContinueReading?.(continueBook._id)}
                  >
                    Continue Reading
                  </button>
                </div>
              </>
            ) : (
              <p className="status-text">
                No recent reading yet. Open a Library book to start tracking
                this card.
              </p>
            )}
          </article>
        )}

        <article className="data-overview-card data-favorite-card">
          <p className="data-overview-kicker">Favorite book</p>
          {favoriteBook ? (
            <>
              <h3>{favoriteBook.title?.trim() || "Untitled"}</h3>
              <p>
                {favoriteBook.unlockedPages}/{favoriteBook.pageCount} pages
                unlocked
              </p>
              <div className="progress-track data-favorite-progress">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, Number(favoriteBook.progressPercent || 0)),
                    )}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="status-text">
              Add and unlock pages from books to populate this card.
            </p>
          )}
        </article>

        <article className="data-overview-card data-summary-card">
          <p className="data-overview-kicker">Data summary</p>
          <h3>24h reading activity</h3>
          <div className="data-summary-grid">
            <div>
              <span>Timer events</span>
              <strong>{totalTimerEvents}</strong>
            </div>
            <div>
              <span>Unlocked pages total</span>
              <strong>{Math.max(0, Math.floor(totalUnlocked || 0))}</strong>
            </div>
            <div>
              <span>Pages unlocked today</span>
              <strong>{activitySummary.pagesUnlocked}</strong>
            </div>
            <div>
              <span>Completed sessions</span>
              <strong>{activitySummary.completed}</strong>
            </div>
          </div>
        </article>

        <article
          className={`data-overview-card data-calendar-card${isCalendarLocked ? " is-feature-locked" : ""}`}
          title={isCalendarLocked ? calendarLockMessage : undefined}
        >
          <div className="data-calendar-head">
            <p className="data-overview-kicker">Google Calendar</p>
            <div className="data-calendar-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => void connectGoogleCalendar()}
                disabled={calendarState.busy || isCalendarLocked}
              >
                {calendarState.connected ? "Reconnect" : "Connect"}
              </button>
              <button
                type="button"
                className="action"
                onClick={() => void syncToday24hData()}
                disabled={calendarState.busy || isCalendarLocked}
              >
                {calendarState.busy ? "Syncing..." : "Sync 24h Data"}
              </button>
            </div>
          </div>

          {isCalendarLocked && (
            <p className="status-text data-calendar-status-text">
              {calendarLockMessage}
            </p>
          )}

          {!isCalendarLocked && (
            <div className="data-calendar-status-row">
              <span
                className={`data-status-chip${calendarState.connected ? " is-positive" : ""}`}
              >
                {calendarState.connected ? "Connected" : "Not connected"}
              </span>
              <span className="data-status-chip">
                {autoSyncEnabled ? "Auto sync on" : "Auto sync off"}
              </span>
              {calendarState.lastSyncedAt && (
                <span className="data-status-chip">
                  Last sync {formatSyncTimestamp(calendarState.lastSyncedAt)}
                </span>
              )}
            </div>
          )}

          {!isCalendarLocked && (
            <p className="status-text data-calendar-status-text">
              {calendarStatusMessage}
            </p>
          )}

          <p className="status-text data-calendar-helper-text">
            Click any date to open Google Calendar.
          </p>

          <div className="data-calendar-nav">
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setCalendarMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
              aria-label="Previous month"
            >
              <span aria-hidden="true">&larr;</span>
            </button>
            <strong>{formatMonthLabel(calendarMonth)}</strong>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setCalendarMonth(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
              aria-label="Next month"
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>

          <div className="data-calendar-grid-head">
            {CALENDAR_WEEK_HEADERS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="data-calendar-grid">
            {monthGrid.map((cell, index) => {
              const dayKey = toDayKey(cell.date);
              const eventCount = eventCountByDay.get(dayKey) || 0;
              const className = [
                "data-calendar-day",
                !cell.inCurrentMonth ? "outside" : "",
                dayKey === todayKey ? "today" : "",
                eventCount > 0 ? "has-events" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const dayUrl = buildGoogleCalendarDayUrl(cell.date);

              return (
                <button
                  key={`${dayKey}-${index}`}
                  type="button"
                  className={className}
                  onClick={() =>
                    window.open(dayUrl, "_blank", "noopener,noreferrer")
                  }
                  title="Open this date in Google Calendar"
                  aria-label={`Open ${cell.date.toLocaleDateString()} in Google Calendar`}
                >
                  <span className="data-calendar-day-number">
                    {cell.date.getDate()}
                  </span>
                  {eventCount > 0 && (
                    <span className="data-calendar-event-count">
                      {eventCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="status-text data-calendar-helper-text">
            {calendarSyncSummary}
          </p>
        </article>
      </div>
    </section>
  );
}
