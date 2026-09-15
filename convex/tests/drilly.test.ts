/// <reference types="vite/client" />
import { expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { api } from "../_generated/api";
import schema from "../schema";
import { buildPlan } from "../../shared/testing/planner";
import { replayAttempt } from "../../shared/game/replay";

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

function plannerInput(init: RequestInit) {
  const body = JSON.parse(init.body as string);
  return {
    body,
    data: JSON.parse(body.input.slice(body.input.indexOf("\n") + 1)),
    options: { schemaName: body.text.format.name },
  };
}

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
  await expect(t.mutation(api.builds.request, {})).rejects.toThrow("Sign in");
  await expect(
    t.action(api.drilly.raid, {
      level: newPlayerDungeon(),
      previousAttempts: [],
    }),
  ).rejects.toThrow("Sign in");
  expect(fetch).not.toHaveBeenCalled();
});
it("persists scheduled generation for its owner and forwards the requested raid model", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
  const guest = t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://test",
  });
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("DRILLY_MODEL", "gpt-6-astra");
  let expectedModel = "gpt-6-astra";
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const { body, data, options } = plannerInput(init);
    expect(body.model).toBe(expectedModel);
    expect(body.reasoning).toEqual({ effort: "low" });
    return response(await buildPlan("", data, options));
  });
  vi.stubGlobal("fetch", fetch);
  const buildId = await guest.mutation(api.builds.request, {});
  expect(await guest.mutation(api.builds.request, {})).toBe(buildId);
  expect(await guest.query(api.builds.get, { buildId })).toMatchObject({
    status: "queued",
  });
  await vi.advanceTimersByTimeAsync(0);
  await t.finishInProgressScheduledFunctions();

  const build = (await guest.query(api.builds.get, { buildId }))!;
  expect(build).toMatchObject({ status: "ready", runNumber: 1 });
  const level = (await guest.query(api.levels.get, {
    levelId: build.acceptedLevelId!,
  }))!;
  const proof = await t.run((ctx) => ctx.db.get("attempts", build.proofAttemptId!));
  expect(proof).toMatchObject({
    levelId: level._id,
    actor: "drilly",
    outcome: "won",
    number: 1,
  });
  expect(replayAttempt({ ...proof!.recording, level: level.room }).stopReason).toBe("won");
  expect(level).not.toHaveProperty("proof");
  expect(level.room).not.toHaveProperty("jumpTicks");

  const otherId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
  const other = t.withIdentity({ subject: `${otherId}|session` });
  expect(await other.query(api.builds.get, { buildId })).toBeNull();
  expect(await other.query(api.levels.get, { levelId: level._id })).toBeNull();
  expect(
    (
      await other.query(api.builds.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page,
  ).toEqual([]);
  await expect(other.mutation(api.builds.retry, { buildId })).rejects.toThrow("Build not found");

  const next = await guest.mutation(api.builds.request, {});
  expect(next).not.toBe(buildId);
  await vi.advanceTimersByTimeAsync(0);
  await t.finishInProgressScheduledFunctions();
  expectedModel = "gpt-5.6-sol";
  const attempt = await guest.action(api.drilly.raid, {
    level: newPlayerDungeon(),
    previousAttempts: [],
    model: "gpt-5.6-sol",
  });
  expect(attempt.outcome).toBe("won");
  expect(replayAttempt(attempt.replay).stopReason).toBe("won");
  expectedModel = "custom-model";
  expect(
    await guest.action(api.drilly.raid, {
      level: newPlayerDungeon(),
      previousAttempts: [],
      model: expectedModel,
    }),
  ).toMatchObject({ outcome: "won" });
});
