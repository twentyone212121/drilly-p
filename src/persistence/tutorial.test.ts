import { afterEach, expect, it, vi } from "vitest";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import { createSession } from "../game/session";
import { loadTutorialCompleted, saveTutorialCompleted } from "./tutorial";

afterEach(() => vi.unstubAllGlobals());

function newSession() {
  return createSession({
    prisonLevel: newPlayerDungeon(),
    tutorialCompleted: loadTutorialCompleted(),
    onTutorialCompleted: saveTutorialCompleted,
  });
}

it("remembers a real escape and starts later sessions in the editor", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const session = newSession();
  expect(loadTutorialCompleted()).toBe(false);
  session.step(RULES.maxTicks);
  expect(loadTutorialCompleted()).toBe(true);
  expect(newSession().getSnapshot().canPlay).toBe(false);
});

it("keeps the current game playable when reading or writing storage fails", () => {
  const unavailable = () => {
    throw new Error("Storage blocked");
  };
  vi.stubGlobal("localStorage", { getItem: unavailable, setItem: unavailable });
  const session = newSession();
  session.step(RULES.maxTicks);
  session.primaryAction();
  expect(session.getSnapshot()).toMatchObject({
    canPlay: false,
    tutorialCompleted: true,
  });
  expect(newSession().getSnapshot().tutorialCompleted).toBe(false);
});
