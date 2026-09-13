/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as drilly from "../drilly.js";
import type * as http from "../http.js";
import type * as lib_drilly_attempt from "../lib/drilly/attempt.js";
import type * as lib_drilly_build from "../lib/drilly/build.js";
import type * as lib_drilly_buildSchema from "../lib/drilly/buildSchema.js";
import type * as lib_drilly_construction from "../lib/drilly/construction.js";
import type * as lib_drilly_deadline from "../lib/drilly/deadline.js";
import type * as lib_drilly_movement from "../lib/drilly/movement.js";
import type * as lib_drilly_observation from "../lib/drilly/observation.js";
import type * as lib_drilly_planner from "../lib/drilly/planner.js";
import type * as lib_drilly_proof from "../lib/drilly/proof.js";
import type * as lib_drilly_protocol from "../lib/drilly/protocol.js";
import type * as lib_drilly_provider from "../lib/drilly/provider.js";
import type * as lib_validators from "../lib/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  drilly: typeof drilly;
  http: typeof http;
  "lib/drilly/attempt": typeof lib_drilly_attempt;
  "lib/drilly/build": typeof lib_drilly_build;
  "lib/drilly/buildSchema": typeof lib_drilly_buildSchema;
  "lib/drilly/construction": typeof lib_drilly_construction;
  "lib/drilly/deadline": typeof lib_drilly_deadline;
  "lib/drilly/movement": typeof lib_drilly_movement;
  "lib/drilly/observation": typeof lib_drilly_observation;
  "lib/drilly/planner": typeof lib_drilly_planner;
  "lib/drilly/proof": typeof lib_drilly_proof;
  "lib/drilly/protocol": typeof lib_drilly_protocol;
  "lib/drilly/provider": typeof lib_drilly_provider;
  "lib/validators": typeof lib_validators;
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
