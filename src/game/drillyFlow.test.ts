import { describe, expect, it, vi } from "vitest";
import { runAttempt } from "../../shared/game/replay";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import type { DrillySource, BuiltDungeon } from "../../shared/game/drilly";
import { createSession, type Session } from "./session";
import { runDrillyFixture } from "../../shared/testing/drilly";

function built(level = newPlayerDungeon()): BuiltDungeon {
  return {
    level,
    proof: {
      version: 2,
      rulesVersion: RULES.version,
      level,
      jumpTicks: [],
      endTick: runAttempt(level, []).state.tick,
    },
  };
}

function ready(drilly: DrillySource) {
  const room = newPlayerDungeon();
  const session = createSession({ prisonLevel: room, drilly });
  session.step(RULES.maxTicks);
  session.primaryAction();
  session.testDungeon();
  session.step(RULES.maxTicks);
  session.challengeDrilly();
  return session;
}
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
async function review(session: Session) {
  session.primaryAction();
  for (let i = 0; i < RULES.raidAttempts && !session.getSnapshot().result; i++) {
    session.step(RULES.maxTicks);
    session.primaryAction();
  }
}

describe("live Drilly rivalry", () => {
  it("builds a fresh opponent, passes only the submitted layout to AI, then scores recorded ghosts once", async () => {
    const level = { ...newPlayerDungeon(), name: "AI room" };
    const source = {
      build: vi.fn(async () => built(level)),
      raid: vi.fn(async (room) => runDrillyFixture(room)),
    };
    const session = createSession({
      tutorialCompleted: true,
      drilly: source,
    });
    session.prepareRoom();
    session.prepareRoom();
    expect(source.build).toHaveBeenCalledTimes(1);
    session.challengeDrilly();
    expect(session.getSnapshot().round).toBeNull();
    session.step(RULES.maxTicks);
    session.challengeDrilly();
    expect(session.getSnapshot().canPlay).toBe(false);
    await flush();
    expect(session.level.name).toBe("AI room");
    expect(session.getSnapshot().canPlay).toBe(true);
    session.step(RULES.maxTicks);
    await flush();
    expect(source.raid).toHaveBeenCalledTimes(1);
    expect(Object.keys(source.raid.mock.calls[0][0])).not.toContain("replay");
    expect(session.getSnapshot().result).toBeNull();
    await review(session);
    expect(session.getSnapshot().result?.total).toBe(3);
    const result = session.getSnapshot().result;
    session.replayDrilly();
    session.step(RULES.maxTicks);
    session.primaryAction();
    expect(session.getSnapshot().result).toEqual(result);
    expect(source.raid).toHaveBeenCalledTimes(1);

    session.primaryAction();
    const draft = session.level;
    session.challengeDrilly();
    await flush();
    expect(session.getSnapshot().editorLevel).toEqual(draft);
    expect(session.getSnapshot().round?.human).toHaveLength(0);
    expect(source.build).toHaveBeenCalledTimes(2);
  });

  it("retries technical errors without awarding defense medals or consuming human attempts", async () => {
    const source = {
      build: vi.fn(async () => built()),
      raid: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockImplementation(async (level) => runDrillyFixture(level)),
    };
    const session = ready(source);
    await flush();
    session.step(RULES.maxTicks);
    await flush();
    expect(session.getSnapshot().aiStatus).toBe("error");
    expect(session.getSnapshot().result).toBeNull();
    session.primaryAction();
    session.primaryAction();
    await flush();
    expect(source.raid).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().round?.human).toHaveLength(1);
    expect(session.getSnapshot().aiStatus).toBe("idle");
  });

  it("rejects forged outcomes and partial losing attempt sets", async () => {
    for (const forge of [
      (level: ReturnType<typeof newPlayerDungeon>) =>
        runDrillyFixture(level).map((a) => ({
          ...a,
          outcome: "dead" as const,
        })),
      (level: ReturnType<typeof newPlayerDungeon>) =>
        runDrillyFixture(level).map((a) => ({
          ...a,
          replay: { ...a.replay, endTick: 1, jumpTicks: [] },
        })),
    ]) {
      const session = ready({
        build: async () => built(),
        raid: vi.fn(async (level) => forge(level)),
      });
      await flush();
      session.step(RULES.maxTicks);
      await flush();
      expect(session.getSnapshot().aiStatus).toBe("error");
      expect(session.getSnapshot().result).toBeNull();
    }
  });
});

it("retries room generation without consuming a human raid attempt", async () => {
  const source = {
    build: vi.fn().mockRejectedValueOnce(new Error("no proven room")).mockResolvedValue(built()),
    raid: vi.fn(),
  };
  const session = ready(source);
  await flush();
  expect(session.getSnapshot().aiStatus).toBe("error");
  expect(session.getSnapshot().round?.human).toHaveLength(0);
  session.primaryAction();
  session.primaryAction();
  await flush();
  expect(source.build).toHaveBeenCalledTimes(2);
  expect(session.getSnapshot().canPlay).toBe(true);
  expect(session.getSnapshot().round?.human).toHaveLength(0);
});

it("ignores an abandoned raid response while a new round is waiting", async () => {
  const responses: ((value: ReturnType<typeof runDrillyFixture>) => void)[] = [];
  const source: DrillySource = {
    build: async () => built(),
    raid: () =>
      new Promise((resolve) => {
        responses.push(resolve);
      }),
  };
  const session = ready(source);
  await flush();
  session.step(RULES.maxTicks);
  session.editDungeon();
  session.challengeDrilly();
  await flush();
  session.step(RULES.maxTicks);

  responses[0](runDrillyFixture(newPlayerDungeon()));
  await flush();
  expect(session.getSnapshot()).toMatchObject({
    aiStatus: "pending",
    watchIndex: null,
    result: null,
  });
  responses[1](runDrillyFixture(newPlayerDungeon()));
  await flush();
  expect(session.getSnapshot()).toMatchObject({
    aiStatus: "idle",
    watchIndex: 0,
  });
});

it("returns to the draft after tutorial replay and ignores the abandoned room request", async () => {
  let resolve!: (value: BuiltDungeon) => void;
  const session = ready({
    build: () =>
      new Promise((done) => {
        resolve = done;
      }),
    raid: vi.fn(),
  });
  const draft = session.getSnapshot().editorLevel;
  session.replayTutorial();
  resolve(built());
  await flush();
  expect(session.getSnapshot()).toMatchObject({
    canPlay: true,
    round: null,
    result: null,
  });
  session.step(RULES.maxTicks);
  session.primaryAction();
  expect(session.level).toEqual(draft);
  expect(session.getSnapshot().cleared).toBe(true);
});

it("does not accept a forged room proof or mismatched geometry", async () => {
  for (const invalid of [
    { ...built(), proof: { ...built().proof, endTick: 1 } },
    {
      ...built(),
      proof: {
        ...built().proof,
        level: { ...newPlayerDungeon(), name: "Different room" },
      },
    },
  ]) {
    const session = ready({ build: async () => invalid, raid: vi.fn() });
    await flush();
    expect(session.getSnapshot().canPlay).toBe(false);
    expect(session.getSnapshot().aiStatus).toBe("error");
    expect(session.getSnapshot().round?.human).toHaveLength(0);
    expect(session.getSnapshot().result).toBeNull();
  }
});
