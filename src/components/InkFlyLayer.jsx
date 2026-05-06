export default function InkFlyLayer({ bursts, onDone }) {
  if (!bursts?.length) {
    return null;
  }

  return (
    <div className="ink-fly-layer" aria-hidden>
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="ink-fly-token"
          style={{
            "--ink-start-x": `${burst.startX}px`,
            "--ink-start-y": `${burst.startY}px`,
            "--ink-delta-x": `${burst.deltaX}px`,
            "--ink-delta-y": `${burst.deltaY}px`,
          }}
          onAnimationEnd={() => onDone?.(burst.id)}
        >
          <span>+{Math.max(1, Math.floor(burst.amount || 0))}</span>
          <span className="currency-icon ink-inline-icon" aria-hidden>
            <svg viewBox="0 0 24 24" role="img" focusable="false">
              <path d="M12 2.4c-.4 0-.7.2-.9.5-1.3 2.2-5.6 6.7-5.6 10.8 0 3.7 2.9 7.3 6.6 7.3 3.9 0 6.8-3.2 6.8-7.2 0-4.2-4.7-8.9-6-10.9-.2-.3-.5-.5-.9-.5z" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  );
}
