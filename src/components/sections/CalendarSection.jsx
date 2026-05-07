import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import HintPopover from "../common/HintPopover";
import { translateUiText } from "../../i18n";
import {
  buildDayEventCounts,
  formatDateKey,
  normalizeDate,
  toSessionEvents,
} from "./calendarSessionEvents";

const VIEW_OPTIONS = [
  { key: "dayGridMonth", label: "Month" },
  { key: "timeGridWeek", label: "Week" },
  { key: "timeGridDay", label: "Day" },
  { key: "listWeek", label: "Sessions" },
];
const MOBILE_PANEL_OPTIONS = [
  { key: "main", label: "Main" },
  { key: "rail", label: "Mini" },
];
const CALENDAR_INFO_COPY =
  "Calendar is used to record your work sessions via timers. Note that a 1-minute window is needed for the calendar to record an action like pausing or canceling a timer.";
const CALENDAR_SIDE_RAIL_WIDTH_STORAGE_KEY = "inkling:calendar-side-rail-width:v1";
const DEFAULT_CALENDAR_SIDE_RAIL_WIDTH = 270;
const MIN_CALENDAR_SIDE_RAIL_WIDTH = 220;
const MAX_CALENDAR_SIDE_RAIL_WIDTH = 420;

function readCalendarSideRailWidth() {
  if (typeof window === "undefined") {
    return DEFAULT_CALENDAR_SIDE_RAIL_WIDTH;
  }

  try {
    return clampNumber(
      Number(window.localStorage.getItem(CALENDAR_SIDE_RAIL_WIDTH_STORAGE_KEY)),
      MIN_CALENDAR_SIDE_RAIL_WIDTH,
      MAX_CALENDAR_SIDE_RAIL_WIDTH,
    );
  } catch {
    return DEFAULT_CALENDAR_SIDE_RAIL_WIDTH;
  }
}

function writeCalendarSideRailWidth(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CALENDAR_SIDE_RAIL_WIDTH_STORAGE_KEY,
      String(
        clampNumber(
          value,
          MIN_CALENDAR_SIDE_RAIL_WIDTH,
          MAX_CALENDAR_SIDE_RAIL_WIDTH,
        ),
      ),
    );
  } catch {
    // Resizing remains available even when local storage is blocked.
  }
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function eventToRecord(event) {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    extendedProps: event.extendedProps || {},
  };
}

