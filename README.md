# Drilly P

Browser game prototype for the OpenAI × Tokyo AI 100-Hour Game Challenge, Track 1.
Build a dungeon locally, clear it using one-button controls, then submit it to raid
a predefined opponent room. Attempts include recording, replay, and audio.
Runtime AI is planned for the final dungeon-building rivalry.

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

Open the Vite URL. Choose an object tool and click to place; select and drag to
move, drag a platform's corner to resize, or delete the selection. Test the dungeon
and collect every treasure to unlock **Submit & raid**. Any accepted geometry edit
requires another clear. Drafts stay in the current tab; reloading starts over.

During a test or raid, Space starts/resumes, jumps during play, and starts a fresh
attempt after finishing. Click/tap the room to jump during play. Developer tools
can record and replay attempts; playback does not unlock submission.
See [AGENTS.md](AGENTS.md) for development guidance and
[game design](docs/game-design.md) for gameplay decisions.
