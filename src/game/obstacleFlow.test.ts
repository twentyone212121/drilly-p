import { describe, expect, it } from "vitest";
import { createSession, type Session } from "./session";
import { newPlayerDungeon } from "../../shared/game/campaign";
import { getObstacleLab, type LabRoomId } from "../../shared/game/obstacleLab";
import { RULES } from "../../shared/game/rules";
import { runAttempt, replayAttempt } from "../../shared/game/replay";
import {
  applyEdit,
  editorObjects,
  moveObject,
  newObject,
  objectBounds,
  placementError,
} from "./editor";
import { runDrillyFixture } from "./drillyFixture";
import type { ObstacleKind } from "../../shared/game/obstacleTypes";

const solutions: Record<LabRoomId, number[]> = {
  showcase: [13, 86, 140],
  spikes: [26, 147],
  slider: [3, 65, 131],
  fixed: [5, 67, 119],
  flame: [48, 96, 183],
  aimed: [45, 97, 145],
  drone: [4, 56, 139],
  pursuer: [56, 123],
};
function finish(session: Session, jumps: number[] = []) {
  for (const tick of jumps) {
    session.step(tick - session.frameState().tick);
    session.jump();
    session.step();
  }
  session.step(RULES.maxTicks);
}

describe("obstacle lab and editor", () => {
  it.each(Object.entries(solutions))("has a reproducible clear route for %s", (id, jumps) => {
    expect(runAttempt(getObstacleLab(id as LabRoomId), jumps).state.status).toBe("won");
  });
  it("allows practice before tutorial without earning escape, clear, or medals", () => {
    const session = createSession();
    const before = session.observe().editorLevel;
    session.openLab("showcase");
    finish(session, solutions.showcase);
    expect(session.observe()).toMatchObject({
      phase: "lab",
      prisonEscaped: false,
      canSubmit: false,
      result: null,
    });
    session.exitLab();
    expect(session.observe()).toMatchObject({
      phase: "prison",
      editorLevel: before,
      state: { tick: 0 },
    });
  });
  it("switches rooms and restarts all hazard state", () => {
    const session = createSession();
    session.openLab("fixed");
    session.step(48);
    expect(session.frameState().projectiles.length).toBeGreaterThan(0);
    session.openLab("pursuer");
    expect(session.frameState().projectiles).toEqual([]);
    expect(session.frameState().tick).toBe(0);
    session.step(40);
    session.reset();
    expect(session.frameState().obstacles[0].phase).toBe("idle");
    expect(session.frameState().tick).toBe(0);
  });
  it("keeps a cleared draft and proof when returning from practice", () => {
    const session = createSession({ prisonLevel: newPlayerDungeon() });
    finish(session);
    session.primaryAction();
    session.testDungeon();
    finish(session);
    session.editDungeon();
    const before = session.observe();
    session.openLab("fixed");
    session.step(100);
    session.exitLab();
    expect(session.observe()).toMatchObject({
      phase: "building",
      canSubmit: true,
      editorLevel: before.editorLevel,
      layoutRevision: before.layoutRevision,
    });
  });
  it.each(["spikes", "slider", "turret", "drone", "pursuer"] as ObstacleKind[])(
    "adds, configures, moves and deletes %s",
    (kind) => {
      const initial = newPlayerDungeon();
      const added = newObject(initial, "obstacle", { x: 300, y: 150 }, kind);
      const level = applyEdit(initial, { type: "put", object: added });
      expect(level.obstacles).toHaveLength(1);
      expect(editorObjects(level).some((o) => o.kind === "obstacle")).toBe(true);
      const moved = moveObject(added, { x: 16, y: 8 });
      expect(objectBounds(moved).x - objectBounds(added).x).toBe(16);
      const changed = applyEdit(level, { type: "put", object: moved });
      if (
        moved.kind === "obstacle" &&
        (moved.value.kind === "slider" || moved.value.kind === "drone")
      ) {
        expect(moved.value.endX - moved.value.x).toBe(RULES.obstacles.pathLength);
      }
      expect(
        applyEdit(changed, { type: "delete", selection: { kind: "obstacle", id: moved.value.id } })
          .obstacles,
      ).toEqual([]);
      expect(initial.obstacles).toBeUndefined();
    },
  );
  it("rejects a route moved outside the room and keeps original geometry", () => {
    const level = newPlayerDungeon();
    const object = newObject(level, "obstacle", { x: 300, y: 150 }, "drone");
    const bad = moveObject(object, { x: 800, y: 0 });
    expect(placementError(level, bad)).not.toBeNull();
    expect(level.obstacles).toBeUndefined();
  });
  it("changing obstacle settings invalidates a clear and survives ghost replay", async () => {
    const draft = newPlayerDungeon();
    const added = newObject(draft, "obstacle", { x: 300, y: 150 }, "drone");
    const level = applyEdit(draft, { type: "put", object: added });
    const session = createSession({
      prisonLevel: draft,
      editorLevel: level,
      developmentFixture: true,
    });
    finish(session);
    session.primaryAction();
    session.testDungeon();
    finish(session);
    expect(session.observe().canSubmit).toBe(true);
    session.editDungeon();
    session.edit({ type: "put", object: moveObject(added, { x: 8, y: 0 }) });
    expect(session.observe().canSubmit).toBe(false);
    session.testDungeon();
    finish(session);
    session.submitDungeon();
    session.reset();
    session.reset();
    session.reset();
    await Promise.resolve();
    session.primaryAction();
    expect(session.observe().phase).toBe("ghost");
    const replay = session.observe().round!.drilly[0].replay;
    session.step(RULES.maxTicks);
    expect(session.frameState()).toEqual(replayAttempt(replay).state);
    expect(replay.level.obstacles).toEqual(session.observe().editorLevel.obstacles);
  });
  it("runs scripted Drilly on the same complete obstacle snapshot", () => {
    for (const attempt of runDrillyFixture(getObstacleLab("showcase"))) {
      expect(replayAttempt(attempt.replay).stopReason).toBe(attempt.outcome);
      expect(attempt.replay.level.obstacles).toHaveLength(7);
    }
  });
});
