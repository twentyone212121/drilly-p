import { afterEach, expect, it, vi } from "vitest";
import { DRILLY_ERRORS } from "../../shared/game/drillyErrors";
import { RULES } from "../../shared/game/rules";
import { createLocalDrillySource } from "./localDrillySource";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("preserves safe backend messages while hiding unreviewed response bodies", async () => {
  for (const [message, expected] of [
    [DRILLY_ERRORS.quota, DRILLY_ERRORS.quota],
    ["secret account details", DRILLY_ERRORS.unavailable],
  ]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: message }), { status: 503 }),
      ),
    );
    await expect(
      createLocalDrillySource().build({ recentRaids: [], recentRooms: [] }),
    ).rejects.toThrow(expected);
  }
});

it("reports an aborted local request as a retryable timeout", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    ),
  );
  const pending = expect(
    createLocalDrillySource().build({ recentRaids: [], recentRooms: [] }),
  ).rejects.toThrow(DRILLY_ERRORS.timeout);
  await vi.advanceTimersByTimeAsync(RULES.drilly.raidClientTimeoutMs);
  await pending;
});
