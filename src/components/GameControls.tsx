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
  const canRestart = [
    "prison",
    "testing",
    "cleared",
    "raiding",
    "ghost",
  ].includes(view.phase);

  return (
    <div className="controls">
      <button
        className="primary"
        disabled={
          (view.aiPending &&
            (view.phase === "preparing" || view.phase === "raid-complete")) ||
          (view.phase === "ghost" && !view.paused) ||
          (view.phase === "cleared" && !view.canSubmit)
        }
        onClick={() => session.primaryAction()}
      >
        {copy.action} <kbd>SPACE</kbd>
      </button>
      {!view.paused && <button onClick={() => session.pause()}>Pause</button>}
      {canRestart && (
        <button onClick={() => session.reset()}>
          {view.phase === "cleared"
            ? "Test again"
            : view.phase === "ghost"
              ? "Replay attempt"
              : "Restart"}
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
