import { expect, it, vi, afterEach } from "vitest";
import { newPlayerDungeon, getDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import { replayAttempt } from "../../shared/game/replay";
import { playDungeon, buildDungeon } from "./planner";
import { parseDrillyBuild, parseDrillyStrategy } from "../../shared/validation";
import { buildPlan, roomEdit, directStrategy } from "./testing";
import { DRILLY_ERRORS } from "../../shared/game/drillyErrors";
import { emptyWorkspace, applyEdit } from "./construction";
import { parseDrillyEdit } from "../../shared/validation";

afterEach(() => vi.useRealTimers());

it("stops scored attempts at first success and records the actual simulation", async () => {
  const room = getDungeon("first-vault");
  const plan = vi.fn(async () => directStrategy(room));
  const attempts = await playDungeon(room, plan);
  expect(attempts).toHaveLength(1);
  expect(replayAttempt(attempts[0].replay).stopReason).toBe("won");
});

it("limits scored attempts and provides only its own failure history", async () => {
  const room = newPlayerDungeon();
  room.treasures[0].y = 10;
  const plan = vi.fn(async () => directStrategy(room));
  const attempts = await playDungeon(room, plan);
  expect(attempts).toHaveLength(RULES.raidAttempts);
  for (const attempt of attempts)
    expect(replayAttempt(attempt.replay).stopReason).toBe(attempt.outcome);
  expect(plan.mock.calls).toEqual(
    expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({
          previousAttempts: expect.arrayContaining([
            expect.objectContaining({ outcome: "tick-limit" }),
          ]),
        }),
      ]),
    ]),
  );
});

it("validates route targets and requires every treasure", () => {
  const room = getDungeon("first-vault");
  for (const route of [
    [],
    [{ kind: "treasure", id: "missing" }],
    [{ kind: "teleport", id: room.treasures[0].id }],
    [{ kind: "platform", id: room.platforms[0].id }],
  ]) {
    expect(() =>
      parseDrillyStrategy({ objective: "Collect", route }, room),
    ).toThrow();
  }
});

it("publishes a real winning replay with exactly the enclosed room", async () => {
  const plan = vi.fn(buildPlan);
  const built = await buildDungeon(plan);
  expect(built.proof.level).toEqual(built.level);
  expect(replayAttempt(built.proof).stopReason).toBe("won");
  expect(plan).toHaveBeenCalledTimes(2);
});

it.each(["provider", "invalid", "unreachable"])(
  "keeps the proven checkpoint after a later %s failure",
  async (failure) => {
    const original = getDungeon("first-vault");
    let count = 0;
    const plan = vi.fn(async () => {
      if (++count === 1) return roomEdit(original);
      if (failure === "provider") throw new Error(DRILLY_ERRORS.timeout);
      if (failure === "invalid") return { invalid: true };
      const broken = structuredClone(original);
      broken.treasures[0].y = 10;
      return roomEdit(broken);
    });
    const built = await buildDungeon(plan);
    expect(built.level.treasures).toEqual(original.treasures);
    expect(replayAttempt(built.proof).stopReason).toBe("won");
  },
);

it("repairs an individual object without discarding the working idea", async () => {
  let count = 0;
  const room = getDungeon("first-vault");
  const plan = vi.fn(async () => {
    if (++count === 1) {
      const broken = structuredClone(room);
      broken.treasures[0].y = 10;
      return roomEdit(broken);
    }
    return {
      ...roomEdit(room),
      action: count > 2 ? "finish" : "edit",
      removeIds: [],
      edit: {
        platforms: [],
        traps: [],
        obstacles: [],
        treasures: room.treasures,
      },
    };
  });
  const built = await buildDungeon(plan);
  expect(built.level.traps).toEqual(room.traps);
  expect(built.level.treasures).toEqual(room.treasures);
  expect(plan.mock.calls[1]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        feedback: expect.objectContaining({
          cleared: false,
          contacts: expect.any(Array),
        }),
      }),
    ]),
  );
  expect(replayAttempt(built.proof).stopReason).toBe("won");
});

