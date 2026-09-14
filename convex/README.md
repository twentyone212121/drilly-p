# Drilly backend

The browser uses automatic guest authentication and calls `build` or `raid` in
`convex/drilly.ts`. Ordinary AI functions live in `convex/lib/drilly/` and can also
run in headless tests. There is no separate local HTTP backend.

| Module                                          | Responsibility                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `build.ts`, `construction.ts`, `buildSchema.ts` | Edit/test loop, room edits and structured output                   |
| `raid.ts`                                       | One model-selected input sequence and recording for raids and builder proofs |
| `observation.ts`                                | Current room/player observations without predictions                |
| `protocol.ts`, `provider.ts`, `deadline.ts`     | Model contract, OpenAI SDK and cancellation                        |

Gameplay validation stays in `shared/validation.ts`; wire validators live in
`convex/lib/validators.ts`. Simulation and tuning stay in `shared/game/`.
The database contains auth tables only. The browser starts action calls, awaits
their responses, and keeps attempts in session memory for playback and retries.
There is no job queue, polling, or saved attempt history; reloading ends the round.

## Configuration

Use the existing development deployment. Set `OPENAI_API_KEY` in its backend
configuration. Drilly defaults to `gpt-6-astra`; `DRILLY_MODEL` is an optional
backend default for building and raids without an explicit model. The browser
passes its selected raid model: `gpt-6-astra`, `gpt-5.6-sol`, or `gpt-5.6-luna`.
That allowlisted selection takes precedence over the backend default and remains
fixed for the round. It does not affect room generation. Never put the key in browser code, `VITE_` variables or Git.
`VITE_CONVEX_URL` connects the guest frontend.

The adapter uses the OpenAI SDK Responses API with structured output, bounded
output size and explicit reasoning effort. It does not parse model names. SDK
retries and logging are disabled. Per-call timeouts and overall request deadlines
abort outstanding HTTP requests; only reviewed error messages reach the browser.

## Building and playing

For scored completion, `playRaidAttempt(level, plan, previousAttempts)` asks the selected model
for `{ jumpTicks: number[] }` once, validates the sequence, and executes it literally
with `runAttempt`. It records the actual outcome and inputs consumed before that
outcome, including ignored jumps. There are no timing corrections, route objectives,
or predictive rollouts. The model sees the room, rules, initial observation, and
feedback reconstructed from its previous scored recordings. It never receives the
human's clear inputs. All selectable models use the same low reasoning effort,
output budget, instructions and attempt limit. The same function is imported by
Convex and the headless evaluator.

The builder edits geometry, then calls `playRaidAttempt` once for each valid edit.
`attemptFeedback` supplies the actual result to its next design call. Design and
completion share one build deadline and model. There is no separate proof solver
or route language; builder attempts are private tests and do not award medals.

Builds use a fixed budget. Failed edits preserve the last cleared route for repair
and the last proven challenge for publication. A late provider failure can return
that proven challenge; an unfinished room or one cleared by simply running cannot
be published. There is no adaptive player history, novelty ranking or timing-score
search. Broader generation improvements remain deferred.

`build` returns `{ level, proof }`; `raid` accepts `level`, `previousAttempts`, and
an optional allowlisted `model`, then returns one recording. The session verifies
both responses against the simulation and owns concurrent calls, retry history,
stale-response protection and playback. See the [game design](../docs/game-design.md)
for round progression and scoring.

Both actions log starts, elapsed time, completion and safe errors. Build logs include
edit-stage outcomes; raid logs include model, attempt number, outcome, ticks and
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
See the [game design](../docs/game-design.md) and [cleanup plan](../docs/cleanup-plan.md).
