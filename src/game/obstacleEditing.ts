import { RULES } from "../../shared/game/rules";
import { roomBorders } from "../../shared/game/roomBoundary";
import type { Level } from "../../shared/game/types";
import { objectBounds, type EditorObject } from "./editor";

export function fitObjectToRoom(
  object: EditorObject,
  level: Level,
): EditorObject {
  const [left, right, ceiling, floor] = roomBorders(level);
  const bounds = objectBounds(object);
  const x = Math.max(left.width, Math.min(right.x - bounds.width, bounds.x));
  const y = Math.max(
    ceiling.height,
    Math.min(floor.y - bounds.height, bounds.y),
  );
  const dx = x - bounds.x,
    dy = y - bounds.y;
  const result = structuredClone(object);
  result.value.x += dx;
  result.value.y += dy;
  if (
    result.kind === "obstacle" &&
    (result.value.kind === "drone" || result.value.kind === "slider")
  ) {
    const o = result.value;
    o.endX = Math.max(
      left.width + o.radius,
      Math.min(right.x - o.radius, o.endX + dx),
    );
    o.endY = Math.max(
      ceiling.height + o.radius,
      Math.min(floor.y - o.radius, o.endY + dy),
    );
    if (Math.hypot(o.endX - o.x, o.endY - o.y) < RULES.editor.gridSize) {
      const original =
        object.kind === "obstacle" &&
        (object.value.kind === "drone" || object.value.kind === "slider")
          ? object.value
          : o;
      if (
        Math.abs(original.endY - original.y) >
        Math.abs(original.endX - original.x)
      )
        o.endY =
          o.y < (ceiling.height + floor.y) / 2
            ? Math.min(floor.y - o.radius, o.y + RULES.obstacles.pathLength)
            : Math.max(
                ceiling.height + o.radius,
                o.y - RULES.obstacles.pathLength,
              );
      else
        o.endX =
          o.x < (left.width + right.x) / 2
            ? Math.min(right.x - o.radius, o.x + RULES.obstacles.pathLength)
            : Math.max(left.width + o.radius, o.x - RULES.obstacles.pathLength);
    }
  }
  return result;
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
