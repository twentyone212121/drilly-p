import { UnsavedRoomDialog } from "./components/UnsavedRoomDialog";
import { loadAudio, saveAudio } from "./persistence/session";
import { ComputerBackground } from "./components/ComputerBackground";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Session } from "./game/session";
import { GameView } from "./components/GameView";
import { EditorTools } from "./components/EditorTools";
import { INITIAL_EDITOR } from "./game/phaser/editorInput";
import { GameHud } from "./components/GameHud";
import { GameOverlay } from "./components/GameOverlay";
import { GameIcon, GameSprite } from "./components/GameArt";
import type { AudioSettings } from "./game/phaser/audio";
import { DrillyWorkshop } from "./components/DrillyWorkshop";
import { ModelPicker } from "./components/ModelPicker";

export default function App({ session }: { session: Session }) {
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [audio, setAudio] = useState<AudioSettings>(loadAudio);
  useEffect(() => saveAudio(audio), [audio]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingEdits, setConfirmingEdits] = useState(false);
  const [editor, setEditor] = useState(INITIAL_EDITOR);
  const level = view.level;
  const building = view.phase === "build";
  const editorOptions = useMemo(
    () => ({
      enabled: building && editing && !menuOpen && !confirmingEdits,
      state: editor,
      onChange: setEditor,
    }),
    [building, editing, menuOpen, confirmingEdits, editor],
  );

  function openMenu() {
    session.pause();
    setMenuOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Escape" || event.repeat || event.defaultPrevented)
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("dialog, input, textarea, select")
      )
        return;
      event.preventDefault();
      session.pause();
      setMenuOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [session]);

  return (
    <main
      className="arcade-game"
      onClick={(event) => {
        // Plain actions release pointer focus; menu triggers own their focus lifecycle.
        if (
          event.detail > 0 &&
          document.activeElement instanceof HTMLButtonElement &&
          !document.activeElement.hasAttribute("aria-haspopup") &&
          event.currentTarget.contains(document.activeElement)
        ) {
          document.activeElement.blur();
        }
      }}
    >
      <ComputerBackground />
      <GameHud
        view={view}
        totalTreasures={level.treasures.length}
        audio={audio}
        onMute={() => setAudio({ ...audio, muted: !audio.muted })}
        onMenu={openMenu}
        editing={editing}
        onEdit={() => {
          session.beginEditing();
          setEditor({ ...INITIAL_EDITOR });
          setEditing(true);
        }}
        onBack={() => {
          if (editing && view.hasEditorChanges) {
            setConfirmingEdits(true);
            return;
          }
          setMenuOpen(false);
          setEditing(false);
          session.requestReturn();
        }}
      />
      <section className="playfield" aria-label="Room">
        <div className="room-viewport">
          <GameView session={session} audio={audio} editor={editorOptions} />
        </div>
        {view.waitingForDrilly && (
          <DrillyWorkshop view={view} onRetry={() => session.primaryAction()} />
        )}
        {view.waitingToStart && view.phase !== "prison" && !menuOpen && (
          <p className="ready-hint" role="status">
            Click, tap, or press Space to start
          </p>
        )}
        {building && editing && editor.message && (
          <p className="editor-feedback" role="status">
            {editor.message}
          </p>
        )}
      </section>
      {building ? (
        <footer className="build-footer">
          {editing && (
            <EditorTools
              tool={editor.tool}
              obstacleKind={editor.obstacleKind}
              onChoose={(tool, variant) =>
                setEditor({
                  ...editor,
                  tool,
                  obstacleKind: variant ?? editor.obstacleKind,
                  message: "",
                })
              }
            />
          )}
          {!editing && view.cleared && (
            <span className="room-saved">
              <GameIcon name="check" /> Room saved
            </span>
          )}
          <div className="build-actions">
            {view.liveDrilly && !editing && (
              <ModelPicker
                value={view.model}
                onChange={(model) => session.setModel(model)}
              />
            )}
            <button
              className="game-button primary room-primary-action"
              disabled={editing ? !level.treasures.length : !view.canChallenge}
              onClick={() => {
                if (editing) session.testDungeon();
                else session.challengeDrilly();
                setEditing(false);
              }}
            >
              <span
                className="room-action-label"
                aria-hidden={!editing}
                style={{ visibility: editing ? "visible" : "hidden" }}
              >
                <GameIcon name="play" /> Test and save
              </span>
              <span
                className="room-action-label"
                aria-hidden={editing}
                style={{ visibility: editing ? "hidden" : "visible" }}
              >
                <GameSprite name="drilly" /> Challenge Drilly{" "}
                <GameIcon name="arrow" />
              </span>
            </button>
          </div>
        </footer>
      ) : null}
      {view.phase === "watch" && view.watchIndex !== null && (
        <nav className="replay-controls" aria-label="Drilly attempts">
          {["First attempt", "Second attempt", "Third attempt"].map(
            (label, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={view.watchIndex === index}
                disabled={!view.round?.drilly[index]}
                onClick={() => session.selectDrillyAttempt(index)}
              >
                {label}
              </button>
            ),
          )}
        </nav>
      )}
      {view.phase === "prison" && (
        <p className="sr-only">
          Tap or Space to jump. Jump off a wall to turn around.
        </p>
      )}
      {building && !view.liveDrilly && (
        <p className="connection-note" role="status">
          Connect Convex to challenge Drilly.
        </p>
      )}
      {confirmingEdits && (
        <UnsavedRoomDialog
          canTest={level.treasures.length > 0}
          onSave={() => {
            session.testDungeon();
            setConfirmingEdits(false);
            setEditing(false);
          }}
          onDiscard={() => {
            session.discardEdits();
            setConfirmingEdits(false);
            setEditing(false);
            setEditor({ ...INITIAL_EDITOR });
          }}
          onCancel={() => setConfirmingEdits(false)}
        />
      )}
      <GameOverlay
        session={session}
        view={view}
        menuOpen={menuOpen}
        audio={audio}
        onAudioChange={setAudio}
        onCloseMenu={() => setMenuOpen(false)}
      />
    </main>
  );
}
