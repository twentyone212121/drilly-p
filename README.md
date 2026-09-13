# Drilly P

Browser game prototype for the OpenAI × Tokyo AI 100-Hour Game Challenge, Track 1.
Build a dungeon, clear it yourself, raid Drilly’s generated room, and watch the AI
attempt yours. Both sides use the same simulation and recorded jump inputs.

## Start and test live AI

Use Node.js **24.14.0** (pinned in `.nvmrc`) and npm with the committed lockfile.

```sh
npm ci
npm run dev
```

`npm run dev` starts Convex and Vite together. Use the existing development
deployment; Convex writes its public URL to
`.env.local`. The backend needs `OPENAI_API_KEY` and the existing Convex Auth
`JWT_PRIVATE_KEY` / `JWKS`. Drilly defaults to `gpt-6-astra`; `DRILLY_MODEL` is an
optional backend override. Never put API keys in `VITE_` variables.

Use `npm run dev:fe` to start only Vite when Convex is already running.
Frontend-only mode still connects to Convex when `VITE_CONVEX_URL` is configured.
Restart Vite after changing its environment.

Guest authentication is automatic. The header shows **LIVE AI** when the game is
connected. Each reload starts a fresh game; no old draft or save version blocks
startup.

1. Click **Skip tutorial** in development, or escape the prison normally.
2. Build your room, click **Test dungeon**, and collect every treasure.
3. Click **Submit & raid** to enter Drilly’s generated room. Building can take up
   to three minutes; provider errors appear with a retry button.
4. Clear its room or finish your three attempts, then click **Watch Drilly** to
   see its attempts on your submitted layout.

Space or tap starts/resumes play and jumps. Wall jumps reverse direction. Editing
a cleared dungeon requires clearing the edited layout before submitting it.
Layouts, medals and learning history remain in the current tab only.

Without Convex, local AI is available by setting `OPENAI_API_KEY` in ignored
`.env.local` and running `npm run dev:fe`. Without either AI connection, the game labels
itself **LOCAL PRACTICE**.

## Verification

```sh
npm test
npm run lint
npm run build
npm run run:attempt -- --describe
```

Tests use a stubbed model and the real simulation. See [backend notes](convex/README.md)
for optional live evaluations and [game design](docs/game-design.md) for gameplay
scope. Simulation checks do not establish AI difficulty or enjoyment.
