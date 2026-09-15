# Drilly backend

The browser uses automatic guest authentication. Generation runs as a scheduled
job in `convex/drilly.ts`; scored raids still call its `raid` action directly.
Shared AI functions live in `convex/lib/drilly/` and also run in headless evaluations.

| Module                            | Responsibility                                                |
| --------------------------------- | ------------------------------------------------------------- |
| `build.ts`, `roomOutputSchema.ts` | One complete room proposal and its JSON output schema         |
| `raid.ts`                         | One input sequence and recording for raids and builder proofs |
| `model.ts`                        | Model call type, OpenAI SDK and shared deadline               |

Gameplay validation stays in `shared/validation.ts`; wire validators live in
`convex/lib/validators.ts`. Simulation and tuning stay in `shared/game/`.

## Generation lifecycle

1. Entering the editor calls `builds.request`. It reuses the latest pending,
   unassigned build or creates a new one and schedules `drilly.generate`.
2. The worker marks the build running and uses its saved model, seed, and brief.
   Astra proposes one complete room. The worker saves it, calls `playRaidAttempt`
   once, and passes the recording to `builds.finish`.
3. `builds.finish` verifies and saves the proof, then marks the build ready or failed
   in the same transaction. Acceptance requires a win and a room that cannot be
   cleared by simply running. Failed proofs are retained. Proof inputs stay private.
4. `src/ai/drillySource.ts` subscribes to `builds.get`, then fetches `levels.get`.
   `src/game/session.ts` holds the prepared room until the player challenges Drilly.
   A later round requests a fresh build; saved rooms are not automatically reused.
5. `builds.retry` restarts a failed build without deleting its earlier candidates
   or attempts. A run number rejects stale workers. A scheduled timeout marks
   interrupted jobs failed. Client cancellation releases its subscription while
   backend generation continues.

Reloading can reconnect to pending generation. It does not restore a completed
round or reuse an already completed build.

## Persistence API

| Table      | Purpose                                         |
| ---------- | ----------------------------------------------- |
| `builds`   | Level generation attempts                       |
| `levels`   | Generated candidates and submitted player rooms |
| `attempts` | Recorded playthroughs and verified outcomes     |
| `rounds`   | Matches and their final results                 |

| Module                     | Implemented API                                                       |
| -------------------------- | --------------------------------------------------------------------- |
| [builds.ts](builds.ts)     | Public `request`, `get`, `list`, `retry`; internal worker transitions |
| [levels.ts](levels.ts)     | Public `get`; internal `recordCandidate`, `listForBuild`              |
| [attempts.ts](attempts.ts) | Internal `listForLevel`                                               |

Public generation operations require guest authentication and ownership checks.
Candidates reference their build; proof attempts reference their level and have
no round. Recordings carry the simulation rules version. Detailed provider logs
stay outside the database.

Round functions and public attempt functions remain API declarations whose
handlers throw `Not implemented`. Scored raids, player attempts, medals and
playback still live in the browser. The planned round start attaches a build through
`builds.roundId`; scored attempts and final results will then be verified and saved
on the backend. The player's own-room clear stays in the browser.

## Configuration

Use the existing development deployment. Set `OPENAI_API_KEY` in its backend
configuration. Drilly defaults to `gpt-6-astra`; `DRILLY_MODEL` is an optional
backend default for building and raids without an explicit model. The browser
passes its selected raid model: `gpt-6-astra`, `gpt-5.6-sol`, or `gpt-5.6-luna`.
That selection takes precedence over the backend default and remains
fixed for the round. It does not affect room generation. Never put the key in browser code, `VITE_` variables or Git.
`VITE_CONVEX_URL` connects the guest frontend.

The adapter uses the OpenAI SDK Responses API with structured output, bounded
output size and explicit reasoning effort. It does not parse model names. SDK
retries and logging are disabled. Each model adapter has one deadline and passes
the remaining time to the SDK, which cancels timed-out requests. Only reviewed
error messages reach the browser.

## Building and playing

For scored completion, `playRaidAttempt(level, callModel, previousAttempts)` asks the selected model
for `{ jumpTicks: number[] }` once, validates the sequence, and executes it literally
with `runAttempt`. It records the actual outcome and inputs consumed before that
outcome, including ignored jumps. There are no timing corrections, route objectives,
or predictive rollouts. The model sees the room, rules, initial player state, and
feedback reconstructed from its previous scored recordings. It never receives the
human's clear inputs. All selectable models use the same low reasoning effort,
output budget, instructions and attempt limit. The same function is imported by
Convex and the headless evaluator.

`buildDungeon(callModel, { seed, brief })` asks for a complete layout without showing a
starter layout. `roomOutputSchema` describes the required JSON reply; shared validation
checks the geometry and object limits and retains the template floor height.
The simulation supplies the room's permanent boundaries. The worker saves the
candidate before its single proof attempt. Generation and proof share one model
adapter and deadline; each scored raid attempt gets its own.

A failed proof or a room cleared by simply running fails the build. Retry generates
a new room while retaining previous candidates and attempts. There are no edit
commands, checkpoints, automatic repairs or fallback rooms. Room variety and
success rate are evaluated through playtesting.

`raid` accepts `level`, `previousAttempts`, and an optional model string, then
returns one recording. The session verifies raid responses against the simulation
and owns concurrent raids, retry history, stale-response protection and playback. See the [game design](../docs/game-design.md)
for round progression and scoring.

The generation worker and raid action log starts, elapsed time, completion and safe errors.
Raid logs include model, attempt number, outcome, ticks and
executed jump inputs. `drilly.raid.input` records instructions and input data;
`drilly.raid.output` records the complete parsed model reply before simulation or
truncation at the terminal tick. Use `npx convex logs --history 20` or the dashboard Logs page.
The browser console logs request starts, durations and failures under `drilly`.
Detailed replay trajectories belong in explicit local evaluation reports.

## Verification

Run `npm test`, `npm run lint` and `npm run build`. Keep focused simulation/replay,
validation, scoring, authentication and AI failure tests. Ordinary tests stub the
model and run the real simulation. Example rooms and model stubs live in
`shared/testing/`; the browser does not import them.

An optional live evaluation uses the configured development model:

```sh
npm run eval:drilly -- --live --deployment YOUR_DEV_DEPLOYMENT --cases saws,wall,spikes,slider,prison --report /tmp/drilly-eval.json
```

Add `--model gpt-5.6-sol` or `--model gpt-5.6-luna` to compare a selected model.
Omit `--deployment` to use server process environment variables. The command
reports calls, elapsed time and replay validity; detailed output stays outside Git.
The optional `build` case evaluates generation and its direct-input proof calls.
Live evaluations spend model calls and are separate from ordinary tests. Playtest
room readability, difficulty and latency as well as checking successful clears.
See the [game design](../docs/game-design.md).
