import Phaser from "phaser";
import type { Session } from "../session";
import { GameScene } from "./GameScene";
import type { AudioSettings } from "./audio";
import type { EditorOptions } from "./editorInput";

export function createGame(
  parent: HTMLElement,
  session: Session,
  settings: AudioSettings,
  editor: EditorOptions,
) {
  const scene = new GameScene(session, settings, editor);
  const level = session.getSnapshot().level;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: level.width,
    height: level.height,
    transparent: true,
    scene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false,
  });

  const resize = new ResizeObserver(([entry]) => {
    if (game.isBooted) game.scale.setParentSize(entry.contentRect.width, entry.contentRect.height);
    scene.requestRender();
  });
  resize.observe(parent);

  return {
    destroy() {
      resize.disconnect();
      game.destroy(true);
      // Phaser processes destruction on a frame, including when previously asleep.
      if (game.isBooted) game.loop.wake();
    },
    setEditor: (next: EditorOptions) => scene.setEditor(next),
    setAudio: (next: AudioSettings) => scene.setAudio(next),
  };
}
