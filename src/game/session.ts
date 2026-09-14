import { DEATH_ANIMATION_MS } from "./presentation";
import { drillyErrorMessage } from "../../shared/game/drillyErrors";
import { getPrison, newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import type { Level, Replay, State } from "../../shared/game/types";
import {
  parseDrillyAttempts,
  parseDrillyModel,
  parseBuiltDungeon,
  parseEditorLevel,
  parseLevel,
} from "../../shared/validation";
import type { BuiltDungeon, DrillySource, DrillyModel } from "../../shared/game/drilly";
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
    tutorialCompleted?: boolean;
    onTutorialCompleted?: () => void;
    drilly?: DrillySource;
    model?: DrillyModel;
  } = {},
) {
  const prison = parseLevel(options.prisonLevel ?? getPrison());
  const attempt = createAttempt(prison);
  let editorLevel = parseEditorLevel(options.editorLevel ?? newPlayerDungeon(), newPlayerDungeon());
  let tutorialCompleted = options.tutorialCompleted ?? false;
  let phase: Phase = tutorialCompleted ? "build" : "prison";
  let attemptLevel = prison;
  // Edits replace the draft and invalidate its clear; no revision bookkeeping needed.
  let playerClear: Replay | null = null;
  let ghostTrajectory: State["player"][] = [];
  let showGhost = true;
  let model = parseDrillyModel(options.model ?? RULES.drilly.defaultModel);
  let opponent: Level | null = null;
  let round: Round | null = null;
  let result: ReturnType<typeof scoreRound> | null = null;
  let watchIndex: number | null = null;
  let recordedAttempt = false;
  let deathRemainingMs = 0;
  let opponentStatus: RequestStatus = "idle";
  let opponentError: string | null = null;
  let preparedRoom: Promise<BuiltDungeon> | null = null;
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
    return {
      ...view,
      phase,
      presentingDeath: deathRemainingMs > 0,
      // Read-only room references: accepted edits replace the draft.
      level: phase === "build" ? editorLevel : attemptLevel,
      editorLevel,
      tutorialCompleted,
      cleared: playerClear !== null,
      canChallenge:
        (phase === "build" || phase === "test") &&
        Boolean(options.drilly) &&
        editorLevel.treasures.length > 0,
      canReplayTutorial: tutorialCompleted && phase !== "prison" && view.paused,
      canRestart: isPlaying() && !(phase === "prison" && view.state.status === "won"),
      canPlay: isPlaying(),
      watchIndex,
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
      liveDrilly: Boolean(options.drilly),
      aiStatus: phase === "watch" ? (round?.drillyStatus ?? "idle") : opponentStatus,
      aiError: phase === "watch" ? (round?.drillyError ?? null) : opponentError,
      roomPreparation,
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function loadAttempt(level: Level) {
    attemptLevel = level;
    recordedAttempt = false;
    deathRemainingMs = 0;
    attempt.loadLevel(level);
  }

  function leaveRound() {
    deathRemainingMs = 0;
    round = null;
    opponent = null;
    result = null;
    watchIndex = null;
    ghostTrajectory = [];
    opponentStatus = "idle";
    opponentError = null;
  }

  function editDungeon() {
    if (!tutorialCompleted) throw new Error("Escape the prison before building your dungeon.");

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
    opponent = null;
    phase = "raid";
    attempt.pause();
    void prepareOpponent();
    void requestDrilly();
  }

  async function prepareOpponent() {
    if (!round || phase !== "raid" || opponent || opponentStatus === "pending") return;
    const current = round;
    opponentStatus = "pending";
    opponentError = null;
    notify();
    try {
      prepareRoom();
      const generated = await preparedRoom!;
      if (round !== current) return;

      preparedRoom = null;
      roomPreparation = "idle";
      opponent = generated.level;
      opponentStatus = "idle";
      loadAttempt(opponent);
    } catch (error) {
      if (round !== current) return;

      preparedRoom = null;
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
    if (!options.drilly || preparedRoom || !["build", "test", "raid"].includes(phase)) return;

    roomPreparation = "building";
    preparedRoom = options.drilly
      .build()
      .then((value) => {
        const built = parseBuiltDungeon(value);
        const verified = replayAttempt(built.proof);
        if (verified.stopReason !== "won" || verified.state.tick !== built.proof.endTick)
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
    // Background preparation is reused on challenge; errors surface there.
    void preparedRoom.catch(() => {});
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

        const recordings = parseDrillyAttempts([...current.drilly, response], level);
        const recording = recordings[recordings.length - 1];
        const verified = replayAttempt(recording.replay);
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
      if (phase === "watch") showAttempt(0);
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
    loadAttempt(phase === "prison" ? prison : phase === "test" ? editorLevel : opponent!);
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
      if (round.drillyStatus === "idle") showAttempt(0);
    }
  }

  function showAttempt(index: number) {
    if (!round?.drilly[index]) return;

    if (!ghostTrajectory.length)
      ghostTrajectory = replayAttempt(round.playerClear).trajectory.map((state) => state.player);
    phase = "watch";
    watchIndex = index;
    attemptLevel = round.playerClear.level;
    attempt.loadReplay(round.drilly[index].replay);
  }

  function showResults() {
    if (!round?.drilly.length) return;

    result ??= scoreRound(round.human, round.drilly);
    phase = "results";
    notify();
  }

  attempt.onEvents((events) => {
    if (attempt.getSnapshot().mode === "human" && events.some((event) => event.type === "died"))
      deathRemainingMs = DEATH_ANIMATION_MS;
  });

  attempt.subscribe(() => {
    const view = attempt.getSnapshot();
    if (view.mode === "human" && view.state.status === "won") {
      if (phase === "prison" && !tutorialCompleted) {
        tutorialCompleted = true;
        options.onTutorialCompleted?.();
      } else if (phase === "test" && !recordedAttempt) {
        playerClear = attempt.exportReplay();
        recordedAttempt = true;
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
        view.state.status === "won" ? "won" : view.state.status === "dead" ? "dead" : "tick-limit",
      );
    notify();
  });

  return {
    frameState: attempt.frameState,
    renderFrame: attempt.renderFrame,
    ghostFrame() {
      if (!showGhost || phase !== "watch" || watchIndex === null || !ghostTrajectory.length)
        return null;

      const frame = attempt.renderFrame();
      const last = ghostTrajectory.length - 1;
      const current = ghostTrajectory[Math.min(frame.current.tick, last)];
      const previous = ghostTrajectory[Math.min(frame.previous.tick, last)];
      if (frame.alpha >= 1 || frame.previous.tick + 1 !== frame.current.tick) return current;

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
      if (phase !== "build") throw new Error("Return to editing before changing the dungeon.");
      const candidate = applyEdit(editorLevel, change);
      if (JSON.stringify(candidate) === JSON.stringify(editorLevel)) return;

      editorLevel = candidate;
      playerClear = null;
      notify();
    },
    editDungeon,
    replayTutorial,
    replayDrilly() {
      if (phase === "results") showAttempt(0);
    },
    testDungeon,
    challengeDrilly,
    prepareRoom,
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
            if (!attempt.getSnapshot().finished) attempt.play();
            else if (round && watchIndex + 1 < round.drilly.length) showAttempt(watchIndex + 1);
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
        case "test":
          if (attempt.frameState().status === "won") {
            challengeDrilly();
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
      if (isPlaying()) attempt.play();
    },
    pause: attempt.pause,
    step(ticks = 1) {
      if (isPlaying()) attempt.step(ticks);
    },
    update(deltaMs: number) {
      if (deathRemainingMs > 0) {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
        deathRemainingMs = Math.max(0, deathRemainingMs - Math.min(deltaMs, 100));
        if (deathRemainingMs === 0) {
          if (phase === "raid") recordRaid("dead");
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
