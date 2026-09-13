import type { Level } from "../game/types";
import type { Obstacle } from "../game/obstacleTypes";
import { RULES } from "../game/rules";
import { parseLevel } from "../validation";

export const OBSTACLE_CASES = [
  "showcase",
  "spikes",
  "slider",
  "fixed",
  "flame",
  "aimed",
  "drone",
  "pursuer",
] as const;
export type ObstacleCase = (typeof OBSTACLE_CASES)[number];

export function obstacleRoom(id: ObstacleCase): Level {
  const r = RULES.obstacles;
  const spikes: Obstacle = {
    id: "spikes",
    kind: "spikes",
    x: 216,
    y: 420,
    width: 48,
    height: 20,
  };
  const slider: Obstacle = {
    id: "slider",
    kind: "slider",
    x: 370,
    y: 407,
    endX: 490,
    endY: 407,
    radius: 18,
    speed: 75,
  };
  const drone: Obstacle = {
    id: "drone",
    kind: "drone",
    x: 410,
    y: 270,
    endX: 600,
    endY: 270,
    radius: 18,
    speed: r.patrolSpeed,
  };
  const pursuer: Obstacle = {
    id: "pursuer",
    kind: "pursuer",
    x: 120,
    y: 200,
    radius: 18,
    speed: r.pursuerSpeed,
    detectionRange: r.detectionRange,
    chaseRange: r.chaseRange,
    warningTicks: r.warningTicks,
  };
  function turret(
    mode: "fixed" | "aimed" | "flame",
    x: number,
    y: number,
  ): Obstacle {
    return {
      id: mode,
      kind: "turret",
      mode,
      x,
      y,
      radius: 18,
      direction: -1,
      intervalTicks: r.intervalTicks,
      warmupTicks: r.warmupTicks,
      activeTicks: r.activeTicks,
      range: r.range,
      projectileSpeed: r.projectileSpeed,
    };
  }
  const examples: Record<ObstacleCase, Obstacle[]> = {
    showcase: [
      spikes,
      slider,
      drone,
      pursuer,
      turret("fixed", 810, 170),
      turret("flame", 700, 80),
      turret("aimed", 790, 285),
    ],
    spikes: [spikes],
    slider: [slider],
    drone: [{ ...drone, y: 360, endY: 360 }],
    pursuer: [{ ...pursuer, x: 180, y: 340 }],
    fixed: [turret("fixed", 630, 390)],
    flame: [turret("flame", 550, 406)],
    aimed: [turret("aimed", 570, 345)],
  };
  return parseLevel({
    version: 2,
    id: `obstacle-case-${id}`,
    name: id,
    width: 900,
    height: 480,
    spawn: { x: 64, y: 412, direction: 1 },
    platforms: [
      { id: "floor", x: 0, y: 440, width: 900, height: 40 },
      { id: "left", x: 0, y: 0, width: 16, height: 440 },
      { id: "right", x: 884, y: 0, width: 16, height: 440 },
    ],
    traps: [],
    obstacles: examples[id],
    treasures: [{ id: "data", x: 822, y: 400, width: 28, height: 32 }],
  });
}
