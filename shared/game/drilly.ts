import type { Level, Replay } from "./types";
import type { RaidAttempt } from "./round";

export type BuildBudget = {
  hazards: number;
  treasures: number;
  platforms: number;
};

export type DrillyRoute = {
  kind: "treasure" | "platform" | "wall";
  id: string;
}[];
export type DrillyStrategy = { objective: string; route: DrillyRoute };

export type BuiltDungeon = { level: Level; proof: Replay };

// Neither builder nor attacker receives the player's own-dungeon clear proof.
export type DrillySource = {
  build(): Promise<BuiltDungeon>;
  raid(level: Level): Promise<RaidAttempt[]>;
};
