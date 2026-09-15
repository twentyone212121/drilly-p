# Arcade cleanup plan

Approved implementation scope for the [game design](game-design.md).
Deliver one PR. Complete the entire removal pass before review, then make one
commit only after explicit user approval. Do not commit or push automatically.
Start with removals;
add no new functionality or UI in that pass. Preserve the playable loop, even if
the intermediate frontend is rough. The Arcade mockup is a visual reference;
keep `public/mockups/` untracked and reuse no mock gameplay or timing logic.

## Code ownership

- `src/Game.tsx`: create the session, connect the guest and load the tutorial flag.
- `src/App.tsx`: compose the full-screen room, tools, HUD and overlays.
- `src/game/session.ts`: own progression, committed draft, clear, round and AI requests.
  Use six phases: prison, build, test, raid, watch and results. Attempt outcomes,
  pause and AI waiting/errors belong within those steps.
- `src/game/attempt.ts` and `shared/game/`: retain the fixed-tick simulation,
  input recording, playback and scoring. Keep gameplay validation in `shared/validation.ts`.
- `src/game/editor.ts`: retain geometry and edit validation. React owns tool choice
  and selection; Phaser owns temporary drag previews; the session commits edits.
- `src/game/phaser/`: use one mounted scene and shared room art for editing and play.
- `src/ai/drillySource.ts`: browser requests. `convex/drilly.ts`: authenticated
  actions. `convex/lib/drilly/`: ordinary AI functions shared with headless tests.
  This is one backend; retain the OpenAI SDK and Astra.

## Removal pass

1. Remove developer/lab/fixture/proof-viewer and saved-draft surfaces, campaign
   placeholders, trap settings and best-score tracking. Keep the current editor,
   controls and room renderers until their replacements are implemented.
2. Remove the duplicate AI backend and history/novelty machinery as detailed below.
   Consolidate backend helpers without changing the working movement controller.
3. Delete retired-feature tests with their implementation; consolidate redundant
   remaining tests. Verify the complete pass and leave it uncommitted for review.

Defer tutorial persistence, changed navigation semantics, renderer unification,
new components and new visual effects to the later redesign checkpoints.

## Later checkpoints: Arcade loop and frontend

1. Simplify `session.ts` and `sessionView.ts` around the agreed loop. Add tutorial
   completion persistence in `src/persistence/tutorial.ts`; tolerate storage errors
   and preserve the draft when replaying the tutorial. Challenge opens Test when
   the current draft needs a clear, otherwise Your raid.
2. Add `GameHud.tsx`, `GameOverlay.tsx` and `EditorTools.tsx` under `src/components/`.
   Replace the old App layout, controls and CSS. Keep the progress path visible
   throughout the round, with completed/current steps and a clear next action.
3. Extend the existing Phaser scene with `phaser/editorInput.ts`. Reuse room and
   obstacle art, handle scaled pointer coordinates, and commit edits on release.
   Preserve every existing hazard as an editor preset without settings forms.
   Delete the replaced `DungeonEditor.tsx` and `ObstacleShape.tsx` in the same
   checkpoint and fold `platformPanels.ts` into `roomArt.ts`. Keep internal proof
   validation and Drilly attempt playback. Update the README to match the new flow.

## Backend removal details

1. Remove `src/ai/localDrillySource.ts`, `server/drilly/local.ts` and their Vite/env
   wiring. Move the remaining AI functions to `convex/lib/drilly/`; update imports,
   test/config paths and setup documentation. Keep guest authentication automatic.
2. Delete `drillyLearning.ts`, `variety.ts` and their history/novelty machinery.
   Simplify `buildBrief.ts`, `build.ts`, validators and evaluation scripts accordingly.
  Use `build()` and `raid(level, previousAttempts, model)`; each raid request returns one
  completed attempt so technical retries preserve earlier recordings.
3. Preserve movement behavior during the removal pass. Keep proven-room checks,
   bounded retries, timeouts and stale-response protection through later changes.

## Later checkpoint: direct AI control

Implement the [agreed direct-input behavior](game-design.md#ai-and-scope) in
`convex/lib/drilly/raid.ts`, reusing the SDK and headless simulation. The session
owns concurrent action calls and keeps recordings in browser memory. Reuse
`playRaidAttempt` once after each valid builder edit, under the same build deadline.
Delete `planner.ts`, `attempt.ts`, `proof.ts`, `movement.ts`, and their route-only
contracts/tests. Keep the edit loop and proven-room checks; defer broader generation changes.

Keep model selection and ghost playback in the existing session/UI. Cache the
ghost trajectory once per round and sample the current playback clock. Use
headless rooms and playtesting to evaluate model strength and latency before
adding input batches or images. Add no custom language or agent framework.

## Tests and performance

Follow the lean test policy in [AGENTS.md](../AGENTS.md). Ordinary tests use a
stubbed model; use the headless runners and playtesting to evaluate live AI quality.

Keep pointer previews out of React state and avoid full-room clones or rebuilds
while dragging. Publish HUD snapshots only when displayed values change. Use one
frame loop, bounded visual effects and no continuous decorative work on static
editing or paused screens. Wake rendering for input and meaningful state changes.

For the completed removal pass and later code changes, run `npm test`, `npm run lint` and `npm run build`.
Verify the retained loop in the removal pass. During the redesign, play one live
round and check tutorial reload/replay, editing, retries and results. Profile dragging,
gameplay and idle screens; verify the Phaser instance survives mode changes and
pointer movement does not drive React renders. Summarize evidence in the PR;
keep captures and diagnostics outside Git, as required by [AGENTS.md](../AGENTS.md).
