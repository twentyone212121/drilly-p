import { DEATH_ANIMATION_MS } from "./presentation";
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

function finishDeathPresentation(session: Session) {
  for (let elapsed = 0; elapsed < DEATH_ANIMATION_MS; elapsed += 100)
    session.update(100);
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
      raid: async (room, history) => runDrillyFixture(room)[history.length],
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
    expect(session.getSnapshot().tutorialCompleted).toBe(false);
    const dead = session.frameState();
    expect(dead.status).toBe("dead");
    expect(session.getSnapshot().presentingDeath).toBe(true);
    session.primaryAction();
    session.reset();
    session.update(Number.NaN);
    expect(session.frameState()).toBe(dead);
    finishDeathPresentation(session);
    expect(session.getSnapshot().presentingDeath).toBe(false);
    expect(session.frameState()).toMatchObject({ status: "running", tick: 0 });
    expect(session.getSnapshot().waitingToStart).toBe(true);
    session.update(100);
    expect(session.frameState().tick).toBe(0);
  }
  finish(session, [44, 199, 200, 234]);
  expect(session.frameState().status).toBe("won");
  session.primaryAction();
  expect(session.getSnapshot().editorLevel).toEqual(newPlayerDungeon());
});

it("requires a clear and only invalidates it for accepted geometry changes", () => {
  const session = editingSession();
  session.challengeDrilly();
  const start = session.frameState();
  expect(session.getSnapshot().waitingToStart).toBe(true);
  session.update(100);
  expect(session.frameState()).toBe(start);
  session.play();
  session.update(20);
  expect(session.frameState().tick).toBeGreaterThan(0);
  expect(session.frameState().player.vy).toBeGreaterThanOrEqual(0);
  finish(session);
  expect(session.getSnapshot().cleared).toBe(true);
  expect(session.getSnapshot().phase).toBe("build");
  expect(session.getSnapshot().level).toEqual(
    session.getSnapshot().editorLevel,
  );
  session.editDungeon();
  const level = session.getSnapshot().level;
  session.edit({
    type: "put",
    object: { kind: "treasure", value: level.treasures[0] },
  });
  expect(() =>
    session.edit({ type: "put", object: newObject(level, "saw", level.spawn) }),
  ).toThrow();
  expect(session.getSnapshot().cleared).toBe(true);
  session.edit({
    type: "put",
    object: newObject(level, "saw", { x: 200, y: 96 }),
  });
  expect(session.getSnapshot().cleared).toBe(false);
});

it("allows incomplete drafts but refuses to test without a treasure", () => {
  const session = editingSession();
  session.edit({
    type: "delete",
    selection: {
      kind: "treasure",
      id: session.getSnapshot().level.treasures[0].id,
    },
  });
  expect(() => session.testDungeon()).toThrow();
  session.replayTutorial();
  session.editDungeon();
  expect(session.getSnapshot().level.treasures).toHaveLength(0);
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
    expect(session.getSnapshot().cleared).toBe(false);
  }
});

it("counts each scored death or restart once, preserves the draft, and stops after three attempts", async () => {
  const session = editingSession();
  session.testDungeon();
  finish(session);
  const draft = session.getSnapshot().editorLevel;
  session.challengeDrilly();
  for (let i = 0; i < 6; i++) await Promise.resolve();
  expect(session.getSnapshot().level).toEqual(getExampleRoom());
  expect(session.getSnapshot().livesRemaining).toBe(3);
  finish(session);
  expect(session.getSnapshot().livesRemaining).toBe(2);
  session.pause();
  session.step();
  finishDeathPresentation(session);
  expect(session.getSnapshot().round?.human).toHaveLength(1);
  expect(session.getSnapshot().waitingToStart).toBe(true);
  expect(session.frameState()).toMatchObject({ status: "running", tick: 0 });
  session.update(100);
  expect(session.frameState().tick).toBe(0);
  session.play();
  session.pause();
  expect(session.getSnapshot().round?.human).toHaveLength(1);
  session.reset();
  finish(session);
  const dead = session.frameState();
  expect(session.getSnapshot()).toMatchObject({
    phase: "raid",
    presentingDeath: true,
    livesRemaining: 0,
  });
  for (let elapsed = 0; elapsed < DEATH_ANIMATION_MS - 100; elapsed += 100)
    session.update(100);
  expect(session.getSnapshot().phase).toBe("raid");
  expect(session.frameState()).toBe(dead);
  session.update(100);
  expect(session.getSnapshot()).toMatchObject({
    phase: "results",
    presentingDeath: false,
  });
  session.update(100);
  session.reset();
  expect(session.getSnapshot().round?.human.map((a) => a.outcome)).toEqual([
    "dead",
    "restart",
    "dead",
  ]);
  session.editDungeon();
  expect(session.getSnapshot().level).toEqual(draft);
  session.edit({
    type: "delete",
    selection: { kind: "treasure", id: draft.treasures[0].id },
  });
  expect(draft.treasures).toHaveLength(1);
});
