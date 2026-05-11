import { useEffect, useState } from "react";
import { getFaqItems } from "./faqItems";

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

const PATCH_LOG_LABELS = {
  en: {
    nav: "Update Details",
    heading: "Update Details",
    versionPrefix: "Update",
  },
  vi: {
    nav: "Chi ti\u1ebft c\u1eadp nh\u1eadt",
    heading: "Chi ti\u1ebft c\u1eadp nh\u1eadt",
    versionPrefix: "C\u1eadp nh\u1eadt",
  },
};

const HELP_LABELS = {
  en: {
    shell: "Help",
    tutorial: "Tutorial",
    contact: "Contact",
    faq: "FAQ",
    close: "Close help",
  },
  vi: {
    shell: "Tr\u1ee3 gi\u00fap",
    tutorial: "H\u01b0\u1edbng d\u1eabn",
    contact: "Li\u00ean h\u1ec7",
    faq: "FAQ",
    close: "\u0110\u00f3ng tr\u1ee3 gi\u00fap",
  },
};

const PATCH_LOGS = [
  {
    version: "0.1.2",
    sections: {
      en: [
        {
          heading: "New stuff",
          entries: [
            "Added 1 new theme: Tech fancy",
            "A notification system for Groups",
            "Tablet and Mobile adaptability",
          ],
        },
        {
          heading: "UI fixes",
          entries: [
            "Remove timeline in Overview and move Sessions up to replace",
            "Remove progress bar when reading books",
            "Fix alot of design inconsistency in the default theme",
          ],
        },
        {
          heading: "Bug fixes and optimizations",
          entries: [
            "Fix default interaction being buyable",
            "Fix overview calendar not showing all the dates and forcing users to scroll down a bit to see more",
          ],
        },
      ],
      vi: [
        {
          heading: "Mới",
          entries: [
            "Thêm 1 giao diện mới: Tech fancy (Công nghệ thời thượng)",
            "Hệ thống thông báo mới dành cho các Hội nhóm (Groups)",
            "Tối ưu hóa khả năng hiển thị trên Máy tính bảng và Điện thoại (Responsive)",
          ],
        },
        {
          heading: "Sửa lỗi giao diện (UI)",
          entries: [
            'Loại bỏ phần "Dòng thời gian" (Timeline) trong mục Tổng quan (Overview) và đưa mục Phiên làm việc (Sessions) lên thay thế',
            "Ẩn thanh tiến trình khi đang đọc sách",
            "Khắc phục nhiều điểm thiết kế chưa đồng bộ ở giao diện mặc định (Default theme)",
          ],
        },
        {
          heading: "Sửa lỗi và Tối ưu hóa hệ thống",
          entries: [
            "Sửa lỗi hệ thống cho phép mua các tương tác mặc định (vốn phải được miễn phí)",
            "Sửa lỗi lịch tổng quan không hiển thị đầy đủ các ngày trong tháng, khắc phục tình trạng người dùng phải cuộn chuột xuống mới xem được hết",
          ],
        },
      ],
    },
  },
  {
    version: "0.1.1",
    sections: {
      en: [
        {
          heading: "New stuff",
          entries: [
            "added a changelog in the help section",
            "limit user attachment in groups to 25mb",
          ],
        },
        {
          heading: "UI fixes",
          entries: [
            "Added designed popups for the currency to better explain what it actually does",
            "Actually generates a thumbnail for local PDFs now",
            "Opening a book shows the top bar now and scrolling now goes to the perfect reading spot so less confusing on if theres a go back button",
          ],
        },
        {
          heading: "Bug fixes and optimizations",
          entries: [
            "Code reorganization",
            "fixed not being able to read books from the marketplace",
            "Re-added loading multiple PDFs at once",
            "Fixed the cramped Groups UI bug",
            "User book and marketplace books now correctly linked with Cloudflare's R2 bucket so faster load times and more storage",
          ],
        },
      ],
      vi: [
        {
          heading: "M\u1edbi",
          entries: [
            "th\u00eam ph\u00e2n chi ti\u1ebft c\u1eadp nh\u1eadt trong m\u1ee5c Tr\u1ee3 Gi\u00fap",
            "Gi\u1edbi h\u1ea1n t\u1ec7p \u0111\u1eb7ng tr\u00ean Group d\u01b0\u1edbi 25MB",
          ],
        },
        {
          heading: "UI fixes",
          entries: [
            "Khi h\u01a1 chu\u1ed9t \u1edf m\u1ea5y c\u00e1i ti\u1ec1n t\u1ec7 th\u00ec n\u00f3 s\u1ebd gi\u1ea3i th\u00edch",
            "Khi t\u1ea3i PDF l\u00ean th\u00ec s\u1ebd c\u00f3 thumbnail",
            "Khi m\u1edf m\u1ed9t cu\u1ed1n s\u00e1ch th\u00ec n\u00f3 s\u1ebd hi\u1ec7n c\u00e1i thanh tr\u00ean v\u00e0 n\u1ebfu k\u00e9o xu\u1ed1ng th\u00ec n\u00f3 s\u1ebd \u1edf v\u1ecb tr\u00ed m\u00e0 nh\u00ecn \u0111\u01b0\u1ee3c h\u1ebft cu\u1ed1n s\u00e1ch n\u00ean b\u1edbt hoang mang l\u00e0 c\u00f3 n\u00fat tr\u1edf v\u1ec1 b\u1ea3ng \u0111i\u1ec1u khi\u1ec3n kh\u00f4ng",
          ],
        },
        {
          heading: "Bug fixes and optimizations",
          entries: [
            "D\u1ecdn code",
            "S\u1eeda bug kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c s\u00e1ch trong marketplace",
            "Load \u0111\u01b0\u1ee3c nhi\u1ec1u s\u00e1ch c\u00f9ng 1 l\u00fac",
            "s\u1eeda bug chat b\u1ecb ch\u1ed3ng l\u00ean nhau trong Groups",
            "S\u00e1ch local gi\u1edd d\u00f9ng chung R2 bucket c\u1ee7a Cloudflare n\u00ean load nhanh h\u01a1n",
          ],
        },
      ],
    },
  },
];

