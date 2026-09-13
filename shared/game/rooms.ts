import prison from "../levels/prison.json";
import firstVault from "../levels/first-vault.json";
import { parseLevel } from "../validation";
import type { Level } from "./types";

export function getPrison(): Level {
  return parseLevel(prison);
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
