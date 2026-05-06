const PRO_FEATURES = [
  { id: "uploads", content: "5x local file uploads" },
  { id: "ads", content: "No ads" },
  {
    id: "ink",
    content: (
      <>
        2x{" "}
        <span className="currency-icon ink-inline-icon" aria-hidden>
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 2.4c-.4 0-.7.2-.9.5-1.3 2.2-5.6 6.7-5.6 10.8 0 3.7 2.9 7.3 6.6 7.3 3.9 0 6.8-3.2 6.8-7.2 0-4.2-4.7-8.9-6-10.9-.2-.3-.5-.5-.9-.5z" />
          </svg>
        </span>{" "}
        gained
      </>
    ),
  },
  { id: "quill", content: "x2 Quill gained" },
  { id: "publish", content: "Able to publish items on the marketplace" },
];

export default function BillingOverlay({ onClose }) {
  return (
    <section
      className="billing-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Inkling Pro"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <article className="panel billing-card">
        <button
          type="button"
          className="ghost billing-close-btn"
          onClick={onClose}
          aria-label="Close billing"
          title="Close"
        >
          x
        </button>

        <p className="dash-kicker">Premium</p>
        <h2>Inkling Pro</h2>
        <p className="billing-price">
          <strong>$10</strong>
          <span>/ month</span>
        </p>

        <button type="button" className="action billing-upgrade-btn">
          Upgrade
        </button>

        <ul className="billing-feature-list">
          {PRO_FEATURES.map((feature) => (
            <li key={feature.id}>{feature.content}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
