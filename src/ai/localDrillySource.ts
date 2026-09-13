import type { DrillySource } from "../../shared/game/drilly";
import { RULES } from "../../shared/game/rules";
import {
  parseDrillyAttempts,
  parseBuiltDungeon,
} from "../../shared/validation";
import {
  DRILLY_ERRORS,
  drillyErrorMessage,
} from "../../shared/game/drillyErrors";

async function request(path: string, data: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    RULES.drilly.raidClientTimeoutMs,
  );
  try {
    const response = await fetch(`/api/drilly/${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const message =
        body && typeof body === "object" && "error" in body ? body.error : null;
      throw new Error(drillyErrorMessage(message, DRILLY_ERRORS.unavailable));
    }
    return await response.json();
  } catch (error) {
    throw new Error(
      controller.signal.aborted
        ? DRILLY_ERRORS.timeout
        : drillyErrorMessage(error, DRILLY_ERRORS.unavailable),
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function createLocalDrillySource(): DrillySource {
  return {
    build: async (context) =>
      parseBuiltDungeon(
        await request("build", { rulesVersion: RULES.version, context }),
      ),
    raid: async (level) =>
      parseDrillyAttempts(
        await request("raid", { rulesVersion: RULES.version, level }),
        level,
      ),
  };
}
