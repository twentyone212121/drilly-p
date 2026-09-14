import { describe, expect, it } from "vitest";
import { initialState, step } from "./simulation";
import {
  advanceObstacles,
  flameBounds,
  patrolPosition,
  turretPhase,
} from "./obstacles";
import { sweptCircle } from "./sweep";
import { obstacleRoom, OBSTACLE_CASES } from "../testing/obstacles";
import { RULES } from "./rules";
import { replayAttempt } from "./replay";
import { parseLevel } from "../validation";
import { createAttempt } from "../../src/game/attempt";
import type { Obstacle, Patrol, Turret, Pursuer } from "./obstacleTypes";
import type { Level, Rect } from "./types";

const body = (x: number, y = 300): Rect => ({ x, y, width: 24, height: 28 });
const patrol: Patrol = {
  id: "rail",
  kind: "slider",
  x: 300,
  y: 200,
  endX: 400,
  endY: 200,
  radius: 18,
  speed: 100,
};
const turret: Turret = {
  id: "gun",
  kind: "turret",
  x: 500,
  y: 314,
  radius: 18,
  mode: "fixed",
  direction: -1,
  intervalTicks: 120,
  warmupTicks: 30,
  activeTicks: 30,
  range: 400,
  projectileSpeed: 480,
};
const pursuer: Pursuer = {
  id: "chaser",
  kind: "pursuer",
  x: 300,
  y: 200,
  radius: 18,
  speed: 120,
  detectionRange: 100,
  chaseRange: 200,
  warningTicks: 12,
};
function room(obstacles: Obstacle[] = []): Level {
  return { ...obstacleRoom("showcase"), obstacles, treasures: [] };
}
function advance(level: Level, x: number, ticks: number) {
  let state = initialState(level);
  state.player = { ...state.player, ...body(x) };
  for (let tick = 1; tick <= ticks; tick++) {
    const next = advanceObstacles(level, state, body(x), tick);
    state = {
      ...state,
      tick,
      obstacles: next.obstacles,
      projectiles: next.projectiles,
    };
  }
  return state;
}

