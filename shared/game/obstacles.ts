import { RULES } from "./rules";
import { movingCircleHit, segmentRect, sweptCircle } from "./sweep";
import type { Level, Rect, State } from "./types";
import type { Obstacle, ObstacleState, Patrol, Projectile, Turret } from "./obstacleTypes";

export function obstacleBounds(obstacle: Obstacle): Rect {
  return obstacle.kind === "spikes"
    ? obstacle
    : {
        x: obstacle.x - obstacle.radius,
        y: obstacle.y - obstacle.radius,
        width: obstacle.radius * 2,
        height: obstacle.radius * 2,
      };
}

export function initialObstacles(level: Level): ObstacleState[] {
  return (level.obstacles ?? []).map((o) => ({
    id: o.id,
    x: o.x,
    y: o.y,
    phase: o.kind === "turret" ? "warning" : "idle",
    sinceTick: 0,
    angle: o.kind === "turret" && o.direction === -1 ? Math.PI : 0,
  }));
}

export function patrolPosition(o: Patrol, tick: number) {
  const length = Math.hypot(o.endX - o.x, o.endY - o.y);
  const distance = ((tick / RULES.tickRate) * o.speed) % (length * 2);
  const fraction = (distance <= length ? distance : length * 2 - distance) / length;
  return { x: o.x + (o.endX - o.x) * fraction, y: o.y + (o.endY - o.y) * fraction };
}

export function turretPhase(o: Turret, tick: number): ObstacleState["phase"] {
  const cycle = tick % o.intervalTicks;
  if (cycle < o.warmupTicks) return "warning";
  if (cycle < o.warmupTicks + (o.mode === "flame" ? o.activeTicks : 1)) return "active";
  return "idle";
}

export function flameBounds(o: Turret, level: Level): Rect {
  const half = RULES.obstacles.flameHalfHeight;
  let distance = Math.min(o.range, o.direction === 1 ? level.width - o.x : o.x);
  for (const p of level.platforms) {
    if (p.y >= o.y + half || p.y + p.height <= o.y - half) continue;
    if (o.x >= p.x && o.x <= p.x + p.width) distance = 0;
    else if (o.direction === 1 && p.x >= o.x) distance = Math.min(distance, p.x - o.x);
    else if (o.direction === -1 && p.x + p.width <= o.x)
      distance = Math.min(distance, o.x - p.x - p.width);
  }
  return {
    x: o.direction === 1 ? o.x : o.x - distance,
    y: o.y - half,
    width: distance,
    height: half * 2,
  };
}

function approach(from: { x: number; y: number }, target: { x: number; y: number }, speed: number) {
  const distance = Math.hypot(target.x - from.x, target.y - from.y);
  if (distance <= speed / RULES.tickRate) return { x: target.x, y: target.y };
  const ratio = speed / RULES.tickRate / distance;
  return { x: from.x + (target.x - from.x) * ratio, y: from.y + (target.y - from.y) * ratio };
}

