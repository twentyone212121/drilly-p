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

export default function App({ session }: { session: Session }) {
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [audio, setAudio] = useState<AudioSettings>({
    muted: false,
    volume: 0.6,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState(INITIAL_EDITOR);
  const level = view.level;
  const building = view.phase === "build";
  const editorOptions = useMemo(
    () => ({
      enabled: building && editing && !menuOpen,
      state: editor,
      onChange: setEditor,
    }),
    [building, editing, menuOpen, editor],
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
    <main className="arcade-game">
      <ComputerBackground />
      <GameHud
        view={view}
        totalTreasures={level.treasures.length}
        audio={audio}
        onMute={() => setAudio({ ...audio, muted: !audio.muted })}
        onMenu={openMenu}
        editing={editing}
        onEdit={() => {
          setEditor({ ...INITIAL_EDITOR });
          setEditing(true);
        }}
        onTest={() => {
          session.testDungeon();
          setEditing(false);
        }}
        onBack={() => {
          setMenuOpen(false);
          setEditing(false);
          session.editDungeon();
        }}
      />
      <section className="playfield" aria-label="Room">
        <div className="room-viewport">
          <GameView session={session} audio={audio} editor={editorOptions} />
        </div>
        {view.waitingToStart && !menuOpen && (
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
            <button
              className="game-button primary"
              disabled={!view.canChallenge}
              onClick={() => {
                session.challengeDrilly();
                setEditing(false);
              }}
            >
              <GameSprite name="drilly" />
              Challenge Drilly
              <GameIcon name="arrow" />
            </button>
          </div>
        </footer>
      ) : null}
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
