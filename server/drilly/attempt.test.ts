import { it, expect, vi } from "vitest";
import { newPlayerDungeon, getDungeon } from "../../shared/game/campaign";
import { replayAttempt } from "../../shared/game/replay";
import { RULES } from "../../shared/game/rules";
import { playAttempt } from "./attempt";
import { observeRoom } from "./observation";
import { directStrategy } from "./testing";
import { drillyCases } from "../../scripts/evals/drilly-cases";
import { LAB_ROOMS, getObstacleLab } from "../../shared/game/obstacleLab";

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
    expect(await playAttempt(level, plan, [])).toEqual(result);
  },
);

it.each(LAB_ROOMS)(
  "handles actual moving hazards in the $id lab",
  async ({ id }) => {
    const level = getObstacleLab(id);
    const result = await playAttempt(
      level,
      async () => directStrategy(level),
      [],
    );
    expect(replayAttempt(result.attempt.replay).stopReason).toBe("won");
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

it("resolves an unavoidable spawn fall without spending model calls", async () => {
  const level = newPlayerDungeon();
  level.platforms = [];
  const plan = vi.fn(async () => directStrategy(level));
  const result = await playAttempt(level, plan, []);
  expect(plan).not.toHaveBeenCalled();
  expect(result.attempt.outcome).toBe("dead");
  expect(result.attempt.replay.jumpTicks).toEqual([]);
});

it("passes actual hazard motion and previous failures to the route planner", async () => {
  const level = getDungeon("first-vault");
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

// Independent known input schedules establish solvability. Drilly receives only
// each room and a treasure objective, never these reference jumps.
it.each(Array.from({ length: 128 }, (_, seed) => seed))(
  "clears a proven obstacle arrangement, seed %i",
  async (seed) => {
    const first = 24 + (seed % 16);
    const second = first + 66 + (seed % 9);
    const room = newPlayerDungeon();
    room.treasures[0].x = 800;
    const x = 72 + 4 * first;
    room.traps = [
      {
        id: "second",
        x: 72 + 4 * second + 80,
        y: 404,
        radius: 12 + (seed % 10),
      },
    ];
    room.obstacles =
      seed % 2 === 0
        ? [
            {
              id: "first",
              kind: "spikes",
              x: x + 48,
              y: 400,
              width: 32 + (seed % 5) * 8,
              height: 20,
            },
          ]
        : [
            {
              id: "first",
              kind: "slider",
              x: x + 80,
              y: 402,
              radius: 14,
              endX: x + 112,
              endY: 402,
              speed: 40 + (seed % 80),
            },
          ];
    const reference = {
      version: 2 as const,
      rulesVersion: RULES.version,
      level: room,
      jumpTicks: [first, second],
      endTick: RULES.maxTicks,
    };
    expect(replayAttempt(reference).stopReason).toBe("won");
    const result = await playAttempt(
      room,
      async () => directStrategy(room),
      [],
    );
    expect(result.attempt.outcome).toBe("won");
    const replay = replayAttempt(result.attempt.replay);
    expect(replay.stopReason).toBe("won");
    expect(replay.state.tick).toBe(result.attempt.replay.endTick);
  },
);
