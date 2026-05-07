import { useEffect } from "react";

const PATCH_NOTES_DISPLAY_VERSION = "v0.1.1";

const PATCH_NOTES_COPY = {
  en: {
    ariaLabel: "Patch notes",
    title: "Inkling v0.1.1 patch notes",
    sections: [
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
    footer: "Patch notes only appear once for this version.",
    button: "Continue",
  },
  vi: {
    ariaLabel: "Ghi chú cập nhật",
    title: "Ghi chú cập nhật Inkling v0.1.1",
    sections: [
      {
        heading: "Mới",
        entries: [
          "thêm phân chi tiết cập nhật trong mục Trợ Giúp",
          "Giới hạn tệp đặng trên Group dưới 25MB",
        ],
      },
      {
        heading: "UI fixes",
        entries: [
          "Khi hơ chuột ở mấy cái tiền tệ thì nó sẽ giải thích",
          "Khi tải PDF lên thì sẽ có thumbnail",
          "Khi mở một cuốn sách thì nó sẽ hiện cái thanh trên và nếu kéo xuống thì nó sẽ ở vị trí mà nhìn được hết cuốn sách nên bớt hoang mang là có nút trở về bảng điều khiển không",
        ],
      },
      {
        heading: "Bug fixes and optimizations",
        entries: [
          "Dọn code",
          "Sửa bug không đọc được sách trong marketplace",
          "Load được nhiều sách cùng 1 lúc",
          "sửa bug chat bị chồng lên nhau trong Groups",
          "Sách local giờ dùng chung R2 bucket của Cloudflare nên load nhanh hơn",
        ],
      },
    ],
    footer: "Ghi chú cập nhật chỉ hiện một lần cho phiên bản này.",
    button: "Tiếp tục",
  },
};

export default function PatchNotesOverlay({ language = "vi", onClose }) {
  const copy = PATCH_NOTES_COPY[language] ?? PATCH_NOTES_COPY.vi;

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
      className="settings-overlay patch-notes-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={copy.ariaLabel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="panel patch-notes-card">
        <header className="patch-notes-header">
          <p className="dash-kicker">{PATCH_NOTES_DISPLAY_VERSION}</p>
          <h2>{copy.title}</h2>
        </header>

        <div className="patch-notes-list">
          {copy.sections.map((section) => (
            <section key={section.heading} className="patch-notes-section">
              <h3>{section.heading}</h3>
              <ul>
                {section.entries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="patch-notes-actions">
          <p>{copy.footer}</p>
          <button type="button" className="action" onClick={onClose}>
            {copy.button}
          </button>
        </footer>
      </section>
    </section>
  );
}
