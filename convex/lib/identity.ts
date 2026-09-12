import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

export async function requireUserId(ctx: Pick<QueryCtx, "auth" | "db">) {
  // Convex Auth subjects include a session ID. Its adapter extracts the stable user ID.
  const userId = await getAuthUserId(ctx);
  if (userId === null || (await ctx.db.get("users", userId)) === null) {
    throw new ConvexError("Sign in as a guest before accessing your draft.");
  }

  return userId;
}
