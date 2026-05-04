function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getCalendarErrorMessage(error) {
  const direct = firstNonEmptyString([
    error?.message,
    error?.details,
    error?.error_description,
    error?.result?.error?.message,
    error?.result?.error?.status,
  ]);

  if (direct) {
    return direct;
  }

  const code = error?.result?.error?.code;
  if (typeof code === "number") {
    return `Google Calendar API error code ${code}.`;
  }

  return "Unknown Google Calendar error.";
}

function getCalendarErrorReason(error) {
  const details = error?.result?.error?.details;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (typeof item?.reason === "string" && item.reason.trim()) {
        return item.reason.trim();
      }
    }
  }

  const raw = firstNonEmptyString([
    error?.message,
    error?.result?.error?.message,
    error?.result?.error?.status,
  ]);

  const reasonMatch = raw.match(/API_KEY_[A-Z_]+/);
  if (reasonMatch) {
    return reasonMatch[0];
  }

  return "";
}

function getOriginVariants(origin) {
  if (!origin || typeof origin !== "string") {
    return [];
  }

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : "";
    const base = `${parsed.protocol}//${host}${port}`;
    const variants = [base];

    if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return variants;
    }

    if (host.startsWith("www.")) {
      variants.push(`${parsed.protocol}//${host.slice(4)}${port}`);
    } else {
      variants.push(`${parsed.protocol}//www.${host}${port}`);
    }

    return Array.from(new Set(variants));
  } catch {
    return [origin.trim()];
  }
}

function formatOriginList(origin) {
  const origins = getOriginVariants(origin);
  if (!origins.length) {
    return "- https://your-domain.com";
  }
  return origins.map((item) => `- ${item}`).join("\n");
}

function getConvexAuthCallbackUri() {
  const runtimeConvexSiteUrl =
    typeof window !== "undefined" &&
    typeof window.__DMS4_CONVEX_SITE_URL__ === "string"
      ? window.__DMS4_CONVEX_SITE_URL__
      : "";
  const buildConvexSiteUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_CONVEX_SITE_URL
      : "";

  const base = firstNonEmptyString([
    runtimeConvexSiteUrl,
    buildConvexSiteUrl,
  ]).replace(/\/$/, "");

  if (!base) {
    return "https://your-convex-site.convex.site/api/auth/callback/google";
  }

  return `${base}/api/auth/callback/google`;
}

