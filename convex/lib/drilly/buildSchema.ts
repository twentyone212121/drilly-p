import type { BuildBudget } from "../../../shared/game/drilly";
import { strategySchema } from "./protocol";
import { RULES } from "../../../shared/game/rules";

// Provider wire format only. Shared validation still owns gameplay correctness.
function object(properties: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

const number = { type: "number", minimum: 0 };
const size = { type: "number", minimum: 1 };
const speed = {
  type: "number",
  minimum: RULES.obstacles.minSpeed,
  maximum: RULES.obstacles.maxSpeed,
};
const range = {
  type: "number",
  minimum: RULES.obstacles.minRange,
  maximum: RULES.obstacles.maxRange,
};
const warning = {
  type: "integer",
  minimum: RULES.obstacles.minWarning,
  maximum: RULES.obstacles.maxInterval,
};
const id = { type: "string", minLength: 1, maxLength: 100 };
const rectangle = { id, x: number, y: number, width: size, height: size };
const center = {
  id,
  x: number,
  y: number,
  radius: {
    type: "number",
    minimum: RULES.obstacles.minRadius,
    maximum: RULES.obstacles.maxRadius,
  },
};
const patrol = { ...center, endX: number, endY: number, speed };

export function buildSchema(budget: BuildBudget, canFinish: boolean) {
  return object({
    action: { type: "string", enum: canFinish ? ["edit", "finish"] : ["edit"] },
    base: { type: "string", enum: ["working", "checkpoint"] },
    name: {
      ...id,
      description:
        "Invent a short room title. Do not copy the workspace's placeholder name.",
    },
    idea: { type: "string", minLength: 1, maxLength: 240 },
    strategy: strategySchema,
    removeIds: { type: "array", maxItems: 24, items: id },
    edit: object({
      platforms: {
        type: "array",
        maxItems: budget.platforms,
        items: object(rectangle),
      },
      traps: {
        type: "array",
        maxItems: budget.hazards,
        items: object(center),
      },
      treasures: {
        type: "array",
        maxItems: budget.treasures,
        items: object(rectangle),
      },
      obstacles: {
        type: "array",
        maxItems: budget.hazards,
        items: {
          anyOf: [
            object({
              ...rectangle,
              kind: { type: "string", enum: ["spikes"] },
            }),
            object({
              ...patrol,
              kind: { type: "string", enum: ["slider", "drone"] },
            }),
            object({
              ...center,
              kind: { type: "string", enum: ["turret"] },
              mode: { type: "string", enum: ["fixed", "aimed", "flame"] },
              direction: { type: "number", enum: [-1, 1] },
              intervalTicks: {
                type: "integer",
                minimum: RULES.obstacles.minInterval,
                maximum: RULES.obstacles.maxInterval,
              },
              warmupTicks: warning,
              activeTicks: warning,
              range,
              projectileSpeed: speed,
            }),
            object({
              ...center,
              kind: { type: "string", enum: ["pursuer"] },
              speed,
              detectionRange: range,
              chaseRange: range,
              warningTicks: warning,
            }),
          ],
        },
      },
    }),
  });
}