export function advanceObstacles(level: Level, state: State, body: Rect, tick: number) {
  const oldBody = { ...state.player, width: RULES.playerWidth, height: RULES.playerHeight };
  const target = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
  let hitId: string | null = null;
  const emitted: Projectile[] = [];
  const obstacles = (level.obstacles ?? []).map((o, index): ObstacleState => {
    const previous = state.obstacles[index];
    const next = { ...previous };
    if (o.kind === "slider" || o.kind === "drone") {
      Object.assign(next, patrolPosition(o, tick));
      next.phase = "active";
      next.angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    } else if (o.kind === "pursuer") {
      const distance = Math.hypot(target.x - o.x, target.y - o.y);
      if (next.phase === "idle" && distance <= o.detectionRange) {
        next.phase = "warning";
        next.sinceTick = tick;
      } else if (next.phase === "warning") {
        if (distance > o.detectionRange) next.phase = "idle";
        else if (tick - next.sinceTick >= o.warningTicks) next.phase = "active";
      }
      if (next.phase === "active" && distance > o.chaseRange) next.phase = "returning";
      if (next.phase === "active" || next.phase === "returning") {
        Object.assign(next, approach(previous, next.phase === "active" ? target : o, o.speed));
        next.x = Math.max(o.radius, Math.min(level.width - o.radius, next.x));
        next.y = Math.max(o.radius, Math.min(level.height - o.radius, next.y));
        next.angle = Math.atan2(next.y - previous.y, next.x - previous.x);
        if (next.phase === "returning" && next.x === o.x && next.y === o.y) next.phase = "idle";
      }
    } else if (o.kind === "turret") {
      next.phase = turretPhase(o, tick);
      // Track during warning; the projectile keeps the direction captured when fired.
      next.angle =
        o.mode === "aimed"
          ? Math.atan2(target.y - o.y, target.x - o.x)
          : o.direction === 1
            ? 0
            : Math.PI;
      if (
        o.mode !== "flame" &&
        tick % o.intervalTicks === o.warmupTicks &&
        (o.mode !== "aimed" || Math.hypot(target.x - o.x, target.y - o.y) <= o.range)
      ) {
        emitted.push({
          id: `${o.id}:${tick}`,
          ownerId: o.id,
          x: o.x,
          y: o.y,
          vx: Math.cos(next.angle) * o.projectileSpeed,
          vy: Math.sin(next.angle) * o.projectileSpeed,
          remaining: o.range,
        });
      }
      if (o.mode === "flame" && next.phase === "active") {
        const flame = flameBounds(o, level);
        if (
          flame.width > 0 &&
          segmentRect(oldBody, body, {
            x: flame.x - body.width,
            y: flame.y - body.height,
            width: flame.width + body.width,
            height: flame.height + body.height,
          }) !== null
        )
          hitId ??= o.id;
      }
    }
    if (o.kind === "spikes") {
      if (
        segmentRect(oldBody, body, {
          x: o.x - body.width,
          y: o.y - body.height,
          width: o.width + body.width,
          height: o.height + body.height,
        }) !== null
      )
        hitId ??= o.id;
    } else if (o.kind === "slider" || o.kind === "drone") {
      if (patrolHit(o, state.tick, previous, next, oldBody, body)) hitId ??= o.id;
    } else if (movingCircleHit(previous, next, o.radius, oldBody, body) !== null) hitId ??= o.id;
    return next;
  });

  const projectiles: Projectile[] = [];
  for (const shot of [...state.projectiles, ...emitted]) {
    const distance = Math.min(shot.remaining, Math.hypot(shot.vx, shot.vy) / RULES.tickRate);
    const magnitude = Math.hypot(shot.vx, shot.vy);
    const next = {
      ...shot,
      x: shot.x + (shot.vx / magnitude) * distance,
      y: shot.y + (shot.vy / magnitude) * distance,
      remaining: shot.remaining - distance,
    };
    const walls = level.platforms
      .map((p) => sweptCircle(shot, next, RULES.obstacles.projectileRadius, p))
      .filter((t): t is number => t !== null);
    const wallTime = walls.length ? Math.min(...walls) : Infinity;
    const playerTime = movingCircleHit(shot, next, RULES.obstacles.projectileRadius, oldBody, body);
    if (playerTime !== null && playerTime < wallTime) hitId ??= shot.ownerId;
    if (
      wallTime === Infinity &&
      next.remaining > 0 &&
      next.x >= 0 &&
      next.x <= level.width &&
      next.y >= 0 &&
      next.y <= level.height
    )
      projectiles.push(next);
  }
  return { obstacles, projectiles, hitId };
}

// A route may turn within a tick: sweep both legs instead of cutting the corner.
function patrolHit(
  o: Patrol,
  tick: number,
  from: ObstacleState,
  to: ObstacleState,
  oldBody: Rect,
  body: Rect,
) {
  const length = Math.hypot(o.endX - o.x, o.endY - o.y);
  const distance = (tick / RULES.tickRate) * o.speed;
  const travel = o.speed / RULES.tickRate;
  const turn = (Math.floor(distance / length) + 1) * length;
  if (turn >= distance + travel) return movingCircleHit(from, to, o.radius, oldBody, body) !== null;
  const fraction = (turn - distance) / travel;
  const atTurn = {
    ...body,
    x: oldBody.x + (body.x - oldBody.x) * fraction,
    y: oldBody.y + (body.y - oldBody.y) * fraction,
  };
  const endpoint = Math.round(turn / length) % 2 ? { x: o.endX, y: o.endY } : o;
  return (
    movingCircleHit(from, endpoint, o.radius, oldBody, atTurn) !== null ||
    movingCircleHit(endpoint, to, o.radius, atTurn, body) !== null
  );
}
