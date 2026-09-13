import { getDungeon } from "../../shared/game/campaign";
import type { Level } from "../../shared/game/types";
import type { DrillyStrategy } from "../../shared/game/drilly";

export function directStrategy(level: Level): DrillyStrategy {
  return {
    objective: "Collect the treasure along a safe route",
    route: level.treasures.map((treasure) => ({
      kind: "treasure",
      id: treasure.id,
    })),
  };
}

export const testStrategy = directStrategy(getDungeon("first-vault"));
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
    ...roomEdit(getDungeon("first-vault")),
    action: input.checkpoint ? "finish" : "edit",
  };
};
