import defaultThemeLightLogo from "../assets/logos/Comic/Comic lightd.svg";
import defaultThemeDarkLogo from "../assets/logos/Comic/Comic dark.svg";
import vintageLightLogo from "../assets/logos/Default/Logo Default Light.svg";
import vintageDarkLogo from "../assets/logos/Default/Logo Default Dark.svg";
import monochromeLightLogo from "../assets/logos/Monochrome/Logo Mono Light.svg";
import monochromeDarkLogo from "../assets/logos/Monochrome/Logo Mono Dark.svg";

const FALLBACK_THEME_ID = "default";
const FALLBACK_MODE = "light";

const THEME_LOGO_CATALOG = {
  default: {
    light: defaultThemeLightLogo,
    dark: defaultThemeDarkLogo,
  },
  vintage: {
    light: vintageLightLogo,
    dark: vintageDarkLogo,
  },
  command: {
    light: monochromeLightLogo,
    dark: monochromeDarkLogo,
  },
};

const LEGACY_THEME_ID_MAP = {
  comic: "default",
};

export const DEFAULT_THEME_LOGO = defaultThemeLightLogo;
export const LOGO_PRESET_OPTIONS = [
  {
    id: "default-light",
    label: "Default Light",
    src: defaultThemeLightLogo,
  },
  {
    id: "default-dark",
    label: "Default Dark",
    src: defaultThemeDarkLogo,
  },
  {
    id: "vintage-light",
    label: "Vintage Light",
    src: vintageLightLogo,
  },
  {
    id: "vintage-dark",
    label: "Vintage Dark",
    src: vintageDarkLogo,
  },
  {
    id: "command-light",
    label: "Mono Light",
    src: monochromeLightLogo,
  },
  {
    id: "command-dark",
    label: "Mono Dark",
    src: monochromeDarkLogo,
  },
];

function normalizeThemeId(themeId) {
  const normalizedThemeId = LEGACY_THEME_ID_MAP[themeId] ?? themeId;
  if (Object.prototype.hasOwnProperty.call(THEME_LOGO_CATALOG, normalizedThemeId)) {
    return normalizedThemeId;
  }
  return FALLBACK_THEME_ID;
}

function normalizeThemeMode(mode) {
  return mode === "dark" ? "dark" : FALLBACK_MODE;
}

export function getThemeLogoAsset(themeId, mode) {
  const normalizedThemeId = normalizeThemeId(themeId);
  const normalizedMode = normalizeThemeMode(mode);
  const selectedTheme = THEME_LOGO_CATALOG[normalizedThemeId];

  return (
    selectedTheme?.[normalizedMode] ??
    THEME_LOGO_CATALOG[FALLBACK_THEME_ID][FALLBACK_MODE]
  );
}

export function getLogoPresetAsset(presetId) {
  const legacyPresetMap = {
    "comic-light": "default-light",
    "comic-dark": "default-dark",
  };
  const normalizedPresetId = legacyPresetMap[presetId] ?? presetId;
  return (
    LOGO_PRESET_OPTIONS.find((option) => option.id === normalizedPresetId)?.src ??
    DEFAULT_THEME_LOGO
  );
}
