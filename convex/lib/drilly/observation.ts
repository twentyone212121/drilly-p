import { flameBounds } from "../../../shared/game/obstacles";
import { RULES } from "../../../shared/game/rules";
import type { Level, State, Rect } from "../../../shared/game/types";

// Perception of present geometry only: no candidate rollouts or solution search.
export function observeRoom(level: Level, state: State) {
  const p = state.player;
  const relative = (rect: Rect) => ({
    ...rect,
    gapAhead: Math.round(
      p.direction === 1
        ? rect.x - p.x - RULES.playerWidth
        : p.x - rect.x - rect.width,
    ),
    overlapsPlayerHeight:
      p.y < rect.y + rect.height && p.y + RULES.playerHeight > rect.y,
  });
  const hazards = [
    ...level.traps.map((t) => ({
      id: t.id,
      kind: "saw",
      ...relative({
        x: t.x - t.radius,
        y: t.y - t.radius,
        width: t.radius * 2,
        height: t.radius * 2,
      }),
    })),
    ...(level.obstacles ?? []).map((o) => {
      const live = state.obstacles.find((s) => s.id === o.id);
      const rect =
        o.kind === "spikes"
          ? o
          : {
              x: (live?.x ?? o.x) - o.radius,
              y: (live?.y ?? o.y) - o.radius,
              width: 2 * o.radius,
              height: 2 * o.radius,
            };
      const moving =
        o.kind === "slider" ||
        o.kind === "drone" ||
        (o.kind === "pursuer" &&
          (live?.phase === "active" || live?.phase === "returning"));
      const angle =
        state.tick === 0 && (o.kind === "slider" || o.kind === "drone")
          ? Math.atan2(o.endY - o.y, o.endX - o.x)
          : (live?.angle ?? 0);
      const speed = moving && "speed" in o ? o.speed : 0;
      return {
        velocityPixelsPerTick: {
          x:
            Math.round(((Math.cos(angle) * speed) / RULES.tickRate) * 100) /
            100,
          y:
            Math.round(((Math.sin(angle) * speed) / RULES.tickRate) * 100) /
            100,
        },
        id: o.id,
        kind: o.kind,
        phase: live?.phase ?? "idle",
        ...relative(rect),
      };
    }),
  ];
  return {
    tick: state.tick,
    player: { ...p, width: RULES.playerWidth, height: RULES.playerHeight },
    canJump: p.grounded || p.wall !== 0,
    jumpEffect:
      p.wall !== 0
        ? "reverse direction and jump"
        : p.grounded
          ? "jump forward"
          : "no effect until landing or wall contact",
    treasuresRemaining: level.treasures.filter(
      (t) => !state.collectedTreasureIds.includes(t.id),
    ),
    platformFaces: level.platforms.map((platform) => ({
      id: platform.id,
      ...relative(platform),
      riseFromFeet: Math.round(p.y + RULES.playerHeight - platform.y),
    })),
    hazards,
    activeFlames: (level.obstacles ?? [])
      .filter(
        (o) =>
          o.kind === "turret" &&
          o.mode === "flame" &&
          state.obstacles.find((s) => s.id === o.id)?.phase === "active",
      )
      .map((o) =>
        o.kind === "turret"
          ? { id: o.id, ...relative(flameBounds(o, level)) }
          : null,
      ),
    projectiles: state.projectiles,
    obstacleStates: state.obstacles,
  };
}
