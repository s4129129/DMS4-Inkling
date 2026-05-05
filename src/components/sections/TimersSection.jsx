import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import HintPopover from "../common/HintPopover";

const MAX_SESSION_MINUTES = 120;
const LONG_SESSION_WARNING =
  "Any more than 2hours of work per session is not recommended by scientfic research";

function getTimerRemaining(timer, now) {
  if (!timer) {
    return 0;
  }
  if (timer.isPaused) {
    const pausedCheckpoint = timer.pausedAt ?? now;
    return Math.max(0, timer.remainingMs ?? timer.endsAt - pausedCheckpoint);
  }
  return Math.max(0, timer.endsAt - now);
}

export default function TimersSection({
  timerLabel,
  setTimerLabel,
  durationMinutes,
  setDurationMinutes,
  onCreateTimer,
  timerState,
  minutesPerPageInput,
  setMinutesPerPageInput,
  onSavePreferences,
  activeTimers,
  now,
  formatRemaining,
  onPauseOrResume,
  onCancelTimer,
  onClaim,
  showTutorialClaimPlaceholder = false,
}) {
  const durationValue = Number(durationMinutes);
  const isDurationOverLimit =
    Number.isFinite(durationValue) && durationValue > MAX_SESSION_MINUTES;
  const safeDuration = Math.max(
    1,
    Math.min(
      MAX_SESSION_MINUTES,
      Math.floor(Number.isFinite(durationValue) ? durationValue : 1),
    ),
  );
  const visualClock = `${String(safeDuration).padStart(2, "0")}:00`;
  const [isFocusExpanded, setIsFocusExpanded] = useState(false);

  const focusTimer = useMemo(() => {
    if (!activeTimers.length) {
      return null;
    }

    const runningTimers = activeTimers.filter((timer) => !timer.isPaused);
    const pool = runningTimers.length ? runningTimers : activeTimers;
    return [...pool].sort(
      (a, b) => getTimerRemaining(a, now) - getTimerRemaining(b, now),
    )[0];
  }, [activeTimers, now]);

  const focusRemaining = focusTimer
    ? getTimerRemaining(focusTimer, now)
    : safeDuration * 60 * 1000;
  const focusReady = Boolean(focusTimer) && focusRemaining <= 0;
  const hasTimerGoal = timerLabel.trim().length > 0;
  const visualLabel = focusTimer
    ? focusTimer.label
    : timerLabel.trim();
  const visualTimerText = focusTimer
    ? formatRemaining(focusRemaining)
    : visualClock;

  useEffect(() => {
    if (!focusTimer) {
      setIsFocusExpanded(false);
      return;
    }

    if (!focusTimer.isPaused) {
      setIsFocusExpanded(true);
    }
  }, [focusTimer]);

  useEffect(() => {
    if (!isFocusExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFocusExpanded]);

  const onStartFocus = (event) => {
    if (!hasTimerGoal || isDurationOverLimit) {
      return;
    }
    setIsFocusExpanded(true);
    onCreateTimer?.(event);
  };

  const onMinutesInputChange = (event) => {
    const digits = event.target.value.replace(/\D/g, "");
    setDurationMinutes(digits ? Number(digits) : "");
  };

  const onMinutesPerPageInputChange = (event) => {
    const digits = event.target.value.replace(/\D/g, "");
    setMinutesPerPageInput(digits ? Number(digits) : "");
  };

  const onPauseOrResumeFocus = () => {
    if (!focusTimer) {
      return;
    }
    const wasPaused = Boolean(focusTimer.isPaused);
    onPauseOrResume(focusTimer._id);
    if (!wasPaused) {
      setIsFocusExpanded(false);
      return;
    }
    setIsFocusExpanded(true);
  };

  const onCancelFocus = () => {
    if (!focusTimer) {
      return;
    }
    onCancelTimer(focusTimer._id);
    setIsFocusExpanded(false);
  };

  const onClaimFocus = (event) => {
    if (!focusTimer) {
      return;
    }
    onClaim(focusTimer._id, event.currentTarget);
  };

  const onReturnToFocus = () => {
    if (!focusTimer) {
      return;
    }
    if (focusTimer.isPaused) {
      onPauseOrResume(focusTimer._id);
    }
    setIsFocusExpanded(true);
  };

  const focusPortalRoot =
    typeof document !== "undefined"
      ? (document.querySelector(".dashboard-shell") ?? document.body)
      : null;

  return (
    <div className="dash-grid timers-grid">
      <section
        className="panel timers-panel"
        data-tutorial-anchor="timers-create"
      >
        <div className="section-head timer-section-head">
          <div className="timer-section-head-inline">
            <h2>Timers & Unlock Ratio</h2>
            <HintPopover
              label="Timers and unlock ratio info"
              message="Create timers for focused sessions and set how many minutes are required to unlock each reading page."
            />
          </div>
        </div>

        <div className="timer-create-layout">
          <div className="stack">
            <label>
              Goal
              <input
                type="text"
                maxLength={60}
                placeholder="What do you plan to do this session"
                value={timerLabel}
                onChange={(event) => setTimerLabel(event.target.value)}
              />
            </label>

            <label>
              Minutes
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={durationMinutes}
                onChange={onMinutesInputChange}
              />
              {isDurationOverLimit && (
                <span className="timer-duration-warning">
                  {LONG_SESSION_WARNING}
                </span>
              )}
            </label>

            <label data-tutorial-anchor="timers-ratio">
              <span className="label-with-hint">
                Minutes needed per page unlock
                <HintPopover
                  label="Unlock ratio details"
                  message="Set how many focus minutes are required before one new page can be unlocked."
                />
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minutesPerPageInput}
                onChange={onMinutesPerPageInputChange}
              />
            </label>

            <button type="button" className="ghost" onClick={onSavePreferences}>
              Save Unlock Ratio
            </button>
          </div>

          <aside
            className={`timer-create-visual timer-focus-shell${focusTimer ? " has-active-timer" : ""}`}
          >
            <p className="timer-visual-mode">focus session</p>
            <p className="timer-visual-clock">{visualTimerText}</p>

            {focusTimer && <p className="timer-focus-label">{visualLabel}</p>}

            {!focusTimer && (
              <button
                type="button"
                className="timer-visual-start-btn"
                disabled={
                  timerState.busy || !hasTimerGoal || isDurationOverLimit
                }
                onClick={onStartFocus}
              >
                {timerState.busy ? "starting..." : "start"}
              </button>
            )}

            {focusTimer && !isFocusExpanded && (
              <div className="timer-focus-collapsed-actions">
                <button
                  type="button"
                  className="action"
                  onClick={onReturnToFocus}
                >
                  {focusTimer.isPaused
                    ? "Resume Focus Session"
                    : "Return to Focus Session"}
                </button>
                <button type="button" className="ghost" onClick={onCancelFocus}>
                  Cancel
                </button>
              </div>
            )}
          </aside>
        </div>

        {isFocusExpanded &&
          focusTimer &&
          focusPortalRoot &&
          createPortal(
            <div className="timer-create-visual timer-focus-shell has-active-timer focus-expanded">
              <p className="timer-visual-mode">focus session</p>
              <p className="timer-visual-clock">{visualTimerText}</p>
              <p className="timer-focus-label">{visualLabel}</p>
              <div
                className="timer-focus-actions"
                data-tutorial-anchor="timers-claim"
              >
                <button
                  type="button"
                  className="ghost"
                  onClick={onPauseOrResumeFocus}
                >
                  {focusTimer.isPaused ? "Resume" : "Pause"}
                </button>
                <button type="button" className="ghost" onClick={onCancelFocus}>
                  Cancel
                </button>
                {focusReady && (
                  <button
                    type="button"
                    className="action"
                    disabled={timerState.busy || focusTimer.isPaused}
                    onClick={onClaimFocus}
                  >
                    Claim
                  </button>
                )}
              </div>
            </div>,
            focusPortalRoot,
          )}

        {showTutorialClaimPlaceholder && !(isFocusExpanded && focusTimer) && (
          <div
            className="timer-claim-placeholder"
            data-tutorial-anchor="timers-claim"
          >
            <p className="status-text">
              Finish a timer to unlock the pause, cancel, and claim controls.
            </p>
            <div className="timer-focus-actions">
              <button type="button" className="ghost" disabled>
                Pause
              </button>
              <button type="button" className="ghost" disabled>
                Cancel
              </button>
              <button type="button" className="action" disabled>
                Claim
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
