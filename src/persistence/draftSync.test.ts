import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newPlayerDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import { createSession } from "../game/session";
import {
  createDraftSync,
  DRAFT_SAVE_DELAY_MS,
  readDraft,
  type SavedDraft,
  type SaveDraft,
  type SaveResult,
} from "./draftSync";

function draft(revision = 1): SavedDraft {
  return {
    level: newPlayerDungeon(),
    rulesVersion: RULES.version,
    revision,
    lastSaveId: `save-${revision}`,
  };
}

function saved(args: SaveDraft): SaveResult {
  return {
    status: "saved",
    draft: {
      level: structuredClone(args.level),
      rulesVersion: args.rulesVersion,
      revision: (args.expectedRevision ?? 0) + 1,
      lastSaveId: args.saveId,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const cleanup: (() => void)[] = [];
function setup(
  initial: SavedDraft | null = draft(),
  save = vi.fn(async (args: SaveDraft) => saved(args)),
) {
  const session = createSession({ editorLevel: readDraft(initial) });
  for (const tick of [44, 193, 228]) {
    session.step(tick - session.frameState().tick);
    session.jump();
    session.step();
  }
  session.step(RULES.maxTicks);
  session.editDungeon();
  const sync = createDraftSync(
    session,
    { ownerId: "guest-1", draft: initial },
    save,
  );
  cleanup.push(sync.start());
  sync.setAvailable(true);
  function move(x: number) {
    session.edit({
      type: "put",
      object: {
        kind: "treasure",
        value: {
          ...session.getSnapshot().editorLevel.treasures[0],
          x,
          y: 380,
        },
      },
    });
  }
  return { session, sync, save, move };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup.splice(0).forEach((stop) => stop());
  vi.useRealTimers();
});

describe("guest draft synchronization", () => {
  it("loads an existing layout without writing, and never saves defaults on first read", async () => {
    const existing = draft();
    existing.level.treasures = [];
    const first = setup(existing);
    const fresh = setup(null);
    await vi.runAllTimersAsync();
    expect(first.session.getSnapshot().editorLevel.treasures).toEqual([]);
    expect(first.save).not.toHaveBeenCalled();
    expect(fresh.save).not.toHaveBeenCalled();
    expect(first.session.getSnapshot().canSubmit).toBe(false);
  });

  it("coalesces accepted geometry edits and ignores simulation, testing, and no-ops", async () => {
    const { session, sync, save, move } = setup();
    session.testDungeon();
    session.step(20);
    session.editDungeon();
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    move(600);
    await vi.advanceTimersByTimeAsync(300);
    move(580);
    await vi.advanceTimersByTimeAsync(300);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      expectedRevision: 1,
      level: { treasures: [{ x: 580 }] },
    });
    expect(sync.getSnapshot()).toMatchObject({ status: "saved", dirty: false });
    move(580);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("sends edits made during a pending save only after its acknowledgement", async () => {
    const first = deferred<SaveResult>();
    const save = vi
      .fn(async (args: SaveDraft) => saved(args))
      .mockImplementationOnce(() => first.promise);
    const { sync, move } = setup(draft(), save);
    move(600);
    await vi.runAllTimersAsync();
    move(580);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].level.treasures[0].x).toBe(600);
    first.resolve(saved(save.mock.calls[0][0]));
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      expectedRevision: 2,
      level: { treasures: [{ x: 580 }] },
    });
    expect(sync.getSnapshot().dirty).toBe(false);
  });

  it("retries an uncertain save with the same ID and payload before saving newer edits", async () => {
    const save = vi
      .fn(async (args: SaveDraft) => saved(args))
      .mockRejectedValueOnce(new Error("offline"));
    const { sync, move } = setup(draft(), save);
    move(600);
    await vi.runAllTimersAsync();
    expect(sync.getSnapshot().status).toBe("error");
    move(580);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
    sync.retry();
    await vi.runAllTimersAsync();
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
    expect(save.mock.calls[2][0]).toMatchObject({
      expectedRevision: 2,
      level: { treasures: [{ x: 580 }] },
    });
    expect(sync.getSnapshot().status).toBe("saved");
  });

  it("keeps offline edits in the session and resumes saving on reconnection", async () => {
    const { sync, save, move } = setup();
    sync.setAvailable(false);
    move(600);
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    expect(sync.getSnapshot().status).toBe("offline");
    sync.setAvailable(true);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("preserves local edits on a cross-tab conflict until the player chooses a version", async () => {
    const { session, sync, save, move } = setup();
    move(600);
    const other = draft(2);
    other.level.treasures = [];
    sync.receive({ ownerId: "guest-1", draft: other });
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    expect(session.getSnapshot().editorLevel.treasures[0].x).toBe(600);
    expect(sync.getSnapshot().status).toBe("conflict");
    sync.useSaved();
    await vi.runAllTimersAsync();
    expect(session.getSnapshot().editorLevel.treasures).toEqual([]);
    expect(sync.getSnapshot()).toMatchObject({ status: "saved", dirty: false });
    expect(save).not.toHaveBeenCalled();
  });

  it("uses the latest revision for an explicitly chosen local version", async () => {
    const { sync, save, move } = setup();
    move(600);
    sync.receive({ ownerId: "guest-1", draft: draft(4) });
    sync.keepLocal();
    await vi.runAllTimersAsync();
    expect(save.mock.calls[0][0].expectedRevision).toBe(4);
    expect(sync.getSnapshot().status).toBe("saved");
  });

  it("handles a mutation conflict even before a subscription sees the other tab", async () => {
    const save = vi.fn(async (_args: SaveDraft): Promise<SaveResult> => ({
      status: "conflict",
      draft: draft(3),
    }));
    const { sync, move } = setup(draft(), save);
    move(600);
    await vi.runAllTimersAsync();
    expect(sync.getSnapshot().status).toBe("conflict");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not mistake its own subscription update for a conflict or erase a later conflict", async () => {
    const response = deferred<SaveResult>();
    const save = vi.fn((_args: SaveDraft) => response.promise);
    const { sync, move } = setup(draft(), save);
    move(600);
    await vi.runAllTimersAsync();
    const result = saved(save.mock.calls[0][0]);
    sync.receive({ ownerId: "guest-1", draft: result.draft });
    expect(sync.getSnapshot().status).toBe("saving");
    sync.receive({ ownerId: "guest-1", draft: draft(3) });
    response.resolve(result);
    await vi.runAllTimersAsync();
    expect(sync.getSnapshot().status).toBe("conflict");
    sync.keepLocal();
    expect(save.mock.calls[1][0].expectedRevision).toBe(3);
  });

  it("pauses writes on an identity change without copying the draft to the new guest", async () => {
    const { session, sync, save, move } = setup();
    move(600);
    sync.receive({ ownerId: "guest-2", draft: null });
    sync.keepLocal();
    sync.retry();
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
    expect(sync.getSnapshot().status).toBe("identity-changed");
    expect(session.getSnapshot().editorLevel.treasures[0].x).toBe(600);
  });

  it("cancels pending debounce work when the game unmounts", async () => {
    const { move, save } = setup();
    move(600);
    cleanup.pop()!();
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects incompatible or invalid saved geometry instead of replacing it with defaults", () => {
    expect(() =>
      readDraft({ ...draft(), rulesVersion: "older-rules" }),
    ).toThrow("different game rules");
    const invalid = draft();
    invalid.level.width += 20;
    expect(() => readDraft(invalid)).toThrow("fixed");
  });
});
