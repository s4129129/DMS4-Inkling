import { THEME_CATALOG, THEME_ROLE_DEFINITIONS } from "./themeCatalog";

const FALLBACK_THEME_ID = "comic";

const LEGACY_THEME_ID_MAP = {
  default: "vintage",
};

function normalizeThemeId(themeId) {
  const normalizedThemeId = LEGACY_THEME_ID_MAP[themeId] ?? themeId;
  if (Object.prototype.hasOwnProperty.call(THEME_CATALOG, normalizedThemeId)) {
    return normalizedThemeId;
  }
  return FALLBACK_THEME_ID;
}

function normalizeThemeMode(mode) {
  return mode === "dark" ? "dark" : "light";
}

export function getThemeDefinition(themeId) {
  return THEME_CATALOG[normalizeThemeId(themeId)];
}

export function getThemeMeta(themeId) {
  const definition = getThemeDefinition(themeId);
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
  };
}

export function listThemeMeta() {
  return Object.values(THEME_CATALOG).map((theme) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
  }));
}

export function getThemePalette(themeId, mode) {
  const definition = getThemeDefinition(themeId);
  const normalizedMode = normalizeThemeMode(mode);
  return definition.modes[normalizedMode].preview;
}

export function getThemeSwatches(themeId) {
  const definition = getThemeDefinition(themeId);

  return {
    light: THEME_ROLE_DEFINITIONS.map(
      (role) => definition.modes.light.roles[role.key],
    ),
    dark: THEME_ROLE_DEFINITIONS.map(
      (role) => definition.modes.dark.roles[role.key],
    ),
  };
}

export function getThemeColorRoles(themeId, mode) {
  const definition = getThemeDefinition(themeId);
  const normalizedMode = normalizeThemeMode(mode);
  const modeRoles = definition.modes[normalizedMode].roles;

  return THEME_ROLE_DEFINITIONS.map((role) => ({
    key: role.key,
    label: role.label,
    usage: role.usage,
    value: modeRoles[role.key],
  }));
}

export function getThemeSaturatedColors(themeId, mode) {
  const definition = getThemeDefinition(themeId);
  const normalizedMode = normalizeThemeMode(mode);
  const modeRoles = definition.modes[normalizedMode].roles;

  return {
    primary: modeRoles.accent,
    secondary: modeRoles.support,
  };
}

export { THEME_CATALOG, THEME_ROLE_DEFINITIONS };
