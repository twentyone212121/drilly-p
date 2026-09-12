import { useState } from "react";
import type { Obstacle } from "../../shared/game/obstacleTypes";
import { RULES } from "../../shared/game/rules";

export function ObstacleInspector({
  obstacle,
  onApply,
}: {
  obstacle: Obstacle;
  onApply: (value: Obstacle) => string | null;
}) {
  const [draft, setDraft] = useState(obstacle);
  const [error, setError] = useState<string | null>(null);
  function numberField(key: string, label: string, min: number, max: number) {
    const value = draft[key as keyof Obstacle] as number;
    const unit = key.endsWith("Ticks") ? RULES.tickRate : 1;
    return (
      <label key={key}>
        {label}
        <input
          type="number"
          required
          min={min / unit}
          max={max / unit}
          step="any"
          value={Number.isNaN(value) ? "" : Number((value / unit).toFixed(3))}
          onChange={(event) => {
            const input = event.target.valueAsNumber * unit;
            setDraft({ ...draft, [key]: unit === 1 ? input : Math.round(input) });
          }}
        />
      </label>
    );
  }
  const limits = RULES.obstacles;
  return (
    <form
      className="obstacle-inspector"
      onSubmit={(event) => {
        event.preventDefault();
        setError(onApply(draft));
      }}
    >
      <strong>{draft.kind === "slider" ? "Sliding saw" : draft.kind} settings</strong>
      <div className="field-row">
        {draft.kind === "spikes" ? (
          <>
            {numberField("width", "Width (px)", 1, 2000)}
            {numberField("height", "Height (px)", 1, 2000)}
          </>
        ) : (
          numberField("radius", "Body radius (px)", limits.minRadius, limits.maxRadius)
        )}
        {(draft.kind === "slider" || draft.kind === "drone") && (
          <>
            {numberField("endX", "Route end X", 0, 2000)}
            {numberField("endY", "Route end Y", 0, 2000)}
          </>
        )}
        {(draft.kind === "slider" || draft.kind === "drone" || draft.kind === "pursuer") &&
          numberField("speed", "Speed (px/sec)", limits.minSpeed, limits.maxSpeed)}
        {draft.kind === "pursuer" && (
          <>
            {numberField("detectionRange", "Detection radius", limits.minRange, limits.maxRange)}
            {numberField("chaseRange", "Escape radius", limits.minRange, limits.maxRange)}
            {numberField("warningTicks", "Warning (sec)", limits.minWarning, limits.maxInterval)}
          </>
        )}
        {draft.kind === "turret" && (
          <>
            <label>
              Attack
              <select
                value={draft.mode}
                onChange={(e) =>
                  setDraft({ ...draft, mode: e.target.value as "fixed" | "aimed" | "flame" })
                }
              >
                <option value="fixed">Fixed shots</option>
                <option value="aimed">Aimed shots</option>
                <option value="flame">Flame bursts</option>
              </select>
            </label>
            {draft.mode !== "aimed" && (
              <label>
                Direction
                <select
                  value={draft.direction}
                  onChange={(e) =>
                    setDraft({ ...draft, direction: Number(e.target.value) as -1 | 1 })
                  }
                >
                  <option value={-1}>Left</option>
                  <option value={1}>Right</option>
                </select>
              </label>
            )}
            {numberField("intervalTicks", "Cycle (sec)", limits.minInterval, limits.maxInterval)}
            {numberField("warmupTicks", "Warning (sec)", limits.minWarning, limits.maxInterval)}
            {draft.mode === "flame"
              ? numberField("activeTicks", "Flame on (sec)", limits.minWarning, limits.maxInterval)
              : numberField(
                  "projectileSpeed",
                  "Shot speed (px/sec)",
                  limits.minSpeed,
                  limits.maxSpeed,
                )}
            {numberField("range", "Reach (px)", limits.minRange, limits.maxRange)}
          </>
        )}
        <button type="submit">Apply settings</button>
      </div>
      <p className="hint">
        Route and range guides show the applied settings. Changes require beating your dungeon
        again.
      </p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
