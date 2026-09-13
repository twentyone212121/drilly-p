# Drilly P

Browser game prototype for the OpenAI × Tokyo AI 100-Hour Game Challenge, Track 1.
Escape a prison, build your own dungeon, clear it using one-button controls, then
submit it to raid Drilly's first authored dungeon. Attempts include recording,
replay, and audio. Drilly's AI counter-raid and full scored rounds follow later.

## Requirements

- Node.js **24.14.0**, pinned in `.nvmrc` and used by CI.
- npm (included with Node.js); use the committed `package-lock.json`.
- Access to the project's Convex development deployment for `npm run dev`.
- No backend, account, API key, or environment file is needed for local play.

## Install and start

```sh
git clone git@github.com:twentyone212121/drilly-p.git
cd drilly-p
npm ci
npm run dev
```

`npm run dev` starts Convex and Vite together. Use `npm run dev:fe` to start only
Vite. Frontend-only mode still connects to Convex when `VITE_CONVEX_URL` is
configured; without that variable, the game runs locally with saving disabled.

Open the Vite URL. Tap the room or press Space to start the prison escape, then
jump past the floor saw, collect the lower treasure, and jump back off the far wall
to reach the ledge. Land before jumping over the upper saw to take the second
treasure. Retries are unlimited; the prison is meant to take some practice.
After escaping, choose **Build your dungeon**. Place objects with the editor tools; select and drag to move, drag a
platform's corner to resize, or delete the selection. Test and collect every
treasure to unlock **Submit & raid**. Any accepted geometry edit requires another
clear. Testing never changes the draft, and submission keeps its own layout snapshot.

Clear Drilly's first dungeon, then choose **Revise your dungeon** to return to your
layout. Two later dungeon slots are unavailable placeholders. This slice has
unlimited retries; medals and Drilly's counter-raid are later work. Without a
Convex URL, all progress stays in this tab. With Convex configured, your dungeon
layout autosaves to an anonymous guest profile. Reloading still restarts the
prison and requires clearing the restored layout again.

Space and tap share one action: start/resume, jump during play, retry after failure,
and continue after success. The labeled button below the room shows that action.
Pause and Restart are separate controls. Developer tools can step, record, and
replay attempts; playback never advances the prison, clear, or raid flow. Exit
replay restores the original room for human play.

## Convex guest saves

The Convex CLI started by `npm run dev` watches and deploys backend changes. On
first setup, select this project's personal **development** deployment. The CLI
writes the deployment selection and public URL to the ignored `.env.local`;
restart Vite after changing its environment. `.env.example` lists the configuration.

Configure `JWT_PRIVATE_KEY` and `JWKS` once in that deployment's environment using
the [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual#configure-environment-variables).
Keep the private key in backend configuration. Reuse existing keys; do not rotate
them during routine development. The code already includes the anonymous provider,
auth tables, token verification routes, and React provider. No OAuth application or
email service is needed for this slice.

The game opens a guest session automatically and loads its private draft before
play starts. Guest credentials stay in browser storage; deleting that storage or
switching browsers loses access. There is no account recovery/linking UI yet.
Save feedback appears below the room. Offline edits stay in the tab until saved;
wait for acknowledgement before closing it. Other-tab conflicts offer explicit
load/overwrite choices. **Play without saving** starts a separate local game and
never uploads it automatically later.

The backend example is deliberately small:

- `convex/dungeons.ts`: public draft query/mutation, ownership, validation, and revision checks.
- `convex/schema.ts` and `convex/lib/validators.ts`: indexed tables and reusable wire shapes.
- `convex/lib/identity.ts`: the shared authenticated-user check.
- `convex/auth.ts`, `auth.config.ts`, and `http.ts`: library auth wiring.
- `src/persistence/`: guest loading UI and layout autosave coordination.
- `src/game/session.ts`: local game flow, with no network requests.

Tutorial completion, clear proofs, submissions, rounds, and attempt history are
not persisted by this slice. Auth setup and draft saving can be reviewed before
those features are added.

## Verification

```sh
npm test
npm run lint
npm run build
npm run run:attempt -- --describe
```

The prison and first dungeon fixtures are exercised headlessly for solvability and
replay determinism. Browser playtesting is manual: check Space/tap controls, the
escape-to-build transition, editing and clearing, and returning to the draft after
a raid. See [AGENTS.md](AGENTS.md) for development guidance and
[game design](docs/game-design.md) for agreed behavior and future scope.

For guest-save playtesting, edit a dungeon, wait for **Draft saved**, reload, and
check it after escaping again. Open another tab on the same browser to check
conflict choices; a separate browser profile should have its own draft. Disconnect
while editing to check unsaved feedback and reconnect to save. `npm test` covers
draft timing/isolation as well as backend authentication, geometry validation,
revision conflicts, and retry idempotency using `convex-test`.
