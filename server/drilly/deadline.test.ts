import { afterEach, expect, it, vi } from "vitest";
import { withDeadline } from "./deadline";
import { openAIPlanner } from "./provider";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("cancels an outstanding HTTP call at the whole-request deadline", async () => {
  vi.useFakeTimers();
  let aborted = false;
  const fetch = vi.fn(
    (_url: unknown, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const plan = withDeadline(openAIPlanner("test-key", "test-model"), 1000);
  const pending = expect(plan("JSON", {})).rejects.toThrow("too long");
  await vi.advanceTimersByTimeAsync(1000);
  await pending;
  expect(aborted).toBe(true);
  await expect(plan("JSON", {})).rejects.toThrow("too long");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
