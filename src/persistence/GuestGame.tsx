import { useAuthActions } from "@convex-dev/auth/react";
import {
  useConvex,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api } from "../../convex/_generated/api";
import App from "../App";
import { createSession } from "../game/session";
import { createDraftSync, readDraft, type DraftSnapshot } from "./draftSync";

export function LocalGame() {
  const [session] = useState(() => createSession());
  return <App session={session} />;
}

export function GuestGame() {
  const client = useConvex();
  const { signIn } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { isWebSocketConnected } = useConvexConnectionState();
  const startedSignIn = useRef(false);
  const [initial, setInitial] = useState<DraftSnapshot | null>(null);
  const [remote, setRemote] = useState<DraftSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(false);
  const [slow, setSlow] = useState(false);
  const [reload, setReload] = useState(0);

  const enter = useCallback(async () => {
    startedSignIn.current = true;
    try {
      await signIn("anonymous");
    } catch {
      setError(
        "Could not open your guest save. Retry, or play without saving.",
      );
    }
  }, [signIn]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !startedSignIn.current && !local)
      void enter();
  }, [enter, isLoading, isAuthenticated, local]);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || local) return;
    const watch = client.watchQuery(api.dungeons.getMyDraft, {});
    function update() {
      try {
        const value = watch.localQueryResult();
        if (value === undefined) return;
        readDraft(value.draft);
        setInitial((previous) => previous ?? value);
        setRemote(value);
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your saved draft.",
        );
      }
    }
    const unsubscribe = watch.onUpdate(update);
    // onUpdate only fires for later changes; include an already cached result.
    update();
    return unsubscribe;
  }, [client, isAuthenticated, local, reload]);

  if (local) return <LocalGame />;
  if (initial && remote) {
    return (
      <SavedGame
        initial={initial}
        remote={remote}
        available={isAuthenticated && isWebSocketConnected && !error}
        error={error}
      />
    );
  }

  return (
    <main className="guest-loading">
      <span className="wordmark">
        DRILLY <b>P</b>
      </span>
      <h1>Preparing your escape.</h1>
      <p role="status">
        {error ??
          (slow
            ? "Your guest save is taking longer to open. You can keep waiting or play without saving."
            : "Opening your guest save…")}
      </p>
      {(error || slow) && (
        <button
          onClick={() => {
            setError(null);
            setReload((value) => value + 1);
            if (!isAuthenticated) void enter();
          }}
        >
          Retry
        </button>
      )}
      <button onClick={() => setLocal(true)}>Play without saving</button>
      <p className="hint">
        Guest saves belong to this browser. No sign-up needed.
      </p>
    </main>
  );
}

function SavedGame({
  initial,
  remote,
  available,
  error,
}: {
  initial: DraftSnapshot;
  remote: DraftSnapshot;
  available: boolean;
  error: string | null;
}) {
  const client = useConvex();
  const [session] = useState(() =>
    createSession({ editorLevel: readDraft(initial.draft) }),
  );
  const [sync] = useState(() =>
    createDraftSync(session, initial, (args) =>
      client.mutation(api.dungeons.saveMyDraft, args),
    ),
  );
  const save = useSyncExternalStore(sync.subscribe, sync.getSnapshot);
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => sync.start(), [sync]);
  useEffect(() => {
    sync.receive(remote);
  }, [sync, remote]);
  useEffect(() => {
    sync.setAvailable(available);
  }, [sync, available]);
  useEffect(() => {
    if (!save.dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.dirty]);

  const canLoad = ["prison", "escaped", "building"].includes(view.phase);
  const messages = {
    saved: save.hasSavedDraft
      ? "Draft saved to your guest profile."
      : "Guest save ready. Your dungeon edits will save automatically.",
    unsaved: "Draft changes waiting to save…",
    saving: "Saving draft…",
    offline:
      "Offline — changes stay in this tab until reconnected. Keep this tab open.",
    error: "Draft could not be saved. Your changes are still in this tab.",
    conflict:
      "Another tab saved a different draft. Choose which version to keep.",
    "identity-changed":
      "Your guest profile changed. Saving is paused; reload to open that profile.",
  };

  return (
    <App
      session={session}
      saving={
        <aside className="draft-save" aria-label="Guest draft save">
          <p role="status">{loadError ?? error ?? messages[save.status]}</p>
          {save.status === "error" && (
            <button disabled={!available} onClick={() => sync.retry()}>
              Retry save
            </button>
          )}
          {save.status === "conflict" && (
            <>
              <button
                disabled={save.inFlight || !canLoad}
                onClick={() => {
                  try {
                    sync.useSaved();
                    setLoadError(null);
                  } catch (cause) {
                    setLoadError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not load draft.",
                    );
                  }
                }}
              >
                Load saved draft
              </button>
              <button
                disabled={save.inFlight || !available}
                onClick={() => sync.keepLocal()}
              >
                Save this version
              </button>
              {!canLoad && (
                <small>Return to editing to load the saved draft.</small>
              )}
            </>
          )}
        </aside>
      }
    />
  );
}
