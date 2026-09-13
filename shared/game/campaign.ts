import prison from "../levels/prison.json";
import firstVault from "../levels/first-vault.json";
import { parseLevel } from "../validation";
import type { Level } from "./types";

export const DUNGEON_IDS = ["first-vault", "wall-vault", "treasury"] as const;
export type DungeonId = (typeof DUNGEON_IDS)[number];

// Only the first dungeon is authored for this slice. Later names and mechanics are unsettled.
export const DUNGEONS = [
  { id: "first-vault", name: "The double lock", available: true },
  { id: "wall-vault", name: "Dungeon 2", available: false },
  { id: "treasury", name: "Dungeon 3", available: false },
] as const;

export function getPrison(): Level {
  return parseLevel(prison);
}

export function getDungeon(id: DungeonId): Level {
  if (id !== "first-vault") throw new Error("This dungeon is not available yet.");
  return parseLevel(firstVault);
}

// Keep the editable starter room independent of the prison’s teaching geometry.
export function newPlayerDungeon(): Level {
  return parseLevel({
    ...firstVault,
    id: "player-dungeon",
    name: "Your vault",
    traps: [],
    treasures: [{ id: "treasure-1", x: 720, y: 392, width: 32, height: 28 }],
  });
}
