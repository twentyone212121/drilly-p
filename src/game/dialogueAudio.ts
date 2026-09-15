export const DIALOGUE_SOUND_EVENT = "drilly-dialogue-sound";
export type DialogueSound = {
  kind: "word" | "switch" | "start" | "reset";
  speaker: "esc" | "drilly";
};

export function playDialogueSound(sound: DialogueSound) {
  window.dispatchEvent(
    new CustomEvent<DialogueSound>(DIALOGUE_SOUND_EVENT, { detail: sound }),
  );
}

let introStarted = false;
export function hasStartedIntroAudio() {
  return introStarted;
}
export function setIntroAudioStarted(value: boolean) {
  introStarted = value;
  playDialogueSound({ kind: value ? "start" : "reset", speaker: "esc" });
}
