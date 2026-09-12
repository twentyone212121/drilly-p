// Provisional mechanics and editor tuning. Bump the rules version when mechanics change.
export const RULES = Object.freeze({
  version: "editor-2",
  raidAttempts: 3,
  tickRate: 60,
  playerWidth: 24,
  playerHeight: 28,
  runSpeed: 240,
  gravity: 1700,
  jumpSpeed: 680,
  wallSlideSpeed: 110,
  maxTicks: 1800,
  editor: Object.freeze({
    gridSize: 8,
    maxPlatforms: 24,
    maxSaws: 12,
    maxTreasures: 8,
    minPlatformSize: 8,
    platformWidth: 96,
    platformHeight: 24,
    sawRadius: 24,
    treasureWidth: 32,
    treasureHeight: 32,
  }),
});

export function describeRules() {
  return {
    name: "Drilly P",
    protocolVersion: 2,
    rules: RULES,
    objective:
      "Collect every treasure rectangle without touching a saw. At least one treasure is required.",
    coordinates:
      "Pixels; origin top-left; positive x right, positive y down. Player/platform coordinates are top-left; trap coordinates are centers.",
    input:
      "jumpTicks: sorted unique nonnegative integers. Tick N input is consumed before advancing state N to N+1. Ground and wall jumps only. Wall jumps reverse direction. No steering or stopping.",
    timing:
      "60 fixed ticks/second. Jump events use the input tick; collision events use the resulting state tick. All saws are stationary.",
    outcome:
      "Dead and won states are terminal. Lethal contact wins ties with treasure. Attempts stop at maxTicks (at most 1800).",
    replay:
      "version: 2; rulesVersion; full version 2 level snapshot with treasures (each has an id); jumpTicks; endTick. Initial state is derived from level.spawn with zero vertical velocity and no collected treasures. Older versions are rejected. Replay cannot change rules.",
  };
}
