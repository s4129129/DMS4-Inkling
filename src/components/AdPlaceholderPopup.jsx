export default function AdPlaceholderPopup({ isOpen, secondsLeft }) {
  if (!isOpen) {
    return null;
  }

  return (
    <section
      className="ad-placeholder-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Ad break"
    >
      <div className="ad-placeholder-backdrop" />
      <article className="ad-placeholder-card panel">
        <p className="data-overview-kicker">Sponsored</p>
        <h3>Advertisement</h3>

        <div className="ad-placeholder-stage" aria-hidden="true">
          <span>{Math.max(0, secondsLeft)}s</span>
        </div>
      </article>
    </section>
  );
}
