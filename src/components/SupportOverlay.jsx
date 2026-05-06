import { useEffect, useState } from "react";
import { FAQ_ITEMS } from "./faqItems";

const TUTORIAL_HINTS = {
  en: [
    "Upload a book from your device or select a free book in the Marketplace.",
    "Create a timer and set it for how long you want to work.",
    "Set how much time it takes to unlock a page.",
    "When complete, press Claim to unlock pages for your book.",
    "Check the Marketplace for dashboard customization and books.",
  ],
  vi: [
    "Tải sách từ máy hoặc chọn sách miễn phí trong cửa hàng.",
    "Tạo và thiết lập thời gian làm việc.",
    "Cài đặt mức thời gian cần thiết để mở khóa một trang sách.",
    'Sau khi hoàn thành, nhấn "Nhận" (Claim) để mở khóa các trang sách của bạn.',
    "Ghé thăm Cửa hàng để tìm kiếm các mẫu cá nhân hóa giao diện và sách mới.",
  ],
};

export default function SupportOverlay({
  language = "vi",
  onClose,
  onStartTutorial,
}) {
  const [activeTab, setActiveTab] = useState("tutorial");
  const tutorialHints = TUTORIAL_HINTS[language] ?? TUTORIAL_HINTS.vi;

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
        onClose?.();
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [onClose]);

  return (
    <section
      className="settings-overlay support-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Support"
    >
      <section className="panel settings-shell support-shell">
        <div className="settings-shell-inner">
          <aside className="settings-nav-panel" aria-label="Support tabs">
            <p className="settings-nav-title">Support</p>
            <button
              type="button"
              className={`settings-nav-item${activeTab === "tutorial" ? " active" : ""}`}
              onClick={() => setActiveTab("tutorial")}
            >
              Tutorial
            </button>
            <button
              type="button"
              className={`settings-nav-item${
                activeTab === "support" ? " active" : ""
              }`}
              onClick={() => setActiveTab("support")}
            >
              Support
            </button>
            <button
              type="button"
              className={`settings-nav-item${activeTab === "faq" ? " active" : ""}`}
              onClick={() => setActiveTab("faq")}
            >
              FAQ
            </button>
          </aside>

          <article className="settings-content-panel support-content-panel">
            <div className="settings-header-row">
              <h2>Support</h2>
              <button
                type="button"
                className="ghost settings-close-btn"
                onClick={onClose}
                aria-label="Close support"
                title="Close support"
              >
                x
              </button>
            </div>

            {activeTab === "tutorial" && (
              <div className="support-panel-grid">
                <ol className="support-tutorial-steps">
                  {tutorialHints.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="market-actions-row">
                  <button
                    type="button"
                    className="action"
                    onClick={onStartTutorial}
                  >
                    Start Tutorial
                  </button>
                </div>
              </div>
            )}

            {activeTab === "support" && (
              <div className="support-panel-grid">
                <section className="support-contact-card">
                  <p>
                    For more information or critique, you can contact me at{" "}
                    <a href="mailto:s4129129@rmit.edu.vn">
                      s4129129@rmit.edu.vn
                    </a>
                  </p>
                </section>
              </div>
            )}

            {activeTab === "faq" && (
              <div className="faq-list support-faq-list">
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
            )}
          </article>
        </div>
      </section>
    </section>
  );
}
