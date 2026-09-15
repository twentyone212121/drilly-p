"use node";

import { drillyErrorMessage, DRILLY_ERRORS } from "../shared/game/drillyErrors";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, env, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { levelValidator, raidAttemptValidator } from "./lib/validators";
import { buildDungeon } from "./lib/drilly/build";
import { playRaidAttempt } from "./lib/drilly/raid";
import { openAIPlanner } from "./lib/drilly/provider";
import { RULES } from "../shared/game/rules";
import { withDeadline } from "./lib/drilly/deadline";

export const generate = internalAction({
  args: { buildId: v.id("builds"), runNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const build = await ctx.runMutation(internal.builds.begin, args);
    if (!build) return null;
    const started = Date.now();
    console.info("drilly.build.started", { ...args, model: build.model });

    try {
      const plan = withDeadline(
        openAIPlanner(env.OPENAI_API_KEY, build.model),
        RULES.drilly.buildThinkingTimeoutMs,
      );
      const room = await buildDungeon(plan, {
        seed: `${build.seed}-${build.runNumber}`,
        brief: build.brief,
      });
      const levelId = await ctx.runMutation(internal.levels.recordCandidate, { ...args, room });
      const attempt = await playRaidAttempt(room, plan);
      const proofAttemptId = await ctx.runMutation(internal.attempts.recordProof, {
        ...args,
        levelId,
        attempt,
      });
      await ctx.runMutation(internal.builds.complete, { ...args, levelId, proofAttemptId });
      console.info("drilly.build.completed", {
        elapsedMs: Date.now() - started,
      });
    } catch (error) {
      const message = drillyErrorMessage(error, DRILLY_ERRORS.unavailable);
      console.warn("drilly.build.failed", {
        elapsedMs: Date.now() - started,
        message,
      });
      await ctx.runMutation(internal.builds.fail, { ...args, error: message });
    }
    return null;
  },
});

export const raid = action({
  args: {
    level: levelValidator,
    previousAttempts: v.array(raidAttemptValidator),
    model: v.optional(v.string()),
  },
  returns: raidAttemptValidator,
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) throw new ConvexError("Sign in as a guest to play Drilly.");
    const started = Date.now();
    const attemptNumber = args.previousAttempts.length + 1;
    const model = args.model ?? env.DRILLY_MODEL ?? RULES.drilly.defaultModel;
    console.info("drilly.raid.started", {
      attempt: attemptNumber,
      model,
    });
    try {
      const plan = openAIPlanner(env.OPENAI_API_KEY, model);
      const attempt = await playRaidAttempt(
        args.level,
        async (instructions, input, options) => {
          console.info("drilly.raid.input", JSON.stringify({ instructions, input }));
          const output = await plan(instructions, input, options);
          console.info("drilly.raid.output", JSON.stringify(output));
          return output;
        },
        args.previousAttempts,
      );
      console.info("drilly.raid.completed", {
        attempt: attemptNumber,
        elapsedMs: Date.now() - started,
        outcome: attempt.outcome,
        ticks: attempt.replay.endTick,
        jumpTicks: attempt.replay.jumpTicks,
      });
      return attempt;
    } catch (error) {
      const message = drillyErrorMessage(error, DRILLY_ERRORS.unavailable);
      console.warn("drilly.raid.failed", {
        attempt: attemptNumber,
        elapsedMs: Date.now() - started,
        message,
      });
      throw new ConvexError(message);
    }
  },
});
