import { RULES } from "../../../shared/game/rules";
import type Phaser from "phaser";
import { RUN_STRIDE_TICKS } from "../presentation";

/** Reuse the idle pose's feet, so the keycap and face never swap or wobble. */
export function createRunLegs(scene: Phaser.Scene) {
  const texture = scene.textures.get("esc");
  const idle = texture.get("idle");
  const regions = [
    { name: "running-left-foot", x: 10, width: 30 },
    { name: "running-right-foot", x: 62, width: 32 },
  ];
  const feet = regions.map(({ name, x, width }) => {
    if (!texture.has(name))
      texture.add(
        name,
        idle.sourceIndex,
        idle.cutX + x,
        idle.cutY + 83,
        width,
        14,
      );
    return scene.add.image(0, 0, "esc", name).setDepth(39).setVisible(false);
  });

  return {
    update(player: Phaser.GameObjects.Image, tick: number, running: boolean) {
      feet.forEach((foot) => foot.setVisible(running));
      if (!running) {
        player.setCrop();
        return;
      }

      player.setCrop(0, 0, idle.width, 82);
      const direction = player.flipX ? -1 : 1;
      const phase = (tick * Math.PI * 2) / RUN_STRIDE_TICKS;
      feet.forEach((foot, index) => {
        const step = phase + index * Math.PI;
        const lift = Math.max(0, Math.sin(step));
        foot.setScale(player.scaleX).setFlipX(player.flipX);
        foot.setPosition(
          player.x +
            direction *
              ((index ? 6 : -6) + Math.cos(step) * 1.5) *
              RULES.playerVisualScale,
          player.y - (2 + lift * 1.5) * RULES.playerVisualScale,
        );
        foot.setRotation(direction * Math.sin(step) * 0.14);
      });
    },
    destroy() {
      feet.forEach((foot) => foot.destroy());
    },
  };
}
