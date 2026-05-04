import { useEffect } from "react";
import { FAQ_ITEMS } from "./faqItems";

export default function FaqOverlay({ onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [onClose]);

  return (
    <section
      className="settings-overlay faq-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="FAQ"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="panel faq-card">
        <header className="faq-card-header">
          <h2>FAQ</h2>
          <button
            type="button"
            className="ghost settings-close-btn"
            onClick={onClose}
            aria-label="Close FAQ"
            title="Close"
          >
            x
          </button>
        </header>

        <div className="faq-list">
          {FAQ_ITEMS.map((item, index) => (
            <article key={item.question} className="faq-item">
              <h3>
                {index + 1}. {item.question}
              </h3>
              <ul>
                {item.answers.map((answer) => (
                  <li key={answer}>{answer}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <footer className="faq-card-actions">
          <button type="button" className="action" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </section>
  );
}
