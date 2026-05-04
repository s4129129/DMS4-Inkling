const CHART_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js";

let chartLoaderPromise = null;

export function ensureChartJs() {
  if (window.Chart) {
    return Promise.resolve(window.Chart);
  }

  if (!chartLoaderPromise) {
    chartLoaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${CHART_CDN}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Chart), {
          once: true,
        });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = CHART_CDN;
      script.async = true;
      script.onload = () => resolve(window.Chart);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return chartLoaderPromise;
}

export function chartPalette(themeId, themeMode) {
  const isCommand = themeId === "command";
  const isComic = themeId === "comic";
  const isDark = themeMode === "dark";

  if (isComic) {
    return {
      text: isDark ? "#f7f7f7" : "#000000",
      grid: isDark ? "rgba(247, 247, 247, 0.28)" : "rgba(0, 0, 0, 0.24)",
      bar: "#025bfe",
      started: "#025bfe",
      paused: "#ffcf01",
      removed: "#de2915",
      completed: isDark ? "#f7f7f7" : "#003aba",
      pie: ["#de2915", "#025bfe", "#ffcf01", "#9c9c9c", "#003aba", "#000000"],
    };
  }

  const fallbackPie = isDark
    ? ["#ff9f1c", "#00c2ff", "#ff2d55", "#00e676", "#b967ff", "#ffd60a"]
    : ["#ff6b00", "#008cff", "#ff1744", "#00c853", "#7c4dff", "#ffb000"];

  return {
    text: isDark ? "#efe7da" : isCommand ? "#495056" : "#6a4b34",
    grid: isDark
      ? "rgba(239, 231, 218, 0.28)"
      : isCommand
        ? "rgba(73, 80, 86, 0.28)"
        : "rgba(166, 126, 96, 0.3)",
    bar: isDark
      ? isCommand
        ? "#ffffff"
        : "#ff9f1c"
      : isCommand
        ? "#111827"
        : "#ff6b00",
    started: isDark ? "#00c2ff" : "#008cff",
    paused: isDark ? "#ffd60a" : "#ffb000",
    removed: isDark ? "#ff2d55" : "#ff1744",
    completed: isDark ? "#00e676" : "#00c853",
    pie: fallbackPie,
  };
}
