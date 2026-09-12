import { describe, expect, it } from "vitest";
import checkpoint from "../../public/levels/checkpoint.json";
import { RULES } from "../../shared/game/rules";
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
    expect(placementError(level, resizePlatform(left, { x: 80, y: 0 }))).toContain("spawn");
    expect(placementError(level, resizePlatform(left, { x: 1000, y: 0 }))).toContain("room");
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

  it.each(kinds)("validates %s preview and commit at the same boundary", (kind) => {
    const object = newObject(level, kind, { x: 904, y: 96 });
    expect(placementError(level, object)).toContain("room");
    expect(() => applyEdit(level, { type: "put", object })).toThrow("room");
    const atSpawn = newObject(level, kind, level.spawn);
    expect(placementError(level, atSpawn)).toContain("spawn");
    expect(() => applyEdit(level, { type: "put", object: atSpawn })).toThrow("spawn");
  });

  it.each([
    {
      kind: "platform" as const,
      limit: RULES.editor.maxPlatforms,
      existing: level.platforms.length,
    },
    {
      kind: "saw" as const,
      limit: RULES.editor.maxSaws,
      existing: level.traps.length,
    },
    {
      kind: "treasure" as const,
      limit: RULES.editor.maxTreasures,
      existing: level.treasures.length,
    },
  ])(
    "enforces the tunable $kind limit while allowing existing objects to move",
    ({ kind, limit, existing }) => {
      let draft = level;
      let object = newObject(draft, kind, { x: 200, y: 96 });
      for (let i = existing; i < limit; i++) {
        object = newObject(draft, kind, { x: 200, y: 96 });
        draft = applyEdit(draft, { type: "put", object });
      }

      expect(placementError(draft, newObject(draft, kind, { x: 200, y: 96 }))).toContain("limit");
      expect(placementError(draft, moveObject(object, { x: 8, y: 0 }))).toBeNull();
    },
  );

  it("selects the topmost overlapping object and permits intentional overlap away from spawn", () => {
    const platform = newObject(level, "platform", { x: 200, y: 96 });
    const withPlatform = applyEdit(level, { type: "put", object: platform });
    const treasure = newObject(withPlatform, "treasure", { x: 200, y: 96 });
    const draft = applyEdit(withPlatform, { type: "put", object: treasure });
    expect(hitObject(draft, { x: 208, y: 104 })).toEqual(treasure);
  });
});
