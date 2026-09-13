import Phaser from "phaser";
import type { Session } from "../session";
import { GameScene } from "./GameScene";
import type { AudioSettings } from "./audio";

export function createGame(parent: HTMLElement, session: Session, settings: AudioSettings) {
  const scene = new GameScene(session, settings);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: session.level.width,
    height: session.level.height,
    transparent: true,
    scene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false,
  });

  return {
    destroy: () => game.destroy(true),
    setAudio: (next: AudioSettings) => scene.setAudio(next),
  };
}
