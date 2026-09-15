// Provisional mechanics and editor tuning. Bump the rules version when mechanics change.
export const RULES = Object.freeze({
  version: "obstacles-7",
  raidAttempts: 3,
  roomBorderWidth: 12,
  drilly: Object.freeze({
    defaultModel: "gpt-6-astra" as const,
    models: [
      { id: "gpt-6-astra", label: "Astra" },
      { id: "gpt-5.6-sol", label: "Sol" },
      { id: "gpt-5.6-luna", label: "Luna" },
    ] as const,
    feedbackEvents: 16,
    buildThinkingTimeoutMs: 180000,
    raidThinkingTimeoutMs: 180000,
    raidClientTimeoutMs: 210000,
    providerOutputTokens: 3000,
    maxGeneratedHazards: 4,
    maxGeneratedTreasures: 3,
    maxGeneratedPlatforms: 6,
    sideWallWidth: 12,
  }),
  tickRate: 60,
  playerWidth: 24,
  playerHeight: 28,
  runSpeed: 240,
  gravity: 1700,
  jumpSpeed: 680,
  wallSlideSpeed: 110,
  maxTicks: 1800,
  obstacles: Object.freeze({
    maxCount: 20,
    maxPerKind: 8,
    minSpeed: 20,
    maxSpeed: 480,
    minRadius: 4,
    maxRadius: 48,
    minRange: 32,
    maxRange: 1200,
    minInterval: 45,
    maxInterval: 600,
    minWarning: 12,
    projectileRadius: 5,
    flameHalfHeight: 12,
    spikesWidth: 48,
    spikesHeight: 20,
    radius: 18,
    pathLength: 96,
    patrolSpeed: 90,
    pursuerSpeed: 150,
    detectionRange: 160,
    chaseRange: 320,
    warningTicks: 30,
    intervalTicks: 90,
    flameIntervalTicks: 150,
    warmupTicks: 45,
    activeTicks: 45,
    range: 240,
    projectileSpeed: 220,
  }),
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
      "Rooms always have an indestructible floor, ceiling, and side frame. Collect every treasure rectangle without touching a hazard. At least one treasure is required.",
    coordinates:
      "Pixels; origin top-left; positive x right, positive y down. Player/platform coordinates are top-left; trap coordinates are centers.",
    input:
      "jumpTicks: sorted unique nonnegative integers. Tick N input is consumed before advancing state N to N+1. Grounded jumps keep direction, including at wall corners. Airborne wall jumps reverse direction. No steering or stopping.",
    timing:
      "60 fixed ticks/second. Jump events use the input tick; collision events use the resulting state tick. Legacy saws are stationary; obstacles update on the same fixed ticks. See obstacle behavior below.",
    obstacles: {
      spikes:
        "Lethal rectangle; x/y are its top-left. All other obstacles use center x/y and radius.",
      patrols:
        "slider/drone: linear ping-pong from x/y to endX/endY at speed pixels/second. Routes pass through platforms.",
      turret:
        "Cycle begins at tick 0. Warning until warmupTicks, then one shot (fixed/aimed) or flame for activeTicks. Rest of intervalTicks is cooldown. Aimed shots lock the player's center at firing time within range. Shots continue until a platform or room boundary; range only limits aimed acquisition and flame reach. Default firing interval is 90 ticks (1.5 seconds). Platforms stop shots and flames. Turret bodies are safe to touch; only shots and active flames are lethal.",
      pursuer:
        "Detect within detectionRange of home, warn warningTicks, then chase at speed. Return home if the player leaves chaseRange of home. Cannot reacquire until home. Passes through platforms. Body always lethal.",
      reset:
        "All paths, timers, pursuers, and projectiles reset per attempt. No randomness or wall-clock time.",
    },
    outcome:
      "Dead and won states are terminal. Lethal contact wins ties with treasure. Attempts stop at maxTicks (at most 1800).",
    replay:
      "version: 2; rulesVersion; full version 2 level snapshot with treasures (each has an id); jumpTicks; endTick. Initial state is derived from level.spawn with zero vertical velocity and no collected treasures. Older versions are rejected. Replay cannot change rules.",
  };
}
