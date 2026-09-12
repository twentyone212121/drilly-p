import { useState, useSyncExternalStore } from "react";
import checkpoint from "../public/levels/checkpoint.json";
import { parseLevel } from "../shared/validation";
import { createSession, type SessionSnapshot } from "./game/session";
import { GameControls } from "./components/GameControls";
import { GameView } from "./components/GameView";
import { DebugPanel } from "./components/DebugPanel";
import type { AudioSettings, AudioStatus } from "./game/phaser/audio";

export default function App() {
  const [session] = useState(() => createSession(parseLevel(checkpoint)));
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [audio, setAudio] = useState<AudioSettings>({
    muted: false,
    volume: 0.6,
  });
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({
    ...audio,
    ready: false,
    unlocked: false,
    played: 0,
    last: "none",
    missing: [],
  });

  const status = statusMessage(view);

  return (
    <main>
      <header>
        <a className="wordmark" href="/" aria-label="Drilly P home">
          DRILLY <b>P</b>
          <span className="wordmark-dot" />
        </a>
        <span className="header-note">A LITTLE THIEF. A BIG RIVAL.</span>
        <small>LOCAL PROTOTYPE</small>
      </header>
      <section className="intro">
        <div>
          <div className="eyebrow">
            TRAINING ROOM <span>/ 01</span>
          </div>
          <h1>
            The first vault<span>.</span>
          </h1>
        </div>
        <p>
          One button. Two good jumps.
          <br />
          The treasure is yours to take.
        </p>
      </section>
      <div className="game-shell">
        <div className="room-bar">
          <span>
            <i /> {session.level.name}
          </span>
          <span>FIXED ROOM · INSTANT RETRIES</span>
        </div>
        <GameView session={session} audio={audio} onAudio={setAudioStatus} />
        <div className="room-footer">
          <span className={"status " + view.state.status} role="status">
            {status}
          </span>
          <span>
            {view.mode === "replay" ? "REPLAY" : "PLAYER"} <b>·</b>{" "}
            {String(view.state.tick).padStart(4, "0")} TICKS
          </span>
        </div>
      </div>
      <GameControls session={session} view={view} audio={audio} onAudioChange={setAudio} />
      <div className="instructions">
        <p>
          <span>01</span> Jump over the saw.
        </p>
        <p>
          <span>02</span> Run into the far wall.
        </p>
        <p>
          <span>03</span> Jump back onto the ledge.
        </p>
      </div>
      <p className="control-help">
        Space starts or resumes, jumps during play, and starts a fresh attempt
        after finishing. Tap the room or click Jump to jump. Wall jumps reverse direction.
      </p>
      <DebugPanel session={session} audio={audioStatus} />
      <footer>
        <span>DRILLY = YOUR AI RIVAL · P = YOU</span>
        <span>Gameplay checkpoint · AI joins later</span>
      </footer>
    </main>
  );
}

function statusMessage(view: SessionSnapshot): string {
  if (view.state.status === "won") return "Treasure secured";
  if (view.state.status === "dead") return "Caught by the saw";
  if (view.finished) return "Attempt complete";
  if (!view.paused) return "In the vault";

  return view.state.tick === 0 ? "Ready when you are" : "Paused";
}
