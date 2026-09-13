import { describe, expect, it } from "vitest";
import { getDungeon } from "../../shared/game/campaign";
import { similarRooms } from "./variety";

describe("room variety", () => {
  it("rejects cosmetic renames, reordered objects, and small coordinate shifts", () => {
    const original = getDungeon("first-vault");
    const changed = structuredClone(original);
    changed.id = "new-id";
    changed.name = "A completely new name";
    changed.traps = changed.traps
      .reverse()
      .map((trap, i) => ({ ...trap, id: `new-${i}`, x: trap.x + 24 }));
    changed.platforms.reverse();
    expect(similarRooms(original, changed)).toBe(true);
    expect(similarRooms(changed, original)).toBe(true);
  });

  it("ignores seams from splitting a floor into adjacent tiles", () => {
    const original = getDungeon("first-vault");
    const changed = structuredClone(original);
    const floor = changed.platforms.find((p) => p.width > 400)!;
    const width = floor.width / 2;
    floor.width = width;
    changed.platforms.push({ ...floor, id: "extra-tile", x: floor.x + width });
    expect(similarRooms(original, changed)).toBe(true);
  });

  it("accepts substantial changes to elevation, treasure journey, or hazard behavior", () => {
    const original = getDungeon("first-vault");
    const elevation = structuredClone(original);
    elevation.platforms.push({
      id: "ledge",
      x: 400,
      y: 320,
      width: 160,
      height: 24,
    });
    const treasure = structuredClone(original);
    treasure.treasures[0].x = 120;
    const behavior = structuredClone(original);
    behavior.traps = [];
    behavior.obstacles = original.traps.map((t) => ({
      ...t,
      kind: "slider",
      endX: t.x + 120,
      endY: t.y,
      speed: 60,
    }));
    for (const changed of [elevation, treasure, behavior])
      expect(similarRooms(original, changed)).toBe(false);
  });

  it("rejects the same staircase idea even when its spacing changes substantially", () => {
    const original = getDungeon("first-vault");
    original.platforms = [
      { id: "floor", x: 0, y: 420, width: 240, height: 24 },
      { id: "step", x: 280, y: 372, width: 180, height: 24 },
      { id: "upper", x: 520, y: 324, width: 180, height: 24 },
    ];
    original.treasures = [{ id: "t", x: 600, y: 292, width: 32, height: 32 }];
    const shifted = structuredClone(original);
    shifted.platforms[0].width += 120;
    shifted.platforms[1].x += 140;
    shifted.platforms[2].x += 140;
    shifted.treasures[0].x += 100;
    expect(similarRooms(original, shifted)).toBe(true);
  });
});
