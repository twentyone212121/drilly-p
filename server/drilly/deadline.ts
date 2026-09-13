import { DRILLY_ERRORS } from "../../shared/game/drillyErrors";
import type { Planner } from "./protocol";

export function withDeadline(plan: Planner, duration: number): Planner {
  const deadline = Date.now() + duration;
  return async (instructions, input, options) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(DRILLY_ERRORS.timeout);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        plan(instructions, input, { ...options, signal: controller.signal }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(DRILLY_ERRORS.timeout));
          }, remaining);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
