import type Phaser from "phaser";
import type { Level, State } from "../../../shared/game/types";
import { flameBounds, obstacleBounds } from "../../../shared/game/obstacles";
import { RULES } from "../../../shared/game/rules";

export const OBSTACLE_TEXTURES = ["spikes", "turret", "drone", "pursuer"] as const;

export function createObstacleArt(scene: Phaser.Scene, level: Level) {
  const routes = scene.add.graphics();
  const sprites = (level.obstacles ?? []).map((o) => {
    const bounds = obstacleBounds(o);
    const image =
      o.kind === "slider"
        ? scene.add.image(o.x, o.y, "computer-props", "saw")
        : scene.add.image(0, 0, `obstacle-${o.kind}`);
    image.setDisplaySize(bounds.width, bounds.height);
    image.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    if (o.kind === "slider" || o.kind === "drone") {
      routes.lineStyle(2, o.kind === "slider" ? 0xa13278 : 0x327c89, 0.7);
      routes.lineBetween(o.x, o.y, o.endX, o.endY);
      routes.fillStyle(0x9ad84d);
      for (const p of [o, { x: o.endX, y: o.endY }]) routes.fillCircle(p.x, p.y, 3);
    }
    return image;
  });
  const effects = scene.add.graphics();
  return {
    update(state: State) {
      effects.clear();
      (level.obstacles ?? []).forEach((o, index) => {
        const current = state.obstacles[index];
        if (!current) return;
        const sprite = sprites[index];
        if (o.kind === "spikes") return;
        sprite.setPosition(current.x, current.y);
        if (o.kind === "slider") sprite.setRotation(state.tick / 8);
        if (o.kind === "drone") {
          effects.lineStyle(2, 0x57dae8, 0.65);
          const a = state.tick / 12;
          for (let i = 0; i < 3; i++) {
            const angle = a + (i * Math.PI * 2) / 3;
            effects.lineBetween(
              current.x + Math.cos(angle) * o.radius * 0.72,
              current.y + Math.sin(angle) * o.radius * 0.72,
              current.x + Math.cos(angle + 0.45) * o.radius * 0.72,
              current.y + Math.sin(angle + 0.45) * o.radius * 0.72,
            );
          }
        }
        if (current.phase === "warning") {
          effects.lineStyle(2, 0xffbd65, 0.65 + Math.sin(state.tick / 4) * 0.25);
          effects.strokeCircle(current.x, current.y, o.radius + 5);
          effects.lineBetween(
            current.x,
            current.y - o.radius - 16,
            current.x,
            current.y - o.radius - 9,
          );
          effects.fillStyle(0xffbd65);
          effects.fillCircle(current.x, current.y - o.radius - 5, 1.5);
        }
        if (o.kind === "pursuer") {
          sprite.setTint(current.phase === "returning" ? 0x88aabb : 0xffffff);
          if (current.phase === "active") {
            effects.lineStyle(2, 0xeb47b2, 0.7);
            effects.lineBetween(
              current.x,
              current.y,
              current.x - Math.cos(current.angle) * (o.radius + 12),
              current.y - Math.sin(current.angle) * (o.radius + 12),
            );
          }
        }
        if (o.kind === "turret") {
          sprite.setAlpha(current.phase === "idle" ? 0.65 : 1);
          const dx = Math.cos(current.angle),
            dy = Math.sin(current.angle);
          effects.lineStyle(7, 0x56627a);
          effects.lineBetween(o.x, o.y, o.x + dx * o.radius, o.y + dy * o.radius);
          effects.lineStyle(3, current.phase === "warning" ? 0xffbd65 : 0xee42b0);
          effects.lineBetween(o.x, o.y, o.x + dx * o.radius, o.y + dy * o.radius);
          if (current.phase === "warning") {
            effects.lineStyle(1, 0xffbd65, 0.35);
            effects.lineBetween(o.x, o.y, o.x + dx * o.range, o.y + dy * o.range);
          }
          if (o.mode === "flame" && current.phase === "active") {
            const flame = flameBounds(o, level);
            effects.fillStyle(0xf46b28, 0.8);
            effects.fillRect(flame.x, flame.y, flame.width, flame.height);
            effects.fillStyle(0xffda6b, 0.9);
            const inset = 3 + (state.tick % 4);
            effects.fillRect(
              flame.x,
              flame.y + inset,
              flame.width,
              Math.max(2, flame.height - inset * 2),
            );
          }
        }
      });
      for (const p of state.projectiles) {
        effects.fillStyle(0xff4cbe, 0.2);
        effects.fillCircle(p.x, p.y, RULES.obstacles.projectileRadius + 3);
        effects.fillStyle(0xff83d2);
        effects.fillCircle(p.x, p.y, RULES.obstacles.projectileRadius);
        effects.fillStyle(0xffe7fa);
        effects.fillCircle(p.x, p.y, 2);
      }
    },
    destroy() {
      routes.destroy();
      effects.destroy();
      sprites.forEach((sprite) => sprite.destroy());
    },
  };
}
