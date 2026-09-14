/// <reference types="vite/client" />
import { expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { api } from "../_generated/api";
import schema from "../schema";
import { buildPlan } from "../../shared/testing/planner";
import { replayAttempt } from "../../shared/game/replay";

const modules = import.meta.glob(["../**/*.ts", "!../**/*.test.ts"]);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("requires guest authentication before calling the provider", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const t = convexTest(schema, modules);
  await expect(t.action(api.drilly.build, {})).rejects.toThrow("Sign in");
  await expect(
    t.action(api.drilly.raid, {
      level: newPlayerDungeon(),
      previousAttempts: [],
    }),
  ).rejects.toThrow("Sign in");
  expect(fetch).not.toHaveBeenCalled();
});
it("runs authenticated build and raid actions through the real simulation with a stubbed provider", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
  const guest = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://test",
  });
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("DRILLY_MODEL", "gpt-6-astra");
  const response = (value: unknown) =>
    new Response(
      JSON.stringify({
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(value) }],
          },
        ],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  let expectedModel = "gpt-6-astra";
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(expectedModel);
    expect(body.reasoning).toEqual({ effort: "low" });
    const data = JSON.parse(body.input.slice(body.input.indexOf("\n") + 1));
    return response(await buildPlan("", data, { schemaName: body.text.format.name }));
  });
  vi.stubGlobal("fetch", fetch);
  const room = await guest.action(api.drilly.build, {});
  expect(replayAttempt(room.proof).stopReason).toBe("won");
  expect(room.level).not.toHaveProperty("jumpTicks");
  expectedModel = "gpt-5.6-sol";
  const attempt = await guest.action(api.drilly.raid, {
    level: newPlayerDungeon(),
    previousAttempts: [],
    model: "gpt-5.6-sol",
  });
  expect(attempt.outcome).toBe("won");
  expect(replayAttempt(attempt.replay).stopReason).toBe("won");
  fetch.mockClear();
  await expect(
    guest.action(api.drilly.raid, {
      level: newPlayerDungeon(),
      previousAttempts: [],
      // External callers must not bypass the model allowlist.
      // @ts-expect-error Deliberately invalid model.
      model: "unsupported-model",
    }),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
