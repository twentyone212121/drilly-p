"use node";

import { drillyErrorMessage, DRILLY_ERRORS } from "../shared/game/drillyErrors";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import {
  levelValidator,
  builtDungeonValidator,
  raidAttemptValidator,
} from "./lib/validators";
import { buildDungeon, playDungeon } from "./lib/drilly/planner";
import { openAIPlanner } from "./lib/drilly/provider";

export const build = action({
  args: {},
  returns: builtDungeonValidator,
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx)))
      throw new ConvexError("Sign in as a guest to play Drilly.");
    try {
      return await buildDungeon(
        openAIPlanner(env.OPENAI_API_KEY, env.DRILLY_MODEL),
        (progress) => console.info("drilly.build", progress),
      );
    } catch (error) {
      throw new ConvexError(
        drillyErrorMessage(error, DRILLY_ERRORS.unavailable),
      );
    }
  },
});

export const raid = action({
  args: { level: levelValidator },
  returns: v.array(raidAttemptValidator),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx)))
      throw new ConvexError("Sign in as a guest to play Drilly.");
    try {
      return await playDungeon(
        args.level,
        openAIPlanner(env.OPENAI_API_KEY, env.DRILLY_MODEL),
        (progress) => console.info("drilly.raid", progress),
      );
    } catch (error) {
      throw new ConvexError(
        drillyErrorMessage(error, DRILLY_ERRORS.unavailable),
      );
    }
  },
});
