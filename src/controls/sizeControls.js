export const ICON_SIZE_CONTROLS = Object.freeze({
  sidebarLogo: 58,
  sidebarHelpIcon: 24,
  sidebarSettingsIcon: 24,
  sidebarTimerIcon: 24,
  sidebarLibraryIcon: 24,
  sidebarDataIcon: 24,
  sidebarMarketIcon: 24,
  sidebarGroupsIcon: 24,
  sidebarLogoutIcon: 24,
  topbarStreakIcon: 16,
  topbarInkIcon: 14,
  topbarQuillIcon: 14,
  topbarModeButton: 38,
  topbarModeIcon: 18,
  topbarPremiumIcon: 15,
});

export function sizeControlRem(value) {
  return `${Number(value) / 16}rem`;
}
