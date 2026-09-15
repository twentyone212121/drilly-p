import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  attemptActorValidator,
  attemptOutcomeValidator,
  attemptRecordingValidator,
  buildStatusValidator,
  levelValidator,
  raidStatusValidator,
  roundResultValidator,
  roundStatusValidator,
} from "./lib/validators";

export default defineSchema({
  ...authTables,

  // Level generation attempt
  builds: defineTable({
    ownerId: v.id("users"),
    roundId: v.optional(v.id("rounds")),
    seed: v.string(),
    brief: v.string(),
    model: v.string(),
    status: buildStatusValidator,
    // Rejects results from an earlier worker run.
    runNumber: v.number(),
    acceptedLevelId: v.optional(v.id("levels")),
    proofAttemptId: v.optional(v.id("attempts")),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_roundId", ["ownerId", "roundId"])
    .index("by_roundId", ["roundId"]),

  levels: defineTable({
    ownerId: v.id("users"),
    // Absent for player-created rooms.
    buildId: v.optional(v.id("builds")),
    room: levelValidator,
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_buildId", ["buildId"]),

  // Level completion attempt
  attempts: defineTable({
    ownerId: v.id("users"),
    levelId: v.id("levels"),
    // Absent for builder proofs.
    roundId: v.optional(v.id("rounds")),
    actor: attemptActorValidator,
    // One-based per round and actor, or per level for proofs.
    number: v.number(),
    recording: attemptRecordingValidator,
    outcome: attemptOutcomeValidator,
  })
    .index("by_levelId_and_actor_and_number", ["levelId", "actor", "number"])
    .index("by_roundId_and_actor_and_number", ["roundId", "actor", "number"]),

  // Round with both levels and results
  rounds: defineTable({
    ownerId: v.id("users"),
    playerLevelId: v.id("levels"),
    // Set when generation finishes.
    drillyLevelId: v.optional(v.id("levels")),
    drillyModel: v.string(),
    status: roundStatusValidator,
    drillyStatus: raidStatusValidator,
    drillyRunNumber: v.number(),
    drillyError: v.optional(v.string()),
    // Computed from verified attempts.
    result: v.optional(roundResultValidator),
    finishedAt: v.optional(v.number()),
  }).index("by_ownerId", ["ownerId"]),
});
