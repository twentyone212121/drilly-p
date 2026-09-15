# Drilly P

**ESCAPE THE PRISON.**

**BUILD YOUR DUNGEON.**

**OUTSMART DRILLY.**

Agreed target for the next iteration; some behavior still needs implementation.
P is the player, represented by ESC; Drilly is the AI opponent inside an old computer.

## One loop

First visit: escape the prison to learn running, jumping, wall reversal, and treasure
collection. Remember completion in localStorage; later visits open your dungeon.
Replay the tutorial from pause or the editor without losing the current draft or
its clear. This ends the current round; return to the draft after the tutorial.

**Room → Edit → Test → Saved room → Your raid → Drilly’s raid → Results → Room**

| Step          | Action                                                            |
| ------------- | ----------------------------------------------------------------- |
| Build         | View your room; Edit opens its tools. Drilly prepares its room.   |
| Test          | Beat your room to save its clear and return directly to the room. |
| Your raid     | Beat Drilly’s proven room within three tries.                     |
| Drilly’s raid | Watch its recorded attempts on your submitted room.               |
| Results       | Show outcome and medals; return to your existing draft.           |

Challenge Drilly opens Test when a clear is needed, otherwise Your raid.
Editing opens from Edit in the top-left corner; it becomes Back and Test while
the tools are open. Back closes editing, and Test closes the tools; winning saves the
cleared layout and returns directly to the room with a Room saved status and Edit
button, without a success dialog or automatic raid. The clear is valid for the current tab session; the draft itself persists across reloads.
Testing opens directly in the room without a preview dialog.
Opening either room leaves ESC still with a small start hint. The first click, tap,
or Space starts movement without jumping; subsequent inputs jump as usual.

Submitting the cleared room starts Drilly's attempts immediately, alongside your
raid. Show its recordings after your attempts finish; request completion or
failure must not interrupt your play. If it is still thinking, wait at Drilly's
raid step; if it failed, offer Retry there and retain its completed attempts.

Choose Drilly's model in the editor: Astra (default), Sol, or Luna. Remember the
choice in localStorage and keep it fixed for the submitted round, including retries.
This changes only Drilly's scored raids; room generation stays separate. All models
use the same instructions, reasoning setting, physics, and three attempts.

## Rules

- Every room has a permanent floor, ceiling, and side walls. The computer casing
  defines the playable area and cannot be selected, moved, resized, or removed.
  Slim side walls and ceiling leave more playable space. Existing template floor
  height is preserved so its hazards and platforms stay aligned.

- Automatic running; tap or Space jumps. Grounded jumps keep direction, including
  at wall corners; a subsequent airborne wall jump pushes away and reverses direction. Collect
  every treasure. Humans and AI share deterministic physics and existing hazards.
  Turret bodies are safe to touch; their projectiles and active flames remain lethal.
  Shots travel until a wall/platform or room boundary, with a small firing sound.
  The default firing cadence is once every 1.5 seconds.
- Human attempts have no timer or time limit, including scored raids. Prison and
  own-room retries are unlimited. Death and explicit restart spend a scored attempt;
  pause and technical failures do not. AI planning keeps a bounded execution budget.
- Attack medals: three, two, or one for clearing on that try; otherwise zero.
  Defence is three minus Drilly’s attack. Total: four or more wins, three draws,
  fewer loses.
- Accepted geometry edits require another clear; selection and rejected edits do
  not. Submit the exact cleared layout. Never give Drilly the player’s clear inputs.
- Save the current dungeon draft in localStorage after committed edits and restore
  it on reload, including unfinished layouts. Reload resets its clear and the
  current round. Invalid stored data and storage failure must not block play.
  Replay validation stays internal.

## Look and feel

Full-screen Arcade presentation: existing computer art, chunky controls, compact
editor tools, minimal HUD, and in-game overlays. The background fills the viewport;
controls overlay its edges instead of reserving separate header/footer space. A button beside pause enters/exits browser fullscreen.
The room keeps its aspect ratio and initial display scale when entering fullscreen;
extra space shows the background around the centered room. Smaller windows scale
it down uniformly only when necessary to keep the whole room visible. Resizing
does not change simulation or replay coordinates.
Show “Tap or Space to jump. Jump off a wall to turn around.” on the bottom wall only during the prison tutorial, styled as recessed
metal lettering below the vents, with clean pale cyan lettering and a subtle recessed edge, without glow or a heavy bevel.
Remove the regular jump hint, on-screen Jump button, and “Your dungeon” heading;
keyboard and tap controls still work.
Remove the five-step progress strip. A compact You / Drilly table shows cumulative
points and rounds won in the current session while building or viewing results.
During play, hide that table and show only the treasure count centered at the top,
alongside the existing sound/fullscreen/pause controls. Add scores once per completed round;
watching replays never adds points. Each side earns its attack points plus defence
points; draws add points to both sides without a win. Totals survive returning to
the editor but reset on reload. Tutorial examples, action buttons, and result
messages explain the next step.
The computer background has local flickering status lights, cyan/violet/amber
light pulses at different speeds, and a broken wire with occasional sparks. Keep
the center quiet and effects behind gameplay; respect reduced-motion preferences
and suspend ambient animations while the tab is hidden.

