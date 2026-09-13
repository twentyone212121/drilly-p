import { drillyErrorMessage } from "../../shared/game/drillyErrors";
import { getObstacleLab, type LabRoomId } from "../../shared/game/obstacleLab";
import {
  getDungeon,
  getPrison,
  newPlayerDungeon,
} from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import type { Level, Replay } from "../../shared/game/types";
import {
  parseDrillyAttempts,
  parseBuiltDungeon,
  parseBuildContext,
  parseEditorLevel,
  parseJumpTicks,
  parseLevel,
  parseReplay,
} from "../../shared/validation";
import { summarizeHumanRaid } from "./drillyLearning";
import type { BuildContext, BuiltDungeon } from "../../shared/game/drilly";
import type { DrillySource } from "../../shared/game/drilly";
import { replayAttempt } from "../../shared/game/replay";
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
  | { phase: "preparing" }
  | { phase: "raid-complete" }
  | { phase: "ghost"; index: number }
  | { phase: "proof"; returnTo: "raid-complete" | "results" }
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
    drilly?: DrillySource;
    drillyHistory?: BuildContext;
    onDrillyHistoryChange?: (history: BuildContext) => void;
  } = {},
) {
  const prison = parseLevel(options.prisonLevel ?? getPrison());
  let opponent = parseLevel(options.opponentLevel ?? getDungeon("first-vault"));
  const attempt = createAttempt(prison);
  let editorLevel = parseEditorLevel(
    options.editorLevel ?? newPlayerDungeon(),
    newPlayerDungeon(),
  );
  let flow: Flow = { phase: "prison" };
  let labRoom: LabRoomId = "showcase";
  let labReturn: "prison" | "escaped" | "building" = "prison";
  let layoutRevision = 0;
  let levelRevision = 0;
  let prisonEscaped = false;
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
  let aiStatus: "idle" | "building" | "playing" | "ready" | "error" = "idle";
  let aiError: string | null = null;
  let aiPending = false;
  let preparedRoom: Promise<BuiltDungeon> | null = null;
  let roomPreparation: "idle" | "building" | "ready" | "error" = "idle";
  let opponentProof: Replay | null = null;
  const history = parseBuildContext(
    options.drillyHistory ?? { recentRaids: [] },
  );
  const listeners = new Set<() => void>();
  let snapshot = makeSnapshot();

  function canSubmit() {
    return (
      (flow.phase === "building" ||
        flow.phase === "testing" ||
        flow.phase === "cleared") &&
      !aiPending &&
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
      prisonEscaped,
      canSubmit: canSubmit(),
      submission: structuredClone(submission),
      round: structuredClone(round),
      result: structuredClone(result),
      best,
      developmentFixture: fixture,
      liveDrilly: Boolean(options.drilly),
      aiStatus,
      aiError,
      aiPending,
      roomPreparation,
      canWatchProof:
        opponentProof !== null &&
        (flow.phase === "raid-complete" || flow.phase === "results"),
      labRoom,
      inLab:
        flow.phase === "lab" ||
        (flow.phase === "replay" && flow.returnTo === "lab"),
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
      flow.phase === "ghost" ||
      flow.phase === "proof"
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
      case "preparing":
      case "ghost":
      case "proof":
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
      activity === "testing"
        ? { phase: activity, revision: layoutRevision }
        : { phase: activity };
    levelRevision++;
    recordedAttempt = false;
    attempt.loadLevel(level);
  }

  function editDungeon() {
    if (!prisonEscaped)
      throw new Error("Escape the prison before building your dungeon.");

    roundId++;
    round = null;
    opponentProof = null;
    result = null;
    aiStatus = "idle";
    aiError = null;
    flow = { phase: "building" };
    levelRevision++;
    // The editor renders its own draft, which need not be a playable level yet.
    attempt.reset();
    warmOpponent();
  }

  function testDungeon() {
    if (
      flow.phase !== "building" &&
      flow.phase !== "testing" &&
      flow.phase !== "cleared"
    ) {
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
    if (options.drilly && !fixture) {
      flow = { phase: "preparing" };
      void prepareOpponent();
    } else {
      opponent = parseLevel(options.opponentLevel ?? getDungeon("first-vault"));
      startAttempt("raiding");
    }
  }

  async function prepareOpponent() {
    if (!round || !options.drilly || aiPending || flow.phase !== "preparing")
      return;
    const id = round.id;
    aiPending = true;
    aiStatus = "building";
    aiError = null;
    notify();
    try {
      warmOpponent();
      const generated = await preparedRoom!;
      if (!round || round.id !== id || flow.phase !== "preparing") return;
      preparedRoom = null;
      roomPreparation = "idle";
      opponent = generated.level;
      opponentProof = generated.proof;
      history.recentRooms.push(structuredClone(generated.level));
      history.recentRooms = history.recentRooms.slice(
        -RULES.drilly.recentRoomLimit,
      );
      options.onDrillyHistoryChange?.(structuredClone(history));
      aiStatus = "ready";
      startAttempt("raiding");
    } catch (error) {
      if (round?.id === id) {
        preparedRoom = null;
        roomPreparation = "idle";
        aiStatus = "error";
        aiError = drillyErrorMessage(
          error,
          "Drilly could not prepare a proven room. Retry or return to your draft.",
        );
      }
    } finally {
      aiPending = false;
      notify();
    }
  }

  function warmOpponent() {
    if (
      !options.drilly ||
      fixture ||
      preparedRoom ||
      !["building", "testing", "cleared", "preparing"].includes(flow.phase) ||
      (aiPending && flow.phase !== "preparing")
    )
      return;
    roomPreparation = "building";
    preparedRoom = options.drilly
      .build(structuredClone(history))
      .then((value) => {
        const built = parseBuiltDungeon(value);
        const verified = replayAttempt(built.proof);
        if (
          verified.stopReason !== "won" ||
          verified.state.tick !== built.proof.endTick
        )
          throw new Error("Drilly did not clear the generated room.");
        roomPreparation = "ready";
        notify();
        return built;
      })
      .catch((error: unknown) => {
        roomPreparation = "error";
        notify();
        throw error;
      });
    // Preparation can finish while editing. Surface errors only when the player
    // requests this room; never leave a background rejection unhandled.
    void preparedRoom.catch(() => {});
    notify();
  }

  async function requestDrilly() {
    if (
      !round ||
      !submission ||
      !options.drilly ||
      aiPending ||
      flow.phase !== "raid-complete" ||
      round.drilly.length
    )
      return;
    const id = round.id;
    const level = structuredClone(submission.replay.level);
    aiPending = true;
    aiStatus = "playing";
    aiError = null;
    notify();
    try {
      const attempts = parseDrillyAttempts(
        await options.drilly.raid(level),
        level,
      );
      if (!round || round.id !== id) return;
      for (const recording of attempts) {
        const verified = replayAttempt(recording.replay);
        if (
          verified.stopReason !== recording.outcome ||
          verified.state.tick !== recording.replay.endTick
        )
          throw new Error("Drilly recording does not match its outcome.");
      }
      round.drilly = attempts;
      aiStatus = "ready";
    } catch (error) {
      if (round?.id === id) {
        aiStatus = "error";
        aiError = drillyErrorMessage(
          error,
          "Drilly could not finish its attempts. Retry; no medals have been awarded.",
        );
      }
    } finally {
      aiPending = false;
      warmOpponent();
      notify();
    }
  }

  function reset() {
    if (
      flow.phase === "building" ||
      flow.phase === "preparing" ||
      flow.phase === "escaped" ||
      flow.phase === "raid-complete" ||
      flow.phase === "results"
    )
      return;

    if (flow.phase === "ghost") {
      showGhost(flow.index);
      return;
    }
    if (flow.phase === "proof" && opponentProof) {
      attempt.loadReplay(opponentProof);
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
      if (!round.fixture && options.drilly) {
        history.recentRaids.push(summarizeHumanRaid(round.human));
        history.recentRaids = history.recentRaids.slice(
          -RULES.drilly.recentRaidLimit,
        );
        options.onDrillyHistoryChange?.(structuredClone(history));
      }
      if (round.fixture && submission) {
        const id = round.id;
        const level = structuredClone(submission.replay.level);
        void Promise.resolve().then(() =>
          receiveDrilly(id, runDrillyFixture(level)),
        );
      } else if (options.drilly) void requestDrilly();
    }
  }

  function receiveDrilly(id: number, attempts: RaidAttempt[]) {
    if (!round || round.id !== id || round.drilly.length || !round.fixture)
      return;
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
          prisonEscaped = true;
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
      return flow.phase === "building"
        ? structuredClone(editorLevel)
        : attempt.level;
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
    skipTutorial() {
      if (flow.phase !== "prison" && flow.phase !== "escaped") return;
      prisonEscaped = true;
      editDungeon();
      notify();
    },
    setDevelopmentFixture(enabled: boolean) {
      if (flow.phase !== "building") return;
      fixture = enabled;
      if (!enabled) warmOpponent();
      notify();
    },
    replayGhost() {
      showGhost(0);
    },
    watchBuildProof() {
      if (
        !opponentProof ||
        (flow.phase !== "raid-complete" && flow.phase !== "results")
      )
        return;
      flow = { phase: "proof", returnTo: flow.phase };
      levelRevision++;
      attempt.loadReplay(opponentProof);
    },
    replaceDraft(value: unknown) {
      if (
        flow.phase !== "building" &&
        flow.phase !== "prison" &&
        flow.phase !== "escaped"
      ) {
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
      const inLab =
        flow.phase === "lab" ||
        (flow.phase === "replay" && flow.returnTo === "lab");
      if (!inLab) {
        if (
          flow.phase !== "prison" &&
          flow.phase !== "escaped" &&
          flow.phase !== "building"
        )
          return;
        labReturn = flow.phase;
      }
      // Validate before changing the selected room or attempt.
      getObstacleLab(id);
      labRoom = id;
      startAttempt("lab");
    },
    exitLab() {
      if (
        flow.phase !== "lab" &&
        !(flow.phase === "replay" && flow.returnTo === "lab")
      )
        return;
      if (labReturn === "prison") startAttempt("prison");
      else {
        flow = { phase: labReturn };
        levelRevision++;
        attempt.loadLevel(prison);
      }
    },
    testDungeon,
    submitDungeon,
    retryDrilly() {
      if (aiStatus !== "error") return;
      if (flow.phase === "preparing") void prepareOpponent();
      else if (flow.phase === "raid-complete") void requestDrilly();
    },
    reset,

    primaryAction() {
      switch (flow.phase) {
        case "proof":
          if (attempt.getSnapshot().finished) {
            flow = { phase: flow.returnTo };
            notify();
          } else attempt.play();
          return;
        case "building":
          return;
        case "preparing":
          if (aiStatus === "error") void prepareOpponent();
          return;
        case "escaped":
        case "results":
          editDungeon();
          return;
        case "raid-complete":
          if (round?.drilly.length) showGhost(0);
          else if (options.drilly && !round?.fixture) {
            if (aiStatus === "error") void requestDrilly();
          } else if (!round?.fixture) editDungeon();
          return;
        case "ghost":
          if (!attempt.getSnapshot().finished) {
            attempt.play();
            return;
          }
          if (round && flow.index + 1 < round.drilly.length)
            showGhost(flow.index + 1);
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
      if (!activity)
        throw new Error("Start an attempt before loading a schedule.");

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
      if (!activity)
        throw new Error("Start an attempt before loading a replay.");

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
