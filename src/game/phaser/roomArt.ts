import { createObstacleArt } from "./obstacleArt";
import type Phaser from "phaser";
import type { GameEvent, Level, State } from "../../../shared/game/types";
import { RULES } from "../../../shared/game/rules";
import { platformPanels } from "../art/platformPanels";

export function createRoomArt(scene: Phaser.Scene, level: Level) {
  const objects: Phaser.GameObjects.Image[] = [];
  const props = (frame: string, x: number, y: number, width: number, height: number) => {
    const image = scene.add.image(x, y, "computer-props", frame).setOrigin(0);
    image.setDisplaySize(width, height);
    objects.push(image);
    return image;
  };

  const platforms = scene.add.graphics();
  for (const platform of level.platforms) {
    for (const panel of platformPanels(platform)) {
      platforms.fillStyle(panel.color);
      platforms.fillRect(panel.x, panel.y, panel.width, panel.height);
    }
  }
  const saws = level.traps.map((trap) => {
    const image = props("saw", trap.x, trap.y, trap.radius * 2, trap.radius * 2);
    return image.setOrigin(0.5);
  });
  const treasures = level.treasures.map((treasure) =>
    props("data", treasure.x, treasure.y, treasure.width, treasure.height),
  );
  const obstacleArt = createObstacleArt(scene, level);
  const player = scene.add.image(0, 0, "esc", "idle").setOrigin(0.5, 1);
  objects.push(player);
  const fragments = scene.add.graphics();
  let jumpTick = -100;
  let wallJumpTick = -100;
  let deathMs = 0;
  let lastTick = -1;
  let landingTick = -100;

  return {
    consume(events: GameEvent[]) {
      for (const event of events) {
        if (event.type === "landed") landingTick = event.tick;
        if (event.type === "jumped") {
          jumpTick = event.tick;
          if (event.kind === "wall") wallJumpTick = event.tick;
        }
      }
    },
    update(state: State, ghost: boolean, delta: number) {
      obstacleArt.update(state);
      if (state.tick < lastTick) {
        landingTick = jumpTick = wallJumpTick = -100;
        deathMs = 0;
      }
      lastTick = state.tick;
      if (state.status !== "dead") deathMs = 0;
      else deathMs = Math.min(500, deathMs + Math.max(0, Math.min(delta, 100)));
      fragments.clear();
      const landed = state.tick - landingTick < 6;
      const running =
        !ghost &&
        state.status === "running" &&
        state.tick > 0 &&
        state.player.grounded &&
        !landed &&
        Math.abs(state.player.vx) > 0;
      const frame = ghost
        ? state.status === "dead"
          ? "defeated"
          : state.player.grounded
            ? "hover"
            : "active"
        : !state.player.grounded
          ? "jump"
          : landed
            ? "land"
            : "idle";
      const texture = ghost ? "drilly" : running ? "esc-run" : "esc";
      const runFrame = `run-${Math.floor(state.tick / 5) % 6}`;
      player.setTexture(texture, running ? runFrame : frame).setOrigin(0.5, 1);
      const reference = scene.textures.getFrame(
        texture,
        ghost ? "hover" : running ? "run-0" : "idle",
      );
      const scale = RULES.playerHeight / reference.height;
      const jumpStrength =
        !ghost && state.status === "running" ? Math.max(0, 1 - (state.tick - jumpTick) / 8) : 0;
      const landStrength =
        !ghost && state.status === "running" && landed
          ? Math.max(0, 1 - (state.tick - landingTick) / 6)
          : 0;
      player.setScale(
        scale * (1 - jumpStrength * 0.08 + landStrength * 0.08),
        scale * (1 + jumpStrength * 0.1 - landStrength * 0.08),
      );
      player.setPosition(
        state.player.x + RULES.playerWidth / 2,
        state.player.y + RULES.playerHeight,
      );
      // A small visual lean communicates direction without mirroring the ESC label.
      player.setRotation(
        state.status === "running"
          ? state.player.direction *
              (0.04 + (!ghost ? Math.max(0, 1 - (state.tick - wallJumpTick) / 10) * 0.16 : 0))
          : 0,
      );
      player.setAlpha(ghost ? 0.8 : state.status === "dead" ? Math.max(0.3, 1 - deathMs / 300) : 1);
      if (!ghost && state.status === "dead" && deathMs < 500) {
        const t = deathMs / 1000;
        for (let index = 0; index < 6; index++) {
          const angle = (index * Math.PI * 2) / 6;
          fragments.fillStyle(index % 2 ? 0xeee4d2 : 0x50dcf3, 1 - deathMs / 500);
          fragments.fillRect(
            player.x + Math.cos(angle) * t * 55 - 2,
            player.y - RULES.playerHeight / 2 + Math.sin(angle) * t * 45 + t * t * 80,
            3,
            3,
          );
        }
      }
      player.setTint(state.status === "dead" && !ghost ? 0xff8297 : 0xffffff);
      saws.forEach((image) => image.setRotation(state.tick / 10));
      treasures.forEach((image, index) =>
        image.setVisible(!state.collectedTreasureIds.includes(level.treasures[index].id)),
      );
    },
    destroy() {
      platforms.destroy();
      obstacleArt.destroy();
      fragments.destroy();
      objects.forEach((image) => image.destroy());
    },
  };
}
