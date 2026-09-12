import type { Level } from "./types";
import type { Obstacle } from "./obstacleTypes";
import { RULES } from "./rules";
import { parseLevel } from "../validation";

export const LAB_ROOMS = [
  {
    id: "showcase",
    name: "All obstacles",
    hint: "Jump the floor spikes and sliding saw. The upper defenses demonstrate drones, pursuit, and three turret modes.",
  },
  {
    id: "spikes",
    name: "Static spikes",
    hint: "Jump over the pink connectors. The entire marked strip is lethal.",
  },
  {
    id: "slider",
    name: "Sliding saw",
    hint: "The saw follows its marked rail and turns at each endpoint. Time your crossing.",
  },
  {
    id: "fixed",
    name: "Fixed shots",
    hint: "Amber is the warning. Jump over the incoming pink shots; platforms block them.",
  },
  {
    id: "flame",
    name: "Flame bursts",
    hint: "Wait through the warning by jumping, then cross during cooldown. Orange flame is lethal.",
  },
  {
    id: "aimed",
    name: "Aimed shots",
    hint: "The barrel tracks you, but each shot keeps its direction after firing. Change height to dodge.",
  },
  {
    id: "drone",
    name: "Patrol drone",
    hint: "The drone follows its route. Stay clear of its body while crossing underneath or above.",
  },
  {
    id: "pursuer",
    name: "Pursuer",
    hint: "Approaching its home triggers a warning, then pursuit. Gain distance to make it return home.",
  },
] as const;
export type LabRoomId = (typeof LAB_ROOMS)[number]["id"];

export function getObstacleLab(id: LabRoomId): Level {
  const selected = LAB_ROOMS.find((room) => room.id === id);
  if (!selected) throw new Error("Unknown obstacle lab room.");
  const r = RULES.obstacles;
  const spikes: Obstacle = { id: "spikes", kind: "spikes", x: 216, y: 420, width: 48, height: 20 };
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
  function turret(mode: "fixed" | "aimed" | "flame", x: number, y: number): Obstacle {
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
  const examples: Record<LabRoomId, Obstacle[]> = {
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
    id: `obstacle-lab-${id}`,
    name: selected.name,
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
