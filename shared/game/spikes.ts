import type { Spikes } from "./obstacleTypes";
import { RULES } from "./rules";
import type { Rect } from "./types";

/** The mounting rail is solid; the exposed teeth are lethal on every side. */
export function spikeParts(spikes: Spikes): { base: Rect; teeth: Rect } {
  const { x, y, width, height } = spikes;
  const rotation = spikes.rotation ?? 0;
  const thickness =
    (rotation % 2 ? width : height) * RULES.obstacles.spikeBaseFraction;
  switch (rotation) {
    case 1:
      return {
        base: { x, y, width: thickness, height },
        teeth: { x: x + thickness, y, width: width - thickness, height },
      };
    case 2:
      return {
        base: { x, y, width, height: thickness },
        teeth: { x, y: y + thickness, width, height: height - thickness },
      };
    case 3:
      return {
        base: { x: x + width - thickness, y, width: thickness, height },
        teeth: { x, y, width: width - thickness, height },
      };
    default:
      return {
        base: { x, y: y + height - thickness, width, height: thickness },
        teeth: { x, y, width, height: height - thickness },
      };
  }
}
