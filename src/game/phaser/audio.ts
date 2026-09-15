import {
  DIALOGUE_SOUND_EVENT,
  hasStartedIntroAudio,
  type DialogueSound,
} from "../dialogueAudio";
import { isWallSliding, RUN_STRIDE_TICKS } from "../presentation";
import type Phaser from "phaser";
import type { GameEvent, State } from "../../../shared/game/types";
import { AUDIO } from "./assets";

export type AudioSettings = { muted: boolean; volume: number };

const EVENT_SOUNDS: Partial<Record<GameEvent["type"], keyof typeof AUDIO>> = {
  jumped: "jump",
  "turret-fired": "shot",
  landed: "land",
  "wall-contact": "wall",
  died: "death",
  won: "win",
};

export function createAudio(
  scene: Phaser.Scene,
  settings: AudioSettings,
  prison = false,
  intro = false,
) {
  let current = settings;
  let inPrison = prison;
  let inIntro = intro;
  let lastFootstep = -1;
  const footstep = scene.cache.audio.exists("footstep")
    ? scene.sound.add("footstep")
    : null;
  const scrape = scene.cache.audio.exists("scrape")
    ? scene.sound.add("scrape", { loop: true, volume: 0.35 })
    : null;
  const music = scene.cache.audio.exists("music")
    ? scene.sound.add("music", { loop: true, volume: 0.38 })
    : null;

  const ambience = scene.cache.audio.exists("prison")
    ? scene.sound.add("prison", { loop: true, volume: 0.18 })
    : null;

  const introMusic = scene.cache.audio.exists("intro")
    ? scene.sound.add("intro", { loop: true, volume: 0.58 })
    : null;

  function startMusic() {
    const waitingForEntry = inIntro && !hasStartedIntroAudio();
    const background = waitingForEntry
      ? null
      : inIntro || inPrison
        ? introMusic
        : music;
    for (const track of [introMusic, ambience, music]) {
      const active =
        track === background ||
        (track === ambience && inPrison && !waitingForEntry);
      if (!active) {
        track?.stop();
        continue;
      }
      if (
        !track ||
        scene.sound.locked ||
        document.hidden ||
        current.muted ||
        current.volume <= 0
      )
        continue;
      if (track.isPaused) track.resume();
      else if (!track.isPlaying) track.play();
    }
  }

  function onVisibility() {
    if (document.hidden) {
      introMusic?.pause();
      music?.pause();
      ambience?.pause();
      scrape?.stop();
    } else startMusic();
  }

  function updateMovement(state: State, enabled: boolean) {
    const sliding =
      enabled &&
      isWallSliding(state) &&
      !scene.sound.locked &&
      !document.hidden &&
      !current.muted &&
      current.volume > 0;
    if (sliding) {
      if (scrape && !scrape.isPlaying) scrape.play();
    } else if (scrape?.isPlaying) scrape.stop();
    const running =
      enabled &&
      state.status === "running" &&
      state.tick > 0 &&
      state.player.grounded &&
      state.player.wall === 0 &&
      Math.abs(state.player.vx) > 0;
    if (!running) {
      if (lastFootstep !== -1) footstep?.stop();
      lastFootstep = -1;
      return;
    }
    // Two footfalls per six-frame run cycle (five simulation ticks per sprite frame).
    const beat = Math.floor(state.tick / (RUN_STRIDE_TICKS / 2));
    if (beat === lastFootstep) return;
    lastFootstep = beat;
    if (
      !scene.sound.locked &&
      !document.hidden &&
      !current.muted &&
      current.volume > 0
    )
      footstep?.play({ volume: 0.65, rate: beat % 2 ? 1.06 : 0.96 });
  }

  function stopEffects() {
    lastFootstep = -1;
    for (const key of Object.keys(AUDIO)) {
      if (key !== "music" && key !== "prison" && key !== "intro")
        scene.sound.stopByKey(key);
    }
  }

  function apply(next: AudioSettings) {
    current = next;
    scene.sound.mute = next.muted;
    scene.sound.volume = next.volume;
    if (next.muted || next.volume <= 0) scrape?.stop();
    startMusic();
  }

  function playEvent(event: GameEvent) {
    // The landing sound is already the first footfall after a jump.
    if (event.type === "landed")
      lastFootstep = Math.floor(event.tick / (RUN_STRIDE_TICKS / 2));
    const key =
      event.type === "jumped" && event.kind === "wall"
        ? "wallJump"
        : EVENT_SOUNDS[event.type];
    if (!key || scene.sound.locked || current.muted || current.volume <= 0)
      return;
    if (!scene.cache.audio.exists(key)) return;

    if (event.type === "died") stopEffects();
    if (event.type === "jumped" || event.type === "wall-contact")
      footstep?.stop();
    if (event.type === "wall-contact") {
      scene.sound.stopByKey("jump");
      scene.sound.stopByKey("wallJump");
    }
    if (key === "wallJump") scene.sound.stopByKey("wall");
    scene.sound.play(key);
  }

  function consume(events: GameEvent[]) {
    events.forEach(playEvent);
  }

  let disposed = false;
  let wordTone = 0;
  function onDialogue(event: Event) {
    const { kind, speaker } = (event as CustomEvent<DialogueSound>).detail;
    if (kind === "reset") {
      startMusic();
      return;
    }
    if (kind === "start") {
      // Resume directly in the gesture: the scene may be sleeping on the entry screen.
      if ("context" in scene.sound) {
        void scene.sound.context
          .resume()
          .then(() => {
            if (disposed) return;
            scene.game.loop.wake();
            startMusic();
          })
          .catch(() => {});
      } else startMusic();
      return;
    }
    if (
      !inIntro ||
      scene.sound.locked ||
      document.hidden ||
      current.muted ||
      current.volume <= 0
    )
      return;
    const key = kind === "word" ? "dialogueWord" : "dialogueSwitch";
    if (scene.cache.audio.exists(key))
      scene.sound.play(key, {
        volume: kind === "word" ? 0.6 : 0.65,
        rate:
          (speaker === "esc" ? 1.07 : 0.96) +
          (kind === "word" ? ((wordTone++ % 3) - 1) * 0.025 : 0),
      });
  }

  window.addEventListener(DIALOGUE_SOUND_EVENT, onDialogue);
  scene.sound.on("unlocked", startMusic);
  document.addEventListener("visibilitychange", onVisibility);
  apply(settings);

  return {
    setIntro(value: boolean) {
      if (inIntro === value) return;
      inIntro = value;
      if (!value) {
        scene.sound.stopByKey("dialogueWord");
        scene.sound.stopByKey("dialogueSwitch");
      }
      startMusic();
    },
    setPrison(value: boolean) {
      if (inPrison === value) return;
      inPrison = value;
      startMusic();
    },
    apply,
    consume,
    updateMovement,
    stop: stopEffects,
    destroy() {
      disposed = true;
      window.removeEventListener(DIALOGUE_SOUND_EVENT, onDialogue);
      introMusic?.destroy();
      scene.sound.off("unlocked", startMusic);
      document.removeEventListener("visibilitychange", onVisibility);
      stopEffects();
      music?.destroy();
      ambience?.destroy();
      footstep?.destroy();
      scrape?.destroy();
    },
  };
}
