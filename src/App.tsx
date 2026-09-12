import { useState, useSyncExternalStore, type ReactNode } from "react";
import { DUNGEONS } from "../shared/game/campaign";
import type { Session } from "./game/session";
import { sessionView } from "./game/sessionView";
import { GameControls } from "./components/GameControls";
import { GameView } from "./components/GameView";
import { DebugPanel } from "./components/DebugPanel";
import { DungeonEditor } from "./components/DungeonEditor";
import type { AudioSettings, AudioStatus } from "./game/phaser/audio";

export default function App({ session, saving }: { session: Session; saving?: ReactNode }) {
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
  const copy = sessionView(view);
  const building = view.phase === "building";
  const level = session.level;

  return (
    <main>
      <header>
        <span className="wordmark" aria-label="Drilly P">
          DRILLY <b>P</b>
          <span className="wordmark-dot" />
        </span>
        <span className="header-note">A LITTLE THIEF. A BIG RIVAL.</span>
        <small>{saving ? "GUEST PROFILE" : "LOCAL PLAY · SAVING OFF"}</small>
      </header>
      <ol className="flow-steps" aria-label="Game progress">
        {["Escape", "Build", "Clear", "Raid", "Watch", "Results"].map((step, index) => (
          <li key={step} aria-current={copy.step === index ? "step" : undefined}>
            <span>{String(index).padStart(2, "0")}</span> {step}
          </li>
        ))}
      </ol>
      <section className="intro">
        <div>
          <div className="eyebrow">
            DRILLY P <span>/ {view.prisonEscaped ? "YOUR FIRST RIVALRY" : "THE PRISON"}</span>
          </div>
          <h1>
            {copy.title}
            <span>.</span>
          </h1>
        </div>
        <p>{copy.hint}</p>
      </section>
      {building && (
        <ol className="dungeon-list" aria-label="Opponent dungeons">
          {DUNGEONS.map((dungeon, index) => (
            <li key={dungeon.id} aria-disabled={!dungeon.available}>
              <span>
                0{index + 1} / {dungeon.name}
              </span>
              <small>{dungeon.available ? "CURRENT OPPONENT" : "COMING LATER · UNAVAILABLE"}</small>
            </li>
          ))}
        </ol>
      )}
      {building && import.meta.env.DEV && (
        <label className="control-help">
          <input
            type="checkbox"
            checked={view.developmentFixture}
            onChange={(event) => session.setDevelopmentFixture(event.target.checked)}
          />
          Development fixture · Use scripted Drilly attempts for local testing
        </label>
      )}
      {view.round?.fixture && (
        <p role="status">Development fixture · Scripted Drilly, not live AI</p>
      )}
      {view.phase === "results" && view.result && view.round && (
        <section className="round-results" aria-label="Round results">
          <p>
            <strong>
              {view.result.total}/6 medals · {view.result.outcome}
            </strong>
          </p>
          <p>
            Attack: {view.result.attack}/3 · Defense: {view.result.defense}/3
          </p>
          <p>
            {view.result.improved ? "New best" : "Best unchanged"}: {view.result.best}/6
          </p>
          <p>
            Your attempts:{" "}
            {view.round.human
              .map((attempt, index) => `${index + 1}: ${attempt.outcome}`)
              .join(" · ")}
          </p>
          <p>
            Drilly’s attempts:{" "}
            {view.round.drilly
              .map((attempt, index) => `${index + 1}: ${attempt.outcome}`)
              .join(" · ")}
          </p>
          <button onClick={() => session.replayGhost()}>Replay Drilly’s attempts</button>
        </section>
      )}
      <div className="flow-controls">
        {building ? (
          <>
            <button
              className={view.canSubmit ? "" : "primary"}
              disabled={!view.editorLevel.treasures.length}
              onClick={() => session.testDungeon()}
            >
              Test dungeon
            </button>
            <button
              className={view.canSubmit ? "primary" : ""}
              disabled={!view.canSubmit}
              onClick={() => session.submitDungeon()}
            >
              Submit & raid
            </button>
            <p className="hint" role="status">
              {!view.editorLevel.treasures.length
                ? "Add a treasure before testing."
                : view.canSubmit
                  ? `Version ${view.layoutRevision + 1} is cleared.`
                  : `Clear version ${view.layoutRevision + 1} to unlock submission.`}
            </p>
          </>
        ) : view.prisonEscaped &&
          view.phase !== "escaped" &&
          view.phase !== "raid-complete" &&
          view.phase !== "results" ? (
          <>
            <button onClick={() => session.editDungeon()}>Edit dungeon</button>
            {view.canSubmit && view.phase !== "cleared" && (
              <button onClick={() => session.submitDungeon()}>Submit & raid</button>
            )}
            <p className="hint">Your draft stays intact while you play.</p>
          </>
        ) : null}
      </div>
      <div className="game-shell">
        <div className="room-bar">
          <span>
            <i /> {level.name}
          </span>
          <span>{building ? "YOUR DRAFT · GRID SNAPPING" : "COLLECT ALL TREASURES"}</span>
        </div>
        {building ? (
          <DungeonEditor session={session} level={view.editorLevel} />
        ) : (
          <GameView session={session} audio={audio} onAudio={setAudioStatus} />
        )}
        <div className="room-footer">
          <span className={"status " + (building ? "" : view.state.status)} role="status">
            {copy.status}
          </span>
          <span>
            {building ? (
              `DRAFT V${view.layoutRevision + 1}`
            ) : (
              <>
                {view.phase === "ghost"
                  ? "DRILLY GHOST"
                  : view.mode === "replay"
                    ? "REPLAY"
                    : "PLAYER"}{" "}
                <b>·</b> {view.state.collectedTreasureIds.length}/{level.treasures.length} TREASURES
              </>
            )}
          </span>
        </div>
      </div>
      {saving}
      {!building && (
        <GameControls session={session} view={view} audio={audio} onAudioChange={setAudio} />
      )}
      <p className="control-help">
        {building
          ? "Select and drag objects. Resize platforms by their corner. Arrow keys nudge; Delete removes the selection. Room size and spawn stay fixed."
          : "Space or a tap starts and resumes, jumps during play, and retries after a failed attempt. Wall jumps reverse direction."}
      </p>
      <p className="control-help">
        {saving
          ? "Your layout saves to this browser’s guest profile. Reloading restarts the prison and requires clearing your draft again. Keep browser storage to retain guest access."
          : "Saving is off. Your layout and progress stay in this tab; reloading starts over."}
      </p>
      {!building && <DebugPanel session={session} audio={audioStatus} />}
      <footer>
        <span>DRILLY = YOUR AI RIVAL · P = YOU</span>
        <span>Prison + first dungeon · Local play</span>
      </footer>
    </main>
  );
}
