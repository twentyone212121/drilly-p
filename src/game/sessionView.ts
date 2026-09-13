import { RULES } from "../../shared/game/rules";
import type { SessionSnapshot } from "./session";

type ViewCopy = {
  step: number;
  title: string;
  hint: string;
  status: string;
  action: string;
  actionDisabled?: boolean;
};

// Presentation only: transitions and outcomes belong to the session.
export function sessionView(view: SessionSnapshot): ViewCopy {
  const { phase, state, paused, finished } = view;
  switch (phase) {
    case "prison":
      return {
        step: 0,
        title: state.status === "won" ? "Prison escaped" : "Escape the prison",
        hint: "Collect every treasure. Jump off walls to reverse direction.",
        ...attemptCopy(view, "escape"),
        ...(state.status === "won"
          ? {
              status: "Your dungeon is next.",
              action: "Build your dungeon",
            }
          : {}),
      };
    case "build":
      return {
        step: 1,
        title: "Your dungeon",
        hint: "Edit the room or keep it. Clear it before raiding Drilly.",
        status: !view.editorLevel.treasures.length
          ? "Add a treasure before testing."
          : view.cleared
            ? "Room cleared. Challenge Drilly to raid its room."
            : view.roomPreparation === "building"
              ? "Drilly is building its room while you edit."
              : "Challenge Drilly to test your room first.",
        action: "Challenge Drilly",
        actionDisabled: !view.canChallenge,
      };
    case "test":
      return {
        step: 2,
        title: "Test your dungeon",
        hint: "Collect every treasure. Retries are unlimited.",
        ...attemptCopy(view, "test"),
        ...(state.status === "won"
          ? {
              status: view.liveDrilly
                ? "Room cleared. Ready to raid Drilly."
                : "Connect Convex to challenge Drilly.",
              action: "Raid Drilly",
              actionDisabled: !view.canChallenge,
            }
          : {}),
      };
    case "raid":
      return {
        step: 3,
        title: "Your raid",
        hint: "Beat Drilly’s room within three attempts.",
        ...attemptCopy(view, "raid"),
        status: !view.canPlay
          ? (view.aiError ??
            "Drilly is building and testing its room. This may take up to 3 minutes.")
          : `Attempt ${Math.min((view.round?.human.length ?? 0) + (finished ? 0 : 1), RULES.raidAttempts)}/${RULES.raidAttempts} · ${attemptCopy(view, "raid").status}`,
        ...(!view.canPlay
          ? {
              action:
                view.aiStatus === "error"
                  ? "Retry building"
                  : "Preparing room…",
              actionDisabled: view.aiStatus !== "error",
            }
          : {}),
      };
    case "watch": {
      const index = view.watchIndex;
      return {
        step: 4,
        title: "Drilly’s raid",
        hint: "Watch Drilly attempt your room.",
        status:
          index === null
            ? (view.aiError ??
              "Drilly is attempting your room. This may take up to 3 minutes.")
            : `Attempt ${index + 1}/${view.round?.drilly.length}: ${finished ? (state.status === "won" ? "Cleared" : state.status === "dead" ? "Failed" : "Time ran out") : "Ready to watch"}`,
        action:
          index === null
            ? view.aiStatus === "error"
              ? "Retry Drilly"
              : "Drilly is thinking…"
            : finished
              ? index + 1 < (view.round?.drilly.length ?? 0)
                ? "Next attempt"
                : "Show results"
              : paused
                ? "Watch Drilly"
                : "Watching Drilly",
        actionDisabled: index === null ? view.aiStatus !== "error" : !paused,
      };
    }
    case "results":
      return {
        step: 5,
        title:
          view.result?.outcome === "win"
            ? "You win"
            : view.result?.outcome === "draw"
              ? "Draw"
              : "Drilly wins",
        hint: "Return to your room for another round.",
        status: `${view.result?.total ?? 0}/6 medals`,
        action: "Back to your dungeon",
      };
  }
}

function attemptCopy(
  { state, paused, finished }: SessionSnapshot,
  activity: string,
) {
  return {
    status: finished
      ? "Attempt finished. Retry or return to your dungeon."
      : paused
        ? state.tick === 0
          ? "Ready to start."
          : "Paused."
        : "Collect every treasure.",
    action: finished
      ? `Retry ${activity}`
      : paused
        ? state.tick === 0
          ? `Start ${activity}`
          : "Resume"
        : "Jump",
  };
}
