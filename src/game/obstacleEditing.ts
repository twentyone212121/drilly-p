import type { Patrol } from "../../shared/game/obstacleTypes";
import { roomBorders } from "../../shared/game/roomBoundary";
import type { Level, Rect } from "../../shared/game/types";
import { objectBounds, type EditorObject } from "./editor";

export function fitObjectToRoom(
  object: EditorObject,
  level: Level,
  options: { preservePatrolStart?: boolean } = {},
): EditorObject {
  const [left, right, ceiling, floor] = roomBorders(level);
  const result = structuredClone(object);

  if (
    result.kind === "obstacle" &&
    (result.value.kind === "drone" || result.value.kind === "slider")
  ) {
    const o = result.value;
    fitPatrolToRoom(
      o,
      {
        x: left.width + o.radius,
        y: ceiling.height + o.radius,
        width: right.x - left.width - o.radius * 2,
        height: floor.y - ceiling.height - o.radius * 2,
      },
      options.preservePatrolStart ?? false,
    );
    return result;
  }

  const bounds = objectBounds(object);
  const x = Math.max(left.width, Math.min(right.x - bounds.width, bounds.x));
  const y = Math.max(
    ceiling.height,
    Math.min(floor.y - bounds.height, bounds.y),
  );
  result.value.x += x - bounds.x;
  result.value.y += y - bounds.y;
  return result;
}

function fitPatrolToRoom(o: Patrol, bounds: Rect, preserveStart: boolean) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  // The endpoint handle changes length without moving the drone's start.
  if (preserveStart) {
    o.endX = Math.max(bounds.x, Math.min(right, o.endX));
    o.endY = Math.max(bounds.y, Math.min(bottom, o.endY));
    return;
  }

  const dx = o.endX - o.x;
  const dy = o.endY - o.y;
  const scale = Math.min(
    1,
    dx === 0 ? 1 : bounds.width / Math.abs(dx),
    dy === 0 ? 1 : bounds.height / Math.abs(dy),
  );
  const routeX = dx * scale;
  const routeY = dy * scale;

  // Fit both endpoints together, preserving direction and all length that fits.
  o.x = Math.max(
    bounds.x - Math.min(0, routeX),
    Math.min(right - Math.max(0, routeX), o.x),
  );
  o.y = Math.max(
    bounds.y - Math.min(0, routeY),
    Math.min(bottom - Math.max(0, routeY), o.y),
  );
  o.endX = o.x + routeX;
  o.endY = o.y + routeY;
}

export function rotateObstacle(
  object: EditorObject,
  level: Level,
): EditorObject {
  if (object.kind !== "obstacle") return object;
  const result = structuredClone(object);
  const o = result.value;
  if (o.kind === "turret") {
    o.axis = "x";
    o.direction = o.direction === 1 ? -1 : 1;
  } else if (o.kind === "spikes") {
    o.rotation = (((o.rotation ?? 0) + 1) % 4) as 0 | 1 | 2 | 3;
    o.x += (o.width - o.height) / 2;
    o.y += (o.height - o.width) / 2;
    [o.width, o.height] = [o.height, o.width];
  } else if (o.kind === "drone") {
    const dx = o.endX - o.x,
      dy = o.endY - o.y;
    const vertical = Math.abs(dy) > Math.abs(dx);
    const length = Math.hypot(dx, dy);
    const direction = Math.sign(vertical ? dy : dx) || 1;
    o.endX = o.x + (vertical ? -direction * length : 0);
    o.endY = o.y + (vertical ? 0 : direction * length);
  }
  return fitObjectToRoom(result, level);
}
