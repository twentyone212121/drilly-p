import { describe, expect, it, vi, afterEach } from "vitest";
import { openAIPlanner } from "./provider";
import { testStrategy } from "./testing";
import { strategySchema } from "./protocol";
import { RULES } from "../../shared/game/rules";
import { DRILLY_ERRORS } from "../../shared/game/drillyErrors";

function completed(text = JSON.stringify(testStrategy)) {
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
        schema: strategySchema,
        schemaName: "drilly_strategy",
        reasoning: "low",
      },
    );

    expect(result).toEqual(testStrategy);
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
          name: "drilly_strategy",
          schema: strategySchema,
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
    [403, "permission_denied", DRILLY_ERRORS.request],
    [404, "model_not_found", DRILLY_ERRORS.request],
    [422, "invalid_input", DRILLY_ERRORS.request],
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

  it("aborts a slow request at the SDK timeout without retrying", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const pending = expect(openAIPlanner("key")("JSON", {})).rejects.toThrow(
      DRILLY_ERRORS.timeout,
    );
    await vi.advanceTimersByTimeAsync(RULES.drilly.providerTimeoutMs);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
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
