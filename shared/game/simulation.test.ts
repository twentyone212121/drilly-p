import { describe, expect, it } from "vitest";
import checkpoint from "../levels/checkpoint.json";
import { moveBody, overlaps, touchesCircle } from "./collision";
import { parseLevel } from "../validation";
import { RULES } from "./rules";
import { runAttempt } from "./replay";
import { initialState, step } from "./simulation";

const level = parseLevel(checkpoint);
describe("checkpoint mechanics", () => {
  it("auto-runs without mutating its input state or level", () => {
    const state = initialState(level);
    const before = structuredClone(state);
    const beforeLevel = structuredClone(level);
    const result = step(level, state, { jump: false });
    expect(result.state.player.x).toBe(state.player.x + RULES.runSpeed / RULES.tickRate);
    expect(result.state.player.grounded).toBe(true);
    expect(state).toEqual(before);
    expect(level).toEqual(beforeLevel);
  });
  it("dies at the saw without input, and terminal states do not advance", () => {
    const result = runAttempt(level, []);
    expect(result.state.status).toBe("dead");
    expect(result.state.tick).toBe(51);
    expect(result.events[result.events.length - 1]).toEqual({
      type: "died",
      tick: 51,
      trapId: "saw-1",
    });
    expect(step(level, result.state, { jump: true })).toEqual({
      state: result.state,
      events: [],
    });
  });
  it("jumps upward and rejects an airborne jump without resetting velocity", () => {
    const first = step(level, initialState(level), { jump: true });
    expect(first.state.player.vy).toBeLessThan(0);
    expect(first.state.player.grounded).toBe(false);
    const second = step(level, first.state, { jump: true });
    expect(second.events).toContainEqual({
      type: "jump-ignored",
      tick: 1,
      reason: "airborne",
    });
    expect(second.state.player.vy).toBeGreaterThan(first.state.player.vy);
  });
  it("jumps up at a grounded corner, then reverses on an airborne wall jump", () => {
    const result = runAttempt(level, [44, 199, 200]);
    expect(result.state.status).toBe("won");
    expect(result.state.tick).toBe(259);
    expect(result.trajectory[199].player).toMatchObject({ grounded: true, wall: 1 });
    expect(result.trajectory[200].player).toMatchObject({ grounded: false, direction: 1, wall: 1 });
    expect(result.trajectory[200].player.y).toBeLessThan(result.trajectory[199].player.y);
    expect(result.events).toContainEqual({ type: "jumped", tick: 199, kind: "ground" });
    expect(result.trajectory[201].player.direction).toBe(-1);
    expect(result.events).toContainEqual({
      type: "jumped",
      tick: 200,
      kind: "wall",
    });
    expect(result.events).toContainEqual({
      type: "landed",
      tick: 233,
      platformId: "vault-ledge",
    });
  });
  it("keeps all four room boundaries even when the authored platforms are empty", () => {
    const empty = {
      ...level,
      platforms: [],
      traps: [],
      treasures: [{ id: "high", x: 400, y: 100, width: 24, height: 24 }],
    };
    const falling = runAttempt(empty, []);
    expect(falling.stopReason).toBe("tick-limit");
    expect(falling.state.player.y + RULES.playerHeight).toBe(empty.height - RULES.roomBorderWidth);
    expect(falling.state.player.wall).toBe(1);
    expect(falling.state.player.x + RULES.playerWidth).toBe(empty.width - RULES.roomBorderWidth);
    const rising = initialState(empty);
    rising.player = {
      ...rising.player,
      x: 200,
      y: RULES.roomBorderWidth + 1,
      vy: -RULES.jumpSpeed,
      grounded: false,
    };
    expect(step(empty, rising, { jump: false }).state.player).toMatchObject({
      y: RULES.roomBorderWidth,
      vy: 0,
    });
    const left = initialState(empty);
    left.player = { ...left.player, x: RULES.roomBorderWidth, direction: -1 };
    expect(step(empty, left, { jump: false }).state.player).toMatchObject({
      x: RULES.roomBorderWidth,
      wall: -1,
    });
  });
  it("caps downward velocity while sliding against a wall", () => {
    const state = initialState(level);
    state.player = {
      ...state.player,
      x: level.width - RULES.roomBorderWidth - RULES.playerWidth,
      y: 80,
      grounded: false,
      wall: 1,
      vy: 500,
    };
    expect(step(level, state, { jump: false }).state.player.vy).toBe(RULES.wallSlideSpeed);
  });
  it("gives lethal collision priority over treasure on the same tick", () => {
    const both = structuredClone(level);
    both.treasures = [{ id: "tie", x: 276, y: 392, width: 24, height: 28 }];
    const state = initialState(both);
    state.player.x = 272;
    const result = step(both, state, { jump: false });
    expect(result.state.status).toBe("dead");
    expect(result.events.some((e) => e.type === "won")).toBe(false);
    expect(result.state.collectedTreasureIds).toEqual([]);
    expect(result.events.some((e) => e.type === "treasure-collected")).toBe(false);
  });
});

