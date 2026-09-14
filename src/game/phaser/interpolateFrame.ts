import type { State } from "../../../shared/game/types";

/** Blend only drawing coordinates. Collision state and recorded inputs stay on fixed ticks. */
export function interpolateFrame({
  previous,
  current,
  alpha,
}: {
  previous: State;
  current: State;
  alpha: number;
}): State {
  if (alpha >= 1 || current.status !== "running" || previous.tick + 1 !== current.tick)
    return current;

  const blend = (from: number, to: number) => from + (to - from) * alpha;
  const previousShots = new Map(previous.projectiles.map((shot) => [shot.id, shot]));
  return {
    ...current,
    player: {
      ...current.player,
      x: blend(previous.player.x, current.player.x),
      y: blend(previous.player.y, current.player.y),
    },
    obstacles: current.obstacles.map((obstacle, index) => {
      const before = previous.obstacles[index];
      if (!before || before.id !== obstacle.id) return obstacle;
      const turn = Math.atan2(
        Math.sin(obstacle.angle - before.angle),
        Math.cos(obstacle.angle - before.angle),
      );
      return {
        ...obstacle,
        x: blend(before.x, obstacle.x),
        y: blend(before.y, obstacle.y),
        angle: before.angle + turn * alpha,
      };
    }),
    projectiles: current.projectiles.map((shot) => {
      const before = previousShots.get(shot.id);
      return before ? { ...shot, x: blend(before.x, shot.x), y: blend(before.y, shot.y) } : shot;
    }),
  };
}
