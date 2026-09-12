import { useEffect, useRef } from "react";
import { createGame } from "../game/phaser/createGame";
import type { AudioSettings, AudioStatus } from "../game/phaser/audio";
import type { Session } from "../game/session";

export function GameView({
  session,
  audio,
  onAudio,
}: {
  session: Session;
  audio: AudioSettings;
  onAudio: (status: AudioStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof createGame> | null>(null);
  const initialAudio = useRef(audio);

  useEffect(() => {
    if (!host.current) return;

    let active = true;
    const instance = createGame(host.current, session, initialAudio.current, (status) => {
      if (active) onAudio(status);
    });
    game.current = instance;

    return () => {
      active = false;
      instance.destroy();
      game.current = null;
    };
  }, [session, onAudio]);

  useEffect(() => game.current?.setAudio(audio), [audio]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) session.pause();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.isComposing) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select") || target.isContentEditable)
      )
        return;

      // Space belongs to gameplay even when a toolbar button retains focus.
      // Cancel its native keyup click as well as scrolling; Enter still activates buttons.
      event.preventDefault();
      if (!event.repeat) session.primaryAction();
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [session]);

  return (
    <div
      ref={host}
      className="game-host"
      style={{
        aspectRatio: `${session.level.width} / ${session.level.height}`,
      }}
      role="region"
      aria-label="Dungeon game. Tap to jump."
      tabIndex={0}
    />
  );
}