Keep stationary saws, spikes, turrets, drones, and pursuers as editor presets.
Remove the sliding saw from editor and AI creation; its old data shape remains readable
for compatibility. Remove their settings
forms; placing and moving hazards should not require configuring numbers.
New spike placements use a larger, more visible footprint, with matching collision bounds.
Selected spikes have a row-length handle. Extending the row adds teeth at a fixed
spacing while keeping its thickness unchanged, rather than stretching the artwork.
Rotated rows extend along their rotated axis; collision bounds match the row.
Exposed spike teeth are lethal on contact from any direction, including while
jumping or already overlapping them. The mounting base is solid and safe to touch;
players cannot pass through it. Both regions rotate with the row.
Objects snap flush to the inside edges of the frame and cannot be placed outside it.
A nearby direction control switches selected turrets between left and right only.
For drones and spikes, the Rotate control turns them by 90 degrees: drones rotate
their patrol route; spikes rotate their visible shape and rectangular collision bounds.
Select a drone and drag the cyan handle at its route endpoint to extend or shorten
its patrol, keeping the entire route inside the room. The handle only changes length
along the current direction; it cannot turn or reverse the route. Only Rotate changes
direction, cycling through right, down, left, and up. Drones travel faster, smoothly
slowing to a stop at each endpoint before reversing.
Pursuers immediately and continuously follow the player from any distance, with no
acquisition zone, waiting period, or return-to-base behavior.
Hazards share graphite metal casings, cyan circuitry, and magenta energy cores.
Use rotating saw teeth and drone fans, turret charging/firing effects, subtle spike
status pulses, and a pursuer tracking eye. Keep artwork fitted to its collision bounds.
The editor controls sit within the bottom wall with clear margins. Use large hazard
icons on thin recessed metal slots, without an enclosing panel or chunky raised
buttons. Match the action buttons to the casing, with cyan and pale amber accents.
Moving objects is the default editor behavior, without Move or Delete toolbar buttons.
Click an object to select/drag it and reveal a nearby Delete control. After placing
an object, return to moving with that object selected. Click the active placement
tool again to cancel it. Rejected placements keep the placement tool active.

Use functional copy only. No slogans, taunts, decorative labels, or developer panels.
Respond immediately to input; avoid scene rebuilds, expensive full-screen effects,
idle rendering, and artificial waits outside the death presentation. ESC and Drilly use slightly larger artwork for readability without changing their collision bodies. ESC mirrors
with movement, braces both hands against walls while airborne, and stretches into
wall jumps. At a grounded wall corner, ESC stands upright with planted feet and
no overlap into the wall. Sliding down emits tiny contact sparks and a quiet scraping sound;
both stop on landing, push-off, or pause. Death gets
a brief electric shock with shaking, sparks, and crackling audio before retry or
round transition. ESC stays upright and the room keeps its size;
simulation stops immediately, and the presentation does not change replay outcomes.
Render sprites and cached room artwork at display-aware resolution, capped at
2× to prioritize smooth frame delivery over extra supersampling. Use smooth filtering and a calmer running animation with gentler
wall-impact distortion so ESC stays easy to track. While running, the keycap body
and face stay steady; only the two feet step, with matching footstep sounds.
Avoid trailing copies or wall-jump streaks around ESC. Use actual display-frame
timing for interpolation instead of an additional smoothed frame clock.
Moving characters and hazards interpolate visually between fixed simulation ticks;
pause, resets, and terminal outcomes show their exact simulation positions. Static
room artwork is cached between edits. A quiet ambient electronic loop continues
through play and menus, follows the audio controls, and pauses while the tab is hidden. Mockup motion never becomes game logic.

During Drilly's playback, show your latest successful test as a translucent cyan
ESC ghost. Start both at tick zero and share playback, pause, and restart controls;
hold the ghost at its finish position if Drilly takes longer. Allow hiding it and
show both completion times. The ghost is visual only: visible treasures and hazards
belong to Drilly's attempt, so aimed hazards can differ from your recorded run.
Keep your clear in the browser; never send it to the AI.

## AI and scope

Drilly builds and proves a room, then raids yours under ordinary rules. Keep the
OpenAI SDK, Astra, server-side credentials, validated outputs, bounded retries,
retryable errors, and protection against stale responses. Replays make no AI calls
and cannot award medals twice.

For scored raids, the selected model chooses a complete `jumpTicks` sequence in one call per
attempt. Execute it literally through the shared simulation, including ignored
jumps; do not search alternate futures or repair the inputs. Later attempts receive
the room, rules, and actual feedback from Drilly's earlier scored failures, never
the player's clear inputs. Keep each completed recording if a later request fails;
retry continues with the remaining attempts. Replays use no model calls.

The builder keeps its edit loop and tests each valid layout with one call to the
same `playRaidAttempt` function. Feed the actual outcome back into the next design
edit. Design and proof calls share the overall build deadline; publish only a
winning room that cannot be cleared by simply running. A late request failure may
return the last proven challenge. Remove the old route controller entirely.

Broader generation improvements remain deferred. Use headless rooms and playtesting
to evaluate reliability and latency before adding input batches or images.

Cut story/level selection, locked slots, mastery, cloud drafts, save/version UI,
round history, account screens, adaptive history, novelty scoring, and duplicate
runtime backends. Remove player-facing fixtures, obstacle lab, and replay imports;
keep useful headless tests. Add no new hazards or AI framework.

## Work order

1. Ship the Arcade loop and tutorial persistence; delete replaced screens and state.
2. Evaluate direct model inputs on representative rooms and in the playable loop.
   Tune from actual failures; add input batches only if the complete-sequence
   version needs feedback during play. Reuse that completion path for builder proofs.

Keep each step playable and verify simulation, replays, UI, and live integration.
Starter layout, preset tuning, model strength, and acceptable AI latency remain open
to playtesting. Follow the [cleanup plan](cleanup-plan.md) for implementation.

Engineering: [AGENTS.md](../AGENTS.md). Current setup and architecture:
[README](../README.md), [backend notes](../convex/README.md).
