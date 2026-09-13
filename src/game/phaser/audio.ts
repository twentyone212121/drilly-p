import type Phaser from "phaser";
import type { GameEvent } from "../../../shared/game/types";
import { AUDIO } from "./assets";

export type AudioSettings = { muted: boolean; volume: number };

const EVENT_SOUNDS: Partial<Record<GameEvent["type"], keyof typeof AUDIO>> = {
  jumped: "jump",
  landed: "land",
  died: "death",
  won: "win",
};

export function createAudio(scene: Phaser.Scene, settings: AudioSettings) {
  let current = settings;

  function apply(next: AudioSettings) {
    current = next;
    scene.sound.mute = next.muted;
    scene.sound.volume = next.volume;
  }

  function playEvent(event: GameEvent) {
    const key = EVENT_SOUNDS[event.type];
    if (!key || scene.sound.locked || current.muted || current.volume <= 0) return;
    if (!scene.cache.audio.exists(key)) return;

    scene.sound.play(key);
  }

  function consume(events: GameEvent[]) {
    events.forEach(playEvent);
  }

  apply(settings);

  return {
    apply,
    consume,
    stop: () => scene.sound.stopAll(),
    destroy() {
      scene.sound.stopAll();
    },
  };
}
