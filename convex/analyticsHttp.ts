import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

async function parseJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const raw = await request.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const ingest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const body = await parseJsonBody(request);
  if (!body || typeof body !== "object") {
    return jsonResponse({ ok: false, error: "Invalid body" }, 400);
  }

  const payload = body as Record<string, unknown>;
  const sessionKey =
    typeof payload.sessionId === "string" ? payload.sessionId : null;
  const visitorKey =
    typeof payload.visitorId === "string" ? payload.visitorId : null;
  const sourceHost =
    typeof payload.sourceHost === "string"
      ? payload.sourceHost
      : (request.headers.get("origin") ?? "unknown");

  if (!sessionKey || !visitorKey) {
    return jsonResponse(
      {
        ok: false,
        error: "sessionId and visitorId are required",
      },
      400,
    );
  }

  const timestamp =
    typeof payload.timestamp === "number" && Number.isFinite(payload.timestamp)
      ? Math.floor(payload.timestamp)
      : Date.now();

  await ctx.runMutation((internal as any).analytics.ingestSnapshot, {
    sessionKey,
    visitorKey,
    appUserId:
      typeof payload.appUserId === "string" ? payload.appUserId : undefined,
    googleAccountName:
      typeof payload.googleAccountName === "string"
        ? payload.googleAccountName
        : undefined,
    googleAccountEmail:
      typeof payload.googleAccountEmail === "string"
        ? payload.googleAccountEmail
        : undefined,
    sessionStage:
      typeof payload.sessionStage === "string"
        ? payload.sessionStage
        : undefined,
    sourceHost,
    timestamp,
    durationSec:
      typeof payload.durationSec === "number" &&
      Number.isFinite(payload.durationSec)
        ? payload.durationSec
        : 0,
    pageViews:
      typeof payload.pageViews === "number" &&
      Number.isFinite(payload.pageViews)
        ? payload.pageViews
        : 0,
    maxScrollPercent:
      typeof payload.maxScrollPercent === "number" &&
      Number.isFinite(payload.maxScrollPercent)
        ? payload.maxScrollPercent
        : 0,
    lastPath: typeof payload.path === "string" ? payload.path : "/",
    pathCounts:
      payload.pathCounts && typeof payload.pathCounts === "object"
        ? payload.pathCounts
        : {},
    referrer:
      typeof payload.referrer === "string" ? payload.referrer : undefined,
    userAgent:
      typeof payload.userAgent === "string" ? payload.userAgent : undefined,
    endedBy: typeof payload.reason === "string" ? payload.reason : undefined,
  });

  return jsonResponse({ ok: true });
});

export const summary = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const windowHoursRaw = Number(url.searchParams.get("windowHours") ?? "720");
  const limitRaw = Number(url.searchParams.get("limit") ?? "2000");
  const segmentRaw = url.searchParams.get("segment") ?? "all";

  const data = await ctx.runQuery((api as any).analytics.summary, {
    windowHours: Number.isFinite(windowHoursRaw) ? windowHoursRaw : 720,
    limit: Number.isFinite(limitRaw) ? limitRaw : 2000,
    segment: segmentRaw,
  });

  return jsonResponse({ ok: true, data });
});

export const clear = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const body = await parseJsonBody(request);
  const payload =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const scope = payload.scope === "host" ? "host" : "all";
  const sourceHost =
    scope === "host" && typeof payload.sourceHost === "string"
      ? payload.sourceHost
      : undefined;

  const result = await ctx.runMutation(
    (internal as any).analytics.clearSessions,
    {
      sourceHost,
    },
  );

  return jsonResponse({ ok: true, ...result });
});
