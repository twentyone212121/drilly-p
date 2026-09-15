import Phaser from "phaser";
import { roomBorders } from "../../../shared/game/roomBoundary";
import type { Session } from "../session";

/** Anchor the editor shelf to the rendered floor without per-tick layout reads. */
export function createWallControls(
  game: Phaser.Game,
  parent: HTMLElement,
  session: Session,
) {
  const shell = parent.closest<HTMLElement>(".arcade-game");
  let controlsFrame = 0;
  function positionWallControls() {
    if (controlsFrame) return;
    controlsFrame = requestAnimationFrame(() => {
      controlsFrame = 0;
      updateWallControls();
    });
  }
  function updateWallControls() {
    if (!shell || !game.canvas) return;
    const room = session.getSnapshot().level;
    const floor = roomBorders(room).find(
      (border) => border.id === "room-frame-floor",
    )!;
    const canvas = game.canvas.getBoundingClientRect();
    const root = shell.getBoundingClientRect();
    const scale = canvas.width / room.width;
    const width = floor.width * scale;
    const height = floor.height * scale;
    const sideMargin = width * 0.055;
    const availableWidth = width - sideMargin * 2;
    const controlsScale = Math.max(
      0.01,
      Math.min(1, (height * 0.76) / 112, availableWidth / 1460),
    );
    shell.style.setProperty(
      "--wall-controls-left",
      `${canvas.left - root.left + floor.x * scale + sideMargin}px`,
    );
    shell.style.setProperty(
      "--wall-controls-center",
      `${canvas.top - root.top + (floor.y + floor.height / 2) * scale}px`,
    );
    shell.style.setProperty(
      "--wall-controls-width",
      `${availableWidth / controlsScale}px`,
    );
    shell.style.setProperty("--wall-controls-scale", String(controlsScale));
    shell.style.setProperty("--wall-controls-visible", "visible");
  }
  let lastRoom = session.getSnapshot().level;
  const offControls = session.subscribe(() => {
    const room = session.getSnapshot().level;
    if (room === lastRoom) return;
    lastRoom = room;
    positionWallControls();
  });
  const canvasResize = new ResizeObserver(positionWallControls);
  // Canvas centering can change its position without changing its dimensions.
  // Follow Phaser's layout directly, not only the browser's resize notifications.
  const canvasLayout = new MutationObserver(positionWallControls);
  function connectWallControls() {
    canvasResize.observe(game.canvas);
    canvasLayout.observe(game.canvas, {
      attributes: true,
      attributeFilter: ["style", "width", "height"],
    });
    game.scale.on(Phaser.Scale.Events.RESIZE, updateWallControls);
    updateWallControls();
  }
  if (game.isBooted && game.canvas) connectWallControls();
  else game.events.once(Phaser.Core.Events.READY, connectWallControls);
  document.addEventListener("fullscreenchange", positionWallControls);

  return {
    refresh: positionWallControls,
    destroy() {
      canvasResize.disconnect();
      canvasLayout.disconnect();
      game.events.off(Phaser.Core.Events.READY, connectWallControls);
      game.scale.off(Phaser.Scale.Events.RESIZE, updateWallControls);
      document.removeEventListener("fullscreenchange", positionWallControls);
      offControls();
      cancelAnimationFrame(controlsFrame);
    },
  };
}
