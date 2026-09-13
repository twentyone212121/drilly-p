import { playAttempt, type AttemptFeedback } from "./attempt";
import { withDeadline } from "./deadline";
import { RULES } from "../../shared/game/rules";
import type { RaidAttempt } from "../../shared/game/round";
import { parseLevel } from "../../shared/validation";
import type { Planner } from "./protocol";

export type { Planner } from "./protocol";
export { buildDungeon } from "./build";

export type RaidProgress = {
  attempt: number;
  outcome: RaidAttempt["outcome"];
  ticks: number;
  strategies: string[];
};

export async function playDungeon(
  value: unknown,
  plan: Planner,
  onAttempt: (progress: RaidProgress) => void = () => {},
) {
  const level = parseLevel(value);
  const attempts: (RaidAttempt & { outcome: "won" | "dead" | "tick-limit" })[] =
    [];
  const feedback: AttemptFeedback[] = [];
  const boundedPlan = withDeadline(plan, RULES.drilly.raidThinkingTimeoutMs);
  for (let index = 0; index < RULES.raidAttempts; index++) {
    const result = await playAttempt(level, boundedPlan, feedback);
    attempts.push(result.attempt);
    feedback.push(result.feedback);
    onAttempt({
      attempt: index + 1,
      outcome: result.attempt.outcome,
      ticks: result.attempt.replay.endTick,
      strategies: result.trace.map((trace) => trace.decision.objective),
    });
    if (result.attempt.outcome === "won") break;
  }
  return attempts;
}