it("uses timing and repetition as feedback rather than discarding a playable room", async () => {
  const room = getDungeon("first-vault");
  const plan = vi.fn(buildPlan);
  const built = await buildDungeon(plan, {
    recentRaids: [],
    recentRooms: [room],
  });
  expect(replayAttempt(built.proof).stopReason).toBe("won");
  expect(plan.mock.calls[1][1]).toMatchObject({
    feedback: { similarToRecentRoom: true },
  });
});

it("does not publish empty scaffolding, unreachable geometry or decorative hazards", async () => {
  for (const room of [
    newPlayerDungeon(),
    {
      ...newPlayerDungeon(),
      treasures: [{ id: "unreachable", x: 100, y: 10, width: 16, height: 16 }],
    },
  ]) {
    const plan = vi.fn(async () => roomEdit(room));
    await expect(buildDungeon(plan)).rejects.toThrow(DRILLY_ERRORS.unproven);
    expect(plan).toHaveBeenCalledTimes(RULES.drilly.buildEdits);
  }
});

it("does not hide provider failure before a checkpoint exists", async () => {
  await expect(
    buildDungeon(async () => {
      throw new Error(DRILLY_ERRORS.quota);
    }),
  ).rejects.toThrow(DRILLY_ERRORS.quota);
});

it("preserves fixed metadata and validates object budgets after merging edits", () => {
  const room = getDungeon("first-vault");
  expect(() =>
    parseDrillyBuild({ level: { ...room, width: 400 } }, room),
  ).toThrow();
  const workspace = emptyWorkspace();
  const edit = parseDrillyEdit(roomEdit(room));
  expect(() =>
    applyEdit(workspace, edit, { platforms: 5, treasures: 1, hazards: 1 }),
  ).toThrow("budget");
  expect(workspace.traps).toEqual([]);
});

it("uses bounded learning without sharing the player's input recording", async () => {
  const plan = vi.fn(buildPlan);
  await buildDungeon(plan, {
    recentRaids: [
      {
        level: newPlayerDungeon(),
        attempts: 3,
        cleared: false,
        deaths: [{ kind: "saw", tick: 42, x: 200, y: 392 }],
        ignoredJumps: 4,
        wallJumps: 0,
      },
    ],
  });
  expect(plan.mock.calls[0][1]).toMatchObject({
    learning: {
      recentRaids: [{ attempts: 3, cleared: false, ignoredJumps: 4 }],
    },
    budget: { treasures: RULES.drilly.introductoryTreasures },
  });
  expect(plan.mock.calls[0][1]).not.toHaveProperty("templates");
});

it("bounds a stalled provider without inventing scored losses", async () => {
  vi.useFakeTimers();
  const plan = vi.fn(() => new Promise<unknown>(() => {}));
  const pending = expect(playDungeon(newPlayerDungeon(), plan)).rejects.toThrow(
    "too long",
  );
  await vi.advanceTimersByTimeAsync(RULES.drilly.raidThinkingTimeoutMs);
  await pending;
  expect(plan).toHaveBeenCalledTimes(1);
});

it("builds a plain route first, then adds the hazard that makes it a challenge", async () => {
  const room = newPlayerDungeon();
  let edit = 0;
  const plan = vi.fn(async (_instructions: string, _input: unknown) => {
    const next = structuredClone(room);
    if (++edit > 1)
      next.traps = [{ id: "crossing", x: 320, y: 400, radius: 18 }];
    return { ...roomEdit(next), action: edit > 2 ? "finish" : "edit" };
  });
  const result = await buildDungeon(plan);
  expect(plan.mock.calls[1][1]).toMatchObject({
    checkpoint: { proof: { jumpCount: 0 } },
    challengeReady: false,
  });
  expect(result.level.traps).toHaveLength(1);
  expect(result.proof.jumpTicks.length).toBeGreaterThan(0);
  expect(replayAttempt(result.proof).stopReason).toBe("won");
});

it("never uses a route-only checkpoint as a fallback after provider failure", async () => {
  let calls = 0;
  await expect(
    buildDungeon(async () => {
      if (++calls === 1) return roomEdit(newPlayerDungeon());
      throw new Error(DRILLY_ERRORS.quota);
    }),
  ).rejects.toThrow(DRILLY_ERRORS.quota);
});
