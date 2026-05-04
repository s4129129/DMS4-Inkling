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
          +{Math.max(1, Math.floor(burst.amount || 0))} Ink
        </div>
      ))}
    </div>
  );
}
