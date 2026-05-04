const MINUTES_PER_DAY = 24 * 60;
const ACTIVITY_KEYS = [
  "started",
  "paused",
  "removed",
  "completed",
  "pagesUnlocked",
];

function normalizeCount(value) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

function normalizeTimerLabel(value) {
  const safe = String(value || "").trim();
  return safe || "";
}

function clampMinuteIndex(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.floor(value)));
}

export function parseMinuteIndex(value) {
  if (typeof value === "number") {
    return clampMinuteIndex(value);
  }

  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatMinuteLabel(minuteIndex) {
  const clamped = clampMinuteIndex(minuteIndex);
  const safeMinuteIndex = clamped === null ? 0 : clamped;
  const hour = Math.floor(safeMinuteIndex / 60);
  const minute = safeMinuteIndex % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createEmptyMinuteBucket(minuteIndex) {
  return {
    minuteIndex,
    minuteLabel: formatMinuteLabel(minuteIndex),
    started: 0,
    paused: 0,
    removed: 0,
    completed: 0,
    pagesUnlocked: 0,
    timerLabels: [],
  };
}

function appendUniqueLabels(target, labels) {
  for (const candidate of labels) {
    const safeLabel = normalizeTimerLabel(candidate);
    if (!safeLabel) {
      continue;
    }
    if (!target.includes(safeLabel)) {
      target.push(safeLabel);
    }
  }
}

function normalizeTimerLabelsArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeTimerLabel(entry)).filter(Boolean);
}

function parseTimedEventEntry(value) {
  if (value && typeof value === "object") {
    return {
      minuteIndex: parseMinuteIndex(
        value.time ?? value.minuteLabel ?? value.hourLabel,
      ),
      timerLabel: normalizeTimerLabel(value.timerLabel ?? value.label),
    };
  }

  return {
    minuteIndex: parseMinuteIndex(value),
    timerLabel: "",
  };
}

function ensureMinuteBucket(map, minuteIndex) {
  const normalizedIndex = clampMinuteIndex(minuteIndex);
  if (normalizedIndex === null) {
    return null;
  }

  if (!map.has(normalizedIndex)) {
    map.set(normalizedIndex, createEmptyMinuteBucket(normalizedIndex));
  }

  return map.get(normalizedIndex);
}

function applyMinuteRowsToMap(targetMap, minuteRows) {
  for (const row of minuteRows) {
    const minuteIndex = parseMinuteIndex(
      row?.minuteIndex ?? row?.minuteLabel ?? row?.hourLabel,
    );
    if (minuteIndex === null) {
      continue;
    }

    const bucket = ensureMinuteBucket(targetMap, minuteIndex);
    if (!bucket) {
      continue;
    }

    for (const key of ACTIVITY_KEYS) {
      bucket[key] += normalizeCount(row?.[key]);
    }

    appendUniqueLabels(
      bucket.timerLabels,
      normalizeTimerLabelsArray(row?.timerLabels),
    );
  }
}

function applyDailyRowsToMap(targetMap, dailyRows) {
  for (let rowIndex = 0; rowIndex < dailyRows.length; rowIndex += 1) {
    const row = dailyRows[rowIndex] || {};
    const fallbackMinute =
      parseMinuteIndex(row.hourLabel) ?? clampMinuteIndex(rowIndex * 60) ?? 0;
    const rowTimerLabels = normalizeTimerLabelsArray(row.timerLabels);

    const totals = {
      started: normalizeCount(row.started),
      paused: normalizeCount(row.paused),
      removed: normalizeCount(row.removed),
      completed: normalizeCount(row.completed),
      pagesUnlocked: normalizeCount(row.pagesUnlocked),
    };

    const consumed = {
      started: 0,
      paused: 0,
      removed: 0,
      completed: 0,
      pagesUnlocked: 0,
    };

    const eventTimes =
      row?.eventTimes && typeof row.eventTimes === "object"
        ? row.eventTimes
        : {};

    for (const key of ACTIVITY_KEYS) {
      const timedEvents = Array.isArray(eventTimes[key]) ? eventTimes[key] : [];
      for (const timeValue of timedEvents) {
        const { minuteIndex, timerLabel } = parseTimedEventEntry(timeValue);
        if (minuteIndex === null) {
          continue;
        }

        const bucket = ensureMinuteBucket(targetMap, minuteIndex);
        if (!bucket) {
          continue;
        }

        bucket[key] += 1;
        consumed[key] += 1;
        appendUniqueLabels(bucket.timerLabels, [timerLabel]);

        if (!timerLabel && rowTimerLabels.length === 1) {
          appendUniqueLabels(bucket.timerLabels, rowTimerLabels);
        }
      }
    }

    for (const key of ACTIVITY_KEYS) {
      const remainder = Math.max(0, totals[key] - consumed[key]);
      if (remainder <= 0) {
        continue;
      }

      const fallbackBucket = ensureMinuteBucket(targetMap, fallbackMinute);
      if (!fallbackBucket) {
        continue;
      }

      fallbackBucket[key] += remainder;
      appendUniqueLabels(fallbackBucket.timerLabels, rowTimerLabels);
    }
  }
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasMinuteActivity(row) {
  return ACTIVITY_KEYS.some((key) => normalizeCount(row?.[key]) > 0);
}

export function buildMinuteTimeline({
  dailyActivity = [],
  minuteActivity = [],
} = {}) {
  const minuteMap = new Map();

  if (Array.isArray(minuteActivity) && minuteActivity.length > 0) {
    applyMinuteRowsToMap(minuteMap, minuteActivity);
  } else if (Array.isArray(dailyActivity) && dailyActivity.length > 0) {
    applyDailyRowsToMap(minuteMap, dailyActivity);
  }

  return Array.from({ length: MINUTES_PER_DAY }, (_, minuteIndex) => {
    const row = minuteMap.get(minuteIndex);
    if (!row) {
      return createEmptyMinuteBucket(minuteIndex);
    }

    return {
      minuteIndex,
      minuteLabel: formatMinuteLabel(minuteIndex),
      started: normalizeCount(row.started),
      paused: normalizeCount(row.paused),
      removed: normalizeCount(row.removed),
      completed: normalizeCount(row.completed),
      pagesUnlocked: normalizeCount(row.pagesUnlocked),
      timerLabels: normalizeTimerLabelsArray(row.timerLabels),
    };
  });
}

export function buildMinuteCalendarDraft({
  dailyActivity = [],
  minuteActivity = [],
  targetDate = new Date(),
} = {}) {
  const timeline = buildMinuteTimeline({ dailyActivity, minuteActivity });
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();
  const dateKey = toDayKey(targetDate);

  return timeline
    .filter((row) => hasMinuteActivity(row))
    .map((row) => {
      const hour = Math.floor(row.minuteIndex / 60);
      const minute = row.minuteIndex % 60;
      const start = new Date(year, month, day, hour, minute, 0, 0);
      const end = new Date(start.getTime() + 60 * 1000);

      return {
        ...row,
        eventKey: `inkling-24h-${dateKey}-${String(row.minuteIndex).padStart(4, "0")}`,
        start,
        end,
      };
    });
}

export { MINUTES_PER_DAY };
