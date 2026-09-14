import type Phaser from "phaser";
import type { State } from "../../../shared/game/types";
import { RULES } from "../../../shared/game/rules";

/** Bright contact points and short golden filings that scatter away from both palms. */
export function drawWallSparks(graphics: Phaser.GameObjects.Graphics, state: State) {
  const side = state.player.wall;
  const wallX = state.player.x + (side > 0 ? RULES.playerWidth : 0);
  for (let hand = 0; hand < 2; hand++) {
    const contactY = state.player.y + RULES.playerHeight * (hand === 0 ? 0.27 : 0.64);
    // A warm contact flash contrasts with ESC's cyan hands and the blue room.
    graphics.fillStyle(0xffa43c, 0.22);
    graphics.fillCircle(wallX - side, contactY, 4);
    graphics.fillStyle(0xfff2bc, 0.95);
    graphics.fillCircle(wallX - side, contactY, 1.8);
    graphics.lineStyle(1.5, 0xffd786, 0.9);
    graphics.lineBetween(wallX - side, contactY - 3, wallX - side, contactY + 4);
    for (let spark = 0; spark < 5; spark++) {
      const age = ((state.tick + spark * 5 + hand * 3) % 23) / 23;
      const speed = 9 + spark * 3;
      const x = wallX - side * (2 + age * speed);
      const y = contactY - age * (7 + spark * 2) + age * age * 13;
      const alpha = (1 - age) ** 0.6;
      const tail = 3 + (1 - age) * 3;
      graphics.lineStyle(1.6, spark % 2 ? 0xffbd58 : 0xffedab, alpha);
      graphics.lineBetween(x, y, x + side * tail, y + 2 * (1 - age));
      graphics.fillStyle(0xfff9df, alpha);
      graphics.fillCircle(x, y, 1.1);
    }
  }
}
