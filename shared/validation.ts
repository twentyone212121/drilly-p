import type { DrillyModel } from "./game/drilly";
import { obstacleBounds } from "./game/obstacles";
import { segmentRect, sweptCircle } from "./game/sweep";
import * as v from "valibot";
import { overlaps, touchesCircle } from "./game/collision";
import { RULES } from "./game/rules";
import {
  collisionPlatforms,
  roomBorders,
  isFixedRoomPlatform,
} from "./game/roomBoundary";
import type { EditorObject, Level, Rect, Replay } from "./game/types";

const NameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(100));
const CoordinateSchema = v.pipe(v.number(), v.finite(), v.minValue(0));
const SizeSchema = v.pipe(v.number(), v.finite(), v.minValue(1));
const RoomSizeSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(160),
  v.maxValue(2000),
);

const RectSchema = v.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
  width: SizeSchema,
  height: SizeSchema,
});

const PlatformSizeSchema = v.pipe(
  SizeSchema,
  v.minValue(RULES.editor.minPlatformSize),
);
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
  v.object({
    ...RectSchema.entries,
    id: NameSchema,
    kind: v.literal("spikes"),
    rotation: v.optional(v.picklist([0, 1, 2, 3])),
  }),
  v.object({ ...PathFields, kind: v.literal("slider") }),
  v.object({ ...PathFields, kind: v.literal("drone") }),
  v.object({
    ...CenterFields,
    kind: v.literal("turret"),
    mode: v.picklist(["fixed", "aimed", "flame"]),
    axis: v.optional(v.picklist(["x", "y"])),
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
    detectionRange: v.optional(RangeSchema),
    chaseRange: v.optional(RangeSchema),
    warningTicks: v.optional(WarningSchema),
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
    traps: v.pipe(
      v.array(TrapSchema),
      v.maxLength(RULES.editor.maxSaws, "Saw limit reached."),
    ),
    obstacles: v.optional(
      v.pipe(v.array(ObstacleSchema), v.maxLength(RULES.obstacles.maxCount)),
    ),
    treasures: v.pipe(
      v.array(TreasureSchema),
      v.maxLength(RULES.editor.maxTreasures, "Treasure limit reached."),
    ),
  }),
  v.check(
    validObstacles,
    "Check obstacle routes, timing, ranges, and per-kind limits.",
  ),
  v.check(
    objectsFitRoom,
    "Every object, including the full hazard bounds, must fit inside the room.",
  ),
  v.check(hasUniqueIds, "Object ids must be unique."),
  v.check(
    hasClearSpawn,
    "Keep the fixed spawn clear of platforms, hazards, and treasures.",
  ),
);

const LevelSchema = v.pipe(
  EditorLevelSchema,
  v.check(
    (level) => level.treasures.length > 0,
    "Add at least one treasure before testing.",
  ),
);

const TickLimitSchema = v.pipe(
  v.number(),
  v.finite(),
  v.integer(),
  v.minValue(0),
  v.maxValue(Number.MAX_SAFE_INTEGER),
);

