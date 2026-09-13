import { newPlayerDungeon } from "../../../shared/game/rooms";
import { roomSideWalls } from "../../../shared/game/roomBoundary";
import { RULES } from "../../../shared/game/rules";
import type { Level } from "../../../shared/game/types";
import type { BuildBudget } from "../../../shared/game/drilly";
import { parseDrillyBuild, parseDrillyEdit } from "../../../shared/validation";

export function emptyWorkspace(): Level {
  const room = newPlayerDungeon();
  const inset = RULES.drilly.sideWallWidth;
  return {
    ...room,
    id: `drilly-${crypto.randomUUID()}`,
    name: "Work in progress",
    platforms: [
      {
        id: "floor",
        x: inset,
        y: room.spawn.y + RULES.playerHeight,
        width: room.width - inset * 2,
        height: 24,
      },
      ...roomSideWalls(room),
    ],
    traps: [],
    obstacles: [],
    treasures: [
      {
        id: "goal",
        x: room.width - inset - 112,
        y: room.spawn.y,
        width: 32,
        height: 28,
      },
    ],
  };
}

export function applyEdit(
  level: Level,
  command: ReturnType<typeof parseDrillyEdit>,
  budget: BuildBudget,
) {
  const remove = new Set(command.removeIds);
  function update<T extends { id: string }>(objects: T[], edits: T[]) {
    const replaced = new Set(edits.map((object) => object.id));
    return [
      ...objects.filter(
        (object) => !remove.has(object.id) && !replaced.has(object.id),
      ),
      ...edits,
    ];
  }
  // External fragments are checked as a complete layout after merging. Fixed
  // side walls are restored by shared validation before any simulation runs.
  return parseDrillyBuild(
    {
      level: {
        ...level,
        name: command.name,
        platforms: update(level.platforms, command.edit.platforms),
        traps: update(level.traps, command.edit.traps),
        treasures: update(level.treasures, command.edit.treasures),
        obstacles: update(level.obstacles ?? [], command.edit.obstacles),
      },
    },
    level,
    budget,
  );
}
