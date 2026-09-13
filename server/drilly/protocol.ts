import { RULES } from "../../shared/game/rules";

export type PlannerOptions = {
  schema?: Record<string, unknown>;
  schemaName?: string;
  reasoning?: "low" | "medium";
  signal?: AbortSignal;
};
export type Planner = (
  instructions: string,
  input: unknown,
  options?: PlannerOptions,
) => Promise<unknown>;

export const strategySchema = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "route"],
  properties: {
    objective: { type: "string", minLength: 1, maxLength: 240 },
    route: {
      type: "array",
      minItems: 1,
      maxItems: RULES.drilly.maxRouteWaypoints,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "id"],
        properties: {
          kind: { type: "string", enum: ["treasure", "platform", "wall"] },
          id: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
    },
  },
};
