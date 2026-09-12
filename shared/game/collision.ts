import type { Rect, Platform } from "./types";

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function touchesCircle(
  body: Rect,
  circle: { x: number; y: number; radius: number },
): boolean {
  const dx = circle.x - Math.max(body.x, Math.min(circle.x, body.x + body.width));
  const dy = circle.y - Math.max(body.y, Math.min(circle.y, body.y + body.height));

  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

// Swept axis separation: crossing a thin platform still counts as a collision.
export function moveBody(body: Rect, dx: number, dy: number, platforms: Platform[]) {
  const next = { ...body, x: body.x + dx };
  let wall: -1 | 0 | 1 = 0;

  for (const p of platforms) {
    if (body.y >= p.y + p.height || body.y + body.height <= p.y) continue;

    if (dx > 0 && body.x + body.width <= p.x && next.x + next.width >= p.x) {
      next.x = p.x - next.width;
      wall = 1;
    }

    if (dx < 0 && body.x >= p.x + p.width && next.x <= p.x + p.width) {
      next.x = p.x + p.width;
      wall = -1;
    }
  }

  next.y += dy;
  let floor: string | null = null;
  let ceiling = false;

  for (const p of platforms) {
    if (next.x >= p.x + p.width || next.x + next.width <= p.x) continue;

    if (dy > 0 && body.y + body.height <= p.y && next.y + next.height >= p.y) {
      next.y = p.y - next.height;
      floor = p.id;
    }

    if (dy < 0 && body.y >= p.y + p.height && next.y <= p.y + p.height) {
      next.y = p.y + p.height;
      ceiling = true;
    }
  }

  return { ...next, wall, floor, ceiling };
}
