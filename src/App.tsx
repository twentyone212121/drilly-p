import { ComputerBackground } from "./components/ComputerBackground";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
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
  const [editor, setEditor] = useState(INITIAL_EDITOR);
  const level = view.level;
  const building = view.phase === "build";
  const editorOptions = useMemo(
    () => ({
      enabled: building && !menuOpen,
      state: editor,
      onChange: setEditor,
    }),
    [building, menuOpen, editor],
  );

  function openMenu() {
    session.pause();
    setMenuOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Escape" || event.repeat || event.defaultPrevented) return;
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
      style={{ "--room-ratio": level.width / level.height } as CSSProperties}
    >
      <ComputerBackground />
      <GameHud
        view={view}
        totalTreasures={level.treasures.length}
        audio={audio}
        onMute={() => setAudio({ ...audio, muted: !audio.muted })}
        onMenu={openMenu}
      />
      <section className="playfield" aria-label="Room">
        <div className="room-viewport">
          <GameView session={session} audio={audio} editor={editorOptions} />
        </div>
        {building && editor.message && (
          <p className="editor-feedback" role="status">
            {editor.message}
          </p>
        )}
      </section>
      {building ? (
        <footer className="build-footer">
          <EditorTools
            tool={editor.tool}
            obstacleKind={editor.obstacleKind}
            hasSelection={Boolean(editor.selection)}
            onChoose={(tool, variant) =>
              setEditor({
                ...editor,
                tool,
                obstacleKind: variant ?? editor.obstacleKind,
                message: "",
              })
            }
            onDelete={() => {
              if (editor.selection) session.edit({ type: "delete", selection: editor.selection });
              setEditor({ ...editor, selection: null, message: "" });
            }}
          />
          <div className="build-actions">
            <button
              className="game-button"
              disabled={!level.treasures.length}
              onClick={session.testDungeon}
            >
              <GameIcon name="play" />
              Test room
            </button>
            <button
              className="game-button primary"
              disabled={!view.canChallenge}
              onClick={session.challengeDrilly}
            >
              <GameSprite name="drilly" />
              Challenge Drilly
              <GameIcon name="arrow" />
            </button>
          </div>
        </footer>
      ) : (
        <footer className="play-footer">
          <p className="input-help">
            {view.phase === "watch" ? (
              "Drilly’s recorded attempt"
            ) : (
              <>
                <kbd>Space</kbd> or tap to jump
              </>
            )}
          </p>
          {view.canPlay && !view.paused && view.mode === "human" && (
            <button className="jump-button" onClick={() => session.jump()}>
              <GameIcon name="jump" />
              Jump
            </button>
          )}
        </footer>
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
