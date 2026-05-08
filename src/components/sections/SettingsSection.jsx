import { useEffect, useMemo, useState } from "react";
import { getThemeSaturatedColors, getThemeSwatches } from "../themePreview";

const SETTINGS_TAB_LABELS = {
  general: "General",
  themes: "Themes",
  interactions: "Interactions",
  banner: "Banner",
};

function normalizeSettingsTab(tabId) {
  return Object.prototype.hasOwnProperty.call(SETTINGS_TAB_LABELS, tabId)
    ? tabId
    : "general";
}

const LANGUAGE_OPTIONS = [
  { id: "vi", label: "Tiếng Việt" },
  { id: "en", label: "English" },
];

const DASHBOARD_SECTION_DESCRIPTIONS = {
  dashboard: "Summary cards, charts, calendar preview, and timeline.",
  timers: "Timer setup, active sessions, and work-session rewards.",
  library: "Local books, official books, and the reader panel.",
  calendar: "Full work-session calendar and daily session list.",
  market: "Themes, books, interaction packs, and banner unlocks.",
  groups: "Group chats, direct messages, members, and shared files.",
};

const MONO_ASSET_THEME_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "vintage", label: "Vintage" },
  { id: "command", label: "Mono" },
];

function normalizeLogoPresetId(presetId) {
  return String(presetId || "").replace(/^comic-/, "default-");
}

