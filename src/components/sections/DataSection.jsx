import { useEffect, useMemo, useRef, useState } from "react";
import DataDashboardPanel from "./DataDashboardPanel";
import { buildMinuteTimeline, MINUTES_PER_DAY } from "./activityTimeline";
import { chartPalette, ensureChartJs } from "./chartUtils";
import { translateUiText } from "../../i18n";

const EMPTY_WEEKLY = [
  { day: "Mon", pages: 0 },
  { day: "Tue", pages: 0 },
  { day: "Wed", pages: 0 },
  { day: "Thu", pages: 0 },
  { day: "Fri", pages: 0 },
  { day: "Sat", pages: 0 },
  { day: "Sun", pages: 0 },
];

const EMPTY_DAILY_ACTIVITY = Array.from({ length: 24 }, (_, hour) => ({
  hourLabel: `${String(hour).padStart(2, "0")}:00`,
  started: 0,
  paused: 0,
  removed: 0,
  completed: 0,
  pagesUnlocked: 0,
}));

const MIN_ACTIVITY_WINDOW_MINUTES = 1;
const ZOOM_IN_FACTOR = 0.78;
const ZOOM_OUT_FACTOR = 1.26;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hasMinuteActivity(row) {
  return (
    Number(row?.started || 0) +
      Number(row?.paused || 0) +
      Number(row?.removed || 0) +
      Number(row?.completed || 0) +
      Number(row?.pagesUnlocked || 0) >
    0
  );
}

function formatWindowLabel(windowMinutes) {
  if (windowMinutes >= 60) {
    const hours = windowMinutes / 60;
    if (Number.isInteger(hours)) {
      return `${hours}h`;
    }
    return `${hours.toFixed(1)}h`;
  }

  return `${windowMinutes}m`;
}