export default function CalendarSection({
  timerSessions = null,
  timerSessions24h,
  calendarLocked = false,
  focusRequest = null,
  language = "vi",
}) {
  const calendarRef = useRef(null);
  const miniCalendarRef = useRef(null);
  const calendarMainRef = useRef(null);
  const [activeView, setActiveView] = useState("timeGridWeek");
  const [mobilePanel, setMobilePanel] = useState("main");
  const [eventPopover, setEventPopover] = useState(null);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [miniCalendarTitle, setMiniCalendarTitle] = useState("");
  const [sideRailWidth, setSideRailWidth] = useState(readCalendarSideRailWidth);

  const calendarTimerSessions = timerSessions ?? timerSessions24h;
  const events = useMemo(
    () => toSessionEvents(calendarTimerSessions),
    [calendarTimerSessions],
  );
  const todayEvents = useMemo(
    () => toSessionEvents(timerSessions24h),
    [timerSessions24h],
  );
  const dayEventCounts = useMemo(() => buildDayEventCounts(events), [events]);
  const noEventsText = translateUiText("No events to display", language);

  const visibleEvent = eventPopover?.event || null;
  const renderCenteredDayCell = (info) => {
    const eventCount = dayEventCounts[formatDateKey(info.date)] ?? 0;

    return (
      <div className="calendar-mini-day-content">
        <span className="calendar-mini-day-number">
          {info.date.getDate()}
        </span>
        {eventCount ? (
          <span className="calendar-mini-day-count">{eventCount}</span>
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    if (!visibleEvent) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visibleEvent]);

  useEffect(() => {
    if (!focusRequest?.date) {
      return;
    }

    const targetDate = normalizeDate(focusRequest.date);
    if (!targetDate) {
      return;
    }

    setActiveView("listWeek");
    setMobilePanel("main");
    const frameId = window.requestAnimationFrame(() => {
      const api = calendarRef.current?.getApi();
      api?.changeView("listWeek");
      api?.gotoDate(targetDate);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [focusRequest]);

  const onSetView = (viewName) => {
    setActiveView(viewName);
    calendarRef.current?.getApi()?.changeView(viewName);
  };

  const onMove = (direction) => {
    const api = calendarRef.current?.getApi();
    if (!api) {
      return;
    }
    if (direction === "prev") {
      api.prev();
      return;
    }
    if (direction === "next") {
      api.next();
      return;
    }
    api.today();
  };

  const onMoveMiniCalendar = (direction) => {
    const api = miniCalendarRef.current?.getApi();
    if (!api) {
      return;
    }
    if (direction === "prev") {
      api.prev();
      return;
    }
    if (direction === "next") {
      api.next();
      return;
    }
    api.today();
  };

  const onResizeSideRail = (nextWidth) => {
    const clampedWidth = clampNumber(
      nextWidth,
      MIN_CALENDAR_SIDE_RAIL_WIDTH,
      MAX_CALENDAR_SIDE_RAIL_WIDTH,
    );
    setSideRailWidth(clampedWidth);
    writeCalendarSideRailWidth(clampedWidth);
  };

  const onSideRailResizePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = sideRailWidth;

    const onPointerMove = (moveEvent) => {
      onResizeSideRail(Math.round(startWidth + moveEvent.clientX - startX));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const onSideRailResizeKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    onResizeSideRail(sideRailWidth + direction * 16);
  };

  const openEventPopover = (eventRecord, sourceElement) => {
    const anchorRect = sourceElement?.getBoundingClientRect?.();
    const panelRect = calendarMainRef.current?.getBoundingClientRect?.();
    const popoverWidth = 340;
    const popoverHeight = 320;
    const gap = 10;

    if (anchorRect && panelRect) {
      const rightX = anchorRect.right - panelRect.left + gap;
      const leftX = anchorRect.left - panelRect.left - popoverWidth - gap;
      const maxX = Math.max(12, panelRect.width - popoverWidth - 12);
      const x =
        rightX <= maxX
          ? clampNumber(rightX, 12, maxX)
          : clampNumber(leftX, 12, maxX);
      const y = clampNumber(
        anchorRect.top - panelRect.top - 8,
        12,
        panelRect.height - popoverHeight - 12,
      );

      setEventPopover({ event: eventRecord, x, y });
      return;
    }

    const fallbackX = Math.max(12, (panelRect?.width ?? 380) - popoverWidth - 12);
    const fallbackY = 78;
    const x = fallbackX;
    const y = fallbackY;
    setEventPopover({ event: eventRecord, x, y });
  };

  return (
    <div className="dash-grid calendar-section-grid">
      <section
        className={`panel calendar-shell mobile-panel-${mobilePanel}`}
        style={{ "--calendar-side-rail-width": `${sideRailWidth}px` }}
        onMouseDown={(event) => {
          if (!event.target.closest(".calendar-event-popover")) {
            setEventPopover(null);
          }
        }}
      >
        <div className="calendar-mobile-controls">
          <label>
            <span>View</span>
            <select
              value={activeView}
              onChange={(event) => onSetView(event.target.value)}
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Panel</span>
            <select
              value={mobilePanel}
              onChange={(event) => setMobilePanel(event.target.value)}
            >
              {MOBILE_PANEL_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <aside className="calendar-side-rail">
          <div className="calendar-mini-card">
            <div
              className="dashboard-calendar-controls calendar-mini-controls"
              aria-label="Mini calendar nav"
            >
              <button
                type="button"
                className="ghost"
                onClick={() => onMoveMiniCalendar("prev")}
                aria-label="Previous mini month"
              >
                &larr;
              </button>
              <strong>{miniCalendarTitle || "Calendar"}</strong>
              <button
                type="button"
                className="ghost"
                onClick={() => onMoveMiniCalendar("next")}
                aria-label="Next mini month"
              >
                &rarr;
              </button>
            </div>
            <FullCalendar
              ref={miniCalendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              timeZone="local"
              height="auto"
              fixedWeekCount={false}
              dayMaxEvents={0}
              eventDisplay="none"
              events={events}
              noEventsText={noEventsText}
              dayCellClassNames={(info) =>
                dayEventCounts[formatDateKey(info.date)] ? ["has-events"] : []
              }
              dayCellContent={renderCenteredDayCell}
              datesSet={(info) => setMiniCalendarTitle(info.view.title)}
              dateClick={(info) => {
                setActiveView("listWeek");
                calendarRef.current?.getApi()?.gotoDate(info.date);
                calendarRef.current?.getApi()?.changeView("listWeek");
                setMobilePanel("main");
              }}
            />
          </div>

          <section className="calendar-list-card">
            <h3>Sessions today</h3>
            <ul className="calendar-session-list">
              {todayEvents.length ? todayEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={(clickEvent) => {
                      openEventPopover(event, clickEvent.currentTarget);
                      calendarRef.current?.getApi()?.gotoDate(event.start);
                    }}
                  >
                    <strong>{event.extendedProps.originalTitle}</strong>
                    <span>{event.extendedProps.range}</span>
                  </button>
                </li>
              )) : (
                <li className="calendar-session-empty">No sessions logged yet</li>
              )}
            </ul>
          </section>
        </aside>

        <div
          className="calendar-rail-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize calendar rail"
          tabIndex={0}
          onPointerDown={onSideRailResizePointerDown}
          onKeyDown={onSideRailResizeKeyDown}
        />

        <main className="calendar-main-panel" ref={calendarMainRef}>
          <header className="calendar-toolbar">
            <div className="calendar-toolbar-left">
              <div className="calendar-title-cluster">
                <h2>Calendar</h2>
                <HintPopover
                  label="Calendar info"
                  message={CALENDAR_INFO_COPY}
                />
              </div>
              <div
                className="dashboard-calendar-controls calendar-section-controls"
                aria-label="Calendar nav"
              >
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onMove("prev")}
                  aria-label="Previous"
                >
                  &larr;
                </button>
                <strong>{calendarTitle || "Calendar"}</strong>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onMove("next")}
                  aria-label="Next"
                >
                  &rarr;
                </button>
              </div>
              <button
                type="button"
                className="ghost calendar-today-button"
                onClick={() => onMove("today")}
              >
                Today
              </button>
            </div>

            <div className="calendar-toolbar-right">
              <div className="calendar-view-switch">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={activeView === option.key ? "active" : ""}
                    onClick={() => onSetView(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="calendar-stage">
            <div className="calendar-fullcalendar-wrap">
              <FullCalendar
                ref={calendarRef}
                plugins={[
                  dayGridPlugin,
                  timeGridPlugin,
                  listPlugin,
                  interactionPlugin,
                ]}
                initialView={activeView}
                headerToolbar={false}
                allDaySlot={false}
                nowIndicator
                selectable={false}
                editable={false}
                weekends
                height="100%"
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                slotDuration="00:30:00"
                slotLabelInterval="01:00:00"
                scrollTime="00:00:00"
                timeZone="local"
                dayMaxEvents={3}
                events={events}
                noEventsText={noEventsText}
                dayCellClassNames={
                  activeView === "dayGridMonth"
                    ? (info) =>
                        dayEventCounts[formatDateKey(info.date)]
                          ? ["has-events"]
                          : []
                    : undefined
                }
                dayCellContent={
                  activeView === "dayGridMonth"
                    ? renderCenteredDayCell
                    : undefined
                }
                datesSet={(info) => setCalendarTitle(info.view.title)}
                eventClick={(info) => {
                  info.jsEvent?.preventDefault?.();
                  info.jsEvent?.stopPropagation?.();
                  openEventPopover(eventToRecord(info.event), info.el);
                }}
              />
            </div>
          </div>

          {visibleEvent ? (
            <aside
              className="calendar-event-popover"
              style={{
                "--calendar-popover-x": `${eventPopover.x}px`,
                "--calendar-popover-y": `${eventPopover.y}px`,
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <h3>Details</h3>
                <button
                  type="button"
                  className="calendar-popover-close"
                  onClick={() => setEventPopover(null)}
                  aria-label="Close"
                  title="Close"
                >
                  x
                </button>
              </header>
              <strong>{visibleEvent.title || "Reading session"}</strong>
              <span>{visibleEvent.extendedProps?.range || "--:--"}</span>
              <span>{visibleEvent.extendedProps?.durationLabel || "0m"}</span>
              <span>{visibleEvent.extendedProps?.state || "scheduled"}</span>
              <pre>{visibleEvent.extendedProps?.description || ""}</pre>
              <div className="calendar-popover-actions">
                <button type="button" className="ghost" disabled={calendarLocked}>
                  Sync
                </button>
                <button type="button" className="action" disabled={calendarLocked}>
                  Export
                </button>
              </div>
            </aside>
          ) : null}
        </main>
      </section>
    </div>
  );
}
