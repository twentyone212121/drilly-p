# Drilly P

**ESCAPE THE PRISON.**

**BUILD YOUR DUNGEON.**

**OUTSMART DRILLY.**

Agreed target for the next iteration; some behavior still needs implementation.
P is the player, represented by ESC; Drilly is the AI opponent inside an old computer.

## One loop

First visit: escape the prison to learn running, jumping, wall reversal, and treasure
collection. Remember completion in localStorage; later visits open your dungeon.
Replay the tutorial from pause without losing the current draft.

**Build → Test → Your raid → Drilly’s raid → Results → Build**

| Step          | Action                                                      |
| ------------- | ----------------------------------------------------------- |
| Build         | Edit the starter room or keep it; Drilly prepares its room. |
| Test          | Beat your room once; reuse an unchanged clear.              |
| Your raid     | Beat Drilly’s proven room within three tries.               |
| Drilly’s raid | Watch its recorded attempts on your submitted room.         |
| Results       | Show outcome and medals; return to your existing draft.     |

Challenge Drilly opens Test when a clear is needed, otherwise Your raid.

## Rules

- Automatic running; tap or Space jumps; wall jumps reverse direction. Collect
  every treasure. Humans and AI share deterministic physics and existing hazards.
- Prison and own-room retries are unlimited. Death, timeout, and explicit restart
  spend a scored attempt; pause and technical failures do not.
- Attack medals: three, two, or one for clearing on that try; otherwise zero.
  Defence is three minus Drilly’s attack. Total: four or more wins, three draws,
  fewer loses.
- Accepted geometry edits require another clear; selection and rejected edits do
  not. Submit the exact cleared layout. Never give Drilly the player’s clear inputs.
- Keep drafts between rounds in this tab. Reload may reset drafts and unfinished
  rounds. Storage failure must not block play. Replay validation stays internal.

## Look and feel

Full-screen Arcade presentation: existing computer art, chunky controls, compact
editor tools, minimal HUD, and in-game overlays. Keep the five-step path visible;
highlight the current step, check completed steps, and name the next action.

Use functional copy only. No slogans, taunts, decorative labels, or developer panels.
Respond immediately to input; avoid scene rebuilds, expensive full-screen effects,
idle rendering, and artificial waits. Mockup motion never becomes game logic.

## AI and scope

Drilly builds and proves a room, then raids yours under ordinary rules. Keep the
OpenAI SDK, Astra, server-side credentials, validated outputs, bounded retries,
retryable errors, and protection against stale responses. Replays make no AI calls
and cannot award medals twice.

Cut story/level selection, locked slots, mastery, cloud drafts, save/version UI,
round history, account screens, adaptive history, novelty scoring, and duplicate
runtime backends. Remove player-facing fixtures, obstacle lab, and replay imports;
keep useful headless tests. Add no new hazards or AI framework.

## Work order

1. Ship the Arcade loop and tutorial persistence; delete replaced screens and state.
2. Trim AI orchestration while retaining the working movement controller.
3. Compare direct model inputs on representative rooms before replacing it.

Keep each step playable and verify simulation, replays, UI, and live integration.
Starter layout, advanced trap controls, difficulty, and acceptable AI latency remain
open to playtesting.

Engineering: [AGENTS.md](../AGENTS.md). Current setup and architecture:
[README](../README.md), [backend notes](../convex/README.md).
