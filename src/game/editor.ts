import { RULES } from "../../shared/game/rules";
import type { Level, Platform, Rect, Saw, Treasure } from "../../shared/game/types";
import { parseEditorLevel } from "../../shared/validation";

export type EditorObject =
  | { kind: "platform"; value: Platform }
  | { kind: "saw"; value: Saw }
  | { kind: "treasure"; value: Treasure };

export type ObjectKind = EditorObject["kind"];
export type Selection = { kind: ObjectKind; id: string };
export type Point = { x: number; y: number };
export type Edit = { type: "put"; object: EditorObject } | { type: "delete"; selection: Selection };

export function editorObjects(level: Level): EditorObject[] {
  return [
    ...level.platforms.map((value): EditorObject => ({
      kind: "platform",
      value,
    })),
    ...level.traps.map((value): EditorObject => ({ kind: "saw", value })),
    ...level.treasures.map((value): EditorObject => ({
      kind: "treasure",
      value,
    })),
  ];
}

export function findObject(level: Level, selection: Selection | null) {
  return editorObjects(level).find(
    (object) => object.kind === selection?.kind && object.value.id === selection.id,
  );
}

export function objectBounds(object: EditorObject): Rect {
  const value = object.value;
  if (object.kind !== "saw") {
    return {
      x: value.x,
      y: value.y,
      width: object.value.width,
      height: object.value.height,
    };
  }

  const radius = object.value.radius;
  return {
    x: value.x - radius,
    y: value.y - radius,
    width: radius * 2,
    height: radius * 2,
  };
}

export function hitObject(level: Level, point: Point): EditorObject | undefined {
  return editorObjects(level)
    .reverse()
    .find((object) => {
      if (object.kind === "saw") {
        return (
          Math.hypot(point.x - object.value.x, point.y - object.value.y) <= object.value.radius
        );
      }

      const bounds = objectBounds(object);
      return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
    });
}

export function snap(value: number): number {
  return Math.round(value / RULES.editor.gridSize) * RULES.editor.gridSize;
}

export function newObject(level: Level, kind: ObjectKind, point: Point): EditorObject {
  const ids = new Set(editorObjects(level).map((object) => object.value.id));
  let serial = 1;
  while (ids.has(`${kind}-${serial}`)) serial++;

  const position = {
    id: `${kind}-${serial}`,
    x: snap(point.x),
    y: snap(point.y),
  };
  const rules = RULES.editor;

  switch (kind) {
    case "platform":
      return {
        kind,
        value: {
          ...position,
          width: rules.platformWidth,
          height: rules.platformHeight,
        },
      };
    case "saw":
      return { kind, value: { ...position, radius: rules.sawRadius } };
    case "treasure":
      return {
        kind,
        value: {
          ...position,
          width: rules.treasureWidth,
          height: rules.treasureHeight,
        },
      };
  }
}

export function moveObject(object: EditorObject, delta: Point): EditorObject {
  // A click or sub-grid drag must leave off-grid starter geometry unchanged.
  if (snap(delta.x) === 0 && snap(delta.y) === 0) return object;

  return {
    ...object,
    value: {
      ...object.value,
      x: snap(delta.x) === 0 ? object.value.x : snap(object.value.x + delta.x),
      y: snap(delta.y) === 0 ? object.value.y : snap(object.value.y + delta.y),
    },
  } as EditorObject;
}

export function resizePlatform(object: EditorObject, delta: Point): EditorObject {
  if (object.kind !== "platform" || (snap(delta.x) === 0 && snap(delta.y) === 0)) return object;

  return {
    kind: "platform",
    value: {
      ...object.value,
      width:
        snap(delta.x) === 0
          ? object.value.width
          : Math.max(RULES.editor.minPlatformSize, snap(object.value.width + delta.x)),
      height:
        snap(delta.y) === 0
          ? object.value.height
          : Math.max(RULES.editor.minPlatformSize, snap(object.value.height + delta.y)),
    },
  };
}

export function applyEdit(level: Level, edit: Edit): Level {
  const candidate = structuredClone(level);

  if (edit.type === "put") {
    const object = edit.object;
    if (object.kind === "platform") putObject(candidate.platforms, object.value);
    if (object.kind === "saw") putObject(candidate.traps, object.value);
    if (object.kind === "treasure") putObject(candidate.treasures, object.value);
  } else {
    const { kind, id } = edit.selection;
    if (kind === "platform")
      candidate.platforms = candidate.platforms.filter((item) => item.id !== id);
    if (kind === "saw") candidate.traps = candidate.traps.filter((item) => item.id !== id);
    if (kind === "treasure")
      candidate.treasures = candidate.treasures.filter((item) => item.id !== id);
  }

  return parseEditorLevel(candidate, level);
}

function putObject<T extends { id: string }>(objects: T[], value: T) {
  // Replacing in place preserves collision and collection order in replays.
  const index = objects.findIndex((object) => object.id === value.id);
  if (index === -1) objects.push(value);
  else objects[index] = value;
}

export function placementError(level: Level, object: EditorObject): string | null {
  try {
    applyEdit(level, { type: "put", object });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
