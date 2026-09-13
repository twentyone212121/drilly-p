/// <reference types="vite/client" />
import { expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { newPlayerDungeon, getDungeon } from "../../shared/game/campaign";
import { api } from "../_generated/api";
import schema from "../schema";
import { buildPlan } from "../../server/drilly/testing";
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
    }),
  ).rejects.toThrow("Sign in");
  expect(fetch).not.toHaveBeenCalled();
});
it("runs authenticated build and raid actions through the real simulation with a stubbed provider", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { isAnonymous: true }),
  );
  const guest = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://test",
  });
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("DRILLY_MODEL", undefined);
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
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-6-astra");
    expect(body.reasoning).toEqual({ effort: "low" });
    const data = JSON.parse(body.input.slice(body.input.indexOf("\n") + 1));
    return response(await buildPlan("", data));
  });
  vi.stubGlobal("fetch", fetch);
  const room = await guest.action(api.drilly.build, {});
  expect(room.level.name).toBe(getDungeon("first-vault").name);
  expect(replayAttempt(room.proof).stopReason).toBe("won");
  expect(room.level).not.toHaveProperty("jumpTicks");
  const attempts = await guest.action(api.drilly.raid, {
    level: newPlayerDungeon(),
  });
  expect(attempts.map((a) => a.outcome)).toEqual(["won"]);
  await expect(
    guest.action(api.drilly.raid, {
      rulesVersion: "old",
      level: newPlayerDungeon(),
    }),
  ).resolves.toMatchObject([{ outcome: "won" }]);
  expect(fetch.mock.calls.length).toBeGreaterThan(2);
});
