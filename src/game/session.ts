import { DEATH_ANIMATION_MS } from "./presentation";
import { drillyErrorMessage } from "../../shared/game/drillyErrors";
import { getPrison, newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import type { Level, Replay, State } from "../../shared/game/types";
import {
  parseDrillyAttempts,
  parseDrillyModel,
  parseEditorLevel,
  parseLevel,
  parseReplay,
} from "../../shared/validation";
import type { DrillySource, DrillyModel } from "../../shared/game/drilly";
import { replayAttempt } from "../../shared/game/replay";
import { scoreRound, type RaidAttempt } from "../../shared/game/round";
import { createAttempt } from "./attempt";
import { applyEdit, type Edit } from "./editor";

type Phase = "prison" | "build" | "test" | "raid" | "watch" | "results";
type RequestStatus = "idle" | "pending" | "error";
type Round = {
  playerClear: Replay;
  model: DrillyModel;
  human: RaidAttempt[];
  drilly: RaidAttempt[];
  drillyStatus: RequestStatus;
  drillyError: string | null;
};

// Attempts own simulation and inputs. The session owns the draft and round.
export function createSession(
  options: {
    prisonLevel?: Level;
    editorLevel?: Level;
    playerClear?: unknown;
    tutorialCompleted?: boolean;
    onTutorialCompleted?: () => void;
    drilly?: DrillySource;
    model?: DrillyModel;
  } = {},
) {
  const prison = parseLevel(options.prisonLevel ?? getPrison());
  const attempt = createAttempt(prison);
  let editorLevel = parseEditorLevel(
    options.editorLevel ?? newPlayerDungeon(),
    newPlayerDungeon(),
  );
  let tutorialCompleted = options.tutorialCompleted ?? false;
  let phase: Phase = tutorialCompleted ? "build" : "prison";
  let attemptLevel = prison;
  // Edits replace the draft and invalidate its clear; no revision bookkeeping needed.
  let playerClear: Replay | null = null;
  if (options.playerClear) {
    try {
      const restored = parseReplay(
        options.playerClear,
        RULES.maxRestoredClearTicks,
      );
      if (JSON.stringify(restored.level) === JSON.stringify(editorLevel)) {
        const verified = replayAttempt(restored, { recordTrace: false });
        if (
          verified.stopReason === "won" &&
          verified.state.tick === restored.endTick
        )
          playerClear = restored;
      }
    } catch {
      // Old rules, changed geometry, oversized or damaged recordings invalidate only the clear.
    }
  }
  let ghostTrajectory: State["player"][] = [];
  let showGhost = true;
  let model = parseDrillyModel(options.model ?? RULES.drilly.defaultModel);
  let opponent: Level | null = null;
  let round: Round | null = null;
  let result: ReturnType<typeof scoreRound> | null = null;
  let scoreboard = {
    you: { points: 0, wins: 0 },
    drilly: { points: 0, wins: 0 },
    rounds: 0,
    draws: 0,
  };
  let watchIndex: number | null = null;
  let watchAutoplay = false;
  let watchIdle = false;
  let switchingReplay = false;
  let recordedAttempt = false;
  let deathRemainingMs = 0;
  let respawned = false;
  let confirmingGiveUp = false;
  let resumeAfterCancel = false;
  const waitingRoom = {
    ...newPlayerDungeon(),
    treasures: [],
    traps: [],
    obstacles: [],
  };
  let opponentStatus: RequestStatus = "idle";
  let opponentError: string | null = null;
  let preparedRoom: Promise<Level> | null = null;
  let preparationController: AbortController | null = null;
  let roomPreparation: "idle" | "building" | "ready" | "error" = "idle";
  const listeners = new Set<() => void>();
  let snapshot = makeSnapshot();

  function isPlaying() {
    return (
      phase === "prison" ||
      phase === "test" ||
      (phase === "raid" && opponent !== null) ||
      (phase === "watch" && watchIndex !== null)
    );
  }

  function makeSnapshot() {
    const view = attempt.getSnapshot();
    const waitingForDrilly =
      (phase === "raid" && !opponent) ||
      (phase === "watch" && watchIndex === null);
    return {
      ...view,
      phase,
      waitingForDrilly,
      confirmingGiveUp,
      presentingDeath: deathRemainingMs > 0,
      waitingToStart:
        (phase === "test" ||
          (phase === "prison" && respawned) ||
          (phase === "raid" && opponent !== null)) &&
        view.mode === "human" &&
        view.paused &&
        view.state.tick === 0 &&
        !view.finished,
      // Read-only room references: accepted edits replace the draft.
      level: waitingForDrilly
        ? waitingRoom
        : phase === "build"
          ? editorLevel
          : attemptLevel,
      editorLevel,
      tutorialCompleted,
      cleared: playerClear !== null,
      playerClear,
      canChallenge:
        (phase === "build" || phase === "test") &&
        Boolean(options.drilly) &&
        editorLevel.treasures.length > 0,
      canReplayTutorial: tutorialCompleted && phase !== "prison" && view.paused,
      canRestart:
        isPlaying() && !(phase === "prison" && view.state.status === "won"),
      canPlay: isPlaying(),
      watchIndex,
      watchIdle,
      showGhost,
      model: round?.model ?? model,
      playerClearTicks: round?.playerClear.endTick ?? null,
      round: round
        ? {
            human: round.human.map(({ outcome }) => ({ outcome })),
            drilly: round.drilly.map(({ outcome }) => ({ outcome })),
          }
        : null,
      result,
      scoreboard,
      livesRemaining:
        phase === "raid"
          ? Math.max(
              0,
              RULES.raidAttempts -
                (round?.human.length ?? 0) -
                Number(deathRemainingMs > 0 && !recordedAttempt),
            )
          : null,
      liveDrilly: Boolean(options.drilly),
      aiStatus:
        phase === "watch" ? (round?.drillyStatus ?? "idle") : opponentStatus,
      aiError: phase === "watch" ? (round?.drillyError ?? null) : opponentError,
      roomPreparation,
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function loadAttempt(level: Level) {
    respawned = false;
    attemptLevel = level;
    recordedAttempt = false;
    deathRemainingMs = 0;
    attempt.loadLevel(level);
  }

  function leaveRound() {
    confirmingGiveUp = false;
    preparationController?.abort();
    preparationController = null;
    preparedRoom = null;
    roomPreparation = "idle";
    deathRemainingMs = 0;
    round = null;
    opponent = null;
    result = null;
    watchIndex = null;
    watchAutoplay = false;
    watchIdle = false;
    ghostTrajectory = [];
    opponentStatus = "idle";
    opponentError = null;
  }

  function editDungeon() {
    if (!tutorialCompleted)
      throw new Error("Escape the prison before building your dungeon.");

    leaveRound();
    phase = "build";
    attempt.pause();
    prepareRoom();
  }

  function replayTutorial() {
    if (!snapshot.canReplayTutorial) return;

    leaveRound();
    phase = "prison";
    loadAttempt(prison);
  }

  function testDungeon() {
    if (phase !== "build" && phase !== "test")
      throw new Error("Return to building before testing your dungeon.");

    // Validate before changing phase: unfinished drafts may have no treasures.
    parseLevel(editorLevel);
    phase = "test";
    loadAttempt(editorLevel);
  }

  function challengeDrilly() {
    if (!snapshot.canChallenge) return;
    if (!playerClear) {
      testDungeon();
      return;
    }

    round = {
      playerClear,
      model,
      human: [],
      drilly: [],
      drillyStatus: "idle",
      drillyError: null,
    };
    result = null;
    confirmingGiveUp = false;
    deathRemainingMs = 0;
    watchIndex = null;
    ghostTrajectory = [];
    opponentStatus = "idle";
    opponentError = null;
    opponent = null;
    phase = "raid";
    attempt.pause();
    void prepareOpponent();
    void requestDrilly();
  }

  async function prepareOpponent() {
    if (!round || phase !== "raid" || opponent || opponentStatus === "pending")
      return;
    const current = round;
    opponentStatus = "pending";
    opponentError = null;
    notify();
    prepareRoom();
    const preparation = preparedRoom!;
    try {
      const generated = await preparation;
      if (round !== current || preparedRoom !== preparation || phase !== "raid")
        return;

      preparedRoom = null;
      preparationController = null;
      roomPreparation = "idle";
      opponent = generated;
      opponentStatus = "idle";
      loadAttempt(opponent);
    } catch (error) {
      if (round !== current || preparedRoom !== preparation || phase !== "raid")
        return;

      preparedRoom = null;
      preparationController = null;
      roomPreparation = "idle";
      opponentStatus = "error";
      opponentError = drillyErrorMessage(
        error,
        "Drilly could not prepare a room. Retry or return to your draft.",
      );
      notify();
    }
  }

  function prepareRoom() {
    if (
      !options.drilly ||
      preparedRoom ||
      !["build", "test", "raid"].includes(phase)
    )
      return;

    roomPreparation = "building";
    const controller = new AbortController();
    preparationController = controller;
    preparedRoom = options.drilly
      .build(controller.signal)
      .then((value) => {
        controller.signal.throwIfAborted();
        const level = parseLevel(value);

        roomPreparation = "ready";
        notify();
        return level;
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          roomPreparation = "error";
          notify();
        }
        throw error;
      });
    // Background preparation is reused on challenge; errors surface there.
    void preparedRoom.catch(() => {});
    notify();
  }

  function cancelRoomPreparation() {
    preparationController?.abort();
    preparationController = null;
    preparedRoom = null;
    roomPreparation = "idle";
    notify();
  }

  async function requestDrilly() {
    if (
      !round ||
      !options.drilly ||
      (phase !== "raid" && phase !== "watch") ||
      round.drillyStatus === "pending"
    )
      return;

    const current = round;
    const level = structuredClone(current.playerClear.level);
    current.drillyStatus = "pending";
    current.drillyError = null;
    notify();
    try {
      while (
        current.drilly.length < RULES.raidAttempts &&
        !current.drilly.some((recording) => recording.outcome === "won")
      ) {
        const response = await options.drilly.raid(
          level,
          structuredClone(current.drilly),
          current.model,
        );
        if (round !== current) return;

        const recordings = parseDrillyAttempts(
          [...current.drilly, response],
          level,
        );
        const recording = recordings[recordings.length - 1];
        const verified = replayAttempt(recording.replay, { recordTrace: false });
        if (
          verified.stopReason !== recording.outcome ||
          verified.state.tick !== recording.replay.endTick
        )
          throw new Error("Drilly recording does not match its outcome.");

        // Keep each completed attempt before another provider call can fail.
        current.drilly.push(recording);
        notify();
      }
      current.drillyStatus = "idle";
      // Background completion must never replace the human's active attempt.
      if (phase === "watch") showResults();
      else notify();
    } catch (error) {
      if (round !== current) return;

      current.drillyStatus = "error";
      current.drillyError = drillyErrorMessage(
        error,
        "Drilly could not finish its attempts. Retry; no medals have been awarded.",
      );
      notify();
    }
  }

  function reset() {
    if (!snapshot.canRestart || deathRemainingMs > 0) return;
    if (phase === "watch") {
      showAttempt(watchIndex!);
      return;
    }
    if (phase === "raid") {
      recordRaid("restart");
      if (phase !== "raid") return;
    }
    loadAttempt(
      phase === "prison" ? prison : phase === "test" ? editorLevel : opponent!,
    );
  }

  function recordRaid(outcome: RaidAttempt["outcome"]) {
    if (!round || recordedAttempt) return;

    recordedAttempt = true;
    round.human.push({ replay: attempt.exportReplay(), outcome });
    if (outcome === "won" || round.human.length >= RULES.raidAttempts) {
      phase = "watch";
      watchIndex = null;
      attempt.pause();
      // Reuse ready recordings; pending work finishes here and errors wait for Retry.
      if (round.drillyStatus === "idle") showResults();
    }
  }

  function showAttempt(index: number, play = false) {
    if (!round?.drilly[index]) return;

    if (!ghostTrajectory.length)
      ghostTrajectory = replayAttempt(round.playerClear).trajectory.map(
        (state) => state.player,
      );
    phase = "watch";
    watchIndex = index;
    attemptLevel = round.playerClear.level;
    switchingReplay = true;
    attempt.loadReplay(round.drilly[index].replay);
    if (play) attempt.play();
    switchingReplay = false;
  }

  function showResults() {
    if (!round?.drilly.length) return;

    if (!result) {
      result = scoreRound(round.human, round.drilly);
      scoreboard = {
        you: {
          points: scoreboard.you.points + result.total,
          wins: scoreboard.you.wins + Number(result.outcome === "win"),
        },
        drilly: {
          points:
            scoreboard.drilly.points + RULES.raidAttempts * 2 - result.total,
          wins: scoreboard.drilly.wins + Number(result.outcome === "loss"),
        },
        rounds: scoreboard.rounds + 1,
        draws: scoreboard.draws + Number(result.outcome === "draw"),
      };
    }
    phase = "results";
    notify();
  }

  function requestReturn() {
    if (
      phase === "raid" &&
      round &&
      !round.human.some((a) => a.outcome === "won")
    ) {
      resumeAfterCancel = !attempt.getSnapshot().paused;
      confirmingGiveUp = true;
      attempt.pause();
      notify();
      return;
    }
    if (phase === "watch" && round && !result) {
      if (round.drillyStatus === "idle") showResults();
      else {
        watchIndex = null;
        attempt.pause();
        notify();
      }
      return;
    }
    editDungeon();
  }

  function confirmGiveUp() {
    if (!confirmingGiveUp || !round || phase !== "raid") return;
    confirmingGiveUp = false;
    deathRemainingMs = 0;
    phase = "watch";
    watchIndex = null;
    attempt.pause();
    if (round.drillyStatus === "idle") showResults();
    else notify();
  }

  attempt.onEvents((events) => {
    if (
      attempt.getSnapshot().mode === "human" &&
      events.some((event) => event.type === "died")
    )
      deathRemainingMs = DEATH_ANIMATION_MS;
  });

  attempt.subscribe(() => {
    const view = attempt.getSnapshot();
    if (
      phase === "watch" &&
      view.mode === "replay" &&
      view.finished &&
      !watchIdle &&
      !switchingReplay &&
      watchIndex !== null &&
      round
    ) {
      if (watchAutoplay && watchIndex + 1 < round.drilly.length) {
        showAttempt(watchIndex + 1, true);
      } else {
        const restartIndex = watchAutoplay ? 0 : watchIndex;
        watchAutoplay = false;
        watchIdle = true;
        showAttempt(restartIndex);
      }
      notify();
      return;
    }
    if (view.mode === "human" && view.state.status === "won") {
      if (phase === "prison" && !tutorialCompleted) {
        tutorialCompleted = true;
        options.onTutorialCompleted?.();
      } else if (phase === "test" && !recordedAttempt) {
        playerClear = attempt.exportReplay();
        recordedAttempt = true;
        phase = "build";
      }
    }
    if (
      phase === "raid" &&
      opponent &&
      view.mode === "human" &&
      view.finished &&
      deathRemainingMs === 0
    )
      recordRaid(
        view.state.status === "won"
          ? "won"
          : view.state.status === "dead"
            ? "dead"
            : "tick-limit",
      );
    notify();
  });

  return {
    frameState: attempt.frameState,
    renderFrame: attempt.renderFrame,
    ghostFrame() {
      if (
        !showGhost ||
        phase !== "watch" ||
        watchIndex === null ||
        !ghostTrajectory.length
      )
        return null;

      const frame = attempt.renderFrame();
      const last = ghostTrajectory.length - 1;
      const current = ghostTrajectory[Math.min(frame.current.tick, last)];
      const previous = ghostTrajectory[Math.min(frame.previous.tick, last)];
      if (frame.alpha >= 1 || frame.previous.tick + 1 !== frame.current.tick)
        return current;

      return {
        ...current,
        x: previous.x + (current.x - previous.x) * frame.alpha,
        y: previous.y + (current.y - previous.y) * frame.alpha,
      };
    },
    setGhostVisible(visible: boolean) {
      showGhost = visible;
      notify();
    },
    setModel(value: DrillyModel) {
      if (phase !== "build" && phase !== "test") return;
      model = parseDrillyModel(value);
      notify();
    },
    getSnapshot: () => snapshot,
    onEvents: attempt.onEvents,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    edit(change: Edit) {
      if (phase !== "build")
        throw new Error("Return to editing before changing the dungeon.");
      const candidate = applyEdit(editorLevel, change);
      if (JSON.stringify(candidate) === JSON.stringify(editorLevel)) return;

      editorLevel = candidate;
      playerClear = null;
      notify();
    },
    editDungeon,
    requestReturn,
    confirmGiveUp,
    cancelGiveUp() {
      confirmingGiveUp = false;
      if (resumeAfterCancel) attempt.play();
      notify();
    },
    replayTutorial,
    replayDrilly() {
      if (phase === "results") {
        watchAutoplay = true;
        watchIdle = false;
        showAttempt(0, true);
      }
    },
    selectDrillyAttempt(index: number) {
      if (
        phase !== "watch" ||
        !Number.isInteger(index) ||
        !round?.drilly[index]
      )
        return;
      watchAutoplay = false;
      watchIdle = false;
      showAttempt(index, true);
    },
    testDungeon,
    challengeDrilly,
    prepareRoom,
    cancelRoomPreparation,
    reset,
    primaryAction() {
      if (deathRemainingMs > 0) return;
      switch (phase) {
        case "build":
          challengeDrilly();
          return;
        case "results":
          editDungeon();
          return;
        case "watch":
          if (round?.drillyStatus === "error") void requestDrilly();
          else if (watchIndex !== null) {
            if (!attempt.getSnapshot().finished) {
              watchIdle = false;
              attempt.play();
            } else if (round && watchIndex + 1 < round.drilly.length)
              showAttempt(watchIndex + 1);
            else showResults();
          }
          return;
        case "raid":
          if (!opponent) {
            if (opponentStatus === "error") void prepareOpponent();
            return;
          }
          break;
        case "prison":
          if (attempt.frameState().status === "won") {
            editDungeon();
            return;
          }
          break;
      }
      if (attempt.getSnapshot().finished) reset();
      if (isPlaying()) attempt.primaryAction();
    },
    jump() {
      if (isPlaying()) attempt.jump();
    },
    play() {
      if (phase === "watch") watchIdle = false;
      if (isPlaying()) attempt.play();
    },
    pause: attempt.pause,
    step(ticks = 1) {
      if (isPlaying()) attempt.step(ticks);
    },
    update(deltaMs: number) {
      if (confirmingGiveUp) return;
      if (deathRemainingMs > 0) {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
        deathRemainingMs = Math.max(
          0,
          deathRemainingMs - Math.min(deltaMs, 100),
        );
        if (deathRemainingMs === 0) {
          if (phase === "raid") recordRaid("dead");
          if (phase === "prison" || phase === "test" || phase === "raid") {
            respawned = true;
            recordedAttempt = false;
            attempt.loadLevel(attemptLevel);
          }
          notify();
        }
        return;
      }
      if (isPlaying()) attempt.update(deltaMs);
    },
  };
}

export type Session = ReturnType<typeof createSession>;
export type SessionSnapshot = ReturnType<Session["getSnapshot"]>;
