import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

export async function requireUserId(ctx: Pick<QueryCtx, "auth">) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Sign in as a guest to play Drilly.");
  return userId;
}
