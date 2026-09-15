import { RULES } from "../../shared/game/rules";
import { replayAttempt } from "../../shared/game/replay";
import { initialState, step } from "../../shared/game/simulation";
import { parseLevel, parseReplay } from "../../shared/validation";
import type { GameEvent, Level, Replay } from "../../shared/game/types";

const TICK_DURATION_MS = 1000 / RULES.tickRate;
const MAX_FRAME_DELTA_MS = 100;

export function createAttempt(initialLevel: Level) {
  let level = parseLevel(initialLevel);
  let state = initialState(level);
  let previousState = state;
  let paused = true;
  let accumulator = 0;
  let pendingJump = false;
  let jumps: number[] = [];
  let mode: "human" | "replay" = "human";
  let schedule = new Set<number>();
  let endTick = Infinity;

  const listeners = new Set<() => void>();
  const eventListeners = new Set<(events: GameEvent[]) => void>();
  let snapshot = makeSnapshot();

  function makeSnapshot() {
    return {
      state,
      paused,
      mode,
      endTick,
      finished: isFinished(),
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function resetAttempt() {
    state = initialState(level);
    previousState = state;
    paused = true;
    accumulator = 0;
    pendingJump = false;
    jumps = [];
  }

  function resetToHuman() {
    mode = "human";
    endTick = Infinity;
    schedule = new Set();
    resetAttempt();
  }

  function isFinished() {
    return state.status !== "running" || state.tick >= endTick;
  }

  function advanceTick() {
    if (isFinished()) {
      paused = true;
      return;
    }

    const jump = mode === "replay" ? schedule.has(state.tick) : pendingJump;
    if (jump) jumps.push(state.tick);

    const result = step(level, state, { jump });
    pendingJump = false;
    previousState = state;
    state = result.state;

    eventListeners.forEach((fn) => fn(result.events));
    if (isFinished()) paused = true;
  }

  return {
    frameState: () => state,
    renderFrame: () => ({
      previous: previousState,
      current: state,
      alpha: paused
        ? 1
        : Math.max(0, Math.min(1, accumulator / TICK_DURATION_MS)),
    }),
    getSnapshot: () => snapshot,
    exportReplay: (): Replay => ({
      version: 2,
      rulesVersion: RULES.version,
      level: structuredClone(level),
      jumpTicks: [...jumps],
      endTick: state.tick,
    }),

    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    onEvents: (fn: (events: GameEvent[]) => void) => {
      eventListeners.add(fn);
      return () => {
        eventListeners.delete(fn);
      };
    },

    primaryAction() {
      if (isFinished()) resetToHuman();

      if (paused) {
        paused = false;
        previousState = state;
        accumulator = 0;
      } else if (mode === "human") {
        pendingJump = true;
        return;
      } else {
        return;
      }

      notify();
    },

    jump() {
      if (isFinished() || mode !== "human") return;

      pendingJump = true;
    },

    play() {
      if (isFinished()) return;

      paused = false;
      previousState = state;
      accumulator = 0;
      notify();
    },

    pause: () => {
      paused = true;
      accumulator = 0;
      notify();
    },

    step(ticks = 1) {
      if (!Number.isInteger(ticks) || ticks < 1 || ticks > RULES.maxTicks)
        throw new Error("Step count must be 1–1800.");

      paused = true;
      accumulator = 0;
      for (let i = 0; i < ticks && !isFinished(); i++) advanceTick();
      notify();
    },

    loadLevel(value: unknown) {
      level = parseLevel(value);
      resetToHuman();
      notify();
    },

    reset() {
      resetToHuman();
      notify();
    },

    loadReplay(value: unknown) {
      // Validate completely before modifying the live session.
      const replay = parseReplay(value);

      level = replay.level;
      mode = "replay";
      endTick = replay.endTick;
      schedule = new Set(replay.jumpTicks);
      resetAttempt();
      notify();
    },

    restore(value: Replay, recording?: Replay) {
      const replay = parseReplay(value, RULES.maxRestoredClearTicks);
      const restored = replayAttempt(replay, { recordTrace: false });
      if (restored.state.tick !== replay.endTick)
        throw new Error("Invalid saved attempt.");
      level = replay.level;
      resetToHuman();
      state = previousState = restored.state;
      jumps = [...replay.jumpTicks];
      if (recording) {
        mode = "replay";
        endTick = recording.endTick;
        schedule = new Set(recording.jumpTicks);
      }
      notify();
    },

    update(deltaMs: number) {
      if (paused || !Number.isFinite(deltaMs) || deltaMs < 0) return;

      // Cap catch-up after a stall; simulation never skips ticks. Hidden tabs pause separately.
      accumulator += Math.min(deltaMs, MAX_FRAME_DELTA_MS);
      const collected = state.collectedTreasureIds.length;

      while (accumulator + 1e-8 >= TICK_DURATION_MS && !paused) {
        accumulator -= TICK_DURATION_MS;
        advanceTick();
      }

      // Phaser reads frameState directly. React only needs visible changes.
      if (paused || state.collectedTreasureIds.length !== collected) notify();
    },
  };
}

export type Attempt = ReturnType<typeof createAttempt>;

export type AttemptSnapshot = ReturnType<Attempt["getSnapshot"]>;
