import { collisionPlatforms } from "./roomBoundary";
import { spikeParts } from "./spikes";
import { RULES } from "./rules";
import { movingCircleHit, segmentRect, sweptCircle } from "./sweep";
import type { GameEvent, Level, Rect, State } from "./types";
import type {
  Obstacle,
  ObstacleState,
  Patrol,
  Projectile,
  Turret,
} from "./obstacleTypes";

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
    angle:
      o.kind === "turret"
        ? turretAngle(o)
        : o.kind === "drone"
          ? Math.atan2(o.endY - o.y, o.endX - o.x)
          : 0,
  }));
}

export function patrolPosition(o: Patrol, tick: number) {
  const length = Math.hypot(o.endX - o.x, o.endY - o.y);
  if (length === 0) return { x: o.x, y: o.y };
  const distance = ((tick / RULES.tickRate) * o.speed) % (length * 2);
  const progress =
    (distance <= length ? distance : length * 2 - distance) / length;
  const fraction =
    o.kind === "drone" ? (1 - Math.cos(Math.PI * progress)) / 2 : progress;
  return {
    x: o.x + (o.endX - o.x) * fraction,
    y: o.y + (o.endY - o.y) * fraction,
  };
}

export function turretPhase(o: Turret, tick: number): ObstacleState["phase"] {
  const cycle = tick % o.intervalTicks;
  if (cycle < o.warmupTicks) return "warning";
  if (cycle < o.warmupTicks + (o.mode === "flame" ? o.activeTicks : 1))
    return "active";
  return "idle";
}

export function turretAngle(o: Turret) {
  return (
    (o.axis === "y" ? Math.PI / 2 : 0) + (o.direction === -1 ? Math.PI : 0)
  );
}

export function flameBounds(o: Turret, level: Level): Rect {
  const vertical = o.axis === "y";
  const origin = vertical ? o.y : o.x;
  const cross = vertical ? o.x : o.y;
  const half = RULES.obstacles.flameHalfHeight;
  const extent = vertical ? level.height : level.width;
  let distance = Math.min(
    o.range,
    o.direction === 1 ? extent - origin : origin,
  );
  for (const p of collisionPlatforms(level)) {
    const along = vertical ? p.y : p.x;
    const length = vertical ? p.height : p.width;
    const across = vertical ? p.x : p.y;
    const breadth = vertical ? p.width : p.height;
    if (across >= cross + half || across + breadth <= cross - half) continue;
    if (origin >= along && origin <= along + length) distance = 0;
    else if (o.direction === 1 && along >= origin)
      distance = Math.min(distance, along - origin);
    else if (o.direction === -1 && along + length <= origin)
      distance = Math.min(distance, origin - along - length);
  }
  const start = o.direction === 1 ? origin : origin - distance;
  return vertical
    ? { x: cross - half, y: start, width: half * 2, height: distance }
    : { x: start, y: cross - half, width: distance, height: half * 2 };
}

function approach(
  from: { x: number; y: number },
  target: { x: number; y: number },
  speed: number,
) {
  const distance = Math.hypot(target.x - from.x, target.y - from.y);
  if (distance <= speed / RULES.tickRate) return { x: target.x, y: target.y };
  const ratio = speed / RULES.tickRate / distance;
  return {
    x: from.x + (target.x - from.x) * ratio,
    y: from.y + (target.y - from.y) * ratio,
  };
}

