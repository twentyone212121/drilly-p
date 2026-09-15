import Phaser from "phaser";
import { createWallControls } from "./wallControls";
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
  const level = session.getSnapshot().level;
  // Lock the initial display scale: fullscreen adds space, never magnification.
  const initialScale =
    Math.min(
      parent.clientWidth / level.width,
      parent.clientHeight / level.height,
    ) || 1;
  // Keep a crisp 2× buffer, prioritizing frame delivery over extra supersampling.
  const density = Math.min(
    2,
    Math.max(1, Math.ceil(initialScale * window.devicePixelRatio)),
  );
  const scene = new GameScene(session, settings, editor, density);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: level.width * density,
    height: level.height * density,
    transparent: true,
    // The attempt owns fixed ticks and interpolation; use actual display-frame timing.
    fps: { smoothStep: false, forceSetTimeOut: false, limit: 0 },
    render: {
      antialias: true,
      // High-density rendering already smooths edges; avoid a second multisample pass.
      antialiasGL: false,
      pixelArt: false,
      roundPixels: false,
      powerPreference: "high-performance",
    },
    scene,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: initialScale / density,
    },
    banner: false,
  });

  const wallControls = createWallControls(game, parent, session);

  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (game.isBooted && width > 0 && height > 0) {
      const zoom = Math.min(
        initialScale / density,
        width / game.scale.width,
        height / game.scale.height,
      );
      game.scale.setParentSize(width, height);
      if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
    }
    scene.requestRender();
    wallControls.refresh();
  });
  resize.observe(parent);

  return {
    destroy() {
      resize.disconnect();
      wallControls.destroy();
      game.destroy(true);
      // Phaser processes destruction on a frame, including when previously asleep.
      if (game.isBooted) game.loop.wake();
    },
    setEditor: (next: EditorOptions) => scene.setEditor(next),
    setAudio: (next: AudioSettings) => scene.setAudio(next),
  };
}
