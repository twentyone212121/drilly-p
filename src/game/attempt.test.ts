import { describe, expect, it } from "vitest";
import checkpoint from "../../shared/levels/checkpoint.json";
import { parseLevel } from "../../shared/validation";
import { replayAttempt, runAttempt } from "../../shared/game/replay";
import { createAttempt } from "./attempt";
const level = parseLevel(checkpoint);

describe("attempt clock and headless parity", () => {
  it.each([
    { name: "death", jumps: [], endTick: 51 },
    { name: "win", jumps: [44, 193], endTick: 246 },
    { name: "recorded limit", jumps: [], endTick: 12 },
    { name: "empty recording", jumps: [], endTick: 0 },
  ])(
    "marks $name complete for controls, then resets it",
    ({ jumps, endTick }) => {
      const session = createAttempt(level);
      const replay = { ...session.exportReplay(), jumpTicks: jumps, endTick };
      session.loadReplay(replay);
      session.step(Math.max(1, endTick));

      expect(session.getSnapshot().finished).toBe(true);
      const before = session.getSnapshot();
      session.play();
      session.jump();
      expect(session.getSnapshot()).toEqual(before);

      session.reset();
      expect(session.getSnapshot()).toMatchObject({
        finished: false,
        paused: true,
        mode: "human",
        state: { tick: 0 },
      });
    },
  );

  it("starts and resumes with the primary action without adding a jump", () => {
    const session = createAttempt(level);
    session.primaryAction();
    expect(session.getSnapshot()).toMatchObject({
      paused: false,
      pendingJump: false,
    });

    session.update(1000 / 60);
    session.pause();
    session.primaryAction();
    session.update(1000 / 60);

    expect(session.frameState().tick).toBe(2);
    expect(session.exportReplay().jumpTicks).toEqual([]);
    expect(session.frameState().player.grounded).toBe(true);
  });

  it("jumps with the primary action during active human play", () => {
    const session = createAttempt(level);
    session.primaryAction();
    session.update(1000 / 60);
    session.primaryAction();
    session.update(1000 / 60);

    expect(session.exportReplay().jumpTicks).toEqual([1]);
    expect(session.frameState().player.vy).toBeLessThan(0);
    expect(session.getSnapshot().paused).toBe(false);
  });

  it("resumes a replay without injecting human jumps", () => {
    const session = createAttempt(level);
    session.loadReplay({
      ...session.exportReplay(),
      jumpTicks: [44, 193],
      endTick: 246,
    });
    session.primaryAction();
    session.primaryAction();
    session.update(1000 / 60);

    expect(session.getSnapshot()).toMatchObject({
      paused: false,
      pendingJump: false,
      mode: "replay",
    });
    expect(session.exportReplay().jumpTicks).toEqual([]);
  });

  it.each([[1000 / 30], [1000 / 60], [1000 / 144], [10, 21, 40, 9]])(
    "has identical trajectories at frame intervals %j",
    (...intervals: number[]) => {
      const session = createAttempt(level);
      session.loadReplay({
        ...session.exportReplay(),
        jumpTicks: [44, 193],
        endTick: 246,
      });
      const trajectory = [session.frameState()];
      session.onEvents(() => trajectory.push(session.frameState()));
      session.play();
      for (
        let frame = 0;
        !session.getSnapshot().paused && frame < 5000;
        frame++
      )
        session.update(intervals[frame % intervals.length]);
      expect(session.frameState().status).toBe("won");
      expect(trajectory).toEqual(runAttempt(level, [44, 193]).trajectory);
    },
  );
  it("records manual inputs and replays exactly, including ignored inputs", () => {
    const session = createAttempt(level);
    session.step(44);
    session.jump();
    session.step(1);
    session.jump();
    session.step(148);
    session.jump();
    session.step(53);
    expect(session.exportReplay().jumpTicks).toEqual([44, 45, 193]);
    expect(replayAttempt(session.exportReplay()).state).toEqual(
      session.frameState(),
    );
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

  it("resets pending input, events, clock and terminal state", () => {
    const session = createAttempt(level);
    session.step(51);
    session.reset();
    session.jump();
    session.reset();
    expect(session.getSnapshot()).toMatchObject({
      paused: true,
      pendingJump: false,
      events: [],
      jumps: [],
      state: { tick: 0, status: "running" },
    });
    session.step();
    expect(session.frameState().player.grounded).toBe(true);
  });

  it("ignores human jumps during replay and stops at the recorded end tick", () => {
    const session = createAttempt(level);
    session.step(12);
    const replay = session.exportReplay();
    session.loadReplay(replay);
    session.jump();
    session.play();
    session.update(100);
    session.update(100);
    session.update(100);
    expect(session.getSnapshot()).toMatchObject({
      jumps: [],
      paused: true,
      state: { tick: 12 },
    });
  });

  it("invalid replay import leaves an existing attempt untouched", () => {
    const session = createAttempt(level);
    session.step(10);
    const before = session.getSnapshot();
    expect(() => session.loadReplay({ version: 3 })).toThrow();
    expect(session.getSnapshot()).toEqual(before);
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
