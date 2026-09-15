import { afterEach, expect, it, vi } from "vitest";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { runAttempt } from "../../shared/game/replay";
import { RULES } from "../../shared/game/rules";
import type { DrillySource } from "../../shared/game/drilly";
import { runDrillyFixture } from "../../shared/testing/drilly";
import { createSession } from "../game/session";
import { loadAudio, loadSession, persistSession, saveAudio } from "./session";

const room = newPlayerDungeon();
const clear = {
  version: 2,
  rulesVersion: RULES.version,
  level: room,
  jumpTicks: [],
  endTick: runAttempt(room, []).state.tick,
};
const source: DrillySource = {
  build: async () => room,
  raid: async () => runDrillyFixture(room)[0],
};
function session(savedSession?: unknown, drilly = source) {
  return createSession({
    tutorialCompleted: true,
    editorLevel: room,
    playerClear: clear,
    drilly,
    savedSession,
  });
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function saved(current: ReturnType<typeof session>) {
  return JSON.parse(JSON.stringify(current.exportSession())) as unknown;
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("restores human and replay positions paused, with scores awarded only once", async () => {
  const first = session();
  first.challengeDrilly();
  await flush();
  first.step(20);
  first.setGhostVisible(false);
  const resumed = session(saved(first));
  expect(resumed.frameState()).toEqual(first.frameState());
  expect(resumed.getSnapshot()).toMatchObject({
    phase: "raid",
    paused: true,
    livesRemaining: 3,
    showGhost: false,
  });
  resumed.reset();
  const afterRestart = session(saved(resumed));
  expect(afterRestart.getSnapshot().livesRemaining).toBe(2);
  afterRestart.step(RULES.maxTicks);
  expect(afterRestart.getSnapshot().phase).toBe("results");
  const result = session(saved(afterRestart));
  const scores = result.getSnapshot().scoreboard;
  expect(scores.rounds).toBe(1);
  result.replayDrilly();
  result.step(30);
  const replay = session(saved(result));
  expect(replay.frameState()).toEqual(result.frameState());
  expect(replay.getSnapshot()).toMatchObject({
    mode: "replay",
    paused: true,
    watchIndex: 0,
  });
  replay.step(RULES.maxTicks);
  expect(replay.getSnapshot().watchIdle).toBe(true);
  expect(replay.getSnapshot().scoreboard).toEqual(scores);
});

it("resumes pending Drilly work using saved attempts and preserves scores if play data is damaged", async () => {
  const waiting = session(undefined, {
    ...source,
    raid: () => new Promise<never>(() => {}),
  });
  waiting.challengeDrilly();
  await flush();
  waiting.step(RULES.maxTicks);
  expect(waiting.getSnapshot().waitingForDrilly).toBe(true);
  const raid = vi.fn((...args: Parameters<DrillySource["raid"]>) =>
    source.raid(...args),
  );
  const restored = session(saved(waiting), { ...source, raid });
  restored.resumeSavedWork();
  restored.resumeSavedWork();
  await flush();
  expect(raid).toHaveBeenCalledTimes(1);
  expect(restored.getSnapshot().phase).toBe("results");
  const data = restored.exportSession();
  const broken = session({
    ...data,
    play: {
      ...data.play,
      attempt: { ...data.play.attempt, rulesVersion: "old" },
    },
  });
  expect(broken.getSnapshot().phase).toBe("build");
  expect(broken.getSnapshot().scoreboard).toEqual(
    restored.getSnapshot().scoreboard,
  );
});

it("flushes browser saves on page exit and tolerates invalid settings and unavailable storage", () => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  const current = session();
  current.testDungeon();
  const stop = persistSession(current);
  current.step(20);
  current.play();
  current.update(100);
  vi.advanceTimersByTime(500);
  expect(session(loadSession()).frameState()).toEqual(current.frameState());
  current.update(100);
  vi.advanceTimersByTime(500);
  expect(session(loadSession()).frameState()).toEqual(current.frameState());
  window.dispatchEvent(new Event("pagehide"));
  expect(session(loadSession()).frameState()).toEqual(current.frameState());
  saveAudio({ muted: true, volume: 0.3 });
  expect(loadAudio()).toEqual({ muted: true, volume: 0.3 });
  values.set("drilly-p.audio", '{"volume":2,"muted":false}');
  expect(loadAudio()).toEqual({ muted: false, volume: 0.6 });
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
  });
  expect(() => {
    current.pause();
    saveAudio({ muted: false, volume: 0.5 });
    stop();
  }).not.toThrow();
  expect(loadSession()).toBeUndefined();
});
