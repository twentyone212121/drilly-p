import { RULES } from "../../shared/game/rules";
import type { SessionSnapshot } from "../game/session";

export function RoundScore({ view }: { view: SessionSnapshot }) {
  if (!view.result || !view.round) return null;
  const { total } = view.result;
  const maximum = RULES.raidAttempts;
  function outcome(attempts: { outcome: string }[]) {
    const cleared = attempts.findIndex((attempt) => attempt.outcome === "won");
    return cleared < 0
      ? "Didn’t clear the room"
      : `Cleared on try ${cleared + 1}`;
  }
  return (
    <div className="round-score">
      <div className="round-totals">
        <div className="score-you">
          <span>You</span>
          <strong>{total}</strong>
          <small>{outcome(view.round.human)}</small>
        </div>
        <span className="score-divider">:</span>
        <div className="score-drilly">
          <span>Drilly</span>
          <strong>{maximum * 2 - total}</strong>
          <small>{outcome(view.round.drilly)}</small>
        </div>
      </div>
    </div>
  );
}
