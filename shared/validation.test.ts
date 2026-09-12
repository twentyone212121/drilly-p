import { describe, expect, it } from "vitest";
import { ValiError } from "valibot";
import checkpoint from "../public/levels/checkpoint.json";
import { RULES } from "./game/rules";
import { parseJumpTicks, parseLevel, parseReplay } from "./validation";

const level = parseLevel(checkpoint);

const replay = {
  version: 1,
  rulesVersion: RULES.version,
  level,
  jumpTicks: [],
  endTick: 0,
};

describe("schema validation boundaries", () => {
  it.each([
    { name: "missing spawn", value: { ...level, spawn: undefined } },
    {
      name: "string coordinate",
      value: { ...level, spawn: { ...level.spawn, x: "72" } },
    },
    {
      name: "nonfinite radius",
      value: { ...level, traps: [{ ...level.traps[0], radius: Infinity }] },
    },
    {
      name: "negative treasure coordinate",
      value: { ...level, treasure: { ...level.treasure, x: -1 } },
    },
    {
      name: "platform outside room",
      value: {
        ...level,
        platforms: [
          { id: "outside", x: level.width, y: 0, width: 1, height: 1 },
        ],
      },
    },
    {
      name: "treasure outside room",
      value: { ...level, treasure: { ...level.treasure, x: level.width } },
    },
    {
      name: "spawn outside room",
      value: { ...level, spawn: { ...level.spawn, x: level.width } },
    },
    {
      name: "trap center outside room",
      value: { ...level, traps: [{ ...level.traps[0], y: level.height + 1 }] },
    },
  ])("rejects $name through the validation library", ({ value }) => {
    expect(() => parseLevel(value)).toThrow(ValiError);
    expect(() => parseReplay({ ...replay, level: value })).toThrow(ValiError);
  });

  it("keeps parsing non-coercing and returns independent plain data", () => {
    const source = { ...structuredClone(level), extra: "discard me" };
    const parsed = parseLevel(source);

    expect(parsed).toEqual(level);
    parsed.spawn.x = 100;
    parsed.platforms[0].x = 100;
    expect(source.spawn.x).toBe(level.spawn.x);
    expect(source.platforms[0].x).toBe(level.platforms[0].x);
    expect(source.extra).toBe("discard me");
  });

  it("accepts the last input tick before the limit, including an empty zero-tick replay", () => {
    expect(parseJumpTicks([0, 9], 10)).toEqual([0, 9]);
    expect(parseReplay(replay)).toEqual(replay);
    expect(() => parseJumpTicks([10], 10)).toThrow(ValiError);
    expect(() => parseJumpTicks([0], 0)).toThrow(ValiError);
    expect(() => parseReplay({ ...replay, jumpTicks: [0] })).toThrow(ValiError);
  });

  it.each([-1, 0.5, NaN, Infinity, RULES.maxTicks + 1])(
    "rejects invalid tick limit %s even for empty input",
    (endTick) => {
      expect(() => parseJumpTicks([], endTick)).toThrow(ValiError);
      expect(() => parseReplay({ ...replay, endTick })).toThrow(ValiError);
    },
  );
});
