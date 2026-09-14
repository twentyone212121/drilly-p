import type Phaser from "phaser";
import { RULES } from "../../../shared/game/rules";
import { DEATH_ANIMATION_MS } from "../presentation";

/** Upright electric shock, driven only by time since the simulation died. */
export function drawElectricDeath(
  player: Phaser.GameObjects.Image,
  sparks: Phaser.GameObjects.Graphics,
  elapsed: number,
  scale: number,
) {
  const progress = Math.min(1, elapsed / DEATH_ANIMATION_MS);
  const shock = Math.min(1, (1 - progress) * 5);
  const phase = elapsed / 45;
  const x = player.x;
  const y = player.y - RULES.playerHeight / 2;
  const feetY = player.y;
  const shudder = (Math.sin(phase * 2.3) + Math.sin(phase * 4.7) * 0.35) * shock;

  player.setPosition(x + shudder * 2.6, feetY + Math.sin(phase * 3.1) * shock * 1.2);
  player.setScale(scale, scale);
  player.setRotation(Math.sin(phase * 1.7) * shock * 0.06);
  player.setTint(0xb8f6ff);
  player.setAlpha(1);

  if (shock <= 0) return;

  // A continuous glow and small moving arcs keep the effect local to ESC.
  sparks.fillStyle(0x50dcf3, shock * 0.12);
  sparks.fillCircle(x, y, RULES.playerHeight * 0.85);
  for (let arc = 0; arc < 5; arc++) {
    const angle = (arc * Math.PI * 2) / 5 + Math.sin(phase / 3) * 0.2;
    const radius = RULES.playerHeight * 0.52;
    sparks.lineStyle(arc % 2 ? 1 : 2, arc % 2 ? 0xf5ffff : 0x50dcf3, shock);
    sparks.beginPath();
    for (let point = 0; point < 5; point++) {
      const distance = radius + point * 4;
      const zigzag = point % 2 ? Math.sin(phase + arc) * 7 : -3;
      const px = x + Math.cos(angle) * distance - Math.sin(angle) * zigzag;
      const py = y + Math.sin(angle) * distance + Math.cos(angle) * zigzag;
      if (point === 0) sparks.moveTo(px, py);
      else sparks.lineTo(px, py);
    }
    sparks.strokePath();
  }
}
