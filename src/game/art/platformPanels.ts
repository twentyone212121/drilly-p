type Bounds = { x: number; y: number; width: number; height: number };
type PanelRect = Bounds & { color: number };

/** Size-aware hardware panels shared by Phaser and the SVG editor. */
export function platformPanels(bounds: Bounds): PanelRect[] {
  const result: PanelRect[] = [];
  const add = (x: number, y: number, width: number, height: number, color: number) => {
    if (width > 0 && height > 0) result.push({ x, y, width, height, color });
  };
  const { x, y, width, height } = bounds;
  const vertical = height > width;
  const columns = Math.max(1, Math.ceil(width / 96));
  const rows = Math.max(1, Math.ceil(height / 96));
  const w = width / columns;
  const h = height / rows;
  const bevel = Math.min(2, width / 8, height / 8);

  // A continuous dark backing keeps every solid edge aligned with its collider.
  add(x, y, width, height, 0x101b29);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const px = x + column * w;
      const py = y + row * h;
      add(px + bevel, py + bevel, w - bevel * 2, h - bevel * 2, 0x2b3c50);
      add(px + bevel, py + bevel, w - bevel * 2, bevel, 0x61758a);
      add(px + bevel, py + bevel * 2, bevel, h - bevel * 4, 0x41566c);
      add(px + w - bevel * 2, py + bevel * 2, bevel, h - bevel * 3, 0x1a293a);
      add(px + bevel * 2, py + h - bevel * 3, w - bevel * 4, bevel, 0x1b2a3c);

      // Recessed face plate and short status light; never scale a bolt or a bevel.
      if (w >= 12 && h >= 12) {
        add(px + 5, py + 5, w - 10, h - 10, 0x223246);
        if (vertical && h >= 28) {
          add(px + w / 2 - 1, py + 9, 2, Math.min(14, h - 18), 0x142233);
          add(px + w / 2 - 1, py + h - 14, 2, 6, 0x51bbc7);
        } else if (!vertical && w >= 28) {
          add(px + 9, py + h / 2 - 1, Math.min(18, w - 18), 2, 0x142233);
          add(px + w - 15, py + h / 2 - 1, 6, 2, 0x51bbc7);
        }
      }
    }
  }

  // Continuous edge rails separate playable surfaces from the dark background.
  if (vertical) {
    add(x, y, bevel, height, 0x526c80);
    add(x + width - bevel, y, bevel, height, 0x526c80);
  } else {
    add(x, y, width, bevel, 0x91a6b8);
    add(x, y + bevel, width, bevel, 0x526c80);
  }
  return result;
}
