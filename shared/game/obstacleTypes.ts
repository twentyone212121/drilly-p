import type { Rect } from "./types";

export type ObstacleKind = "spikes" | "slider" | "turret" | "drone" | "pursuer";
type Center = { id: string; x: number; y: number; radius: number };
export type Spikes = Rect & {
  id: string;
  kind: "spikes";
  rotation?: 0 | 1 | 2 | 3;
};
export type Patrol = Center & {
  kind: "slider" | "drone";
  endX: number;
  endY: number;
  speed: number;
};
export type Turret = Center & {
  kind: "turret";
  mode: "fixed" | "aimed" | "flame";
  direction: -1 | 1;
  axis?: "x" | "y";
  intervalTicks: number;
  warmupTicks: number;
  activeTicks: number;
  range: number;
  projectileSpeed: number;
};
export type Pursuer = Center & {
  kind: "pursuer";
  speed: number;
  // Accepted when reading older layouts; pursuit no longer uses these settings.
  detectionRange?: number;
  chaseRange?: number;
  warningTicks?: number;
};
export type Obstacle = Spikes | Patrol | Turret | Pursuer;
export type ObstacleState = {
  id: string;
  x: number;
  y: number;
  phase: "idle" | "warning" | "active";
  angle: number;
};
export type Projectile = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};
