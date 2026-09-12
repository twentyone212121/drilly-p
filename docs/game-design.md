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
After the first successful escape, enter the main loop without repeating the prison
within that session. Repeating it on reload is fine for prototype testing:

**Build/revise → clear your own dungeon → submit → raid Drilly's dungeon → watch
Drilly's attempts on yours → results → revise and repeat.**

The submitted layout is the exact version the player cleared. Carry the editable
draft forward between rounds, separately from that immutable submission.

## Current implementation scope — local rounds and guest drafts

The prison leads into building, clearing the current draft, submitting an immutable
snapshot, raiding the first opponent dungeon, reviewing Drilly’s attempts, and
results. Results return to the same draft without repeating prison. Two other
opponent slots remain unavailable placeholders.

Each side gets three raid attempts, stopping at its first clear. Death, the tick
limit, and explicit restart consume an attempt; pause/resume does not. Prison and
own-dungeon retries remain unlimited. Editing may abandon an unfinished round,
and reload may restart unfinished play without a loss or recovery system.

Keep round medals and the first dungeon’s best total in memory. Award only completed
rounds; best totals use a maximum. Ghost viewing and imported developer replays do
not award progression or repeat awards. Importing a developer replay abandons the
active scored round.

Use a clearly labeled development fixture until runtime Drilly AI is connected.
**Provisional:** an opt-in development switch runs three fixed input schedules on
the submitted geometry, stopping on success. These inputs do not use the player’s
clear proof. Ordinary play without a source shows Drilly as unavailable and awards
no round result. Ghost review holds each ending for inspection, with next-attempt
and replay controls.

Guest authentication and private draft save/load remain the only backend work.
Round persistence and runtime AI are separate subsequent work. Presentation uses
the computer-interior art direction: ESC represents the human player and the drill
virus represents Drilly in ghost review. Character animation and decorative lights
and fans react to gameplay without changing simulation or collision rules. See
[the art guide](../assets/README.md) for asset conventions and the setting.

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
  platforms. Add, move, and delete stationary saws, treasures, and the obstacle
  types below. Configure obstacle behavior in the selection inspector.
- Provide object selection, placement previews, and grid snapping. Only platforms
  use corner resize handles; spike dimensions are editable in the inspector.
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
- The layout saves to the guest profile when Convex is configured. Tutorial
  completion, clears, and submissions remain in memory in this slice. Reloading
  restarts the prison and requires clearing the restored draft again. Submission
  still has no network or persistence side effect.
- Input recordings include the full geometry and treasure IDs. Older level and
  replay formats are rejected instead of silently changing their meaning. Geometry
  changes alone do not change physics; bump the rules version when mechanics change.

## Full rounds and progression — accepted subsequent scope

- Each side gets three scored raid attempts, stopping early on a clear. Own-dungeon
  tests and prison retries remain unlimited.
- Interruptions do not force a loss. A paused or interrupted raid can still finish
  successfully. Unfinished play may restart after a reload; enforcing spent attempts
  across reloads and restoring active rounds are outside the hackathon scope.
- Clearing on the first, second, or third attempt earns three, two, or one attack
  medals respectively. Failing all attempts earns none.
- Defense medals equal three minus Drilly's attack medals. The round total is out
  of six: four or more wins, three draws, and fewer loses.
- Preserve the best total for the first dungeon using a maximum; repeating rounds
  cannot farm cumulative medals. Keep the other dungeon slots locked. Revisit
  unlocks and broader progression when later rooms are authored.
- Drilly's review uses a visually distinct ghost replay. Show where it failed or
  how it broke through. Ghost playback uses recorded inputs and ordinary simulation.
  Start with attempts played in order and a simple replay button.
- Results return the player to their existing draft to revise and try again.
- Do not introduce mastery ranks. A growing stash is deferred until it buys
  something meaningful. Infinite content and new mechanics are not required now.

## Guest identity and draft saves — accepted first Convex slice

Use anonymous authenticated sessions: no sign-in form before playing, and private
saves per guest. Return to the same browser to continue. Account linking and recovery
across browsers are later work; clearing browser storage can lose guest access.
Use Convex Auth's anonymous provider. The browser retains its session credentials;
server functions derive ownership from that authenticated session. Auth's library
actions handle sign-in and renewal; its HTTP routes publish token verification
metadata. Dungeon reads and writes use ordinary queries and mutations.

- Store one draft per guest: full validated geometry, rules version, server
  revision, update time, and the last save request ID. Drafts may have no treasures.
- Finish auth and the initial draft read before starting a saved game. A first
  read does not create a default draft. Incompatible saved rules or geometry stay
  untouched; show an error instead of silently replacing them.
- Autosave accepted layout edits only. **Provisional:** debounce edits for 500 ms.
  Tests, simulation ticks, selection, previews, and unchanged/rejected edits do
  not write. A successful server acknowledgement marks the captured version saved;
  newer edits still need their own save.
- Each write checks the expected server revision. Retrying an uncertain save uses
  the same request ID and payload. A stale write cannot overwrite another tab.
- On conflict, preserve the current layout and offer **Load saved draft** or
  **Save this version**. The latter still checks the latest known server revision.
  Loading requires returning from a test/raid to editing and invalidates any clear.
