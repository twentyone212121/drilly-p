import { getExampleRoom } from "../../../shared/testing/rooms";
import { it, expect, vi } from "vitest";
import { newPlayerDungeon } from "../../../shared/game/rooms";
import { replayAttempt } from "../../../shared/game/replay";
import { RULES } from "../../../shared/game/rules";
import { playAttempt } from "./attempt";
import { observeRoom } from "./observation";
import { directStrategy } from "../../../shared/testing/planner";
import { drillyCases } from "../../../scripts/evals/drilly-cases";
import {
  OBSTACLE_CASES,
  obstacleRoom,
} from "../../../shared/testing/obstacles";

it.each(Object.entries(drillyCases))(
  "clears %s with shared physics and a reproducible recording",
  async (_name, level) => {
    const plan = vi.fn(async () => directStrategy(level));
    const result = await playAttempt(level, plan, []);
    expect(result.attempt.outcome).toBe("won");
    const replay = replayAttempt(result.attempt.replay);
    expect(replay.stopReason).toBe("won");
    expect(replay.state.player).toEqual(result.feedback.position);
    expect(replay.events.some((event) => event.type === "jump-ignored")).toBe(
      false,
    );
    expect(plan.mock.calls.length).toBeLessThanOrEqual(
      RULES.drilly.maxDecisionsPerAttempt,
    );
  },
);

it.each(OBSTACLE_CASES)(
  "handles actual moving hazards in the %s fixture",
  async (id) => {
    const level = obstacleRoom(id);
    const result = await playAttempt(
      level,
      async () => directStrategy(level),
      [],
    );
    expect(replayAttempt(result.attempt.replay).stopReason).toBe(
      result.attempt.outcome,
    );
  },
);

it("uses a real wall jump to reverse and never adds steering", async () => {
  const level = drillyCases.wall;
  const result = await playAttempt(
    level,
    async () => directStrategy(level),
    [],
  );
  const replay = replayAttempt(result.attempt.replay);
  expect(replay.events).toContainEqual(
    expect.objectContaining({ type: "jumped", kind: "wall" }),
  );
  expect(replay.state.player.direction).toBe(-1);
});

it("keeps executing the last strategy within the normal tick limit after the model budget is spent", async () => {
  const level = newPlayerDungeon();
  level.treasures[0].y = 10;
  const plan = vi.fn(async () => directStrategy(level));
  const result = await playAttempt(level, plan, []);
  expect(result.attempt.outcome).toBe("tick-limit");
  expect(result.attempt.replay.endTick).toBe(RULES.maxTicks);
  expect(plan).toHaveBeenCalledTimes(RULES.drilly.maxDecisionsPerAttempt);
});

it("resolves an unavoidable fall into a hazard without spending model calls", async () => {
  const level = newPlayerDungeon();
  level.platforms = [];
  level.traps = [{ id: "fall-hazard", x: 115, y: 443, radius: 8 }];
  const plan = vi.fn(async () => directStrategy(level));
  const result = await playAttempt(level, plan, []);
  expect(plan).not.toHaveBeenCalled();
  expect(result.attempt.outcome).toBe("dead");
  expect(result.attempt.replay.jumpTicks).toEqual([]);
});

it("passes actual hazard motion and previous failures to the route planner", async () => {
  const level = getExampleRoom();
  const plan = vi.fn(async () => directStrategy(level));
  const result = await playAttempt(level, plan, []);
  await playAttempt(level, plan, [result.feedback]);
  expect(plan.mock.calls[1]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ previousAttempts: [result.feedback] }),
    ]),
  );
  expect(
    observeRoom(level, replayAttempt(result.attempt.replay).state)
      .treasuresRemaining,
  ).toEqual([]);
});
