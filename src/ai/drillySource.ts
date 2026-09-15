import { ConvexError } from "convex/values";
import { drillyErrorMessage, DRILLY_ERRORS } from "../../shared/game/drillyErrors";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import { RULES } from "../../shared/game/rules";
import type { DrillySource } from "../../shared/game/drilly";
import { parseDrillyAttempts } from "../../shared/validation";

// Convex actions are not cancelled by leaving a view. Bound the client wait and
// let the session discard old-round responses; the server bounds its own calls.
async function boundedRequest<T>(
  label: string,
  request: Promise<T>,
  timeoutMs = RULES.drilly.raidClientTimeoutMs,
): Promise<T> {
  const started = Date.now();
  console.info(`${label}.started`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(DRILLY_ERRORS.timeout)), timeoutMs);
      }),
    ]);
    console.info(`${label}.completed`, { elapsedMs: Date.now() - started });
    return result;
  } catch (error) {
    const message = drillyErrorMessage(
      error instanceof ConvexError ? error.data : error,
      DRILLY_ERRORS.unavailable,
    );
    console.warn(`${label}.failed`, { elapsedMs: Date.now() - started, message });
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}

export function createDrillySource(client: ConvexReactClient): DrillySource {
  return {
    build: () => boundedRequest("drilly.build", client.action(api.drilly.build, {})),
    raid: (level, previousAttempts, model) =>
      boundedRequest(
        `drilly.raid.${model}.attempt-${previousAttempts.length + 1}`,
        client.action(api.drilly.raid, {
          level,
          previousAttempts: parseDrillyAttempts(previousAttempts, level),
          model,
        }),
        RULES.drilly.raidClientTimeoutMs,
      ),
  };
}
