import { expect, it } from "vitest";
import { getPrison, newPlayerDungeon } from "../../shared/game/rooms";
import { getExampleRoom } from "../../shared/testing/rooms";
import { runAttempt } from "../../shared/game/replay";
import { RULES } from "../../shared/game/rules";
import { runDrillyFixture } from "../../shared/testing/drilly";
import { createSession, type Session } from "./session";
import { newObject } from "./editor";

function finish(session: Session, jumps: number[] = []) {
  for (const tick of jumps) {
    const advance = tick - session.frameState().tick;
    if (advance > 0) session.step(advance);
    session.jump();
    session.step();
  }
  session.step(RULES.maxTicks);
}

function editingSession() {
  const level = getExampleRoom();
  const jumpTicks = [34, 106];
  const session = createSession({
    prisonLevel: newPlayerDungeon(),
    drilly: {
      build: async () => ({
        level,
        proof: {
          version: 2,
          rulesVersion: RULES.version,
          level,
          jumpTicks,
          endTick: runAttempt(level, jumpTicks).state.tick,
        },
      }),
      raid: async (room) => runDrillyFixture(room),
    },
  });
  finish(session);
  session.primaryAction();
  return session;
}

it("allows unlimited prison retries and opens the editor after a real escape", () => {
  const session = createSession();
  expect(() => session.editDungeon()).toThrow();
  for (let i = 0; i < RULES.raidAttempts + 1; i++) {
    finish(session);
    expect(session.getSnapshot().prisonEscaped).toBe(false);
    session.reset();
  }
  finish(session, [44, 193, 228]);
  expect(session.frameState().status).toBe("won");
  session.primaryAction();
  expect(session.getSnapshot().editorLevel).toEqual(newPlayerDungeon());
});

it("requires a clear and only invalidates it for accepted geometry changes", () => {
  const session = editingSession();
  expect(() => session.submitDungeon()).toThrow();
  session.testDungeon();
  finish(session);
  expect(session.getSnapshot().canSubmit).toBe(true);
  session.editDungeon();
  const level = session.level;
  session.edit({
    type: "put",
    object: { kind: "treasure", value: level.treasures[0] },
  });
  expect(() =>
    session.edit({ type: "put", object: newObject(level, "saw", level.spawn) }),
  ).toThrow();
  expect(session.getSnapshot().canSubmit).toBe(true);
  session.edit({
    type: "put",
    object: newObject(level, "saw", { x: 200, y: 96 }),
  });
  expect(session.getSnapshot().canSubmit).toBe(false);
});

it("allows incomplete drafts but refuses to test without a treasure", () => {
  const session = editingSession();
  session.edit({
    type: "delete",
    selection: { kind: "treasure", id: session.level.treasures[0].id },
  });
  expect(() => session.testDungeon()).toThrow();
  expect(session.level.treasures).toHaveLength(0);
});

it("never awards a clear for a failed test", () => {
  for (const level of [getExampleRoom(), { ...getPrison(), traps: [] }]) {
    const session = createSession({
      prisonLevel: newPlayerDungeon(),
      editorLevel: level,
    });
    finish(session);
    session.primaryAction();
    session.testDungeon();
    finish(session);
    expect(session.getSnapshot().clearedRevision).toBeNull();
  }
});

it("counts each scored death or restart once, preserves the draft, and stops after three attempts", async () => {
  const session = editingSession();
  session.testDungeon();
  finish(session);
  const draft = session.getSnapshot().editorLevel;
  session.submitDungeon();
  for (let i = 0; i < 6; i++) await Promise.resolve();
  expect(session.level).toEqual(getExampleRoom());
  finish(session);
  session.pause();
  session.step();
  expect(session.getSnapshot().round?.human).toHaveLength(1);
  session.reset();
  session.play();
  session.pause();
  expect(session.getSnapshot().round?.human).toHaveLength(1);
  session.reset();
  finish(session);
  session.reset();
  expect(session.getSnapshot().round?.human.map((a) => a.outcome)).toEqual([
    "dead",
    "restart",
    "dead",
  ]);
  session.editDungeon();
  expect(session.level).toEqual(draft);
  session.edit({
    type: "delete",
    selection: { kind: "treasure", id: draft.treasures[0].id },
  });
  expect(draft.treasures).toHaveLength(1);
});
