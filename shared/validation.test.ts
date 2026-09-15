import { describe, expect, it } from "vitest";
import checkpoint from "./levels/checkpoint.json";
import { RULES } from "./game/rules";
import {
  parseDrillyAttempts,
  parseEditorLevel,
  parseJumpTicks,
  parseLevel,
  parseReplay,
} from "./validation";

const level = parseLevel(checkpoint);

const replay = {
  version: 2,
  rulesVersion: RULES.version,
  level,
  jumpTicks: [],
  endTick: 0,
};

describe("schema validation boundaries", () => {
  it("bounds AI and restored recordings separately from live human attempts", () => {
    const longReplay = { ...replay, endTick: RULES.maxTicks + 1 };
    expect(parseReplay(longReplay)).toEqual(longReplay);
    expect(() =>
      parseDrillyAttempts([{ replay: longReplay, outcome: "won" }], level),
    ).toThrow("execution budget");
    const restoreLimit = RULES.maxRestoredClearTicks;
    expect(
      parseReplay({ ...replay, endTick: restoreLimit }, restoreLimit).endTick,
    ).toBe(restoreLimit);
    expect(() =>
      parseReplay({ ...replay, endTick: restoreLimit + 1 }, restoreLimit),
    ).toThrow("tick limit");
  });

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
      value: { ...level, treasures: [{ ...level.treasures[0], x: -1 }] },
    },
    {
      name: "platform outside room",
      value: {
        ...level,
        platforms: [
          { id: "outside", x: level.width, y: 0, width: 8, height: 8 },
        ],
      },
    },
    {
      name: "treasure outside room",
      value: {
        ...level,
        treasures: [{ ...level.treasures[0], x: level.width }],
      },
    },
    {
      name: "spawn outside room",
      value: { ...level, spawn: { ...level.spawn, x: level.width } },
    },
    {
      name: "trap center outside room",
      value: { ...level, traps: [{ ...level.traps[0], y: level.height + 1 }] },
    },
    {
      name: "saw radius outside room",
      value: { ...level, traps: [{ ...level.traps[0], x: 10 }] },
    },
    {
      name: "saw touching spawn",
      value: {
        ...level,
        traps: [{ id: "blocked", x: 120, y: 406, radius: 24 }],
      },
    },
    {
      name: "treasure overlapping spawn",
      value: {
        ...level,
        treasures: [
          { ...level.treasures[0], x: level.spawn.x, y: level.spawn.y },
        ],
      },
    },
    {
      name: "treasure id shared with platform",
      value: { ...level, treasures: [{ ...level.treasures[0], id: "floor" }] },
    },
    {
      name: "duplicate treasure ids",
      value: { ...level, treasures: [level.treasures[0], level.treasures[0]] },
    },
    { name: "old level version", value: { ...level, version: 1 } },
    {
      name: "spawn inside platform",
      value: { ...level, spawn: { x: 24, y: 430, direction: 1 } },
    },
    {
      name: "too many objects",
      value: {
        ...level,
        platforms: Array.from({ length: 65 }, (_, id) => ({
          ...level.platforms[0],
          id: `platform-${id}`,
        })),
      },
    },
  ])("rejects $name", ({ value }) => {
    expect(() => parseLevel(value)).toThrow();
  });

  it("allows incomplete drafts but requires a treasure for attempts and replays", () => {
    const empty = { ...level, treasures: [] };
    expect(parseEditorLevel(empty, level).treasures).toEqual([]);
    expect(() => parseLevel(empty)).toThrow();
    expect(() => parseReplay({ ...replay, level: empty })).toThrow();
  });

  it.each([
    { width: level.width + 8 },
    { height: level.height + 8 },
    { spawn: { ...level.spawn, x: level.spawn.x + 8 } },
    { spawn: { ...level.spawn, direction: -1 } },
  ])("keeps the draft room and spawn fixed: %j", (change) => {
    expect(() => parseEditorLevel({ ...level, ...change }, level)).toThrow();
  });

  it("allows platform support at the spawn edge and saws exactly inside the room", () => {
    expect(parseLevel(level)).toEqual(level);
    expect(
      parseLevel({
        ...level,
        traps: [{ id: "edge", x: 24, y: 24, radius: 24 }],
      }).traps,
    ).toHaveLength(1);
  });

  it("accepts the last input tick before the limit, including an empty zero-tick replay", () => {
    expect(parseJumpTicks([0, 9], 10)).toEqual([0, 9]);
    expect(parseReplay(replay)).toEqual(replay);
    expect(() => parseJumpTicks([10], 10)).toThrow();
    expect(() => parseJumpTicks([0], 0)).toThrow();
    expect(() => parseReplay({ ...replay, jumpTicks: [0] })).toThrow();
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid tick limit %s even for empty input",
    (endTick) => {
      expect(() => parseJumpTicks([], endTick)).toThrow();
      expect(() => parseReplay({ ...replay, endTick })).toThrow();
    },
  );
});
