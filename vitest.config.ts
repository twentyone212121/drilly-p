import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "game",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "shared/**/*.test.ts",
            "convex/lib/drilly/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/tests/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
    ],
  },
});
