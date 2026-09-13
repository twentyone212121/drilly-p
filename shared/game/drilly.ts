import type { Level, Replay } from "./types";
import type { RaidAttempt } from "./round";

export const HAZARD_KINDS = [
  "saw",
  "spikes",
  "slider",
  "drone",
  "pursuer",
  "turret-fixed",
  "turret-aimed",
  "turret-flame",
  "other",
] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];
export type RaidLearning = {
  level: Level;
  attempts: number;
  cleared: boolean;
  deaths: { kind: HazardKind; tick: number; x: number; y: number }[];
  ignoredJumps: number;
  wallJumps: number;
};
export type BuildContext = {
  recentRaids: RaidLearning[];
  recentRooms: Level[];
};
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
  build(context: BuildContext): Promise<BuiltDungeon>;
  raid(level: Level): Promise<RaidAttempt[]>;
};