export function advanceObstacles(
  level: Level,
  state: State,
  body: Rect,
  tick: number,
) {
  const oldBody = {
    ...state.player,
    width: RULES.playerWidth,
    height: RULES.playerHeight,
  };
  const target = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
  let hitId: string | null = null;
  const events: GameEvent[] = [];
  const emitted: Projectile[] = [];
  const obstacles = (level.obstacles ?? []).map((o, index): ObstacleState => {
    const previous = state.obstacles[index];
    const next = { ...previous };
    if (o.kind === "slider" || o.kind === "drone") {
      Object.assign(next, patrolPosition(o, tick));
      next.phase = "active";
      next.angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    } else if (o.kind === "pursuer") {
      next.phase = "active";
      Object.assign(next, approach(previous, target, o.speed));
      next.angle = Math.atan2(target.y - previous.y, target.x - previous.x);
    } else if (o.kind === "turret") {
      next.phase = turretPhase(o, tick);
      // Track during warning; the projectile keeps the direction captured when fired.
      next.angle =
        o.mode === "aimed"
          ? Math.atan2(target.y - o.y, target.x - o.x)
          : turretAngle(o);
      if (
        o.mode !== "flame" &&
        tick % o.intervalTicks === o.warmupTicks &&
        (o.mode !== "aimed" ||
          Math.hypot(target.x - o.x, target.y - o.y) <= o.range)
      ) {
        events.push({ type: "turret-fired", tick, turretId: o.id });
        emitted.push({
          id: `${o.id}:${tick}`,
          ownerId: o.id,
          x: o.x,
          y: o.y,
          vx: Math.cos(next.angle) * o.projectileSpeed,
          vy: Math.sin(next.angle) * o.projectileSpeed,
        });
      }
      if (o.mode === "flame" && next.phase === "active") {
        const flame = flameBounds(o, level);
        if (
          flame.width > 0 &&
          flame.height > 0 &&
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
      const teeth = spikeParts(o).teeth;
      if (
        segmentRect(oldBody, body, {
          x: teeth.x - body.width,
          y: teeth.y - body.height,
          width: teeth.width + body.width,
          height: teeth.height + body.height,
        }) !== null
      )
        hitId ??= o.id;
    } else if (o.kind === "slider" || o.kind === "drone") {
      if (patrolHit(o, state.tick, previous, next, oldBody, body))
        hitId ??= o.id;
    } else if (
      o.kind === "pursuer" &&
      movingCircleHit(previous, next, o.radius, oldBody, body) !== null
    )
      hitId ??= o.id;
    return next;
  });

  const projectiles: Projectile[] = [];
  for (const shot of [...state.projectiles, ...emitted]) {
    const next = {
      ...shot,
      x: shot.x + shot.vx / RULES.tickRate,
      y: shot.y + shot.vy / RULES.tickRate,
    };
    const walls = collisionPlatforms(level)
      .map((p) => sweptCircle(shot, next, RULES.obstacles.projectileRadius, p))
      .filter((t): t is number => t !== null);
    const wallTime = walls.length ? Math.min(...walls) : Infinity;
    const playerTime = movingCircleHit(
      shot,
      next,
      RULES.obstacles.projectileRadius,
      oldBody,
      body,
    );
    if (playerTime !== null && playerTime < wallTime) hitId ??= shot.ownerId;
    if (
      wallTime === Infinity &&
      next.x >= 0 &&
      next.x <= level.width &&
      next.y >= 0 &&
      next.y <= level.height
    )
      projectiles.push(next);
  }
  return { obstacles, projectiles, hitId, events };
}

// Split at every reversal, using the same travel timing as the visible patrol.
function patrolHit(
  o: Patrol,
  tick: number,
  from: ObstacleState,
  to: ObstacleState,
  oldBody: Rect,
  body: Rect,
) {
  const length = Math.hypot(o.endX - o.x, o.endY - o.y);
  if (length === 0)
    return movingCircleHit(from, to, o.radius, oldBody, body) !== null;
  const legTicks = (length * RULES.tickRate) / o.speed;
  const bodyAt = (time: number) => ({
    ...body,
    x: oldBody.x + (body.x - oldBody.x) * (time - tick),
    y: oldBody.y + (body.y - oldBody.y) * (time - tick),
  });
  let start = tick;
  let startPosition = from;
  for (
    let turn = Math.floor(tick / legTicks) + 1;
    turn * legTicks < tick + 1;
    turn++
  ) {
    const end = turn * legTicks;
    const endpoint = { ...from, ...patrolPosition(o, end) };
    if (
      movingCircleHit(
        startPosition,
        endpoint,
        o.radius,
        bodyAt(start),
        bodyAt(end),
      ) !== null
    )
      return true;
    start = end;
    startPosition = endpoint;
  }
  return (
    movingCircleHit(startPosition, to, o.radius, bodyAt(start), body) !== null
  );
}
