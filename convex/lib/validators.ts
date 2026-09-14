import { v } from "convex/values";

export const drillyModelValidator = v.union(
  v.literal("gpt-6-astra"),
  v.literal("gpt-5.6-sol"),
  v.literal("gpt-5.6-luna"),
);

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
  outcome: v.union(
    v.literal("won"),
    v.literal("dead"),
    v.literal("tick-limit"),
  ),
  replay: replayValidator,
});
