import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

function withoutTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

function normalizeBaseUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported redirect URL protocol: ${parsed.protocol}`);
  }
  return withoutTrailingSlash(parsed.toString());
}

function isAllowedAbsoluteRedirect(redirectTo: string, baseUrl: string) {
  if (!redirectTo.startsWith(baseUrl)) {
    return false;
  }
  const after = redirectTo[baseUrl.length];
  return after === undefined || after === "?" || after === "/";
}

function isAllowedLocalDevRedirect(redirectTo: string) {
  try {
    const url = new URL(redirectTo);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const isLocalHost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return isHttp && isLocalHost;
  } catch {
    return false;
  }
}

function getHostnameVariants(baseUrl: string) {
  const parsed = new URL(baseUrl);
  const hostnames = new Set([parsed.hostname]);

  if (parsed.hostname.startsWith("www.")) {
    hostnames.add(parsed.hostname.slice(4));
  } else {
    hostnames.add(`www.${parsed.hostname}`);
  }

  return [...hostnames].map((hostname) => {
    const variant = new URL(parsed.toString());
    variant.hostname = hostname;
    return variant.toString();
  });
}

async function redirect({ redirectTo }: { redirectTo: string }) {
  const siteUrlRaw = process.env.SITE_URL;
  if (!siteUrlRaw) {
    throw new Error("Missing SITE_URL environment variable");
  }

  const siteUrl = normalizeBaseUrl(siteUrlRaw);
  if (redirectTo.startsWith("?") || redirectTo.startsWith("/")) {
    return `${siteUrl}${redirectTo}`;
  }

  if (isAllowedLocalDevRedirect(redirectTo)) {
    return redirectTo;
  }

  const allowedBaseUrls = [
    ...getHostnameVariants(siteUrl),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].map(normalizeBaseUrl);

  for (const baseUrl of new Set(allowedBaseUrls)) {
    if (isAllowedAbsoluteRedirect(redirectTo, baseUrl)) {
      return redirectTo;
    }
  }

  throw new Error(
    `Invalid \`redirectTo\` ${redirectTo} for configured SITE_URL: ${siteUrl}`,
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    redirect,
  },
});
