# Drilly P

Browser game prototype for the OpenAI × Tokyo AI 100-Hour Game Challenge, Track 1.
The first checkpoint is a playable room with recording, replay, and audio.
The planned game is a dungeon-building rivalry against an AI opponent.

## Requirements

- Node.js **24.14.0**, pinned in `.nvmrc` and used by CI.
- npm (included with Node.js); use the committed `package-lock.json`.
- No backend, account, API key, or environment file is needed for this checkpoint.

## Install and start

```sh
git clone git@github.com:twentyone212121/drilly-p.git
cd drilly-p
npm ci
npm run dev
```

Open the Vite URL. Space starts/resumes, jumps during play, and starts a fresh
attempt after finishing. Click/tap the room to jump during play.
See [checkpoint development notes](docs/checkpoint.md) for controls, module boundaries,
headless replay, and verification. Run `npm test`, `npm run lint`, and `npm run build`
before handing off code.