describe("obstacle simulation", () => {
  it("patrols both directions and returns exactly to its initial position", () => {
    expect(patrolPosition(patrol, 30)).toEqual({ x: 350, y: 200 });
    expect(patrolPosition(patrol, 60)).toEqual({ x: 400, y: 200 });
    expect(patrolPosition(patrol, 90)).toEqual({ x: 350, y: 200 });
    expect(patrolPosition(patrol, 120)).toEqual({ x: 300, y: 200 });
    expect(patrolPosition({ ...patrol, endX: 300, endY: 300 }, 30)).toEqual({
      x: 300,
      y: 250,
    });
  });
  it("sweeps a fast moving hazard across the player", () => {
    const o = { ...patrol, x: 280, y: 314, endY: 314, speed: 480, radius: 4 };
    const level = room([o]);
    const state = initialState(level);
    state.player = { ...state.player, ...body(290) };
    expect(advanceObstacles(level, state, body(290), 1).hitId).toBe("rail");
  });
  it("detects an endpoint reached between ticks even when the saw turns back", () => {
    const o = {
      ...patrol,
      x: 280,
      endX: 288,
      y: 314,
      endY: 314,
      speed: 300,
      radius: 4,
    };
    const level = room([o]);
    const state = { ...initialState(level), tick: 1 };
    state.obstacles[0].x = 285;
    state.player = { ...state.player, ...body(292) };
    expect(advanceObstacles(level, state, body(292), 2).hitId).toBe("rail");
  });
  it("spikes kill before a treasure on the same tick", () => {
    const level = room([
      { id: "pins", kind: "spikes", x: 91, y: 412, width: 48, height: 28 },
    ]);
    level.treasures = [{ id: "gold", x: 91, y: 412, width: 32, height: 28 }];
    const result = step(level, initialState(level), { jump: false });
    expect(result.state.status).toBe("dead");
    expect(result.state.collectedTreasureIds).toEqual([]);
  });
  it("uses exact swept circle corners and catches thin walls", () => {
    expect(
      sweptCircle({ x: -2, y: -2 }, { x: -2, y: -2 }, 2, {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      }),
    ).toBeNull();
    expect(
      sweptCircle({ x: 0, y: 5 }, { x: 100, y: 5 }, 2, {
        x: 50,
        y: 0,
        width: 1,
        height: 10,
      }),
    ).toBeCloseTo(0.48);
  });
  it("telegraphs, fires exactly once per cycle, then cools down", () => {
    expect(turretPhase(turret, 29)).toBe("warning");
    expect(turretPhase(turret, 30)).toBe("active");
    expect(turretPhase(turret, 31)).toBe("idle");
    expect(advance(room([turret]), 200, 29).projectiles).toHaveLength(0);
    expect(advance(room([turret]), 200, 30).projectiles).toHaveLength(1);
    expect(advance(room([turret]), 200, 31).projectiles).toHaveLength(1);
  });
  it("allows turret body contact while warning or idle, but its shot still kills", () => {
    const level = room([turret]);
    const state = initialState(level);
    const touching = body(turret.x - RULES.playerWidth / 2);
    state.player = { ...state.player, ...touching };
    expect(advanceObstacles(level, state, touching, 1).hitId).toBeNull();
    expect(advanceObstacles(level, state, touching, 31).hitId).toBeNull();
    expect(advanceObstacles(level, state, touching, 30).hitId).toBe("gun");
  });
  it("aimed shots lock their direction and respect detection range", () => {
    const level = room([{ ...turret, mode: "aimed" }]);
    const state = advance(level, 200, 30);
    const shot = state.projectiles[0];
    expect(shot.vx).toBeLessThan(0);
    const next = advanceObstacles(level, state, body(650, 100), 31);
    expect(next.projectiles[0].vx).toBe(shot.vx);
    expect(next.projectiles[0].vy).toBe(shot.vy);
    expect(
      advance(room([{ ...turret, mode: "aimed", range: 32 }]), 200, 30)
        .projectiles,
    ).toHaveLength(0);
  });
  it("projectiles hit players between positions, but walls win nearer contacts", () => {
    const level = room();
    const state = initialState(level);
    state.player = { ...state.player, ...body(302) };
    state.projectiles = [
      {
        id: "p",
        ownerId: "gun",
        x: 330,
        y: 314,
        vx: -480,
        vy: 0,
      },
    ];
    expect(advanceObstacles(level, state, body(302), 1).hitId).toBe("gun");
    level.platforms.push({
      id: "shield",
      x: 327,
      y: 280,
      width: 8,
      height: 60,
    });
    const blocked = advanceObstacles(level, state, body(302), 1);
    expect(blocked.hitId).toBeNull();
    expect(blocked.projectiles).toHaveLength(0);
  });
  it("keeps shots beyond the turret range until a wall or room boundary", () => {
    const level = room([{ ...turret, range: 32 }]);
    let state = advance(level, 64, 30);
    const firstId = state.projectiles[0].id;
    for (let tick = 31; tick < 50; tick++) {
      const next = advanceObstacles(level, state, body(64), tick);
      state = { ...state, tick, ...next };
    }
    expect(state.projectiles.some((shot) => shot.id === firstId)).toBe(true);
    const shot = state.projectiles.find((p) => p.id === firstId)!;
    level.platforms.push({ id: "stop", x: shot.x - 12, y: 280, width: 4, height: 60 });
    expect(advanceObstacles(level, state, body(64), 50).projectiles).toHaveLength(0);
    state.projectiles = [{ id: "exit", ownerId: "gun", x: level.width - 1, y: 100, vx: 240, vy: 0 }];
    expect(advanceObstacles(room(), state, body(64), 51).projectiles).toHaveLength(0);
  });
  it("emits one firing event every 1.5 seconds with the editor defaults", () => {
    const level = room([{ ...turret, intervalTicks: RULES.obstacles.intervalTicks }]);
    let state = initialState(level);
    const fired: number[] = [];
    for (let tick = 1; tick <= 330; tick++) {
      const next = advanceObstacles(level, state, body(64), tick);
      fired.push(...next.events.map((event) => event.tick));
      state = { ...state, tick, ...next };
    }
    expect(fired).toEqual([30, 120, 210, 300]);
  });
  it("flames only hurt in their active window and stop at platforms", () => {
    const o = { ...turret, mode: "flame" as const };
    const level = room([o]);
    const state = initialState(level);
    state.player = { ...state.player, ...body(300) };
    expect(advanceObstacles(level, state, body(300), 29).hitId).toBeNull();
    expect(advanceObstacles(level, state, body(300), 30).hitId).toBe("gun");
    expect(advanceObstacles(level, state, body(300), 60).hitId).toBeNull();
    level.platforms.push({
      id: "shield",
      x: 400,
      y: 280,
      width: 8,
      height: 60,
    });
    expect(flameBounds(o, level).x).toBe(408);
    expect(advanceObstacles(level, state, body(300), 30).hitId).toBeNull();
  });
  it("pursuers warn, chase, return, and cannot reacquire until home", () => {
    const level = room([pursuer]);
    let state = initialState(level);
    state.player = { ...state.player, ...body(350, 190) };
    const target = body(350, 190);
    for (let tick = 1; tick <= 12; tick++) {
      const next = advanceObstacles(level, state, target, tick);
      state = { ...state, tick, obstacles: next.obstacles };
      expect(next.obstacles[0].phase).toBe("warning");
      expect(next.obstacles[0].x).toBe(300);
    }
    const chasing = advanceObstacles(level, state, target, 13);
    expect(chasing.obstacles[0].phase).toBe("active");
    expect(chasing.obstacles[0].x).toBeGreaterThan(300);
    state = { ...state, tick: 13, obstacles: chasing.obstacles };
    // Put it farther away to inspect several return ticks.
    state.obstacles[0].x = 380;
    const returning = advanceObstacles(level, state, body(800), 14);
    expect(returning.obstacles[0].phase).toBe("returning");
    state = { ...state, tick: 14, obstacles: returning.obstacles };
    expect(advanceObstacles(level, state, target, 15).obstacles[0].phase).toBe(
      "returning",
    );
  });
  it("resets every hazard and projectile without mutating previous frames", () => {
    const level = room([turret, patrol, pursuer]);
    const before = initialState(level);
    const snapshot = structuredClone(before);
    step(level, before, { jump: true });
    expect(before).toEqual(snapshot);
    expect(initialState(level)).toEqual(snapshot);
    const dead = { ...before, status: "dead" as const };
    expect(step(level, dead, { jump: true })).toEqual({
      state: dead,
      events: [],
    });
  });
});

