import { RULES } from "../../shared/game/rules";
import { interpolateFrame } from "./phaser/interpolateFrame";
import { describe, expect, it } from "vitest";
import checkpoint from "../../shared/levels/checkpoint.json";
import { parseLevel } from "../../shared/validation";
import { replayAttempt, runAttempt } from "../../shared/game/replay";
import { createAttempt } from "./attempt";
const level = parseLevel(checkpoint);

describe("attempt clock and headless parity", () => {
  it("starts and resumes without jumping, then jumps during play", () => {
    const session = createAttempt(level);
    session.primaryAction();
    expect(session.getSnapshot()).toMatchObject({
      paused: false,
    });

    session.update(1000 / 60);
    session.pause();
    session.primaryAction();
    session.update(1000 / 60);

    expect(session.frameState().tick).toBe(2);
    expect(session.exportReplay().jumpTicks).toEqual([]);

    session.primaryAction();
    session.update(1000 / 60);

    expect(session.exportReplay().jumpTicks).toEqual([2]);
    expect(session.frameState().player.vy).toBeLessThan(0);
    expect(session.getSnapshot().paused).toBe(false);
  });

  it.each([[1000 / 30], [1000 / 60], [1000 / 144], [10, 21, 40, 9]])(
    "has identical trajectories at frame intervals %j",
    (...intervals: number[]) => {
      const session = createAttempt(level);
      session.loadReplay({
        ...session.exportReplay(),
        jumpTicks: [44, 199, 200],
        endTick: 259,
      });
      const trajectory = [session.frameState()];
      session.onEvents(() => trajectory.push(session.frameState()));
      session.play();
      for (
        let frame = 0;
        !session.getSnapshot().paused && frame < 5000;
        frame++
      ) {
        session.update(intervals[frame % intervals.length]);
        interpolateFrame(session.renderFrame());
      }
      expect(interpolateFrame(session.renderFrame())).toBe(
        session.frameState(),
      );
      expect(session.frameState().status).toBe("won");
      expect(trajectory).toEqual(runAttempt(level, [44, 199, 200]).trajectory);
    },
  );
  it("smooths render-only frames without advancing physics, and snaps on pause or reset", () => {
    const attempt = createAttempt(level);
    attempt.play();
    attempt.update(20);
    const physical = structuredClone(attempt.frameState());
    const replay = attempt.exportReplay();
    const first = interpolateFrame(attempt.renderFrame());
    attempt.update(5);
    const second = interpolateFrame(attempt.renderFrame());
    expect(second.player.x).toBeGreaterThan(first.player.x);
    expect(second.player.x).toBeLessThan(physical.player.x);
    expect(attempt.frameState()).toEqual(physical);
    expect(attempt.exportReplay()).toEqual(replay);
    attempt.pause();
    expect(interpolateFrame(attempt.renderFrame())).toBe(attempt.frameState());
    attempt.reset();
    expect(interpolateFrame(attempt.renderFrame())).toBe(attempt.frameState());
  });

  it("records manual inputs and replays exactly, including ignored inputs", () => {
    const session = createAttempt(level);
    session.step(44);
    session.jump();
    session.step(1);
    session.jump();
    session.step(154);
    session.jump();
    session.step(1);
    session.jump();
    session.step(59);
    expect(session.exportReplay().jumpTicks).toEqual([44, 45, 199, 200]);
    expect(replayAttempt(session.exportReplay()).state).toEqual(
      session.frameState(),
    );
    expect(session.frameState().status).toBe("won");
  });

  it("allows a human to wait beyond the old timer and replay a later win", () => {
    const session = createAttempt(level);
    session.step(44);
    session.jump();
    session.step(RULES.maxTicks);
    expect(session.frameState().tick).toBeGreaterThan(RULES.maxTicks);
    expect(session.getSnapshot().finished).toBe(false);
    session.jump();
    session.step(1);
    session.jump();
    session.step(100);
    expect(session.frameState().status).toBe("won");
    const replay = session.exportReplay();
    expect(replayAttempt(replay).state).toEqual(session.frameState());
    session.loadReplay(replay);
    session.step(RULES.maxTicks);
    session.step(200);
    expect(session.getSnapshot().finished).toBe(true);
    expect(session.frameState().status).toBe("won");
  });

  it("freezes while paused and discards partial frame time on resume", () => {
    const session = createAttempt(level);
    session.play();
    session.update(10);
    session.pause();
    session.update(60000);
    expect(session.frameState().tick).toBe(0);
    session.play();
    session.update(10);
    expect(session.frameState().tick).toBe(0);
    session.update(10);
    expect(session.frameState().tick).toBe(1);
  });

  it("resets pending input, clock and terminal state", () => {
    const session = createAttempt(level);
    session.step(51);
    session.reset();
    session.jump();
    session.reset();
    expect(session.getSnapshot()).toMatchObject({
      paused: true,
      state: { tick: 0, status: "running" },
    });
    session.step();
    expect(session.exportReplay().jumpTicks).toEqual([]);
    expect(session.frameState().player.grounded).toBe(true);
  });

  it("ignores human jumps during replay and stops at the recorded end tick", () => {
    const session = createAttempt(level);
    session.step(12);
    const replay = session.exportReplay();
    session.loadReplay(replay);
    session.primaryAction();
    session.primaryAction();
    session.jump();
    session.update(100);
    session.update(100);
    session.update(100);
    expect(session.getSnapshot()).toMatchObject({
      paused: true,
      finished: true,
      state: { tick: 12 },
    });
    expect(session.exportReplay().jumpTicks).toEqual([]);
  });

  it("emits gameplay events once, never on render-only updates", () => {
    const session = createAttempt(level);
    const events: unknown[] = [];
    const off = session.onEvents((next) => events.push(...next));
    session.jump();
    session.step();
    session.update(1000);
    session.update(0);
    expect(events).toHaveLength(1);
    off();
    session.step();
    expect(events).toHaveLength(1);
  });
});
