"use node";

import { drillyErrorMessage, DRILLY_ERRORS } from "../shared/game/drillyErrors";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import {
  levelValidator,
  builtDungeonValidator,
  raidAttemptValidator,
  drillyModelValidator,
} from "./lib/validators";
import { buildDungeon } from "./lib/drilly/build";
import { playRaidAttempt } from "./lib/drilly/raid";
import { openAIPlanner } from "./lib/drilly/provider";
import { RULES } from "../shared/game/rules";

export const build = action({
  args: {},
  returns: builtDungeonValidator,
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) throw new ConvexError("Sign in as a guest to play Drilly.");
    const started = Date.now();
    console.info("drilly.build.started", { model: env.DRILLY_MODEL ?? RULES.drilly.defaultModel });
    try {
      const room = await buildDungeon(openAIPlanner(env.OPENAI_API_KEY, env.DRILLY_MODEL), (progress) =>
        console.info("drilly.build", progress),
      );
      console.info("drilly.build.completed", { elapsedMs: Date.now() - started });
      return room;
    } catch (error) {
      const message = drillyErrorMessage(error, DRILLY_ERRORS.unavailable);
      console.warn("drilly.build.failed", { elapsedMs: Date.now() - started, message });
      throw new ConvexError(message);
    }
  },
});

export const raid = action({
  args: {
    level: levelValidator,
    previousAttempts: v.array(raidAttemptValidator),
    model: v.optional(drillyModelValidator),
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
