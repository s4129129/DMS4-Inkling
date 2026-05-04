/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as analyticsHttp from "../analyticsHttp.js";
import type * as auth from "../auth.js";
import type * as bookAssets from "../bookAssets.js";
import type * as books from "../books.js";
import type * as dashboard from "../dashboard.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as timers from "../timers.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  analyticsHttp: typeof analyticsHttp;
  auth: typeof auth;
  bookAssets: typeof bookAssets;
  books: typeof books;
  dashboard: typeof dashboard;
  groups: typeof groups;
  http: typeof http;
  timers: typeof timers;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
