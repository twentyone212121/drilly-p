import { expect, it } from "vitest";
import { attackMedals, scoreRound, type RaidAttempt } from "./round";
import { RULES } from "./rules";
import { newPlayerDungeon } from "./rooms";

function attempts(clear: number | null): RaidAttempt[] {
  return Array.from({ length: clear ?? RULES.raidAttempts }, (_, index) => ({
    outcome: index + 1 === clear ? "won" : "dead",
    replay: {
      version: 2,
      rulesVersion: RULES.version,
      level: newPlayerDungeon(),
      jumpTicks: [],
      endTick: 0,
    },
  }));
}

it.each([
  [1, 3],
  [2, 2],
  [3, 1],
  [null, 0],
])("awards medals for clear %s", (clear, medals) => {
  expect(attackMedals(attempts(clear))).toBe(medals);
});
it.each([
  [1, null, "win"],
  [1, 1, "draw"],
  [null, 1, "loss"],
] as const)(
  "scores attack and defence for %s / %s",
  (human, drilly, outcome) => {
    const result = scoreRound(attempts(human), attempts(drilly));
    expect(result.total).toBe(result.attack + result.defense);
    expect(result.defense).toBe(
      RULES.raidAttempts - attackMedals(attempts(drilly)),
    );
    expect(result.outcome).toBe(outcome);
  },
);
