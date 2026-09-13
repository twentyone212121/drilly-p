import { step } from "../../shared/game/simulation";
import { RULES } from "../../shared/game/rules";
import type { Level, State } from "../../shared/game/types";
import type { DrillyRoute } from "../../shared/game/drilly";

type Branch = { state: State; jumps: number[]; waypoint: number };

export function advanceWaypoint(
  level: Level,
  state: State,
  route: DrillyRoute,
  index: number,
) {
  while (index < route.length && reached(level, state, route[index])) index++;
  return index;
}

function reached(level: Level, state: State, target: DrillyRoute[number]) {
  if (target.kind === "treasure")
    return state.collectedTreasureIds.includes(target.id);
  const platform = level.platforms.find((p) => p.id === target.id)!;
  const p = state.player;
  if (target.kind === "wall") {
    return (
      p.wall !== 0 &&
      p.y + RULES.playerHeight > platform.y &&
      p.y < platform.y + platform.height &&
      (Math.abs(p.x + RULES.playerWidth - platform.x) < 1 ||
        Math.abs(p.x - platform.x - platform.width) < 1)
    );
  }
  return (
    p.grounded &&
    Math.abs(p.y + RULES.playerHeight - platform.y) < 1 &&
    p.x + RULES.playerWidth > platform.x &&
    p.x < platform.x + platform.width
  );
}

// A short receding horizon, never a full-room solution. Predictions use copies;
// only the chosen prefix becomes real jump input in the forward-only attempt.
export function planMovement(
  level: Level,
  start: State,
  route: DrillyRoute,
  waypoint: number,
) {
  const {
    movementHorizon,
    movementStride,
    movementWidth,
    movementCommitTicks,
  } = RULES.drilly;
  let beam: Branch[] = [{ state: start, jumps: [], waypoint }];
  let best = beam[0];
  const endTick = Math.min(RULES.maxTicks, start.tick + movementHorizon);
  for (let tick = start.tick; tick < endTick; tick += movementStride) {
    const next = new Map<string, Branch>();
    for (const branch of beam) {
      const canJump =
        branch.state.player.grounded || branch.state.player.wall !== 0;
      for (const jump of canJump ? [false, true] : [false]) {
        let state = branch.state;
        const jumps = jump ? [...branch.jumps, state.tick] : branch.jumps;
        let goal = branch.waypoint;
        for (
          let offset = 0;
          offset < movementStride &&
          state.tick < endTick &&
          state.status === "running";
          offset++
        ) {
          state = step(level, state, { jump: jump && offset === 0 }).state;
          goal = advanceWaypoint(level, state, route, goal);
        }
        const candidate = { state, jumps, waypoint: goal };
        if (state.status === "won")
          return prefix(candidate, start.tick, movementCommitTicks);
        if (state.status === "dead") continue;
        const key = bucket(candidate);
        const existing = next.get(key);
        if (
          !existing ||
          score(level, candidate, route) > score(level, existing, route)
        )
          next.set(key, candidate);
      }
    }
    if (!next.size) break;
    beam = [...next.values()]
      .sort((a, b) => score(level, b, route) - score(level, a, route))
      .slice(0, movementWidth);
    best = beam[0];
  }
  return prefix(best, start.tick, movementCommitTicks);
}

function prefix(branch: Branch, tick: number, ticks: number) {
  return {
    jumpTicks: branch.jumps.filter((jump) => jump < tick + ticks),
    ticks,
  };
}

function bucket({ state, waypoint }: Branch) {
  const p = state.player;
  return [
    Math.round(p.x / RULES.drilly.movementPositionBucket),
    Math.round(p.y / RULES.drilly.movementPositionBucket),
    Math.round(p.vy / RULES.drilly.movementVelocityBucket),
    p.direction,
    p.wall,
    p.grounded,
    waypoint,
    state.collectedTreasureIds.join(","),
  ].join("/");
}

function score(level: Level, branch: Branch, route: DrillyRoute) {
  const { state, waypoint, jumps } = branch;
  const target = route[waypoint];
  if (!target)
    return (
      state.collectedTreasureIds.length * RULES.drilly.movementTreasureReward -
      jumps.length
    );
  const object =
    target.kind === "treasure"
      ? level.treasures.find((t) => t.id === target.id)!
      : level.platforms.find((p) => p.id === target.id)!;
  const p = state.player;
  const targetX = Math.max(
    object.x,
    Math.min(p.x, object.x + object.width - RULES.playerWidth),
  );
  const targetY =
    target.kind === "platform"
      ? object.y - RULES.playerHeight
      : target.kind === "wall"
        ? p.y
        : object.y;
  let distance = Math.abs(targetX - p.x);
  // An objective behind us requires a real wall reversal. Reward approaching the
  // nearest blocking face instead of standing still because direct distance grows.
  if ((targetX - p.x) * p.direction < -RULES.playerWidth) {
    const faces = level.platforms.filter(
      (wall) =>
        wall.y < p.y + RULES.playerHeight &&
        wall.y + wall.height > p.y &&
        (p.direction === 1
          ? wall.x >= p.x + RULES.playerWidth - 1
          : wall.x + wall.width <= p.x + 1),
    );
    const wallDistance = Math.min(
      level.width,
      ...faces.map((wall) =>
        p.direction === 1
          ? wall.x - p.x - RULES.playerWidth
          : p.x - wall.x - wall.width,
      ),
    );
    distance += Math.max(0, wallDistance) * 2;
  }
  return (
    waypoint * RULES.drilly.movementWaypointReward +
    state.collectedTreasureIds.length * RULES.drilly.movementTreasureReward -
    distance -
    Math.abs(targetY - p.y) * RULES.drilly.movementVerticalWeight -
    jumps.length * RULES.drilly.movementJumpPenalty
  );
}
