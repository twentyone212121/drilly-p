import { replayAttempt } from "../../shared/game/replay";
import type { RaidAttempt } from "../../shared/game/round";
import type { HazardKind, RaidLearning } from "../../shared/game/drilly";

// Only completed HUMAN raids of Drilly's rooms inform future difficulty.
// Reviewing these recordings never spends an AI attempt or changes a result.
export function summarizeHumanRaid(attempts: RaidAttempt[]): RaidLearning {
  const level = attempts[0].replay.level;
  const summary: RaidLearning = {
    level,
    attempts: attempts.length,
    cleared: attempts.some((a) => a.outcome === "won"),
    deaths: [],
    ignoredJumps: 0,
    wallJumps: 0,
  };
  for (const attempt of attempts) {
    const result = replayAttempt(attempt.replay);
    summary.ignoredJumps += result.events.filter(
      (e) => e.type === "jump-ignored",
    ).length;
    summary.wallJumps += result.events.filter(
      (e) => e.type === "jumped" && e.kind === "wall",
    ).length;
    const death = result.events.find((e) => e.type === "died");
    if (!death || death.type !== "died") continue;
    const obstacle = level.obstacles?.find((o) => o.id === death.trapId);
    const kind: HazardKind =
      obstacle?.kind === "turret"
        ? `turret-${obstacle.mode}`
        : (obstacle?.kind ??
          (level.traps.some((t) => t.id === death.trapId) ? "saw" : "other"));
    summary.deaths.push({
      kind,
      tick: death.tick,
      x: result.state.player.x,
      y: result.state.player.y,
    });
  }
  return summary;
}
