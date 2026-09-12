import { obstacleBounds } from "./game/obstacles";
import { segmentRect, sweptCircle } from "./game/sweep";
import * as v from "valibot";
import { overlaps, touchesCircle } from "./game/collision";
import { RULES } from "./game/rules";
import type { Level, Rect, Replay } from "./game/types";

const NameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(100));
const CoordinateSchema = v.pipe(v.number(), v.finite(), v.minValue(0));
const SizeSchema = v.pipe(v.number(), v.finite(), v.minValue(1));
const RoomSizeSchema = v.pipe(v.number(), v.finite(), v.minValue(160), v.maxValue(2000));

const RectSchema = v.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
  width: SizeSchema,
  height: SizeSchema,
});

const PlatformSizeSchema = v.pipe(SizeSchema, v.minValue(RULES.editor.minPlatformSize));
const PlatformSchema = v.object({
  ...RectSchema.entries,
  id: NameSchema,
  width: PlatformSizeSchema,
  height: PlatformSizeSchema,
});
const TreasureSchema = v.object({ ...RectSchema.entries, id: NameSchema });

const TrapSchema = v.object({
  id: NameSchema,
  x: CoordinateSchema,
  y: CoordinateSchema,
  radius: v.pipe(v.number(), v.finite(), v.minValue(4), v.maxValue(100)),
});

const ObstacleRadius = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(RULES.obstacles.minRadius),
  v.maxValue(RULES.obstacles.maxRadius),
);
const SpeedSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(RULES.obstacles.minSpeed),
  v.maxValue(RULES.obstacles.maxSpeed),
);
const RangeSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(RULES.obstacles.minRange),
  v.maxValue(RULES.obstacles.maxRange),
);
const WarningSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(RULES.obstacles.minWarning),
  v.maxValue(RULES.obstacles.maxInterval),
);
const CenterFields = {
  id: NameSchema,
  x: CoordinateSchema,
  y: CoordinateSchema,
  radius: ObstacleRadius,
};
const PathFields = {
  ...CenterFields,
  endX: CoordinateSchema,
  endY: CoordinateSchema,
  speed: SpeedSchema,
};
const ObstacleSchema = v.variant("kind", [
  v.object({ ...RectSchema.entries, id: NameSchema, kind: v.literal("spikes") }),
  v.object({ ...PathFields, kind: v.literal("slider") }),
  v.object({ ...PathFields, kind: v.literal("drone") }),
  v.object({
    ...CenterFields,
    kind: v.literal("turret"),
    mode: v.picklist(["fixed", "aimed", "flame"]),
    direction: v.union([v.literal(-1), v.literal(1)]),
    intervalTicks: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(RULES.obstacles.minInterval),
      v.maxValue(RULES.obstacles.maxInterval),
    ),
    warmupTicks: WarningSchema,
    activeTicks: WarningSchema,
    range: RangeSchema,
    projectileSpeed: SpeedSchema,
  }),
  v.object({
    ...CenterFields,
    kind: v.literal("pursuer"),
    speed: SpeedSchema,
    detectionRange: RangeSchema,
    chaseRange: RangeSchema,
    warningTicks: WarningSchema,
  }),
]);

const SpawnSchema = v.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
  direction: v.union([v.literal(-1), v.literal(1)]),
});

const EditorLevelSchema = v.pipe(
  v.object({
    version: v.literal(2),
    id: NameSchema,
    name: NameSchema,
    width: RoomSizeSchema,
    height: RoomSizeSchema,
    spawn: SpawnSchema,
    platforms: v.pipe(
      v.array(PlatformSchema),
      v.maxLength(RULES.editor.maxPlatforms, "Platform limit reached."),
    ),
    traps: v.pipe(v.array(TrapSchema), v.maxLength(RULES.editor.maxSaws, "Saw limit reached.")),
    obstacles: v.optional(v.pipe(v.array(ObstacleSchema), v.maxLength(RULES.obstacles.maxCount))),
    treasures: v.pipe(
      v.array(TreasureSchema),
      v.maxLength(RULES.editor.maxTreasures, "Treasure limit reached."),
    ),
  }),
  v.check(validObstacles, "Check obstacle routes, timing, ranges, and per-kind limits."),
  v.check(
    objectsFitRoom,
    "Every object, including the full hazard bounds, must fit inside the room.",
  ),
  v.check(hasUniqueIds, "Object ids must be unique."),
  v.check(hasClearSpawn, "Keep the fixed spawn clear of platforms, hazards, and treasures."),
);

const LevelSchema = v.pipe(
  EditorLevelSchema,
  v.check((level) => level.treasures.length > 0, "Add at least one treasure before testing."),
);

const TickLimitSchema = v.pipe(
  v.number(),
  v.finite(),
  v.integer(),
  v.minValue(0),
  v.maxValue(RULES.maxTicks),
);

