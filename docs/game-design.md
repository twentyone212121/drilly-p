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

**Build → Test → Your raid → Drilly’s raid → Results → Build**

| Step          | Action                                                      |
| ------------- | ----------------------------------------------------------- |
| Build         | Edit the starter room or keep it; Drilly prepares its room. |
| Test          | Beat your room once; reuse an unchanged clear.              |
| Your raid     | Beat Drilly’s proven room within three tries.               |
| Drilly’s raid | Watch its recorded attempts on your submitted room.         |
| Results       | Show outcome and medals; return to your existing draft.     |

Challenge Drilly opens Test when a clear is needed, otherwise Your raid.
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
- Prison and own-room retries are unlimited. Death, timeout, and explicit restart
  spend a scored attempt; pause and technical failures do not.
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
editor tools, minimal HUD, and in-game overlays. Keep the five-step path visible;
highlight the current step, check completed steps, and name the next action.
The computer background has local flickering status lights, cyan/violet/amber
light pulses at different speeds, and a broken wire with occasional sparks. Keep
the center quiet and effects behind gameplay; respect reduced-motion preferences
and suspend ambient animations while the tab is hidden.

Keep all existing hazards available in the editor as presets. Remove their settings
forms; placing and moving hazards should not require configuring numbers.

Use functional copy only. No slogans, taunts, decorative labels, or developer panels.
Respond immediately to input; avoid scene rebuilds, expensive full-screen effects,
idle rendering, and artificial waits outside the death presentation. ESC mirrors
with movement, braces both hands against walls while airborne, and stretches into
wall jumps. At a grounded wall corner, ESC stands upright with planted feet and
no overlap into the wall. Sliding down emits tiny contact sparks and a quiet scraping sound;
both stop on landing, push-off, or pause. Death gets
a brief electric shock with shaking, sparks, and crackling audio before retry or
round transition. ESC stays upright and the room keeps its size;
simulation stops immediately, and the presentation does not change replay outcomes.
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
the room, rules, initial player state, and actual feedback from Drilly's earlier scored failures, never
the player's clear inputs. Keep each completed recording if a later request fails;
retry continues with the remaining attempts. Replays use no model calls.

The builder proposes one complete room, then tests it once with the same
`playRaidAttempt` function used for raids. Both calls share the model and deadline.
Publish only a verified winning room that cannot be cleared by simply running.
A failed proposal or playthrough ends that generation run; Retry generates a new
room. Keep the failed candidate and completed attempt. There are no partial edits,
repair loops, checkpoints, or fallback rooms. Object limits remain provisional
and should be tuned through playtesting.
Generation runs as a scheduled backend job. Entering the editor requests a build;
the browser observes its status and loads the saved level when ready. Reuse pending
work, and request a fresh build after consuming a completed room. Save the valid candidate before testing it and retain its completed proof attempt,
including failures. Save the proof and finish the build in one backend transaction;
keep proof inputs private. A retry
retains earlier candidates and attempts; stale workers cannot publish over it.
Rounds, scored attempts, and medals still live in browser memory. Their persistence
APIs are defined but are not connected to gameplay yet.

Use playtesting to evaluate variety, difficulty, reliability and latency before
adding generation machinery or input batches.

Cut story/level selection, locked slots, mastery, cloud drafts, save/version UI,
round history, account screens, adaptive history, novelty scoring, and duplicate
runtime backends. Remove player-facing fixtures, obstacle lab, and replay imports;
keep useful headless tests. Add no new hazards or AI framework.

Starter layout, preset tuning, model strength, and acceptable AI latency remain open
to playtesting.

Engineering: [AGENTS.md](../AGENTS.md). Current setup and architecture:
[README](../README.md), [backend notes](../convex/README.md).
