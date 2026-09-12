import type Phaser from "phaser";

// Decoration only: never contributes collisions or simulation state.
export function drawAmbience(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  seconds: number,
) {
  graphics.clear();
  const x = width * 0.26;
  const y = height * 0.08;
  const radius = Math.min(width, height) * 0.105;

  graphics.fillStyle(0x0b1321);
  graphics.fillCircle(x, y, radius);
  graphics.lineStyle(3, 0x423654);
  graphics.strokeCircle(x, y, radius);
  graphics.fillStyle(0x55456b, 0.7);
  for (let blade = 0; blade < 5; blade++) {
    const angle = seconds * 1.3 + (blade * Math.PI * 2) / 5;
    graphics.fillTriangle(
      x + Math.cos(angle) * radius * 0.2,
      y + Math.sin(angle) * radius * 0.2,
      x + Math.cos(angle + 0.3) * radius * 0.86,
      y + Math.sin(angle + 0.3) * radius * 0.86,
      x + Math.cos(angle + 0.95) * radius * 0.7,
      y + Math.sin(angle + 0.95) * radius * 0.7,
    );
  }
  graphics.fillStyle(0x221d32);
  graphics.fillCircle(x, y, radius * 0.25);

  for (let light = 0; light < 4; light++) {
    const brightness =
      0.25 + 0.45 * (0.5 + 0.5 * Math.sin(seconds * 2 + light * 1.8));
    graphics.fillStyle(light % 2 ? 0x84be46 : 0x54becb, brightness);
    graphics.fillRoundedRect(width - 65, height * 0.14 + light * 13, 7, 4, 1);
  }
}
