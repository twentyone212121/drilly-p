import type Phaser from "phaser";
import type { Level, State } from "../../../shared/game/types";
import { RULES } from "../../../shared/game/rules";
import { COLORS } from "./assets";

type Graphics = Phaser.GameObjects.Graphics;

export function drawRoom(
  graphics: Graphics,
  level: Level,
  state: State,
  ghost = false,
): void {
  drawBackground(graphics, level);
  drawPlatforms(graphics, level.platforms);
  drawTraps(graphics, level.traps, state.tick);
  for (const treasure of level.treasures) {
    if (!state.collectedTreasureIds.includes(treasure.id))
      drawTreasure(graphics, treasure);
  }
  drawPlayer(graphics, state, ghost);
}

function drawBackground(graphics: Graphics, level: Level): void {
  graphics.clear();

  // A quiet entrance silhouette and floor markers make the route readable.
  graphics.lineStyle(2, 0x547078);
  graphics.strokeRoundedRect(
    level.spawn.x - 10,
    level.spawn.y - 30,
    44,
    58,
    18,
  );
}

function drawPlatforms(
  graphics: Graphics,
  platforms: Level["platforms"],
): void {
  for (const platform of platforms) {
    graphics.fillStyle(COLORS.stone);
    graphics.fillRoundedRect(
      platform.x,
      platform.y,
      platform.width,
      platform.height,
      3,
    );
    graphics.fillStyle(COLORS.edge);
    graphics.fillRect(platform.x, platform.y, platform.width, 3);
    graphics.lineStyle(1, 0x222f3c);
    for (let x = platform.x + 36; x < platform.x + platform.width; x += 36)
      graphics.lineBetween(x, platform.y + 5, x, platform.y + platform.height);
  }
}

function drawTraps(
  graphics: Graphics,
  traps: Level["traps"],
  tick: number,
): void {
  for (const trap of traps) {
    graphics.fillStyle(COLORS.danger);
    const angle = tick / 10;

    for (let tooth = 0; tooth < 10; tooth++) {
      const a = angle + (tooth * Math.PI) / 5;
      graphics.fillTriangle(
        trap.x + Math.cos(a) * (trap.radius + 3),
        trap.y + Math.sin(a) * (trap.radius + 3),
        trap.x + Math.cos(a + 0.2) * (trap.radius - 5),
        trap.y + Math.sin(a + 0.2) * (trap.radius - 5),
        trap.x + Math.cos(a - 0.2) * (trap.radius - 5),
        trap.y + Math.sin(a - 0.2) * (trap.radius - 5),
      );
    }

    graphics.fillCircle(trap.x, trap.y, trap.radius - 5);
    graphics.fillStyle(0x442e2d);
    graphics.fillCircle(trap.x, trap.y, 5);
  }
}

function drawTreasure(
  graphics: Graphics,
  chest: Level["treasures"][number],
): void {
  graphics.fillStyle(COLORS.gold);
  graphics.fillRoundedRect(chest.x, chest.y, chest.width, chest.height, 4);
  graphics.fillStyle(0x9e753d);
  graphics.fillRect(chest.x, chest.y + 12, chest.width, 3);
  graphics.fillStyle(0xffe2a0);
  graphics.fillRect(chest.x + chest.width / 2 - 3, chest.y + 9, 6, 10);
}

function drawPlayer(graphics: Graphics, state: State, ghost: boolean): void {
  const player = state.player;

  graphics.fillStyle(0x000000, 0.18);
  graphics.fillEllipse(player.x + 12, player.y + RULES.playerHeight + 3, 26, 6);
  graphics.fillStyle(
    ghost ? 0x9e9bff : state.status === "dead" ? COLORS.danger : COLORS.player,
    ghost ? 0.55 : 1,
  );
  graphics.fillRoundedRect(
    player.x,
    player.y,
    RULES.playerWidth,
    RULES.playerHeight,
    7,
  );
  graphics.fillStyle(0x19271e);
  graphics.fillRoundedRect(player.x + 3, player.y + 6, 18, 9, 3);
  graphics.fillStyle(0xffffff);
  graphics.fillRect(
    player.x + (player.direction === 1 ? 15 : 5),
    player.y + 8,
    4,
    4,
  );
}
