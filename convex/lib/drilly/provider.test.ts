import { describe, expect, it, vi, afterEach } from "vitest";
import { openAIPlanner } from "./provider";
import { withDeadline } from "./deadline";
import { RULES } from "../../../shared/game/rules";
import { DRILLY_ERRORS } from "../../../shared/game/drillyErrors";

const schema = { type: "object", additionalProperties: false, properties: {}, required: [] };

function completed(text = "{}") {
  return {
    object: "response",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  };
}

function mockResponse(payload: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Drilly OpenAI SDK adapter", () => {
  it("requires an explicit server key even if the process has one", () => {
    vi.stubEnv("OPENAI_API_KEY", "not-the-configured-key");
    expect(() => openAIPlanner(undefined)).toThrow(DRILLY_ERRORS.configuration);
  });

  it("defaults to Astra and sends bounded, non-stored structured output with explicit reasoning", async () => {
    const fetch = mockResponse(completed());
    const result = await openAIPlanner("test-key")(
      "Act",
      { room: "test" },
      {
        schema: schema,
        schemaName: "test_output",
        reasoning: "low",
      },
    );

    expect(result).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const request = JSON.parse(init!.body as string);
    expect(request).toMatchObject({
      model: "gpt-6-astra",
      instructions: "Act",
      store: false,
      max_output_tokens: RULES.drilly.providerOutputTokens,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "test_output",
          schema: schema,
        },
      },
    });
    expect(request.input).toContain(JSON.stringify({ room: "test" }));
  });

  it("honors an explicit model and effort without interpreting the model name", async () => {
    const fetch = mockResponse(completed());
    await openAIPlanner("test-key", "custom-deployment")(
      "JSON please",
      {},
      {
        reasoning: "medium",
      },
    );

    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      model: "custom-deployment",
      reasoning: { effort: "medium" },
      text: { format: { type: "json_object" } },
    });
  });

  it.each([
    { ...completed(), status: "incomplete" },
    { ...completed(), output: [] },
    {
      ...completed(),
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "Cannot comply" }],
        },
      ],
    },
    completed("not-json"),
    completed("x".repeat(64_001)),
    null,
  ])(
    "rejects incomplete, refused, malformed or oversized results without retrying: %j",
    async (payload) => {
      const fetch = mockResponse(payload);
      await expect(openAIPlanner("secret")("JSON", {})).rejects.toThrow(
        "no medals",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [401, "invalid_api_key", DRILLY_ERRORS.credentials],
    [429, "insufficient_quota", DRILLY_ERRORS.quota],
    [429, "rate_limit_exceeded", DRILLY_ERRORS.rateLimit],
    [400, "unsupported_parameter", DRILLY_ERRORS.request],
    [500, "server_error", DRILLY_ERRORS.unavailable],
  ])(
    "maps HTTP %s to a safe game error with no SDK retries",
    async (status, code, message) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fetch = mockResponse(
        { error: { code, message: "private account details" } },
        status,
      );
      await expect(openAIPlanner("secret")("JSON", {})).rejects.toThrow(
        message,
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "Drilly provider rejected request",
        { status },
      );
    },
  );

  it("does not retry connection failures or expose their details", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("private account details");
    });
    vi.stubGlobal("fetch", fetch);
    await expect(openAIPlanner("secret")("JSON", {})).rejects.toThrow(
      DRILLY_ERRORS.unavailable,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows a response beyond 25 seconds within the attempt deadline", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify(completed()), {
                  headers: { "Content-Type": "application/json" },
                }),
              ),
            30_000,
          );
          init!.signal!.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const plan = withDeadline(
      openAIPlanner("key"),
      RULES.drilly.raidThinkingTimeoutMs,
    );
    const pending = expect(plan("JSON", {})).resolves.toEqual({});
    await Promise.all([pending, vi.advanceTimersByTimeAsync(30_000)]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not send a request after its caller has cancelled", async () => {
    const fetch = mockResponse(completed());
    const controller = new AbortController();
    controller.abort();
    await expect(
      openAIPlanner("key")("JSON", {}, { signal: controller.signal }),
    ).rejects.toThrow(DRILLY_ERRORS.timeout);
    expect(fetch).not.toHaveBeenCalled();
  });
});
