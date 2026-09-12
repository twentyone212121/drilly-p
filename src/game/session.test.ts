import { describe, expect, it } from "vitest";
import { getDungeon, getPrison } from "../../shared/game/campaign";
import { replayAttempt } from "../../shared/game/replay";
import { RULES } from "../../shared/game/rules";
import { createSession, type Session } from "./session";
import { sessionView } from "./sessionView";

const PRISON_JUMPS = [44, 193, 228];
const PRISON_END_TICK = 273;

function finishHumanAttempt(session: Session, jumps: number[] = []) {
  for (const tick of jumps) {
    const advance = tick - session.frameState().tick;
    if (advance) session.step(advance);
    session.jump();
    session.step();
  }
  session.step(RULES.maxTicks);
}

function escape(session: Session) {
  finishHumanAttempt(session, PRISON_JUMPS);
  expect(session.getSnapshot().phase).toBe("escaped");
  session.primaryAction();
}

function submit(session: Session) {
  escape(session);
  session.testDungeon();
  finishHumanAttempt(session);
  session.submitDungeon();
}

describe("local game state machine", () => {
  it("loads an unfinished saved draft without restoring a prison escape or clear", () => {
    const draft = createSession().getSnapshot().editorLevel;
    draft.treasures = [];
    const session = createSession({ editorLevel: draft });
    expect(session.getSnapshot()).toMatchObject({
      phase: "prison",
      prisonEscaped: false,
      canSubmit: false,
      editorLevel: { treasures: [] },
    });
    escape(session);
    expect(() => session.testDungeon()).toThrow();
  });

  it("invalidates a clear when loading a saved draft and isolates active attempts", () => {
    const session = createSession();
    escape(session);
    const draft = session.getSnapshot().editorLevel;
    session.testDungeon();
    const before = session.observe();
    expect(() => session.replaceDraft(draft)).toThrow("Return to editing");
    expect(session.observe()).toEqual(before);
    finishHumanAttempt(session);
    expect(session.getSnapshot().canSubmit).toBe(true);
    session.submitDungeon();
    const submission = session.getSnapshot().submission;
    expect(() => session.replaceDraft(draft)).toThrow();
    session.editDungeon();
    session.replaceDraft(draft);
    expect(session.getSnapshot().canSubmit).toBe(false);
    expect(session.getSnapshot().submission).toEqual(submission);
    draft.treasures = [];
    expect(session.getSnapshot().editorLevel.treasures).not.toEqual([]);
    const restored = session.observe();
    expect(() => session.replaceDraft({ ...draft, width: 1000 })).toThrow("fixed");
    expect(session.observe()).toEqual(restored);
  });

  it("requires a human prison escape before building, testing, or submitting", () => {
    const session = createSession();
    expect(session.getSnapshot()).toMatchObject({
      phase: "prison",
      paused: true,
      prisonEscaped: false,
    });
    const before = session.observe();
    expect(() => session.editDungeon()).toThrow("Escape the prison");
    expect(() => session.testDungeon()).toThrow("Return to building");
    expect(() => session.submitDungeon()).toThrow("Clear the current");
    expect(() =>
      session.edit({
        type: "delete",
        selection: { kind: "saw", id: "prison-saw" },
      }),
    ).toThrow();
    expect(session.observe()).toEqual(before);
  });

  it("allows unlimited prison retries and uses one action to start, resume, jump, or retry", () => {
    const session = createSession();
    for (let retry = 0; retry < 5; retry++) {
      session.primaryAction();
      expect(session.getSnapshot()).toMatchObject({
        paused: false,
        pendingJump: false,
        state: { tick: 0 },
      });
      session.update(1000 / 60);
      session.pause();
      session.primaryAction();
      session.update(1000 / 60);
      expect(session.exportReplay().jumpTicks).toEqual([]);
      session.step(RULES.maxTicks);
      expect(session.getSnapshot()).toMatchObject({
        phase: "prison",
        finished: true,
        prisonEscaped: false,
      });
      expect(sessionView(session.getSnapshot()).action).toBe("Retry escape");
    }
    session.primaryAction();
    session.update(1000 / 60);
    session.primaryAction();
    session.update(1000 / 60);
    expect(session.exportReplay().jumpTicks).toEqual([1]);
  });

  it("keeps a tick-limit failure retryable without advancing progression", () => {
    const prison = getPrison();
    const session = createSession({
      prisonLevel: {
        ...prison,
        traps: [],
        treasures: [{ ...prison.treasures[0], y: 100 }],
      },
    });
    finishHumanAttempt(session);
    expect(session.getSnapshot()).toMatchObject({
      phase: "prison",
      finished: true,
      prisonEscaped: false,
      state: { status: "running" },
    });
    session.primaryAction();
    expect(session.getSnapshot()).toMatchObject({
      phase: "prison",
      finished: false,
      paused: false,
      state: { tick: 0 },
    });
  });

  it("teaches wall reversal and landing before the upper jump without pausing play", () => {
    const session = createSession();
    session.step(44);
    session.jump();
    session.step(149);
    session.play();
    expect(session.getSnapshot().state.player.wall).toBe(1);
    expect(sessionView(session.getSnapshot()).status).toContain("Jump off the wall");

    session.jump();
    session.step(31);
    session.play();
    expect(session.getSnapshot().state.player).toMatchObject({
      direction: -1,
      grounded: true,
    });
    expect(sessionView(session.getSnapshot()).status).toContain("jump over the upper saw");
    expect(session.getSnapshot().paused).toBe(false);

    session.step(RULES.maxTicks);
    expect(sessionView(session.getSnapshot()).status).toContain(
      "Land on the ledge, then jump again",
    );
    expect(session.getSnapshot().prisonEscaped).toBe(false);
    session.primaryAction();
    expect(session.getSnapshot().state.collectedTreasureIds).toEqual([]);
  });

  it("leads from prison to build, clear, raid, and revising the same draft", () => {
    const session = createSession();
    finishHumanAttempt(session, PRISON_JUMPS);
    expect(session.getSnapshot()).toMatchObject({
      phase: "escaped",
      prisonEscaped: true,
      paused: true,
    });
    expect(sessionView(session.getSnapshot()).action).toBe("Build your dungeon");
    const escaped = session.observe();
    session.jump();
    session.play();
    session.step();
    session.update(100);
    expect(session.observe()).toEqual(escaped);

    session.primaryAction();
    expect(session.getSnapshot()).toMatchObject({
      phase: "building",
      state: { tick: 0 },
    });
    const draft = session.level;
    session.testDungeon();
    finishHumanAttempt(session);
    expect(session.getSnapshot()).toMatchObject({
      phase: "cleared",
      canSubmit: true,
    });
    expect(sessionView(session.getSnapshot()).action).toBe("Submit & raid");
    session.primaryAction();
    expect(session.getSnapshot()).toMatchObject({
      phase: "raiding",
      canSubmit: false,
      paused: true,
      state: { tick: 0 },
    });
    expect(session.level).toEqual(getDungeon("first-vault"));
    expect(session.getSnapshot().submission?.replay.level).toEqual(draft);
    expect(replayAttempt(session.getSnapshot().submission!.replay).state.status).toBe("won");

    finishHumanAttempt(session, [34, 106]);
    expect(session.getSnapshot().phase).toBe("raid-complete");
    expect(sessionView(session.getSnapshot()).action).toBe("Revise your dungeon");
    session.primaryAction();
    expect(session.getSnapshot()).toMatchObject({
      phase: "building",
      canSubmit: true,
      prisonEscaped: true,
    });
    expect(session.level).toEqual(draft);
  });

  it("freezes the submitted proof when the player later changes their draft", () => {
    const session = createSession();
    submit(session);
    const submission = session.observe().submission!;
    session.editDungeon();
    session.edit({
      type: "put",
      object: {
        kind: "saw",
        value: { id: "new-saw", x: 400, y: 398, radius: 22 },
      },
    });
    expect(session.observe().submission).toEqual(submission);
    expect(session.getSnapshot()).toMatchObject({
      layoutRevision: 1,
      canSubmit: false,
      clearedRevision: null,
    });
    submission.replay.level.treasures.length = 0;
    expect(session.observe().submission!.replay.level.treasures).toHaveLength(1);
  });

  it("prevents importing a successful replay from advancing any human activity", () => {
    const session = createSession();
    session.loadSchedule(PRISON_JUMPS);
    session.step(RULES.maxTicks);
    expect(session.getSnapshot()).toMatchObject({
      phase: "replay",
      prisonEscaped: false,
      state: { status: "won" },
    });
    expect(() => session.editDungeon()).toThrow();
    session.reset();
    expect(session.getSnapshot()).toMatchObject({
      phase: "prison",
      mode: "human",
      state: { tick: 0 },
    });
    submit(session);

    session.loadReplay({
      version: 2,
      rulesVersion: RULES.version,
      level: getPrison(),
      jumpTicks: PRISON_JUMPS,
      endTick: PRISON_END_TICK,
    });
    session.step(RULES.maxTicks);
    expect(session.getSnapshot()).toMatchObject({
      phase: "replay",
      flow: { returnTo: "raiding" },
      canSubmit: false,
      state: { status: "won" },
    });
    expect(() => session.testDungeon()).toThrow();
    expect(() => session.submitDungeon()).toThrow();
    session.primaryAction();
    expect(session.level).toEqual(getDungeon("first-vault"));
    expect(session.getSnapshot()).toMatchObject({
      phase: "raiding",
      mode: "human",
      paused: false,
      state: { tick: 0 },
    });
  });

  it("keeps failed imports atomic and starts schedules on the canonical room", () => {
    const session = createSession();
    session.step(10);
    const before = session.observe();
    expect(() => session.loadReplay({ version: 1 })).toThrow();
    expect(() => session.loadSchedule([1, 1])).toThrow();
    expect(session.observe()).toEqual(before);
    session.loadReplay({
      version: 2,
      rulesVersion: RULES.version,
      level: getDungeon("first-vault"),
      jumpTicks: [],
      endTick: 10,
    });
    session.loadSchedule(PRISON_JUMPS);
    expect(session.level).toEqual(getPrison());
    session.step(RULES.maxTicks);
    expect(session.getSnapshot()).toMatchObject({
      phase: "replay",
      prisonEscaped: false,
    });
  });

  it("does not duplicate transitions when paused or updated after a clear", () => {
    const session = createSession();
    submit(session);
    const proof = session.observe().submission;
    finishHumanAttempt(session, [34, 106]);
    session.pause();
    session.pause();
    session.update(1000);
    expect(session.getSnapshot().phase).toBe("raid-complete");
    expect(session.observe().submission).toEqual(proof);
  });
});