describe("obstacle validation and replays", () => {
  it.each([
    { ...patrol, endX: 300 },
    { ...patrol, endX: 9999 },
    { ...patrol, speed: Infinity },
    { ...turret, warmupTicks: 0 },
    { ...turret, intervalTicks: 30 },
    { ...turret, mode: "flame", activeTicks: 100 },
    { ...pursuer, chaseRange: 32 },
  ])("rejects malformed obstacle %j", (obstacle) => {
    expect(() =>
      parseLevel({ ...obstacleRoom("spikes"), obstacles: [obstacle] }),
    ).toThrow();
  });
  it("rejects excessive counts, duplicate ids, and routes through the spawn", () => {
    const level = obstacleRoom("spikes");
    expect(() =>
      parseLevel({
        ...level,
        obstacles: Array.from({ length: 9 }, (_, i) => ({
          ...patrol,
          id: `p${i}`,
        })),
      }),
    ).toThrow();
    expect(() =>
      parseLevel({ ...level, obstacles: [patrol, patrol] }),
    ).toThrow();
    expect(() =>
      parseLevel({
        ...level,
        obstacles: [{ ...patrol, x: 40, y: 420, endX: 120, endY: 420 }],
      }),
    ).toThrow();
  });
  it("rejects spikes touching the starting body even without overlap", () => {
    const level = obstacleRoom("spikes");
    level.obstacles = [
      {
        id: "touching",
        kind: "spikes",
        x: level.spawn.x + RULES.playerWidth,
        y: level.spawn.y,
        width: 32,
        height: 20,
      },
    ];
    expect(() => parseLevel(level)).toThrow();
  });
  it.each(OBSTACLE_CASES)(
    "browser clock and headless replay agree for %s",
    (id) => {
      const level = obstacleRoom(id);
      const replay = {
        version: 2 as const,
        rulesVersion: RULES.version,
        level,
        jumpTicks: [25, 85, 130],
        endTick: 220,
      };
      const expected = replayAttempt(replay);
      const attempt = createAttempt(level);
      attempt.loadReplay(replay);
      const events: typeof expected.events = [];
      attempt.onEvents((next) => events.push(...next));
      attempt.play();
      for (let i = 0; i < 2000 && !attempt.getSnapshot().finished; i++)
        attempt.update(1000 / 60);
      expect(attempt.frameState()).toEqual(expected.state);
      expect(events).toEqual(expected.events);
    },
  );
});