describe("multiple treasures", () => {
  const dungeon = parseLevel({
    ...level,
    traps: [],
    treasures: [
      { id: "first", x: 120, y: 392, width: 16, height: 28 },
      { id: "last", x: 240, y: 392, width: 16, height: 28 },
    ],
  });

  it("collects each treasure once and only wins after collecting all of them", () => {
    const before = structuredClone(dungeon);
    const first = runAttempt(dungeon, [], 20);
    expect(first.state).toMatchObject({
      status: "running",
      collectedTreasureIds: ["first"],
    });
    expect(first.events.filter((event) => event.type === "treasure-collected")).toEqual([
      { type: "treasure-collected", tick: 7, treasureId: "first" },
    ]);
    expect(first.trajectory[6].collectedTreasureIds).toEqual([]);

    const complete = runAttempt(dungeon, []);
    expect(complete.state).toMatchObject({
      status: "won",
      tick: 37,
      collectedTreasureIds: ["first", "last"],
    });
    expect(complete.events.slice(-2)).toEqual([
      { type: "treasure-collected", tick: 37, treasureId: "last" },
      { type: "won", tick: 37 },
    ]);
    expect(dungeon).toEqual(before);
    expect(initialState(dungeon).collectedTreasureIds).toEqual([]);
  });

  it("collects overlapping treasures in level order on the same tick", () => {
    const together = {
      ...dungeon,
      treasures: dungeon.treasures.map((treasure) => ({ ...treasure, x: 120 })),
    };
    const result = runAttempt(together, []);
    expect(result.state).toMatchObject({
      status: "won",
      tick: 7,
      collectedTreasureIds: ["first", "last"],
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "treasure-collected",
      "treasure-collected",
      "won",
    ]);
  });

  it("does not automatically win an incomplete editor draft", () => {
    expect(
      step({ ...dungeon, treasures: [] }, initialState(dungeon), {
        jump: false,
      }).state.status,
    ).toBe("running");
  });
});
describe("collision boundaries", () => {
  it("catches thin floors and ceilings even when a step crosses them", () => {
    const p = [{ id: "thin", x: 0, y: 40, width: 100, height: 1 }];
    expect(moveBody({ x: 5, y: 0, width: 10, height: 10 }, 0, 100, p)).toMatchObject({
      y: 30,
      floor: "thin",
    });
    expect(moveBody({ x: 5, y: 80, width: 10, height: 10 }, 0, -100, p)).toMatchObject({
      y: 41,
      ceiling: true,
    });
  });
  it("resolves to the nearest wall regardless of platform order", () => {
    const platforms = [
      { id: "near", x: 30, y: 0, width: 1, height: 100 },
      { id: "far", x: 70, y: 0, width: 1, height: 100 },
    ];
    const body = { x: 0, y: 5, width: 10, height: 10 };
    expect(moveBody(body, 100, 0, platforms).x).toBe(20);
    expect(moveBody(body, 100, 0, [...platforms].reverse()).x).toBe(20);
  });
  it("treats platform edges as non-overlap and saw tangency as lethal", () => {
    const body = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlaps(body, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(touchesCircle(body, { x: 15, y: 5, radius: 5 })).toBe(true);
    expect(touchesCircle(body, { x: 16, y: 5, radius: 5 })).toBe(false);
  });
});
