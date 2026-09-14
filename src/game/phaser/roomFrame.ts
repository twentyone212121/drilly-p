import type Phaser from "phaser";
import type { Level } from "../../../shared/game/types";
import { roomBorders } from "../../../shared/game/roomBoundary";

/** Static computer casing, baked with the room art; its inner edge matches collision. */
export function drawRoomFrame(graphics: Phaser.GameObjects.Graphics, level: Level) {
  for (const border of roomBorders(level)) {
    const { x, y, width, height, id } = border;
    graphics.fillStyle(0x081522);
    graphics.fillRect(x, y, width, height);
    graphics.fillStyle(0x172b3d);
    graphics.fillRect(x + 2, y + 2, width - 4, height - 4);
    graphics.lineStyle(1, 0x344d60, 0.8);
    graphics.strokeRect(x + 4, y + 4, width - 8, height - 8);

    const vertical = id.endsWith("left") || id.endsWith("right");
    const length = vertical ? height : width;
    for (let offset = 16; offset < length - 8; offset += 80) {
      const cx = vertical ? x + width / 2 : x + offset;
      const cy = vertical ? y + offset : y + height / 2;
      graphics.fillStyle(0x081420);
      graphics.fillCircle(cx, cy, 3.5);
      graphics.lineStyle(1, 0x496070);
      graphics.lineBetween(cx - 1.5, cy - 1.5, cx + 1.5, cy + 1.5);
      if (vertical) {
        graphics.fillStyle(0x0b1b29);
        graphics.fillRect(cx - 4, cy + 17, 8, 18);
        graphics.fillStyle(0x4a9eae, 0.65);
        graphics.fillRect(cx - 1, cy + 21, 2, 8);
      } else {
        graphics.fillStyle(0x0b1b29);
        graphics.fillRect(cx + 17, cy - 4, 24, 8);
        graphics.fillStyle(0x4a9eae, 0.65);
        graphics.fillRect(cx + 22, cy - 1, 10, 2);
      }
    }

    graphics.lineStyle(2, 0x637f8a, 0.8);
    if (id.endsWith("left")) graphics.lineBetween(x + width - 1, y, x + width - 1, y + height);
    if (id.endsWith("right")) graphics.lineBetween(x + 1, y, x + 1, y + height);
    if (id.endsWith("ceiling")) graphics.lineBetween(x, y + height - 1, x + width, y + height - 1);
    if (id.endsWith("floor")) graphics.lineBetween(x, y + 1, x + width, y + 1);
  }
}
