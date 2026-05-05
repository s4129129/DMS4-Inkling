import { useEffect, useMemo, useState } from "react";
import { ICON_SIZE_CONTROLS, sizeControlRem } from "../controls/sizeControls";
import * as logoCatalog from "../themes/logoCatalog";

export const DASHBOARD_READING_TAB_ID = "dashboard";

function getPresetLogo(presetId) {
  if (typeof logoCatalog.getLogoPresetAsset === "function") {
    return logoCatalog.getLogoPresetAsset(presetId);
  }
  return (
    logoCatalog.DEFAULT_THEME_LOGO ??
    logoCatalog.getThemeLogoAsset?.("default", "light") ??
    ""
  );
}

function streakAccentColor(streakDays) {
  const ratio = Math.min(1, Math.max(0, streakDays) / 30);
  const hue = 32 - ratio * 24;
  return `hsl(${hue} 96% 53%)`;
}

function streakSurfaceColor(streakDays) {
  const ratio = Math.min(1, Math.max(0, streakDays) / 30);
  const red = Math.round(255 - ratio * 26);
  const green = Math.round(168 - ratio * 113);
  const blue = Math.round(58 - ratio * 28);
  return `rgba(${red}, ${green}, ${blue}, 0.2)`;
}

function DashboardActionRow({
  inkBalance,
  pageCredits = 0,
  quillsBalance,
  streak,
  mode,
  onToggleMode,
  onOpenPremium,
  className = "dash-top-actions",
}) {
  const streakDays = Math.max(0, Math.floor(streak ?? 0));
  const streakStyle = useMemo(
    () => ({
      "--streak-accent": streakAccentColor(streakDays),
      "--streak-surface": streakSurfaceColor(streakDays),
    }),
    [streakDays],
  );

  return (
    <div className={className}>
      <div
        className="streak-chip"
        style={streakStyle}
        title="Daily streak"
      >
        <span
          className="streak-flame"
          style={{
            "--streak-icon-size": sizeControlRem(
              ICON_SIZE_CONTROLS.topbarStreakIcon,
            ),
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12.9 2.2c.4 2-1.3 3.7-2.5 5.1-1.3 1.5-2.2 2.7-2.2 4.4 0 1.7 1.2 3.1 2.8 3.1 1.6 0 2.9-1.2 2.9-2.9 0-.8-.3-1.6-.8-2.2 2.7 1.2 4.9 3.9 4.9 7 0 4.2-3.4 7.4-7.8 7.4-4.2 0-7.3-3.2-7.3-7.1 0-4.7 3.5-7.3 6-10.2.9-1.1 1.9-2.5 2.1-4.6.1-.5 1-.5 1.1 0z" />
          </svg>
        </span>
        <span>{streakDays} Streak</span>
      </div>

      <div className="currency-chip page-credit-chip" title="Pages">
        <span
          className="currency-icon"
          style={{
            "--chip-icon-size": sizeControlRem(ICON_SIZE_CONTROLS.topbarInkIcon),
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6.8 2.5h7.4l4 4v14.1a.9.9 0 0 1-.9.9H6.8a.9.9 0 0 1-.9-.9V3.4a.9.9 0 0 1 .9-.9Zm7 1.8v3h3l-3-3ZM8.3 11h7.4v1.7H8.3V11Zm0 3.5h7.4v1.7H8.3v-1.7Z" />
          </svg>
        </span>
        <span>{Math.max(0, Math.floor(pageCredits ?? 0))}</span>
      </div>

      <div
        className="currency-chip ink-total-chip"
        data-ink-target="true"
        title="Ink is used in the Marketplace to buy and unlock themes."
      >
        <span
          className="currency-icon"
          style={{
            "--chip-icon-size": sizeControlRem(ICON_SIZE_CONTROLS.topbarInkIcon),
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 2.4c-.4 0-.7.2-.9.5-1.3 2.2-5.6 6.7-5.6 10.8 0 3.7 2.9 7.3 6.6 7.3 3.9 0 6.8-3.2 6.8-7.2 0-4.2-4.7-8.9-6-10.9-.2-.3-.5-.5-.9-.5z" />
          </svg>
        </span>
        <span>{inkBalance}</span>
      </div>

      <div
        className="currency-chip quills-chip"
        title="Quills are premium currency earned from weekly group reading milestones."
      >
        <span
          className="currency-icon"
          style={{
            "--chip-icon-size": sizeControlRem(
              ICON_SIZE_CONTROLS.topbarQuillIcon,
            ),
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M19.6 3.3a1 1 0 0 0-1.4 0l-9.9 9.9-2.5 6.2a1 1 0 0 0 1.3 1.3l6.2-2.5 9.9-9.9a1 1 0 0 0 0-1.4l-3.6-3.6zM12.9 17l-3.7 1.5L10.7 15l7.2-7.2 2.2 2.2L12.9 17z" />
          </svg>
        </span>
        <span>{Math.max(0, Math.floor(quillsBalance ?? 0))}</span>
      </div>

      <button
        type="button"
        className="ghost mode-toggle"
        onClick={onToggleMode}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={
          mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
      >
        {mode === "dark" ? (
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 5.2a1 1 0 0 1 1 1V8a1 1 0 1 1-2 0V6.2a1 1 0 0 1 1-1zm0 10.8a1 1 0 0 1 1 1v1.8a1 1 0 1 1-2 0V17a1 1 0 0 1 1-1zm6.8-4.9a1 1 0 1 1 0 2H17a1 1 0 1 1 0-2h1.8zm-10.8 0a1 1 0 1 1 0 2H6.2a1 1 0 1 1 0-2H8zm7.2-4.5a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 1 1-1.4 1.4l-1.2-1.2a1 1 0 0 1 0-1.4zm-8.8 8.8a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1-1.4 1.4l-1.2-1.2a1 1 0 0 1 0-1.4zm0-7.4a1 1 0 0 1 0 1.4L5.2 9.8A1 1 0 0 1 3.8 8.4L5 7.2a1 1 0 0 1 1.4 0zm8.8 8.8a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.4-1.4l1.2-1.2a1 1 0 0 1 1.4 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M13.7 3.1a1 1 0 0 0-1.2 1.2 7.3 7.3 0 0 1-9 9 1 1 0 0 0-1.2 1.2A9.1 9.1 0 1 0 13.7 3.1z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        className="topbar-premium-btn"
        onClick={onOpenPremium}
      >
        <span className="topbar-premium-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 2.4a1 1 0 0 1 .9.56l2.2 4.45 4.92.71a1 1 0 0 1 .56 1.71l-3.56 3.46.84 4.89a1 1 0 0 1-1.45 1.05L12 17.2l-4.41 2.32a1 1 0 0 1-1.45-1.05l.84-4.89L3.42 9.12a1 1 0 0 1 .56-1.71l4.92-.71 2.2-4.45a1 1 0 0 1 .9-.56z" />
          </svg>
        </span>
        <span>Premium</span>
      </button>
    </div>
  );
}

function MoreMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" focusable="false">
      <path d="M4.5 6.5h15a1 1 0 1 1 0 2h-15a1 1 0 0 1 0-2Zm0 4.5h15a1 1 0 1 1 0 2h-15a1 1 0 1 1 0-2Zm0 4.5h15a1 1 0 1 1 0 2h-15a1 1 0 1 1 0-2Z" />
    </svg>
  );
}

export function DashboardMetaStrip({
  inkBalance,
  pageCredits,
  quillsBalance,
  streak,
  mode,
  onToggleMode,
  onOpenPremium,
  displayName,
  onRenameDisplayName,
  userIconUrl,
  userIconPreset,
  dashboardTabId = DASHBOARD_READING_TAB_ID,
  readingTabs = [],
  activeReadingTabId = "",
  onSelectDashboardTab,
  onSelectReadingTab,
  onCloseReadingTab,
  onOpenSupport,
  onOpenSettings,
  onOpenAvatarPicker,
  onSignOut,
  exitLabel = "Log out",
}) {
  const userIconSrc = userIconUrl || getPresetLogo(userIconPreset);
  const initialDisplayName =
    String(displayName || "").trim() || "Signed-in reader";
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(initialDisplayName);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);

  useEffect(() => {
    if (!isEditingDisplayName) {
      setDisplayNameInput(initialDisplayName);
    }
  }, [initialDisplayName, isEditingDisplayName]);

  const commitDisplayName = () => {
    const safeName =
      String(displayNameInput || "").trim() || "Signed-in reader";
    setDisplayNameInput(safeName);
    setIsEditingDisplayName(false);
    onRenameDisplayName?.(safeName);
  };

  const cancelDisplayNameEdit = () => {
    setDisplayNameInput(initialDisplayName);
    setIsEditingDisplayName(false);
  };

  useEffect(() => {
    if (!isMobileActionsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsMobileActionsOpen(false);
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [isMobileActionsOpen]);

  useEffect(() => {
    if (!isMobileActionsOpen) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    if (!mediaQuery.matches) {
      setIsMobileActionsOpen(false);
      return;
    }

    const onViewportChange = (event) => {
      if (!event.matches) {
        setIsMobileActionsOpen(false);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onViewportChange);
      return () => mediaQuery.removeEventListener("change", onViewportChange);
    }

    mediaQuery.addListener(onViewportChange);
    return () => mediaQuery.removeListener(onViewportChange);
  }, [isMobileActionsOpen]);

  const runMobileAction = (callback) => {
    setIsMobileActionsOpen(false);
    callback?.();
  };

  const sizeVars = {
    "--topbar-mode-size": sizeControlRem(ICON_SIZE_CONTROLS.topbarModeButton),
    "--topbar-mode-glyph-size": sizeControlRem(
      ICON_SIZE_CONTROLS.topbarModeIcon,
    ),
    "--topbar-premium-glyph-size": sizeControlRem(
      ICON_SIZE_CONTROLS.topbarPremiumIcon,
    ),
  };

  return (
    <section className="dash-meta-strip" style={sizeVars}>
      <div className="dash-meta-leading">
        <div className="dash-meta-identity-row">
          <div className="dash-meta-identity">
            <button
              type="button"
              className="dash-meta-logo-button"
              onClick={onOpenAvatarPicker}
              aria-label="Change avatar"
              title="Change avatar"
            >
              <img src={userIconSrc} alt="" className="dash-meta-logo" />
            </button>
            <div className="dash-meta-copy">
              <p className="dash-subtitle">Inkling</p>
              {isEditingDisplayName ? (
                <input
                  type="text"
                  className="dash-display-name-input dash-meta-display-name-input"
                  value={displayNameInput}
                  maxLength={48}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  onBlur={commitDisplayName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitDisplayName();
                      return;
                    }

                    if (event.key === "Escape") {
                      cancelDisplayNameEdit();
                    }
                  }}
                  autoFocus
                  aria-label="Edit display name"
                />
              ) : (
                <p
                  className="dash-display-name dash-meta-user-name"
                  title="Double-click to edit display name"
                  onDoubleClick={() => setIsEditingDisplayName(true)}
                >
                  {initialDisplayName}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            className="ghost dash-mobile-menu-toggle"
            onClick={() => setIsMobileActionsOpen(true)}
            aria-label="Open menu"
            title="Menu"
          >
            <MoreMenuIcon />
          </button>
        </div>

        <div className="dash-reading-tabs" aria-label="Reading tabs">
          <div
            className={`dash-reading-tab dash-reading-tab-dashboard${
              activeReadingTabId === dashboardTabId ? " active" : ""
            }`}
          >
            <button
              type="button"
              className="dash-reading-tab-select"
              onClick={() => onSelectDashboardTab?.()}
              title="Open dashboard"
            >
              <span>Dashboard</span>
            </button>
          </div>

          {readingTabs.map((tab) => (
            <div
              key={tab.id}
              className={`dash-reading-tab${tab.id === activeReadingTabId ? " active" : ""}`}
            >
              <button
                type="button"
                className="dash-reading-tab-select"
                onClick={() => onSelectReadingTab?.(tab.id)}
                title={tab.title}
              >
                <span>{tab.title}</span>
              </button>
              <button
                type="button"
                className="dash-reading-tab-close"
                aria-label={`Close ${tab.title} tab`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseReadingTab?.(tab.id);
                }}
              >
                x
              </button>
            </div>
          ))}

          {!readingTabs.length && (
            <p className="dash-reading-tabs-empty">
              Open a book in the Library to create a reading tab.
            </p>
          )}
        </div>
      </div>

      <div className="dash-meta-actions-cluster">
        <DashboardActionRow
          inkBalance={inkBalance}
          pageCredits={pageCredits}
          quillsBalance={quillsBalance}
          streak={streak}
          mode={mode}
          onToggleMode={onToggleMode}
          onOpenPremium={onOpenPremium}
          className="dash-top-actions"
        />
      </div>

      {isMobileActionsOpen && (
        <>
          <div
            className="dash-mobile-sheet-backdrop"
            onPointerDown={() => setIsMobileActionsOpen(false)}
          />
          <section
            className="dash-mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="dash-mobile-sheet-header">
              <h3>Menu</h3>
              <button
                type="button"
                className="ghost dash-mobile-sheet-close"
                onClick={() => setIsMobileActionsOpen(false)}
                aria-label="Close quick actions"
                title="Close"
              >
                x
              </button>
            </div>

            <div className="dash-mobile-sheet-grid">
              {onOpenSupport ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => runMobileAction(onOpenSupport)}
                >
                  Support
                </button>
              ) : null}
              {onOpenSettings ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => runMobileAction(onOpenSettings)}
                >
                  Settings
                </button>
              ) : null}
            </div>

            {onSignOut ? (
              <button
                type="button"
                className="action dash-mobile-sheet-exit"
                onClick={() => runMobileAction(onSignOut)}
              >
                {exitLabel}
              </button>
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}

export default function DashboardTopbar({
  customBannerUrl,
  customBannerPositionX,
  customBannerPositionY,
  customBannerOpacity,
  customBannerScale,
}) {
  if (!customBannerUrl) {
    return null;
  }

  return (
    <header
      className="panel dash-topbar has-custom-banner"
      style={{
        "--custom-banner-image": `url("${customBannerUrl}")`,
        "--custom-banner-position-x": `${customBannerPositionX ?? 50}%`,
        "--custom-banner-position-y": `${customBannerPositionY ?? 50}%`,
        "--custom-banner-opacity": `${customBannerOpacity ?? 0.24}`,
        "--custom-banner-size": `${customBannerScale ?? 100}%`,
      }}
    />
  );
}
