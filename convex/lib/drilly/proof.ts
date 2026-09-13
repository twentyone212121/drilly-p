import { replayAttempt, runAttempt } from "../../../shared/game/replay";
import type { Level } from "../../../shared/game/types";
import type { DrillyStrategy } from "../../../shared/game/drilly";
import { playAttempt } from "./attempt";

export async function practiceRoom(level: Level, strategy: DrillyStrategy) {
  const result = await playAttempt(level, async () => strategy, [], strategy);
  const replay = replayAttempt(result.attempt.replay);
  const cleared =
    result.attempt.outcome === "won" && replay.stopReason === "won";
  return {
    replay: result.attempt.replay,
    cleared,
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
