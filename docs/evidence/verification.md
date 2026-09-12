# Checkpoint verification

The screenshots and JSON files below capture the initial browser verification on
2026-09-12, before the subsequent readability and controls updates. They are
historical evidence, not a fresh browser run of every later commit.

Subsequent local checks pass **59 tests**, lint, and build. The player confirmed
the revised Space controls work: start/resume while paused, jump during play,
and start a fresh attempt after finishing. Valibot now validates imported data.
During PR preparation, `npm ci`, all 59 tests, lint, and build also passed in a
fresh temporary copy without environment files. No additional automated browser
run was performed; the player had already confirmed the controls locally.

## Initial automated and clean-install checks

- `npm test`: **33 tests pass** in three test files.
- `npm run lint`: passes, including TypeScript and the core import boundary.
- `npm run build`: passes. Phaser produces the documented large-chunk warning.
- Repeated `npm ci`, lint, tests, and build in a fresh temporary copy without
  `.env.local`. No API credentials or Convex deployment were needed.
- Ran the exported browser recording through the Node CLI; see
  [headless-verification.json](headless-verification.json).

Tests cover ground/airborne/wall jumps, lethal contact, terminal states, resets,
collision edge cases and thin platforms, invalid input, replay version rejection,
pause/resume, and full trajectory equality at 30, 60, 144 Hz and irregular frame times.

## Initial browser checks

Tested through visible browser controls, not by injecting gameplay state:

1. Play without jumping: death at tick **51**; death sound accepted by Phaser.
2. Restart: tick 0, initial position, paused, no pending input.
3. Browser-driven manual attempt, using the developer step controls to time inputs:
   advance to tick 44, press Jump, advance to 193, press Jump, advance to completion.
   This exercises the saw jump, wall reversal, ledge landing, and treasure collection.
4. Export that recording and check parity: **all 247 states match**, winning at
   tick **246**. [Recording](browser-win.replay.json), [browser result](browser-parity.json).
5. Import and play the recording in real time: same win and trajectory.
6. Pause a replay at tick 16, perform other verification work, and inspect again:
   still tick 16. Resume completes with the same outcome.
7. Space and pointer input each queue a jump that is consumed on the next tick.
8. Invalid schedule `[1,1]` displays a validation error and preserves the current attempt.
9. Audio assets load and unlock. Muted jump adds no playback; unmute and volume
   changes reach the sound manager. See [audio diagnostics](browser-audio.json).
10. A **390×844 viewport** shows one canvas, no horizontal overflow, and the same
    successful real-time replay. [Mobile screenshot](mobile-win.png).
11. Serve the clean production build on a temporary local preview: it boots without
    backend configuration and replays the exported recording with full parity.
    [Production result](production-parity.json).
12. No browser console errors or warnings were reported during the final development
    and production checks. Temporary preview stopped; the existing Vite server was left running.

[Desktop screenshot](desktop-win.png).

## Limits

- The browser-controlled winning attempt used tick stepping for precise inputs;
  real-time playback was also tested. A person's playtest is still needed to judge feel.
- Responsive viewport testing is not a physical-phone performance or touch test.
- Audio verification checks loading, unlock, event playback acceptance, mute, and
  volume. Physical speaker output and subjective sound quality were not listened to.
- Art, sound, and movement values are provisional. No AI, editor, persistent saves,
  or multiplayer is part of this checkpoint.
