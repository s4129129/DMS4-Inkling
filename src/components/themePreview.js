import {
  THEME_CATALOG,
  getThemeColorRoles,
  getThemeMeta,
  getThemePalette,
  getThemeSaturatedColors,
  getThemeSwatches,
  listThemeMeta,
} from "../themes";

// Compatibility export retained for existing imports.
export const THEME_PALETTES = Object.fromEntries(
  Object.values(THEME_CATALOG).map((theme) => [
    theme.id,
    {
      light: {
        ...theme.modes.light.preview,
        swatches: Object.values(theme.modes.light.roles),
      },
      dark: {
        ...theme.modes.dark.preview,
        swatches: Object.values(theme.modes.dark.roles),
      },
    },
  ]),
);

export {
  getThemeColorRoles,
  getThemeMeta,
  getThemePalette,
  getThemeSaturatedColors,
  getThemeSwatches,
  listThemeMeta,
};
