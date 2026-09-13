import { RULES } from "../../shared/game/rules";
import type { SessionSnapshot } from "./session";

type ViewCopy = {
  title: string;
  hint: string;
  action: string;
  actionDisabled?: boolean;
};

// Presentation only: transitions and outcomes belong to the session.
export function sessionView(view: SessionSnapshot): ViewCopy {
  const { phase, state, finished } = view;
  switch (phase) {
    case "prison":
      return state.status === "won"
        ? {
            title: "You’re out!",
            hint: "Build your dungeon next.",
            action: "Build your dungeon",
          }
        : {
            title: finished ? "Try again" : "Escape the prison",
            hint: "Collect every treasure. Tap or Space to jump. Wall jumps turn you around.",
            action: finished ? "Retry" : "Let’s go",
          };
    case "build":
      return {
        title: "Your dungeon",
        hint: "Edit the room or keep it.",
        action: "Challenge Drilly",
        actionDisabled: !view.canChallenge,
      };
    case "test":
      return state.status === "won"
        ? {
            title: "Room cleared!",
            hint: view.liveDrilly
              ? "You’re ready to raid Drilly’s dungeon."
              : "Connect Convex to challenge Drilly.",
            action: "Raid Drilly",
            actionDisabled: !view.canChallenge,
          }
        : {
            title: finished ? "Try again" : "Test your room",
            hint: "Collect every treasure. Retries are unlimited.",
            action: finished ? "Retry" : "Start test",
          };
    case "raid":
      if (!view.canPlay)
        return {
          title: view.aiError ? "Couldn’t build the room" : "Drilly is building",
          hint:
            view.aiError ??
            "Drilly must clear its room before you can enter. This can take a few minutes.",
          action: view.aiError ? "Retry" : "Preparing room…",
          actionDisabled: !view.aiError,
        };
      return {
        title: finished ? "Try again" : "Your raid",
        hint: `${RULES.raidAttempts - (view.round?.human.length ?? 0)} tries left. Collect every treasure.`,
        action: finished ? "Retry" : "Start raid",
      };
    case "watch": {
      const index = view.watchIndex;
      if (index === null)
        return {
          title: view.aiError ? "Drilly couldn’t finish" : "Drilly’s turn",
          hint:
            view.aiError ?? "Drilly is attempting your dungeon. Its recordings will appear here.",
          action: view.aiError ? "Retry" : "Thinking…",
          actionDisabled: !view.aiError,
        };
      return {
        title: finished
          ? state.status === "won"
            ? "Drilly cleared it"
            : "Drilly failed"
          : "Drilly’s raid",
        hint: `Attempt ${index + 1} of ${view.round?.drilly.length ?? 0}`,
        action: finished
          ? index + 1 < (view.round?.drilly.length ?? 0)
            ? "Next attempt"
            : "Show results"
          : "Watch Drilly",
      };
    }
    case "results":
      return {
        title:
          view.result?.outcome === "win"
            ? "You win!"
            : view.result?.outcome === "draw"
              ? "It’s a draw"
              : "Drilly wins",
        hint: "",
        action: "Your dungeon",
      };
  }
}
