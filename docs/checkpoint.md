# First gameplay checkpoint

One playable room, browser input, sound effects, replay, and a headless runner.
No Convex connection, environment file, account, or API key is needed. Existing
backend files are dormant; `npm run dev` now starts only Vite.

## Use it

- **Space** starts or resumes a paused game, jumps during play, and immediately
  starts a fresh human attempt after death, success, or the replay limit.
  It acts on keydown, ignores key repeat, and leaves text fields alone.
- **Play** also starts/resumes; tap the room or click **Jump** to jump.
- Jump over the saw, run into the right wall, then jump left onto the treasure ledge.
- **Restart** returns to a paused initial state. **Pause** freezes simulation time.
- Open **Developer tools** for observations, events, tick stepping, and replay JSON.
- While paused, Jump queues an input; Step consumes it. A loaded schedule disables
  human jumps. Restart returns control to the human.
- Export recording fills the JSON field. Copy it into a file, or load it back into
  the browser. Check replay parity compares every recorded state with a fresh run.
- The example schedule `[44, 193]` wins at tick 246. No input dies at tick 51.

```sh
npm test
npm run lint
npm run build
npm run run:attempt -- --describe
npm run run:attempt -- --level public/levels/checkpoint.json '[44,193]'
npm run run:attempt -- --replay docs/evidence/browser-win.replay.json
```

The CLI emits JSON containing the final state, stop reason, events, and every
simulation state. Malformed input exits nonzero. `node --import tsx
scripts/run-attempt.ts ...` gives JSON without npm's command header.

## Module boundaries

| Location                                       | Responsibility                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `shared/game/types.ts`, `rules.ts` | Plain data, versioned tuning, rule description.             |
| `shared/validation.ts` | Valibot schemas and game-specific checks for levels, replays, and jump schedules. |
| `shared/game/collision.ts`, `simulation.ts`    | Initial state, geometry, and one fixed tick; no browser or library imports.          |
| `shared/game/replay.ts`         | Bounded attempts and replay execution. |
| `src/game/session.ts`                          | Input queue, browser clock accumulation, pause/reset, recording.     |
| `src/game/phaser/drawRoom.ts` | Placeholder drawing, split into room, platform, trap, treasure, and player functions. |
| `src/game/phaser/`                             | Phaser lifecycle, pointer input, audio, and asset paths.  |
| `src/components/`                              | Page controls, Phaser mounting, keyboard input, and development tools.                     |
| `scripts/run-attempt.ts`                       | Node file I/O around the same core simulation.                       |

Core state is plain serializable data. `step()` returns a new state and events;
rendering and audio cannot decide gameplay outcomes. React snapshots update at
roughly 10 Hz and on events; Phaser draws independently. ESLint guards core imports.

## Provisional mechanics

These are implementation defaults, not final mechanics decisions:

- 60 ticks/second; top-left origin, x right, y down, pixel units.
- Player collider 24×28; run speed 240 px/s; gravity 1700 px/s²; jump impulse −680 px/s.
- Ground jumps and wall jumps only. A wall jump reverses horizontal direction.
  Wall contact blocks horizontal movement; downward wall slides cap at 110 px/s.
- No jump buffering or coyote time. Multiple taps within one tick coalesce;
  airborne taps are recorded but ignored. Keyboard repeat does not trigger jumps.
- Solid axis-aligned platforms and stationary circular saws. Input, gravity,
  horizontal collision, vertical collision, hazards, then treasure run in that order.
- Input tick N advances state N to N+1. Jump events reference N; collision events
  reference N+1. Lethal contact takes priority over treasure. Terminal states freeze.
- Attempts are bounded to 1800 ticks. Hidden tabs pause; a long frame processes at
  most 100 ms of simulation, so stalls slow playback rather than skip game ticks.
- Replay version 1 stores the full level, rules version, jump ticks, and end tick.
  Initial state is rebuilt from spawn. Changing mechanics requires a new rules version.

## Audio

Four original synthesized WAV effects: jump, land, death, treasure. Regenerate with
`npm run audio:generate`; replace paths in `src/game/phaser/assets.ts` when real assets
arrive. Phaser plays effects once per gameplay event after browser audio unlock.
Mute and master volume are session-local. Pause/reset/unmount stop ongoing sounds;
headless execution has no audio dependency. Music is outside this checkpoint.

## Verification and limits

See [verification evidence](evidence/verification.md). Tests cover simulation rules,
input validation, resets, pause/resume, and full trajectory parity across frame rates.
Browser checks exercise the actual controls and renderer, including a narrow viewport.

This is a mechanics checkpoint: placeholder visuals/audio, one room, no editor,
AI, persistence, or scored match loop. Desktop-browser and responsive viewport
checks do not establish performance on a physical phone. Audio playback was checked
through browser diagnostics, not by listening to physical speakers. The full Phaser
bundle currently produces Vite's large-chunk warning; it builds successfully.
