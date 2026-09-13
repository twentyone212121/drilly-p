import { getObstacleLab, type LabRoomId } from "../../shared/game/obstacleLab";
import { getDungeon, getPrison, newPlayerDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import type { Level, Replay } from "../../shared/game/types";
import { parseEditorLevel, parseJumpTicks, parseLevel, parseReplay } from "../../shared/validation";
import { createAttempt } from "./attempt";
import { applyEdit, type Edit } from "./editor";

import { scoreRound, type RaidAttempt } from "../../shared/game/round";
import { runDrillyFixture } from "./drillyFixture";

type Activity = "prison" | "testing" | "raiding" | "lab";
type Flow =
  | { phase: "prison" }
  | { phase: "lab" }
  | { phase: "escaped" }
  | { phase: "building" }
  | { phase: "testing"; revision: number }
  | { phase: "cleared" }
  | { phase: "raiding" }
  | { phase: "raid-complete" }
  | { phase: "ghost"; index: number }
  | { phase: "results" }
  | { phase: "replay"; returnTo: Activity };

type Clear = { revision: number; replay: Replay };

// The attempt owns the clock and input. The session owns progression and layout versions.
export function createSession(
  options: {
    prisonLevel?: Level;
    opponentLevel?: Level;
    editorLevel?: Level;
    developmentFixture?: boolean;
  } = {},
) {
  const prison = parseLevel(options.prisonLevel ?? getPrison());
  const opponent = parseLevel(options.opponentLevel ?? getDungeon("first-vault"));
  const attempt = createAttempt(prison);
  let editorLevel = parseEditorLevel(options.editorLevel ?? newPlayerDungeon(), newPlayerDungeon());
  let flow: Flow = { phase: "prison" };
  let labRoom: LabRoomId = "showcase";
  let labReturn: "prison" | "escaped" | "building" = "prison";
  let layoutRevision = 0;
  let levelRevision = 0;
  let prisonClear: Replay | null = null;
  let clear: Clear | null = null;
  let submission: Clear | null = null;
  let fixture = options.developmentFixture ?? false;
  let roundId = 0;
  let round: {
    id: number;
    fixture: boolean;
    human: RaidAttempt[];
    drilly: RaidAttempt[];
  } | null = null;
  let result: ReturnType<typeof scoreRound> | null = null;
  let best: number | null = null;
  let recordedAttempt = false;
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
      round: structuredClone(round),
      result: structuredClone(result),
      best,
      developmentFixture: fixture,
      labRoom,
      inLab: flow.phase === "lab" || (flow.phase === "replay" && flow.returnTo === "lab"),
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function isPlaying() {
    return (
      flow.phase === "lab" ||
      flow.phase === "prison" ||
      flow.phase === "testing" ||
      flow.phase === "raiding" ||
      flow.phase === "replay" ||
      flow.phase === "ghost"
    );
  }

  function currentActivity(): Activity | null {
    switch (flow.phase) {
      case "lab":
        return "lab";
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
      case "ghost":
      case "results":
        return null;
    }
  }

  function activityLevel(activity: Activity) {
    switch (activity) {
      case "lab":
        return getObstacleLab(labRoom);
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
    recordedAttempt = false;
    attempt.loadLevel(level);
  }

  function editDungeon() {
    if (!prisonClear) throw new Error("Escape the prison before building your dungeon.");

    roundId++;
    round = null;
    result = null;
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
    round = { id: ++roundId, fixture, human: [], drilly: [] };
    result = null;
    startAttempt("raiding");
  }

  function reset() {
    if (
      flow.phase === "building" ||
      flow.phase === "escaped" ||
      flow.phase === "raid-complete" ||
      flow.phase === "results"
    )
      return;

    if (flow.phase === "ghost") {
      showGhost(flow.index);
      return;
    }
    if (flow.phase === "raiding") {
      recordRaid("restart");
      if (flow.phase !== "raiding") {
        notify();
        return;
      }
    }
    const activity = currentActivity();
    if (activity) startAttempt(activity);
  }

  function recordRaid(outcome: RaidAttempt["outcome"]) {
    if (!round) {
      flow = { phase: "raid-complete" };
      return;
    }
    if (recordedAttempt) return;
    recordedAttempt = true;
    round.human.push({ replay: attempt.exportReplay(), outcome });
    if (outcome === "won" || round.human.length >= RULES.raidAttempts) {
      flow = { phase: "raid-complete" };
      if (round.fixture && submission) {
        const id = round.id;
        const level = structuredClone(submission.replay.level);
        void Promise.resolve().then(() => receiveDrilly(id, runDrillyFixture(level)));
      }
    }
  }

  function receiveDrilly(id: number, attempts: RaidAttempt[]) {
    if (!round || round.id !== id || round.drilly.length || !round.fixture) return;
    round.drilly = structuredClone(attempts);
    notify();
  }

  function showGhost(index: number) {
    if (!round?.drilly[index]) return;
    flow = { phase: "ghost", index };
    levelRevision++;
    attempt.loadReplay(round.drilly[index].replay);
  }

  function showResults() {
    if (!round?.drilly.length) return;
    if (!result) {
      result = scoreRound(round.human, round.drilly, best);
      best = result.best;
    }
    flow = { phase: "results" };
    notify();
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
          recordRaid("won");
          break;
      }
    }
    if (flow.phase === "raiding" && view.mode === "human" && view.finished) {
      recordRaid(view.state.status === "dead" ? "dead" : "tick-limit");
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
    setDevelopmentFixture(enabled: boolean) {
      if (flow.phase !== "building") return;
      fixture = enabled;
      notify();
    },
    replayGhost() {
      showGhost(0);
    },
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
    openLab(id: LabRoomId = "showcase") {
      const inLab = flow.phase === "lab" || (flow.phase === "replay" && flow.returnTo === "lab");
      if (!inLab) {
        if (flow.phase !== "prison" && flow.phase !== "escaped" && flow.phase !== "building")
          return;
        labReturn = flow.phase;
      }
      // Validate before changing the selected room or attempt.
      getObstacleLab(id);
      labRoom = id;
      startAttempt("lab");
    },
    exitLab() {
      if (flow.phase !== "lab" && !(flow.phase === "replay" && flow.returnTo === "lab")) return;
      if (labReturn === "prison") startAttempt("prison");
      else {
        flow = { phase: labReturn };
        levelRevision++;
        attempt.loadLevel(prison);
      }
    },
    testDungeon,
    submitDungeon,
    reset,

    primaryAction() {
      switch (flow.phase) {
        case "building":
          return;
        case "escaped":
        case "results":
          editDungeon();
          return;
        case "raid-complete":
          if (round?.drilly.length) showGhost(0);
          else if (!round?.fixture) editDungeon();
          return;
        case "ghost":
          if (!attempt.getSnapshot().finished) {
            attempt.play();
            return;
          }
          if (round && flow.index + 1 < round.drilly.length) showGhost(flow.index + 1);
          else showResults();
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
      round = null;
      result = null;
      flow = { phase: "replay", returnTo: activity };
      levelRevision++;
      attempt.loadReplay(replay);
    },
    loadReplay(value: unknown) {
      const replay = parseReplay(value);
      const activity = currentActivity();
      if (!activity) throw new Error("Start an attempt before loading a replay.");

      round = null;
      result = null;
      flow = { phase: "replay", returnTo: activity };
      levelRevision++;
      attempt.loadReplay(replay);
    },
  };
}

export type Session = ReturnType<typeof createSession>;
export type SessionSnapshot = ReturnType<Session["getSnapshot"]>;
