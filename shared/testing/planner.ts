import { getExampleRoom } from "./rooms";
import type { Level } from "../game/types";
import type { DrillyStrategy } from "../game/drilly";

export function directStrategy(level: Level): DrillyStrategy {
  return {
    objective: "Collect the treasure along a safe route",
    route: level.treasures.map((treasure) => ({
      kind: "treasure",
      id: treasure.id,
    })),
  };
}

export const testStrategy = directStrategy(getExampleRoom());
export function roomEdit(
  level: Level,
  base: "working" | "checkpoint" = "working",
) {
  return {
    action: "edit",
    base,
    name: level.name,
    idea: "A sequence of readable crossings",
    strategy: directStrategy(level),
    removeIds: ["floor", "goal"],
    edit: {
      platforms: level.platforms,
      traps: level.traps,
      treasures: level.treasures,
      obstacles: level.obstacles ?? [],
    },
  };
}

export const buildPlan = async (_instructions: string, data: unknown) => {
  const input = data as { observation?: unknown; checkpoint?: unknown };
  if (input.observation) return directStrategy((data as { room: Level }).room);
  return {
    ...roomEdit(getExampleRoom()),
    action: input.checkpoint ? "finish" : "edit",
  };
};
