/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attempts from "../attempts.js";
import type * as auth from "../auth.js";
import type * as builds from "../builds.js";
import type * as drilly from "../drilly.js";
import type * as http from "../http.js";
import type * as levels from "../levels.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_builds from "../lib/builds.js";
import type * as lib_drilly_build from "../lib/drilly/build.js";
import type * as lib_drilly_designs from "../lib/drilly/designs.js";
import type * as lib_drilly_model from "../lib/drilly/model.js";
import type * as lib_drilly_raid from "../lib/drilly/raid.js";
import type * as lib_drilly_roomOutputSchema from "../lib/drilly/roomOutputSchema.js";
import type * as lib_validators from "../lib/validators.js";
import type * as rounds from "../rounds.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attempts: typeof attempts;
  auth: typeof auth;
  builds: typeof builds;
  drilly: typeof drilly;
  http: typeof http;
  levels: typeof levels;
  "lib/auth": typeof lib_auth;
  "lib/builds": typeof lib_builds;
  "lib/drilly/build": typeof lib_drilly_build;
  "lib/drilly/designs": typeof lib_drilly_designs;
  "lib/drilly/model": typeof lib_drilly_model;
  "lib/drilly/raid": typeof lib_drilly_raid;
  "lib/drilly/roomOutputSchema": typeof lib_drilly_roomOutputSchema;
  "lib/validators": typeof lib_validators;
  rounds: typeof rounds;
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

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
