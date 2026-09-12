import { useState, useSyncExternalStore } from "react";
import checkpoint from "../public/levels/checkpoint.json";
import { parseLevel } from "../shared/validation";
import { createSession, type SessionSnapshot } from "./game/session";
import { GameControls } from "./components/GameControls";
import { GameView } from "./components/GameView";
import { DebugPanel } from "./components/DebugPanel";
import { DungeonEditor } from "./components/DungeonEditor";
import type { AudioSettings, AudioStatus } from "./game/phaser/audio";

export default function App() {
  const [session] = useState(() => {
    const opponent = parseLevel(checkpoint);
    return createSession(opponent, {
      editorLevel: {
        ...structuredClone(opponent),
        id: "player-dungeon",
        name: "Your vault",
      },
    });
  });
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
  const editing = view.phase === "editing";
  const raiding = view.phase === "raiding";

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
            {raiding ? "RAID" : editing ? "BUILD" : "CLEAR YOUR VAULT"}{" "}
            <span>/ DRILLY P</span>
          </div>
          <h1>
            {raiding ? "Into Drilly’s vault" : "Make it yours"}
            <span>.</span>
          </h1>
        </div>
        <p>
          Build a dungeon. Prove it can be beaten.
          <br />
          Clear every treasure, then take on Drilly’s vault.
        </p>
      </section>
      <div className="flow-controls">
        {!editing && (
          <button onClick={() => session.editDungeon()}>Back to editor</button>
        )}
        {!raiding && (
          <button
            className={view.canSubmit ? "" : "primary"}
            disabled={!view.editorLevel?.treasures.length}
            onClick={() => session.testDungeon()}
          >
            {editing ? "Test dungeon" : "Restart test"}
          </button>
        )}
        {!raiding && (
          <button
            className={view.canSubmit ? "primary" : ""}
            disabled={!view.canSubmit}
            onClick={() => session.submitDungeon()}
          >
            Submit & raid
          </button>
        )}
        <p className="hint" role="status">
          {raiding
            ? "Predefined opponent · local raid"
            : !view.editorLevel?.treasures.length
              ? "Add at least one treasure to test."
              : view.canSubmit
                ? `Version ${view.layoutRevision + 1} cleared — ready to submit.`
                : `Clear version ${view.layoutRevision + 1} to unlock submission.`}
        </p>
      </div>
      <div className="game-shell">
        <div className="room-bar">
          <span>
            <i /> {session.level.name}
          </span>
          <span>
            {editing
              ? "LOCAL DRAFT · GRID SNAPPING"
              : "COLLECT ALL TREASURES · INSTANT RETRIES"}
          </span>
        </div>
        {editing && view.editorLevel ? (
          <DungeonEditor session={session} level={view.editorLevel} />
        ) : (
          <GameView session={session} audio={audio} onAudio={setAudioStatus} />
        )}
        <div className="room-footer">
          <span className={"status " + view.state.status} role="status">
            {status}
          </span>
          <span>
            {editing ? (
              `DRAFT V${view.layoutRevision + 1}`
            ) : (
              <>
                {view.mode === "replay" ? "REPLAY" : "PLAYER"} <b>·</b>{" "}
                {view.state.collectedTreasureIds.length}/
                {session.level.treasures.length} TREASURES
                <b>·</b> {String(view.state.tick).padStart(4, "0")} TICKS
              </>
            )}
          </span>
        </div>
      </div>
      {!editing && (
        <GameControls
          session={session}
          view={view}
          audio={audio}
          onAudioChange={setAudio}
        />
      )}
      <div className="instructions">
        <p>
          <span>01</span> Shape your vault.
        </p>
        <p>
          <span>02</span> Collect every treasure in a test.
        </p>
        <p>
          <span>03</span> Submit, then raid Drilly’s vault.
        </p>
      </div>
      <p className="control-help">
        {editing
          ? "Your draft stays in this tab while testing and raiding. Reloading starts over. Every geometry change requires a new clear."
          : "Space starts or resumes, jumps during play, and retries after finishing. Tap the room or click Jump to jump. Wall jumps reverse direction."}
      </p>
      {!editing && <DebugPanel session={session} audio={audioStatus} />}
      <footer>
        <span>DRILLY = YOUR AI RIVAL · P = YOU</span>
        <span>Local editor & raids · AI joins later</span>
      </footer>
    </main>
  );
}

function statusMessage(view: SessionSnapshot): string {
  if (view.phase === "editing") return "Editing your vault";
  if (view.state.status === "won")
    return view.phase === "testing" && view.mode === "human"
      ? "Your vault is clear — submit when ready"
      : "All treasures secured";
  if (view.state.status === "dead") return "Attempt failed — try again";
  if (view.finished) return "Attempt complete";
  if (!view.paused) return "In the vault";

  return view.state.tick === 0 ? "Ready when you are" : "Paused";
}
