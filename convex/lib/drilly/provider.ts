import OpenAI from "openai";
import type { Planner } from "./protocol";
import { RULES } from "../../../shared/game/rules";
import {
  DRILLY_ERRORS,
  drillyErrorMessage,
} from "../../../shared/game/drillyErrors";

export function openAIPlanner(
  apiKey: string | undefined,
  model: string = RULES.drilly.defaultModel,
): Planner {
  if (!apiKey) throw new Error(DRILLY_ERRORS.configuration);

  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: RULES.drilly.providerTimeoutMs,
    logLevel: "off",
  });

  return async (instructions, input, options) => {
    try {
      const response = await client.responses.create(
        {
          model,
          instructions,
          input: `Return JSON for this game data:\n${JSON.stringify(input)}`,
          store: false,
          max_output_tokens: RULES.drilly.providerOutputTokens,
          reasoning: options?.reasoning
            ? { effort: options.reasoning }
            : undefined,
          text: {
            format: options?.schema
              ? {
                  type: "json_schema",
                  name: options.schemaName ?? "drilly_output",
                  strict: true,
                  schema: options.schema,
                }
              : { type: "json_object" },
          },
        },
        { signal: options?.signal },
      );

      if (response.status !== "completed" || !response.output_text)
        throw new Error(DRILLY_ERRORS.incomplete);
      if (response.output_text.length > 64_000)
        throw new Error(DRILLY_ERRORS.incomplete);

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
        return error.code === "insufficient_quota"
          ? DRILLY_ERRORS.quota
          : DRILLY_ERRORS.rateLimit;
      case 400:
      case 403:
      case 404:
      case 422:
        return DRILLY_ERRORS.request;
    }
  }

  return drillyErrorMessage(error, DRILLY_ERRORS.unavailable);
}
