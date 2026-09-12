# Working on Drilly P

The game is **Drilly P**: **Drilly** is the AI opponent, and **P** represents the player.

- Read [docs/game-design.md](docs/game-design.md) before implementing gameplay.
  It defines the accepted scope, next milestone, and open decisions.
- Implement the current milestone. Treat proposed features and open decisions as
  unsettled; document provisional choices instead of presenting them as confirmed.
  Update the design doc when the team agrees to a behavior change.
- Keep simulation independent of rendering and network requests. Human inputs
  and AI inputs must use the same movement rules; attempts must be reproducible.
- Preserve unrelated local edits. Keep changes focused on the requested task.
- Use npm and the committed lockfile. For code changes, run `npm run lint` and
  `npm run build`; add focused tests for gameplay rules and replay determinism.
  Documentation-only changes need link and formatting checks, not a full build.
- Keep secrets in backend configuration, never in browser code or `VITE_` variables.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
