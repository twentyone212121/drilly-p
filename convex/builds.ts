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
import { parseDrillyAttempts } from "../shared/validation";
import { raidAttemptValidator } from "./lib/validators";
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

/** Save the proof and finish its build in the same transaction. */
export const finish = internalMutation({
  args: {
    buildId: v.id("builds"),
    runNumber: v.number(),
    levelId: v.id("levels"),
    attempt: raidAttemptValidator,
  },
  returns: v.null(),
  handler: async (ctx, { buildId, runNumber, levelId, attempt }) => {
    const build = await requireBuildRun(ctx, buildId, runNumber);
    const level = await ctx.db.get("levels", levelId);
    if (!level || level.buildId !== buildId || level.ownerId !== build.ownerId)
      throw new Error("Proof belongs to another build.");

    const [parsed] = parseDrillyAttempts([attempt], level.room);
    const verified = replayAttempt(parsed.replay);
    if (verified.stopReason !== parsed.outcome || verified.state.tick !== parsed.replay.endTick)
      throw new Error("Proof outcome does not match its recording.");

    const { version, rulesVersion, jumpTicks, endTick } = parsed.replay;
    const proofAttemptId = await ctx.db.insert("attempts", {
      ownerId: build.ownerId,
      levelId,
      actor: "drilly",
      number: 1,
      recording: { version, rulesVersion, jumpTicks, endTick },
      outcome: parsed.outcome,
    });
    const accepted =
      verified.stopReason === "won" && runAttempt(level.room, []).stopReason !== "won";

    await ctx.db.patch("builds", buildId, {
      status: accepted ? "ready" : "failed",
      acceptedLevelId: accepted ? levelId : undefined,
      proofAttemptId: accepted ? proofAttemptId : undefined,
      error: accepted ? undefined : DRILLY_ERRORS.unproven,
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
