import {
  type PaginationResult,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { requireBuildRun } from "./lib/builds";
import { levelValidator } from "./lib/validators";
import { parseLevel } from "../shared/validation";
import schema from "./schema";

/** Read an owned room layout. */
export const get = query({
  args: { levelId: v.id("levels") },
  returns: v.union(schema.doc("levels"), v.null()),
  handler: async (ctx, { levelId }): Promise<Doc<"levels"> | null> => {
    const ownerId = await requireUserId(ctx);
    const level = await ctx.db.get("levels", levelId);
    return level?.ownerId === ownerId ? level : null;
  },
});

/** Read a build's level candidates in creation order. */
export const listForBuild = internalQuery({
  args: { buildId: v.id("builds"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("levels")),
  handler: async (ctx, { buildId, paginationOpts }): Promise<PaginationResult<Doc<"levels">>> => {
    return ctx.db
      .query("levels")
      .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
      .paginate(paginationOpts);
  },
});

export const recordCandidate = internalMutation({
  args: {
    buildId: v.id("builds"),
    runNumber: v.number(),
    room: levelValidator,
  },
  returns: v.id("levels"),
  handler: async (ctx, { buildId, runNumber, room }): Promise<Id<"levels">> => {
    const build = await requireBuildRun(ctx, buildId, runNumber);
    return ctx.db.insert("levels", {
      ownerId: build.ownerId,
      buildId,
      room: parseLevel(room),
    });
  },
});
