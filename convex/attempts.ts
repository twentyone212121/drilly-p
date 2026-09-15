import {
  type PaginationResult,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { attemptOutcomeValidator, attemptRecordingValidator } from "./lib/validators";
import schema from "./schema";

/** Verify and save a player attempt; repeated round/number submissions must match. */
export const submitPlayer = mutation({
  args: {
    roundId: v.id("rounds"),
    number: v.number(),
    recording: attemptRecordingValidator,
    outcome: attemptOutcomeValidator,
  },
  returns: v.id("attempts"),
  handler: (_ctx, _args): Id<"attempts"> => {
    throw new Error("Not implemented: attempts.submitPlayer");
  },
});

/** Read an owned round's attempts; reveal Drilly's inputs after the player's raid. */
export const listForRound = query({
  args: { roundId: v.id("rounds") },
  returns: v.array(schema.doc("attempts")),
  handler: (_ctx, _args): Doc<"attempts">[] => {
    throw new Error("Not implemented: attempts.listForRound");
  },
});

/** Read a level's proof and raid attempts. */
export const listForLevel = internalQuery({
  args: { levelId: v.id("levels"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("attempts")),
  handler: async (ctx, { levelId, paginationOpts }): Promise<PaginationResult<Doc<"attempts">>> => {
    return ctx.db
      .query("attempts")
      .withIndex("by_levelId_and_actor_and_number", (q) => q.eq("levelId", levelId))
      .paginate(paginationOpts);
  },
});
