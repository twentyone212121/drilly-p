import { RULES } from "../../shared/game/rules";
import { initialState, step } from "../../shared/game/simulation";
import { parseLevel, parseJumpTicks, parseReplay } from "../../shared/validation";
import type { GameEvent, Level, Replay, State } from "../../shared/game/types";

const TICK_DURATION_MS = 1000 / RULES.tickRate;
const MAX_FRAME_DELTA_MS = 100;
const SNAPSHOT_INTERVAL_TICKS = 6;

export function createAttempt(initialLevel: Level) {
  let level = parseLevel(initialLevel);
  let state = initialState(level);
  let levelRevision = 0;
  let paused = true;
  let accumulator = 0;
  let pendingJump = false;
  let jumps: number[] = [];
  let events: GameEvent[] = [];
  let trajectory: State[] = [state];
  let mode: "human" | "replay" = "human";
  let schedule = new Set<number>();
  let endTick: number = RULES.maxTicks;

  const listeners = new Set<() => void>();
  const eventListeners = new Set<(events: GameEvent[]) => void>();
  let snapshot = makeSnapshot();

  function makeSnapshot() {
    return {
      state,
      paused,
      mode,
      pendingJump,
      jumps: [...jumps],
      events: [...events],
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
    paused = true;
    accumulator = 0;
    pendingJump = false;
    jumps = [];
    events = [];
    trajectory = [state];
  }

  function resetToHuman() {
    mode = "human";
    endTick = RULES.maxTicks;
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
    state = result.state;
    events.push(...result.events);
    trajectory.push(state);

    eventListeners.forEach((fn) => fn(result.events));
    if (isFinished()) paused = true;
  }

  return {
    get level() {
      return structuredClone(level);
    },

    get levelRevision() {
      return levelRevision;
    },

    frameState: () => state,
    getSnapshot: () => snapshot,
    observe: () => structuredClone(makeSnapshot()),
    trajectory: () => structuredClone(trajectory),
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
        accumulator = 0;
      } else if (mode === "human") {
        pendingJump = true;
      } else {
        return;
      }

      notify();
    },

    jump() {
      if (isFinished() || mode !== "human") return;

      pendingJump = true;
      notify();
    },

    play() {
      if (isFinished()) return;

      paused = false;
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
      levelRevision++;
      resetToHuman();
      notify();
    },

    reset() {
      resetToHuman();
      notify();
    },

    loadSchedule(ticks: unknown) {
      const validated = parseJumpTicks(ticks);

      mode = "replay";
      endTick = RULES.maxTicks;
      schedule = new Set(validated);
      resetAttempt();
      notify();
    },

    loadReplay(value: unknown) {
      // Validate completely before modifying the live session.
      const replay = parseReplay(value);

      level = replay.level;
      levelRevision++;
      mode = "replay";
      endTick = replay.endTick;
      schedule = new Set(replay.jumpTicks);
      resetAttempt();
      notify();
    },

    update(deltaMs: number) {
      if (paused || !Number.isFinite(deltaMs) || deltaMs < 0) return;

      // Cap catch-up after a stall; simulation never skips ticks. Hidden tabs pause separately.
      accumulator += Math.min(deltaMs, MAX_FRAME_DELTA_MS);
      const previousEventCount = events.length;
      const previousTick = state.tick;

      while (accumulator + 1e-8 >= TICK_DURATION_MS && !paused) {
        accumulator -= TICK_DURATION_MS;
        advanceTick();
      }

      if (
        paused ||
        events.length !== previousEventCount ||
        Math.floor(previousTick / SNAPSHOT_INTERVAL_TICKS) !==
          Math.floor(state.tick / SNAPSHOT_INTERVAL_TICKS)
      )
        notify();
    },
  };
}

export type Attempt = ReturnType<typeof createAttempt>;

export type AttemptSnapshot = ReturnType<Attempt["getSnapshot"]>;
