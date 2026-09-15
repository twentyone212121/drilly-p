import { v } from "convex/values";

const rectangle = {
  id: v.string(),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
};

const center = {
  id: v.string(),
  x: v.number(),
  y: v.number(),
  radius: v.number(),
};
const patrol = {
  ...center,
  endX: v.number(),
  endY: v.number(),
  speed: v.number(),
};
const obstacleValidator = v.union(
  v.object({ ...rectangle, kind: v.literal("spikes") }),
  v.object({ ...patrol, kind: v.literal("slider") }),
  v.object({ ...patrol, kind: v.literal("drone") }),
  v.object({
    ...center,
    kind: v.literal("turret"),
    mode: v.union(v.literal("fixed"), v.literal("aimed"), v.literal("flame")),
    direction: v.union(v.literal(-1), v.literal(1)),
    intervalTicks: v.number(),
    warmupTicks: v.number(),
    activeTicks: v.number(),
    range: v.number(),
    projectileSpeed: v.number(),
  }),
  v.object({
    ...center,
    kind: v.literal("pursuer"),
    speed: v.number(),
    detectionRange: v.number(),
    chaseRange: v.number(),
    warningTicks: v.number(),
  }),
);

// These validators describe stored values; shared/validation.ts checks gameplay constraints.
export const levelValidator = v.object({
  version: v.literal(2),
  id: v.string(),
  name: v.string(),
  width: v.number(),
  height: v.number(),
  spawn: v.object({
    x: v.number(),
    y: v.number(),
    direction: v.union(v.literal(-1), v.literal(1)),
  }),
  platforms: v.array(v.object(rectangle)),
  traps: v.array(
    v.object({
      id: v.string(),
      x: v.number(),
      y: v.number(),
      radius: v.number(),
    }),
  ),
  obstacles: v.optional(v.array(obstacleValidator)),
  treasures: v.array(v.object(rectangle)),
});

export const replayValidator = v.object({
  version: v.literal(2),
  rulesVersion: v.string(),
  level: levelValidator,
  jumpTicks: v.array(v.number()),
  endTick: v.number(),
});

export const builtDungeonValidator = v.object({
  level: levelValidator,
  proof: replayValidator,
});
export const raidAttemptValidator = v.object({
  outcome: v.union(v.literal("won"), v.literal("dead"), v.literal("tick-limit")),
  replay: replayValidator,
});

export const attemptRecordingValidator = replayValidator.omit("level");

export const attemptOutcomeValidator = v.union(
  raidAttemptValidator.fields.outcome,
  v.literal("restart"),
);

export const buildStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("failed"),
);

export const attemptActorValidator = v.union(v.literal("player"), v.literal("drilly"));

export const roundStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("abandoned"),
);

export const raidStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);

export const roundResultValidator = v.object({
  attack: v.number(),
  defense: v.number(),
  total: v.number(),
  outcome: v.union(v.literal("win"), v.literal("draw"), v.literal("loss")),
});
