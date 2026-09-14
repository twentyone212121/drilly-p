import type { Obstacle, ObstacleState, Projectile } from "./obstacleTypes";

export type Rect = { x: number; y: number; width: number; height: number };
export type Platform = Rect & { id: string };
export type Saw = { id: string; x: number; y: number; radius: number };
export type Treasure = Rect & { id: string };

export type Level = {
  version: 2;
  id: string;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number; direction: -1 | 1 };
  platforms: Platform[];
  traps: Saw[];
  obstacles?: Obstacle[];
  treasures: Treasure[];
};

export type State = {
  tick: number;
  status: "running" | "dead" | "won";
  collectedTreasureIds: string[];
  obstacles: ObstacleState[];
  projectiles: Projectile[];
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    direction: -1 | 1;
    grounded: boolean;
    wall: -1 | 0 | 1;
  };
};

export type Input = { jump: boolean };

export type GameEvent =
  | { type: "turret-fired"; tick: number; turretId: string }
  | { type: "jumped"; tick: number; kind: "ground" | "wall" }
  | { type: "jump-ignored"; tick: number; reason: "airborne" }
  | { type: "landed"; tick: number; platformId: string }
  | { type: "wall-contact"; tick: number; side: -1 | 1 }
  | { type: "died"; tick: number; trapId: string }
  | { type: "treasure-collected"; tick: number; treasureId: string }
  | { type: "won"; tick: number };

export type Replay = {
  version: 2;
  rulesVersion: string;
  level: Level;
  jumpTicks: number[];
  endTick: number;
};

export type AttemptResult = {
  state: State;
  events: GameEvent[];
  trajectory: State[];
  stopReason: "dead" | "won" | "tick-limit";
};

export type EditorObject =
  | { kind: "platform"; value: Platform }
  | { kind: "saw"; value: Saw }
  | { kind: "obstacle"; value: Obstacle }
  | { kind: "treasure"; value: Treasure };
