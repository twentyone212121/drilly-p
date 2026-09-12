import { describe, expect, it } from "vitest";
import { RULES } from "../../shared/game/rules";
import { runDrillyFixture } from "./drillyFixture";
import { replayAttempt } from "../../shared/game/replay";
import { scoreRound, type RaidAttempt } from "../../shared/game/round";
import { createSession, type Session } from "./session";

function finish(session: Session, jumps: number[] = []) {
  for (const tick of jumps) {
    const advance = tick - session.frameState().tick;
    if (advance) session.step(advance);
    session.jump();
    session.step();
  }
  session.step(RULES.maxTicks);
}

function ready(fixture = true) {
  const session = createSession({ developmentFixture: fixture });
  finish(session, [44, 193, 228]);
  session.primaryAction();
  session.testDungeon();
  finish(session);
  session.submitDungeon();
  return session;
}

async function results(session: Session) {
  await Promise.resolve();
  session.primaryAction();
  while (session.getSnapshot().phase === "ghost") {
    session.step(RULES.maxTicks);
    session.primaryAction();
  }
}

describe("scored local rounds", () => {
  it("counts death, restart and timeout once, with no fourth attempt", () => {
    const session = ready();
    finish(session);
    expect(session.observe().round?.human.map((a) => a.outcome)).toEqual(["dead"]);
    session.pause();
    session.step();
    expect(session.observe().round?.human).toHaveLength(1);
    session.reset();
    session.play();
    session.pause();
    expect(session.observe().round?.human).toHaveLength(1);
    session.reset();
    expect(session.observe().round?.human.map((a) => a.outcome)).toEqual(["dead", "restart"]);
    finish(session);
    session.reset();
    expect(session.observe().round?.human).toHaveLength(3);
    expect(session.observe().phase).toBe("raid-complete");
  });

  it("counts a tick limit as failure", () => {
    const base = createSession().observe().editorLevel;
    const session = createSession({
      prisonLevel: base,
      opponentLevel: { ...base, treasures: [{ ...base.treasures[0], y: 48 }] },
    });
    finish(session);
    session.primaryAction();
    session.testDungeon();
    finish(session);
    session.submitDungeon();
    finish(session);
    expect(session.observe().round?.human[0].outcome).toBe("tick-limit");
  });

  it("finishes on first clear, reviews deterministic ghosts and awards only once", async () => {
    const session = ready();
    const draft = session.observe().editorLevel;
    finish(session, [34, 106]);
    expect(session.observe().round?.human).toHaveLength(1);
    await Promise.resolve();
    expect(session.observe().round?.drilly).toHaveLength(1);
    session.primaryAction();
    const recording = session.observe().round!.drilly[0].replay;
    session.play();
    while (!session.getSnapshot().finished) session.update(1000 / 144);
    expect(session.trajectory()).toEqual(replayAttempt(recording).trajectory);
    expect(session.observe().result).toBeNull();
    session.primaryAction();
    const awarded = session.observe().result;
    expect(awarded).toMatchObject({
      attack: 3,
      defense: 0,
      total: 3,
      outcome: "draw",
      improved: true,
    });
    session.replayGhost();
    session.step(RULES.maxTicks);
    session.primaryAction();
    expect(session.observe().result).toEqual(awarded);
    session.primaryAction();
    expect(session.observe()).toMatchObject({
      phase: "building",
      editorLevel: draft,
      prisonEscaped: true,
      best: 3,
    });
    session.submitDungeon();
    finish(session);
    session.reset();
    finish(session);
    session.reset();
    finish(session);
    await results(session);
    expect(session.observe().result).toMatchObject({
      total: 0,
      best: 3,
      improved: false,
    });
  });

  it("abandons interruptions and ignores fixture results for an old round", async () => {
    const session = ready();
    finish(session, [34, 106]);
    session.editDungeon();
    session.submitDungeon();
    await Promise.resolve();
    expect(session.observe().round?.drilly).toEqual([]);
    expect(session.observe().best).toBeNull();
    session.editDungeon();
    expect(session.observe()).toMatchObject({
      round: null,
      result: null,
      best: null,
    });
  });

  it("does not award medals without a source or from developer playback", async () => {
    const session = ready(false);
    finish(session, [34, 106]);
    await Promise.resolve();
    expect(session.observe()).toMatchObject({ result: null, best: null });
    session.primaryAction();
    session.submitDungeon();
    session.loadSchedule([34, 106]);
    finish(session);
    expect(session.observe()).toMatchObject({
      phase: "replay",
      round: null,
      result: null,
      best: null,
    });
  });

  it("fixture outcomes come from simulation, stop on success, and isolate geometry", () => {
    const level = createSession().observe().editorLevel;
    const attempts = runDrillyFixture(level);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe("won");
    level.treasures.length = 0;
    expect(replayAttempt(attempts[0].replay).stopReason).toBe("won");
  });
});

it("scores all success positions, failures, outcomes and best updates", () => {
  const replay = createSession().exportReplay();
  const attempts = (success: number): RaidAttempt[] =>
    Array.from({ length: success || 3 }, (_, index) => ({
      replay,
      outcome: index + 1 === success ? "won" : "dead",
    }));
  for (let human = 0; human <= 3; human++) {
    for (let drilly = 0; drilly <= 3; drilly++) {
      const attack = human ? 4 - human : 0;
      const defense = drilly ? drilly - 1 : 3;
      const total = attack + defense;
      expect(scoreRound(attempts(human), attempts(drilly), 3)).toEqual({
        attack,
        defense,
        total,
        outcome: total >= 4 ? "win" : total === 3 ? "draw" : "loss",
        best: Math.max(3, total),
        improved: total > 3,
      });
    }
  }
});

it("records three deterministic fixture failures when none clears", async () => {
  const draft = createSession().observe().editorLevel;
  draft.treasures[0].y = 48;
  const attempts = runDrillyFixture(draft);
  expect(attempts).toHaveLength(3);
  for (const attempt of attempts) {
    expect(replayAttempt(attempt.replay).stopReason).toBe(attempt.outcome);
  }
});

it("advances through multiple ghosts in order and preserves each ending", async () => {
  const source = ready(false);
  const dungeon = source.level;
  const session = createSession({
    prisonLevel: createSession().observe().editorLevel,
    editorLevel: dungeon,
    developmentFixture: true,
  });
  finish(session);
  session.primaryAction();
  session.testDungeon();
  finish(session, [34, 106]);
  session.submitDungeon();
  finish(session, [34, 106]);
  await Promise.resolve();
  const recordings = session.observe().round!.drilly;
  expect(recordings.map((attempt) => attempt.outcome)).toEqual(["dead", "won"]);
  session.primaryAction();
  for (let index = 0; index < recordings.length; index++) {
    expect(session.observe().flow).toEqual({ phase: "ghost", index });
    session.step(RULES.maxTicks);
    expect(session.trajectory()).toEqual(replayAttempt(recordings[index].replay).trajectory);
    session.update(100);
    expect(session.observe().flow).toEqual({ phase: "ghost", index });
    session.primaryAction();
  }
  expect(session.observe()).toMatchObject({
    phase: "results",
    result: { attack: 3, defense: 1, total: 4, outcome: "win" },
  });
});
