import type Phaser from "phaser";
import type { Level, State } from "../../../shared/game/types";
import { RULES } from "../../../shared/game/rules";

export function createRoomArt(scene: Phaser.Scene, level: Level) {
  const objects: Phaser.GameObjects.Image[] = [];
  const props = (
    frame: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const image = scene.add.image(x, y, "computer-props", frame).setOrigin(0);
    image.setDisplaySize(width, height);
    objects.push(image);
    return image;
  };

  for (const platform of level.platforms) {
    props(
      platform.height > platform.width ? "wall" : "platform",
      platform.x,
      platform.y,
      platform.width,
      platform.height,
    );
  }
  const saws = level.traps.map((trap) => {
    const image = props(
      "saw",
      trap.x,
      trap.y,
      trap.radius * 2,
      trap.radius * 2,
    );
    return image.setOrigin(0.5);
  });
  const treasures = level.treasures.map((treasure) =>
    props("data", treasure.x, treasure.y, treasure.width, treasure.height),
  );
  const player = scene.add.image(0, 0, "esc", "idle").setOrigin(0.5, 1);
  objects.push(player);
  let wasGrounded = true;
  let lastTick = -1;
  let landingTick = -100;

  return {
    update(state: State, ghost: boolean) {
      if (state.tick < lastTick) landingTick = -100;
      if (state.tick !== lastTick) {
        if (!wasGrounded && state.player.grounded) landingTick = state.tick;
        wasGrounded = state.player.grounded;
        lastTick = state.tick;
      }
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
      player.setScale(scale);
      player.setPosition(
        state.player.x + RULES.playerWidth / 2,
        state.player.y + RULES.playerHeight,
      );
      // A small visual lean communicates direction without mirroring the ESC label.
      player.setRotation(
        state.status === "running" ? state.player.direction * 0.04 : 0,
      );
      player.setAlpha(ghost ? 0.8 : 1);
      player.setTint(state.status === "dead" && !ghost ? 0xff8297 : 0xffffff);
      saws.forEach((image) => image.setRotation(state.tick / 10));
      treasures.forEach((image, index) =>
        image.setVisible(
          !state.collectedTreasureIds.includes(level.treasures[index].id),
        ),
      );
    },
    destroy() {
      objects.forEach((image) => image.destroy());
    },
  };
}
