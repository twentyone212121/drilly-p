# Drilly P — game design

This is the gameplay reference for humans and coding agents. **Accepted** sections
define the agreed target, not features already implemented. **Provisional** choices
and **open decisions** remain subject to playtesting. Implementation details and
tuning values belong in code. Implementation work is scoped and reviewed one chunk
at a time; agree on the next chunk before starting it.

## Concept — accepted

**Drilly P** is the game's name. **Drilly** is the AI opponent, and **P** represents
the player. Build a dungeon to protect your treasure, prove it can be beaten, and
raid Drilly's dungeon. Learn from watching Drilly attack your own design.

Runtime AI attempting the player's dungeon is required for the full rivalry.
Opponent layouts are authored first; AI dungeon generation can follow later.

## Core loop — accepted

Begin with a prison escape tutorial. It teaches automatic movement, jump timing,
wall-jump reversal, and collecting all treasures through play, with unlimited retries.
It should challenge new players; failing a few times while learning is expected.
After the first successful escape, enter the main loop without repeating the prison:

**Build/revise → clear your own dungeon → submit → raid Drilly's dungeon → watch
Drilly's attempts on yours → results → revise and repeat.**

The submitted layout is the exact version the player cleared. Carry the editable
draft forward between rounds, separately from that immutable submission.

## Current implementation scope — accepted local game flow

Implement the prison and first opponent dungeon, with two unavailable dungeon
placeholders. The current mechanics do not need to be stretched across three
progressively harder rooms. The later dungeons need their own design before they
become playable; completing the first room does not unlock placeholder content.

Use an explicit state machine in `src/game/session.ts` for prison, escape completion,
building, testing, clear completion, raiding, and raid completion. A completed local
raid leads back to the preserved draft. Give every stage a clear next action.
Developer playback is separate from human progression.

This slice stops at a local raid. It has unlimited retries, with no medal awards,
Drilly counter-raids, persistence, authentication, or backend requests yet. Those
belong to separately approved work below. Keep placeholder art and ordinary audio.

## Dungeon gameplay — accepted

- One room fits on screen, with a fixed entrance, treasures, platforms, and traps.
- The character runs automatically. There is no manual steering or stop input.
- Tap, click, or press Space to start/resume; during play, that input jumps.
  Jumping from a wall changes direction.
- Touching a lethal trap ends the attempt. The provisional win condition is to
  collect every treasure in a single attempt.
- After death, success, or the attempt's tick limit, simulation stops. A failed
  attempt offers an immediate retry. Success offers the next stage's action.
- Restart restores the character and every object to the same initial state.
- Prison and own-dungeon tests always allow unlimited retries.

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
- Submission records the successful input replay and its exact geometry, then
  opens the authored opponent room. Returning to edit preserves the draft.

## Editor and clear rules — provisional

- The starting draft is an open room with supporting floor, side walls, one
  treasure, and no saws. All its platforms are editable. Keep it independent of
  changes to the prison layout.
- The prison has a floor saw, a treasure along the floor, and a second treasure
  behind a saw on an elevated ledge. Its intended route is a ground jump, a wall
  jump back onto the ledge, and another ground jump after landing. Contextual hints
  explain wall reversal and the upper hazard. The timing should allow some error;
  this is a short learning challenge, not a demand for exact tick inputs.
- The first opponent room has two floor saws. These layouts and names need playtesting.
- Each object type has its own count limit. Grid spacing, limits, minimum platform
  size, and new-object sizes are centralized in `shared/game/rules.ts` for tuning.
  Existing template geometry stays unchanged until moved or resized.
- The full saw collision circle must fit within the room. Platforms and treasures
  cannot overlap the spawn's player rectangle, and saws cannot touch it. A platform
  may support the spawn by touching its bottom edge.
- Objects may overlap each other away from spawn. Placement validation does not
  prove reachability; the player's successful test is required for submission.
- A draft may contain no treasures while editing, but testing requires at least
  one. Each treasure is collected once per attempt; collecting all wins. Lethal
  contact takes priority over all treasure collection on the same tick.
- Selecting objects, previews, rejected edits, and unchanged drags preserve a
  clear. Restarting a test or returning from a raid preserves a current clear.
