import { useEffect } from "react";

const PATCH_NOTES_COPY = {
  en: {
    ariaLabel: "Patch notes",
    title: "Inkling v0.1 patch notes",
    body: "This update tightens the first public version of Inkling with clearer onboarding, cleaner marketplace cards, better Vietnamese coverage, and a few dashboard fixes.",
    items: [
      "New users now see onboarding in order: tutorial, FAQ, then patch notes.",
      "Marketplace cards use less space by removing extra status badges.",
      "Ink currency now appears as an icon in the main UI.",
      "Group weekly progress now clearly says how many members are required to activate it.",
      "Vietnamese labels were expanded across charts, settings, groups, and reader controls.",
      "The dashboard timeline no longer shows a fake reading session when there are no sessions.",
    ],
    footer: "Patch notes only appear once for this version.",
    button: "Continue",
  },
  vi: {
    ariaLabel: "Ghi chú cập nhật",
    title: "Ghi chú cập nhật Inkling v0.1",
    body: "Bản cập nhật này chỉnh lại phiên bản công khai đầu tiên của Inkling với hướng dẫn rõ hơn, thẻ Cửa hàng gọn hơn, hỗ trợ tiếng Việt tốt hơn và một vài sửa lỗi bảng điều khiển.",
    items: [
      "Người dùng mới sẽ thấy đúng thứ tự: hướng dẫn, FAQ, rồi ghi chú cập nhật.",
      "Thẻ trong Cửa hàng gọn hơn nhờ bỏ các nhãn trạng thái thừa.",
      "Tiền tệ Ink trong giao diện chính được hiển thị bằng biểu tượng.",
      "Tiến độ tuần của nhóm nói rõ cần bao nhiêu thành viên để kích hoạt.",
      "Nhãn tiếng Việt được bổ sung cho biểu đồ, cài đặt, nhóm và điều khiển đọc.",
      "Bảng thời gian không còn hiện phiên đọc giả khi chưa có phiên nào.",
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
          <p className="dash-kicker">v0.1</p>
          <h2>{copy.title}</h2>
        </header>

        <p className="patch-notes-body">{copy.body}</p>

        <ul className="patch-notes-list">
          {copy.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

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
