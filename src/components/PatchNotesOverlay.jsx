import { useEffect } from "react";

const PATCH_NOTES_DISPLAY_VERSION = "v0.1.2";

const PATCH_NOTES_COPY = {
  en: {
    ariaLabel: "Patch notes",
    title: "Inkling v0.1.2 patch notes",
    sections: [
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
    footer: "Patch notes only appear once for this version.",
    button: "Continue",
  },
  vi: {
    ariaLabel: "Ghi chú cập nhật",
    title: "Ghi chú cập nhật Inkling v0.1.2",
    sections: [
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