const JumpTicksSchema = v.pipe(
  v.array(
    v.pipe(
      v.number(),
      v.finite(),
      v.integer(),
      v.minValue(0),
      v.maxValue(Number.MAX_SAFE_INTEGER - 1),
    ),
  ),
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

// Human recordings may be arbitrarily long; incoming AI recordings must stay
// within the planner's execution budget before the browser simulates them.
const DrillyReplaySchema = v.pipe(
  ReplaySchema,
  v.check(
    (replay) => replay.endTick <= RULES.maxTicks,
    "Drilly recording exceeds its execution budget.",
  ),
);

export function parseLevel(value: unknown): Level {
  return v.parse(LevelSchema, value);
}

export function parseDrillyModel(value: unknown): DrillyModel {
  return v.parse(
    v.picklist(RULES.drilly.models.map((model) => model.id)),
    value,
  );
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

// Previews come from a validated draft and editor presets. Validate just the changed
// object; the complete draft is still validated when the user commits the edit.
export function editorPlacementError(
  level: Level,
  object: EditorObject,
): string | null {
  const bounds =
    object.kind === "obstacle"
      ? obstacleBounds(object.value)
      : object.kind === "saw"
        ? {
            x: object.value.x - object.value.radius,
            y: object.value.y - object.value.radius,
            width: object.value.radius * 2,
            height: object.value.radius * 2,
          }
        : object.value;
  if (roomBorders(level).some((border) => overlaps(bounds, border)))
    return "Keep objects inside the room frame.";
  const key =
    object.kind === "platform"
      ? "platforms"
      : object.kind === "saw"
        ? "traps"
        : object.kind === "treasure"
          ? "treasures"
          : "obstacles";
  const objects = level[key] ?? [];
  const limit =
    object.kind === "platform"
      ? RULES.editor.maxPlatforms
      : object.kind === "saw"
        ? RULES.editor.maxSaws
        : object.kind === "treasure"
          ? RULES.editor.maxTreasures
          : RULES.obstacles.maxCount;
  if (
    objects.length >= limit &&
    !objects.some((item) => item.id === object.value.id)
  )
    return "Object limit reached.";
  if (
    object.kind === "obstacle" &&
    (level.obstacles ?? []).filter(
      (item) => item.id !== object.value.id && item.kind === object.value.kind,
    ).length >= RULES.obstacles.maxPerKind
  )
    return "Obstacle limit reached.";

  try {
    parseEditorLevel(
      {
        ...level,
        platforms: [],
        traps: [],
        treasures: [],
        obstacles: [],
        [key]: [object.value],
      },
      level,
    );
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function parseReplay(
  value: unknown,
  maxTicks = Number.MAX_SAFE_INTEGER,
): Replay {
  return v.parse(
    v.pipe(
      ReplaySchema,
      v.check(
        (replay) => replay.endTick <= maxTicks,
        "Recording exceeds its tick limit.",
      ),
    ),
    value,
  );
}

export function parseJumpTicks(
  value: unknown,
  endTick: number = RULES.maxTicks,
): number[] {
  const limit = v.parse(TickLimitSchema, endTick);
  const schema = v.pipe(
    JumpTicksSchema,
    v.check(
      (ticks) => ticks.every((tick) => tick < limit),
      "Jump ticks must be before endTick.",
    ),
  );

  return v.parse(schema, value);
}

export function parseDrillyInputs(value: unknown): number[] {
  return v.parse(v.strictObject({ jumpTicks: JumpTicksSchema }), value)
    .jumpTicks;
}

function fitsRoom(rect: Rect, level: Level): boolean {
  return (
    rect.width <= level.width - rect.x && rect.height <= level.height - rect.y
  );
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
    collisionPlatforms(level).every((platform) => !overlaps(spawn, platform)) &&
    level.traps.every((trap) => !touchesCircle(spawn, trap)) &&
    level.treasures.every((treasure) => !overlaps(spawn, treasure))
  );
}

function validObstacles(level: Level): boolean {
  const obstacles = level.obstacles ?? [];
  return obstacles.every((o) => {
    if (
      obstacles.filter((other) => other.kind === o.kind).length >
      RULES.obstacles.maxPerKind
    )
      return false;
    if (o.kind === "slider" || o.kind === "drone")
      return Math.hypot(o.endX - o.x, o.endY - o.y) >= RULES.editor.gridSize;
    if (o.kind === "turret")
      return (
        o.warmupTicks + (o.mode === "flame" ? o.activeTicks : 1) <
        o.intervalTicks
      );
    return true;
  });
}

export function parseDrillyBuild(value: unknown, room: Level) {
  const envelope = v.parse(
    v.object({
      level: v.record(v.string(), v.unknown()),
    }),
    value,
  );
  const level = parseEditorLevel(
    v.parse(LevelSchema, {
      id: room.id,
      version: room.version,
      width: room.width,
      height: room.height,
      spawn: room.spawn,
      ...envelope.level,
    }),
    room,
  );
  const hazards = level.traps.length + (level.obstacles?.length ?? 0);
  const interiorPlatforms = level.platforms.filter(
    (platform) => !isFixedRoomPlatform(platform, room),
  );
  if (
    hazards > RULES.drilly.maxGeneratedHazards ||
    level.treasures.length > RULES.drilly.maxGeneratedTreasures ||
    interiorPlatforms.length > RULES.drilly.maxGeneratedPlatforms
  )
    throw new Error("Generated room exceeds its object limits.");

  if (
    level.treasures.some(
      (treasure) =>
        treasure.x < RULES.roomBorderWidth ||
        treasure.x + treasure.width > room.width - RULES.roomBorderWidth,
    )
  )
    throw new Error("Keep treasure inside the side walls.");

  const floor = room.platforms.filter(
    (platform) =>
      platform.id === "floor" && isFixedRoomPlatform(platform, room),
  );
  return parseEditorLevel(
    { ...level, platforms: [...floor, ...interiorPlatforms] },
    room,
  );
}

// Accept a recorded prefix; the session owns completion and scoring.
export function parseDrillyAttempts(value: unknown, level: Level) {
  const attempts = v.parse(
    v.pipe(
      v.array(
        v.object({
          replay: DrillyReplaySchema,
          outcome: v.picklist(["won", "dead", "tick-limit"]),
        }),
      ),
      v.maxLength(RULES.raidAttempts),
    ),
    value,
  );
  const expectedLevel = JSON.stringify(parseLevel(level));
  for (const [index, attempt] of attempts.entries()) {
    if (JSON.stringify(attempt.replay.level) !== expectedLevel)
      throw new Error("Drilly recording belongs to another room.");
    if (attempt.outcome === "won" && index !== attempts.length - 1)
      throw new Error("Drilly must stop after its first clear.");
    if (
      attempt.outcome === "tick-limit" &&
      attempt.replay.endTick !== RULES.maxTicks
    )
      throw new Error("A timed-out attempt must reach the game tick limit.");
  }
  return attempts;
}
