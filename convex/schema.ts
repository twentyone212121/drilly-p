import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { draftFields } from "./lib/validators";

export default defineSchema({
  ...authTables,
  drafts: defineTable(draftFields).index("by_ownerId", ["ownerId"]),
});
