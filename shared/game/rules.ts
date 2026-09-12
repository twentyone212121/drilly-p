// Provisional checkpoint mechanics. Changing these requires a new replay version.
export const RULES = Object.freeze({
  version: "checkpoint-1",
  tickRate: 60,
  playerWidth: 24,
  playerHeight: 28,
  runSpeed: 240,
  gravity: 1700,
  jumpSpeed: 680,
  wallSlideSpeed: 110,
  maxTicks: 1800,
});

export function describeRules() {
  return {
    name: "Drilly P",
    protocolVersion: 1,
    rules: RULES,
    objective: "Reach the treasure rectangle without touching a saw.",
    coordinates:
      "Pixels; origin top-left; positive x right, positive y down. Player/platform coordinates are top-left; trap coordinates are centers.",
    input:
      "jumpTicks: sorted unique nonnegative integers. Tick N input is consumed before advancing state N to N+1. Ground and wall jumps only. Wall jumps reverse direction. No steering or stopping.",
    timing:
      "60 fixed ticks/second. Jump events use the input tick; collision events use the resulting state tick. All traps in version 1 are stationary.",
    outcome:
      "Dead and won states are terminal. Lethal contact wins ties with treasure. Attempts stop at maxTicks (at most 1800).",
    replay:
      "version: 1; rulesVersion; full level snapshot; jumpTicks; endTick. Initial state is derived from level.spawn with zero vertical velocity. Replay cannot change rules.",
  };
}
