import { ConvexError, v } from "convex/values";
import { newPlayerDungeon } from "../shared/game/campaign";
import { RULES } from "../shared/game/rules";
import { parseEditorLevel } from "../shared/validation";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/identity";
import { levelValidator } from "./lib/validators";
import schema from "./schema";

export const getMyDraft = query({
  args: {},
  returns: v.object({
    ownerId: v.id("users"),
    draft: v.union(schema.doc("drafts"), v.null()),
  }),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const draft = await findDraft(ctx, ownerId);

    return { ownerId, draft };
  },
});

export const saveMyDraft = mutation({
  args: {
    level: levelValidator,
    rulesVersion: v.string(),
    expectedRevision: v.union(v.number(), v.null()),
    saveId: v.string(),
  },
  returns: v.union(
    v.object({ status: v.literal("saved"), draft: schema.doc("drafts") }),
    v.object({
      status: v.literal("conflict"),
      draft: v.union(schema.doc("drafts"), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    validateSaveRequest(args);

    const level = canonicalDraft(args.level);
    const current = await findDraft(ctx, ownerId);

    // A lost acknowledgement may retry the last save after its revision has advanced.
    if (current?.lastSaveId === args.saveId) {
      if (
        current.rulesVersion !== args.rulesVersion ||
        JSON.stringify(canonicalDraft(current.level)) !== JSON.stringify(level)
      ) {
        throw new ConvexError("A save ID cannot be reused for a different draft.");
      }

      return { status: "saved" as const, draft: current };
    }

    if ((current?.revision ?? null) !== args.expectedRevision) {
      return { status: "conflict" as const, draft: current };
    }

    const fields = {
      ownerId,
      level,
      rulesVersion: args.rulesVersion,
      revision: (current?.revision ?? 0) + 1,
      updatedAt: Date.now(),
      lastSaveId: args.saveId,
    };

    if (current !== null) {
      await ctx.db.patch("drafts", current._id, fields);

      return { status: "saved" as const, draft: { ...current, ...fields } };
    }

    const id = await ctx.db.insert("drafts", fields);
    const draft = await ctx.db.get("drafts", id);
    if (draft === null) throw new Error("The inserted draft could not be read.");

    return { status: "saved" as const, draft };
  },
});

function findDraft(ctx: Pick<QueryCtx, "db">, ownerId: Id<"users">): Promise<Doc<"drafts"> | null> {
  return ctx.db
    .query("drafts")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
}

function canonicalDraft(value: unknown) {
  const template = newPlayerDungeon();

  try {
    const level = parseEditorLevel(value, template);

    // Naming is fixed in this editor; it is not a client-controlled database identity.
    return { ...level, id: template.id, name: template.name };
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : "Invalid dungeon layout.");
  }
}

function validateSaveRequest(args: {
  rulesVersion: string;
  expectedRevision: number | null;
  saveId: string;
}) {
  if (args.rulesVersion !== RULES.version) {
    throw new ConvexError("This draft uses incompatible game rules. Reload before saving.");
  }

  if (
    args.expectedRevision !== null &&
    (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 1)
  ) {
    throw new ConvexError("Expected revision must be a positive safe integer or null.");
  }

  if (args.saveId.length < 1 || args.saveId.length > 100 || args.saveId.trim() !== args.saveId) {
    throw new ConvexError(
      "Save ID must contain between 1 and 100 characters without outer spaces.",
    );
  }
}
