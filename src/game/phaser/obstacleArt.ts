import type Phaser from "phaser";
import type { Obstacle, Spikes } from "../../../shared/game/obstacleTypes";
import type { Level, State } from "../../../shared/game/types";
import {
  flameBounds,
  obstacleBounds,
  turretAngle,
} from "../../../shared/game/obstacles";
import { RULES } from "../../../shared/game/rules";

export const OBSTACLE_TEXTURES = [
  "spikes",
  "turret",
  "drone",
  "pursuer",
  "saw",
] as const;

function spikeRowTexture(scene: Phaser.Scene, spikes: Spikes) {
  const vertical = (spikes.rotation ?? 0) % 2 === 1;
  const length = vertical ? spikes.height : spikes.width;
  const count = Math.max(
    1,
    Math.round(length / RULES.obstacles.spikeToothWidth),
  );
  const key = `spike-row-${count}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures
    .get("obstacle-spikes")
    .getSourceImage() as HTMLImageElement;
  const tileWidth = source.width / 4;
  const texture = scene.textures.createCanvas(
    key,
    tileWidth * count,
    source.height,
  )!;
  for (let i = 0; i < count; i++) {
    texture.context.drawImage(
      source,
      0,
      0,
      tileWidth,
      source.height,
      i * tileWidth,
      0,
      tileWidth,
      source.height,
    );
  }
  texture.refresh();
  return key;
}

export function setObstacleImage(
  image: Phaser.GameObjects.Image,
  obstacle: Obstacle,
) {
  const bounds = obstacleBounds(obstacle);
  image.setTexture(
    obstacle.kind === "spikes"
      ? spikeRowTexture(image.scene, obstacle)
      : obstacle.kind === "slider"
        ? "computer-props"
        : `obstacle-${obstacle.kind}`,
    obstacle.kind === "slider" ? "saw" : undefined,
  );
  image.setOrigin(0.5).setDisplaySize(bounds.width, bounds.height);
  image.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const angle = obstacle.kind === "turret" ? turretAngle(obstacle) : 0;
  image
    .setFlipX(false)
    .setFlipY(obstacle.kind === "turret" && Math.cos(angle) < 0)
    .setRotation(angle);
  if (obstacle.kind === "drone")
    image.setRotation(
      Math.atan2(obstacle.endY - obstacle.y, obstacle.endX - obstacle.x),
    );
  if (obstacle.kind === "spikes") {
    const rotation = obstacle.rotation ?? 0;
    image.setDisplaySize(
      rotation % 2 ? bounds.height : bounds.width,
      rotation % 2 ? bounds.width : bounds.height,
    );
    image.setRotation((rotation * Math.PI) / 2);
  }
}

export function createObstacleArt(scene: Phaser.Scene, level: Level) {
  const routes = scene.add.graphics().setDepth(9);
  const sprites = (level.obstacles ?? []).map((o) => {
    const image = scene.add.image(0, 0, "computer-props", "saw").setDepth(10);
    setObstacleImage(image, o);
    if (o.kind === "slider" || o.kind === "drone") {
      routes.lineStyle(2, o.kind === "slider" ? 0xa13278 : 0x327c89, 0.7);
      routes.lineBetween(o.x, o.y, o.endX, o.endY);
      routes.fillStyle(0x9ad84d);
      for (const p of [o, { x: o.endX, y: o.endY }])
        routes.fillCircle(p.x, p.y, 3);
    }
    return image;
  });
  const effects = scene.add.graphics().setDepth(11);
  return {
    update(state: State) {
      effects.clear();
      (level.obstacles ?? []).forEach((o, index) => {
        const current = state.obstacles[index];
        if (!current) return;
        const sprite = sprites[index];
        if (o.kind === "spikes") {
          sprite.setTint(state.tick % 90 < 8 ? 0xffd6ef : 0xffffff);
          return;
        }
        sprite.setPosition(current.x, current.y);
        if (o.kind === "slider") sprite.setRotation(state.tick / 8);
        if (o.kind === "drone") {
          sprite.setRotation(current.angle);
          const dx = Math.cos(current.angle),
            dy = Math.sin(current.angle);
          for (const side of [-1, 1]) {
            const cx = current.x + side * dx * o.radius * 0.5;
            const cy = current.y + side * dy * o.radius * 0.5;
            effects.lineStyle(1.5, 0x78b8c3, 0.8);
            for (let i = 0; i < 3; i++) {
              const angle = state.tick / 5 + (i * Math.PI * 2) / 3;
              effects.lineBetween(
                cx,
                cy,
                cx + Math.cos(angle) * o.radius * 0.3,
                cy + Math.sin(angle) * o.radius * 0.3,
              );
            }
            effects.fillStyle(0x152b3a);
            effects.fillCircle(cx, cy, 1.4);
          }
        }
        if (o.kind === "pursuer") {
          const pulse = 0.65 + Math.sin(state.tick / 12) * 0.2;
          effects.lineStyle(1, 0xef83cf, pulse);
          effects.strokeCircle(current.x, current.y, o.radius * 0.32);
          effects.fillStyle(0xffecf8);
          effects.fillCircle(
            current.x + Math.cos(current.angle) * o.radius * 0.12,
            current.y + Math.sin(current.angle) * o.radius * 0.12,
            o.radius * 0.08,
          );
        }
        if (o.kind === "turret") {
          const dx = Math.cos(current.angle),
            dy = Math.sin(current.angle);
          sprite.setRotation(current.angle).setFlipY(dx < 0);
          sprite.setAlpha(current.phase === "idle" ? 0.85 : 1);
          const muzzle = {
            x: o.x + dx * o.radius * 0.88,
            y: o.y + dy * o.radius * 0.88,
          };
          const charge =
            current.phase === "warning"
              ? (state.tick % o.intervalTicks) / o.warmupTicks
              : 0;
          // A recessed charging chamber and muzzle light replace the floating UI ring.
          if (charge > 0) {
            effects.fillStyle(0xffa954, 0.1 + charge * 0.2);
            effects.fillCircle(muzzle.x, muzzle.y, 2 + charge * 4);
            effects.fillStyle(0xffd48c, 0.4 + charge * 0.5);
            effects.fillCircle(muzzle.x, muzzle.y, 1 + charge * 1.5);
            effects.fillStyle(0xffb75c, 0.5 + charge * 0.5);
            effects.fillCircle(
              o.x - dy * o.radius * 0.35,
              o.y + dx * o.radius * 0.35,
              1.7,
            );
          }
          if (o.mode === "flame" && current.phase === "active") {
            const flame = flameBounds(o, level);
            effects.save();
            effects.translateCanvas(o.x, o.y);
            if (o.axis === "y") effects.rotateCanvas(Math.PI / 2);
            drawFlame(
              effects,
              0,
              0,
              o.direction,
              o.axis === "y" ? flame.height : flame.width,
              RULES.obstacles.flameHalfHeight,
              state.tick,
            );
            effects.restore();
          } else if (o.mode !== "flame") {
            const sinceShot = (state.tick % o.intervalTicks) - o.warmupTicks;
            if (sinceShot >= 0 && sinceShot < 5) {
              effects.fillStyle(0xffdfbd, (1 - sinceShot / 5) * 0.8);
              effects.fillTriangle(
                muzzle.x - dy * 3,
                muzzle.y + dx * 3,
                muzzle.x + dy * 3,
                muzzle.y - dx * 3,
                muzzle.x + dx * (8 - sinceShot),
                muzzle.y + dy * (8 - sinceShot),
              );
            }
          }
        }
      });
      for (const p of state.projectiles) {
        const speed = Math.hypot(p.vx, p.vy);
        const dx = p.vx / speed,
          dy = p.vy / speed;
        const r = RULES.obstacles.projectileRadius;
        effects.fillStyle(0xd837b0, 0.22);
        effects.fillTriangle(
          p.x - dy * r,
          p.y + dx * r,
          p.x + dy * r,
          p.y - dx * r,
          p.x - dx * 18,
          p.y - dy * 18,
        );
        effects.fillStyle(0xff53c4, 0.85);
        effects.fillTriangle(
          p.x - dy * r * 0.65,
          p.y + dx * r * 0.65,
          p.x + dy * r * 0.65,
          p.y - dx * r * 0.65,
          p.x - dx * 9,
          p.y - dy * 9,
        );
        effects.fillStyle(0xff89d6);
        effects.fillCircle(p.x, p.y, r);
        effects.fillStyle(0xffe8f7);
        effects.fillCircle(p.x + dx, p.y + dy, r * 0.45);
      }
    },
    destroy() {
      routes.destroy();
      effects.destroy();
      sprites.forEach((sprite) => sprite.destroy());
    },
  };
}

// Tick-driven silhouettes: no particles or randomness can drift during pause/replay.
function drawFlame(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  direction: number,
  length: number,
  halfHeight: number,
  tick: number,
) {
  if (length <= 0) return;
  for (const [color, scale, alpha] of [
    [0xec4a26, 1, 0.35],
    [0xff8a32, 0.8, 0.9],
    [0xffe39b, 0.38, 0.95],
  ]) {
    const points: { x: number; y: number }[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 24; i++) {
        const f = side === -1 ? i / 24 : 1 - i / 24;
        const wave =
          Math.sin(f * 34 - tick * 0.65 + side) * 0.17 +
          Math.sin(f * 71 - tick * 0.9) * 0.1;
        const envelope = Math.min(1, 0.4 + f * 3) * (1 - Math.pow(f, 7));
        const spread =
          halfHeight * scale * Math.max(0.05, envelope * (0.7 + wave));
        points.push({ x: x + direction * f * length, y: y + side * spread });
      }
    }
    graphics.fillStyle(color, alpha);
    graphics.fillPoints(points, true);
  }
  // Short embers stay inside the actual reach and make the tip readable.
  for (let i = 0; i < 5; i++) {
    const phase = ((tick * 3 + i * 19) % 100) / 100;
    const f = 0.35 + phase * 0.65;
    const cy = y + Math.sin(i * 7 + tick * 0.15) * halfHeight * 0.7;
    graphics.lineStyle(1.5, 0xffc671, (1 - phase) * 0.8);
    graphics.lineBetween(
      x + direction * Math.max(0, f * length - 5),
      cy,
      x + direction * f * length,
      cy,
    );
  }
}
