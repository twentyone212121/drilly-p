import { useLayoutEffect, useRef } from "react";
import type { Session, SessionSnapshot } from "../game/session";
import { sessionView } from "../game/sessionView";
import type { AudioSettings } from "../game/phaser/audio";
import { GameIcon, GameSprite } from "./GameArt";

export function GameOverlay({
  session,
  view,
  menuOpen,
  audio,
  onAudioChange,
  onCloseMenu,
}: {
  session: Session;
  view: SessionSnapshot;
  menuOpen: boolean;
  audio: AudioSettings;
  onAudioChange: (settings: AudioSettings) => void;
  onCloseMenu: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startingTest =
    view.phase === "test" && !view.finished && view.state.tick === 0;
  const visible =
    menuOpen ||
    (!startingTest &&
      !view.waitingToStart &&
      !view.presentingDeath &&
      view.phase !== "build" &&
      (view.paused || !view.canPlay));
  const paused =
    menuOpen ||
    (view.canPlay && view.paused && !view.finished && view.state.tick > 0);
  const copy = sessionView(view);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (visible && !element?.open) element?.showModal();
    else if (!visible && element?.open) element.close();
  }, [visible]);

  function act(action: () => void) {
    onCloseMenu();
    action();
  }

  function resume() {
    onCloseMenu();
    if (view.canPlay && !view.finished) session.play();
  }

  return (
    <dialog
      ref={dialog}
      className={`game-overlay ${paused ? "pause-menu" : ""}`}
      aria-labelledby="overlay-title"
      onCancel={(event) => {
        event.preventDefault();
        if (paused || (view.canPlay && !view.finished)) resume();
      }}
    >
      {visible &&
        (paused ? (
          <>
            <h2 id="overlay-title">Paused</h2>
            <button className="game-button primary" autoFocus onClick={resume}>
              <GameIcon name="play" />
              Continue
            </button>
            {view.canRestart && (
              <button
                className="game-button"
                onClick={() =>
                  act(() => {
                    session.reset();
                    session.play();
                  })
                }
              >
                <GameIcon name="replay" />
                {view.phase === "watch" ? "Replay attempt" : "Restart"}
              </button>
            )}
            {view.canReplayTutorial && (
              <button
                className="text-button"
                onClick={() => act(session.replayTutorial)}
              >
                Replay tutorial
              </button>
            )}
            <div className="audio-controls">
              <button
                className="icon-button"
                aria-label={audio.muted ? "Unmute" : "Mute"}
                aria-pressed={audio.muted}
                onClick={() => onAudioChange({ ...audio, muted: !audio.muted })}
              >
                <GameIcon name={audio.muted ? "mute" : "sound"} />
              </button>
              <label className="volume-control">
                Volume
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={audio.volume}
                  onChange={(event) =>
                    onAudioChange({
                      ...audio,
                      volume: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
          </>
        ) : (
          <>
            {view.phase === "results" ? (
              <div className="result-characters">
                <GameSprite name="esc" />
                <span>vs</span>
                <GameSprite name="drilly" />
              </div>
            ) : (
              <GameSprite
                name={
                  (view.phase === "raid" && !view.canPlay) ||
                  view.phase === "watch"
                    ? "drilly"
                    : "esc"
                }
                className={`overlay-character ${view.phase === "raid" && !view.canPlay && !view.aiError ? "drilly-building" : ""}`}
              />
            )}
            <h2 id="overlay-title">{copy.title}</h2>
            {view.phase === "results" && view.result ? (
              <>
                <div
                  className="medals"
                  aria-label={`${view.result.total} of 6 medals`}
                >
                  {Array.from({ length: 6 }, (_, index) => (
                    <span
                      key={index}
                      className={
                        index < view.result!.total ? "medal" : "medal empty"
                      }
                    >
                      <GameIcon name="medal" />
                    </span>
                  ))}
                </div>
                <div className="result-details">
                  <div>
                    Attack<strong>{view.result.attack}/3</strong>
                  </div>
                  <div>
                    Defence<strong>{view.result.defense}/3</strong>
                  </div>
                </div>
              </>
            ) : (
              <p role={view.aiError ? "alert" : "status"}>{copy.hint}</p>
            )}
            <button
              className="game-button primary"
              autoFocus
              disabled={copy.actionDisabled}
              onClick={() => act(() => session.primaryAction())}
            >
              {copy.action}
              <GameIcon name="arrow" />
            </button>
            {view.phase === "results" ? (
              <button
                className="text-button"
                onClick={() => act(() => session.replayDrilly())}
              >
                Watch Drilly again
              </button>
            ) : (
              view.tutorialCompleted &&
              !(view.phase === "prison" && view.state.status === "won") && (
                <button
                  className="text-button"
                  onClick={() => act(session.editDungeon)}
                >
                  Back to your dungeon
                </button>
              )
            )}
          </>
        ))}
      {visible && view.phase === "watch" && view.watchIndex !== null && (
        <label className="ghost-toggle">
          <input
            type="checkbox"
            checked={view.showGhost}
            onChange={(event) => session.setGhostVisible(event.target.checked)}
          />
          Show your ghost
        </label>
      )}
    </dialog>
  );
}
