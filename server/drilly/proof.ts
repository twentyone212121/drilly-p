import { replayAttempt, runAttempt } from "../../shared/game/replay";
import { RULES } from "../../shared/game/rules";
import type { Level } from "../../shared/game/types";
import type { DrillyStrategy } from "../../shared/game/drilly";
import { playAttempt } from "./attempt";

// Timing variation is useful feedback, not another whole-room rejection rule.
export function timingScore(level: Level, jumps: number[]) {
  return [
    -RULES.drilly.timingTolerance,
    0,
    RULES.drilly.timingTolerance,
  ].filter(
    (offset) =>
      runAttempt(
        level,
        [...new Set(jumps.map((tick) => Math.max(0, tick + offset)))].filter(
          (tick) => tick < RULES.maxTicks,
        ),
      ).stopReason === "won",
  ).length;
}

export async function practiceRoom(level: Level, strategy: DrillyStrategy) {
  const result = await playAttempt(level, async () => strategy, [], strategy);
  const replay = replayAttempt(result.attempt.replay);
  const cleared =
    result.attempt.outcome === "won" && replay.stopReason === "won";
  return {
    replay: result.attempt.replay,
    cleared,
    timingScore: cleared
      ? timingScore(level, result.attempt.replay.jumpTicks)
      : 0,
    meaningful: cleared && runAttempt(level, []).stopReason !== "won",
    feedback: result.feedback,
    landings: replay.events
      .filter(
        (event) =>
          event.type === "landed" ||
          event.type === "wall-contact" ||
          event.type === "died",
      )
      .map((event) => {
        const p = replay.trajectory[event.tick]?.player;
        return { ...event, x: p?.x, y: p?.y };
      }),
  };
}
