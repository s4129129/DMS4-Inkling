import comicLightLogo from "../assets/logos/Comic/Comic lightd.svg";
import comicDarkLogo from "../assets/logos/Comic/Comic dark.svg";
import defaultLightLogo from "../assets/logos/Default/Logo Default Light.svg";
import defaultDarkLogo from "../assets/logos/Default/Logo Default Dark.svg";
import monochromeLightLogo from "../assets/logos/Monochrome/Logo Mono Light.svg";
import monochromeDarkLogo from "../assets/logos/Monochrome/Logo Mono Dark.svg";

const FALLBACK_THEME_ID = "comic";
const FALLBACK_MODE = "light";

const THEME_LOGO_CATALOG = {
  comic: {
    light: comicLightLogo,
    dark: comicDarkLogo,
  },
  vintage: {
    light: defaultLightLogo,
    dark: defaultDarkLogo,
  },
  command: {
    light: monochromeLightLogo,
    dark: monochromeDarkLogo,
  },
};

const LEGACY_THEME_ID_MAP = {
  default: "vintage",
};

export const DEFAULT_THEME_LOGO = comicLightLogo;
export const LOGO_PRESET_OPTIONS = [
  {
    id: "comic-light",
    label: "Comic Light",
    src: comicLightLogo,
  },
  {
    id: "comic-dark",
    label: "Comic Dark",
    src: comicDarkLogo,
  },
  {
    id: "vintage-light",
    label: "Vintage Light",
    src: defaultLightLogo,
  },
  {
    id: "vintage-dark",
    label: "Vintage Dark",
    src: defaultDarkLogo,
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
    "default-light": "vintage-light",
    "default-dark": "vintage-dark",
  };
  const normalizedPresetId = legacyPresetMap[presetId] ?? presetId;
  return (
    LOGO_PRESET_OPTIONS.find((option) => option.id === normalizedPresetId)?.src ??
    DEFAULT_THEME_LOGO
  );
}
