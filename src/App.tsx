import { useState, useSyncExternalStore } from "react";
import type { Session } from "./game/session";
import { sessionView } from "./game/sessionView";
import { GameControls } from "./components/GameControls";
import { GameView } from "./components/GameView";
import { DungeonEditor } from "./components/DungeonEditor";
import type { AudioSettings } from "./game/phaser/audio";

export default function App({ session }: { session: Session }) {
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [audio, setAudio] = useState<AudioSettings>({
    muted: false,
    volume: 0.6,
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
      </header>
      <ol className="flow-steps" aria-label="Game progress">
        {["Escape", "Build", "Clear", "Raid", "Watch", "Results"].map(
          (step, index) => (
            <li
              key={step}
              aria-current={copy.step === index ? "step" : undefined}
            >
              <span>{String(index).padStart(2, "0")}</span> {step}
            </li>
          ),
        )}
      </ol>
      <section className="intro">
        <div>
          <div className="eyebrow">
            DRILLY P{" "}
            <span>
              /{" "}
              {view.prisonEscaped ? "YOUR FIRST RIVALRY" : "ESCAPE THE SYSTEM"}
            </span>
          </div>
          <h1>
            {copy.title}
            <span>.</span>
          </h1>
        </div>
        <p>{copy.hint}</p>
      </section>
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
          <button onClick={() => session.replayGhost()}>
            Replay Drilly’s attempts
          </button>
        </section>
      )}
      <div
        className={building ? "flow-controls build-actions" : "flow-controls"}
      >
        {(view.phase === "preparing" || view.phase === "raid-complete") && (
          <button onClick={() => session.editDungeon()}>
            Return to your draft
          </button>
        )}
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
              {view.aiPending
                ? "The previous AI request is finishing. You can keep editing."
                : !view.editorLevel.treasures.length
                  ? "Add a treasure before testing."
                  : !view.liveDrilly
                    ? "Connect Convex to challenge Drilly."
                    : view.canSubmit
                      ? "Dungeon beaten. Ready to submit."
                      : "Beat your dungeon to unlock submission."}
            </p>
          </>
        ) : view.prisonEscaped &&
          view.phase !== "escaped" &&
          view.phase !== "raid-complete" &&
          view.phase !== "results" ? (
          <>
            <button onClick={() => session.editDungeon()}>Edit dungeon</button>
            {view.canSubmit && view.phase !== "cleared" && (
              <button onClick={() => session.submitDungeon()}>
                Submit & raid
              </button>
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
          <span>
            {building ? "YOUR DRAFT · GRID SNAPPING" : "COLLECT ALL TREASURES"}
          </span>
        </div>
        {building ? (
          <DungeonEditor session={session} level={view.editorLevel} />
        ) : (
          <GameView session={session} audio={audio} />
        )}
        <div className="room-footer">
          <span
            className={"status " + (building ? "" : view.state.status)}
            role="status"
          >
            {copy.status}
          </span>
          <span>
            {building ? (
              "YOUR DUNGEON"
            ) : (
              <>
                {view.phase === "ghost"
                  ? "DRILLY GHOST"
                  : view.mode === "replay"
                    ? "REPLAY"
                    : "PLAYER"}{" "}
                <b>·</b> {view.state.collectedTreasureIds.length}/
                {level.treasures.length} TREASURES
              </>
            )}
          </span>
        </div>
      </div>
      {!building && (
        <GameControls
          session={session}
          view={view}
          audio={audio}
          onAudioChange={setAudio}
        />
      )}
      <p className="control-help">
        {building
          ? "Select and drag objects. Resize platforms by their corner. Arrow keys nudge; Delete removes the selection. Room size and spawn stay fixed."
          : "Space or a tap starts and resumes, jumps during play, and retries after a failed attempt. Wall jumps reverse direction."}
      </p>
      <p className="control-help">
        Your layout and progress stay in this tab. Reloading starts a fresh
        game.
      </p>
    </main>
  );
}