- Offline or failed saves leave edits in this tab, visibly unsaved. Retry an error
  explicitly; reconnecting resumes queued edits. Warn before closing with pending
  changes. There is no durable offline queue in this slice.
- If auth or initial loading fails, offer an explicit **Play without saving**
  option. A local game never automatically uploads when connectivity returns.
  With no Convex URL configured, play locally with saving visibly disabled.

## Completed-round saves — accepted subsequent hackathon scope

Build the local round loop, then connect real Drilly AI, then add completed-round
saves. Full round persistence is not a prerequisite for trying the actual rivalry.

Save completed rounds with submitted/opponent snapshots, input recordings, outcomes,
and results. Keep them separate from editable drafts and retain the best first-room
medal total. Derive ownership from authentication, validate data, and use a stable
round ID to avoid duplicate saves. Report failed saves and offer retry without
blocking ordinary play. Show a small recent-history list with bounded indexed reads.

Use reported outcomes and the shared medal calculation. Tutorial completion,
persisted clear proofs, server verification of human runs, active-round recovery,
strict interruption penalties, cross-tab round locks, and elaborate history
management are deferred. No durable reservation is required before a raid starts.

Do not persist simulation frames every tick; retain reproducible recordings.

## Drilly control — accepted subsequent scope

Give the model the submitted room, movement rules, initial state, and previous
attempt results. It returns jump timings for one attempt. Execute those timings
through the same simulation and report the outcome so it can revise its next try.
Do not reveal the player's successful clear inputs to Drilly.

Enforce the fixed attempt budget and preserve inputs and outcomes for ghost review.
AI service errors are retryable technical failures, not successful dungeon defense.
Begin with a simple authenticated backend request that runs Drilly's attempts and
returns recordings to the local round. Show a waiting state and bounded error/retry
behavior. Disable duplicate launches while a request is pending and ignore results
for an old local round. A technical retry may repeat the request; durable jobs,
per-call checkpoints, and seamless resumption are not required. Ghost playback
reuses recordings and never calls the model again.

Agree on the provider, request limits, and expected waiting experience before
connecting it. AI dungeon building and adaptation across rounds come later.

## Open decisions

- Movement tuning, wall contact, jump buffering, and whether airborne taps gain an effect.
- Obstacle tuning and the designs of the two later dungeons; trap types beyond the accepted obstacle set.
- Final editor budgets, grid spacing, default object sizes, and overlap policy.
- Whether collecting all treasures remains the final win condition.
- Optional account linking and AI provider/operational limits.

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
- Completing a fixture round reviews Drilly’s ghosts and results before returning
  to the draft. Without an AI source, show unavailability without awarding medals.
  Later dungeons remain unavailable.

## Obstacle system — accepted scope, provisional tuning

The storyboard's static spikes, sliding saws, firewall turrets, patrol drones,
and pursuers are the accepted obstacle set. Every type is editable and participates
in the same fixed-tick simulation for humans and Drilly, including ghost playback.
These are lethal hazards, not enemies with health or player attacks.

- **Spikes:** an upright strip with a lethal rectangular footprint. The tinted
  backing marks its full bounds, including the gaps between teeth.
- **Sliding saws and drones:** move at constant speed between two centers and
  reverse at the endpoints. Move the starting object to translate the whole route;
  edit the endpoint and speed in the inspector. The route and endpoints are visible.
- **Turrets:** choose fixed horizontal shots, aimed shots, or horizontal flame
  bursts. Each cycle starts with an amber warning. A shot fires once after the
  warning; a flame stays on for its configured active duration. The remaining
  cycle is cooldown. Aimed shots target the player's center when fired and then
  travel straight. Shots expire at their configured reach; platforms block both
  shots and flames. The turret body remains lethal throughout the cycle.
- **Pursuers:** the player entering a detection circle around the home position
  starts a warning. Leaving that circle during warning cancels activation. After
  warning, chase the player until the player exits the larger escape circle around
  home; then return home before detecting again. The body is always lethal.
- **Provisional:** drones, sliding saws, and pursuers pass through platforms. They
  do not pathfind or collide with each other. Pursuers stay inside the room. Warning
  periods, speeds, ranges, size bounds, and object budgets are adjustable through
  shared rules and bounded editor fields. They need human difficulty tuning.
- New hazard motion and projectiles use swept contact checks so crossing a narrow
  hazard or platform within one tick still counts. Walls block shots before player
  contact, including ties. Hazard contact takes priority over treasure collection.
- Routes must fit in the room and stay clear of spawn. Obstacle bodies must fit and
  start clear of spawn. Range guides may extend beyond the room; actual effects are
  bounded by the room and blocking platforms. Invalid settings preserve the draft.
- Restart resets projectiles, paths, warnings, and pursuit. Pause and replay use
  simulation ticks, never wall-clock time. The new rules version rejects older
  recordings and saved drafts instead of silently changing their outcomes.

The **Obstacle lab** is an unscored practice mode available from the tutorial,
escape completion, and editor. It includes a combined showcase and individual
rooms for every obstacle and turret mode. Switching rooms starts a new attempt.
Leaving restores the prior stage (restarting a tutorial attempt if needed), while
preserving the player's draft and any earned clear. Lab wins never unlock escape,
submission, medals, or saved progression. Real AI service integration and completed
round persistence remain separate work.
