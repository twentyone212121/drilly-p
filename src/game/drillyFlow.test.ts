import { describe, expect, it, vi } from "vitest";
import { runAttempt } from "../../shared/game/replay";
import { newPlayerDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import type { DrillySource, BuiltDungeon } from "../../shared/game/drilly";
import { createSession, type Session } from "./session";
import { runDrillyFixture } from "./drillyFixture";
import { drillyMemoryOptions } from "../persistence/drillyMemory";

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
  options: Parameters<typeof createSession>[0] = {},
) {
  const room = newPlayerDungeon();
  const session = createSession({ prisonLevel: room, drilly, ...options });
  session.step(RULES.maxTicks);
  session.primaryAction();
  session.testDungeon();
  session.step(RULES.maxTicks);
  session.submitDungeon();
  return session;
}
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
async function review(session: Session) {
  session.primaryAction();
  while (session.observe().phase === "ghost") {
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
    const session = ready(source);
    expect(session.observe().phase).toBe("preparing");
    await flush();
    expect(session.level.name).toBe("AI room");
    expect(session.observe().phase).toBe("raiding");
    session.step(RULES.maxTicks);
    await flush();
    expect(source.raid).toHaveBeenCalledTimes(1);
    expect(Object.keys(source.raid.mock.calls[0][0])).not.toContain("replay");
    expect(session.observe().result).toBeNull();
    await review(session);
    expect(session.observe().result?.total).toBe(3);
    const result = session.observe().result;
    session.replayGhost();
    await review(session);
    expect(session.observe().result).toEqual(result);
    expect(source.raid).toHaveBeenCalledTimes(1);
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
    expect(session.observe().aiStatus).toBe("error");
    expect(session.observe().result).toBeNull();
    session.retryDrilly();
    session.retryDrilly();
    await flush();
    expect(source.raid).toHaveBeenCalledTimes(2);
    expect(session.observe().round?.human).toHaveLength(1);
    expect(session.observe().aiStatus).toBe("ready");
  });

  it("ignores a room arriving after editing resumed and preserves the clear", async () => {
    let resolve!: (level: BuiltDungeon) => void;
    const source = {
      build: vi.fn(
        () =>
          new Promise<BuiltDungeon>((r) => {
            resolve = r;
          }),
      ),
      raid: vi.fn(),
    };
    const session = ready(source);
    session.primaryAction();
    expect(source.build).toHaveBeenCalledTimes(1);
    session.editDungeon();
    resolve(built());
    await flush();
    expect(session.observe().phase).toBe("building");
    expect(session.observe().round).toBeNull();
    expect(session.observe().canSubmit).toBe(true);
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
      expect(session.observe().aiStatus).toBe("error");
      expect(session.observe().result).toBeNull();
    }
  });
});

it("ignores raid results after the player returns to editing", async () => {
  let resolve!: (value: ReturnType<typeof runDrillyFixture>) => void;
  const source: DrillySource = {
    build: async () => built(),
    raid: () =>
      new Promise((r) => {
        resolve = r;
      }),
  };
  const session = ready(source);
  await flush();
  session.step(RULES.maxTicks);
  session.editDungeon();
  resolve(runDrillyFixture(newPlayerDungeon()));
  await flush();
  expect(session.observe().phase).toBe("building");
  expect(session.observe().round).toBeNull();
  expect(session.observe().result).toBeNull();
});

it("retries room generation without consuming a human raid attempt", async () => {
  const source = {
    build: vi
      .fn()
      .mockRejectedValueOnce(new Error("no proven room"))
      .mockResolvedValue(built()),
    raid: vi.fn(),
  };
  const session = ready(source);
  await flush();
  expect(session.observe().aiStatus).toBe("error");
  expect(session.observe().round?.human).toHaveLength(0);
  session.primaryAction();
  session.primaryAction();
  await flush();
  expect(source.build).toHaveBeenCalledTimes(2);
  expect(session.observe().phase).toBe("raiding");
  expect(session.observe().round?.human).toHaveLength(0);
});

it("learns from completed human raids and sends fresh-layout history to the next build only", async () => {
  const source = {
    build: vi.fn(async () => built()),
    raid: vi.fn(async (level) => runDrillyFixture(level)),
  };
  const session = ready(source);
  await flush();
  expect(source.build.mock.calls[0]).toEqual([
    { recentRaids: [], recentRooms: [] },
  ]);
  session.step(RULES.maxTicks);
  await flush();
  session.editDungeon();
  session.submitDungeon();
  await flush();
  const context = (
    source.build.mock.calls[1] as unknown as [
      import("../../shared/game/drilly").BuildContext,
    ]
  )[0];
  expect(context.recentRaids).toHaveLength(1);
  expect(context.recentRooms).toHaveLength(1);
  expect(context.recentRaids[0].cleared).toBe(true);
  expect(context.recentRaids[0].attempts).toBe(1);
  expect(context).not.toHaveProperty("clear");
  expect(context.recentRaids[0]).not.toHaveProperty("replay");
  expect(source.raid.mock.calls[0]).toHaveLength(1);
});

