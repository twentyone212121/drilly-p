import { RULES } from "../../shared/game/rules";
import type { SessionSnapshot } from "./session";

// Presentation only: transitions and outcomes belong to the session.
export function sessionView(view: SessionSnapshot) {
  const { phase, state, paused, finished } = view;
  switch (phase) {
    case "prison":
      return {
        step: 0,
        title: "Break out",
        hint: "Take both treasures to escape. Jump past the saws and use the far wall to reach the upper ledge.",
        status: prisonStatus(view),
        action: finished
          ? "Retry escape"
          : paused
            ? state.tick === 0
              ? "Start escape"
              : "Resume"
            : "Jump",
      };
    case "escaped":
      return {
        step: 0,
        title: "You’re out",
        hint: "Now build a vault of your own. Make it tricky, then prove you can beat it.",
        status: "Prison escaped. Your own dungeon comes next.",
        action: "Build your dungeon",
      };
    case "building":
      return {
        step: 1,
        title: "Make it yours",
        hint: "Place platforms, saws, and treasure. You must clear every treasure yourself before raiding Drilly.",
        status: view.canSubmit
          ? "Your dungeon is beaten and ready to submit."
          : view.roomPreparation === "building"
            ? "Build something you can beat. Drilly is preparing its room while you edit."
            : view.roomPreparation === "ready"
              ? "Drilly’s room is ready. Finish and test your dungeon."
              : "Build something you can beat.",
        action: "Test dungeon",
      };
    case "testing":
      return {
        step: 2,
        title: "Prove your route",
        hint: "Collect every treasure. Test as often as you like; your layout stays intact.",
        status: finished
          ? "Test failed. Retry, or return to building and adjust your dungeon."
          : paused
            ? state.tick === 0
              ? "Ready to test your dungeon."
              : "Test paused."
            : "Collect every treasure to beat your dungeon.",
        action: finished
          ? "Retry test"
          : paused
            ? state.tick === 0
              ? "Start test"
              : "Resume"
            : "Jump",
      };
    case "cleared":
      return {
        step: 2,
        title: "Your vault is ready",
        hint: "You proved this layout can be beaten. Submit it to enter Drilly’s first dungeon.",
        status: view.liveDrilly
          ? "Dungeon beaten. If you change it, beat it again before submitting."
          : "Connect Convex to challenge Drilly.",
        action: "Submit & raid",
      };
    case "preparing":
      return {
        step: 3,
        title: "Drilly is building",
        hint: "Drilly must beat its own dungeon before you enter. Your submitted room is locked in.",
        status:
          view.aiError ??
          "Designing and playing its own challenge. This may take up to 3 minutes.",
        action:
          view.aiStatus === "error" ? "Retry building" : "Preparing room…",
      };
    case "raiding":
      return {
        step: 3,
        title: "Into Drilly’s vault",
        hint: "Drilly built and cleared this room. Read the traps and find your own route.",
        status: finished
          ? `Raid failed. ${view.round?.human.length ?? 0}/${RULES.raidAttempts} attempts used. Retry, or return to your draft.`
          : paused
            ? state.tick === 0
              ? `Ready to raid · Attempt ${(view.round?.human.length ?? 0) + 1}/${RULES.raidAttempts}`
              : "Raid paused."
            : "Get past the traps and take every treasure.",
        action: finished
          ? "Retry raid"
          : paused
            ? state.tick === 0
              ? "Start raid"
              : "Resume"
            : "Jump",
      };
    case "raid-complete":
      return {
        step: 3,
        title: "Raid finished",
        hint: "Drilly gets three tries at your dungeon.",
        status:
          view.aiError ??
          (view.round?.drilly.length
            ? "Drilly’s recordings are ready."
            : "Drilly is attempting your room. This may take up to 3 minutes."),
        action: view.round?.drilly.length
          ? "Watch Drilly"
          : view.aiStatus === "error"
            ? "Retry Drilly"
            : "Drilly is thinking…",
      };
    case "ghost": {
      const index = view.flow.phase === "ghost" ? view.flow.index : 0;
      return {
        step: 4,
        title: "Drilly’s attempts",
        hint: "Actual AI attempts on your submitted dungeon.",
        status: `Attempt ${index + 1} of ${view.round?.drilly.length ?? 0}: ${finished ? (state.status === "won" ? "Cleared your vault" : state.status === "dead" ? "Died here" : "Time ran out here") : "Watching Drilly"}`,
        action: finished
          ? index + 1 < (view.round?.drilly.length ?? 0)
            ? "Next attempt"
            : "Show results"
          : paused
            ? "Play ghost"
            : "Playing ghost",
      };
    }
    case "results":
      return {
        step: 5,
        title:
          view.result?.outcome === "win"
            ? "You win"
            : view.result?.outcome === "draw"
              ? "A draw"
              : "Drilly wins",
        hint: "Revise your vault using what you learned from Drilly’s attempts.",
        status: `${view.result?.total ?? 0}/6 medals`,
        action: "Revise your dungeon",
      };
  }
}

function prisonStatus(view: SessionSnapshot): string {
  const { state, paused, finished, events } = view;
  if (finished) {
    if (state.status === "running")
      return "Time’s up. Jump at a wall to turn around and climb.";

    const death = events.find((event) => event.type === "died");
    return death?.trapId === "ledge-saw"
      ? "The upper saw got you. Land on the ledge, then jump again."
      : "Caught by the floor saw. Try a different jump timing — retries are unlimited.";
  }

  if (paused) {
    return state.tick === 0
      ? "Tap the room or press Space to start."
      : "Paused. Tap or press Space to resume.";
  }
  if (state.player.wall !== 0)
    return "Jump off the wall to reverse direction and reach the ledge.";
  if (state.player.direction === -1)
    return "Land on the ledge, then jump over the upper saw.";
  if (state.collectedTreasureIds.length > 0)
    return "One treasure left. Reach the far wall, then jump back onto the ledge.";

  return "Jump over the floor saw. You need both treasures to escape.";
}
