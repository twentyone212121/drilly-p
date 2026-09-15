# Working on Drilly P

The game is **Drilly P**: **Drilly** is the AI opponent, and **P** represents the player.

- Read [docs/game-design.md](docs/game-design.md) before implementing gameplay.
  It defines the accepted scope, next milestone, and open decisions.
- Implement the current milestone. Treat proposed features and open decisions as
  unsettled; document provisional choices instead of presenting them as confirmed.
  Update the design doc when the team agrees to a behavior change.
- Keep simulation independent of rendering and network requests. Human inputs
  and AI inputs must use the same movement rules; attempts must be reproducible.
- Keep tuning in `shared/game/rules.ts`. Use fixed simulation ticks and bump the
  rules version when changing mechanics so incompatible replays are rejected.
- Validate external data in `shared/validation.ts`. Keep session coordination in
  `src/game/session.ts` and Phaser integration in `src/game/phaser/`; renderers
  and audio react to simulation state/events rather than deciding outcomes.
- Keep one Phaser instance across editing and play. Keep pointer previews outside
  React state and publish UI snapshots only for displayed changes. Let static
  screens sleep; input, resize, and session changes must wake rendering.
- Prefer small named functions and blank lines between logical steps. Extract
  modules around clear responsibilities, not one-line wrappers.
- Keep durable development guidance here and gameplay decisions in the design doc.
  Don't duplicate code constants or maintain milestone status reports. Keep one-off
  screenshots, diagnostics, and verification output outside Git; summarize in PRs.
- Use `npm run run:attempt -- --describe` to inspect the headless runner's rules
  and input format. Keep browser and headless attempts on the same simulation.
- When the user is actively playtesting, hand off small UX checks to them instead
  of repeating browser automation unless requested.
- When the user's Convex dev watcher is running, let it sync backend edits. Do not
  run a separate sync unless diagnosing a watcher failure.
- Preserve unrelated local edits. Keep changes focused on the requested task.
- Do not commit or push changes without explicit user approval.
- Use npm and the committed lockfile. For code changes, run `npm test`,
  `npm run lint`, and `npm run build`.
  Documentation-only changes need link and formatting checks, not a full build.
- Keep tests lean during prototype iteration. Do not add a test for every feature,
  helper, or branch. Add one only for a stable gameplay contract or a concrete bug
  that is costly to catch by playtesting; extend an existing scenario when it fits.
- Prioritize physics/collisions, browser/headless replay parity, clear invalidation,
  scoring, stale AI results, external-data validation, authentication, and storage
  failure. Keep one tutorial-solvability check and a compact round-flow check.
- Playtest changing UI, navigation, copy, art, and AI strategy quality. Do not freeze
  prompt wording, internal phase names, incidental call counts, or authored layouts
  in assertions. Test our behavior, not SDK/library internals or trivial wrappers.
- Avoid overlapping scenarios and large fixture/parameter matrices that exercise
  the same rule. Remove tests and unused fixtures with retired features. Do not
  preserve tests for coverage numbers or merge unrelated cases just to lower counts.
- Keep secrets in backend configuration, never in browser code or `VITE_` variables.
- Group Convex entry points by feature (`convex/drilly.ts` contains AI actions).
  Keep ordinary shared helpers in `convex/lib/`; do not add service/repository layers.
  Validate arguments and returns, derive ownership from authentication, and query
  through indexes. Wire-shape validators belong in `convex/lib/validators.ts`;
  gameplay validation stays in `shared/validation.ts`. Test authenticated functions
  with `convex-test`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
