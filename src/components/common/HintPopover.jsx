import { useEffect, useId, useRef, useState } from "react";
import infoIcon from "../../assets/Icons/Info_fill.svg";

export default function HintPopover({ label, message }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const onToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <span
      className={`hint-popover-shell${isOpen ? " is-open" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="hint-inline hint-popover-trigger"
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={tooltipId}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
      >
        <img src={infoIcon} alt="" />
      </button>

      <span id={tooltipId} className="hint-popover" role="tooltip">
        {message}
      </span>
    </span>
  );
}
