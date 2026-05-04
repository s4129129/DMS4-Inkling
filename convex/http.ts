import { httpRouter } from "convex/server";
import { auth } from "./auth";
import {
  clear as clearAnalytics,
  ingest as ingestAnalytics,
  summary as summaryAnalytics,
} from "./analyticsHttp";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/analytics/ingest",
  method: "POST",
  handler: ingestAnalytics,
});

http.route({
  path: "/analytics/ingest",
  method: "OPTIONS",
  handler: ingestAnalytics,
});

http.route({
  path: "/analytics/summary",
  method: "GET",
  handler: summaryAnalytics,
});

http.route({
  path: "/analytics/summary",
  method: "OPTIONS",
  handler: summaryAnalytics,
});

http.route({
  path: "/analytics/clear",
  method: "POST",
  handler: clearAnalytics,
});

http.route({
  path: "/analytics/clear",
  method: "OPTIONS",
  handler: clearAnalytics,
});

export default http;
