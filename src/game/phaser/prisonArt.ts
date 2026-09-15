import type Phaser from "phaser";
import type { Level, State } from "../../../shared/game/types";

/** Background bars are decorative; the ordinary room platforms own collisions. */
export function createPrisonArt(
  scene: Phaser.Scene,
  level: Level,
  density: number,
) {
  if (level.id !== "prison") return null;
  const exit = level.treasures.find((item) => item.id === "escape-door");
  const g = scene.add.graphics();
  g.scaleCanvas(density, density);
  g.fillStyle(0x030b13, 0.68);
  g.fillRect(12, 12, level.width - 24, 408);
  for (let x = 40; x < level.width - 20; x += 32) {
    const broken = exit && x >= exit.x && x <= exit.x + exit.width;
    const segments = broken
      ? [
          { y: 12, height: exit.y - 12 },
          { y: exit.y + exit.height, height: 420 - exit.y - exit.height },
        ]
      : [{ y: 12, height: 408 }];
    for (const segment of segments) {
      g.fillStyle(0x091623, 0.9);
      g.fillRect(x, segment.y, 7, segment.height);
      g.fillStyle(0x45606d, 0.6);
      g.fillRect(x, segment.y, 1.5, segment.height);
    }
  }
  for (const y of [130, 330]) {
    g.fillStyle(0x213947, 0.9);
    g.fillRect(12, y, level.width - 24, 5);
    g.fillStyle(0x506672, 0.5);
    g.fillRect(12, y, level.width - 24, 1);
  }
  g.generateTexture(
    "prison-bars",
    level.width * density,
    level.height * density,
  );
  g.destroy();
  const bars = scene.add
    .image(0, 0, "prison-bars")
    .setOrigin(0)
    .setDisplaySize(level.width, level.height)
    .setDepth(-2);
  const lights = scene.add.graphics().setDepth(-1);
  const opening = exit
    ? scene.add
        .image(exit.x - 8, exit.y - 14, "prison-exit")
        .setOrigin(0)
        .setDisplaySize(exit.width + 16, exit.height + 14)
        .setDepth(10)
    : null;
  return {
    update(state: State) {
      lights.clear();
      const pulse = 0.45 + Math.sin(state.tick / 45) * 0.15;
      for (const x of [255, 508, 761]) {
        lights.fillStyle(0xe66675, pulse * 0.08);
        lights.fillCircle(x, 42, 38);
        lights.fillStyle(0xe66675, pulse);
        lights.fillRect(x - 8, 38, 16, 4);
      }
      if (exit) {
        lights.fillStyle(0x72e5db, pulse * 0.13);
        lights.fillEllipse(
          exit.x + exit.width / 2,
          exit.y + exit.height / 2,
          exit.width + 12,
          exit.height,
        );
      }
    },
    destroy() {
      bars.destroy();
      opening?.destroy();
      lights.destroy();
      scene.textures.remove("prison-bars");
    },
  };
}
