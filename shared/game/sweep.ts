import type { Rect } from "./types";
type Point = { x: number; y: number };

// First contact time in [0,1]. Slabs also handle zero-length segments.
export function segmentRect(from: Point, to: Point, rect: Rect): number | null {
  let enter = 0;
  let leave = 1;
  for (const [p, d, low, high] of [
    [from.x, to.x - from.x, rect.x, rect.x + rect.width],
    [from.y, to.y - from.y, rect.y, rect.y + rect.height],
  ]) {
    if (d === 0) {
      if (p < low || p > high) return null;
    } else {
      const a = (low - p) / d;
      const b = (high - p) / d;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return null;
    }
  }
  return enter;
}

function segmentCircle(from: Point, to: Point, center: Point, radius: number) {
  const x = from.x - center.x;
  const y = from.y - center.y;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (x * dx + y * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

// A rectangle expanded by a circle has round corners, not oversized square corners.
export function sweptCircle(from: Point, to: Point, radius: number, rect: Rect): number | null {
  const hits = [
    segmentRect(from, to, {
      x: rect.x - radius,
      y: rect.y,
      width: rect.width + radius * 2,
      height: rect.height,
    }),
    segmentRect(from, to, {
      x: rect.x,
      y: rect.y - radius,
      width: rect.width,
      height: rect.height + radius * 2,
    }),
    ...[rect.x, rect.x + rect.width].flatMap((x) =>
      [rect.y, rect.y + rect.height].map((y) => segmentCircle(from, to, { x, y }, radius)),
    ),
  ].filter((hit): hit is number => hit !== null);
  return hits.length ? Math.min(...hits) : null;
}

export function movingCircleHit(from: Point, to: Point, radius: number, oldBody: Rect, body: Rect) {
  return sweptCircle(
    from,
    {
      x: to.x - (body.x - oldBody.x),
      y: to.y - (body.y - oldBody.y),
    },
    radius,
    oldBody,
  );
}
