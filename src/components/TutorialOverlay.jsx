import { useEffect, useState } from "react";

function normalizeSpotlightRect(rect) {
  if (!rect) {
    return null;
  }

  const padding = 10;
  const safeTop = Math.max(8, rect.top - padding);
  const safeLeft = Math.max(8, rect.left - padding);
  const safeWidth = Math.max(48, rect.width + padding * 2);
  const safeHeight = Math.max(44, rect.height + padding * 2);

  return {
    top: safeTop,
    left: safeLeft,
    width: safeWidth,
    height: safeHeight,
  };
}

export default function TutorialOverlay({
  steps,
  stepIndex,
  onBack,
  onNext,
  onComplete,
  onSkip,
}) {
  const step = steps[stepIndex] ?? null;
  const totalSteps = steps.length;
  const isLastStep = stepIndex >= totalSteps - 1;
  const [spotlightRect, setSpotlightRect] = useState(null);

  const onAdvanceStep = () => {
    if (isLastStep) {
      onComplete?.();
      return;
    }
    onNext?.();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!step?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    const updateSpotlight = () => {
      const target = document.querySelector(step.targetSelector);
      if (!target) {
        setSpotlightRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) {
        setSpotlightRect(null);
        return;
      }

      setSpotlightRect(normalizeSpotlightRect(rect));
    };

    updateSpotlight();
    const rafId = window.requestAnimationFrame(updateSpotlight);
    const timerA = window.setTimeout(updateSpotlight, 120);
    const timerB = window.setTimeout(updateSpotlight, 280);

    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerA);
      window.clearTimeout(timerB);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [step?.targetSelector, stepIndex]);

  useEffect(() => {
    const onEscapeKey = (event) => {
      if (event.key === "Escape") {
        onSkip?.();
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [onSkip]);

  if (!step) {
    return null;
  }

  return (
    <section
      className="tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard tutorial"
      onPointerDown={(event) => {
        if (event.target.closest(".tutorial-card")) {
          return;
        }
        onAdvanceStep();
      }}
    >
      {spotlightRect ? (
        <>
          <div
            className="tutorial-cutout-backdrop tutorial-cutout-top"
            style={{
              height: `${spotlightRect.top}px`,
            }}
          />
          <div
            className="tutorial-cutout-backdrop tutorial-cutout-left"
            style={{
              top: `${spotlightRect.top}px`,
              width: `${spotlightRect.left}px`,
              height: `${spotlightRect.height}px`,
            }}
          />
          <div
            className="tutorial-cutout-backdrop tutorial-cutout-right"
            style={{
              top: `${spotlightRect.top}px`,
              left: `${spotlightRect.left + spotlightRect.width}px`,
              height: `${spotlightRect.height}px`,
            }}
          />
          <div
            className="tutorial-cutout-backdrop tutorial-cutout-bottom"
            style={{
              top: `${spotlightRect.top + spotlightRect.height}px`,
            }}
          />
        </>
      ) : (
        <div className="tutorial-overlay-backdrop" />
      )}

      <aside className="tutorial-card">
        <p className="tutorial-progress">
          Step {stepIndex + 1} / {totalSteps}
        </p>
        <h3>{step.title}</h3>
        <p>{step.description}</p>

        <div className="market-actions-row tutorial-card-actions">
          <button type="button" className="ghost" onClick={onSkip}>
            Skip Tutorial
          </button>
          <button
            type="button"
            className="ghost"
            onClick={onBack}
            disabled={stepIndex <= 0}
          >
            Back
          </button>
          <button
            type="button"
            className="action"
            onClick={onAdvanceStep}
          >
            {isLastStep ? "Finish Tutorial" : "Next Step"}
          </button>
        </div>
      </aside>
    </section>
  );
}
