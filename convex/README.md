# Drilly backend

The browser uses automatic guest authentication and calls `build` or `raid` in
`convex/drilly.ts`. Ordinary AI functions live in `convex/lib/drilly/` and can also
run in headless tests. There is no separate local HTTP backend.

| Module                                          | Responsibility                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `build.ts`, `construction.ts`, `buildSchema.ts` | Edit/test loop, room edits and structured output                   |
| `planner.ts`, `attempt.ts`                      | Scored attempt budget, model route decisions and attempt execution |
| `movement.ts`, `observation.ts`                 | Physics lookahead and current room/player observations             |
| `proof.ts`                                      | Prove the room with the raid controller                            |
| `protocol.ts`, `provider.ts`, `deadline.ts`     | Model contract, OpenAI SDK and cancellation                        |

Gameplay validation stays in `shared/validation.ts`; wire validators live in
`convex/lib/validators.ts`. Simulation and tuning stay in `shared/game/`.
There are no per-tick database writes or persistence tables for AI play.

## Configuration

Use the existing development deployment. Set `OPENAI_API_KEY` in its backend
configuration. Drilly defaults to `gpt-6-astra`; `DRILLY_MODEL` is an optional
backend override. Never put the key in browser code, `VITE_` variables or Git.
`VITE_CONVEX_URL` connects the guest frontend.

The adapter uses the OpenAI SDK Responses API with structured output, bounded
output size and explicit reasoning effort. It does not parse model names. SDK
retries and logging are disabled. Per-call timeouts and overall request deadlines
abort outstanding HTTP requests; only reviewed error messages reach the browser.

## Building and playing

The model edits geometry and chooses an ordered route. The movement controller
calculates jump timing through short simulations, then executes a selected prefix.
Attempts never rewind. Human and AI inputs use the same movement and collision
rules. Drilly receives the submitted layout without the human's clear inputs.

Builds use a fixed budget. Failed edits preserve the last cleared route for repair
and the last proven challenge for publication. A late provider failure can return
that proven challenge; an unfinished room or one cleared by simply running cannot
be published. There is no adaptive player history, novelty ranking or timing-score
search. The movement controller is unchanged by these cuts.

The build response is `{ level, proof }`; the proof must be a winning replay of
exactly that room. The session validates it before starting the human raid and
reuses background preparation started while editing. The raid response contains
recorded attempts on the submitted room. Playback makes no model calls. Stale
responses cannot advance an abandoned round, and technical errors award no medals.

Build logs contain edit-stage outcomes; raid logs contain attempt outcomes and
route objectives. Detailed traces belong in explicit local evaluation reports.

## Verification

Run `npm test`, `npm run lint` and `npm run build`. Keep focused simulation/replay,
validation, scoring, authentication and AI failure tests. Ordinary tests stub the
model and run the real simulation. Example rooms and model stubs live in
`shared/testing/`; the browser does not import them.

An optional live evaluation uses the configured development model:

```sh
npm run eval:drilly -- --live --deployment YOUR_DEV_DEPLOYMENT --cases saws,wall,spikes,slider,prison,build --report /tmp/drilly-eval.json
```

Omit `--deployment` to use server process environment variables. The command
reports calls, elapsed time and replay validity; detailed output stays outside Git.
Live evaluations spend model calls and are separate from ordinary tests. Playtest
room readability, difficulty and latency as well as checking successful clears.
See the [game design](../docs/game-design.md) and [cleanup plan](../docs/cleanup-plan.md).
