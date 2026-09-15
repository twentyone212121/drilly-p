import {
  type PaginationResult,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { env, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { requireBuildRun } from "./lib/builds";
import { RULES } from "../shared/game/rules";
import { DRILLY_ERRORS } from "../shared/game/drillyErrors";
import { replayAttempt, runAttempt } from "../shared/game/replay";
import { parseReplay } from "../shared/validation";
import schema from "./schema";

async function schedule(ctx: MutationCtx, buildId: Id<"builds">, runNumber: number) {
  await ctx.scheduler.runAfter(0, internal.drilly.generate, {
    buildId,
    runNumber,
  });
  // Recover jobs that never start or lose their worker before recording a result.
  await ctx.scheduler.runAfter(RULES.drilly.raidClientTimeoutMs, internal.builds.fail, {
    buildId,
    runNumber,
    error: DRILLY_ERRORS.timeout,
  });
}

/** Reuse a pending unassigned build, or schedule a new generation attempt. */
export const request = mutation({
  args: {},
  returns: v.id("builds"),
  handler: async (ctx): Promise<Id<"builds">> => {
    const ownerId = await requireUserId(ctx);
    const pending = await ctx.db
      .query("builds")
      .withIndex("by_ownerId_and_roundId", (q) => q.eq("ownerId", ownerId).eq("roundId", undefined))
      .order("desc")
      .first();
    if (pending && (pending.status === "queued" || pending.status === "running"))
      return pending._id;

    const buildId = await ctx.db.insert("builds", {
      ownerId,
      seed: Math.random().toString(36).slice(2),
      brief:
        "Build a readable room with a distinct spatial idea that requires an intentional jump.",
      model: env.DRILLY_MODEL ?? RULES.drilly.defaultModel,
      status: "queued",
      runNumber: 1,
    });
    await schedule(ctx, buildId, 1);
    return buildId;
  },
});

/** Read the owner's build status and accepted level. */
export const get = query({
  args: { buildId: v.id("builds") },
  returns: v.union(schema.doc("builds"), v.null()),
  handler: async (ctx, { buildId }): Promise<Doc<"builds"> | null> => {
    const ownerId = await requireUserId(ctx);
    const build = await ctx.db.get("builds", buildId);
    return build?.ownerId === ownerId ? build : null;
  },
});

/** Newest first, scoped to the authenticated owner. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("builds")),
  handler: async (ctx, { paginationOpts }): Promise<PaginationResult<Doc<"builds">>> => {
    const ownerId = await requireUserId(ctx);
    return ctx.db
      .query("builds")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** Retry a failed build while retaining its levels and attempts. */
export const retry = mutation({
  args: { buildId: v.id("builds") },
  returns: v.null(),
  handler: async (ctx, { buildId }): Promise<null> => {
    const ownerId = await requireUserId(ctx);
    const build = await ctx.db.get("builds", buildId);
    if (!build || build.ownerId !== ownerId) throw new ConvexError("Build not found.");
    if (build.status !== "failed") return null;

    const runNumber = build.runNumber + 1;
    await ctx.db.patch("builds", buildId, {
      status: "queued",
      runNumber,
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined,
    });
    await schedule(ctx, buildId, runNumber);
    return null;
  },
});

export const begin = internalMutation({
  args: { buildId: v.id("builds"), runNumber: v.number() },
  returns: v.union(schema.doc("builds"), v.null()),
  handler: async (ctx, { buildId, runNumber }): Promise<Doc<"builds"> | null> => {
    const build = await ctx.db.get("builds", buildId);
    if (!build || build.runNumber !== runNumber || build.status !== "queued") return null;
    await ctx.db.patch("builds", buildId, { status: "running", startedAt: Date.now() });
    return ctx.db.get("builds", buildId);
  },
});

export const complete = internalMutation({
  args: {
    buildId: v.id("builds"),
    runNumber: v.number(),
    levelId: v.id("levels"),
    proofAttemptId: v.id("attempts"),
  },
  returns: v.null(),
  handler: async (ctx, { buildId, runNumber, levelId, proofAttemptId }) => {
    const build = await requireBuildRun(ctx, buildId, runNumber);
    const level = await ctx.db.get("levels", levelId);
    const proof = await ctx.db.get("attempts", proofAttemptId);
    if (
      !level ||
      level.buildId !== buildId ||
      level.ownerId !== build.ownerId ||
      !proof ||
      proof.levelId !== levelId ||
      proof.ownerId !== build.ownerId ||
      proof.actor !== "drilly" ||
      proof.roundId ||
      proof.outcome !== "won"
    )
      throw new Error(DRILLY_ERRORS.unproven);

    const verified = replayAttempt(parseReplay({ ...proof.recording, level: level.room }));
    if (
      verified.stopReason !== "won" ||
      verified.state.tick !== proof.recording.endTick ||
      runAttempt(level.room, []).stopReason === "won"
    )
      throw new Error(DRILLY_ERRORS.unproven);

    await ctx.db.patch("builds", buildId, {
      status: "ready",
      acceptedLevelId: levelId,
      proofAttemptId,
      finishedAt: Date.now(),
    });
    return null;
  },
});

export const fail = internalMutation({
  args: { buildId: v.id("builds"), runNumber: v.number(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { buildId, runNumber, error }) => {
    const build = await ctx.db.get("builds", buildId);
    if (!build || build.runNumber !== runNumber || !["queued", "running"].includes(build.status))
      return null;
    await ctx.db.patch("builds", buildId, {
      status: "failed",
      error,
      finishedAt: Date.now(),
    });
    return null;
  },
});
