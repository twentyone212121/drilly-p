import {
  type PaginationResult,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { levelValidator } from "./lib/validators";
import schema from "./schema";

/** Start a round with an owned build, or return the round already attached to it. */
export const start = mutation({
  args: {
    buildId: v.id("builds"),
    playerLevel: levelValidator,
    drillyModel: v.string(),
  },
  returns: v.id("rounds"),
  handler: (_ctx, _args): Id<"rounds"> => {
    throw new Error("Not implemented: rounds.start");
  },
});

/** Read the owner's round status and result. */
export const get = query({
  args: { roundId: v.id("rounds") },
  returns: v.union(schema.doc("rounds"), v.null()),
  handler: (_ctx, _args): Doc<"rounds"> | null => {
    throw new Error("Not implemented: rounds.get");
  },
});

/** Newest first, scoped to the authenticated owner. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("rounds")),
  handler: (_ctx, _args): PaginationResult<Doc<"rounds">> => {
    throw new Error("Not implemented: rounds.list");
  },
});

/** Resume Drilly's failed raid with its saved attempts and selected model. */
export const retryDrilly = mutation({
  args: { roundId: v.id("rounds") },
  returns: v.null(),
  handler: (_ctx, _args): null => {
    throw new Error("Not implemented: rounds.retryDrilly");
  },
});

/** End an active round without awarding a result. */
export const abandon = mutation({
  args: { roundId: v.id("rounds") },
  returns: v.null(),
  handler: (_ctx, _args): null => {
    throw new Error("Not implemented: rounds.abandon");
  },
});
