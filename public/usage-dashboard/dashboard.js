(function () {
  var STORAGE_KEY = "dms4.analytics.v1";
  var VISITOR_KEY = "dms4.analytics.visitorId";
  var SESSION_KEY = "dms4.analytics.sessionId";
  var CONVEX_URL_KEY = "dms4.analytics.convexSiteUrl";
  var SEGMENT_KEY = "dms4.analytics.segment";
  var ACTIVE_WINDOW_MS = 5 * 60 * 1000;
  var segment = localStorage.getItem(SEGMENT_KEY) || "all";
  var SEGMENT_LABELS = {
    all: "All traffic",
    local: "Local",
    production: "Production",
    other: "Other hosts",
  };

  function normalizeUrl(value) {
    if (!value || typeof value !== "string") {
      return null;
    }
    var trimmed = value.trim();
    if (!trimmed) {
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

  function resolveConvexUrl() {
    var fromQuery = toSiteUrl(
      new URLSearchParams(window.location.search).get("convexUrl"),
    );
    if (fromQuery) {
      localStorage.setItem(CONVEX_URL_KEY, fromQuery);
      return fromQuery;
    }
    return toSiteUrl(localStorage.getItem(CONVEX_URL_KEY));
  }

  var convexUrl = resolveConvexUrl();

  function inferAppBasePath() {
    var marker = "/usage-dashboard/";
    var path = window.location.pathname;
    var markerIndex = path.indexOf(marker);
    if (markerIndex === -1) {
      return "/";
    }
    var prefix = path.slice(0, markerIndex + 1);
    return prefix || "/";
  }

  async function detectConvexUrlFromMainApp() {
    try {
      var basePath = inferAppBasePath();
      var response = await fetch(basePath, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      var html = await response.text();
      var siteMatch = html.match(/__DMS4_CONVEX_SITE_URL__\s*=\s*"([^"]+)"/);
      if (siteMatch && siteMatch[1]) {
        return toSiteUrl(siteMatch[1]);
      }
      var cloudMatch = html.match(/__DMS4_CONVEX_URL__\s*=\s*"([^"]+)"/);
      if (cloudMatch && cloudMatch[1]) {
        return toSiteUrl(cloudMatch[1]);
      }
      return null;
    } catch {
      return null;
    }
  }

  function parseStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatPercent(value) {
    return Number(value || 0).toFixed(1) + "%";
  }

  function formatDuration(seconds) {
    var total = Math.max(0, Math.floor(Number(seconds || 0)));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;

    if (h > 0) {
      return h + "h " + String(m).padStart(2, "0") + "m";
    }
    if (m > 0) {
      return m + "m " + String(s).padStart(2, "0") + "s";
    }
    return s + "s";
  }

  function shortId(id) {
    if (!id) {
      return "-";
    }
    id = String(id);
    if (id.length <= 10) {
      return id;
    }
    return id.slice(0, 5) + "..." + id.slice(-4);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function classifyHost(sourceHost) {
    var host = String(sourceHost || "")
      .toLowerCase()
      .replace(/:\d+$/, "");
    if (
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]")
    ) {
      return "local";
    }
    if (
      host === "inklingreader.xyz" ||
      host === "www.inklingreader.xyz" ||
      host === "s4129129.github.io" ||
      host.includes("dms.onl")
    ) {
      return "production";
    }
    return "other";
  }

  function normalizeSegment(value) {
    if (
      value === "all" ||
      value === "local" ||
      value === "production" ||
      value === "other"
    ) {
      return value;
    }
    if (value === "namecheap") {
      return "production";
    }
    return "all";
  }

  function matchesSegment(sourceHost) {
    if (segment === "all") {
      return true;
    }
    return classifyHost(sourceHost) === segment;
  }

  function normalizeSessionStage(value) {
    return value === "authenticated" ? "authenticated" : "guest";
  }

  function isAuthenticatedSession(session) {
    return normalizeSessionStage(session && session.sessionStage) === "authenticated";
  }

  function userIdentityKey(session) {
    return (
      session.googleAccountEmail ||
      session.appUserId ||
      session.userId ||
      session.id ||
      "-"
    );
  }

  function timeAgo(ts) {
    if (!ts) {
      return "-";
    }
    var sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) {
      return "just now";
    }
    if (sec < 60) {
      return sec + "s ago";
    }
    var min = Math.floor(sec / 60);
    if (min < 60) {
      return min + "m ago";
    }
    var hr = Math.floor(min / 60);
    if (hr < 48) {
      return hr + "h ago";
    }
    var day = Math.floor(hr / 24);
    return day + "d ago";
  }

  function aggregate(store) {
    var sessionsMap = store && store.sessions ? store.sessions : {};

    var sessions = Object.values(sessionsMap).filter(function (session) {
      return matchesSegment(session.sourceHost || window.location.host);
    });
    var authenticatedSessions = sessions.filter(isAuthenticatedSession);
    var authenticatedUserIds = new Set(
      authenticatedSessions.map(userIdentityKey).filter(Boolean),
    );
    var now = Date.now();

    var activeUserIds = new Set();
    authenticatedSessions.forEach(function (session) {
      if (now - Number(session.lastSeen || 0) <= ACTIVE_WINDOW_MS) {
        activeUserIds.add(userIdentityKey(session));
      }
    });

    var totalDuration = sessions.reduce(function (sum, session) {
      return sum + Number(session.durationSec || 0);
    }, 0);

    var totalSessions = sessions.length;
    var avgSession = totalSessions > 0 ? totalDuration / totalSessions : 0;

    var bounceCount = sessions.filter(function (session) {
      return Number(session.pageViews || 0) <= 1;
    }).length;

    var bounceRate =
      totalSessions > 0 ? (bounceCount / totalSessions) * 100 : 0;

    var totals = segment === "all" && store && store.totals ? store.totals : {
      sessions: totalSessions,
      pageViews: 0,
    };
    var totalPageViews =
      segment === "all"
        ? Number(totals.pageViews || 0)
        : sessions.reduce(function (sum, session) {
            return sum + Number(session.pageViews || 0);
          }, 0);

    var pageMap = {};
    sessions.forEach(function (session) {
      var pathCounts = session.pathCounts || {};
      var keys = Object.keys(pathCounts);

      if (keys.length === 0 && session.lastPath) {
        pageMap[session.lastPath] =
          (pageMap[session.lastPath] || 0) + Number(session.pageViews || 1);
        return;
      }

      keys.forEach(function (path) {
        pageMap[path] = (pageMap[path] || 0) + Number(pathCounts[path] || 0);
      });
    });

    var topPages = Object.entries(pageMap)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 8)
      .map(function (entry) {
        return { path: entry[0], hits: entry[1] };
      });

    var durationBuckets = [
      { label: "0-1m", min: 0, max: 60, count: 0 },
      { label: "1-5m", min: 60, max: 300, count: 0 },
      { label: "5-15m", min: 300, max: 900, count: 0 },
      { label: "15-30m", min: 900, max: 1800, count: 0 },
      { label: "30-60m", min: 1800, max: 3600, count: 0 },
      { label: "60-120m", min: 3600, max: 7200, count: 0 },
      { label: "2-4h", min: 7200, max: 14400, count: 0 },
      { label: "4-8h", min: 14400, max: 28800, count: 0 },
      { label: "8-12h", min: 28800, max: 43200, count: 0 },
      { label: "12h+", min: 43200, max: Infinity, count: 0 },
    ];

    sessions.forEach(function (session) {
      var duration = Number(session.durationSec || 0);
      for (var i = 0; i < durationBuckets.length; i += 1) {
        var bucket = durationBuckets[i];
        if (duration >= bucket.min && duration < bucket.max) {
          bucket.count += 1;
          break;
        }
      }
    });

    var recentSessions = sessions
      .slice()
      .sort(function (a, b) {
        return (
          Number(b.lastSeen || b.endAt || 0) -
          Number(a.lastSeen || a.endAt || 0)
        );
      })
      .slice(0, 12);

    var groupedUsersMap = {};
    authenticatedSessions.forEach(function (session) {
      var key =
        session.googleAccountEmail ||
        session.appUserId ||
        session.userId ||
        "anonymous";
      if (!groupedUsersMap[key]) {
        groupedUsersMap[key] = {
          userId: session.userId || "-",
          appUserId: session.appUserId || null,
          googleAccountName: session.googleAccountName || null,
          googleAccountEmail: session.googleAccountEmail || null,
          sessionCount: 0,
          totalDurationSec: 0,
          totalPageViews: 0,
          lastSeen: 0,
          sessions: [],
        };
      }
      var group = groupedUsersMap[key];
      group.sessionCount += 1;
      group.totalDurationSec += Number(session.durationSec || 0);
      group.totalPageViews += Number(session.pageViews || 0);
      group.lastSeen = Math.max(group.lastSeen, Number(session.lastSeen || 0));
      group.sessions.push({
        id: session.id,
        durationSec: Number(session.durationSec || 0),
        pageViews: Number(session.pageViews || 0),
        sourceHost: session.sourceHost || "local",
        lastSeen: Number(session.lastSeen || 0),
      });
    });

    var groupedUsers = Object.values(groupedUsersMap)
      .map(function (group) {
        group.sessions.sort(function (a, b) {
          return b.lastSeen - a.lastSeen;
        });
        group.sessions = group.sessions.slice(0, 10);
        return group;
      })
      .sort(function (a, b) {
        return b.lastSeen - a.lastSeen;
      })
      .slice(0, 40);

    return {
      totalUsers: authenticatedUserIds.size,
      activeUsers: activeUserIds.size,
      totalSessions: Number(totals.sessions || totalSessions),
      totalPageViews: totalPageViews,
      avgSession: avgSession,
      bounceRate: bounceRate,
      topPages: topPages,
      durationBuckets: durationBuckets,
      recentSessions: recentSessions,
      groupedUsers: groupedUsers,
      updatedAt: store && store.meta ? Number(store.meta.lastUpdated || 0) : 0,
    };
  }

  function renderBars(containerId, rows, labelKey, valueKey) {
    var container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    if (!rows || rows.length === 0) {
      container.innerHTML = "<p class='muted'>No data yet.</p>";
      return;
    }

    var max = rows.reduce(function (acc, row) {
      return Math.max(acc, Number(row[valueKey] || 0));
    }, 0);

    container.innerHTML = rows
      .map(function (row) {
        var value = Number(row[valueKey] || 0);
        var width = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;
        var safeLabel = escapeHtml(row[labelKey] || "-");

        return [
          "<div class='bar-row'>",
          "  <div class='bar-label' title='" +
            safeLabel +
            "'>" +
            safeLabel +
            "</div>",
          "  <div class='bar-track'><div class='bar-fill' style='width:" +
            width +
            "%'></div></div>",
          "  <strong>" + formatNumber(value) + "</strong>",
          "</div>",
        ].join("");
      })
      .join("");
  }

  function renderSessionsTable(sessions) {
    var tbody = document.getElementById("sessionsTable");
    if (!tbody) {
      return;
    }

    if (!sessions || sessions.length === 0) {
      tbody.innerHTML =
        "<tr><td colspan='10' class='muted'>No sessions captured yet. Visit the main app and interact for a minute.</td></tr>";
      return;
    }

    tbody.innerHTML = sessions
      .map(function (session) {
        var safePath = escapeHtml(session.lastPath || "-");
        var stage = normalizeSessionStage(session.sessionStage);
        var googleAccount = escapeHtml(
          session.googleAccountName || session.googleAccountEmail || "-",
        );
        var sourceHost = escapeHtml(session.sourceHost || "-");

        return [
          "<tr>",
          "<td>" + escapeHtml(shortId(session.id)) + "</td>",
          "<td>" + escapeHtml(shortId(session.userId)) + "</td>",
          "<td>" + googleAccount + "</td>",
          "<td><span class='stage-pill stage-" +
            stage +
            "'>" +
            stage +
            "</span></td>",
          "<td>" + formatDuration(session.durationSec) + "</td>",
          "<td>" + formatNumber(session.pageViews) + "</td>",
          "<td>" + formatNumber(session.maxScrollPercent || 0) + "%</td>",
          "<td>" + sourceHost + "</td>",
          "<td title='" + safePath + "'>" + safePath + "</td>",
          "<td>" +
            timeAgo(Number(session.lastSeen || session.endAt || 0)) +
            "</td>",
          "</tr>",
        ].join("");
      })
      .join("");
  }

  function renderGroupedUsers(groups) {
    var container = document.getElementById("groupedUsers");
    if (!container) {
      return;
    }

    if (!groups || groups.length === 0) {
      container.innerHTML = "<p class='muted'>No grouped users yet.</p>";
      setText("groupedUsersCount", "0 users");
      return;
    }

    setText("groupedUsersCount", formatNumber(groups.length) + " users");

    container.innerHTML = groups
      .map(function (group) {
        var label =
          group.googleAccountName ||
          group.googleAccountEmail ||
          shortId(group.appUserId || group.userId || "-");
        var chips = (group.sessions || [])
          .slice(0, 8)
          .map(function (session) {
            return (
              "<span class='session-chip'>" +
              escapeHtml(shortId(session.id)) +
              " | " +
              formatDuration(session.durationSec) +
              " | " +
              escapeHtml(session.sourceHost || "-") +
              "</span>"
            );
          })
          .join("");

        return [
          "<article class='group-card'>",
          "<div class='group-head'>",
          "<strong>" + escapeHtml(label) + "</strong>",
          "<span>sessions: " +
            formatNumber(group.sessionCount) +
            " | pages: " +
            formatNumber(group.totalPageViews) +
            " | total: " +
            formatDuration(group.totalDurationSec) +
            "</span>",
          "</div>",
          "<div class='session-chip-list'>" + chips + "</div>",
          "</article>",
        ].join("");
      })
      .join("");
  }

  function mdEscape(value) {
    return String(value || "")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, " ");
  }

  function buildMarkdownReport(data) {
    var lines = [];
    var stamp = new Date(
      data.generatedAt || data.updatedAt || Date.now(),
    ).toISOString();
    lines.push("# Inkling Analytics Report");
    lines.push("");
    lines.push("Generated: " + stamp);
    lines.push(
      "Segment: " +
        (SEGMENT_LABELS[normalizeSegment(data.segment || segment)] ||
          "All traffic"),
    );
    lines.push("");
    lines.push("## KPI");
    lines.push("");
    lines.push("- Total users: " + formatNumber(data.totalUsers));
    lines.push("- Active users (5m): " + formatNumber(data.activeUsers));
    lines.push("- Total sessions: " + formatNumber(data.totalSessions));
    lines.push("- Total page views: " + formatNumber(data.totalPageViews));
    lines.push(
      "- Avg session: " + formatDuration(data.avgSessionSec || data.avgSession),
    );
    lines.push("- Bounce rate: " + formatPercent(data.bounceRate));
    lines.push("");

    if (data.breakdown) {
      var productionBreakdown =
        data.breakdown.production ||
        data.breakdown.namecheap || { sessions: 0, users: 0, pageViews: 0 };
      lines.push("## Source Breakdown");
      lines.push("");
      lines.push("| Source | Sessions | Users | Page Views |");
      lines.push("|---|---:|---:|---:|");
      lines.push(
        "| Local | " +
          data.breakdown.local.sessions +
          " | " +
          data.breakdown.local.users +
          " | " +
          data.breakdown.local.pageViews +
          " |",
      );
      lines.push(
        "| Production | " +
          productionBreakdown.sessions +
          " | " +
          productionBreakdown.users +
          " | " +
          productionBreakdown.pageViews +
          " |",
      );
      lines.push(
        "| Other | " +
          data.breakdown.other.sessions +
          " | " +
          data.breakdown.other.users +
          " | " +
          data.breakdown.other.pageViews +
          " |",
      );
      lines.push("");
    }

    lines.push("## Duration Buckets");
    lines.push("");
    lines.push("| Bucket | Sessions |");
    lines.push("|---|---:|");
    (data.durationBuckets || []).forEach(function (bucket) {
      lines.push(
        "| " +
          mdEscape(bucket.label) +
          " | " +
          formatNumber(bucket.count) +
          " |",
      );
    });
    lines.push("");

    lines.push("## Top Pages");
    lines.push("");
    lines.push("| Path | Hits |");
    lines.push("|---|---:|");
    (data.topPages || []).forEach(function (page) {
      lines.push(
        "| " + mdEscape(page.path) + " | " + formatNumber(page.hits) + " |",
      );
    });
    lines.push("");

    lines.push("## Recent Sessions");
    lines.push("");
    lines.push(
      "| Session | User | Google Account | Stage | Duration | Pages | Scroll | Source | Last Path | Last Seen |",
    );
    lines.push("|---|---|---|---|---:|---:|---:|---|---|---|");
    (data.recentSessions || []).forEach(function (session) {
      lines.push(
        "| " +
          mdEscape(session.id) +
          " | " +
          mdEscape(session.userId) +
          " | " +
          mdEscape(
            session.googleAccountName || session.googleAccountEmail || "-",
          ) +
          " | " +
          mdEscape(normalizeSessionStage(session.sessionStage)) +
          " | " +
          mdEscape(formatDuration(session.durationSec)) +
          " | " +
          formatNumber(session.pageViews) +
          " | " +
          formatNumber(session.maxScrollPercent || 0) +
          "% | " +
          mdEscape(session.sourceHost || "-") +
          " | " +
          mdEscape(session.lastPath || "-") +
          " | " +
          mdEscape(timeAgo(session.lastSeen || 0)) +
          " |",
      );
    });
    lines.push("");

    lines.push("## Grouped Users");
    lines.push("");
    lines.push(
      "| User | Email | Sessions | Total Duration | Total Pages | Last Seen |",
    );
    lines.push("|---|---|---:|---:|---:|---|");
    (data.groupedUsers || []).forEach(function (group) {
      lines.push(
        "| " +
          mdEscape(group.googleAccountName || group.userId || "-") +
          " | " +
          mdEscape(group.googleAccountEmail || "-") +
          " | " +
          formatNumber(group.sessionCount) +
          " | " +
          mdEscape(formatDuration(group.totalDurationSec || 0)) +
          " | " +
          formatNumber(group.totalPageViews || 0) +
          " | " +
          mdEscape(timeAgo(group.lastSeen || 0)) +
          " |",
      );
    });

    return lines.join("\n");
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function setSourceStatus(text) {
    setText("sourceStatus", text);
  }

  async function fetchRemoteSummary() {
    if (!convexUrl) {
      return null;
    }

    try {
      var querySegment = normalizeSegment(segment);
      var response = await fetch(
        convexUrl +
          "/analytics/summary?windowHours=720&limit=2500&segment=" +
          encodeURIComponent(querySegment),
        {
          method: "GET",
          mode: "cors",
        },
      );
      if (!response.ok) {
        throw new Error("Summary request failed");
      }
      var payload = await response.json();
      if (!payload || !payload.ok || !payload.data) {
        throw new Error("Invalid summary payload");
      }
      return payload.data;
    } catch {
      return null;
    }
  }

  async function clearRemoteData() {
    if (!convexUrl) {
      return null;
    }

    try {
      var response = await fetch(convexUrl + "/analytics/clear", {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope: "all" }),
      });
      if (!response.ok) {
        return null;
      }
      var payload = await response.json();
      if (!payload || !payload.ok) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  function paint(data) {
    var avgSessionValue =
      typeof data.avgSessionSec === "number"
        ? data.avgSessionSec
        : data.avgSession;

    setText("totalUsers", formatNumber(data.totalUsers));
    setText("activeUsers", formatNumber(data.activeUsers));
    setText("totalSessions", formatNumber(data.totalSessions));
    setText("pageViews", formatNumber(data.totalPageViews));
    setText("avgSession", formatDuration(avgSessionValue));
    setText("bounceRate", formatPercent(data.bounceRate));
    setText("topPagesCount", formatNumber(data.topPages.length) + " pages");

    if (data.breakdown) {
      var productionBreakdown =
        data.breakdown.production ||
        data.breakdown.namecheap || { sessions: 0 };
      var currentSegment = normalizeSegment(data.segment || segment);
      setSourceStatus(
        "Source: Convex | Local sessions: " +
          formatNumber(data.breakdown.local.sessions) +
          " | Production sessions: " +
          formatNumber(productionBreakdown.sessions) +
          " | Current filter: " +
          (SEGMENT_LABELS[currentSegment] || "All traffic"),
      );
    } else {
      setSourceStatus(
        "Source: local browser storage fallback | Current filter: " +
          (SEGMENT_LABELS[normalizeSegment(segment)] || "All traffic"),
      );
    }

    var updated =
      data.updatedAt || data.generatedAt
        ? new Date(data.updatedAt || data.generatedAt)
        : null;
    setText(
      "updatedAt",
      updated ? "Updated " + updated.toLocaleString() : "No telemetry yet",
    );

    renderBars("topPages", data.topPages, "path", "hits");
    renderBars("durationBuckets", data.durationBuckets, "label", "count");
    renderSessionsTable(data.recentSessions);
    renderGroupedUsers(data.groupedUsers || []);
  }

  async function render() {
    if (!convexUrl) {
      var detected = await detectConvexUrlFromMainApp();
      if (detected) {
        convexUrl = detected;
        localStorage.setItem(CONVEX_URL_KEY, detected);
        var input = document.getElementById("convexUrlInput");
        if (input) {
          input.value = detected;
        }
      }
    }

    var remote = await fetchRemoteSummary();
    if (remote) {
      paint(remote);
      return;
    }

    var store = parseStore();
    var localData = aggregate(store);
    paint(localData);
  }

  function setupActions() {
    var refresh = document.getElementById("refreshBtn");
    var exportBtn = document.getElementById("exportBtn");
    var exportMdBtn = document.getElementById("exportMdBtn");
    var clearBtn = document.getElementById("clearBtn");
    var connectBtn = document.getElementById("connectBtn");
    var convexUrlInput = document.getElementById("convexUrlInput");
    var segmentFilter = document.getElementById("segmentFilter");

    segment = normalizeSegment(segment);
    if (segmentFilter) {
      segmentFilter.value = segment;
      segmentFilter.addEventListener("change", function () {
        segment = normalizeSegment(segmentFilter.value);
        localStorage.setItem(SEGMENT_KEY, segment);
        render();
      });
    }

    if (convexUrlInput && convexUrl) {
      convexUrlInput.value = convexUrl;
    }

    if (connectBtn && convexUrlInput) {
      connectBtn.addEventListener("click", function () {
        var candidate = normalizeUrl(convexUrlInput.value);
        candidate = toSiteUrl(candidate);
        if (!candidate) {
          setSourceStatus("Source: invalid Convex URL");
          return;
        }
        convexUrl = candidate;
        localStorage.setItem(CONVEX_URL_KEY, candidate);
        render();
      });
    }

    if (refresh) {
      refresh.addEventListener("click", render);
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        var runExport = async function () {
          var remote = await fetchRemoteSummary();
          var payload = remote || parseStore() || {};
          var blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
          });
          var url = URL.createObjectURL(blob);
          var anchor = document.createElement("a");
          var stamp = new Date().toISOString().replace(/[.:]/g, "-");
          anchor.href = url;
          anchor.download = "inkling-analytics-" + stamp + ".json";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        };
        runExport();
      });
    }

    if (exportMdBtn) {
      exportMdBtn.addEventListener("click", function () {
        var runMarkdownExport = async function () {
          var remote = await fetchRemoteSummary();
          var payload = remote || aggregate(parseStore());
          var markdown = buildMarkdownReport(payload || {});
          var blob = new Blob([markdown], {
            type: "text/markdown;charset=utf-8",
          });
          var url = URL.createObjectURL(blob);
          var anchor = document.createElement("a");
          var stamp = new Date().toISOString().replace(/[.:]/g, "-");
          anchor.href = url;
          anchor.download = "inkling-analytics-" + stamp + ".md";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        };
        runMarkdownExport();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", async function () {
        var shouldClear = window.confirm(
          "Clear analytics data from both browser and Convex?",
        );
        if (!shouldClear) {
          return;
        }

        var remoteResult = await clearRemoteData();
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(VISITOR_KEY);
        localStorage.removeItem(CONVEX_URL_KEY);
        localStorage.removeItem(SEGMENT_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        convexUrl = null;
        segment = "all";
        if (segmentFilter) {
          segmentFilter.value = "all";
        }

        if (remoteResult && typeof remoteResult.deleted === "number") {
          setSourceStatus(
            "Source: cleared " + remoteResult.deleted + " remote sessions",
          );
        } else {
          setSourceStatus("Source: local cleared (remote clear unavailable)");
        }

        render();
      });
    }
  }

  setupActions();
  render();
  setInterval(render, 10000);
})();
