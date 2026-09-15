import { afterEach, expect, it, vi } from "vitest";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import { createSession } from "../game/session";
import {
  loadDungeon,
  loadDungeonClear,
  loadModel,
  persistDungeon,
} from "./dungeon";

afterEach(() => vi.unstubAllGlobals());

it("restores edited and unfinished rooms, saving only when the draft changes", () => {
  const values = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem,
  });
  const room = newPlayerDungeon();
  room.traps.push({ id: "custom-saw", x: 200, y: 96, radius: 18 });
  const session = createSession({ tutorialCompleted: true, editorLevel: room });
  const stopSaving = persistDungeon(session);
  expect(loadDungeon()).toEqual(room);

  session.testDungeon();
  session.step(RULES.maxTicks);
  session.pause();
  const restoredClear = loadDungeonClear();
  const reload = () =>
    createSession({
      tutorialCompleted: true,
      editorLevel: loadDungeon(),
      playerClear: loadDungeonClear(),
      drilly: { build: vi.fn(), raid: vi.fn() },
    });
  const cleared = reload();
  expect(cleared.getSnapshot().cleared).toBe(true);
  cleared.challengeDrilly();
  expect(cleared.getSnapshot().phase).toBe("raid");

  values.set(
    "drilly-p.dungeon-clear",
    JSON.stringify({ ...(restoredClear as object), rulesVersion: "old" }),
  );
  expect(reload().getSnapshot().cleared).toBe(false);
  values.set(
    "drilly-p.dungeon-clear",
    JSON.stringify({ ...(restoredClear as object), endTick: 0 }),
  );
  expect(reload().getSnapshot().cleared).toBe(false);
  values.set("drilly-p.dungeon-clear", JSON.stringify(restoredClear));

  session.editDungeon();
  session.setModel("gpt-5.6-sol");
  session.edit({
    type: "delete",
    selection: { kind: "treasure", id: room.treasures[0].id },
  });
  const restored = createSession({
    tutorialCompleted: true,
    editorLevel: loadDungeon(),
    playerClear: restoredClear,
    model: loadModel(),
  });
  expect(restored.getSnapshot().model).toBe("gpt-5.6-sol");
  expect(restored.getSnapshot().editorLevel).toEqual(
    session.getSnapshot().editorLevel,
  );
  expect(restored.getSnapshot().editorLevel.treasures).toHaveLength(0);
  expect(restored.getSnapshot().cleared).toBe(false);
  expect(loadDungeonClear()).toBeNull();
  values.set("drilly-p.model", "unsupported-model");
  expect(loadModel()).toBe(RULES.drilly.defaultModel);
  stopSaving();
});

it("opens safely with invalid saved data or unavailable storage and keeps edits playable", () => {
  const unavailable = () => {
    throw new Error("Storage blocked");
  };
  vi.stubGlobal("localStorage", {
    getItem: vi
      .fn()
      .mockReturnValueOnce("not JSON")
      .mockReturnValueOnce(JSON.stringify({ ...newPlayerDungeon(), width: 1 }))
      .mockImplementation(unavailable),
    setItem: unavailable,
  });
  expect(loadDungeon()).toBeUndefined();
  expect(loadDungeon()).toBeUndefined();
  expect(loadModel()).toBe(RULES.drilly.defaultModel);
  const session = createSession({
    tutorialCompleted: true,
    editorLevel: loadDungeon(),
  });
  const stopSaving = persistDungeon(session);
  const room = session.getSnapshot().editorLevel;
  session.edit({
    type: "delete",
    selection: { kind: "treasure", id: room.treasures[0].id },
  });
  expect(session.getSnapshot().editorLevel.treasures).toHaveLength(0);
  stopSaving();
});
