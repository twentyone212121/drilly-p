import { FullscreenButton } from "./FullscreenButton";
import type { SessionSnapshot } from "../game/session";
import type { AudioSettings } from "../game/phaser/audio";
import { GameIcon, GameSprite } from "./GameArt";

export function GameHud({
  view,
  totalTreasures,
  audio,
  onMute,
  onMenu,
  onBack,
  editing,
  onEdit,
  onTest,
}: {
  view: SessionSnapshot;
  totalTreasures: number;
  audio: AudioSettings;
  onMute: () => void;
  onMenu: () => void;
  onBack: () => void;
  editing: boolean;
  onEdit: () => void;
  onTest: () => void;
}) {
  const { phase } = view;
  return (
    <header className="game-hud">
      {phase === "build" && (
        <div className="hud-edit-actions">
          {editing ? (
            <>
              <button className="game-button" onClick={onBack}>
                <GameIcon name="back" />
                Back
              </button>
              <button
                className="game-button"
                onClick={onTest}
                disabled={!totalTreasures}
              >
                <GameIcon name="play" />
                Test
              </button>
            </>
          ) : (
            <button className="game-button" onClick={onEdit}>
              <GameIcon name="wrench" />
              Edit
            </button>
          )}
        </div>
      )}
      {view.tutorialCompleted && phase !== "build" && (
        <button
          className="icon-button hud-back"
          onClick={onBack}
          aria-label="Back to your dungeon"
          title="Back to your dungeon"
        >
          <GameIcon name="back" />
        </button>
      )}
      {(phase === "build" || phase === "results") && (
        <table className="rivalry-score" aria-label="Session scoreboard">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Player</span>
              </th>
              <th scope="col">Points</th>
              <th scope="col">Wins</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <span>
                  <GameSprite name="esc" />
                  You
                </span>
              </th>
              <td>{view.scoreboard.you.points}</td>
              <td>{view.scoreboard.you.wins}</td>
            </tr>
            <tr>
              <th scope="row">
                <span>
                  <GameSprite name="drilly" />
                  Drilly
                </span>
              </th>
              <td>{view.scoreboard.drilly.points}</td>
              <td>{view.scoreboard.drilly.wins}</td>
            </tr>
          </tbody>
        </table>
      )}
      {view.canPlay && (
        <div className="counters centered-treasure">
          <span
            className="treasure-count"
            aria-label={`${view.state.collectedTreasureIds.length} of ${totalTreasures} treasures`}
          >
            <GameSprite name="treasure" />{" "}
            {view.state.collectedTreasureIds.length}/{totalTreasures}
          </span>
        </div>
      )}
      <div className="hud-actions">
        <button
          className="icon-button mute-button"
          onClick={onMute}
          aria-label={audio.muted ? "Unmute" : "Mute"}
          aria-pressed={audio.muted}
        >
          <GameIcon name={audio.muted ? "mute" : "sound"} />
        </button>
        <FullscreenButton />
        <button
          className="icon-button"
          onClick={onMenu}
          aria-label="Pause menu"
        >
          <GameIcon name="pause" />
        </button>
      </div>
    </header>
  );
}