export default function DataSection({
  progressBooks,
  weekly,
  dailyActivity,
  minuteActivity,
  timerSessions24h,
  totalUnlockedPagesEver,
  themeId,
  themeMode,
  calendarLocked = false,
  calendarLockedReason = "",
  showOverviewPanel = true,
  embedded = false,
  language = "en",
}) {
  const [progressView, setProgressView] = useState("bar");
  const [activityViewport, setActivityViewport] = useState({
    startMinute: 0,
    windowMinutes: MINUTES_PER_DAY,
  });
  const weeklyCanvasRef = useRef(null);
  const activityCanvasRef = useRef(null);
  const pieCanvasRef = useRef(null);
  const weeklyChartRef = useRef(null);
  const activityChartRef = useRef(null);
  const pieChartRef = useRef(null);

  const palette = useMemo(
    () => chartPalette(themeId, themeMode),
    [themeId, themeMode],
  );
  const weeklyPoints = weekly?.length ? weekly : EMPTY_WEEKLY;
  const chartText = useMemo(
    () => ({
      completed: translateUiText("Completed", language),
      pages: translateUiText("Pages", language),
      pagesUnlocked: translateUiText("Pages unlocked", language),
      paused: translateUiText("Paused", language),
      readingSession: translateUiText("Reading session", language),
      removed: translateUiText("Removed", language),
      started: translateUiText("Started", language),
      time: translateUiText("Time", language),
      timer: translateUiText("Timer", language),
      timerEvents: translateUiText("Timer events", language),
    }),
    [language],
  );
  const activityRows = useMemo(
    () => (dailyActivity?.length ? dailyActivity : EMPTY_DAILY_ACTIVITY),
    [dailyActivity],
  );
  const activityTimeline = useMemo(
    () =>
      buildMinuteTimeline({
        dailyActivity: activityRows,
        minuteActivity: minuteActivity ?? [],
      }),
    [activityRows, minuteActivity],
  );
  const normalizedViewport = useMemo(() => {
    const windowMinutes = clampNumber(
      Math.round(activityViewport.windowMinutes),
      MIN_ACTIVITY_WINDOW_MINUTES,
      MINUTES_PER_DAY,
    );
    const maxStart = Math.max(0, MINUTES_PER_DAY - windowMinutes);
    const startMinute = clampNumber(
      Math.round(activityViewport.startMinute),
      0,
      maxStart,
    );

    return { startMinute, windowMinutes };
  }, [activityViewport]);
  const visibleActivityRows = useMemo(() => {
    const start = normalizedViewport.startMinute;
    const end = start + normalizedViewport.windowMinutes;
    return activityTimeline.slice(start, end);
  }, [activityTimeline, normalizedViewport]);
  const activityWindowLabel = useMemo(
    () => formatWindowLabel(normalizedViewport.windowMinutes),
    [normalizedViewport.windowMinutes],
  );
  const hasAnyActivity = useMemo(
    () => activityTimeline.some((row) => hasMinuteActivity(row)),
    [activityTimeline],
  );
  const totalUnlocked =
    typeof totalUnlockedPagesEver === "number"
      ? totalUnlockedPagesEver
      : progressBooks.reduce(
          (sum, book) => sum + Math.max(0, book.unlockedPages || 0),
          0,
        );

  useEffect(() => {
    const canvas = activityCanvasRef.current;
    if (!canvas) {
      return;
    }

    const onWheel = (event) => {
      const chart = activityChartRef.current;
      const chartArea = chart?.chartArea;
      if (!chartArea) {
        return;
      }

      const pointerX = Number(event.offsetX);
      if (
        !Number.isFinite(pointerX) ||
        pointerX < chartArea.left ||
        pointerX > chartArea.right
      ) {
        return;
      }

      const zoomDirection = Math.sign(event.deltaY);
      if (!zoomDirection) {
        return;
      }

      event.preventDefault();

      setActivityViewport((previous) => {
        const currentWindow = clampNumber(
          Math.round(previous.windowMinutes),
          MIN_ACTIVITY_WINDOW_MINUTES,
          MINUTES_PER_DAY,
        );
        const maxCurrentStart = Math.max(0, MINUTES_PER_DAY - currentWindow);
        const currentStart = clampNumber(
          Math.round(previous.startMinute),
          0,
          maxCurrentStart,
        );

        const zoomFactor = zoomDirection < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
        const nextWindow = clampNumber(
          Math.round(currentWindow * zoomFactor),
          MIN_ACTIVITY_WINDOW_MINUTES,
          MINUTES_PER_DAY,
        );

        if (nextWindow === currentWindow) {
          return previous;
        }

        const pointerRatio = clampNumber(
          (pointerX - chartArea.left) /
            Math.max(1, chartArea.right - chartArea.left),
          0,
          1,
        );
        const currentFocusMinute =
          currentStart + pointerRatio * Math.max(0, currentWindow - 1);
        const rawNextStart = Math.round(
          currentFocusMinute - pointerRatio * Math.max(0, nextWindow - 1),
        );
        const maxNextStart = Math.max(0, MINUTES_PER_DAY - nextWindow);
        const nextStart = clampNumber(rawNextStart, 0, maxNextStart);

        return {
          startMinute: nextStart,
          windowMinutes: nextWindow,
        };
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

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
              label: chartText.pagesUnlocked,
              data: weeklyPoints.map((item) => item.pages),
              borderRadius: 8,
              backgroundColor: palette.bar,
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
    };
  }, [chartText.pagesUnlocked, weeklyPoints, palette]);

  useEffect(() => {
    let isCancelled = false;

    const renderActivityChart = async () => {
      await ensureChartJs();
      if (isCancelled || !window.Chart || !activityCanvasRef.current) {
        return;
      }

      if (activityChartRef.current) {
        activityChartRef.current.destroy();
      }

      const labels = visibleActivityRows.map((row) => row.minuteLabel || "");
      const metric = (key) =>
        visibleActivityRows.map((row) => Math.max(0, Number(row?.[key] ?? 0)));
      const maxTicksLimit =
        labels.length <= 16
          ? labels.length
          : labels.length <= 60
            ? 12
            : labels.length <= 180
              ? 10
              : labels.length <= 420
                ? 8
                : 6;

      activityChartRef.current = new window.Chart(activityCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: chartText.started,
              data: metric("started"),
              backgroundColor: palette.started,
              yAxisID: "eventsAxis",
              stack: "events",
              borderRadius: 4,
            },
            {
              label: chartText.paused,
              data: metric("paused"),
              backgroundColor: palette.paused,
              yAxisID: "eventsAxis",
              stack: "events",
              borderRadius: 4,
            },
            {
              label: chartText.removed,
              data: metric("removed"),
              backgroundColor: palette.removed,
              yAxisID: "eventsAxis",
              stack: "events",
              borderRadius: 4,
            },
            {
              label: chartText.completed,
              data: metric("completed"),
              backgroundColor: palette.completed,
              yAxisID: "eventsAxis",
              stack: "events",
              borderRadius: 4,
            },
            {
              label: chartText.pagesUnlocked,
              type: "line",
              data: metric("pagesUnlocked"),
              yAxisID: "pagesAxis",
              borderColor: palette.bar,
              backgroundColor: palette.bar,
              tension: 0.35,
              borderWidth: 2,
              pointRadius: 2,
              pointHoverRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              labels: { color: palette.text },
            },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const first = items?.[0];
                  if (!first) {
                    return "";
                  }
                  const row = visibleActivityRows[first.dataIndex] ?? null;
                  if (!row) {
                    return "";
                  }

                  const timerLabels = Array.isArray(row.timerLabels)
                    ? row.timerLabels.filter(Boolean)
                    : [];
                  const timerLine = timerLabels.length
                    ? `${chartText.timer}: ${timerLabels.slice(0, 2).join(", ")}${
                        timerLabels.length > 2
                          ? ` +${timerLabels.length - 2}`
                          : ""
                      }`
                    : `${chartText.timer}: ${chartText.readingSession}`;

                  return [`${chartText.time} ${row.minuteLabel}`, timerLine];
                },
                label: (context) => {
                  const datasetLabel = context.dataset?.label ?? "";
                  const value = Math.max(0, Number(context.raw ?? 0));
                  return `${datasetLabel}: ${value}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: palette.text,
                autoSkip: true,
                maxTicksLimit,
              },
              grid: { color: palette.grid },
            },
            eventsAxis: {
              beginAtZero: true,
              stacked: true,
              position: "left",
              ticks: { color: palette.text, precision: 0 },
              grid: { color: palette.grid },
              title: {
                display: true,
                text: chartText.timerEvents,
                color: palette.text,
              },
            },
            pagesAxis: {
              beginAtZero: true,
              position: "right",
              ticks: { color: palette.text },
              grid: { drawOnChartArea: false },
              title: {
                display: true,
                text: chartText.pages,
                color: palette.text,
              },
            },
          },
        },
      });
    };

    void renderActivityChart();
    return () => {
      isCancelled = true;
    };
  }, [chartText, palette, visibleActivityRows]);

  useEffect(() => {
    let isCancelled = false;

    const renderPie = async () => {
      if (progressView !== "pie") {
        if (pieChartRef.current) {
          pieChartRef.current.destroy();
          pieChartRef.current = null;
        }
        return;
      }

      await ensureChartJs();
      if (
        isCancelled ||
        !window.Chart ||
        !pieCanvasRef.current ||
        progressBooks.length === 0
      ) {
        return;
      }

      if (pieChartRef.current) {
        pieChartRef.current.destroy();
      }

      const colors = progressBooks.map(
        (_, index) => palette.pie[index % palette.pie.length],
      );

      pieChartRef.current = new window.Chart(pieCanvasRef.current, {
        type: "pie",
        data: {
          labels: progressBooks.map((book) => book.title),
          datasets: [
            {
              label: "Unlocked pages",
              data: progressBooks.map((book) => book.unlockedPages),
              backgroundColor: colors,
              borderColor: "transparent",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: palette.text },
            },
          },
        },
      });
    };

    void renderPie();
    return () => {
      isCancelled = true;
    };
  }, [palette, progressBooks, progressView]);

  useEffect(
    () => () => {
      if (weeklyChartRef.current) {
        weeklyChartRef.current.destroy();
      }
      if (activityChartRef.current) {
        activityChartRef.current.destroy();
      }
      if (pieChartRef.current) {
        pieChartRef.current.destroy();
      }
    },
    [],
  );

  return (
    <div className={`dash-grid data-grid${embedded ? " data-grid-embedded" : ""}`}>
      {showOverviewPanel && (
        <DataDashboardPanel
          progressBooks={progressBooks}
          dailyActivity={activityRows}
          timerSessions24h={timerSessions24h}
          totalUnlocked={totalUnlocked}
          calendarLocked={calendarLocked}
          calendarLockedReason={calendarLockedReason}
        />
      )}

      <section className="panel timers-panel">
        <div className="section-head">
          <h2>Book Progress</h2>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setProgressView((prev) => (prev === "bar" ? "pie" : "bar"))
            }
          >
            {progressView === "bar" ? "Show Pie Chart" : "Show Bar Progress"}
          </button>
        </div>

        {progressBooks.length === 0 && (
          <p className="status-text">No book progress data yet.</p>
        )}

        {progressView === "bar" && (
          <div className="progress-list">
            {progressBooks.map((book) => (
              <div key={book._id} className="progress-item">
                <div className="progress-meta">
                  <strong>{book.title?.trim() || "Untitled"}</strong>
                  <span>
                    {book.unlockedPages}/{book.pageCount} pages
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${book.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {progressView === "pie" && (
          <>
            <p className="status-text progress-summary">
              Total pages unlocked (ever): {totalUnlocked}
            </p>
            {progressBooks.length > 0 && (
              <div className="chart-wrap pie-chart-wrap">
                <canvas
                  ref={pieCanvasRef}
                  aria-label="Book unlock distribution pie chart"
                />
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel library-panel chart-panel">
        <h2>Weekly Pages Per Day</h2>
        {weekly?.length === 0 && (
          <p className="status-text">
            No weekly unlock data yet. Complete a timer and claim a reward to
            populate this chart.
          </p>
        )}
        <div className="chart-wrap">
          <canvas ref={weeklyCanvasRef} aria-label="Weekly pages chart" />
        </div>
      </section>

      <section className="panel reader-panel activity-panel">
        <h2>24h Activity Snapshot</h2>
        <div className="activity-zoom-toolbar">
          <p className="status-text">
            Per-minute timeline. Scroll on the chart to zoom to a minimum
            1-minute window. Current window: {activityWindowLabel}.
          </p>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setActivityViewport({
                startMinute: 0,
                windowMinutes: MINUTES_PER_DAY,
              })
            }
            disabled={
              normalizedViewport.windowMinutes === MINUTES_PER_DAY &&
              normalizedViewport.startMinute === 0
            }
          >
            Reset 24h Zoom
          </button>
        </div>
        {!hasAnyActivity && (
          <p className="status-text">
            No activity data for today yet. Start a timer or claim rewards to
            populate this chart.
          </p>
        )}
        <div className="chart-wrap activity-chart-wrap">
          <canvas ref={activityCanvasRef} aria-label="24-hour activity chart" />
        </div>
      </section>
    </div>
  );
}
