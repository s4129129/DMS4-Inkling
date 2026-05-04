import { ICON_SIZE_CONTROLS, sizeControlRem } from "../controls/sizeControls";
import timerIcon from "../assets/Icons/Timer_fill.svg";
import libraryIcon from "../assets/Icons/Library_fill.svg";
import dataIcon from "../assets/Icons/Chart_fill.svg";
import calendarIcon from "../assets/Icons/Calendar_fill.svg";
import marketIcon from "../assets/Icons/Marketplace.svg";
import groupsIcon from "../assets/Icons/Group_fill.svg";
import helpIcon from "../assets/Icons/Help_fill.svg";
import settingsIcon from "../assets/Icons/Setting_fill.svg";

const SECTIONS = [
  {
    key: "dashboard",
    label: "Overview",
    icon: dataIcon,
    sizeKey: "sidebarDataIcon",
  },
  {
    key: "timers",
    label: "Timers",
    icon: timerIcon,
    sizeKey: "sidebarTimerIcon",
  },
  {
    key: "library",
    label: "Library",
    icon: libraryIcon,
    sizeKey: "sidebarLibraryIcon",
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: calendarIcon,
    sizeKey: "sidebarDataIcon",
  },
  {
    key: "market",
    label: "Marketplace",
    icon: marketIcon,
    sizeKey: "sidebarMarketIcon",
  },
  {
    key: "groups",
    label: "Groups",
    icon: groupsIcon,
    sizeKey: "sidebarGroupsIcon",
  },
];

export default function DashboardSidebar({
  activeSection,
  onSelectSection,
  onOpenSupport,
  onOpenSettings,
  onSignOut,
  exitLabel = "Log out",
  disabledSections = [],
  disabledSectionReasons = {},
  onBlockedSectionSelect,
  sidebarWidth,
  onResizeSidebar,
}) {
  const sizeVars = {};
  const disabledSectionSet = new Set(
    Array.isArray(disabledSections) ? disabledSections : [],
  );

  const getDisabledReason = (sectionKey) =>
    String(disabledSectionReasons?.[sectionKey] || "").trim() ||
    "This area requires an account.";

  const onSectionSelect = (sectionKey) => {
    if (!disabledSectionSet.has(sectionKey)) {
      onSelectSection(sectionKey);
      return;
    }

    onBlockedSectionSelect?.(sectionKey, getDisabledReason(sectionKey));
  };

  const onSidebarResizePointerDown = (event) => {
    if (!onResizeSidebar) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth =
      Number(sidebarWidth) ||
      event.currentTarget.parentElement?.getBoundingClientRect?.().width ||
      300;

    const onPointerMove = (moveEvent) => {
      onResizeSidebar(Math.round(startWidth + moveEvent.clientX - startX));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const onSidebarResizeKeyDown = (event) => {
    if (!onResizeSidebar || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    onResizeSidebar((Number(sidebarWidth) || 300) + direction * 16);
  };

  return (
    <aside className="panel dash-sidebar" style={sizeVars}>
      <div className="dash-nav-mobile" aria-label="Dashboard section picker">
        <select
          className="dash-nav-select"
          aria-label="Select dashboard section"
          value={activeSection}
          onChange={(event) => onSectionSelect(event.target.value)}
        >
          {SECTIONS.map((section) => (
            <option
              key={section.key}
              value={section.key}
              disabled={disabledSectionSet.has(section.key)}
            >
              {section.label}
              {disabledSectionSet.has(section.key)
                ? " (Account required)"
                : ""}
            </option>
          ))}
        </select>
      </div>
      <nav className="dash-nav" aria-label="Dashboard sections">
        {SECTIONS.map((section) => {
          const isDisabled = disabledSectionSet.has(section.key);
          const disabledReason = getDisabledReason(section.key);

          return (
            <button
              key={section.key}
              type="button"
              className={`dash-nav-item${activeSection === section.key ? " active" : ""}${isDisabled ? " is-disabled" : ""}`}
              onClick={() => onSectionSelect(section.key)}
              style={{
                "--dash-nav-icon-size": sizeControlRem(
                  ICON_SIZE_CONTROLS[section.sizeKey],
                ),
              }}
              aria-disabled={isDisabled}
              title={isDisabled ? disabledReason : undefined}
            >
              <img src={section.icon} alt="" className="dash-nav-icon" />
              <span>{section.label}</span>
              {isDisabled && (
                <span className="dash-nav-item-lock-reason" role="note">
                  {disabledReason}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <footer className="dash-sidebar-footer">
        <div className="dash-sidebar-footer-actions">
          <div
            className="dash-brand-tools dash-footer-tools"
            aria-label="Sidebar quick actions"
          >
            <button
              type="button"
              className="dash-icon-btn dash-footer-action-btn"
              onClick={onOpenSupport}
              title="Support"
              aria-label="Open support"
            >
              <img
                src={helpIcon}
                alt=""
                className="dash-side-tool-icon"
                style={{
                  "--dash-tool-icon-size": sizeControlRem(
                    ICON_SIZE_CONTROLS.sidebarHelpIcon,
                  ),
                }}
              />
              <span>Help</span>
            </button>
            <button
              type="button"
              className="dash-icon-btn dash-footer-action-btn"
              onClick={onOpenSettings}
              title="Settings"
              aria-label="Open settings"
            >
              <img
                src={settingsIcon}
                alt=""
                className="dash-side-tool-icon"
                style={{
                  "--dash-tool-icon-size": sizeControlRem(
                    ICON_SIZE_CONTROLS.sidebarSettingsIcon,
                  ),
                }}
              />
              <span>Settings</span>
            </button>
          </div>

          <button
            type="button"
            className="dash-logout-btn"
            onClick={onSignOut}
            style={{
              "--dash-nav-icon-size": sizeControlRem(
                ICON_SIZE_CONTROLS.sidebarLogoutIcon,
              ),
            }}
          >
            <span className="dash-nav-icon-svg" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M9 4.2A2.2 2.2 0 0 1 11.2 2h6.6A2.2 2.2 0 0 1 20 4.2v15.6a2.2 2.2 0 0 1-2.2 2.2h-6.6A2.2 2.2 0 0 1 9 19.8V16h2v3.8a.2.2 0 0 0 .2.2h6.6a.2.2 0 0 0 .2-.2V4.2a.2.2 0 0 0-.2-.2h-6.6a.2.2 0 0 0-.2.2V8H9V4.2z" />
                <path d="M3.3 11a1 1 0 0 0 0 2h8.6l-2.4 2.4a1 1 0 1 0 1.4 1.4l4.1-4.1a1 1 0 0 0 0-1.4l-4.1-4.1a1 1 0 1 0-1.4 1.4L11.9 11H3.3z" />
              </svg>
            </span>
            <span>{exitLabel}</span>
          </button>
        </div>
      </footer>
      {onResizeSidebar ? (
        <div
          className="dash-sidebar-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onPointerDown={onSidebarResizePointerDown}
          onKeyDown={onSidebarResizeKeyDown}
        />
      ) : null}
    </aside>
  );
}
