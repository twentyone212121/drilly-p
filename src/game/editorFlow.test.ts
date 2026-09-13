import { describe, expect, it } from "vitest";
import checkpoint from "../../shared/levels/checkpoint.json";
import { RULES } from "../../shared/game/rules";
import { replayAttempt, runAttempt } from "../../shared/game/replay";
import { parseLevel, parseReplay } from "../../shared/validation";
import { applyEdit, moveObject, newObject, resizePlatform, type Edit } from "./editor";
import { createSession, type Session } from "./session";

const opponent = parseLevel(checkpoint);
const draft = parseLevel({
  ...opponent,
  id: "player-dungeon",
  name: "Your vault",
  traps: [{ id: "safe-saw", x: 200, y: 96, radius: 24 }],
  treasures: [
    { id: "first", x: 120, y: 392, width: 16, height: 28 },
    { id: "last", x: 240, y: 392, width: 16, height: 28 },
  ],
});

function editingSession(editorLevel = draft) {
  // Editor tests use a trivial tutorial; the real escape route is covered by session tests.
  const session = createSession({ prisonLevel: draft, opponentLevel: opponent, editorLevel });
  session.step(RULES.maxTicks);
  session.primaryAction();
  return session;
}

function clearDungeon(session: Session) {
  session.testDungeon();
  session.step(RULES.maxTicks);
  expect(session.getSnapshot()).toMatchObject({
    state: { status: "won" },
    canSubmit: true,
  });
}

describe("local editor / clear / submit flow", () => {
  it("keeps editing idle and rejects submission until every treasure is collected", () => {
    const session = editingSession();
    session.primaryAction();
    session.jump();
    session.play();
    session.step(20);
    session.update(100);
    expect(session.frameState().tick).toBe(0);
    expect(() => session.submitDungeon()).toThrow("Clear the current");

    session.testDungeon();
    session.step(20);
    expect(session.frameState().collectedTreasureIds).toEqual(["first"]);
    expect(session.getSnapshot().canSubmit).toBe(false);
    session.step(20);
    expect(session.getSnapshot().canSubmit).toBe(true);
  });

  it("isolates test state, observations, retries, and raids from the saved draft", () => {
    const source = structuredClone(draft);
    const session = editingSession(source);
    source.treasures.length = 0;
    clearDungeon(session);
    expect(session.observe().editorLevel).toEqual(draft);
    const observed = session.observe();
    observed.editorLevel.platforms.length = 0;
    const active = session.level;
    active.treasures.length = 0;
    expect(session.observe().editorLevel).toEqual(draft);

    session.reset();
    expect(session.frameState().collectedTreasureIds).toEqual([]);
    expect(session.getSnapshot().canSubmit).toBe(true);
    session.submitDungeon();
    expect(session.getSnapshot()).toMatchObject({
      phase: "raiding",
      mode: "human",
      paused: true,
      canSubmit: false,
      state: { tick: 0 },
    });
    expect(session.level).toEqual(opponent);
    session.step(51);
    session.editDungeon();
    expect(session.level).toEqual(draft);
    expect(session.getSnapshot()).toMatchObject({
      phase: "building",
      canSubmit: true,
    });
  });

  it("disallows edits during a test and preserves the completed clear", () => {
    const session = editingSession();
    clearDungeon(session);
    const before = session.observe();
    expect(() =>
      session.edit({
        type: "delete",
        selection: { kind: "treasure", id: "first" },
      }),
    ).toThrow("Return to editing");
    expect(session.observe()).toEqual(before);
  });

  const changes: { name: string; edit: Edit }[] = [
    {
      name: "add platform",
      edit: {
        type: "put",
        object: newObject(draft, "platform", { x: 200, y: 96 }),
      },
    },
    {
      name: "add saw",
      edit: { type: "put", object: newObject(draft, "saw", { x: 200, y: 96 }) },
    },
    {
      name: "add treasure",
      edit: {
        type: "put",
        object: newObject(draft, "treasure", { x: 200, y: 96 }),
      },
    },
    {
      name: "move treasure",
      edit: {
        type: "put",
        object: moveObject({ kind: "treasure", value: draft.treasures[0] }, { x: 8, y: 0 }),
      },
    },
    {
      name: "move platform",
      edit: {
        type: "put",
        object: moveObject({ kind: "platform", value: draft.platforms[3] }, { x: 8, y: 0 }),
      },
    },
    {
      name: "move saw",
      edit: {
        type: "put",
        object: moveObject({ kind: "saw", value: draft.traps[0] }, { x: 8, y: 0 }),
      },
    },
    {
      name: "resize platform",
      edit: {
        type: "put",
        object: resizePlatform({ kind: "platform", value: draft.platforms[3] }, { x: 8, y: 0 }),
      },
    },
    {
      name: "delete treasure",
      edit: { type: "delete", selection: { kind: "treasure", id: "first" } },
    },
    {
      name: "delete platform",
      edit: {
        type: "delete",
        selection: { kind: "platform", id: "vault-ledge" },
      },
    },
    {
      name: "delete saw",
      edit: { type: "delete", selection: { kind: "saw", id: "safe-saw" } },
    },
  ];

  it.each(changes)("invalidates a clear on $name", ({ edit }) => {
    const session = editingSession();
    clearDungeon(session);
    session.editDungeon();
    session.edit(edit);
    expect(session.getSnapshot()).toMatchObject({
      layoutRevision: 1,
      clearedRevision: null,
      canSubmit: false,
    });
    expect(() => session.submitDungeon()).toThrow();
  });

  it("does not invalidate clears for no-op edits, previews, or rejected placements", () => {
    const session = editingSession();
    clearDungeon(session);
    session.editDungeon();
    const before = session.observe();
    session.edit({
      type: "put",
      object: { kind: "platform", value: draft.platforms[0] },
    });
    applyEdit(draft, {
      type: "put",
      object: newObject(draft, "saw", { x: 200, y: 96 }),
    });
    expect(() =>
      session.edit({
        type: "put",
        object: newObject(draft, "saw", draft.spawn),
      }),
    ).toThrow();
    expect(session.observe()).toEqual(before);
  });

  it("requires another clear even if an edit is moved back to its original geometry", () => {
    const session = editingSession();
    clearDungeon(session);
    session.editDungeon();
    session.edit(changes[3].edit);
    session.edit({
      type: "put",
      object: { kind: "treasure", value: draft.treasures[0] },
    });
    expect(session.observe()).toMatchObject({
      editorLevel: draft,
      layoutRevision: 2,
      canSubmit: false,
    });
    clearDungeon(session);
    expect(session.getSnapshot().clearedRevision).toBe(2);
  });

  it("allows deleting the last treasure but blocks testing until one is added", () => {
    const session = editingSession();
    for (const treasure of draft.treasures) {
      session.edit({
        type: "delete",
        selection: { kind: "treasure", id: treasure.id },
      });
    }
    const before = session.observe();
    expect(() => session.testDungeon()).toThrow("at least one treasure");
    expect(session.observe()).toEqual(before);
    session.edit({
      type: "put",
      object: { kind: "treasure", value: draft.treasures[0] },
    });
    clearDungeon(session);
  });

  it("never awards a clear for a loaded schedule, own replay, foreign replay, death, or tick limit", () => {
    const session = editingSession();
    session.testDungeon();
    session.loadSchedule([]);
    session.step(RULES.maxTicks);
    expect(session.frameState().status).toBe("won");
    expect(session.getSnapshot().canSubmit).toBe(false);
    session.loadReplay(session.exportReplay());
    session.step(RULES.maxTicks);
    expect(session.getSnapshot().canSubmit).toBe(false);

    session.loadReplay({
      ...session.exportReplay(),
      level: opponent,
      jumpTicks: [44, 193],
      endTick: 246,
    });
    session.step(RULES.maxTicks);
    expect(session.frameState().status).toBe("won");
    expect(session.getSnapshot().canSubmit).toBe(false);
    session.primaryAction();
    expect(session.level).toEqual(draft);
    expect(session.frameState().tick).toBe(0);
    expect(session.getSnapshot().mode).toBe("human");

    const lethal = editingSession(opponent);
    lethal.testDungeon();
    lethal.step(RULES.maxTicks);
    expect(lethal.frameState().status).toBe("dead");
    expect(lethal.getSnapshot().canSubmit).toBe(false);

    const unreachable = editingSession({
      ...draft,
      treasures: [{ ...draft.treasures[0], y: 100 }],
    });
    unreachable.testDungeon();
    unreachable.step(RULES.maxTicks);
    expect(unreachable.getSnapshot()).toMatchObject({
      finished: true,
      canSubmit: false,
      state: { status: "running" },
    });
  });
});

