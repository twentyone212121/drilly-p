import { afterEach, expect, it, vi } from "vitest";
import { createModelCall } from "./model";
import { DRILLY_ERRORS } from "../../../shared/game/drillyErrors";

const output = {
  schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
  schemaName: "test_output",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("shares a deadline across calls and aborts the outstanding request", async () => {
  vi.useFakeTimers();
  let aborted = false;
  const fetch = vi
    .fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          object: "response",
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const callModel = createModelCall("test-key", "test-model", 1000);
  await callModel("JSON", {}, output);
  await vi.advanceTimersByTimeAsync(400);

  const pending = expect(callModel("JSON", {}, output)).rejects.toThrow(DRILLY_ERRORS.timeout);
  await vi.advanceTimersByTimeAsync(600);
  await pending;
  expect(aborted).toBe(true);
  await expect(callModel("JSON", {}, output)).rejects.toThrow(DRILLY_ERRORS.timeout);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("returns a safe game error without exposing the provider response", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          error: { code: "insufficient_quota", message: "Private provider details" },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
  );

  const callModel = createModelCall("test-key", "test-model", 1000);
  await expect(callModel("JSON", {}, output)).rejects.toThrow(DRILLY_ERRORS.quota);
});
