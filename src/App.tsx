import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Session } from "./game/session";
import { GameView } from "./components/GameView";
import { DungeonEditor } from "./components/DungeonEditor";
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
  const levelRevision = session.levelRevision;
  // The session is mutable; its revision invalidates this copied room.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const level = useMemo(() => session.level, [session, levelRevision]);
  const building = view.phase === "build";

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
      <GameHud
        view={view}
        totalTreasures={level.treasures.length}
        audio={audio}
        onMute={() => setAudio({ ...audio, muted: !audio.muted })}
        onMenu={openMenu}
      />
      {building ? (
        <DungeonEditor
          session={session}
          level={view.editorLevel}
          actions={
            <div className="build-actions">
              <button
                className="game-button"
                disabled={!view.editorLevel.treasures.length}
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
          }
        />
      ) : (
        <>
          <section className="playfield" aria-label="Room">
            <div className="room-viewport">
              <GameView session={session} audio={audio} />
            </div>
          </section>
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
        </>
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