- Schedule playback and imported replays never earn a prison escape, draft clear,
  or raid completion. Leaving playback starts a fresh human attempt in the original
  room, even when an imported replay used a different layout.
- The layout and progress currently live in memory in this tab. Reloading starts
  over; submission has no network or persistence side effect in the local slice.
- Input recordings include the full geometry and treasure IDs. Older level and
  replay formats are rejected instead of silently changing their meaning. Geometry
  changes alone do not change physics; bump the rules version when mechanics change.

## Full rounds and progression — accepted subsequent scope

- Each side gets three scored raid attempts, stopping early on a clear. Own-dungeon
  tests and prison retries remain unlimited.
- Clearing on the first, second, or third attempt earns three, two, or one attack
  medals respectively. Failing all attempts earns none.
- Defense medals equal three minus Drilly's attack medals. The round total is out
  of six: four or more wins, three draws, and fewer loses.
- Preserve the best total for each authored dungeon; repeating rounds cannot farm
  cumulative medals. Wins unlock the next dungeon when that content is available.
  Three finished dungeons would give a best-score campaign total out of eighteen.
- Drilly's review uses a visually distinct ghost replay. Show where it failed or
  how it broke through. Ghost playback uses recorded inputs and ordinary simulation.
- Results return the player to their existing draft to revise and try again.
- Do not introduce mastery ranks. A growing stash is deferred until it buys
  something meaningful. Infinite content and new mechanics are not required now.

## Identity and persistence — accepted subsequent scope

Use anonymous authenticated sessions: no sign-in form before playing, and private
saves per guest. Return to the same browser to continue. Account linking and recovery
across browsers are later work; clearing browser storage can lose guest access.
The concrete auth package and setup must be reviewed before installation.

Convex will save tutorial completion, versioned drafts and clear proofs, immutable
submissions, active rounds, attempt history, and best medals. Save accepted edits
with a short debounce and durable round transitions immediately. Authenticate
ownership on the server rather than trusting a client-supplied profile ID.

An interrupted scored human raid counts as a failure. Reserve its attempt before
starting play; refreshing must not restore a spent attempt. Exact acknowledgement,
failed-save, recovery, and conflict behavior needs a concrete contract before the
durable-round implementation. Finishing a round must award medals at most once.
Do not persist simulation frames every tick; retain reproducible recordings.

## Drilly control — accepted subsequent scope

Give the model the submitted room, movement rules, initial state, and previous
attempt results. It returns jump timings for one attempt. Execute those timings
through the same simulation and report the outcome so it can revise its next try.
Do not reveal the player's successful clear inputs to Drilly.

Enforce the fixed attempt budget and preserve inputs and outcomes for ghost review.
AI service errors are retryable technical failures, not successful dungeon defense.
Provider choice, cost limits, waiting time, and resumability need agreement before
connecting runtime AI. AI dungeon building and adaptation across rounds come later.

## Open decisions

- Movement tuning, wall contact, jump buffering, and whether airborne taps gain an effect.
- New mechanics, trap types, and the designs of the two later dungeons.
- Final editor budgets, grid spacing, default object sizes, and overlap policy.
- Whether collecting all treasures remains the final win condition.
- Concrete persistence acknowledgement, interruption, and recovery behavior.
- Auth implementation, optional account linking, and AI provider/operational limits.

## Local flow acceptance checks

- A human can escape the prison and clear the first dungeon using only jump inputs.
- The prison must be cleared before building; normal play visits it only once per session.
- Failures and tick limits offer retries; successes offer the appropriate next stage.
- The same input recording produces the same trajectory and outcome in the browser
  attempt engine and headless simulation, independent of rendering frame rate.
- A dungeon cannot be submitted until its current version has been cleared.
- Editing a cleared dungeon disables submission until it is cleared again.
- Testing, retrying, replay playback, and raiding preserve the editor layout.
- Invalid placements leave both the saved layout and its clear status unchanged.
- Submission freezes its proof and layout; subsequent editing cannot alter them.
- Completing the local raid leads back to the draft. Later dungeons remain unavailable.
