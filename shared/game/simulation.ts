import { moveBody, overlaps, touchesCircle } from "./collision";
import { RULES } from "./rules";
import type { Level, State, Input, GameEvent, Rect } from "./types";

type Player = State["player"];

export function initialState(level: Level): State {
  const { x, y, direction } = level.spawn;
  const grounded = level.platforms.some(
    (p) => y + RULES.playerHeight === p.y && x < p.x + p.width && x + RULES.playerWidth > p.x,
  );

  return {
    tick: 0,
    status: "running",
    collectedTreasureIds: [],
    player: {
      x,
      y,
      vx: direction * RULES.runSpeed,
      vy: 0,
      direction,
      grounded,
      wall: 0,
    },
  };
}

// Input tick N is applied BEFORE advancing state N to state N+1.
export function step(
  level: Level,
  state: State,
  input: Input,
): { state: State; events: GameEvent[] } {
  if (state.status === "dead" || state.status === "won") return { state, events: [] };

  // Helpers update this tick's private copy, never the caller's state.
  const player = { ...state.player };
  const events: GameEvent[] = [];
  const collectedTreasureIds = [...state.collectedTreasureIds];
  const tick = state.tick + 1;

  if (input.jump) applyJump(player, state.tick, events);
  applyForces(player);
  movePlayer(player, level.platforms, tick, events);
  const status = resolveOutcome(player, level, collectedTreasureIds, tick, events);

  return { state: { tick, status, player, collectedTreasureIds }, events };
}

function applyJump(player: Player, tick: number, events: GameEvent[]): void {
  if (player.wall === 0 && !player.grounded) {
    events.push({ type: "jump-ignored", tick, reason: "airborne" });
    return;
  }

  const kind = player.wall !== 0 ? "wall" : "ground";
  if (player.wall !== 0) player.direction = -player.wall as -1 | 1;

  player.vy = -RULES.jumpSpeed;
  events.push({ type: "jumped", tick, kind });
}

function applyForces(player: Player): void {
  player.vx = player.direction * RULES.runSpeed;
  player.vy += RULES.gravity / RULES.tickRate;

  if (player.wall !== 0 && player.vy > RULES.wallSlideSpeed) {
    player.vy = RULES.wallSlideSpeed;
  }
}

function movePlayer(
  player: Player,
  platforms: Level["platforms"],
  tick: number,
  events: GameEvent[],
): void {
  const moved = moveBody(
    playerBounds(player),
    player.vx / RULES.tickRate,
    player.vy / RULES.tickRate,
    platforms,
  );

  if (moved.floor && !player.grounded) {
    events.push({ type: "landed", tick, platformId: moved.floor });
  }

  if (moved.wall && moved.wall !== player.wall) {
    events.push({ type: "wall-contact", tick, side: moved.wall });
  }

  player.x = moved.x;
  player.y = moved.y;
  player.grounded = moved.floor !== null;
  player.wall = moved.wall;

  if (moved.floor || moved.ceiling) player.vy = 0;
  if (moved.wall) player.vx = 0;
}

function resolveOutcome(
  player: Player,
  level: Level,
  collectedTreasureIds: string[],
  tick: number,
  events: GameEvent[],
): State["status"] {
  const body = playerBounds(player);
  const hit = level.traps.find((trap) => touchesCircle(body, trap));
  const outOfBounds =
    player.y > level.height || player.x < -RULES.playerWidth || player.x > level.width;

  // Lethal collision has priority over treasure contact on the same tick.
  if (hit || outOfBounds) {
    events.push({ type: "died", tick, trapId: hit?.id ?? "out-of-bounds" });
    return "dead";
  }

  for (const treasure of level.treasures) {
    if (collectedTreasureIds.includes(treasure.id) || !overlaps(body, treasure)) continue;

    collectedTreasureIds.push(treasure.id);
    events.push({ type: "treasure-collected", tick, treasureId: treasure.id });
  }

  if (level.treasures.length > 0 && collectedTreasureIds.length === level.treasures.length) {
    events.push({ type: "won", tick });
    return "won";
  }

  return "running";
}

function playerBounds(player: Player): Rect {
  return {
    x: player.x,
    y: player.y,
    width: RULES.playerWidth,
    height: RULES.playerHeight,
  };
}
