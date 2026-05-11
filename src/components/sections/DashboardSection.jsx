import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { chartPalette, ensureChartJs } from "./chartUtils";
import {
  buildDayEventCounts,
  formatDateKey,
  normalizeDate,
  toSessionEvents,
} from "./calendarSessionEvents";
import { translateUiText } from "../../i18n";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function formatClock(value) {
  const date = normalizeDate(value);
  if (!date) {
    return "--:--";
  }
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startAt, endAt) {
  const start = Number(startAt || 0);
  const end = Number(endAt || 0);
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function formatTotalDuration(totalSeconds) {
  const minutes = Math.max(0, Math.floor(Number(totalSeconds || 0) / 60));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function formatMonthTitle(date) {
  const resolvedDate = normalizeDate(date) || new Date();
  return resolvedDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function firstTwoLetters(value) {
  return String(value || "IK").trim().slice(0, 2).toUpperCase() || "IK";
}

function buildDashboardSessions(timerSessions24h) {
  return (timerSessions24h || [])
    .map((session, index) => {
      const start = normalizeDate(session?.startAt);
      const end = normalizeDate(session?.endAt);
      if (!start || !end || end <= start) {
        return null;
      }

      const label = String(session?.timerLabel || "Reading session").trim();
      return {
        id:
          String(session?.eventKey || "").trim() ||
          `dashboard-session-${index}`,
        title: label,
        start,
        end,
        duration: formatDuration(start.getTime(), end.getTime()),
        time: `${formatClock(start)} - ${formatClock(end)}`,
        state: String(session?.endedBy || "complete").trim() || "complete",
        initials: firstTwoLetters(label),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function summarizeActivity(dailyActivity) {
  return (dailyActivity || []).reduce(
    (summary, row) => {
      summary.started += Math.max(0, Number(row?.started || 0));
      summary.paused += Math.max(0, Number(row?.paused || 0));
      summary.completed += Math.max(0, Number(row?.completed || 0));
      summary.pagesUnlocked += Math.max(0, Number(row?.pagesUnlocked || 0));
      return summary;
    },
    { started: 0, paused: 0, completed: 0, pagesUnlocked: 0 },
  );
}

function resolveContinueBook(progressBooks, continueReadingBook) {
  if (continueReadingBook) {
    return continueReadingBook;
  }
  return [...(progressBooks || [])].sort(
    (a, b) => Number(b?.unlockedPages || 0) - Number(a?.unlockedPages || 0),
  )[0];
}

export default function DashboardSection({
  title = "Overview",
  progressBooks,
  weekly = [],
  dailyActivity,
  timerSessions,
  timerSessions24h,
  totalSessionSecondsEver = 0,
  continueReadingBook,
  bookThumbnailMap,
  onContinueReading,
  onAddBook,
  onOpenCalendarDate,
  calendarLocked = false,
  themeId = "ink",
  themeMode = "light",
  accentColor = "",
  hidePrivatePanels = false,
  disableContinueAction = false,
  language = "en",
}) {
  const calendarRef = useRef(null);
  const weeklyCanvasRef = useRef(null);
  const weeklyChartRef = useRef(null);
  const [calendarTitle, setCalendarTitle] = useState(() =>
    formatMonthTitle(new Date()),
  );
  const sessions = useMemo(
    () => buildDashboardSessions(timerSessions24h),
    [timerSessions24h],
  );
  const calendarEvents = useMemo(
    () =>
      toSessionEvents(timerSessions ?? timerSessions24h).map((event) => ({
        ...event,
        classNames: [
          ...(event.classNames || []),
          `dashboard-fc-event-${event.extendedProps?.state || "complete"}`,
        ],
      })),
    [timerSessions, timerSessions24h],
  );
  const activity = useMemo(
    () => summarizeActivity(dailyActivity),
    [dailyActivity],
  );
  const continueBook = useMemo(
    () => resolveContinueBook(progressBooks, continueReadingBook),
    [continueReadingBook, progressBooks],
  );
  const hasLibraryBooks = Boolean((progressBooks || []).length);

  const totalPages = Math.max(1, Number(continueBook?.pageCount || 1));
  const continueProgressPercent = clampPercent(
    continueBook?.progressPercent ??
      (Number(continueBook?.unlockedPages || 0) / totalPages) * 100,
  );
  const continueThumbnail =
    continueBook?._id && bookThumbnailMap?.[continueBook._id]?.src
      ? bookThumbnailMap[continueBook._id].src
      : "";
  const showContinueAction =
    !disableContinueAction && typeof onContinueReading === "function";
  const calendarEventCounts = useMemo(
    () => buildDayEventCounts(calendarEvents),
    [calendarEvents],
  );
  const totalSessionTimeLabel = formatTotalDuration(
    totalSessionSecondsEver ||
      sessions.reduce(
        (sum, session) =>
          sum +
          Math.max(
            0,
            Math.floor((session.end.getTime() - session.start.getTime()) / 1000),
          ),
        0,
      ),
  );

  const statCards = [
    {
      key: "timers",
      tone: "moss",
      label: "Total session time",
      value: totalSessionTimeLabel,
      meta: "All time",
    },
    {
      key: "pages",
      tone: "ink",
      label: "Total pages gained",
      value: activity.pagesUnlocked,
      meta: "Claimed today",
    },
    {
      key: "sessions",
      tone: "rose",
      label: "Sessions completed",
      value: activity.completed,
      meta: `${sessions.length} today`,
    },
  ];
  const weeklyPoints = useMemo(
    () =>
      weekly?.length
        ? weekly
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
            day,
            pages: 0,
          })),
    [weekly],
  );
  const palette = useMemo(
    () => chartPalette(themeId, themeMode, accentColor),
    [accentColor, themeId, themeMode],
  );
  const weeklyBarColor = accentColor || palette.bar;
  const pagesUnlockedLabel = translateUiText("Pages unlocked", language);

  useEffect(() => {
    let isCancelled = false;

    const renderWeeklyChart = async () => {
      await ensureChartJs();
      if (isCancelled || !window.Chart || !weeklyCanvasRef.current) {
        return;
      }

      if (weeklyChartRef.current) {
        weeklyChartRef.current.destroy();
      }

      weeklyChartRef.current = new window.Chart(weeklyCanvasRef.current, {
        type: "bar",
        data: {
          labels: weeklyPoints.map((item) => item.day),
          datasets: [
            {
              label: pagesUnlockedLabel,
              data: weeklyPoints.map((item) => item.pages),
              borderRadius: 8,
              backgroundColor: weeklyBarColor,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: palette.text },
              grid: { color: palette.grid },
            },
            y: {
              beginAtZero: true,
              ticks: { color: palette.text, precision: 0 },
              grid: { color: palette.grid },
            },
          },
          plugins: {
            legend: {
              labels: { color: palette.text },
            },
          },
        },
      });
    };

    void renderWeeklyChart();
    return () => {
      isCancelled = true;
      if (weeklyChartRef.current) {
        weeklyChartRef.current.destroy();
        weeklyChartRef.current = null;
      }
    };
  }, [pagesUnlockedLabel, palette, weeklyBarColor, weeklyPoints]);

  return (
    <div className="dash-grid dashboard-command-grid">
      <section
        className={`panel dashboard-command-panel${hidePrivatePanels ? " is-public-overview" : ""}`}
      >
        <div className="dashboard-command-main">
          <header className="dashboard-command-header">
            <div>
              <h2>{title}</h2>
            </div>
          </header>

          <div className="dashboard-stat-grid">
            {statCards.map((card) => (
              <article
                key={card.key}
                className={`dashboard-stat-card dashboard-stat-${card.key} tone-${card.tone}`}
              >
                <p>{card.label}</p>
                <strong>{card.value}</strong>
                <span>{card.meta}</span>
                <div className="dashboard-card-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </article>
            ))}
            <article
              className={`dashboard-continue-card${hasLibraryBooks ? "" : " is-empty"}`}
            >
              {hasLibraryBooks ? (
                <>
                  <div className="dashboard-continue-thumb" aria-hidden="true">
                    {continueThumbnail ? (
                      <img src={continueThumbnail} alt="" />
                    ) : (
                      <span>{firstTwoLetters(continueBook?.title)}</span>
                    )}
                  </div>
                  <div className="dashboard-continue-copy">
                    <p>Continue Reading</p>
                    <strong>{continueBook?.title || "Untitled"}</strong>
                    <span>
                      {Math.max(0, Number(continueBook?.unlockedPages || 0))}/
                      {totalPages}
                    </span>
                  </div>
                  {showContinueAction ? (
                    <button
                      type="button"
                      className="action"
                      disabled={!continueBook}
                      onClick={() => onContinueReading?.(continueBook?._id)}
                    >
                      Continue
                    </button>
                  ) : null}
                  <div
                    className="dashboard-continue-progress"
                    aria-hidden="true"
                  >
                    <i style={{ width: `${continueProgressPercent}%` }} />
                  </div>
                </>
              ) : (
                <div className="dashboard-add-book-prompt">
                  <strong>Add a book</strong>
                  <button
                    type="button"
                    className="action"
                    onClick={() => onAddBook?.()}
                  >
                    Open Library
                  </button>
                </div>
              )}
            </article>
          </div>

          <div className="dashboard-lower-grid">
            <section className="dashboard-list-panel">
              <div className="dashboard-panel-head">
                <h3>Library</h3>
              </div>

              <div className="dashboard-book-list">
                {(progressBooks || []).slice(0, 4).map((book) => (
                  <article key={book._id} className="dashboard-book-row">
                    <span>{firstTwoLetters(book.title)}</span>
                    <div>
                      <strong>{book.title || "Untitled"}</strong>
                      <small>
                        {Math.max(0, Number(book.unlockedPages || 0))}/
                        {Math.max(1, Number(book.pageCount || 1))}
                      </small>
                    </div>
                    <b>{clampPercent(book.progressPercent)}%</b>
                    <i
                      className="dashboard-book-row-progress"
                      aria-hidden="true"
                      style={{
                        "--dashboard-book-progress": `${clampPercent(book.progressPercent)}%`,
                      }}
                    />
                  </article>
                ))}
                {!(progressBooks || []).length ? (
                  <article className="dashboard-book-row dashboard-book-empty-row">
                    <div>
                      <strong>Add a book</strong>
                    </div>
                  </article>
                ) : null}
              </div>
            </section>

            <section className="dashboard-list-panel dashboard-weekly-panel chart-panel">
              <div className="dashboard-panel-head">
                <h3>Weekly Pages Per Day</h3>
              </div>

              <div className="chart-wrap dashboard-weekly-chart">
                <canvas
                  ref={weeklyCanvasRef}
                  aria-label="Weekly pages chart"
                />
              </div>
            </section>

          </div>
        </div>

        {!hidePrivatePanels ? (
          <aside
            className={`dashboard-command-side${calendarLocked ? " is-locked" : ""}`}
          >
            <section className="dashboard-calendar-panel dashboard-overview-calendar-panel">
              <div className="dashboard-panel-head">
                <h3>Calendar</h3>
                <div className="dashboard-calendar-controls">
                  <button
                    type="button"
                    className="ghost"
                    aria-label="Previous month"
                    onClick={() => calendarRef.current?.getApi().prev()}
                  >
                    <span aria-hidden="true">&larr;</span>
                  </button>
                  <strong>{calendarTitle}</strong>
                  <button
                    type="button"
                    className="ghost"
                    aria-label="Next month"
                    onClick={() => calendarRef.current?.getApi().next()}
                  >
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              </div>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={false}
                height="auto"
                fixedWeekCount={false}
                events={calendarEvents}
                dayMaxEvents={2}
                eventDisplay="none"
                datesSet={(info) =>
                  setCalendarTitle(formatMonthTitle(info.view.currentStart))
                }
                dateClick={(info) => onOpenCalendarDate?.(info.date)}
                dayCellContent={(info) => {
                  const eventCount =
                    calendarEventCounts[formatDateKey(info.date)] || 0;
                  return (
                    <div className="calendar-mini-day-content">
                      <span className="calendar-mini-day-number">
                        {info.date.getDate()}
                      </span>
                      {eventCount ? (
                        <span className="calendar-mini-day-count">
                          {eventCount}
                        </span>
                      ) : null}
                    </div>
                  );
                }}
                dayCellClassNames={(info) =>
                  calendarEventCounts[formatDateKey(info.date)]
                    ? ["has-events"]
                    : []
                }
              />
            </section>

            <section className="dashboard-timeline-panel dashboard-sessions-panel">
              <div className="dashboard-panel-head">
                <h3>Sessions</h3>
              </div>
              <div className="dashboard-session-list">
                {sessions.length ? (
                  sessions.slice(-4).reverse().map((session) => (
                    <article
                      key={session.id}
                      className="dashboard-session-row"
                    >
                      <span>{session.initials}</span>
                      <div>
                        <strong>
                          {translateUiText(session.title, language)}
                        </strong>
                        <small>{session.time}</small>
                      </div>
                      <b>{session.duration}</b>
                    </article>
                  ))
                ) : (
                  <p className="status-text">No timer sessions logged yet</p>
                )}
              </div>
            </section>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