it("remembers an abandoned room on reload without treating it as a completed raid", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const source = {
    build: vi.fn(async () => built()),
    raid: vi.fn(),
  };
  const options = () => drillyMemoryOptions("test-profile", () => storage);
  const first = ready(source, options());
  await flush();
  first.editDungeon();
  ready(source, options());
  await flush();
  expect(source.build.mock.calls[1]).toEqual([
    { recentRooms: [newPlayerDungeon()], recentRaids: [] },
  ]);
});

it("does not remember a stale build that the player never received", async () => {
  let resolve!: (level: BuiltDungeon) => void;
  const onDrillyHistoryChange = vi.fn();
  const session = ready(
    {
      build: () =>
        new Promise((r) => {
          resolve = r;
        }),
      raid: vi.fn(),
    },
    { onDrillyHistoryChange },
  );
  session.editDungeon();
  resolve(built());
  await flush();
  expect(onDrillyHistoryChange).not.toHaveBeenCalled();
});

it("keeps learning bounded to the newest rooms and completed raids", async () => {
  let index = 0;
  const source = {
    build: vi.fn(async () =>
      built({
        ...newPlayerDungeon(),
        id: `room-${index++}`,
      }),
    ),
    raid: vi.fn(async (level) => runDrillyFixture(level)),
  };
  const session = ready(source);
  for (let i = 0; i <= RULES.drilly.recentRoomLimit; i++) {
    await flush();
    session.step(RULES.maxTicks);
    await flush();
    session.editDungeon();
    session.submitDungeon();
  }
  const context = (
    source.build.mock.calls[index - 1] as unknown as [
      import("../../shared/game/drilly").BuildContext,
    ]
  )[0];
  expect(context.recentRooms).toHaveLength(RULES.drilly.recentRoomLimit);
  expect(context.recentRooms[0].id).toBe("room-1");
  expect(context.recentRaids).toHaveLength(RULES.drilly.recentRaidLimit);
});

it("prepares one room while editing and reuses it on submission", async () => {
  const source = { build: vi.fn(async () => built()), raid: vi.fn() };
  const session = createSession({
    prisonLevel: newPlayerDungeon(),
    drilly: source,
  });
  session.step(RULES.maxTicks);
  session.primaryAction();
  expect(source.build).toHaveBeenCalledTimes(1);
  expect(session.observe().phase).toBe("building");
  await flush();
  expect(session.observe().roomPreparation).toBe("ready");
  session.testDungeon();
  session.step(RULES.maxTicks);
  session.submitDungeon();
  await flush();
  expect(source.build).toHaveBeenCalledTimes(1);
  expect(session.observe().phase).toBe("raiding");
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
    expect(session.observe().phase).toBe("preparing");
    expect(session.observe().aiStatus).toBe("error");
    expect(session.observe().round?.human).toHaveLength(0);
    expect(session.observe().result).toBeNull();
  }
});

it("shows the real room proof after the human raid without consuming attempts or awarding medals", async () => {
  const source = {
    build: vi.fn(async () => built()),
    raid: vi.fn(async (level) => runDrillyFixture(level)),
  };
  const session = ready(source);
  await flush();
  session.watchBuildProof();
  expect(session.observe().phase).toBe("raiding");
  session.step(RULES.maxTicks);
  await flush();
  const round = session.observe().round;
  const result = session.observe().result;
  const calls = source.raid.mock.calls.length;
  expect(session.observe().canWatchProof).toBe(true);
  session.watchBuildProof();
  expect(session.observe().phase).toBe("proof");
  session.step(RULES.maxTicks);
  expect(session.observe().state.status).toBe("won");
  session.primaryAction();
  expect(session.observe().phase).toBe("raid-complete");
  expect(session.observe().round).toEqual(round);
  expect(session.observe().result).toEqual(result);
  expect(source.raid).toHaveBeenCalledTimes(calls);
});

it("never exposes a previous live room's proof in a later fixture round", async () => {
  const source = {
    build: vi.fn(async () => built()),
    raid: vi.fn(async (level) => runDrillyFixture(level)),
  };
  const session = ready(source);
  await flush();
  session.step(RULES.maxTicks);
  await flush();
  expect(session.observe().canWatchProof).toBe(true);
  session.editDungeon();
  session.setDevelopmentFixture(true);
  session.submitDungeon();
  for (let attempt = 0; attempt < RULES.raidAttempts; attempt++) {
    session.step(RULES.maxTicks);
    if (session.observe().phase === "raiding") session.reset();
  }
  await flush();
  expect(session.observe().round?.fixture).toBe(true);
  expect(session.observe().canWatchProof).toBe(false);
});
