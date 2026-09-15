import { parseJumpTicks } from "../validation";
import { RULES } from "./rules";
import { initialState, step } from "./simulation";
import type { AttemptResult, GameEvent, Level, Replay, State } from "./types";

type RecordingOptions = { recordTrace?: boolean };

export function runAttempt(
  level: Level,
  jumpTicks: number[],
  maxTicks: number = RULES.maxTicks,
  { recordTrace = true }: RecordingOptions = {},
): AttemptResult {
  const jumps = new Set(parseJumpTicks(jumpTicks, maxTicks));
  let state = initialState(level);
  const events: GameEvent[] = [];
  const trajectory: State[] = recordTrace ? [state] : [];

  while (state.status === "running" && state.tick < maxTicks) {
    const next = step(level, state, { jump: jumps.has(state.tick) });
    state = next.state;
    if (recordTrace) {
      events.push(...next.events);
      trajectory.push(state);
    }
  }

  return {
    state,
    events,
    trajectory,
    stopReason: state.status === "running" ? "tick-limit" : state.status,
  };
}

export function replayAttempt(
  replay: Replay,
  options: RecordingOptions = {},
): AttemptResult {
  return runAttempt(replay.level, replay.jumpTicks, replay.endTick, options);
}
