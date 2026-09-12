import { describe, expect, it } from "vitest";
import { createAttempt } from "../../src/game/attempt";
import { parseReplay } from "../validation";
import { DUNGEONS, getDungeon, getPrison, newPlayerDungeon } from "./campaign";
import { replayAttempt, runAttempt } from "./replay";
import { RULES } from "./rules";

describe("prison and first dungeon", () => {
  it.each([
    { level: getPrison(), jumps: [44, 193, 228], endTick: 273 },
    { level: getDungeon("first-vault"), jumps: [34, 106], endTick: 167 },
  ])(
    "$level.id is solvable and replayable at different frame rates",
    ({ level, jumps, endTick }) => {
      const result = runAttempt(level, jumps);
      expect(result.state).toMatchObject({ status: "won", tick: endTick });
      expect(runAttempt(level, []).state.status).toBe("dead");
      const replay = parseReplay({
        version: 2,
        rulesVersion: RULES.version,
        level,
        jumpTicks: jumps,
        endTick,
      });
      expect(replayAttempt(replay)).toEqual(result);
      for (const delta of [1000 / 30, 1000 / 144]) {
        const attempt = createAttempt(level);
        attempt.loadReplay(replay);
        attempt.play();
        for (let frame = 0; frame < 2000 && !attempt.getSnapshot().finished; frame++)
          attempt.update(delta);
        expect(attempt.trajectory()).toEqual(result.trajectory);
        expect(attempt.getSnapshot().events).toEqual(result.events);
      }
    },
  );

  it("provides a safe editable template independently of the prison and opponent", () => {
    const draft = newPlayerDungeon();
    expect(runAttempt(draft, []).state.status).toBe("won");
    expect(draft.spawn).toEqual(getPrison().spawn);
    expect(draft.platforms).toEqual(getDungeon("first-vault").platforms);
    draft.platforms.length = 0;
    draft.treasures[0].x = 0;
    expect(newPlayerDungeon().platforms.length).toBeGreaterThan(0);
    expect(getPrison().treasures[0].x).toBe(448);
    expect(getDungeon("first-vault").treasures[0].x).toBe(760);
  });

  it("exposes two unavailable placeholders without playable layouts", () => {
    expect(DUNGEONS.filter((dungeon) => dungeon.available).map((dungeon) => dungeon.id)).toEqual([
      "first-vault",
    ]);
    expect(() => getDungeon("wall-vault")).toThrow("not available");
    expect(() => getDungeon("treasury")).toThrow("not available");
  });

  it.each([
    { name: "no jump", jumps: [], trapId: "prison-saw" },
    { name: "jumping too early", jumps: [10], trapId: "prison-saw" },
    { name: "walking into the upper saw", jumps: [44, 193], trapId: "ledge-saw" },
    { name: "jumping again before landing", jumps: [44, 193, 222], trapId: "ledge-saw" },
  ])("makes $name a retryable prison failure", ({ jumps, trapId }) => {
    const result = runAttempt(getPrison(), jumps);
    expect(result.state.status).toBe("dead");
    expect(result.events).toContainEqual({ type: "died", tick: result.state.tick, trapId });
  });

  it("requires the second treasure after the floor obstacle", () => {
    const result = runAttempt(getPrison(), [44]);
    expect(result.state.collectedTreasureIds).toEqual(["cell-key"]);
    expect(result.stopReason).toBe("tick-limit");
    expect(result.state.player.wall).toBe(1);
  });

  it.each([
    [34, 193, 224],
    [44, 200, 235],
    [48, 240, 285],
  ])("allows timing variation and waiting at the wall with inputs %j", (...jumps: number[]) => {
    const result = runAttempt(getPrison(), jumps);
    expect(result.state.status).toBe("won");
    expect(result.state.collectedTreasureIds).toEqual(["cell-key", "exit-key"]);
    expect(
      result.events.filter((event) => event.type === "jumped").map((event) => event.kind),
    ).toEqual(["ground", "wall", "ground"]);
  });
});