export default function SupportOverlay({
  language = "vi",
  onClose,
  onStartTutorial,
}) {
  const [activeTab, setActiveTab] = useState("tutorial");
  const tutorialHints = TUTORIAL_HINTS[language] ?? TUTORIAL_HINTS.vi;
  const faqItems = getFaqItems(language);
  const patchLogLabels = PATCH_LOG_LABELS[language] ?? PATCH_LOG_LABELS.vi;
  const helpLabels = HELP_LABELS[language] ?? HELP_LABELS.vi;
  const activeHeading =
    {
      tutorial: helpLabels.tutorial,
      support: helpLabels.contact,
      faq: helpLabels.faq,
      patchlogs: patchLogLabels.heading,
    }[activeTab] ?? helpLabels.shell;

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
      aria-label={helpLabels.shell}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="panel settings-shell support-shell">
        <div className="settings-shell-inner">
          <aside className="settings-nav-panel" aria-label={`${helpLabels.shell} tabs`}>
            <p className="settings-nav-title">{helpLabels.shell}</p>
            <button
              type="button"
              className={`settings-nav-item${activeTab === "tutorial" ? " active" : ""}`}
              onClick={() => setActiveTab("tutorial")}
            >
              {helpLabels.tutorial}
            </button>
            <button
              type="button"
              className={`settings-nav-item${
                activeTab === "support" ? " active" : ""
              }`}
              onClick={() => setActiveTab("support")}
            >
              {helpLabels.contact}
            </button>
            <button
              type="button"
              className={`settings-nav-item${activeTab === "faq" ? " active" : ""}`}
              onClick={() => setActiveTab("faq")}
            >
              {helpLabels.faq}
            </button>
            <button
              type="button"
              className={`settings-nav-item${
                activeTab === "patchlogs" ? " active" : ""
              }`}
              onClick={() => setActiveTab("patchlogs")}
            >
              {patchLogLabels.nav}
            </button>
          </aside>

          <article className="settings-content-panel support-content-panel">
            <div className="settings-header-row">
              <h2>{activeHeading}</h2>
              <button
                type="button"
                className="ghost settings-close-btn"
                onClick={onClose}
                aria-label={helpLabels.close}
                title={helpLabels.close}
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
                {faqItems.map((item, index) => (
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

            {activeTab === "patchlogs" && (
              <div className="support-patch-log-list">
                <h3>{patchLogLabels.heading}</h3>
                {PATCH_LOGS.map((patch) => (
                  <article key={patch.version} className="support-patch-log">
                    <header className="support-patch-log-header">
                      <p className="dash-kicker">
                        {patchLogLabels.versionPrefix} {patch.version}
                      </p>
                    </header>
                    {(patch.sections[language] ?? patch.sections.vi).map(
                      (section) => (
                        <section
                          key={section.heading}
                          className="support-patch-log-section"
                        >
                          <h4>{section.heading}</h4>
                          <ul>
                            {section.entries.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        </section>
                      ),
                    )}
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
