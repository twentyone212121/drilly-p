import { RULES } from "../../shared/game/rules";
import type { Level, Rect } from "../../shared/game/types";
import { isRoomSideWall } from "../../shared/game/roomBoundary";

type Feature = { kind: string; values: Record<string, number> };

// Compare gameplay geometry, ignoring names, IDs, array order, and tile seams.
// This is a conservative repetition heuristic, not a proof of route equivalence.
export function similarRooms(left: Level, right: Level): boolean {
  if (JSON.stringify(roomShape(left)) === JSON.stringify(roomShape(right)))
    return true;
  const a = features(left);
  const b = features(right);
  if (a.length !== b.length) return false;

  // Bipartite matching avoids order-dependent matches between nearby hazards.
  const matched = new Map<number, number>();
  function match(index: number, visited: Set<number>): boolean {
    for (let j = 0; j < b.length; j++) {
      if (visited.has(j) || !similarFeature(a[index], b[j])) continue;
      visited.add(j);
      const previous = matched.get(j);
      if (previous === undefined || match(previous, visited)) {
        matched.set(j, index);
        return true;
      }
    }
    return false;
  }
  return a.every((_, index) => match(index, new Set()));
}

// Coarse structure discourages copying the same staircase with larger spacing.
// The builder sees these summaries rather than old coordinates to imitate.
export function roomShape(level: Level) {
  const base = level.spawn.y + RULES.playerHeight;
  const heightBand = (y: number) =>
    Math.round((base - y) / RULES.drilly.noveltyHeightBand);
  const horizontalBand = (x: number) =>
    Math.floor((x / level.width) * RULES.drilly.noveltyHorizontalBands);
  const platforms = mergedPlatforms(
    level.platforms.filter((p) => !isRoomSideWall(p, level)),
  ).sort((a, b) => a.x - b.x || a.y - b.y);
  return {
    route: routeFamily(level),
    surfacesLeftToRight: platforms.map((p) => ({
      elevation: heightBand(p.y),
      wall: p.height > RULES.jumpSpeed ** 2 / (2 * RULES.gravity),
    })),
    treasureJourney: level.treasures
      .map((t) => ({
        region: horizontalBand(t.x),
        elevation: heightBand(t.y + t.height),
      }))
      .sort((a, b) => a.region - b.region || a.elevation - b.elevation),
    hazards: features(level)
      .filter((f) => !["platform", "treasure"].includes(f.kind))
      .map((f) => ({
        kind: f.kind,
        elevation: heightBand(f.values.y),
        motion:
          f.values.endX === undefined
            ? "stationary-or-reactive"
            : Math.abs(f.values.endX - f.values.x) >
                Math.abs(f.values.endY - f.values.y)
              ? "horizontal"
              : "vertical",
        direction: f.values.direction ?? 0,
        speedBand: Math.round(
          (f.values.speed ?? f.values.projectileSpeed ?? 0) /
            RULES.drilly.noveltySpeedTolerance,
        ),
        cycleBand: Math.round(
          (f.values.intervalTicks ?? 0) / RULES.drilly.noveltyTimingTolerance,
        ),
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function routeFamily(level: Level): string {
  if (
    level.treasures.some(
      (treasure) => treasure.x + treasure.width <= level.spawn.x,
    )
  )
    return "return-left";
  const floorY = level.spawn.y + RULES.playerHeight;
  if (
    level.treasures.some(
      (treasure) =>
        treasure.y + treasure.height < floorY - RULES.editor.gridSize,
    )
  )
    return "climb";
  const goalX = Math.max(...level.treasures.map((treasure) => treasure.x));
  const floor = mergedPlatforms(level.platforms).some(
    (platform) =>
      platform.y === floorY &&
      platform.x <= level.spawn.x &&
      platform.x + platform.width >= goalX,
  );
  return floor ? "ground-crossing" : "gap-crossing";
}

function features(level: Level): Feature[] {
  return [
    ...mergedPlatforms(
      level.platforms.filter((p) => !isRoomSideWall(p, level)),
    ).map((rect) => ({
      kind: "platform",
      values: rect,
    })),
    ...level.treasures.map(({ x, y, width, height }) => ({
      kind: "treasure",
      values: { x, y, width, height },
    })),
    ...level.traps.map(({ x, y, radius }) => ({
      kind: "saw",
      values: { x, y, radius },
    })),
    ...(level.obstacles ?? []).map((obstacle) => {
      const { id: _id, kind, ...properties } = obstacle;
      const values = Object.fromEntries(
        Object.entries(properties).filter(
          (entry): entry is [string, number] => typeof entry[1] === "number",
        ),
      );
      return {
        kind: kind === "turret" ? `turret-${obstacle.mode}` : kind,
        values,
      };
    }),
  ];
}

function mergedPlatforms(platforms: Rect[]): Rect[] {
  const sorted = platforms
    .map(({ x, y, width, height }) => ({ x, y, width, height }))
    .sort((a, b) => a.y - b.y || a.height - b.height || a.x - b.x);
  const merged: Rect[] = [];
  for (const rect of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.y === rect.y &&
      previous.height === rect.height &&
      previous.x + previous.width >= rect.x
    ) {
      previous.width =
        Math.max(previous.x + previous.width, rect.x + rect.width) - previous.x;
    } else {
      merged.push(rect);
    }
  }
  return merged;
}

function similarFeature(a: Feature, b: Feature): boolean {
  if (a.kind !== b.kind) return false;
  return Object.entries(a.values).every(([key, value]) => {
    const other = b.values[key];
    if (other === undefined) return false;
    const tolerance =
      key === "direction"
        ? 0
        : key.endsWith("Ticks")
          ? RULES.drilly.noveltyTimingTolerance
          : key.toLowerCase().includes("speed")
            ? RULES.drilly.noveltySpeedTolerance
            : ["width", "height", "radius"].includes(key)
              ? RULES.drilly.noveltySizeTolerance
              : RULES.drilly.noveltyPositionTolerance;
    return Math.abs(value - other) <= tolerance;
  });
}
