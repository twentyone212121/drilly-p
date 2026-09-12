import type Phaser from "phaser";
import type { GameEvent } from "../../../shared/game/types";
import { AUDIO } from "./assets";

export type AudioSettings = { muted: boolean; volume: number };

export type AudioStatus = AudioSettings & {
  ready: boolean;
  unlocked: boolean;
  played: number;
  last: string;
  missing: string[];
};

const EVENT_SOUNDS: Partial<Record<GameEvent["type"], keyof typeof AUDIO>> = {
  jumped: "jump",
  landed: "land",
  died: "death",
  won: "win",
};

export function createAudio(
  scene: Phaser.Scene,
  settings: AudioSettings,
  report: (status: AudioStatus) => void,
) {
  let played = 0;
  let last = "none";
  const missing = Object.keys(AUDIO).filter((key) => !scene.cache.audio.exists(key));
  let current = settings;

  function notify() {
    report({
      ...current,
      ready: missing.length === 0,
      unlocked: !scene.sound.locked,
      played,
      last,
      missing,
    });
  }

  function apply(next: AudioSettings) {
    current = next;
    scene.sound.mute = next.muted;
    scene.sound.volume = next.volume;
    notify();
  }

  function playEvent(event: GameEvent) {
    const key = EVENT_SOUNDS[event.type];
    if (!key || scene.sound.locked || current.muted || current.volume <= 0) return;
    if (!scene.cache.audio.exists(key)) return;

    if (scene.sound.play(key)) {
      played++;
      last = key;
    }
  }

  function consume(events: GameEvent[]) {
    events.forEach(playEvent);
    if (events.length) notify();
  }

  scene.sound.on("unlocked", notify);
  apply(settings);

  return {
    apply,
    consume,
    stop: () => scene.sound.stopAll(),
    destroy() {
      scene.sound.off("unlocked", notify);
      scene.sound.stopAll();
    },
  };
}
