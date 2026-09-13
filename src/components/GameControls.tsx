import type { Session, SessionSnapshot } from "../game/session";
import { sessionView } from "../game/sessionView";
import type { AudioSettings } from "../game/phaser/audio";

export function GameControls({
  session,
  view,
  audio,
  onAudioChange,
}: {
  session: Session;
  view: SessionSnapshot;
  audio: AudioSettings;
  onAudioChange: (settings: AudioSettings) => void;
}) {
  const copy = sessionView(view);

  return (
    <div className="controls">
      <button
        className="primary"
        disabled={copy.actionDisabled}
        onClick={() => session.primaryAction()}
      >
        {copy.action} <kbd>SPACE</kbd>
      </button>
      {view.canPlay && !view.paused && (
        <button onClick={() => session.pause()}>Pause</button>
      )}
      {view.canRestart && (
        <button onClick={() => session.reset()}>
          {view.phase === "test" && view.state.status === "won"
            ? "Test again"
            : view.phase === "watch"
              ? "Replay attempt"
              : "Restart"}
        </button>
      )}
      {view.canReplayTutorial && (
        <button onClick={() => session.replayTutorial()}>
          Replay tutorial
        </button>
      )}
      <div className="audio-controls">
        <button
          aria-pressed={audio.muted}
          onClick={() => onAudioChange({ ...audio, muted: !audio.muted })}
        >
          {audio.muted ? "Unmute" : "Mute"}
        </button>
        <label>
          Volume{" "}
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={audio.volume}
            onChange={(e) =>
              onAudioChange({ ...audio, volume: Number(e.target.value) })
            }
          />
          <span>{Math.round(audio.volume * 100)}%</span>
        </label>
      </div>
    </div>
  );
}
