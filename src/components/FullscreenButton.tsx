import { useEffect, useState } from "react";
import { GameIcon } from "./GameArt";

export function FullscreenButton() {
  const [active, setActive] = useState(Boolean(document.fullscreenElement));
  const [error, setError] = useState("");

  useEffect(() => {
    const update = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggle(target: HTMLElement | null) {
    setError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target?.requestFullscreen();
    } catch {
      setError("Fullscreen could not open. Please try again.");
    }
  }

  return (
    <>
      <button
        className="icon-button"
        aria-label={active ? "Exit fullscreen" : "Enter fullscreen"}
        aria-pressed={active}
        disabled={!document.fullscreenEnabled}
        title={
          document.fullscreenEnabled
            ? active
              ? "Exit fullscreen"
              : "Enter fullscreen"
            : "Fullscreen is unavailable in this browser"
        }
        onClick={(event) => void toggle(event.currentTarget.closest("main"))}
      >
        <GameIcon name={active ? "fullscreen-exit" : "fullscreen"} />
      </button>
      {error && (
        <p className="fullscreen-error" role="status">
          {error}
        </p>
      )}
    </>
  );
}
