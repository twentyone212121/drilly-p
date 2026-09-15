import { ConvexError } from "convex/values";
import {
  drillyErrorMessage,
  DRILLY_ERRORS,
} from "../../shared/game/drillyErrors";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { RULES } from "../../shared/game/rules";
import type { DrillySource } from "../../shared/game/drilly";
import { parseDrillyAttempts, parseLevel } from "../../shared/validation";

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
        timer = setTimeout(
          () => reject(new Error(DRILLY_ERRORS.timeout)),
          timeoutMs,
        );
      }),
    ]);
    console.info(`${label}.completed`, { elapsedMs: Date.now() - started });
    return result;
  } catch (error) {
    const message = drillyErrorMessage(
      error instanceof ConvexError ? error.data : error,
      DRILLY_ERRORS.unavailable,
    );
    console.warn(`${label}.failed`, {
      elapsedMs: Date.now() - started,
      message,
    });
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}

function waitForBuild(
  client: ConvexReactClient,
  buildId: Id<"builds">,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  return new Promise<Id<"levels">>((resolve, reject) => {
    const watch = client.watchQuery(api.builds.get, { buildId });
    function cleanup() {
      unsubscribe();
      signal.removeEventListener("abort", abort);
    }
    function abort() {
      cleanup();
      reject(new Error("Room preparation cancelled."));
    }
    function update() {
      try {
        const build = watch.localQueryResult();
        if (build === undefined) return;
        if (!build) throw new Error(DRILLY_ERRORS.unavailable);
        if (build.status === "failed")
          throw new Error(build.error ?? DRILLY_ERRORS.unavailable);
        if (build.status !== "ready") return;
        if (!build.acceptedLevelId) throw new Error(DRILLY_ERRORS.unavailable);
        cleanup();
        resolve(build.acceptedLevelId);
      } catch (error) {
        cleanup();
        reject(
          error instanceof Error ? error : new Error(DRILLY_ERRORS.unavailable),
        );
      }
    }
    const unsubscribe = watch.onUpdate(update);
    signal.addEventListener("abort", abort, { once: true });
    update();
  });
}

export function createDrillySource(client: ConvexReactClient): DrillySource {
  const pendingBuildKey = "drilly-p.pending-build";
  let pendingBuild: Id<"builds"> | undefined;
  try {
    const stored = localStorage.getItem(pendingBuildKey);
    if (stored && /^[a-z0-9]{16,64}$/i.test(stored))
      pendingBuild = stored as Id<"builds">;
  } catch {
    /* Browser storage is optional. */
  }
  function rememberBuild(value?: Id<"builds">) {
    pendingBuild = value;
    try {
      if (value) localStorage.setItem(pendingBuildKey, value);
      else localStorage.removeItem(pendingBuildKey);
    } catch {
      /* Keep the pending request in memory. */
    }
  }

  async function build(signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();

    async function request() {
      controller.signal.throwIfAborted();
      let previous = pendingBuild;
      if (previous) {
        // The server also checks ownership, so another guest's saved ID is never reused.
        const owned = await client.query(api.builds.get, { buildId: previous });
        if (!owned) {
          rememberBuild();
          previous = undefined;
        }
      }
      const buildId =
        previous ?? (await client.mutation(api.builds.request, {}));
      if (previous) await client.mutation(api.builds.retry, { buildId });
      rememberBuild(buildId);
      controller.signal.throwIfAborted();

      const levelId = await waitForBuild(client, buildId, controller.signal);
      const level = await client.query(api.levels.get, { levelId });
      controller.signal.throwIfAborted();
      if (!level) throw new Error(DRILLY_ERRORS.unavailable);
      const room = parseLevel(level.room);
      rememberBuild();
      return room;
    }

    try {
      return await boundedRequest("drilly.build", request());
    } finally {
      controller.abort();
      signal?.removeEventListener("abort", abort);
    }
  }

  return {
    build,
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
