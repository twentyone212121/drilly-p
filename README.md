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

Guest authentication is automatic. Tutorial completion is remembered in localStorage;
later visits open your dungeon. If storage is unavailable, the game still works,
but the tutorial may return after reload.

1. Escape the prison on your first visit.
2. Edit your room or keep it, then click **Challenge Drilly**. If the room needs a
   clear, this opens Test; collect every treasure and click **Raid Drilly**. An
   unchanged, previously cleared room goes straight to the raid.
3. Drilly prepares its room while you build. If it is still working when you
   challenge, wait for the room or retry a provider error; building can take up
   to three minutes.
4. Clear its room or finish your three attempts, then watch Drilly’s recordings
   and view the results. Return to your existing draft for another round.

The five-step path at the top shows your progress through the round. Use the
overlay buttons to start or retry; Space or tap jumps during play. Wall jumps
reverse direction. Use the pause button to open the menu. Escape cancels the
current editor drag/tool, or opens the pause menu when nothing needs cancelling.
Choose a preset to place objects; use Move to drag them or resize a platform from
its corner. Arrow keys nudge the selection and Delete removes it. Edits commit on
release; rejected or cancelled drags preserve the draft and its clear.
Editing a cleared dungeon requires clearing the edited layout before submitting it.
Layouts and the current round remain in the tab only. **Test room** is also
available for practice. **Replay tutorial** is in the pause menu, accessible from
the editor and during play; it ends the current round and preserves your draft
and its existing clear.

Convex is the only AI backend. Without its connection you can escape and edit/test
your room, but cannot submit a challenge.

React renders the controls and overlays. One Phaser scene draws both editing and
play, while the shared simulation owns movement and replay outcomes.

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
