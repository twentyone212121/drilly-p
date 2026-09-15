import type { Level } from "./types";
import type { RaidAttempt } from "./round";
import type { RULES } from "./rules";

export type DrillyModel = (typeof RULES.drilly.models)[number]["id"];

// Neither builder nor attacker receives the player's own-dungeon clear proof.
export type DrillySource = {
  build(signal?: AbortSignal): Promise<Level>;
  raid(level: Level, previousAttempts: RaidAttempt[], model: DrillyModel): Promise<RaidAttempt>;
};
