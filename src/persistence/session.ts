import type { Session } from "../game/session";
import { parseAudioSettings } from "../../shared/validation";

const SESSION_KEY = "drilly-p.session";
const AUDIO_KEY = "drilly-p.audio";

export function loadSession(): unknown {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return undefined;
  }
}

export function loadAudio() {
  try {
    return parseAudioSettings(
      JSON.parse(localStorage.getItem(AUDIO_KEY) ?? "null"),
    );
  } catch {
    return { muted: false, volume: 0.6 };
  }
}

export function saveAudio(settings: ReturnType<typeof loadAudio>) {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  } catch {
    /* Keep settings in memory. */
  }
}

export function persistSession(session: Session) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous = "";
  let boundary = "";
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    try {
      const next = JSON.stringify(session.exportSession());
      if (next !== previous) {
        localStorage.setItem(SESSION_KEY, next);
        previous = next;
      }
    } catch {
      /* Full or blocked storage must not interrupt play. */
    }
    const view = session.getSnapshot();
    if (!stopped && ((!view.paused && view.canPlay) || view.presentingDeath))
      timer = setTimeout(flush, 500);
  }
  function schedule() {
    const view = session.getSnapshot();
    const next = JSON.stringify([
      view.phase,
      view.paused,
      view.state.status,
      view.watchIndex,
      view.watchIdle,
      view.round,
      view.scoreboard,
      view.showGhost,
    ]);
    if (boundary !== next) {
      boundary = next;
      flush();
    } else if (!timer) timer = setTimeout(flush, 500);
  }
  const off = session.subscribe(schedule);
  const visibility = () => {
    if (document.hidden) flush();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", visibility);
  flush();
  return () => {
    stopped = true;
    off();
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", visibility);
    flush();
  };
}
