import type { Session, SessionSnapshot } from "../game/session";
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
  function togglePlayback() {
    if (view.paused) session.play();
    else session.pause();
  }

  return (
    <div className="controls">
      <button className="primary" disabled={view.finished} onClick={togglePlayback}>
        {view.paused ? "Play" : "Pause"}
        {view.paused && !view.finished && <kbd>SPACE</kbd>}
      </button>
      <button disabled={view.finished || view.mode === "replay"} onClick={() => session.jump()}>
        Jump {!view.paused && !view.finished && view.mode === "human" && <kbd>SPACE</kbd>}
      </button>
      <button onClick={() => session.reset()}>
        Restart <span aria-hidden="true">↻</span>
        {view.finished && <kbd>SPACE</kbd>}
      </button>
      <span className="queue-note">{view.pendingJump ? "Jump queued for next tick" : ""}</span>
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
            onChange={(e) => onAudioChange({ ...audio, volume: Number(e.target.value) })}
          />
          <span>{Math.round(audio.volume * 100)}%</span>
        </label>
      </div>
    </div>
  );
}
