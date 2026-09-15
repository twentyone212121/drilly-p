import { describe, expect, it, vi } from "vitest";
import { runAttempt } from "../../shared/game/replay";
import type { RaidAttempt } from "../../shared/game/round";
import type { Level } from "../../shared/game/types";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import type {
  DrillySource,
  BuiltDungeon,
  DrillyModel,
} from "../../shared/game/drilly";
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

function ready(
  drilly: DrillySource,
  model: DrillyModel = RULES.drilly.defaultModel,
) {
  const room = newPlayerDungeon();
  const session = createSession({ prisonLevel: room, drilly });
  session.step(RULES.maxTicks);
  session.primaryAction();
  session.testDungeon();
  session.step(RULES.maxTicks);
  session.setModel(model);
  session.challengeDrilly();
  return session;
}
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
async function review(session: Session) {
  session.primaryAction();
  for (
    let i = 0;
    i < RULES.raidAttempts && !session.getSnapshot().result;
    i++
  ) {
    session.step(RULES.maxTicks);
    session.primaryAction();
  }
}

describe("live Drilly rivalry", () => {
  it("builds a fresh opponent, passes only the submitted layout to AI, then scores recorded ghosts once", async () => {
    const level = { ...newPlayerDungeon(), name: "AI room" };
    let finishDrilly!: () => void;
    const thinking = new Promise<void>((resolve) => {
      finishDrilly = resolve;
    });
    const source = {
      build: vi.fn(async () => built(level)),
      raid: vi.fn(async (room: Level, history: RaidAttempt[]) => {
        await thinking;
        return runDrillyFixture(room)[history.length];
      }),
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
    expect(source.raid).not.toHaveBeenCalled();
    session.step(RULES.maxTicks);
    session.challengeDrilly();
    expect(source.raid).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().canPlay).toBe(false);
    await flush();
    session.step(20);
    const human = session.frameState();
    finishDrilly();
    await flush();
    // A ready recording waits for the human; it must not load its replay early.
    expect(session.frameState()).toBe(human);
    expect(session.getSnapshot()).toMatchObject({
      phase: "raid",
      mode: "human",
      watchIndex: null,
    });
    expect(session.getSnapshot().round?.drilly).toEqual([{ outcome: "won" }]);
    expect(session.getSnapshot().level.name).toBe("AI room");
    expect(session.getSnapshot().canPlay).toBe(true);
    session.step(RULES.maxTicks);
    await flush();
    expect(source.raid).toHaveBeenCalledTimes(1);
    expect(Object.keys(source.raid.mock.calls[0][0])).not.toContain("replay");
    expect(source.raid.mock.calls[0][1]).toEqual([]);
    expect(session.getSnapshot().result).toBeNull();
    expect(session.ghostFrame()?.x).toBe(level.spawn.x);
    session.play();
    session.update(25);
    expect(session.ghostFrame()?.x).toBeCloseTo(level.spawn.x + 2);
    session.pause();
    expect(session.ghostFrame()?.x).toBe(level.spawn.x + 4);
    session.setGhostVisible(false);
    expect(session.ghostFrame()).toBeNull();
    session.setGhostVisible(true);
    session.reset();
    expect(session.ghostFrame()?.x).toBe(level.spawn.x);
    await review(session);
    expect(session.getSnapshot().result?.total).toBe(3);
    const result = session.getSnapshot().result;
    const scoreboard = session.getSnapshot().scoreboard;
    expect(scoreboard).toEqual({
      you: { points: 3, wins: 0 },
      drilly: { points: 3, wins: 0 },
      rounds: 1,
      draws: 1,
    });
    session.replayDrilly();
    session.step(RULES.maxTicks);
    session.primaryAction();
    expect(session.getSnapshot().result).toEqual(result);
    expect(session.getSnapshot().scoreboard).toEqual(scoreboard);
    expect(source.raid).toHaveBeenCalledTimes(1);

    session.primaryAction();
    expect(session.getSnapshot().scoreboard).toEqual(scoreboard);
    const draft = session.getSnapshot().level;
    session.challengeDrilly();
    await flush();
    expect(session.getSnapshot().editorLevel).toEqual(draft);
    expect(session.getSnapshot().round?.human).toHaveLength(0);
    expect(source.build).toHaveBeenCalledTimes(2);
  });

  it("keeps completed losses through a technical retry and cannot turn an unfinished raid into medals", async () => {
    const room = newPlayerDungeon();
    // Jump over the treasure, then remain at the wall without reversing.
    const failed = runAttempt(room, [150]);
    const loss: RaidAttempt = {
      outcome: failed.stopReason,
      replay: {
        version: 2,
        rulesVersion: RULES.version,
        level: room,
        jumpTicks: [150],
        endTick: failed.state.tick,
      },
    };
    const source = {
      build: vi.fn(async () => built()),
      raid: vi
        .fn()
        .mockResolvedValueOnce(loss)
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(runDrillyFixture(room)[0]),
    };
    const session = ready(source, "gpt-5.6-luna");
    await flush();
    session.setModel("gpt-5.6-sol");
    // A background failure must not interrupt the human's room or trigger retries.
    expect(session.getSnapshot().canPlay).toBe(true);
    expect(session.getSnapshot().aiError).toBeNull();
    session.step(RULES.maxTicks);
    await flush();
    expect(session.getSnapshot().aiStatus).toBe("error");
    expect(session.getSnapshot().round?.drilly).toEqual([
      { outcome: "tick-limit" },
    ]);
    expect(session.getSnapshot().result).toBeNull();
    session.primaryAction();
    session.primaryAction();
    await flush();
    expect(source.raid.mock.calls[2][1]).toEqual([loss]);
    expect(source.raid).toHaveBeenCalledTimes(3);
    expect(source.raid.mock.calls.map((call) => call[2])).toEqual([
      "gpt-5.6-luna",
      "gpt-5.6-luna",
      "gpt-5.6-luna",
    ]);
    expect(session.getSnapshot().round?.human).toHaveLength(1);
    const clear = runAttempt(room, []).state.player;
    session.step(RULES.maxTicks);
    expect(session.ghostFrame()).toEqual(clear);
    await review(session);
    expect(session.getSnapshot().result?.defense).toBe(1);
    expect(source.raid).toHaveBeenCalledTimes(3);
  });

  it("rejects forged outcomes and truncated attempts", async () => {
    for (const forge of [
      (level: ReturnType<typeof newPlayerDungeon>) =>
        runDrillyFixture(level).map((a) => ({
          ...a,
          outcome: "dead" as const,
        }))[0],
      (level: ReturnType<typeof newPlayerDungeon>) =>
        runDrillyFixture(level).map((a) => ({
          ...a,
          replay: { ...a.replay, endTick: 1, jumpTicks: [] },
        }))[0],
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
    build: vi
      .fn()
      .mockRejectedValueOnce(new Error("no proven room"))
      .mockResolvedValue(built()),
    raid: vi.fn(async () => runDrillyFixture(newPlayerDungeon())[0]),
  };
  const session = ready(source);
  await flush();
  expect(session.getSnapshot().aiStatus).toBe("error");
  expect(session.getSnapshot().round?.human).toHaveLength(0);
  expect(source.raid).toHaveBeenCalledTimes(1);
  session.primaryAction();
  session.primaryAction();
  await flush();
  expect(source.build).toHaveBeenCalledTimes(2);
  expect(session.getSnapshot().canPlay).toBe(true);
  expect(session.getSnapshot().round?.human).toHaveLength(0);
});

it("ignores an abandoned raid response while a new round is waiting", async () => {
  const responses: ((
    value: ReturnType<typeof runDrillyFixture>[number],
  ) => void)[] = [];
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
  session.step(20);
  const human = session.frameState();

  responses[0](runDrillyFixture(newPlayerDungeon())[0]);
  await flush();
  expect(session.frameState()).toBe(human);
  expect(session.getSnapshot().round?.drilly).toHaveLength(0);
  session.step(RULES.maxTicks);
  expect(session.getSnapshot()).toMatchObject({
    aiStatus: "pending",
    watchIndex: null,
    result: null,
  });
  responses[1](runDrillyFixture(newPlayerDungeon())[0]);
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
  expect(session.getSnapshot().level).toEqual(draft);
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
