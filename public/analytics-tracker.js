(function () {
  if (window.__dms4AnalyticsTrackerLoaded) {
    return;
  }
  window.__dms4AnalyticsTrackerLoaded = true;

  var STORAGE_KEY = "dms4.analytics.v1";
  var VISITOR_KEY = "dms4.analytics.visitorId";
  var SESSION_KEY = "dms4.analytics.sessionId";
  var CONVEX_URL_KEY = "dms4.analytics.convexSiteUrl";
  var ACCOUNT_KEY = "dms4.analytics.account.v1";
  var HEARTBEAT_MS = 15000;
  var MAX_SESSIONS = 1200;
  var SEND_GAP_MS = 3000;

  function nowMs() {
    return Date.now();
  }

  function normalizeUrl(value) {
    if (!value || typeof value !== "string") {
      return null;
    }
    var trimmed = value.trim();
    if (!trimmed || trimmed.indexOf("%VITE_") === 0) {
      return null;
    }
    return trimmed.replace(/\/+$/, "");
  }

  function toSiteUrl(value) {
    var normalized = normalizeUrl(value);
    if (!normalized) {
      return null;
    }
    return normalized.replace(".convex.cloud", ".convex.site");
  }

  function safeParse(raw) {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  var runtimeConvexUrl =
    toSiteUrl(window.__DMS4_CONVEX_SITE_URL__) ||
    toSiteUrl(window.__DMS4_CONVEX_URL__);
  if (runtimeConvexUrl) {
    localStorage.setItem(CONVEX_URL_KEY, runtimeConvexUrl);
  }

  var convexUrl =
    runtimeConvexUrl || toSiteUrl(localStorage.getItem(CONVEX_URL_KEY));
  var lastSentAt = 0;
  var accountInfo = {
    appUserId: null,
    googleAccountName: null,
    googleAccountEmail: null,
  };
  var sessionStage = "guest";

  function normalizeAccountInput(value) {
    if (typeof value !== "string") {
      return null;
    }
    var trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function applyAccountInfo(next) {
    accountInfo = {
      appUserId: normalizeAccountInput(next.appUserId),
      googleAccountName: normalizeAccountInput(next.googleAccountName),
      googleAccountEmail: normalizeAccountInput(next.googleAccountEmail),
    };

    sessionStage =
      accountInfo.googleAccountEmail ||
      accountInfo.googleAccountName ||
      accountInfo.appUserId
        ? "authenticated"
        : "guest";

    if (sessionStage === "authenticated") {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accountInfo));
    } else {
      localStorage.removeItem(ACCOUNT_KEY);
    }
  }

  var savedAccount = safeParse(localStorage.getItem(ACCOUNT_KEY));
  if (savedAccount && typeof savedAccount === "object") {
    applyAccountInfo(savedAccount);
  }

  function uid(prefix) {
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint8Array(8);
      window.crypto.getRandomValues(bytes);
      var hex = "";
      for (var i = 0; i < bytes.length; i += 1) {
        hex += bytes[i].toString(16).padStart(2, "0");
      }
      return prefix + "_" + hex;
    }
    return (
      prefix +
      "_" +
      Math.random().toString(16).slice(2) +
      "_" +
      nowMs().toString(16)
    );
  }

  function defaultStore(ts) {
    return {
      version: 1,
      meta: {
        createdAt: ts,
        lastUpdated: ts,
      },
      totals: {
        sessions: 0,
        pageViews: 0,
      },
      users: {},
      sessions: {},
    };
  }

  function readStore() {
    var ts = nowMs();
    var parsed = safeParse(localStorage.getItem(STORAGE_KEY));
    var store =
      parsed && typeof parsed === "object" ? parsed : defaultStore(ts);

    if (!store.meta || typeof store.meta !== "object") {
      store.meta = { createdAt: ts, lastUpdated: ts };
    }
    if (!store.totals || typeof store.totals !== "object") {
      store.totals = { sessions: 0, pageViews: 0 };
    }
    if (!store.users || typeof store.users !== "object") {
      store.users = {};
    }
    if (!store.sessions || typeof store.sessions !== "object") {
      store.sessions = {};
    }
    if (typeof store.totals.sessions !== "number") {
      store.totals.sessions = 0;
    }
    if (typeof store.totals.pageViews !== "number") {
      store.totals.pageViews = 0;
    }

    return store;
  }

  function writeStore(store) {
    store.meta.lastUpdated = nowMs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function mutateStore(mutator) {
    var store = readStore();
    mutator(store);
    writeStore(store);
  }

  function currentPath() {
    return (
      window.location.pathname + window.location.search + window.location.hash
    );
  }

  function computeScrollPercent() {
    var doc = document.documentElement;
    var top = window.scrollY || doc.scrollTop || 0;
    var scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);
    return Math.min(100, Math.round((top / scrollable) * 100));
  }

  function sendToConvex(reason, force) {
    if (!convexUrl) {
      return;
    }

    var ts = nowMs();
    if (!force && ts - lastSentAt < SEND_GAP_MS) {
      return;
    }
    lastSentAt = ts;

    var payload = {
      visitorId: visitorId,
      sessionId: sessionId,
      appUserId: accountInfo.appUserId,
      googleAccountName: accountInfo.googleAccountName,
      googleAccountEmail: accountInfo.googleAccountEmail,
      sessionStage: sessionStage,
      timestamp: ts,
      durationSec: previousDurationSec,
      pageViews: pageViews,
      maxScrollPercent: maxScrollPercent,
      path: currentPath(),
      pathCounts: pathCounts,
      sourceHost: window.location.host,
      referrer: document.referrer || "direct",
      userAgent: navigator.userAgent,
      reason: reason,
    };

    var url = convexUrl + "/analytics/ingest";
    var body = JSON.stringify(payload);

    if (
      navigator.sendBeacon &&
      (reason === "beforeunload" || reason === "pagehide")
    ) {
      var blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    fetch(url, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    }).catch(function () {});
  }

  function pruneSessions(store) {
    var sessionList = Object.values(store.sessions);
    if (sessionList.length <= MAX_SESSIONS) {
      return;
    }
    sessionList.sort(function (a, b) {
      return (b.lastSeen || b.endAt || 0) - (a.lastSeen || a.endAt || 0);
    });
    var allowed = sessionList.slice(0, MAX_SESSIONS);
    var next = {};
    for (var i = 0; i < allowed.length; i += 1) {
      next[allowed[i].id] = allowed[i];
    }
    store.sessions = next;
  }

  var visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = uid("user");
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = uid("session");
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  var pathCounts = {};
  var pageViews = 0;
  var maxScrollPercent = 0;
  var previousDurationSec = 0;
  var lastTrackedPath = "";
  var lastTrackedAt = 0;
  var activeAccumulatedMs = 0;
  var activeStartMs = document.hidden ? null : nowMs();

  function ensureUser(store, ts) {
    var user = store.users[visitorId];
    if (!user) {
      user = {
        id: visitorId,
        firstSeen: ts,
        lastSeen: ts,
        sessionCount: 0,
        totalTimeSec: 0,
        totalPageViews: 0,
        lastPath: currentPath(),
        referrer: document.referrer || "direct",
        userAgent: navigator.userAgent,
      };
      store.users[visitorId] = user;
    }
    user.appUserId = accountInfo.appUserId || user.appUserId || null;
    user.googleAccountName =
      accountInfo.googleAccountName || user.googleAccountName || null;
    user.googleAccountEmail =
      accountInfo.googleAccountEmail || user.googleAccountEmail || null;
    user.sessionStage = sessionStage;
    return user;
  }

  function ensureSession(store, ts) {
    var session = store.sessions[sessionId];
    if (!session) {
      var user = ensureUser(store, ts);
      user.sessionCount += 1;
      store.totals.sessions += 1;

      session = {
        id: sessionId,
        userId: visitorId,
        appUserId: accountInfo.appUserId,
        googleAccountName: accountInfo.googleAccountName,
        googleAccountEmail: accountInfo.googleAccountEmail,
        sessionStage: sessionStage,
        startAt: ts,
        endAt: ts,
        lastSeen: ts,
        durationSec: 0,
        pageViews: 0,
        maxScrollPercent: 0,
        sourceHost: window.location.host,
        lastPath: currentPath(),
        referrer: document.referrer || "direct",
        pathCounts: {},
      };
      store.sessions[sessionId] = session;
    }
    return session;
  }

  mutateStore(function (store) {
    var ts = nowMs();
    var user = ensureUser(store, ts);
    var session = ensureSession(store, ts);

    user.lastSeen = ts;
    session.lastSeen = ts;

    previousDurationSec = session.durationSec || 0;
    pageViews = session.pageViews || 0;
    maxScrollPercent = session.maxScrollPercent || 0;
    pathCounts = Object.assign({}, session.pathCounts || {});

    pruneSessions(store);
  });

  function trackPageView(path) {
    var ts = nowMs();
    var resolvedPath = path || currentPath();
    if (resolvedPath === lastTrackedPath && ts - lastTrackedAt < 2000) {
      return;
    }

    lastTrackedPath = resolvedPath;
    lastTrackedAt = ts;

    pageViews += 1;
    pathCounts[resolvedPath] = (pathCounts[resolvedPath] || 0) + 1;

    mutateStore(function (store) {
      var user = ensureUser(store, ts);
      var session = ensureSession(store, ts);

      store.totals.pageViews += 1;
      user.totalPageViews += 1;
      user.lastSeen = ts;
      user.lastPath = resolvedPath;

      session.pageViews = pageViews;
      session.sourceHost = window.location.host;
      session.lastPath = resolvedPath;
      session.pathCounts = pathCounts;
      session.appUserId = accountInfo.appUserId;
      session.googleAccountName = accountInfo.googleAccountName;
      session.googleAccountEmail = accountInfo.googleAccountEmail;
      session.sessionStage = sessionStage;
      session.lastSeen = ts;
      session.endAt = ts;

      pruneSessions(store);
    });

    sendToConvex("page_view", true);
  }

  function syncSession(reason) {
    var ts = nowMs();
    var visibleActiveMs = activeStartMs ? ts - activeStartMs : 0;
    var durationSec = Math.max(
      0,
      Math.floor((activeAccumulatedMs + visibleActiveMs) / 1000),
    );
    var deltaSec = Math.max(0, durationSec - previousDurationSec);

    maxScrollPercent = Math.max(maxScrollPercent, computeScrollPercent());
    previousDurationSec = durationSec;

    mutateStore(function (store) {
      var user = ensureUser(store, ts);
      var session = ensureSession(store, ts);

      user.lastSeen = ts;
      user.lastPath = currentPath();
      user.totalTimeSec += deltaSec;

      session.durationSec = durationSec;
      session.maxScrollPercent = Math.max(
        session.maxScrollPercent || 0,
        maxScrollPercent,
      );
      session.sourceHost = window.location.host;
      session.lastSeen = ts;
      session.endAt = ts;
      session.lastPath = currentPath();
      session.pageViews = pageViews;
      session.pathCounts = pathCounts;
      session.appUserId = accountInfo.appUserId;
      session.googleAccountName = accountInfo.googleAccountName;
      session.googleAccountEmail = accountInfo.googleAccountEmail;
      session.sessionStage = sessionStage;
      session.endedBy = reason;

      pruneSessions(store);
    });

    sendToConvex(reason, false);
  }

  trackPageView(currentPath());
  syncSession("init");

  window.__dms4AnalyticsSetAccount = function (input) {
    if (input === null) {
      applyAccountInfo({
        appUserId: null,
        googleAccountName: null,
        googleAccountEmail: null,
      });
      syncSession("identify");
      sendToConvex("identify", true);
      return;
    }

    if (!input || typeof input !== "object") {
      return;
    }
    applyAccountInfo(input);
    syncSession("identify");
    sendToConvex("identify", true);
  };

  if (window.__dms4PendingAnalyticsAccount !== undefined) {
    window.__dms4AnalyticsSetAccount(window.__dms4PendingAnalyticsAccount);
  }

  window.dispatchEvent(new Event("dms4-analytics-ready"));

  window.addEventListener(
    "scroll",
    function () {
      var percent = computeScrollPercent();
      if (percent > maxScrollPercent) {
        maxScrollPercent = percent;
      }
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (activeStartMs) {
        activeAccumulatedMs += nowMs() - activeStartMs;
        activeStartMs = null;
      }
      syncSession("hidden");
      return;
    }

    activeStartMs = nowMs();
    syncSession("visible");
  });

  function onRouteChange() {
    trackPageView(currentPath());
  }

  var pushState = history.pushState;
  var replaceState = history.replaceState;

  history.pushState = function () {
    var result = pushState.apply(history, arguments);
    window.dispatchEvent(new Event("dms4-routechange"));
    return result;
  };

  history.replaceState = function () {
    var result = replaceState.apply(history, arguments);
    window.dispatchEvent(new Event("dms4-routechange"));
    return result;
  };

  window.addEventListener("popstate", onRouteChange);
  window.addEventListener("hashchange", onRouteChange);
  window.addEventListener("dms4-routechange", onRouteChange);

  window.addEventListener("pagehide", function () {
    if (activeStartMs) {
      activeAccumulatedMs += nowMs() - activeStartMs;
      activeStartMs = null;
    }
    syncSession("pagehide");
  });

  window.addEventListener("beforeunload", function () {
    if (activeStartMs) {
      activeAccumulatedMs += nowMs() - activeStartMs;
      activeStartMs = null;
    }
    syncSession("beforeunload");
  });

  setInterval(function () {
    syncSession("heartbeat");
  }, HEARTBEAT_MS);
})();
