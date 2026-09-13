import type { SessionSnapshot } from "../game/session";
import type { AudioSettings } from "../game/phaser/audio";
import { RULES } from "../../shared/game/rules";
import { GameIcon, GameSprite } from "./GameArt";

const steps = [
  { phase: "build", label: "Build", art: <GameIcon name="wrench" /> },
  { phase: "test", label: "Test", art: <GameIcon name="play" /> },
  { phase: "raid", label: "Your raid", art: <GameSprite name="esc" /> },
  { phase: "watch", label: "Drilly’s raid", art: <GameSprite name="drilly" /> },
  { phase: "results", label: "Results", art: <GameIcon name="medal" /> },
];

export function GameHud({
  view,
  totalTreasures,
  audio,
  onMute,
  onMenu,
}: {
  view: SessionSnapshot;
  totalTreasures: number;
  audio: AudioSettings;
  onMute: () => void;
  onMenu: () => void;
}) {
  const { phase } = view;
  const current = steps.findIndex((step) => step.phase === phase);
  const drilly = phase === "watch";
  const title =
    phase === "prison"
      ? "Prison"
      : phase === "raid"
        ? "Drilly’s dungeon"
        : phase === "results"
          ? "Results"
          : "Your dungeon";
  const attemptsUsed = drilly ? (view.watchIndex ?? 0) : (view.round?.human.length ?? 0);

  return (
    <header className="game-hud">
      <div className="identity">
        <span className={`portrait ${drilly ? "drilly" : ""}`}>
          <GameSprite name={drilly ? "drilly" : "esc"} />
        </span>
        <h1>{title}</h1>
      </div>
      {phase !== "prison" && (
        <nav className="round-path" aria-label="Round progress">
          <ol>
            {steps.map((step, index) => {
              const done =
                index < current ||
                ((phase === "build" || phase === "test") && view.cleared && index === 1);
              return (
                <li
                  key={step.phase}
                  className={index === current ? "current" : done ? "done" : ""}
                  aria-current={index === current ? "step" : undefined}
                >
                  <span className="step-badge">
                    {step.art}
                    {done && (
                      <span className="step-check">
                        <GameIcon name="check" />
                      </span>
                    )}
                  </span>
                  <span>{step.label}</span>
                  {done && <span className="sr-only">completed</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="hud-actions">
        {view.canPlay && (
          <div className="counters">
            <span
              className="treasure-count"
              aria-label={`${view.state.collectedTreasureIds.length} of ${totalTreasures} treasures`}
            >
              <GameSprite name="treasure" /> {view.state.collectedTreasureIds.length}/
              {totalTreasures}
            </span>
            {(phase === "raid" || drilly) && (
              <span
                className="tries"
                aria-label={`${Math.max(0, RULES.raidAttempts - attemptsUsed)} attempts left`}
              >
                {Array.from({ length: RULES.raidAttempts }, (_, index) => (
                  <i key={index} className={index < attemptsUsed ? "used" : ""} />
                ))}
              </span>
            )}
          </div>
        )}
        <button
          className="icon-button mute-button"
          onClick={onMute}
          aria-label={audio.muted ? "Unmute" : "Mute"}
          aria-pressed={audio.muted}
        >
          <GameIcon name={audio.muted ? "mute" : "sound"} />
        </button>
        <button className="icon-button" onClick={onMenu} aria-label="Pause menu">
          <GameIcon name="pause" />
        </button>
      </div>
    </header>
  );
}
