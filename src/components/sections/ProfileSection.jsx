import { useEffect } from "react";

export default function ProfileSection({ me, onClose, onSignOut }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [onClose]);

  return (
    <section
      className="settings-overlay profile-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
    >
      <section className="panel settings-shell profile-shell">
        <div className="settings-shell-inner">
          <aside className="settings-nav-panel" aria-label="Profile tabs">
            <p className="settings-nav-title">Profile</p>
            <button type="button" className="settings-nav-item active">
              Account
            </button>
            <button type="button" className="settings-nav-item" disabled>
              Security (Soon)
            </button>
            <button type="button" className="settings-nav-item" disabled>
              Billing (Soon)
            </button>
          </aside>

          <article className="settings-content-panel profile-content-panel">
            <div className="settings-header-row">
              <h2>Profile</h2>
              <button
                type="button"
                className="ghost settings-close-btn"
                onClick={onClose}
                aria-label="Close profile"
                title="Close profile"
              >
                x
              </button>
            </div>

            <div className="profile-placeholder-card">
              <div className="profile-avatar-pill">{me?.initials || "U"}</div>
              <div>
                <h3>{me?.name || "User"}</h3>
                <p className="status-text">{me?.email || "No email"}</p>
                <p className="status-text">
                  Placeholder profile window. Account preferences and security
                  controls can be added here.
                </p>
              </div>
            </div>

            <div className="market-actions-row">
              <button type="button" className="ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="action" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}
