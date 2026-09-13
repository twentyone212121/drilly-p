import { describe, expect, it } from "vitest";
import checkpoint from "../../shared/levels/checkpoint.json";
import { parseLevel } from "../../shared/validation";
import {
  applyEdit,
  hitObject,
  moveObject,
  newObject,
  placementError,
  resizePlatform,
  type EditorObject,
  type ObjectKind,
} from "./editor";

const level = parseLevel(checkpoint);
const kinds: ObjectKind[] = ["platform", "saw", "treasure"];

describe("editor geometry and placement", () => {
  it.each(kinds)("adds, moves, and deletes a %s without mutating the source", (kind) => {
    const before = structuredClone(level);
    const object = newObject(level, kind, { x: 201, y: 97 });
    expect(object.value).toMatchObject({ x: 200, y: 96 });

    const added = applyEdit(level, { type: "put", object });
    expect(hitObject(added, { x: 200, y: 96 })).toEqual(object);
    const moved = moveObject(object, { x: 17, y: 9 });
    const updated = applyEdit(added, { type: "put", object: moved });
    expect(hitObject(updated, { x: 216, y: 104 })).toEqual(moved);
    expect(
      applyEdit(updated, {
        type: "delete",
        selection: { kind, id: object.value.id },
      }),
    ).toEqual(level);
    expect(level).toEqual(before);
  });

  it("preserves off-grid geometry on click and collision ordering on updates", () => {
    const object: EditorObject = {
      kind: "platform",
      value: level.platforms[3],
    };
    expect(
      applyEdit(level, {
        type: "put",
        object: moveObject(object, { x: 1, y: 1 }),
      }),
    ).toEqual(level);
    expect(
      applyEdit(level, {
        type: "put",
        object: resizePlatform(object, { x: 0, y: 0 }),
      }),
    ).toEqual(level);
    const updated = applyEdit(level, {
      type: "put",
      object: resizePlatform(object, { x: 12, y: 8 }),
    });
    expect(updated.platforms.map((item) => item.id)).toEqual(
      level.platforms.map((item) => item.id),
    );
    expect(updated.platforms[3]).toMatchObject({ width: 272, height: 24 });
  });

  it("rejects a platform resize through the spawn or beyond the room", () => {
    const left: EditorObject = { kind: "platform", value: level.platforms[1] };
    expect(placementError(level, resizePlatform(left, { x: 80, y: 0 }))).not.toBeNull();
    expect(placementError(level, resizePlatform(left, { x: 1000, y: 0 }))).not.toBeNull();
  });

  it("preserves the untouched axis of off-grid starter geometry", () => {
    const object: EditorObject = {
      kind: "platform",
      value: level.platforms[3],
    };
    expect(moveObject(object, { x: 8, y: 0 }).value.y).toBe(object.value.y);
    expect(resizePlatform(object, { x: 8, y: 0 }).value).toMatchObject({
      height: object.value.height,
    });
  });

  it("selects the topmost overlapping object and permits intentional overlap away from spawn", () => {
    const platform = newObject(level, "platform", { x: 200, y: 96 });
    const withPlatform = applyEdit(level, { type: "put", object: platform });
    const treasure = newObject(withPlatform, "treasure", { x: 200, y: 96 });
    const draft = applyEdit(withPlatform, { type: "put", object: treasure });
    expect(hitObject(draft, { x: 208, y: 104 })).toEqual(treasure);
  });
});
