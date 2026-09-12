import * as v from "valibot";
import { overlaps } from "./game/collision";
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

const PlatformSchema = v.object({ ...RectSchema.entries, id: NameSchema });

const TrapSchema = v.object({
  id: NameSchema,
  x: CoordinateSchema,
  y: CoordinateSchema,
  radius: v.pipe(v.number(), v.finite(), v.minValue(4), v.maxValue(100)),
});

const SpawnSchema = v.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
  direction: v.union([v.literal(-1), v.literal(1)]),
});

const LevelSchema = v.pipe(
  v.object({
    version: v.literal(1),
    id: NameSchema,
    name: NameSchema,
    width: RoomSizeSchema,
    height: RoomSizeSchema,
    spawn: SpawnSchema,
    platforms: v.pipe(v.array(PlatformSchema), v.maxLength(64)),
    traps: v.pipe(v.array(TrapSchema), v.maxLength(16)),
    treasure: RectSchema,
  }),
  v.check(objectsFitRoom, "Platforms, treasure, spawn, and trap centers must fit inside the room."),
  v.check(hasUniqueIds, "Object ids must be unique."),
  v.check(hasClearSpawn, "Spawn overlaps a platform."),
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
    version: v.literal(1),
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
    level.platforms.every((platform) => fitsRoom(platform, level)) &&
    fitsRoom(level.treasure, level) &&
    fitsRoom(spawnBounds(level), level) &&
    level.traps.every((trap) => trap.x <= level.width && trap.y <= level.height)
  );
}

function hasUniqueIds(level: Level): boolean {
  const ids = [...level.platforms, ...level.traps].map((item) => item.id);

  return new Set(ids).size === ids.length;
}

function hasClearSpawn(level: Level): boolean {
  const spawn = spawnBounds(level);

  return level.platforms.every((platform) => !overlaps(spawn, platform));
}
