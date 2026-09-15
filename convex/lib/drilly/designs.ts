// Authored route ideas, not fixed layouts. Tune these through playtesting.
export const DUNGEON_DESIGNS = [
  {
    id: "up-and-back",
    name: "Up and back",
    mechanic: "An airborne wall jump reverses the route onto an elevated return path.",
    route: [
      "Run across the lower room and jump onto a ledge near the far wall.",
      "Jump against the wall, then jump again while airborne in contact with it to reverse direction.",
      "Return along elevated platforms, jumping over an obstacle on the return path before collecting the remaining treasure.",
    ],
    treasures:
      "Place treasure on both the outward leg and the elevated return leg so one jump cannot collect everything.",
    fairness:
      "Leave headroom and a clear landing for the wall jump. Put the challenge on the return route, where the player must judge a new takeoff rather than repeat the outward jump rhythm.",
  },
  {
    id: "stepping-stones",
    name: "Stepping stones",
    mechanic: "Uneven stepping stones require changing jump rhythm and controlling landings.",
    route: [
      "Jump from the safe starting floor onto the first platform.",
      "Cross separated stones at alternating heights, with a shorter jump under an overhang followed by an exposed upward jump.",
      "Jump past an obstacle near the last landing before reaching the finish.",
    ],
    treasures:
      "Spread treasure across successive landings. Separate them enough that one airborne sweep cannot collect everything.",
    fairness:
      "Make the low overhang readable and leave enough room for the player's body. Use reachable gaps and visible landing margins, with a floor hazard below missed landings. Avoid evenly spaced broad stairs that allow the same rhythm throughout.",
  },
  {
    id: "crossfire",
    name: "Crossfire",
    mechanic: "Solid platforms provide cover from one horizontal fixed-shot turret.",
    route: [
      "Approach the firing lane from a safe starting area.",
      "Jump into a sheltered section where solid geometry blocks the shots.",
      "Climb out of cover, cross the lane, and make a final jump across a second exposed section to reach the last treasure.",
    ],
    treasures:
      "Put treasure in the sheltered section and beyond the firing lane, requiring separate jumps.",
    fairness:
      "The player cannot stop or wait voluntarily. Make cover work while auto-running, with a visible crossing window. Shots must cross the route rather than pass harmlessly below it. Use the supplied default turret cadence and projectile speed; avoid aimed shots, flames, and extra turrets.",
  },
  {
    id: "climb-and-drop",
    name: "Climb and drop",
    mechanic: "An ascending route followed by a deliberate drop into an open lower pocket.",
    route: [
      "Jump onto a low step from the safe starting floor.",
      "Continue upward with separate jumps to collect the elevated treasure.",
      "Drop through an offset opening into a lower lane, then jump over a hazard on that lane to collect the last treasure.",
    ],
    treasures:
      "Use height and platform placement to encourage collecting the upper treasure before the lower one. Do not assume treasure order is enforced by the game.",
    fairness:
      "Leave a visible safe drop landing and room to prepare the next jump. Place its hazard ahead of the landing, not directly underneath the drop. Do not require downward input.",
  },
] as const;

export type DungeonDesign = (typeof DUNGEON_DESIGNS)[number];

// Reproduces the card selection, not the provider's exact layout output.
export function selectDungeonDesign(seed: string, previousDesignId?: string): DungeonDesign {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619) >>> 0;
  }
  const choices = DUNGEON_DESIGNS.filter((design) => design.id !== previousDesignId);
  return choices[hash % choices.length];
}

export function dungeonDesignBrief(design: DungeonDesign): string {
  return [
    `Design card: ${design.id} (${design.name}).`,
    `Main mechanic: ${design.mechanic}`,
    "Build the geometry around this intended route:",
    ...design.route.map((step, index) => `${index + 1}. ${step}`),
    `Treasure placement: ${design.treasures}`,
    `Fairness: ${design.fairness}`,
    "Use the seed to vary spacing, platform heights, and hazard placement within this idea. Every hazard should affect the intended route. Require different takeoff timings and controlled landings, with a small margin for error. The route is design intent, not a new movement rule. Respect the supplied physics and object limits.",
  ].join("\n");
}
