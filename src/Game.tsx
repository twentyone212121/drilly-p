import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import App from "./App";
import { GameSprite } from "./components/GameArt";
import { createDrillySource } from "./ai/drillySource";
import { createSession } from "./game/session";
import {
  loadTutorialCompleted,
  saveTutorialCompleted,
} from "./persistence/tutorial";
import {
  loadModel,
  loadDungeon,
  loadDungeonClear,
  persistDungeon,
} from "./persistence/dungeon";

export function LocalGame() {
  const [session] = useState(() =>
    createSession({
      editorLevel: loadDungeon(),
      playerClear: loadDungeonClear(),
      model: loadModel(),
      tutorialCompleted: loadTutorialCompleted(),
      onTutorialCompleted: saveTutorialCompleted,
    }),
  );
  useEffect(() => persistDungeon(session), [session]);
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
    <main className="connection-screen">
      <GameSprite name="drilly" />
      <h1>Connecting to Drilly.</h1>
      <p role="status">{error ?? "Opening your game…"}</p>
      {error && (
        <button className="game-button primary" onClick={() => void connect()}>
          Retry connection
        </button>
      )}
    </main>
  );
}

function ConnectedGame() {
  const client = useConvex();
  const [session] = useState(() =>
    createSession({
      drilly: createDrillySource(client),
      editorLevel: loadDungeon(),
      playerClear: loadDungeonClear(),
      model: loadModel(),
      tutorialCompleted: loadTutorialCompleted(),
      onTutorialCompleted: saveTutorialCompleted,
    }),
  );
  useEffect(() => persistDungeon(session), [session]);
  useEffect(() => {
    session.prepareRoom();
  }, [session]);
  return <App session={session} />;
}
