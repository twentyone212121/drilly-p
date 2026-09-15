import { useEffect, useState } from "react";
import type { SessionSnapshot } from "../game/session";
import { GameSprite } from "./GameArt";

/** Decorative workbench: motion never represents simulated progress or outcomes. */
export function DrillyWorkshop({
  view,
  onRetry,
}: {
  view: SessionSnapshot;
  onRetry: () => void;
}) {
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <div
      className="drilly-workshop"
      data-still={hidden || Boolean(view.aiError)}
    >
      {view.phase === "raid" ? (
        <div className="workshop-stage" aria-hidden="true">
          <div className="workshop-rail" />
          {["01", "02", "03"].map((label) => (
            <div className="workshop-station" key={label}>
              <span>{label}</span>
              <i />
              <i />
              <i />
              <div className="workshop-socket" />
              <div className="workshop-contact">
                <svg viewBox="-40 -36 80 48">
                  <path d="m-5-5-13-12m12 14-24-3m25 4-12 9M5-5l13-14M7-2l24-5M8 2l15 8" />
                </svg>
              </div>
            </div>
          ))}
          <div className="workshop-worker">
            <div className="workshop-tool">
              <GameSprite name="drilly" />
            </div>
          </div>
        </div>
      ) : (
        <div className="raid-scan-stage" aria-hidden="true">
          <svg
            className="raid-route-map"
            viewBox="0 0 600 240"
            preserveAspectRatio="none"
          >
            <path
              className="raid-map-floor"
              d="M20 210H580M170 140H310M380 185H460"
            />
            <path
              className="raid-route-guide"
              d="M50 175H125Q165 35 225 105H295Q335 30 390 155H465Q510 90 550 175"
            />
            <path
              className="raid-route-pulse"
              d="M50 175H125Q165 35 225 105H295Q335 30 390 155H465Q510 90 550 175"
            />
            <g className="raid-route-nodes">
              <circle cx="50" cy="175" r="5" />
              <circle cx="225" cy="105" r="5" />
              <circle cx="390" cy="155" r="5" />
            </g>
            <path className="raid-route-goal" d="m550 160 12 15-12 15-12-15Z" />
          </svg>
          <div className="raid-route-runner">
            <span className="raid-scan-ring" />
            <GameSprite name="drilly" />
          </div>
        </div>
      )}
      <div className="workshop-caption">
        <h2>
          {view.phase === "raid"
            ? "Drilly is building"
            : "Drilly is taking on your room"}
        </h2>
        <p role={view.aiError ? "alert" : "status"}>
          {view.aiError ??
            (view.phase === "raid"
              ? "Wiring up the room and testing a way through…"
              : "Trying routes and putting your defences to the test…")}
        </p>
        {view.aiError && (
          <button className="game-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
