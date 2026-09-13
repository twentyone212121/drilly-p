import { drillyErrorMessage, DRILLY_ERRORS } from "../shared/game/drillyErrors";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import {
  levelValidator,
  builtDungeonValidator,
  raidAttemptValidator,
  buildContextValidator,
} from "./lib/validators";
import { buildDungeon, playDungeon } from "../server/drilly/planner";
import { openAIPlanner } from "../server/drilly/provider";
import { RULES } from "../shared/game/rules";

export const build = action({
  args: {
    rulesVersion: v.string(),
    context: v.optional(buildContextValidator),
  },
  returns: builtDungeonValidator,
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx)))
      throw new ConvexError("Sign in as a guest to play Drilly.");
    if (args.rulesVersion !== RULES.version)
      throw new ConvexError("Reload to use the current game rules.");
    try {
      return await buildDungeon(
        openAIPlanner(env.OPENAI_API_KEY, env.DRILLY_MODEL),
        args.context,
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
  args: { level: levelValidator, rulesVersion: v.string() },
  returns: v.array(raidAttemptValidator),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx)))
      throw new ConvexError("Sign in as a guest to play Drilly.");
    if (args.rulesVersion !== RULES.version)
      throw new ConvexError("Reload to use the current game rules.");
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
