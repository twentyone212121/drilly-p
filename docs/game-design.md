# Drilly P — game design

This is the gameplay reference for humans and coding agents. **Accepted** sections
define the current target, not features already implemented. **Proposed** items
and **open decisions** remain unsettled. Implementation details belong in code or
separate technical notes.

## Concept — accepted

**Drilly P** is the game's name. **Drilly** is the AI opponent, and **P** represents
the player.

A browser game inspired by King of Thieves: build a dungeon to protect your
treasure, then raid an opponent's dungeon. The final hackathon prototype must use
runtime AI as the opponent: it attempts your dungeon and builds one for you.

## Core loop — accepted

**Build → clear your own dungeon → submit → raid the opponent's dungeon → see
results → revise and repeat.**

Use a predefined opponent dungeon for the initial gameplay milestone. AI attacks,
AI building, and adaptation follow once movement and replay work reliably.

## Dungeon gameplay — accepted

- One room fits on screen, with an entrance, treasure, platforms, and traps.
- The character runs automatically. There is no manual steering or stop input.
- Tap, click, or press Space to jump. Jumping from a wall changes direction.
- Touching a lethal trap ends the attempt. Reaching the treasure wins it.
- After death or success, the attempt ends and inputs stop affecting it.
- Restart restores the character and every trap to the same initial state.
- Retries are immediate; the initial milestone has no attempt limit.

## Dungeon building — accepted

- Start from a fixed room layout; editing terrain is outside the initial scope.
- Place a limited number of traps. The exact budget and placement rules are open.
- Clear your own dungeon once before submitting it.
- Any dungeon edit invalidates that clear and requires another successful attempt.

## Initial milestone — accepted

One character, one room layout, one trap type, a basic trap-placement editor, and
clear death/win feedback. Use placeholder art while setting and assets are developed.

Build movement, restart, and input replay first; add editing and submission next.
The initial milestone excludes AI integration, multiplayer, persistent currency,
upgrades, extra abilities, and unrestricted level generation. Runtime AI remains
required for the final hackathon submission.

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
- Traps: first trap type, motion, collision shape, and placement restrictions.
- Building: trap budget and whether the entrance and treasure can move.
- Matches: scored attempt limits, scoring, round count, and tie handling.

Mechanics research and art direction are in progress. Put tuning values in one
configuration location and identify temporary choices until the team settles them.

## Acceptance checks

- A human can reach the treasure using only jump inputs.
- A lethal collision ends the attempt; restart restores the full initial state.
- With the same room and initial state, replaying recorded jump ticks produces
  the same trajectory and outcome, independent of rendering frame rate.
- A dungeon cannot be submitted until its current version has been cleared.
- Editing a cleared dungeon disables submission until it is cleared again.
