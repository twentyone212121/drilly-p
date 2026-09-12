import { v } from "convex/values";

const rectangle = {
  id: v.string(),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
};

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
  treasures: v.array(v.object(rectangle)),
});

export const draftFields = {
  ownerId: v.id("users"),
  level: levelValidator,
  rulesVersion: v.string(),
  revision: v.number(),
  updatedAt: v.number(),
  lastSaveId: v.string(),
};
