const PRO_FEATURES = [
  "5x local file uploads",
  "No ads",
  "2x Ink gained",
  "x2 Quill gained",
  "Able to publish items on the marketplace",
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
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
