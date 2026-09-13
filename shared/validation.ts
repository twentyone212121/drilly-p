import type { BuildBudget } from "./game/drilly";
import { obstacleBounds } from "./game/obstacles";
import { segmentRect, sweptCircle } from "./game/sweep";
import * as v from "valibot";
import { overlaps, touchesCircle } from "./game/collision";
import { RULES } from "./game/rules";
import { isRoomSideWall, roomSideWalls } from "./game/roomBoundary";
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
  }),
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
  v.maxValue(RULES.maxTicks),
);

const JumpTicksSchema = v.pipe(
  v.array(
    v.pipe(
      v.number(),
      v.finite(),
      v.integer(),
      v.minValue(0),
      v.maxValue(RULES.maxTicks - 1),
    ),
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

// Previews come from a validated draft and editor presets. Validate just the changed
// object; the complete draft is still validated when the user commits the edit.
export function editorPlacementError(level: Level, object: EditorObject): string | null {
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
  if (objects.length >= limit && !objects.some((item) => item.id === object.value.id))
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

export function parseReplay(value: unknown): Replay {
  return v.parse(ReplaySchema, value);
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
    level.platforms.every((platform) => !overlaps(spawn, platform)) &&
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
    if (o.kind === "pursuer") return o.chaseRange >= o.detectionRange;
    return true;
  });
}

export function parseDrillyBuild(
  value: unknown,
  room: Level,
  budget?: BuildBudget,
) {
  const envelope = v.parse(
    v.object({
      level: v.record(v.string(), v.unknown()),
    }),
    value,
  );
  const level = parseEditorLevel(
    v.parse(LevelSchema, {
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
    (platform) => !isRoomSideWall(platform, room),
  );
  if (
    hazards > RULES.drilly.maxGeneratedHazards ||
    level.treasures.length > RULES.drilly.maxGeneratedTreasures ||
    interiorPlatforms.length > RULES.drilly.maxGeneratedPlatforms ||
    (budget &&
      (hazards > budget.hazards ||
        level.treasures.length > budget.treasures ||
        interiorPlatforms.length > budget.platforms))
  )
    throw new Error(
      "Generated room exceeds its introductory difficulty budget.",
    );
  const walls = roomSideWalls(room);
  if (
    level.treasures.some((treasure) =>
      walls.some((wall) => overlaps(treasure, wall)),
    )
  )
    throw new Error("Keep treasure inside the side walls.");

  // Add boundaries before either proof or LLM practice. Revalidating also catches
  // reserved-ID collisions; repeated parsing must never duplicate the walls.
  return parseEditorLevel(
    { ...level, platforms: [...interiorPlatforms, ...walls] },
    room,
  );
}

export function parseDrillyAttempts(value: unknown, level: Level) {
  const attempts = v.parse(
    v.pipe(
      v.array(
        v.object({
          replay: ReplaySchema,
          outcome: v.picklist(["won", "dead", "tick-limit"]),
        }),
      ),
      v.minLength(1),
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
  }
  if (
    attempts[attempts.length - 1]?.outcome !== "won" &&
    attempts.length !== RULES.raidAttempts
  )
    throw new Error("Drilly has not finished its attempts.");
  return attempts;
}

export function parseDrillyStrategy(value: unknown, level: Level) {
  const strategy = v.parse(
    v.object({
      objective: v.pipe(v.string(), v.minLength(1), v.maxLength(240)),
      route: v.pipe(
        v.array(
          v.object({
            kind: v.picklist(["treasure", "platform", "wall"]),
            id: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
          }),
        ),
        v.minLength(1),
        v.maxLength(RULES.drilly.maxRouteWaypoints),
      ),
    }),
    value,
  );
  for (const target of strategy.route) {
    const objects =
      target.kind === "treasure" ? level.treasures : level.platforms;
    if (!objects.some((object) => object.id === target.id))
      throw new Error("Unknown route target.");
  }
  if (
    !level.treasures.every((treasure) =>
      strategy.route.some(
        (target) => target.kind === "treasure" && target.id === treasure.id,
      ),
    )
  )
    throw new Error("The route must include every treasure.");
  return strategy;
}

export function parseDrillyEdit(value: unknown) {
  return v.parse(
    v.object({
      action: v.picklist(["edit", "finish"]),
      base: v.picklist(["working", "checkpoint"]),
      name: NameSchema,
      idea: v.pipe(v.string(), v.minLength(1), v.maxLength(240)),
      strategy: v.unknown(),
      removeIds: v.pipe(v.array(NameSchema), v.maxLength(24)),
      edit: v.object({
        platforms: v.pipe(
          v.array(PlatformSchema),
          v.maxLength(RULES.drilly.maxGeneratedPlatforms),
        ),
        traps: v.pipe(
          v.array(TrapSchema),
          v.maxLength(RULES.drilly.maxGeneratedHazards),
        ),
        treasures: v.pipe(
          v.array(TreasureSchema),
          v.maxLength(RULES.drilly.maxGeneratedTreasures),
        ),
        obstacles: v.pipe(
          v.array(ObstacleSchema),
          v.maxLength(RULES.drilly.maxGeneratedHazards),
        ),
      }),
    }),
    value,
  );
}

export function parseBuiltDungeon(value: unknown) {
  const built = v.parse(
    v.object({ level: LevelSchema, proof: ReplaySchema }),
    value,
  );
  if (JSON.stringify(built.level) !== JSON.stringify(built.proof.level))
    throw new Error("Room proof belongs to different geometry.");
  return built;
}