describe("edited dungeon replay determinism", () => {
  it.each([[1000 / 30], [1000 / 144], [7, 31, 19, 4]])(
    "replays edited geometry and multiple treasures across frame intervals %j",
    (...intervals: number[]) => {
      const replayDraft = {
        ...draft,
        treasures: [draft.treasures[0], { ...draft.treasures[1], x: 360 }],
      };
      const session = editingSession(replayDraft);
      const platform = newObject(replayDraft, "platform", { x: 176, y: 360 });
      session.edit({ type: "put", object: platform });
      session.testDungeon();
      session.step(10);
      session.jump();
      session.step(1);
      session.jump(); // Record an ignored airborne input too.
      session.step(RULES.maxTicks);
      expect(session.frameState().status).toBe("won");
      const recording = parseReplay(JSON.parse(JSON.stringify(session.exportReplay())));
      const original = session.trajectory();
      const result = replayAttempt(recording);
      expect(result.trajectory).toEqual(original);
      expect(result.events).toEqual(session.observe().events);
      expect(result).toEqual(runAttempt(recording.level, recording.jumpTicks, recording.endTick));

      session.editDungeon();
      session.edit({
        type: "delete",
        selection: { kind: "platform", id: platform.value.id },
      });
      session.testDungeon();
      session.loadReplay(recording);
      session.play();
      for (let frame = 0; !session.getSnapshot().paused && frame < 10000; frame++) {
        session.update(intervals[frame % intervals.length]);
      }
      expect(session.trajectory()).toEqual(original);
      expect(session.observe().events).toEqual(result.events);
      expect(session.getSnapshot().canSubmit).toBe(false);
      session.reset();
      expect(session.level).toEqual(replayDraft);
    },
  );
});
