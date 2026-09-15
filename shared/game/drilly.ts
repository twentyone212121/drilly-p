import type { Level, Replay } from "./types";
import type { RaidAttempt } from "./round";
import type { RULES } from "./rules";

export type DrillyModel = (typeof RULES.drilly.models)[number]["id"];

export type BuildBudget = {
  hazards: number;
  treasures: number;
  platforms: number;
};

export type BuiltDungeon = { level: Level; proof: Replay };

// Neither builder nor attacker receives the player's own-dungeon clear proof.
export type DrillySource = {
  build(signal?: AbortSignal): Promise<Level>;
  raid(level: Level, previousAttempts: RaidAttempt[], model: DrillyModel): Promise<RaidAttempt>;
};
