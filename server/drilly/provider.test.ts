import { describe, expect, it, vi, afterEach } from "vitest";
import { openAIPlanner } from "./provider";
import { testStrategy } from "./testing";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Drilly provider", () => {
  it("fails closed without provider configuration", () => {
    expect(() => openAIPlanner(undefined, undefined)).toThrow("not configured");
  });
  it("sends bounded non-stored JSON requests and parses completed responses", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: '{"jumpTicks":[]}' }],
              },
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await openAIPlanner("test-key", "test-model")("JSON please", {}),
    ).toEqual({
      jumpTicks: [],
    });
    const body = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.store).toBe(false);
    expect(body.input).toContain("Return JSON");
    expect(body.max_output_tokens).toBe(3000);
  });
  it("treats refusals, truncated responses, malformed JSON, and HTTP errors as technical failures without retries", async () => {
    for (const payload of [
      { status: "incomplete", output: [] },
      { status: "completed", output: [] },
      {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "not-json" }],
          },
        ],
      },
    ]) {
      const fetch = vi.fn(async () => new Response(JSON.stringify(payload)));
      vi.stubGlobal("fetch", fetch);
      await expect(openAIPlanner("secret", "test")("JSON", {})).rejects.toThrow(
        "no medals",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
});
it("aborts a slow provider call and does not retry it", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(
    (_url: unknown, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const pending = expect(
    openAIPlanner("key", "model")("JSON", {}),
  ).rejects.toThrow("no medals");
  await vi.advanceTimersByTimeAsync(25_000);
  await pending;
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  [401, "invalid_api_key", "API key was rejected"],
  [429, "insufficient_quota", "billing and credits"],
  [429, "rate_limit_exceeded", "Wait a moment"],
  [400, "unsupported_parameter", "request was rejected"],
])(
  "reports safe provider failures for HTTP %s",
  async (status, code, message) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code, message: "private account details" },
          }),
          { status },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(openAIPlanner("secret", "model")("JSON", {})).rejects.toThrow(
      message,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  },
);

it("sends strict action output and enables reasoning on the configured model", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                { type: "output_text", text: JSON.stringify(testStrategy) },
              ],
            },
          ],
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const { strategySchema } = await import("../../server/drilly/protocol");
  await openAIPlanner("secret", "gpt-5.4-mini")(
    "Act",
    {},
    { schema: strategySchema, schemaName: "drilly_strategy", reasoning: "low" },
  );
  const request = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(request.reasoning).toEqual({ effort: "low" });
  expect(request.text.format).toMatchObject({
    type: "json_schema",
    strict: true,
    name: "drilly_strategy",
    schema: strategySchema,
  });
});
