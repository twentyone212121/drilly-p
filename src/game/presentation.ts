import type { State } from "../../shared/game/types";

// Presentation timing does not advance simulation ticks or change replay outcomes.
export const DEATH_ANIMATION_MS = 2400;

export function isWallSliding(state: State) {
  return (
    state.status === "running" &&
    state.player.wall !== 0 &&
    !state.player.grounded &&
    state.player.vy > 0
  );
}
