import OpenAI from "openai";
import { RULES } from "../../../shared/game/rules";
import { DRILLY_ERRORS, drillyErrorMessage } from "../../../shared/game/drillyErrors";

export type ModelCall = (
  instructions: string,
  input: unknown,
  output: { schema: Record<string, unknown>; schemaName: string },
) => Promise<unknown>;

/** Calls made through this adapter share one deadline. */
export function createModelCall(
  apiKey: string | undefined,
  model: string,
  timeoutMs: number,
): ModelCall {
  if (!apiKey) throw new Error(DRILLY_ERRORS.configuration);

  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    logLevel: "off",
  });
  const deadline = Date.now() + timeoutMs;

  return async (instructions, input, output) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(DRILLY_ERRORS.timeout);

    try {
      const response = await client.responses.create(
        {
          model,
          service_tier: "fast",
          instructions,
          input: `Return JSON for this game data:\n${JSON.stringify(input)}`,
          store: false,
          max_output_tokens: RULES.drilly.providerOutputTokens,
          reasoning: { effort: "low" },
          text: {
            format: {
              type: "json_schema",
              name: output.schemaName,
              strict: true,
              schema: output.schema,
            },
          },
        },
        { timeout: remaining },
      );

      console.info("drilly.model.processing", {
        model,
        serviceTier: response.service_tier ?? null,
      });

      if (response.status !== "completed" || !response.output_text)
        throw new Error(DRILLY_ERRORS.incomplete);
      if (response.output_text.length > 64_000) throw new Error(DRILLY_ERRORS.incomplete);

      return JSON.parse(response.output_text) as unknown;
    } catch (error) {
      // SDK errors contain provider bodies; only reviewed game messages reach clients.
      throw new Error(providerErrorMessage(error));
    }
  };
}

function providerErrorMessage(error: unknown): string {
  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    error instanceof OpenAI.APIUserAbortError
  )
    return DRILLY_ERRORS.timeout;

  if (error instanceof OpenAI.APIError) {
    console.warn("Drilly provider rejected request", { status: error.status });

    switch (error.status) {
      case 401:
        return DRILLY_ERRORS.credentials;
      case 429:
        return error.code === "insufficient_quota" ? DRILLY_ERRORS.quota : DRILLY_ERRORS.rateLimit;
      case 400:
      case 403:
      case 404:
      case 422:
        return DRILLY_ERRORS.request;
    }
  }

  return drillyErrorMessage(error, DRILLY_ERRORS.unavailable);
}
