import timerIcon from "./assets/Icons/Timer_fill.svg";
import libraryIcon from "./assets/Icons/Library_fill.svg";
import dataIcon from "./assets/Icons/Chart_fill.svg";
import calendarIcon from "./assets/Icons/Calendar_fill.svg";
import marketIcon from "./assets/Icons/Marketplace.svg";
import groupsIcon from "./assets/Icons/Group_fill.svg";

export const DASHBOARD_SECTIONS = [
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
