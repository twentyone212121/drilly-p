import { getDungeon, getPrison, newPlayerDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import type { Level, Replay } from "../../shared/game/types";
import { parseEditorLevel, parseJumpTicks, parseLevel, parseReplay } from "../../shared/validation";
import { createAttempt } from "./attempt";
import { applyEdit, type Edit } from "./editor";

type Activity = "prison" | "testing" | "raiding";
type Flow =
  | { phase: "prison" }
  | { phase: "escaped" }
  | { phase: "building" }
  | { phase: "testing"; revision: number }
  | { phase: "cleared" }
  | { phase: "raiding" }
  | { phase: "raid-complete" }
  | { phase: "replay"; returnTo: Activity };

type Clear = { revision: number; replay: Replay };

// The attempt owns the clock and input. The session owns progression and layout versions.
export function createSession(
  options: {
    prisonLevel?: Level;
    opponentLevel?: Level;
    editorLevel?: Level;
  } = {},
) {
  const prison = parseLevel(options.prisonLevel ?? getPrison());
  const opponent = parseLevel(options.opponentLevel ?? getDungeon("first-vault"));
  const attempt = createAttempt(prison);
  let editorLevel = parseEditorLevel(options.editorLevel ?? newPlayerDungeon(), newPlayerDungeon());
  let flow: Flow = { phase: "prison" };
  let layoutRevision = 0;
  let levelRevision = 0;
  let prisonClear: Replay | null = null;
  let clear: Clear | null = null;
  let submission: Clear | null = null;
  const listeners = new Set<() => void>();
  let snapshot = makeSnapshot();

  function canSubmit() {
    return (
      (flow.phase === "building" || flow.phase === "testing" || flow.phase === "cleared") &&
      clear !== null &&
      clear.revision === layoutRevision
    );
  }

  function makeSnapshot() {
    return {
      ...attempt.getSnapshot(),
      flow: { ...flow },
      phase: flow.phase,
      editorLevel: structuredClone(editorLevel),
      layoutRevision,
      clearedRevision: clear?.revision ?? null,
      prisonEscaped: prisonClear !== null,
      canSubmit: canSubmit(),
      submission: structuredClone(submission),
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function isPlaying() {
    return (
      flow.phase === "prison" ||
      flow.phase === "testing" ||
      flow.phase === "raiding" ||
      flow.phase === "replay"
    );
  }

  function currentActivity(): Activity | null {
    switch (flow.phase) {
      case "prison":
      case "escaped":
        return "prison";
      case "testing":
      case "cleared":
        return "testing";
      case "raiding":
      case "raid-complete":
        return "raiding";
      case "replay":
        return flow.returnTo;
      case "building":
        return null;
    }
  }

  function activityLevel(activity: Activity) {
    switch (activity) {
      case "prison":
        return prison;
      case "testing":
        return editorLevel;
      case "raiding":
        return opponent;
    }
  }

  function startAttempt(activity: Activity) {
    // Validate before changing flow; an unfinished draft may have no treasures.
    const level = parseLevel(activityLevel(activity));
    flow =
      activity === "testing" ? { phase: activity, revision: layoutRevision } : { phase: activity };
    levelRevision++;
    attempt.loadLevel(level);
  }

  function editDungeon() {
    if (!prisonClear) throw new Error("Escape the prison before building your dungeon.");

    flow = { phase: "building" };
    levelRevision++;
    // The editor renders its own draft, which need not be a playable level yet.
    attempt.reset();
  }

  function testDungeon() {
    if (flow.phase !== "building" && flow.phase !== "testing" && flow.phase !== "cleared") {
      throw new Error("Return to building before testing your dungeon.");
    }

    startAttempt("testing");
  }

  function submitDungeon() {
    if (!canSubmit() || !clear)
      throw new Error("Clear the current dungeon version before submitting.");

    // The proof includes the exact submitted geometry and cannot change with later edits.
    submission = structuredClone(clear);
    startAttempt("raiding");
  }

  function reset() {
    if (flow.phase === "building" || flow.phase === "escaped") return;

    const activity = currentActivity();
    if (activity) startAttempt(activity);
  }

  attempt.subscribe(() => {
    const view = attempt.getSnapshot();
    if (view.mode === "human" && view.state.status === "won") {
      switch (flow.phase) {
        case "prison":
          prisonClear = attempt.exportReplay();
          flow = { phase: "escaped" };
          break;
        case "testing":
          if (flow.revision === layoutRevision) {
            clear = {
              revision: layoutRevision,
              replay: attempt.exportReplay(),
            };
            flow = { phase: "cleared" };
          }
          break;
        case "raiding":
          flow = { phase: "raid-complete" };
          break;
      }
    }
    notify();
  });

  return {
    get level() {
      return flow.phase === "building" ? structuredClone(editorLevel) : attempt.level;
    },
    get levelRevision() {
      return levelRevision;
    },
    frameState: attempt.frameState,
    getSnapshot: () => snapshot,
    observe: () => structuredClone(makeSnapshot()),
    trajectory: attempt.trajectory,
    exportReplay: attempt.exportReplay,
    onEvents: attempt.onEvents,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    edit(change: Edit) {
      if (flow.phase !== "building")
        throw new Error("Return to editing before changing the dungeon.");

      const candidate = applyEdit(editorLevel, change);
      if (JSON.stringify(candidate) === JSON.stringify(editorLevel)) return;

      editorLevel = candidate;
      layoutRevision++;
      levelRevision++;
      clear = null;
      notify();
    },
    editDungeon,
    replaceDraft(value: unknown) {
      if (flow.phase !== "building" && flow.phase !== "prison" && flow.phase !== "escaped") {
        throw new Error("Return to editing before loading a saved draft.");
      }

      const level = parseEditorLevel(value, newPlayerDungeon());
      editorLevel = level;
      layoutRevision++;
      levelRevision++;
      clear = null;
      notify();
    },
    testDungeon,
    submitDungeon,
    reset,

    primaryAction() {
      switch (flow.phase) {
        case "building":
          return;
        case "escaped":
        case "raid-complete":
          editDungeon();
          return;
        case "cleared":
          submitDungeon();
          return;
      }

      if (attempt.getSnapshot().finished) reset();
      attempt.primaryAction();
    },
    jump() {
      if (isPlaying()) attempt.jump();
    },
    play() {
      if (isPlaying()) attempt.play();
    },
    pause: attempt.pause,
    step(ticks = 1) {
      if (isPlaying()) attempt.step(ticks);
    },
    update(deltaMs: number) {
      if (isPlaying()) attempt.update(deltaMs);
    },

    loadSchedule(ticks: unknown) {
      const jumpTicks = parseJumpTicks(ticks);
      const activity = currentActivity();
      if (!activity) throw new Error("Start an attempt before loading a schedule.");

      const replay = parseReplay({
        version: 2,
        rulesVersion: RULES.version,
        level: activityLevel(activity),
        jumpTicks,
        endTick: RULES.maxTicks,
      });
      flow = { phase: "replay", returnTo: activity };
      levelRevision++;
      attempt.loadReplay(replay);
    },
    loadReplay(value: unknown) {
      const replay = parseReplay(value);
      const activity = currentActivity();
      if (!activity) throw new Error("Start an attempt before loading a replay.");

      flow = { phase: "replay", returnTo: activity };
      levelRevision++;
      attempt.loadReplay(replay);
    },
  };
}

export type Session = ReturnType<typeof createSession>;
export type SessionSnapshot = ReturnType<Session["getSnapshot"]>;
