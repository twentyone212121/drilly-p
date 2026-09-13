import { RULES } from "./rules";
import type { Replay } from "./types";

export type RaidAttempt = {
  replay: Replay;
  outcome: "won" | "dead" | "tick-limit" | "restart";
};

export function attackMedals(attempts: RaidAttempt[]) {
  const firstClear = attempts.findIndex((attempt) => attempt.outcome === "won");
  return firstClear < 0 ? 0 : Math.max(0, RULES.raidAttempts - firstClear);
}

export function scoreRound(human: RaidAttempt[], drilly: RaidAttempt[]) {
  const attack = attackMedals(human);
  const defense = RULES.raidAttempts - attackMedals(drilly);
  const total = attack + defense;
  return {
    attack,
    defense,
    total,
    outcome: total >= 4 ? "win" : total === 3 ? "draw" : "loss",
  };
}
