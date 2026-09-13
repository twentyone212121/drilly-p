/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newPlayerDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import type { Level } from "../../shared/game/types";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob(["../**/*.ts", "!../**/*.test.ts"]);

async function createGuest(t: TestConvex<typeof schema>) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { isAnonymous: true });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86_400_000,
    });

    return { userId, sessionId };
  });

  return {
    userId,
    client: t.withIdentity({
      subject: `${userId}|${sessionId}`,
      issuer: "https://drilly.test",
    }),
  };
}

function saveArgs(
  level = newPlayerDungeon(),
  expectedRevision: number | null = null,
  saveId = "save-1",
) {
  return { level, expectedRevision, saveId, rulesVersion: RULES.version };
}

function movedTreasure() {
  const level = newPlayerDungeon();
  level.treasures[0].x -= 8;

  return level;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T00:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("guest draft persistence", () => {
  it("reads without creating a draft, then creates, updates, and reloads it", async () => {
    const t = convexTest(schema, modules);
    const { client, userId } = await createGuest(t);
    expect(await client.query(api.dungeons.getMyDraft, {})).toEqual({
      ownerId: userId,
      draft: null,
    });

    const created = await client.mutation(api.dungeons.saveMyDraft, saveArgs());
    expect(created.status).toBe("saved");
    expect(created.draft).toMatchObject({
      ownerId: userId,
      level: newPlayerDungeon(),
      rulesVersion: RULES.version,
      revision: 1,
      updatedAt: Date.now(),
      lastSaveId: "save-1",
    });

    vi.advanceTimersByTime(1000);
    const updated = await client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(movedTreasure(), 1, "save-2"),
    );
    expect(updated.draft).toMatchObject({
      _id: created.draft?._id,
      level: movedTreasure(),
      revision: 2,
      updatedAt: Date.now(),
    });
    expect(await client.query(api.dungeons.getMyDraft, {})).toEqual({
      ownerId: userId,
      draft: updated.draft,
    });
  });

  it("keeps independent guests' drafts private", async () => {
    const t = convexTest(schema, modules);
    const first = await createGuest(t);
    const second = await createGuest(t);
    const firstSave = await first.client.mutation(api.dungeons.saveMyDraft, saveArgs());

    expect(await second.client.query(api.dungeons.getMyDraft, {})).toEqual({
      ownerId: second.userId,
      draft: null,
    });
    const secondSave = await second.client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(movedTreasure()),
    );

    expect(firstSave.draft?._id).not.toBe(secondSave.draft?._id);
    expect((await first.client.query(api.dungeons.getMyDraft, {})).draft).toEqual(firstSave.draft);
    expect((await second.client.query(api.dungeons.getMyDraft, {})).draft).toEqual(
      secondSave.draft,
    );
  });

  it("preserves ownership when the same user has another auth session", async () => {
    const t = convexTest(schema, modules);
    const { client, userId } = await createGuest(t);
    const saved = await client.mutation(api.dungeons.saveMyDraft, saveArgs());
    const sessionId = await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86_400_000,
      }),
    );
    const restored = t.withIdentity({
      subject: `${userId}|${sessionId}`,
      issuer: "https://drilly.test",
    });

    expect((await restored.query(api.dungeons.getMyDraft, {})).draft).toEqual(saved.draft);
  });

  it("rejects unauthenticated reads and writes", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.dungeons.getMyDraft, {})).rejects.toThrow("Sign in as a guest");
    await expect(t.mutation(api.dungeons.saveMyDraft, saveArgs())).rejects.toThrow(
      "Sign in as a guest",
    );
  });

  it("rejects an authenticated identity whose user no longer exists", async () => {
    const t = convexTest(schema, modules);
    const { client, userId } = await createGuest(t);
    await t.run((ctx) => ctx.db.delete("users", userId));

    await expect(client.query(api.dungeons.getMyDraft, {})).rejects.toThrow("Sign in as a guest");
    await expect(client.mutation(api.dungeons.saveMyDraft, saveArgs())).rejects.toThrow(
      "Sign in as a guest",
    );
  });

  it("rejects client-supplied owner and document IDs", async () => {
    const t = convexTest(schema, modules);
    const first = await createGuest(t);
    const second = await createGuest(t);
    const saved = await first.client.mutation(api.dungeons.saveMyDraft, saveArgs());
    // Bypass the client type guard to exercise the server's argument validator.
    const forgedRead = { ownerId: first.userId } as unknown as FunctionArgs<
      typeof api.dungeons.getMyDraft
    >;
    const forgedWrite = { ...saveArgs(), ownerId: first.userId };
    const forgedId = { ...saveArgs(), _id: saved.draft?._id };

    await expect(second.client.query(api.dungeons.getMyDraft, forgedRead)).rejects.toThrow();
    await expect(second.client.mutation(api.dungeons.saveMyDraft, forgedWrite)).rejects.toThrow();
    await expect(second.client.mutation(api.dungeons.saveMyDraft, forgedId)).rejects.toThrow();
    expect((await second.client.query(api.dungeons.getMyDraft, {})).draft).toBeNull();
    expect((await first.client.query(api.dungeons.getMyDraft, {})).draft).toEqual(saved.draft);
  });

  it("returns the owner's current draft on a stale save without changing it", async () => {
    const t = convexTest(schema, modules);
    const { client } = await createGuest(t);
    const missing = await client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(newPlayerDungeon(), 1),
    );
    expect(missing).toEqual({ status: "conflict", draft: null });

    const created = await client.mutation(api.dungeons.saveMyDraft, saveArgs());
    const staleCreate = await client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(movedTreasure(), null, "save-2"),
    );
    expect(staleCreate).toEqual({ status: "conflict", draft: created.draft });

    const updated = await client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(movedTreasure(), 1, "save-3"),
    );
    const staleUpdate = await client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(newPlayerDungeon(), 1, "save-4"),
    );
    expect(staleUpdate).toEqual({ status: "conflict", draft: updated.draft });
    expect((await client.query(api.dungeons.getMyDraft, {})).draft).toEqual(updated.draft);
  });

  it("accepts only one of two concurrent creates or updates", async () => {
    const t = convexTest(schema, modules);
    const { client } = await createGuest(t);
    const created = await Promise.all([
      client.mutation(api.dungeons.saveMyDraft, saveArgs()),
      client.mutation(api.dungeons.saveMyDraft, saveArgs(movedTreasure(), null, "other-create")),
    ]);
    expect(created.map((result) => result.status).sort()).toEqual(["conflict", "saved"]);

    const updated = await Promise.all([
      client.mutation(api.dungeons.saveMyDraft, saveArgs(newPlayerDungeon(), 1, "first-update")),
      client.mutation(api.dungeons.saveMyDraft, saveArgs(movedTreasure(), 1, "second-update")),
    ]);
    expect(updated.map((result) => result.status).sort()).toEqual(["conflict", "saved"]);
    expect((await client.query(api.dungeons.getMyDraft, {})).draft?.revision).toBe(2);
  });

  it("retries the last accepted save without advancing its revision or timestamp", async () => {
    const t = convexTest(schema, modules);
    const { client } = await createGuest(t);
    const first = await client.mutation(api.dungeons.saveMyDraft, saveArgs());
    vi.advanceTimersByTime(1000);

    expect(await client.mutation(api.dungeons.saveMyDraft, saveArgs())).toEqual(first);
    const updatedArgs = saveArgs(movedTreasure(), 1, "save-2");
    const updated = await client.mutation(api.dungeons.saveMyDraft, updatedArgs);
    vi.advanceTimersByTime(1000);
    expect(await client.mutation(api.dungeons.saveMyDraft, updatedArgs)).toEqual(updated);
  });

  it("rejects retry IDs reused for different content and cannot roll back a newer save", async () => {
    const t = convexTest(schema, modules);
    const { client } = await createGuest(t);
    await client.mutation(api.dungeons.saveMyDraft, saveArgs());

    await expect(
      client.mutation(api.dungeons.saveMyDraft, saveArgs(movedTreasure())),
    ).rejects.toThrow("save ID cannot be reused");
    const updated = await client.mutation(
      api.dungeons.saveMyDraft,
      saveArgs(movedTreasure(), 1, "save-2"),
    );
    expect(await client.mutation(api.dungeons.saveMyDraft, saveArgs())).toEqual({
      status: "conflict",
      draft: updated.draft,
    });
  });

  it("allows unfinished drafts with no treasures and stores fixed editor naming", async () => {
    const t = convexTest(schema, modules);
    const { client } = await createGuest(t);
    const level = {
      ...newPlayerDungeon(),
      id: "client-id",
      name: "Client title",
      treasures: [],
    };
    const saved = await client.mutation(api.dungeons.saveMyDraft, saveArgs(level));

    expect(saved.draft?.level).toEqual({
      ...level,
      id: "player-dungeon",
      name: "Your vault",
    });
  });
});

