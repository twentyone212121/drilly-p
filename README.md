# Drilly P

Browser game prototype for the OpenAI × Tokyo AI 100-Hour Game Challenge, Track 1.
Escape a prison, build your own dungeon, clear it using one-button controls, then
submit it to raid Drilly's first authored dungeon. Attempts include recording,
replay, and audio. Drilly's AI counter-raid and full scored rounds follow later.

## Requirements

- Node.js **24.14.0**, pinned in `.nvmrc` and used by CI.
- npm (included with Node.js); use the committed `package-lock.json`.
- No backend, account, API key, or environment file is needed for local play.

## Install and start

```sh
git clone git@github.com:twentyone212121/drilly-p.git
cd drilly-p
npm ci
npm run dev
```

Open the Vite URL. Tap the room or press Space to start the prison escape, then
jump past the floor saw, collect the lower treasure, and jump back off the far wall
to reach the ledge. Land before jumping over the upper saw to take the second
treasure. Retries are unlimited; the prison is meant to take some practice.
After escaping, choose **Build your dungeon**. Place objects with the editor tools; select and drag to move, drag a
platform's corner to resize, or delete the selection. Test and collect every
treasure to unlock **Submit & raid**. Any accepted geometry edit requires another
clear. Testing never changes the draft, and submission keeps its own layout snapshot.

Clear Drilly's first dungeon, then choose **Revise your dungeon** to return to your
layout. Two later dungeon slots are unavailable placeholders. This local slice has
unlimited retries; medals, Drilly's counter-raid, guest identity, and saves are later
work. All progress stays in memory in the current tab; reloading starts over.

Space and tap share one action: start/resume, jump during play, retry after failure,
and continue after success. The labeled button below the room shows that action.
Pause and Restart are separate controls. Developer tools can step, record, and
replay attempts; playback never advances the prison, clear, or raid flow. Exit
replay restores the original room for human play.

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
