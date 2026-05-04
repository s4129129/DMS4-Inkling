const CALENDAR_MIN_EVENT_DURATION_MS = 60 * 1000;

export function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateKey(value) {
  const date = normalizeDate(value);
  if (!date) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildDayEventCounts(events) {
  const counts = Object.create(null);

  for (const event of events || []) {
    const start = normalizeDate(event?.start);
    const rawEnd = normalizeDate(event?.end) || start;
    if (!start) {
      continue;
    }

    const end = rawEnd > start ? new Date(rawEnd.getTime() - 1) : rawEnd;
    const cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      0,
      0,
      0,
    );
    const endBoundary = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      0,
      0,
      0,
      0,
    );

    while (cursor <= endBoundary) {
      const key = formatDateKey(cursor);
      counts[key] = (counts[key] || 0) + 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return counts;
}

function formatTimeframeLabel(start, end) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(start)}-${formatter.format(end)}`;
}

function formatSyncTimestamp(value) {
  const date = normalizeDate(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDurationLabel(durationMs) {
  const totalMinutes = Math.max(1, Math.round(durationMs / (60 * 1000)));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function normalizeTimerLabels(timerLabels, fallbackLabel) {
  if (Array.isArray(timerLabels)) {
    const labels = timerLabels
      .map((label) => String(label || "").trim())
      .filter(Boolean);
    if (labels.length) {
      return labels;
    }
  }
  return [String(fallbackLabel || "Reading session").trim() || "Reading session"];
}

function formatTimerLabelLine(timerLabels) {
  if (timerLabels.length === 1) {
    return `Timer label: ${timerLabels[0]}`;
  }

  const visible = timerLabels.slice(0, 2);
  const suffix =
    timerLabels.length > visible.length ? ` +${timerLabels.length - visible.length}` : "";
  return `Timer labels: ${visible.join(", ")}${suffix}`;
}

function formatTimerLabelForHeading(timerLabels) {
  if (timerLabels.length === 1) {
    return timerLabels[0];
  }
  return `${timerLabels[0]} +${timerLabels.length - 1}`;
}

function buildLoggedCalendarEvent({
  id,
  title,
  start,
  end,
  state = "scheduled",
  editable = false,
}) {
  const safeStart = normalizeDate(start) || new Date();
  let safeEnd = normalizeDate(end);
  if (!safeEnd || safeEnd <= safeStart) {
    safeEnd = new Date(safeStart.getTime() + CALENDAR_MIN_EVENT_DURATION_MS);
  }
  if (safeEnd.getTime() - safeStart.getTime() < CALENDAR_MIN_EVENT_DURATION_MS) {
    safeEnd = new Date(safeStart.getTime() + CALENDAR_MIN_EVENT_DURATION_MS);
  }

  const timerLabels = normalizeTimerLabels(null, title);
  const range = formatTimeframeLabel(safeStart, safeEnd);
  const durationLabel = formatDurationLabel(
    safeEnd.getTime() - safeStart.getTime(),
  );
  const eventKey = String(id || `timer:${safeStart.getTime()}:${safeEnd.getTime()}`);
  const summary = `IK ${formatTimerLabelForHeading(timerLabels)} - ${range}`;
  const description = [
    formatTimerLabelLine(timerLabels),
    `Duration: ${durationLabel}`,
    `Started at: ${formatSyncTimestamp(safeStart)}`,
    `Ended at: ${formatSyncTimestamp(safeEnd)}`,
    `Start state: ${state}`,
    `End state: ${state}`,
  ].join("\n");

  return {
    id: eventKey,
    title: summary,
    start: safeStart,
    end: safeEnd,
    editable,
    startEditable: editable,
    durationEditable: editable,
    classNames: ["calendar-event-reading"],
    extendedProps: {
      calendarType: "reading",
      calendarKey: eventKey,
      description,
      durationLabel,
      originalTitle: timerLabels[0],
      state,
      range,
      syncPrivate: {
        inklingTimerSessionKey: eventKey,
        inklingMinuteKey: eventKey,
        inklingHourKey: eventKey,
      },
    },
  };
}

export function toSessionEvents(timerSessions) {
  return (timerSessions || [])
    .map((session, index) => {
      const start = normalizeDate(session?.startAt);
      const end = normalizeDate(session?.endAt);
      if (!start || !end || end <= start) {
        return null;
      }
      const durationMs = end.getTime() - start.getTime();
      if (durationMs < CALENDAR_MIN_EVENT_DURATION_MS) {
        return null;
      }

      const rawTitle = String(session?.timerLabel || "Reading session").trim();
      const timerLabels = normalizeTimerLabels(session?.timerLabels, rawTitle);
      const eventKey =
        String(session?.eventKey || "").trim() ||
        `${String(session?.timerId || "timer")}:${start.getTime()}:${end.getTime()}`;
      const event = buildLoggedCalendarEvent({
        id: eventKey || `calendar-session-${index}`,
        title: formatTimerLabelForHeading(timerLabels),
        start,
        end,
        state: String(session?.endedBy || "completed").trim().toLowerCase(),
      });

      return {
        ...event,
        extendedProps: {
          ...event.extendedProps,
          originalTitle: rawTitle || "Reading session",
        },
      };
    })
    .filter(Boolean);
}
