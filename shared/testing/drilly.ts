import { runAttempt } from "../game/replay";
import { RULES } from "../game/rules";
import type { RaidAttempt } from "../game/round";
import type { Level } from "../game/types";

// Deliberately simple development inputs, independent of the player's clear proof.
export function runDrillyFixture(level: Level): RaidAttempt[] {
  const attempts: RaidAttempt[] = [];
  for (const jumpTicks of [[], [34, 106], [44, 193, 228]].slice(
    0,
    RULES.raidAttempts,
  )) {
    const result = runAttempt(level, jumpTicks);
    attempts.push({
      outcome: result.stopReason,
      replay: {
        version: 2,
        rulesVersion: RULES.version,
        level: structuredClone(level),
        jumpTicks: jumpTicks.filter((tick) => tick < result.state.tick),
        endTick: result.state.tick,
      },
    });
    if (result.stopReason === "won") break;
  }
  return attempts;
}
