/// <reference types="vite/client" />
import { expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { newPlayerDungeon } from "../../shared/game/rooms";
import { api } from "../_generated/api";
import schema from "../schema";
import { fakeModel } from "../../shared/testing/model";
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

function modelInput(init: RequestInit) {
  const body = JSON.parse(init.body as string);
  return {
    body,
    data: JSON.parse(body.input.slice(body.input.indexOf("\n") + 1)),
    output: { schemaName: body.text.format.name, schema: body.text.format.schema },
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
  let failProof = false;
  const buildRequests: { seed: string; brief: string }[] = [];
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const { body, data, output } = modelInput(init);
    expect(body.model).toBe(expectedModel);
    expect(body.reasoning).toEqual({ effort: "low" });
    if (output.schemaName === "drilly_room")
      buildRequests.push({ seed: data.seed, brief: data.brief });
    if (failProof && output.schemaName === "drilly_inputs") return response({ jumpTicks: [] });
    return response(await fakeModel("", data, output));
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
  expect(buildRequests.at(-1)).toEqual({
    seed: `${build.seed}-1`,
    brief: build.brief,
  });
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

  failProof = true;
  const next = await guest.mutation(api.builds.request, {});
  expect(next).not.toBe(buildId);
  await vi.advanceTimersByTimeAsync(0);
  await t.finishInProgressScheduledFunctions();
  const failedBuild = (await guest.query(api.builds.get, { buildId: next }))!;
  expect(failedBuild).toMatchObject({ status: "failed" });
  expect(failedBuild.designId).not.toBe(build.designId);
  const failedProof = await t.run(async (ctx) => {
    const candidate = await ctx.db
      .query("levels")
      .withIndex("by_buildId", (q) => q.eq("buildId", next))
      .first();
    return ctx.db
      .query("attempts")
      .withIndex("by_levelId_and_actor_and_number", (q) => q.eq("levelId", candidate!._id))
      .first();
  });
  expect(failedProof).toMatchObject({ outcome: "dead", number: 1 });
  failProof = false;
  await guest.mutation(api.builds.retry, { buildId: next });
  await vi.advanceTimersByTimeAsync(0);
  await t.finishInProgressScheduledFunctions();
  expect(await guest.query(api.builds.get, { buildId: next })).toMatchObject({
    status: "ready",
    runNumber: 2,
    seed: failedBuild.seed,
    brief: failedBuild.brief,
    designId: failedBuild.designId,
  });
  expect(buildRequests.at(-1)).toEqual({
    seed: `${failedBuild.seed}-2`,
    brief: failedBuild.brief,
  });
  expect(await t.run((ctx) => ctx.db.get("attempts", failedProof!._id))).toEqual(failedProof);

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
