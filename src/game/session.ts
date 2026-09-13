import { drillyErrorMessage } from "../../shared/game/drillyErrors";
import { getPrison, newPlayerDungeon } from "../../shared/game/rooms";
import { RULES } from "../../shared/game/rules";
import type { Level } from "../../shared/game/types";
import {
  parseDrillyAttempts,
  parseBuiltDungeon,
  parseEditorLevel,
  parseLevel,
} from "../../shared/validation";
import type { BuiltDungeon, DrillySource } from "../../shared/game/drilly";
import { replayAttempt } from "../../shared/game/replay";
import { scoreRound, type RaidAttempt } from "../../shared/game/round";
import { createAttempt } from "./attempt";
import { applyEdit, type Edit } from "./editor";

type Phase = "prison" | "build" | "test" | "raid" | "watch" | "results";
type Round = { level: Level; human: RaidAttempt[]; drilly: RaidAttempt[] };

// Attempts own simulation and inputs. The session owns the draft and round.
export function createSession(
  options: {
    prisonLevel?: Level;
    editorLevel?: Level;
    tutorialCompleted?: boolean;
    onTutorialCompleted?: () => void;
    drilly?: DrillySource;
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
  let levelRevision = 0;
  // Edits replace the draft and invalidate its clear; no revision bookkeeping needed.
  let clearedLevel: Level | null = null;
  let opponent: Level | null = null;
  let round: Round | null = null;
  let result: ReturnType<typeof scoreRound> | null = null;
  let watchIndex: number | null = null;
  let recordedAttempt = false;
  let aiStatus: "idle" | "pending" | "error" = "idle";
  let aiError: string | null = null;
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
      editorLevel,
      tutorialCompleted,
      cleared: clearedLevel !== null,
      canChallenge:
        (phase === "build" || phase === "test") &&
        Boolean(options.drilly) &&
        editorLevel.treasures.length > 0,
      canReplayTutorial: tutorialCompleted && phase !== "prison" && view.paused,
      canRestart:
        isPlaying() && !(phase === "prison" && view.state.status === "won"),
      canPlay: isPlaying(),
      watchIndex,
      round: round
        ? {
            human: round.human.map(({ outcome }) => ({ outcome })),
            drilly: round.drilly.map(({ outcome }) => ({ outcome })),
          }
        : null,
      result,
      liveDrilly: Boolean(options.drilly),
      aiStatus,
      aiError,
      roomPreparation,
    };
  }

  function notify() {
    snapshot = makeSnapshot();
    listeners.forEach((fn) => fn());
  }

  function loadAttempt(level: Level) {
    levelRevision++;
    recordedAttempt = false;
    attempt.loadLevel(level);
  }

  function leaveRound() {
    round = null;
    opponent = null;
    result = null;
    watchIndex = null;
    aiStatus = "idle";
    aiError = null;
  }

  function editDungeon() {
    if (!tutorialCompleted)
      throw new Error("Escape the prison before building your dungeon.");

    leaveRound();
    phase = "build";
    levelRevision++;
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
    const level = parseLevel(editorLevel);
    phase = "test";
    loadAttempt(level);
  }

  function challengeDrilly() {
    if (!snapshot.canChallenge) return;
    if (!clearedLevel) {
      testDungeon();
      return;
    }

    round = { level: structuredClone(clearedLevel), human: [], drilly: [] };
    result = null;
    opponent = null;
    phase = "raid";
    attempt.pause();
    void prepareOpponent();
  }

  async function prepareOpponent() {
    if (!round || phase !== "raid" || opponent || aiStatus === "pending")
      return;
    const current = round;
    aiStatus = "pending";
    aiError = null;
    notify();
    try {
      prepareRoom();
      const generated = await preparedRoom!;
      if (round !== current) return;

      preparedRoom = null;
      roomPreparation = "idle";
      opponent = generated.level;
      aiStatus = "idle";
      loadAttempt(opponent);
    } catch (error) {
      if (round !== current) return;

      preparedRoom = null;
      roomPreparation = "idle";
      aiStatus = "error";
      aiError = drillyErrorMessage(
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
    preparedRoom = options.drilly
      .build()
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
    // Background preparation is reused on challenge; errors surface there.
    void preparedRoom.catch(() => {});
    notify();
  }

  async function requestDrilly() {
    if (
      !round ||
      !options.drilly ||
      phase !== "watch" ||
      aiStatus === "pending" ||
      round.drilly.length
    )
      return;
    const current = round;
    const level = structuredClone(current.level);
    aiStatus = "pending";
    aiError = null;
    notify();
    try {
      const attempts = parseDrillyAttempts(
        await options.drilly.raid(level),
        level,
      );
      if (round !== current) return;
      for (const recording of attempts) {
        const verified = replayAttempt(recording.replay);
        if (
          verified.stopReason !== recording.outcome ||
          verified.state.tick !== recording.replay.endTick
        )
          throw new Error("Drilly recording does not match its outcome.");
      }
      current.drilly = attempts;
      aiStatus = "idle";
      showAttempt(0);
    } catch (error) {
      if (round !== current) return;

      aiStatus = "error";
      aiError = drillyErrorMessage(
        error,
        "Drilly could not finish its attempts. Retry; no medals have been awarded.",
      );
      notify();
    }
  }

  function reset() {
    if (!snapshot.canRestart) return;
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
      void requestDrilly();
    }
  }

  function showAttempt(index: number) {
    if (!round?.drilly[index]) return;

    phase = "watch";
    watchIndex = index;
    levelRevision++;
    attempt.loadReplay(round.drilly[index].replay);
  }

  function showResults() {
    if (!round?.drilly.length) return;

    result ??= scoreRound(round.human, round.drilly);
    phase = "results";
    notify();
  }

  attempt.subscribe(() => {
    const view = attempt.getSnapshot();
    if (view.mode === "human" && view.state.status === "won") {
      if (phase === "prison" && !tutorialCompleted) {
        tutorialCompleted = true;
        options.onTutorialCompleted?.();
      } else if (phase === "test") {
        clearedLevel = editorLevel;
      }
    }
    if (phase === "raid" && opponent && view.mode === "human" && view.finished)
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
    get level() {
      return phase === "build" ? structuredClone(editorLevel) : attempt.level;
    },
    get levelRevision() {
      return levelRevision;
    },
    frameState: attempt.frameState,
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
      levelRevision++;
      clearedLevel = null;
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
      switch (phase) {
        case "build":
          challengeDrilly();
          return;
        case "results":
          editDungeon();
          return;
        case "watch":
          if (aiStatus === "error") void requestDrilly();
          else if (watchIndex !== null) {
            if (!attempt.getSnapshot().finished) attempt.play();
            else if (round && watchIndex + 1 < round.drilly.length)
              showAttempt(watchIndex + 1);
            else showResults();
          }
          return;
        case "raid":
          if (!opponent) {
            if (aiStatus === "error") void prepareOpponent();
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
      if (isPlaying()) attempt.update(deltaMs);
    },
  };
}

export type Session = ReturnType<typeof createSession>;
export type SessionSnapshot = ReturnType<Session["getSnapshot"]>;