describe("draft placement validation", () => {
  const invalidLayouts: [string, (level: Level) => void, string][] = [
    [
      "out of bounds platform",
      (level) => {
        level.platforms[0].width = level.width;
      },
      "must fit inside",
    ],
    [
      "out of bounds saw radius",
      (level) => {
        level.traps = [{ id: "saw", x: 5, y: 200, radius: 24 }];
      },
      "must fit inside",
    ],
    [
      "platform on spawn",
      (level) => {
        level.platforms.push({
          id: "blocked",
          x: level.spawn.x,
          y: level.spawn.y,
          width: 24,
          height: 28,
        });
      },
      "spawn clear",
    ],
    [
      "saw on spawn",
      (level) => {
        level.traps = [{ id: "saw", x: level.spawn.x, y: level.spawn.y, radius: 24 }];
      },
      "spawn clear",
    ],
    [
      "treasure on spawn",
      (level) => {
        level.treasures[0].x = level.spawn.x;
      },
      "spawn clear",
    ],
    [
      "changed room",
      (level) => {
        level.width += 8;
      },
      "dimensions and player spawn are fixed",
    ],
    [
      "changed spawn",
      (level) => {
        level.spawn.x += 8;
      },
      "dimensions and player spawn are fixed",
    ],
    [
      "duplicate IDs",
      (level) => {
        level.treasures[0].id = level.platforms[0].id;
      },
      "ids must be unique",
    ],
    [
      "platform limit",
      (level) => {
        level.platforms = Array.from({ length: RULES.editor.maxPlatforms + 1 }, (_, i) => ({
          ...level.platforms[0],
          id: `platform-${i}`,
        }));
      },
      "Platform limit",
    ],
    [
      "saw limit",
      (level) => {
        level.traps = Array.from({ length: RULES.editor.maxSaws + 1 }, (_, i) => ({
          id: `saw-${i}`,
          x: 300,
          y: 200,
          radius: 24,
        }));
      },
      "Saw limit",
    ],
    [
      "treasure limit",
      (level) => {
        level.treasures = Array.from({ length: RULES.editor.maxTreasures + 1 }, (_, i) => ({
          ...level.treasures[0],
          id: `treasure-${i}`,
        }));
      },
      "Treasure limit",
    ],
    [
      "non-finite geometry",
      (level) => {
        level.platforms[0].x = NaN;
      },
      "Invalid",
    ],
  ];

  it.each(invalidLayouts)(
    "rejects %s without changing an existing draft",
    async (_name, edit, message) => {
      const t = convexTest(schema, modules);
      const { client } = await createGuest(t);
      const initial = await client.mutation(api.dungeons.saveMyDraft, saveArgs());
      const level = newPlayerDungeon();
      edit(level);

      await expect(
        client.mutation(api.dungeons.saveMyDraft, saveArgs(level, 1, "bad-save")),
      ).rejects.toThrow(message);
      expect((await client.query(api.dungeons.getMyDraft, {})).draft).toEqual(initial.draft);
    },
  );

  it("rejects incompatible rules and level versions", async () => {
    const t = convexTest(schema, modules);
    const { client } = await createGuest(t);
    await expect(
      client.mutation(api.dungeons.saveMyDraft, {
        ...saveArgs(),
        rulesVersion: "old-rules",
      }),
    ).rejects.toThrow("incompatible game rules");
    const level = { ...newPlayerDungeon(), version: 1 } as unknown as Level;
    await expect(client.mutation(api.dungeons.saveMyDraft, saveArgs(level))).rejects.toThrow();
    expect((await client.query(api.dungeons.getMyDraft, {})).draft).toBeNull();
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid expected revision %s",
    async (revision) => {
      const t = convexTest(schema, modules);
      const { client } = await createGuest(t);

      await expect(
        client.mutation(api.dungeons.saveMyDraft, saveArgs(newPlayerDungeon(), revision)),
      ).rejects.toThrow("positive safe integer");
    },
  );

  it.each(["", " ", " trailing ", "x".repeat(101)])(
    "rejects invalid save ID %j",
    async (saveId) => {
      const t = convexTest(schema, modules);
      const { client } = await createGuest(t);

      await expect(
        client.mutation(api.dungeons.saveMyDraft, saveArgs(newPlayerDungeon(), null, saveId)),
      ).rejects.toThrow("Save ID must contain");
    },
  );
});

it("stores obstacle configuration intact and keeps it private to its owner", async () => {
  const t = convexTest(schema, modules);
  const { client } = await createGuest(t);
  const { client: other } = await createGuest(t);
  const level = newPlayerDungeon();
  level.obstacles = [
    { id: "spikes", kind: "spikes", x: 300, y: 300, width: 48, height: 20 },
    { id: "slider", kind: "slider", x: 300, y: 200, endX: 400, endY: 200, radius: 18, speed: 90 },
    { id: "drone", kind: "drone", x: 500, y: 200, endX: 600, endY: 200, radius: 18, speed: 90 },
    {
      id: "gun",
      kind: "turret",
      x: 700,
      y: 180,
      radius: 18,
      mode: "aimed",
      direction: -1,
      intervalTicks: 150,
      warmupTicks: 45,
      activeTicks: 45,
      range: 240,
      projectileSpeed: 220,
    },
    {
      id: "chase",
      kind: "pursuer",
      x: 200,
      y: 120,
      radius: 18,
      speed: 150,
      detectionRange: 160,
      chaseRange: 320,
      warningTicks: 30,
    },
  ];
  const saved = await client.mutation(api.dungeons.saveMyDraft, saveArgs(level));
  expect(saved.draft?.level.obstacles).toEqual(level.obstacles);
  expect((await client.query(api.dungeons.getMyDraft, {})).draft?.level.obstacles).toEqual(
    level.obstacles,
  );
  expect((await other.query(api.dungeons.getMyDraft, {})).draft).toBeNull();
  const invalid = structuredClone(level);
  const gun = invalid.obstacles![3];
  if (gun.kind === "turret") gun.warmupTicks = gun.intervalTicks;
  await expect(
    client.mutation(api.dungeons.saveMyDraft, saveArgs(invalid, 1, "bad")),
  ).rejects.toThrow();
  expect((await client.query(api.dungeons.getMyDraft, {})).draft?.revision).toBe(1);
});
