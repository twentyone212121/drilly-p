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