function ThemePaletteRow({ label, swatches }) {
  return (
    <div className="settings-theme-palette-row">
      <span>{label}</span>
      <div className="settings-theme-swatches" aria-hidden>
        {(swatches ?? []).map((color) => (
          <span
            key={`${label}-${color}`}
            className="settings-theme-swatch"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

function normalizePositiveInteger(value, fallbackValue) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return fallbackValue;
  }
  return Math.max(1, Math.floor(numericValue));
}

function normalizeColorInput(value, fallbackValue) {
  const safeValue = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(safeValue)) {
    return safeValue.toLowerCase();
  }
  return fallbackValue;
}

function replaceAccentSwatches(swatches, accentPrimaryColor, accentSecondaryColor) {
  if (!Array.isArray(swatches)) {
    return swatches;
  }
  return swatches.map((color, index) => {
    if (index === 2 && accentSecondaryColor) {
      return accentSecondaryColor;
    }
    if (index === 3 && accentPrimaryColor) {
      return accentPrimaryColor;
    }
    return color;
  });
}

function replaceSingleAccentSwatch(swatches, accentColor) {
  if (!Array.isArray(swatches) || !accentColor) {
    return swatches;
  }
  return swatches.map((color, index) => (index === 3 ? accentColor : color));
}

export default function SettingsSection({
  themeOptions,
  selectedThemeId,
  selectedThemeMode,
  selectedAccentColor,
  selectedAccentColorSecondary,
  userIconPreset,
  onSelectUserIconPreset,
  onApplyThemeChoice,
  onApplyAccentColors,
  dailyQuotaInput,
  setDailyQuotaInput,
  selectedLanguage = "vi",
  onSelectLanguage,
  dashboardSectionOptions = [],
  visibleDashboardSectionIds = [],
  onToggleDashboardSectionVisibility,
  onSavePreferences,
  settingsMessage,
  hasMechanicalInteractionFeature,
  selectedInteractionMode,
  onApplyInteractionMode,
  hasCustomBannerFeature,
  customBannerUrl,
  bannerUploadState = {},
  bannerPositionX,
  bannerPositionY,
  bannerOpacity,
  bannerScale,
  onChangeBannerPositionX,
  onChangeBannerPositionY,
  onChangeBannerOpacity,
  onChangeBannerScale,
  onUploadCustomBanner,
  onClearCustomBanner,
  onOpenMarketplace,
  initialTab = "general",
  onClose,
}) {
  const opacityPercent = Math.round((bannerOpacity ?? 0.24) * 100);
  const zoomPercent = Math.round(bannerScale ?? 100);
  const [bannerAspect, setBannerAspect] = useState(5.4);
  const [activeTab, setActiveTab] = useState(() =>
    normalizeSettingsTab(initialTab),
  );
  const [dailyQuotaDraft, setDailyQuotaDraft] = useState(
    String(dailyQuotaInput ?? 3),
  );
  const canUseMechanicalModes = Boolean(hasMechanicalInteractionFeature);
  const activeTabLabel = SETTINGS_TAB_LABELS[activeTab] ?? "Settings";
  const isMonochromeTheme = selectedThemeId === "command";
  const isSingleAccentTheme = selectedThemeId === "alpine";
  const normalizedThemeMode = selectedThemeMode || "dark";
  const visibleDashboardSectionSet = useMemo(
    () => new Set(visibleDashboardSectionIds),
    [visibleDashboardSectionIds],
  );

  const themeSaturatedColors = useMemo(() => {
    const colors = getThemeSaturatedColors(
      selectedThemeId || "default",
      normalizedThemeMode,
    );
    return {
      primary: colors?.primary || "#025bfe",
      secondary: colors?.secondary || "#ffcf01",
    };
  }, [selectedThemeId, normalizedThemeMode]);

  const [accentPrimaryDraft, setAccentPrimaryDraft] = useState(
    normalizeColorInput(selectedAccentColor, themeSaturatedColors.primary),
  );
  const [accentSecondaryDraft, setAccentSecondaryDraft] = useState(
    normalizeColorInput(
      selectedAccentColorSecondary,
      themeSaturatedColors.secondary,
    ),
  );

  const ownedThemes = useMemo(
    () =>
      (themeOptions ?? []).filter(
        (item) => item.type === "theme" && item.owned,
      ),
    [themeOptions],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setActiveTab(normalizeSettingsTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    setDailyQuotaDraft(String(dailyQuotaInput ?? 3));
  }, [dailyQuotaInput]);

  useEffect(() => {
    setAccentPrimaryDraft(
      normalizeColorInput(
        isSingleAccentTheme && selectedAccentColorSecondary
          ? ""
          : selectedAccentColor,
        themeSaturatedColors.primary,
      ),
    );
    setAccentSecondaryDraft(
      normalizeColorInput(
        selectedAccentColorSecondary,
        themeSaturatedColors.secondary,
      ),
    );
  }, [
    isSingleAccentTheme,
    selectedAccentColor,
    selectedAccentColorSecondary,
    themeSaturatedColors,
  ]);

  const shouldUseStoredSingleAccent =
    !isSingleAccentTheme || !selectedAccentColorSecondary;
  const displayedAccentPrimaryColor = normalizeColorInput(
    shouldUseStoredSingleAccent ? selectedAccentColor : "",
    themeSaturatedColors.primary,
  );
  const displayedAccentSecondaryColor = normalizeColorInput(
    selectedAccentColorSecondary,
    themeSaturatedColors.secondary,
  );

  const selectedMonoAssetTheme =
    MONO_ASSET_THEME_OPTIONS.find((option) =>
      normalizeLogoPresetId(userIconPreset).startsWith(`${option.id}-`),
    )?.id || "command";

  const onSelectMonoAssetTheme = (assetThemeId) => {
    onSelectUserIconPreset?.(`${assetThemeId}-${normalizedThemeMode}`);
  };

  const getDisplayedSwatches = (themeId, mode) => {
    const swatches = getThemeSwatches(themeId);
    const modeSwatches = swatches?.[mode];
    if (themeId !== selectedThemeId || isMonochromeTheme) {
      return modeSwatches;
    }
    if (isSingleAccentTheme) {
      return replaceSingleAccentSwatch(
        modeSwatches,
        shouldUseStoredSingleAccent ? selectedAccentColor : "",
      );
    }
    return replaceAccentSwatches(
      modeSwatches,
      selectedAccentColor,
      selectedAccentColorSecondary,
    );
  };

  useEffect(() => {
    const updateAspect = () => {
      const activeTopbar = document.querySelector(".dash-main > .dash-topbar");
      if (!activeTopbar) {
        return;
      }

      const ratio =
        activeTopbar.clientWidth / Math.max(1, activeTopbar.clientHeight);
      if (Number.isFinite(ratio) && ratio > 0) {
        setBannerAspect(ratio);
      }
    };

    updateAspect();
    window.addEventListener("resize", updateAspect);
    return () => {
      window.removeEventListener("resize", updateAspect);
    };
  }, []);

  const commitDailyQuota = () => {
    const previousValue = normalizePositiveInteger(dailyQuotaInput, 3);
    const nextValue = normalizePositiveInteger(dailyQuotaDraft, previousValue);
    if (!String(dailyQuotaDraft).trim()) {
      setDailyQuotaDraft(String(previousValue));
      return;
    }
    setDailyQuotaDraft(String(nextValue));
    setDailyQuotaInput?.(nextValue);
    window.setTimeout(() => onSavePreferences?.(nextValue), 0);
  };

  const onDailyQuotaKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    event.currentTarget.blur();
  };

  const adjustDailyQuotaDraft = (delta) => {
    const currentValue = normalizePositiveInteger(dailyQuotaDraft, 1);
    const nextValue = Math.max(1, currentValue + delta);
    setDailyQuotaDraft(String(nextValue));
    setDailyQuotaInput?.(nextValue);
    window.setTimeout(() => onSavePreferences?.(nextValue), 0);
  };

  const renderInteractionCard = ({
    id,
    title,
    badge,
    body,
    className,
    buttonLabel,
  }) => {
    const isSelected = selectedInteractionMode === id;
    const isLocked = id !== "classic" && !canUseMechanicalModes;

    return (
      <article
        className={`settings-interaction-card${isSelected ? " selected" : ""}${isLocked ? " locked" : ""}`}
      >
        <div className="settings-interaction-head">
          <h3>{title}</h3>
          <span className="mode-pill">{badge}</span>
        </div>
        <p>{body}</p>
        <div className={`settings-interaction-demo ${className}`}>
          <button
            type="button"
            className={`settings-interaction-sample settings-interaction-sample-${id}`}
          >
            Sample Button
          </button>
        </div>
        <button
          type="button"
          className="action"
          disabled={isSelected || isLocked}
          onClick={() => onApplyInteractionMode?.(id)}
        >
          {isSelected ? "Active" : isLocked ? "Locked" : buttonLabel}
        </button>
      </article>
    );
  };

  return (
    <section
      className="settings-overlay"
      aria-label="Settings overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="panel settings-shell">
        <div className="settings-shell-inner">
          <aside className="settings-nav-panel" aria-label="Settings tabs">
            <p className="settings-nav-title">Settings</p>
            {Object.entries(SETTINGS_TAB_LABELS).map(([tabId, tabLabel]) => (
              <button
                key={tabId}
                type="button"
                className={`settings-nav-item${activeTab === tabId ? " active" : ""}`}
                onClick={() => setActiveTab(tabId)}
              >
                {tabLabel}
              </button>
            ))}
          </aside>

          <article className="settings-content-panel">
            <div className="settings-header-row">
              <h2>{activeTabLabel}</h2>
              <button
                type="button"
                className="ghost settings-close-btn"
                onClick={onClose}
                aria-label="Close settings"
                title="Close settings"
              >
                x
              </button>
            </div>

            {activeTab === "general" && (
              <>
                <section className="settings-general-panel">
                  <div className="settings-row">
                    <span className="settings-row-copy">
                      <strong>Daily quota</strong>
                      <span>Pages for streak</span>
                    </span>
                    <span className="settings-number-stepper">
                      <button
                        type="button"
                        className="settings-stepper-button"
                        onClick={() => adjustDailyQuotaDraft(-1)}
                        aria-label="Decrease daily quota"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={dailyQuotaDraft}
                        onChange={(event) =>
                          setDailyQuotaDraft(
                            event.target.value.replace(/\D/g, ""),
                          )
                        }
                        onBlur={commitDailyQuota}
                        onKeyDown={onDailyQuotaKeyDown}
                      />
                      <button
                        type="button"
                        className="settings-stepper-button"
                        onClick={() => adjustDailyQuotaDraft(1)}
                        aria-label="Increase daily quota"
                      >
                        +
                      </button>
                    </span>
                  </div>

                  <div className="settings-row">
                    <span className="settings-row-copy">
                      <strong>Language</strong>
                      <span>Tutorial language</span>
                    </span>
                    <select
                      value={selectedLanguage}
                      onChange={(event) =>
                        onSelectLanguage?.(event.target.value)
                      }
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>

                <section className="settings-dashboard-section-panel">
                  <div className="settings-dashboard-section-head">
                    <h3>Section visibility</h3>
                  </div>

                  <div className="settings-dashboard-section-list">
                    {dashboardSectionOptions.map((section) => {
                      const isVisible = visibleDashboardSectionSet.has(
                        section.key,
                      );
                      const isOnlyVisible =
                        isVisible && visibleDashboardSectionSet.size <= 1;

                      return (
                        <article
                          key={section.key}
                          className="settings-dashboard-section-item"
                        >
                          <div className="settings-dashboard-section-copy">
                            <strong>{section.label}</strong>
                            <span>
                              {DASHBOARD_SECTION_DESCRIPTIONS[section.key] ||
                                "Dashboard section."}
                            </span>
                          </div>

                          <button
                            type="button"
                            className={`settings-dashboard-section-toggle${
                              isVisible ? " active" : ""
                            }`}
                            role="switch"
                            aria-checked={isVisible}
                            disabled={isOnlyVisible}
                            onClick={() =>
                              onToggleDashboardSectionVisibility?.(
                                section.key,
                                !isVisible,
                              )
                            }
                          >
                            <span>{isVisible ? "Shown" : "Hidden"}</span>
                            <i aria-hidden="true" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {settingsMessage && <p className="status-text">{settingsMessage}</p>}
              </>
            )}

            {activeTab === "themes" && (
              <>
                <div className="settings-theme-mode-row">
                  <button
                    type="button"
                    className={`mode-pill${selectedThemeMode === "light" ? " active" : ""}`}
                    onClick={() =>
                      onApplyThemeChoice?.(selectedThemeId || "default", "light")
                    }
                  >
                    Light Mode
                  </button>
                  <button
                    type="button"
                    className={`mode-pill${selectedThemeMode === "dark" ? " active" : ""}`}
                    onClick={() =>
                      onApplyThemeChoice?.(selectedThemeId || "default", "dark")
                    }
                  >
                    Dark Mode
                  </button>
                </div>

                <div className="settings-row settings-accent-row">
                  <span className="settings-row-copy">
                    <strong>
                      {isMonochromeTheme ? "Asset color" : "Accent color"}
                    </strong>
                  </span>
                  {isMonochromeTheme ? (
                    <div className="settings-accent-controls settings-asset-controls">
                      {MONO_ASSET_THEME_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`mode-pill${
                            selectedMonoAssetTheme === option.id
                              ? " active"
                              : ""
                          }`}
                          onClick={() => onSelectMonoAssetTheme(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="settings-accent-controls"
                      style={{
                        "--settings-current-accent": displayedAccentPrimaryColor,
                        "--settings-current-accent-secondary":
                          displayedAccentSecondaryColor,
                      }}
                    >
                      <div className="settings-accent-inputs">
                        <label>
                          <input
                            type="color"
                            value={accentPrimaryDraft}
                            onChange={(event) =>
                              setAccentPrimaryDraft(
                                normalizeColorInput(
                                  event.target.value,
                                  themeSaturatedColors.primary,
                                ),
                              )
                            }
                            aria-label="Primary saturated color"
                            title="Primary saturated color"
                          />
                        </label>
                        {!isSingleAccentTheme && (
                          <label>
                            <input
                              type="color"
                              value={accentSecondaryDraft}
                              onChange={(event) =>
                                setAccentSecondaryDraft(
                                  normalizeColorInput(
                                    event.target.value,
                                    themeSaturatedColors.secondary,
                                  ),
                                )
                              }
                              aria-label="Secondary saturated color"
                              title="Secondary saturated color"
                            />
                          </label>
                        )}
                      </div>
                      <button
                        type="button"
                        className="action"
                        onClick={() =>
                          onApplyAccentColors?.(
                            accentPrimaryDraft,
                            isSingleAccentTheme ? "" : accentSecondaryDraft,
                          )
                        }
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onApplyAccentColors?.("", "")}
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                <div className="settings-theme-grid">
                  {ownedThemes.map((theme) => {
                    const isSelected = selectedThemeId === theme.id;
                    const lightSwatches = getDisplayedSwatches(theme.id, "light");
                    const darkSwatches = getDisplayedSwatches(theme.id, "dark");

                    return (
                      <article
                        key={theme.id}
                        className={`settings-theme-card${isSelected ? " selected" : ""}`}
                      >
                        <div className="settings-theme-head">
                          <h3>{theme.name}</h3>
                          <span className="mode-pill">
                            Owned
                          </span>
                        </div>

                        <p>{theme.description}</p>

                        <ThemePaletteRow
                          label="Light"
                          swatches={lightSwatches}
                        />
                        <ThemePaletteRow label="Dark" swatches={darkSwatches} />

                        <div className="market-actions-row">
                          <button
                            type="button"
                            className="action"
                            disabled={isSelected}
                            onClick={() =>
                              onApplyThemeChoice?.(
                                theme.id,
                                selectedThemeMode || "light",
                              )
                            }
                          >
                            {isSelected ? "In Use" : "Apply Theme"}
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {!ownedThemes.length && (
                    <p className="status-text">No owned themes found yet.</p>
                  )}
                </div>
              </>
            )}

            {activeTab === "interactions" && (
              <>
                {!canUseMechanicalModes && (
                  <>
                    <p className="status-text">
                      Default Interaction is always available. Unlock Mechanical
                      Interaction to use Pop Up and Sink Down.
                    </p>
                    <button
                      type="button"
                      className="ghost"
                      onClick={onOpenMarketplace}
                    >
                      Open Marketplace
                    </button>
                  </>
                )}

                <div className="settings-interaction-grid">
                  {renderInteractionCard({
                    id: "classic",
                    title: "Default",
                    badge: "Classic",
                    body: "Uses the original lightweight hover animation for buttons and controls.",
                    className: "settings-interaction-demo-default",
                    buttonLabel: "Use Default",
                  })}
                  {renderInteractionCard({
                    id: "popup",
                    title: "Pop Up",
                    badge: "Raised",
                    body: "Controls lift from the surface and compress when hovered or pressed.",
                    className: "settings-interaction-demo-popup",
                    buttonLabel: "Use Pop Up",
                  })}
                  {renderInteractionCard({
                    id: "sinkdown",
                    title: "Sink Down",
                    badge: "Indented",
                    body: "Shows a dark pocket above controls so actions look pressed into the UI.",
                    className: "settings-interaction-demo-sinkdown",
                    buttonLabel: "Use Sink Down",
                  })}
                </div>
              </>
            )}

            {activeTab === "banner" && (
              <>
                {!hasCustomBannerFeature && (
                  <>
                    <p className="status-text">
                      Unlock this in Marketplace before uploading your own
                      banner.
                    </p>
                    <button
                      type="button"
                      className="ghost"
                      onClick={onOpenMarketplace}
                    >
                      Open Marketplace
                    </button>
                  </>
                )}

                {hasCustomBannerFeature && (
                  <>
                    <label className="upload-box banner-upload-box">
                      <span>
                        {bannerUploadState.busy
                          ? "Uploading PNG banner..."
                          : "Upload PNG banner"}
                      </span>
                      <input
                        type="file"
                        accept="image/png"
                        onChange={onUploadCustomBanner}
                        disabled={bannerUploadState.busy}
                      />
                    </label>

                    {bannerUploadState.error && (
                      <p className="status-text">{bannerUploadState.error}</p>
                    )}

                    <div className="banner-preview-wrap">
                      <div
                        className="settings-banner-live"
                        style={{ "--settings-banner-aspect": `${bannerAspect}` }}
                      >
                        <div
                          className={`settings-banner-drag-target${customBannerUrl ? " has-custom-banner" : ""}`}
                          style={
                            customBannerUrl
                              ? {
                                  "--custom-banner-image": `url("${customBannerUrl}")`,
                                  "--custom-banner-position-x": `${bannerPositionX ?? 50}%`,
                                  "--custom-banner-position-y": `${bannerPositionY ?? 50}%`,
                                  "--custom-banner-opacity": `${bannerOpacity ?? 0.24}`,
                                  "--custom-banner-size": `${bannerScale ?? 100}%`,
                                }
                              : undefined
                          }
                        />
                      </div>
                    </div>

                    {customBannerUrl ? (
                      <>
                        <div className="settings-slider-grid">
                          <label>
                            Horizontal position ({Math.round(bannerPositionX ?? 50)}%)
                            <input
                              type="range"
                              min={-100}
                              max={200}
                              step={1}
                              value={bannerPositionX ?? 50}
                              onChange={(event) =>
                                onChangeBannerPositionX?.(
                                  Number(event.target.value),
                                )
                              }
                              disabled={bannerUploadState.busy}
                            />
                          </label>

                          <label>
                            Vertical position ({Math.round(bannerPositionY ?? 50)}%)
                            <input
                              type="range"
                              min={-100}
                              max={200}
                              step={1}
                              value={bannerPositionY ?? 50}
                              onChange={(event) =>
                                onChangeBannerPositionY?.(
                                  Number(event.target.value),
                                )
                              }
                              disabled={bannerUploadState.busy}
                            />
                          </label>

                          <label>
                            Zoom ({zoomPercent}%)
                            <input
                              type="range"
                              min={50}
                              max={320}
                              step={1}
                              value={bannerScale ?? 100}
                              onChange={(event) =>
                                onChangeBannerScale?.(Number(event.target.value))
                              }
                              disabled={bannerUploadState.busy}
                            />
                          </label>

                          <label>
                            Opacity ({opacityPercent}%)
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={bannerOpacity ?? 0.24}
                              onChange={(event) =>
                                onChangeBannerOpacity?.(
                                  Number(event.target.value),
                                )
                              }
                              disabled={bannerUploadState.busy}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          className="ghost"
                          onClick={onClearCustomBanner}
                          disabled={bannerUploadState.busy}
                        >
                          Clear Banner
                        </button>
                      </>
                    ) : (
                      <p className="status-text">No custom banner uploaded yet.</p>
                    )}
                  </>
                )}
              </>
            )}
          </article>
        </div>
      </section>
    </section>
  );
}
