import { describe, expect, it } from "vitest";
import checkpoint from "../levels/checkpoint.json";
import { parseLevel, parseJumpTicks, parseReplay } from "../validation";
import { replayAttempt, runAttempt } from "./replay";
import { RULES } from "./rules";
const level = parseLevel(checkpoint);
describe("input boundary", () => {
  it.each(
    [[-1], [1.5], [2, 1], [1, 1], [NaN], ["1"], [Infinity], [1800]].map(
      (ticks) => ({ ticks }),
    ),
  )("rejects malformed jump ticks: $ticks", ({ ticks }) =>
    expect(() => parseJumpTicks(ticks)).toThrow(),
  );
  it("rejects incompatible replay versions and out-of-range inputs", () => {
    const replay = {
      version: 2,
      rulesVersion: RULES.version,
      level,
      jumpTicks: [44],
      endTick: 100,
    };
    expect(() => parseReplay({ ...replay, rulesVersion: "future" })).toThrow();
    expect(() => parseReplay({ ...replay, version: 1 })).toThrow();
    expect(() => parseReplay({ ...replay, endTick: 30 })).toThrow();
    expect(() => parseReplay({ ...replay, endTick: 100.5 })).toThrow();
  });
  it("round-trips a JSON replay without changing the trajectory", () => {
    const replay = parseReplay(
      JSON.parse(
        JSON.stringify({
          version: 2,
          rulesVersion: RULES.version,
          level,
          jumpTicks: [44, 199, 200],
          endTick: 259,
        }),
      ),
    );
    expect(replayAttempt(replay)).toEqual(
      runAttempt(level, [44, 199, 200], 259),
    );
  });
  it("bounds unfinished attempts and accepts a zero-tick recording", () => {
    expect(runAttempt(level, [], 10)).toMatchObject({
      stopReason: "tick-limit",
      state: { tick: 10, status: "running" },
    });
    expect(runAttempt(level, [], 0).trajectory).toHaveLength(1);
    expect(() => runAttempt(level, [], Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
