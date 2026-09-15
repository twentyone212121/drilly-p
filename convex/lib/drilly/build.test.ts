import { getExampleRoom } from "../../../shared/testing/rooms";
import { expect, it, vi, afterEach } from "vitest";
import { newPlayerDungeon } from "../../../shared/game/rooms";
import { RULES } from "../../../shared/game/rules";
import { replayAttempt } from "../../../shared/game/replay";
import { buildDungeon } from "./build";
import { parseDrillyBuild } from "../../../shared/validation";
import { buildPlan, roomEdit, withRaidInputs } from "../../../shared/testing/planner";
import { DRILLY_ERRORS } from "../../../shared/game/drillyErrors";
import { emptyWorkspace, applyEdit } from "./construction";
import { parseDrillyEdit } from "../../../shared/validation";
import type { Planner } from "./protocol";

afterEach(() => vi.useRealTimers());

it("publishes a real winning replay with exactly the enclosed room", async () => {
  const plan = vi.fn(buildPlan);
  const built = await buildDungeon(plan);
  expect(built.proof.level).toEqual(built.level);
  expect(built.proof.jumpTicks).toEqual([34, 106]);
  expect(replayAttempt(built.proof).stopReason).toBe("won");
});

it.each(["provider", "invalid", "unreachable"])(
  "keeps the proven checkpoint after a later %s failure",
  async (failure) => {
    const original = getExampleRoom();
    let count = 0;
    const plan = vi.fn<Planner>(async (instructions, input, options) => {
      if (options?.schemaName === "drilly_inputs") {
        if (failure === "provider" && count > 1) throw new Error(DRILLY_ERRORS.timeout);
        return buildPlan(instructions, input, options);
      }
      if (++count === 1) return roomEdit(original);
      if (failure === "provider") return roomEdit(original);
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
  const room = getExampleRoom();
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
  const built = await buildDungeon(withRaidInputs(plan));
  expect(built.level.traps).toEqual(room.traps);
  expect(built.level.treasures).toEqual(room.treasures);
  expect(plan.mock.calls[1]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        feedback: expect.objectContaining({
          cleared: false,
          attempt: expect.objectContaining({ outcome: "tick-limit", events: expect.any(Array) }),
        }),
      }),
    ]),
  );
  expect(replayAttempt(built.proof).stopReason).toBe("won");
});

it("does not publish trivial or uncompleted rooms", async () => {
  for (const room of [
    newPlayerDungeon(),
    {
      ...newPlayerDungeon(),
      treasures: [{ id: "unreachable", x: 100, y: 10, width: 16, height: 16 }],
    },
  ]) {
    const plan = vi.fn(async () => roomEdit(room));
    await expect(buildDungeon(withRaidInputs(plan))).rejects.toThrow(DRILLY_ERRORS.unproven);
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
  const room = getExampleRoom();
  expect(() => parseDrillyBuild({ level: { ...room, width: 400 } }, room)).toThrow();
  const workspace = emptyWorkspace();
  const edit = parseDrillyEdit(roomEdit(room));
  expect(() => applyEdit(workspace, edit, { platforms: 5, treasures: 1, hazards: 1 })).toThrow(
    "budget",
  );
  expect(workspace.traps).toEqual([]);
});

it("builds a plain route first, then adds the hazard that makes it a challenge", async () => {
  const room = newPlayerDungeon();
  let edit = 0;
  const plan = vi.fn(async (_instructions: string, _input: unknown) => {
    const next = structuredClone(room);
    if (++edit > 1) next.traps = [{ id: "crossing", x: 320, y: 400, radius: 18 }];
    return { ...roomEdit(next), action: edit > 2 ? "finish" : "edit" };
  });
  const result = await buildDungeon(withRaidInputs(plan));
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
    buildDungeon(
      withRaidInputs(async () => {
        if (++calls === 1) return roomEdit(newPlayerDungeon());
        throw new Error(DRILLY_ERRORS.quota);
      }),
    ),
  ).rejects.toThrow(DRILLY_ERRORS.quota);
});

it("uses the remaining build deadline for its model-driven proof", async () => {
  vi.useFakeTimers();
  let aborted = false;
  const plan: Planner = async (_instructions, _input, options) => {
    if (options?.schemaName === "drilly_edit") {
      vi.setSystemTime(Date.now() + RULES.drilly.buildThinkingTimeoutMs - 10);
      return roomEdit(getExampleRoom());
    }
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
    });
  };
  const pending = expect(buildDungeon(plan)).rejects.toThrow(DRILLY_ERRORS.timeout);
  await vi.advanceTimersByTimeAsync(10);
  await pending;
  expect(aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
