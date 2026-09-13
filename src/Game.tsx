import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import App from "./App";
import { createDrillySource } from "./ai/drillySource";
import { createLocalDrillySource } from "./ai/localDrillySource";
import { createSession } from "./game/session";

export function LocalGame() {
  const [session] = useState(() =>
    createSession({
      drilly: import.meta.env.VITE_LOCAL_DRILLY
        ? createLocalDrillySource()
        : undefined,
    }),
  );
  return <App session={session} />;
}

export function GuestGame() {
  const { signIn } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    started.current = true;
    setError(null);
    try {
      await signIn("anonymous");
    } catch {
      setError(
        "Could not connect to Drilly. Check that Convex is running and retry.",
      );
    }
  }, [signIn]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !started.current) void connect();
  }, [connect, isLoading, isAuthenticated]);

  if (isAuthenticated) return <ConnectedGame />;

  return (
    <main className="guest-loading">
      <span className="wordmark">
        DRILLY <b>P</b>
      </span>
      <h1>Connecting to Drilly.</h1>
      <p role="status">{error ?? "Opening your game…"}</p>
      {error && (
        <button onClick={() => void connect()}>Retry connection</button>
      )}
    </main>
  );
}

function ConnectedGame() {
  const client = useConvex();
  const [session] = useState(() =>
    createSession({ drilly: createDrillySource(client) }),
  );
  return <App session={session} />;
}