export function formatGoogleCalendarErrorDetails(
  error,
  { origin, calendarId },
) {
  const raw = getCalendarErrorMessage(error);
  const lower = raw.toLowerCase();
  const reason = getCalendarErrorReason(error).toUpperCase();
  const originList = formatOriginList(origin);

  if (
    lower.includes("redirect_uri_mismatch") ||
    (lower.includes("redirect uri") && lower.includes("mismatch"))
  ) {
    const convexAuthCallbackUri = getConvexAuthCallbackUri();
    return [
      "Google OAuth redirect URI mismatch.",
      "1. Open Google Cloud Console -> APIs & Services -> Credentials -> your OAuth 2.0 Client ID (Web application).",
      "2. Under Authorized redirect URIs, add this exact callback URI:",
      `- ${convexAuthCallbackUri}`,
      "3. Under Authorized JavaScript origins, add these exact origins:",
      originList,
      "4. Save changes, wait 1-3 minutes, hard refresh your app, and retry.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    reason === "API_KEY_SERVICE_BLOCKED" ||
    (lower.includes("are blocked") && lower.includes("discovery")) ||
    (lower.includes("are blocked") && lower.includes("calendar method"))
  ) {
    return [
      "Your Google API key is currently blocked from Calendar API calls (API_KEY_SERVICE_BLOCKED).",
      "1. Open Google Cloud Console -> APIs & Services -> Credentials -> your API key used in VITE_GOOGLE_API_KEY.",
      "2. In API restrictions, either set Don't restrict key (quick test) or set Restrict key and include Google Calendar API.",
      "3. If testing from localhost and production, keep Application restrictions at HTTP referrers and allow all required origins:",
      originList,
      "4. Ensure Calendar API is enabled in the same Google project as this API key.",
      "5. Save, wait 1-3 minutes, hard refresh, then click Connect again.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("origin_mismatch") ||
    lower.includes("given origin") ||
    lower.includes("not allowed by your app's configuration") ||
    lower.includes("not a valid origin")
  ) {
    return [
      "Google OAuth origin mismatch.",
      "1. Open Google Cloud Console -> APIs & Services -> Credentials -> your OAuth 2.0 Client ID (Web application).",
      "2. Under Authorized JavaScript origins, add these exact origins:",
      originList,
      "3. Save changes, wait 1-3 minutes, hard refresh your app, then click Connect again.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("popup_closed_by_user") ||
    lower.includes("popup_failed_to_open") ||
    lower.includes("idpiframe_initialization_failed")
  ) {
    return [
      "Google sign-in popup was blocked or closed.",
      "1. Allow popups for this site.",
      "2. Disable strict tracking prevention for this tab temporarily.",
      "3. Click Connect and complete the Google popup fully.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("google hasn't verified this app") ||
    lower.includes("app isn't verified") ||
    lower.includes("app is not verified") ||
    lower.includes("unverified app") ||
    lower.includes("risky app") ||
    lower.includes("this app tried to access sensitive info")
  ) {
    const convexAuthCallbackUri = getConvexAuthCallbackUri();
    return [
      "Google is treating this OAuth app as unverified or risky.",
      "1. In Google Cloud Console -> Google Auth Platform -> Branding, Audience, and Data Access, finish the consent screen for this exact project.",
      "2. Add your live site to Authorized domains, verify that domain in Google Search Console, and use homepage/privacy policy URLs on that same domain.",
      "3. If the app is still in Testing, add each allowed Google account under Test users. If the app is for public use, publish it and submit verification.",
      "4. Under Credentials -> OAuth 2.0 Client ID, add these Authorized JavaScript origins:",
      originList,
      "5. For Convex sign-in, add this exact redirect URI:",
      `- ${convexAuthCallbackUri}`,
      "6. Declare every requested scope on the consent screen. calendar.events is a sensitive scope and can keep the warning active until review is approved.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("access_denied") ||
    lower.includes("consent") ||
    lower.includes("app is not configured for users")
  ) {
    return [
      "Google OAuth consent is blocking access for this account.",
      "1. In Google Cloud Console, open OAuth consent screen.",
      "2. If app status is Testing, add your Google account under Test users.",
      "3. If this is production use, publish the consent screen.",
      "4. In Google Account settings, remove this app access and reconnect so consent is requested again.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("api key not valid") ||
    lower.includes("apikey") ||
    lower.includes("accessnotconfigured") ||
    lower.includes("api has not been used") ||
    lower.includes("is disabled") ||
    lower.includes("referer")
  ) {
    return [
      "Google Calendar API key/project setup is invalid for this origin.",
      "1. In Google Cloud Console, make sure Calendar API is enabled in the same project as your OAuth client.",
      "2. Recreate or edit your API key and set HTTP referrer restrictions to include:",
      originList,
      "3. Update VITE_GOOGLE_API_KEY in your production env and rebuild/deploy.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("invalid_client") ||
    lower.includes("unauthorized_client")
  ) {
    return [
      "Google OAuth client ID is invalid for this app.",
      "1. Create or select an OAuth Client ID of type Web application.",
      "2. Add your site origin under Authorized JavaScript origins:",
      originList,
      "3. Set VITE_GOOGLE_CLIENT_ID to that exact client ID and rebuild/deploy.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    lower.includes("insufficient_scope") ||
    lower.includes("insufficient permissions")
  ) {
    return [
      "Google token scope is missing calendar.events permission.",
      "1. Disconnect by removing app access in your Google Account security settings.",
      "2. Reconnect from the app and approve requested permissions.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  if (
    (lower.includes("notfound") && lower.includes("calendar")) ||
    lower.includes("calendarnotfound")
  ) {
    return [
      "The configured Google calendar could not be found.",
      `1. Set VITE_GOOGLE_CALENDAR_ID=primary, or use a valid calendar ID shared with the signed-in account (current: ${calendarId}).`,
      "2. Rebuild and redeploy after updating the env variable.",
      `Google response: ${raw}`,
    ].join("\n");
  }

  return [
    "Google Calendar sync failed with an unclassified setup error.",
    "1. Confirm Calendar API is enabled.",
    "2. Confirm OAuth consent screen is published or your account is listed as a test user.",
    "3. Confirm OAuth Authorized JavaScript origins include your exact domain.",
    "4. Confirm API key HTTP referrer restrictions include your exact domain.",
    "5. Confirm VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY, and optional VITE_GOOGLE_CALENDAR_ID are correct in production build env.",
    `Google response: ${raw}`,
  ].join("\n");
}
