import { ConvexError } from "convex/values";
import {
  drillyErrorMessage,
  DRILLY_ERRORS,
} from "../../shared/game/drillyErrors";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import { RULES } from "../../shared/game/rules";
import type { DrillySource } from "../../shared/game/drilly";

// Convex actions are not cancelled by leaving a view. Bound the client wait and
// let the session discard old-round responses; the server bounds its own calls.
async function boundedRequest<T>(
  request: Promise<T>,
  timeoutMs = RULES.drilly.raidClientTimeoutMs,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(DRILLY_ERRORS.timeout)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    throw new Error(
      drillyErrorMessage(
        error instanceof ConvexError ? error.data : error,
        DRILLY_ERRORS.unavailable,
      ),
    );
  } finally {
    clearTimeout(timer);
  }
}

export function createDrillySource(client: ConvexReactClient): DrillySource {
  return {
    build: (context) =>
      boundedRequest(
        client.action(api.drilly.build, {
          context,
        }),
      ),
    raid: (level) =>
      boundedRequest(
        client.action(api.drilly.raid, { level }),
        RULES.drilly.raidClientTimeoutMs,
      ),
  };
}
