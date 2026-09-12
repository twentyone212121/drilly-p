# Drilly P — game design

This is the gameplay reference for humans and coding agents. **Accepted** sections
define the current target, not features already implemented. **Provisional** choices,
**proposed** items, and **open decisions** remain subject to playtesting. Implementation
details and tuning values belong in code.

## Concept — accepted

**Drilly P** is the game's name. **Drilly** is the AI opponent, and **P** represents
the player.

A browser game inspired by King of Thieves: build a dungeon to protect your
treasure, then raid an opponent's dungeon. The final hackathon prototype must use
runtime AI as the opponent: it attempts your dungeon and builds one for you.

## Core loop — accepted

**Build → clear your own dungeon → submit → raid the opponent's dungeon → see
results → revise and repeat.**

Use the existing predefined opponent dungeon for the local editor phase. AI attacks,
AI building, and adaptation follow the local build, clear, and raid loop.

## Dungeon gameplay — accepted

- One room fits on screen, with a fixed entrance, treasures, platforms, and traps.
- The character runs automatically. There is no manual steering or stop input.
- Tap, click, or press Space to jump. Jumping from a wall changes direction.
- Touching a lethal trap ends the attempt. The provisional win condition is to
  collect every treasure in a single attempt.
- After death or success, the attempt ends and inputs stop affecting it.
- Restart restores the character and every trap to the same initial state.
- Retries are immediate; this phase has no attempt limit.

## Dungeon building — accepted

- Start from a room template. Keep room dimensions and player spawn fixed.
- Add, move, resize, and delete rectangular platforms, including the template's
  platforms. Add, move, and delete stationary saws and treasures.
- Provide object selection, placement previews, and grid snapping. Only platforms
  are resizable in the editor.
- Validate placement bounds and spawn clearance before accepting an edit.
- Switch freely between editing and testing. Tests use ordinary movement, input,
  replay, and audio; test state never changes the saved editor layout.
- Clear your current dungeon version once before submitting it. Any accepted
  gameplay-relevant edit invalidates the clear, even if later reverted manually.
- Submission starts a raid of the predefined opponent dungeon. Returning to the
  editor preserves the player's layout.

## Current phase — accepted local editor and submission

One character, a fixed room and spawn, editable rectangular platforms, stationary
saws, multiple treasures, and clear death/win feedback. Use placeholder art while
setting and assets are developed.

Keep the whole loop local, with no Convex calls or runtime AI. This phase excludes
multiplayer, persistent currency, upgrades, extra abilities, and moving traps.
Runtime AI remains required for the final hackathon submission.

## Editor and clear rules — provisional

- The player starts with a copy of the predefined vault. All platforms in that
  copy are editable; dimensions and spawn remain fixed even if walls or floor
  are removed.
- Each object type has its own count limit. Grid spacing, limits, minimum platform
  size, and new-object sizes are centralized in `shared/game/rules.ts` for tuning.
  Existing template geometry stays unchanged until moved or resized.
- The full saw collision circle must fit within the room. Platforms and treasures
  cannot overlap the spawn's player rectangle, and saws cannot touch it. A platform
  may support the spawn by touching its bottom edge.
- Objects may overlap each other away from spawn. Placement validation does not
  try to prove reachability; the player's successful test is required for submission.
- A draft may contain no treasures while editing, but testing requires at least
  one. Each treasure is collected once per attempt; collecting all wins. Lethal
  contact takes priority over all treasure collection on the same tick.
- Selecting objects, previews, rejected edits, and unchanged drags preserve a
  clear. Restarting a test or returning from a raid also preserves a current clear.
- Schedule playback and imported replays never earn a clear. Restarting after
  playback restores the appropriate editor or opponent dungeon for human input.
- The layout and clear live in memory in the current tab. Reloading starts over;
  submission has no network or persistence side effect.
- Input recordings include the full dungeon geometry and treasure IDs. Older
  level and replay formats are rejected instead of silently changing their meaning.

## Next milestone — proposed AI control

Send the model the room, movement rules, initial state, and previous attempt results.
It returns jump timings for one attempt. Execute them through the same simulation
as human inputs, then report the outcome so the model can revise its next attempt.
Use fixed simulation ticks and reset trap phases between attempts.

AI dungeon building and adaptation between rounds follow this first AI player.

## Open decisions

- Wall contact: sliding, sticking, and when a wall jump is allowed.
- Movement: speed, gravity, jump trajectory, and character collision dimensions.
- Input: jump buffering and whether any airborne taps have an effect.
- Traps: additional types, motion, and future placement restrictions.
- Building: final object budgets, grid spacing, default sizes, and overlap policy.
- Treasures: whether collecting all remains the final win condition.
- Matches: scored attempt limits, scoring, round count, and tie handling.

Mechanics research and art direction are in progress. Put tuning values in one
configuration location and identify temporary choices until the team settles them.

## Acceptance checks

- A human can collect every treasure using only jump inputs.
- A lethal collision ends the attempt; restart restores the full initial state.
- With the same room and initial state, replaying recorded jump ticks produces
  the same trajectory and outcome, independent of rendering frame rate.
- A dungeon cannot be submitted until its current version has been cleared.
- Editing a cleared dungeon disables submission until it is cleared again.
- Testing, retrying, replay playback, and raiding preserve the editor layout.
- Invalid placements leave both the saved layout and its clear status unchanged.
- Submission opens the predefined opponent room; returning to edit restores the draft.
