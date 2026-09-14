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
