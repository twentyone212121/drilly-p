import { expect, it } from "vitest";
import { getDungeon } from "../../shared/game/campaign";
import { runDrillyFixture } from "./drillyFixture";
import { summarizeHumanRaid } from "./drillyLearning";
import { newPlayerDungeon } from "../../shared/game/campaign";
import { runAttempt } from "../../shared/game/replay";
import { RULES } from "../../shared/game/rules";
import { parseBuildContext } from "../../shared/validation";
it("summarizes observed deaths and timing mistakes without forwarding jump schedules", () => {
  const attempts = runDrillyFixture(getDungeon("first-vault"));
  const learning = summarizeHumanRaid(attempts);
  expect(learning.deaths[0].kind).toBe("saw");
  expect(learning.deaths[0].tick).toBeGreaterThan(0);
  expect(learning.cleared).toBe(true);
  expect(learning.attempts).toBe(2);
  expect(JSON.stringify(learning)).not.toContain("jumpTicks");
});

it("retains negative death coordinates without breaking the next build request", () => {
  const level = newPlayerDungeon();
  level.platforms = level.platforms.filter((p) => p.id !== "left-wall");
  level.treasures[0].y = 50;
  const result = runAttempt(level, [196]);
  expect(result.stopReason).toBe("dead");
  expect(result.state.player.x).toBeLessThan(0);
  const learning = summarizeHumanRaid([
    {
      outcome: "dead",
      replay: {
        version: 2,
        rulesVersion: RULES.version,
        level,
        jumpTicks: [196],
        endTick: result.state.tick,
      },
    },
  ]);
  expect(
    parseBuildContext({ recentRaids: [learning] }).recentRaids[0].deaths[0].x,
  ).toBeLessThan(0);
});
