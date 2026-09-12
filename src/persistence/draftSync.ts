import { newPlayerDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import type { Level } from "../../shared/game/types";
import { parseEditorLevel } from "../../shared/validation";
import type { Session } from "../game/session";

// Provisional: coalesce dragging/nudging without writing on every simulation tick.
export const DRAFT_SAVE_DELAY_MS = 500;

export type SavedDraft = {
  level: Level;
  rulesVersion: string;
  revision: number;
  lastSaveId: string;
};
export type DraftSnapshot = { ownerId: string; draft: SavedDraft | null };
export type SaveDraft = {
  level: Level;
  rulesVersion: string;
  expectedRevision: number | null;
  saveId: string;
};
export type SaveResult =
  | { status: "saved"; draft: SavedDraft }
  | { status: "conflict"; draft: SavedDraft | null };
type Status =
  | "saved"
  | "unsaved"
  | "saving"
  | "offline"
  | "error"
  | "conflict"
  | "identity-changed";

export function readDraft(draft: SavedDraft | null): Level {
  if (draft && draft.rulesVersion !== RULES.version) {
    throw new Error(
      "Your saved draft uses different game rules. It has been kept unchanged.",
    );
  }

  return parseEditorLevel(
    draft?.level ?? newPlayerDungeon(),
    newPlayerDungeon(),
  );
}

// Coordinates layout writes only. Session/attempt state never depends on network timing.
export function createDraftSync(
  session: Session,
  initial: DraftSnapshot,
  save: (args: SaveDraft) => Promise<SaveResult>,
) {
  let remote = initial.draft;
  let savedLocalRevision = session.getSnapshot().layoutRevision;
  let available = false;
  let blocked: "error" | "conflict" | "identity-changed" | null = null;
  let pending: { args: SaveDraft; localRevision: number } | null = null;
  let inFlight = false;
  let restoring = false;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  let snapshot = makeSnapshot();

  function dirty() {
    return savedLocalRevision !== session.getSnapshot().layoutRevision;
  }

  function makeSnapshot() {
    const status: Status =
      blocked ??
      (!available && (dirty() || pending)
        ? "offline"
        : inFlight
          ? "saving"
          : dirty()
            ? "unsaved"
            : "saved");
    return {
      status,
      dirty: dirty() || pending !== null,
      inFlight,
      hasSavedDraft: remote !== null,
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function schedule() {
    clearTimeout(timer);
    if (active && available && !blocked && !inFlight && dirty()) {
      timer = setTimeout(() => {
        void flush();
      }, DRAFT_SAVE_DELAY_MS);
    }
    notify();
  }

  async function flush() {
    if (!active || !available || blocked || inFlight || (!dirty() && !pending))
      return;

    pending ??= {
      args: {
        level: session.getSnapshot().editorLevel,
        rulesVersion: RULES.version,
        expectedRevision: remote?.revision ?? null,
        saveId: crypto.randomUUID(),
      },
      localRevision: session.getSnapshot().layoutRevision,
    };
    const request = pending;
    inFlight = true;
    notify();

    try {
      const result = await save(request.args);
      if (!active) return;

      // A subscription may already have observed a later write from another tab.
      if ((result.draft?.revision ?? 0) >= (remote?.revision ?? 0))
        remote = result.draft;
      pending = null;
      if (result.status === "conflict") {
        if (blocked !== "identity-changed") blocked = "conflict";
      } else {
        savedLocalRevision = request.localRevision;
      }
    } catch {
      // Keep the exact request ID and payload: the server may have saved before disconnecting.
      blocked ??= "error";
    } finally {
      inFlight = false;
      if (active) schedule();
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(this: void, fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    start() {
      active = true;
      let revision = session.getSnapshot().layoutRevision;
      unsubscribe = session.subscribe(() => {
        const next = session.getSnapshot().layoutRevision;
        if (revision === next) return;
        revision = next;
        if (!restoring) schedule();
      });
      schedule();
      return () => {
        active = false;
        clearTimeout(timer);
        unsubscribe?.();
      };
    },
    setAvailable(value: boolean) {
      if (available === value) return;
      available = value;
      schedule();
    },
    receive(value: DraftSnapshot) {
      if (value.ownerId !== initial.ownerId) {
        blocked = "identity-changed";
      } else if ((value.draft?.revision ?? 0) > (remote?.revision ?? 0)) {
        remote = value.draft;
        if (
          remote?.lastSaveId !== pending?.args.saveId &&
          blocked !== "identity-changed"
        ) {
          blocked = "conflict";
        }
      }
      schedule();
    },
    retry() {
      if (blocked !== "error" || inFlight) return;
      blocked = null;
      void flush();
    },
    useSaved() {
      if (blocked !== "conflict" || inFlight) return;
      const level = readDraft(remote);
      restoring = true;
      try {
        session.replaceDraft(level);
      } finally {
        restoring = false;
      }
      pending = null;
      savedLocalRevision = session.getSnapshot().layoutRevision;
      blocked = null;
      schedule();
    },
    keepLocal() {
      if (blocked !== "conflict" || inFlight) return;
      pending = null;
      blocked = null;
      // An explicit overwrite still checks the latest known server revision.
      savedLocalRevision = -1;
      void flush();
    },
  };
}
