const DEFAULT_FAVICON_SELECTOR = 'link[rel~="icon"]';
const BADGED_FAVICON_ID = "inkling-badged-favicon";
const DEFAULT_FAVICON_HREF = "/inkling-favicon.svg?v=20260506";

let originalFaviconHref = "";
let originalFaviconType = "";
let badgedFaviconHrefPromise = null;

function getFaviconLink() {
  if (typeof document === "undefined") {
    return null;
  }

  let link = document.querySelector(DEFAULT_FAVICON_SELECTOR);
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function createBadgedFaviconHref() {
  if (typeof window === "undefined") {
    return "";
  }

  const response = await fetch(DEFAULT_FAVICON_HREF, { cache: "force-cache" });
  const sourceSvg = await response.text();
  const badgedSvg = sourceSvg.replace(
    /<\/svg>\s*$/i,
    [
      '<circle cx="51" cy="13" r="10" fill="#ff2b2b" stroke="#ffffff" stroke-width="3"/>',
      '<circle cx="51" cy="13" r="10" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="1"/>',
      "</svg>",
    ].join(""),
  );

  return svgToDataUri(badgedSvg);
}

export function setFaviconNotificationBadge(shouldShowBadge) {
  const link = getFaviconLink();
  if (!link) {
    return;
  }

  if (!originalFaviconHref) {
    originalFaviconHref = link.getAttribute("href") || DEFAULT_FAVICON_HREF;
    originalFaviconType = link.getAttribute("type") || "image/svg+xml";
  }

  if (!shouldShowBadge) {
    link.id = "";
    link.type = originalFaviconType;
    link.href = originalFaviconHref;
    return;
  }

  if (!badgedFaviconHrefPromise) {
    badgedFaviconHrefPromise = createBadgedFaviconHref().catch(() =>
      svgToDataUri(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111"/><circle cx="50" cy="14" r="11" fill="#ff2b2b" stroke="#fff" stroke-width="3"/></svg>',
      ),
    );
  }

  void badgedFaviconHrefPromise.then((href) => {
    if (!href) {
      return;
    }
    link.id = BADGED_FAVICON_ID;
    link.type = "image/svg+xml";
    link.href = href;
  });
}
