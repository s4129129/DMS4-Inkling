// Centralized theme catalog.
// Edit this file to update theme names, descriptions, and mode color roles.

// Shared role map used by Marketplace + Settings explanations.
export const THEME_ROLE_DEFINITIONS = [
  {
    key: "main1",
    label: "Main1",
    usage: "Page background",
  },
  {
    key: "main2",
    label: "Main2",
    usage: "Panel background",
  },
  {
    key: "support",
    label: "Support",
    usage: "Secondary saturated color",
  },
  {
    key: "accent",
    label: "Accent",
    usage: "Primary saturated color",
  },
  {
    key: "text",
    label: "Text",
    usage: "Primary text",
  },
];

// Theme catalog: each theme includes two modes (light + dark).
export const THEME_CATALOG = {
  default: {
    id: "default",
    name: "Default",
    description: "Bold default reader theme",
    modes: {
      light: {
        preview: {
          bg: "#d8d8d2",
          surface: "#e1e1dc",
          accent: "#025bfe",
          text: "#151515",
        },
        roles: {
          main1: "#d8d8d2",
          main2: "#e1e1dc",
          support: "#ffcf01",
          accent: "#025bfe",
          text: "#151515",
        },
      },
      dark: {
        preview: {
          bg: "#242428",
          surface: "#2d2d33",
          accent: "#025bfe",
          text: "#ededed",
        },
        roles: {
          main1: "#242428",
          main2: "#2d2d33",
          support: "#ffcf01",
          accent: "#025bfe",
          text: "#ededed",
        },
      },
    },
  },
  vintage: {
    id: "vintage",
    name: "Vintage",
    description: "For coffee addicts",
    modes: {
      light: {
        preview: {
          bg: "#f8f2e7",
          surface: "#e5d9c5",
          accent: "#563826",
          text: "#2d2119",
        },
        roles: {
          main1: "#f8f2e7",
          main2: "#e5d9c5",
          support: "#a7774d",
          accent: "#563826",
          text: "#2d2119",
        },
      },
      dark: {
        preview: {
          bg: "#1e1811",
          surface: "#2f261d",
          accent: "#f2d4a7",
          text: "#f5e8d4",
        },
        roles: {
          main1: "#1e1811",
          main2: "#2f261d",
          support: "#644a34",
          accent: "#f2d4a7",
          text: "#f5e8d4",
        },
      },
    },
  },
  command: {
    id: "command",
    name: "Monochrome",
    description: "Simple mono palette",
    modes: {
      light: {
        preview: {
          bg: "#e9eae6",
          surface: "#dadcd6",
          accent: "#2f3438",
          text: "#1c2022",
        },
        roles: {
          main1: "#e9eae6",
          main2: "#dadcd6",
          support: "#9da3a8",
          accent: "#2f3438",
          text: "#1c2022",
        },
      },
      dark: {
        preview: {
          bg: "#16181a",
          surface: "#22262a",
          accent: "#d9e0e6",
          text: "#f4f6f8",
        },
        roles: {
          main1: "#16181a",
          main2: "#22262a",
          support: "#4f565d",
          accent: "#d9e0e6",
          text: "#f4f6f8",
        },
      },
    },
  },
};
