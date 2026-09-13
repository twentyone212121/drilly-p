import * as v from "valibot";
import type { Planner } from "./protocol";
import { RULES } from "../../shared/game/rules";
import {
  DRILLY_ERRORS,
  drillyErrorMessage,
} from "../../shared/game/drillyErrors";

const ResponseSchema = v.object({
  status: v.literal("completed"),
  output: v.array(
    v.object({
      type: v.string(),
      content: v.optional(
        v.array(v.object({ type: v.string(), text: v.optional(v.string()) })),
      ),
    }),
  ),
});

// No SDK retry loop: each invocation makes at most one paid request.
export function openAIPlanner(
  apiKey: string | undefined,
  model: string | undefined,
): Planner {
  if (!apiKey || !model) throw new Error(DRILLY_ERRORS.configuration);
  return async (instructions, input, options) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options?.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, RULES.drilly.providerTimeoutMs);
    try {
      if (options?.signal?.aborted) throw new Error(DRILLY_ERRORS.timeout);
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions,
          input: `Return JSON for this game data:\n${JSON.stringify(input)}`,
          store: false,
          max_output_tokens: RULES.drilly.providerOutputTokens,
          ...(options?.reasoning && /^gpt-5/.test(model)
            ? { reasoning: { effort: options.reasoning } }
            : {}),
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
        }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = v.safeParse(
          v.object({
            error: v.object({
              code: v.optional(v.string()),
              param: v.optional(v.nullable(v.string())),
            }),
          }),
          body,
        );
        console.warn("Drilly provider rejected request", {
          status: response.status,
          code: parsed.success
            ? parsed.output.error.code
                ?.replace(/[^a-zA-Z0-9_.-]/g, "")
                .slice(0, 80)
            : undefined,
          parameter: parsed.success
            ? parsed.output.error.param
                ?.replace(/[^a-zA-Z0-9_.-]/g, "")
                .slice(0, 80)
            : undefined,
        });
        const quota =
          parsed.success && parsed.output.error.code === "insufficient_quota";
        const message =
          response.status === 401
            ? DRILLY_ERRORS.credentials
            : response.status === 429
              ? quota
                ? DRILLY_ERRORS.quota
                : DRILLY_ERRORS.rateLimit
              : response.status === 400 ||
                  response.status === 403 ||
                  response.status === 404
                ? DRILLY_ERRORS.request
                : DRILLY_ERRORS.unavailable;
        throw new Error(message);
      }
      const parsed = v.safeParse(ResponseSchema, await response.json());
      if (!parsed.success) throw new Error(DRILLY_ERRORS.incomplete);
      const result = parsed.output;
      const text = result.output
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("");
      if (text.length > 64_000) throw new Error("Response too large");
      return JSON.parse(text) as unknown;
    } catch (error) {
      // Never expose provider bodies, account identifiers, or credentials to the browser.
      throw new Error(
        controller.signal.aborted
          ? DRILLY_ERRORS.timeout
          : drillyErrorMessage(error, DRILLY_ERRORS.unavailable),
      );
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener("abort", abort);
    }
  };
}