const JumpTicksSchema = v.pipe(
  v.array(
    v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(RULES.maxTicks - 1)),
  ),
  v.maxLength(RULES.maxTicks),
  v.check(
    (ticks) => ticks.every((tick, i) => i === 0 || tick > ticks[i - 1]),
    "Jump ticks must be unique integers in increasing order.",
  ),
);

const ReplaySchema = v.pipe(
  v.object({
    version: v.literal(2),
    rulesVersion: v.literal(RULES.version),
    level: LevelSchema,
    jumpTicks: JumpTicksSchema,
    endTick: TickLimitSchema,
  }),
  v.check(
    (replay) => replay.jumpTicks.every((tick) => tick < replay.endTick),
    "Jump ticks must be before endTick.",
  ),
);

export function parseLevel(value: unknown): Level {
  return v.parse(LevelSchema, value);
}

// Drafts may have no treasure; room dimensions and spawn belong to the fixed template.
export function parseEditorLevel(value: unknown, template: Level): Level {
  return v.parse(
    v.pipe(
      EditorLevelSchema,
      v.check(
        (level) =>
          level.width === template.width &&
          level.height === template.height &&
          level.spawn.x === template.spawn.x &&
          level.spawn.y === template.spawn.y &&
          level.spawn.direction === template.spawn.direction,
        "Room dimensions and player spawn are fixed.",
      ),
    ),
    value,
  );
}

export function parseReplay(value: unknown): Replay {
  return v.parse(ReplaySchema, value);
}

export function parseJumpTicks(value: unknown, endTick: number = RULES.maxTicks): number[] {
  const limit = v.parse(TickLimitSchema, endTick);
  const schema = v.pipe(
    JumpTicksSchema,
    v.check((ticks) => ticks.every((tick) => tick < limit), "Jump ticks must be before endTick."),
  );

  return v.parse(schema, value);
}

function fitsRoom(rect: Rect, level: Level): boolean {
  return rect.width <= level.width - rect.x && rect.height <= level.height - rect.y;
}

function spawnBounds(level: Level): Rect {
  return {
    ...level.spawn,
    width: RULES.playerWidth,
    height: RULES.playerHeight,
  };
}

function objectsFitRoom(level: Level): boolean {
  return (
    (level.obstacles ?? []).every(
      (o) =>
        fitsRoom(obstacleBounds(o), level) &&
        obstacleBounds(o).x >= 0 &&
        obstacleBounds(o).y >= 0 &&
        (!(o.kind === "slider" || o.kind === "drone") ||
          (o.endX >= o.radius &&
            o.endY >= o.radius &&
            o.endX + o.radius <= level.width &&
            o.endY + o.radius <= level.height)),
    ) &&
    level.platforms.every((platform) => fitsRoom(platform, level)) &&
    level.treasures.every((treasure) => fitsRoom(treasure, level)) &&
    fitsRoom(spawnBounds(level), level) &&
    level.traps.every(
      (trap) =>
        trap.x - trap.radius >= 0 &&
        trap.y - trap.radius >= 0 &&
        trap.x + trap.radius <= level.width &&
        trap.y + trap.radius <= level.height,
    )
  );
}

function hasUniqueIds(level: Level): boolean {
  const ids = [
    ...level.platforms,
    ...level.traps,
    ...level.treasures,
    ...(level.obstacles ?? []),
  ].map((item) => item.id);

  return new Set(ids).size === ids.length;
}

function hasClearSpawn(level: Level): boolean {
  const spawn = spawnBounds(level);

  return (
    (level.obstacles ?? []).every((o) =>
      o.kind === "spikes"
        ? segmentRect(spawn, spawn, {
            x: o.x - spawn.width,
            y: o.y - spawn.height,
            width: o.width + spawn.width,
            height: o.height + spawn.height,
          }) === null
        : o.kind === "slider" || o.kind === "drone"
          ? sweptCircle(o, { x: o.endX, y: o.endY }, o.radius, spawn) === null
          : !touchesCircle(spawn, o),
    ) &&
    level.platforms.every((platform) => !overlaps(spawn, platform)) &&
    level.traps.every((trap) => !touchesCircle(spawn, trap)) &&
    level.treasures.every((treasure) => !overlaps(spawn, treasure))
  );
}

function validObstacles(level: Level): boolean {
  const obstacles = level.obstacles ?? [];
  return obstacles.every((o) => {
    if (obstacles.filter((other) => other.kind === o.kind).length > RULES.obstacles.maxPerKind)
      return false;
    if (o.kind === "slider" || o.kind === "drone")
      return Math.hypot(o.endX - o.x, o.endY - o.y) >= RULES.editor.gridSize;
    if (o.kind === "turret")
      return o.warmupTicks + (o.mode === "flame" ? o.activeTicks : 1) < o.intervalTicks;
    if (o.kind === "pursuer") return o.chaseRange >= o.detectionRange;
    return true;
  });
}
