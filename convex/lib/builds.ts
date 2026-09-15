import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function requireBuildRun(
  ctx: Pick<QueryCtx, "db">,
  buildId: Id<"builds">,
  runNumber: number,
) {
  const build = await ctx.db.get("builds", buildId);
  if (!build || build.runNumber !== runNumber || build.status !== "running")
    throw new ConvexError("This build run is no longer active.");
  return build;
}
