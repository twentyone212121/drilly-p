import { useEffect, useRef } from "react";
import { createGame } from "../game/phaser/createGame";
import type { AudioSettings } from "../game/phaser/audio";
import type { Session } from "../game/session";

export function GameView({ session, audio }: { session: Session; audio: AudioSettings }) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof createGame> | null>(null);
  const initialAudio = useRef(audio);

  useEffect(() => {
    if (!host.current) return;

    const instance = createGame(host.current, session, initialAudio.current);
    game.current = instance;

    return () => {
      instance.destroy();
      game.current = null;
    };
  }, [session]);

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
        (target.closest("dialog, input, textarea, select") || target.isContentEditable)
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
      role="region"
      aria-label="Dungeon game. Tap to start, jump, retry, or continue."
      tabIndex={0}
    />
  );
}
