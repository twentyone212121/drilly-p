import { spikeParts } from "./spikes";
import { RULES } from "./rules";
import type { Level, Platform, Rect } from "./types";

// Ordinary collision platforms, included in the room before proof or playback.
export function roomSideWalls(
  room: Pick<Level, "width" | "height">,
): Platform[] {
  const width = RULES.drilly.sideWallWidth;
  return [
    { id: "boundary-left", x: 0, y: 0, width, height: room.height },
    {
      id: "boundary-right",
      x: room.width - width,
      y: 0,
      width,
      height: room.height,
    },
  ];
}

export function isRoomSideWall(
  platform: Rect,
  room: Pick<Level, "width" | "height">,
): boolean {
  return roomSideWalls(room).some(
    (wall) =>
      platform.x === wall.x &&
      platform.y === wall.y &&
      platform.width === wall.width &&
      platform.height === wall.height,
  );
}

// Recognize the original template's perimeter as well as normalized side walls.
// Interior platforms remain editable, even when named similarly.
export function isFixedRoomPlatform(
  platform: Platform,
  room: Pick<Level, "width" | "height">,
) {
  if (isRoomSideWall(platform, room)) return true;
  const legacySide =
    platform.y === 0 &&
    platform.height === room.height &&
    platform.width === 24 &&
    (platform.x === 0 || platform.x === room.width - 24);
  if (legacySide) return true;
  const floor =
    platform.id === "floor" &&
    platform.y === room.height - 60 &&
    platform.width >= room.width - 48;
  const side =
    ((platform.id === "left-wall" && platform.x === 12) ||
      (platform.id === "right-wall" && platform.x === room.width - 36)) &&
    platform.y === 24 &&
    platform.width === 24 &&
    platform.height === room.height - 48;
  return floor || side;
}

/** The shell is part of the rules, so imports and replays cannot omit or delete it. */
export function roomBorders(room: Level): Platform[] {
  const thickness = RULES.roomBorderWidth;
  const left = thickness,
    right = thickness;
  let bottom = thickness;
  for (const platform of room.platforms) {
    if (!isFixedRoomPlatform(platform, room)) continue;
    if (platform.id === "floor") bottom = room.height - platform.y;
  }
  return [
    { id: "room-frame-left", x: 0, y: 0, width: left, height: room.height },
    {
      id: "room-frame-right",
      x: room.width - right,
      y: 0,
      width: right,
      height: room.height,
    },
    {
      id: "room-frame-ceiling",
      x: left,
      y: 0,
      width: room.width - left - right,
      height: thickness,
    },
    {
      id: "room-frame-floor",
      x: left,
      y: room.height - bottom,
      width: room.width - left - right,
      height: bottom,
    },
  ];
}

export function collisionPlatforms(room: Level): Platform[] {
  return [
    ...room.platforms.filter(
      (platform) =>
        !isFixedRoomPlatform(platform, room) || platform.id === "floor",
    ),
    ...roomBorders(room),
    ...(room.obstacles ?? []).flatMap((o) =>
      o.kind === "spikes"
        ? [{ id: `spike-base-${o.id}`, ...spikeParts(o).base }]
        : [],
    ),
  ];
}
