import { getExampleRoom } from "./rooms";
import type { Level } from "../game/types";
import type { Planner } from "../../convex/lib/drilly/protocol";

export function roomEdit(level: Level, base: "working" | "checkpoint" = "working") {
  return {
    action: "edit",
    base,
    name: level.name,
    idea: "A sequence of readable crossings",
    removeIds: ["floor", "goal"],
    edit: {
      platforms: level.platforms,
      traps: level.traps,
      treasures: level.treasures,
      obstacles: level.obstacles ?? [],
    },
  };
}

// Fixture inputs only: ordinary tests exercise the real simulation without model calls.
export function withRaidInputs(design: Planner): Planner {
  return async (instructions, data, options) => {
    if (options?.schemaName === "drilly_inputs") {
      const { room } = data as { room: Level };
      return { jumpTicks: room.traps.length ? [34, 106] : [] };
    }
    return design(instructions, data, options);
  };
}

export const buildPlan = withRaidInputs(async (_instructions, data) => {
  const input = data as { checkpoint?: unknown };
  return {
    ...roomEdit(getExampleRoom()),
    action: input.checkpoint ? "finish" : "edit",
  };
});
