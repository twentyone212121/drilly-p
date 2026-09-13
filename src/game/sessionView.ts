import { LAB_ROOMS } from "../../shared/game/obstacleLab";
import { RULES } from "../../shared/game/rules";
import type { SessionSnapshot } from "./session";

// Presentation only: transitions and outcomes belong to the session.
export function sessionView(view: SessionSnapshot) {
  const { phase, state, paused, finished } = view;
  const replayActivity =
    view.flow.phase === "replay" ? view.flow.returnTo : null;
  switch (phase) {
    case "lab":
      return {
        step: -1,
        title: "Obstacle lab",
        hint: LAB_ROOMS.find((room) => room.id === view.labRoom)!.hint,
        status: finished
          ? state.status === "won"
            ? "Lab cleared. Try another obstacle or replay this room."
            : "Try again: every attempt resets the obstacles."
          : "Practice only — your dungeon and progression are safe.",
        action: finished
          ? "Try again"
          : paused
            ? state.tick === 0
              ? "Start practice"
              : "Resume"
            : "Jump",
      };
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
        status:
          "Dungeon beaten. If you change it, beat it again before submitting.",
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
        hint:
          view.liveDrilly && !view.round?.fixture
            ? "Drilly built and cleared this room. Read the traps and find your own route."
            : "Two saws guard the treasure. Leave time to land before your next jump.",
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
        hint: view.round?.fixture
          ? "Development fixture · Watch the recorded attempts on your submitted vault."
          : view.liveDrilly
            ? "Drilly gets three tries at your dungeon, learning from each failure."
            : "This was local practice. Live Drilly is not connected, so this raid has no round score.",
        status: view.round?.fixture
          ? "Your raid is complete. Drilly’s review comes next."
          : view.liveDrilly
            ? (view.aiError ??
              (view.round?.drilly.length
                ? "Drilly’s recordings are ready."
                : "Drilly is reading your room, choosing jumps, and learning from its attempts. This may take up to 3 minutes."))
            : "Return to your draft to revise.",
        action: view.round?.drilly.length
          ? "Watch Drilly"
          : view.round?.fixture
            ? "Preparing Drilly…"
            : view.liveDrilly
              ? view.aiStatus === "error"
                ? "Retry Drilly"
                : "Drilly is thinking…"
              : "Revise your dungeon",
      };
    case "ghost": {
      const index = view.flow.phase === "ghost" ? view.flow.index : 0;
      return {
        step: 4,
        title: "Drilly’s attempts",
        hint: view.round?.fixture
          ? "Development fixture · Recorded inputs on your submitted dungeon."
          : "Actual AI attempts on your submitted dungeon. Watch where your design fooled Drilly.",
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
        hint: view.round?.fixture
          ? "Development fixture · Revise your vault and try another round."
          : "Revise your vault using what you learned from Drilly’s attempts.",
        status: `${view.result?.total ?? 0}/6 medals · Best ${view.best ?? 0}/6`,
        action: "Revise your dungeon",
      };
    case "proof":
      return {
        step: 4,
        title: "Drilly’s own clear",
        hint: "The winning run recorded before this room was offered to you. Watching it uses no attempts and changes no medals.",
        status: finished
          ? "Room proof complete."
          : "Watching Drilly’s build test.",
        action: finished
          ? "Return to round"
          : paused
            ? "Play proof"
            : "Playing proof",
      };
    case "replay":
      return {
        step:
          replayActivity === "lab"
            ? -1
            : replayActivity === "prison"
              ? 0
              : replayActivity === "testing"
                ? 2
                : 3,
        title: "Review an attempt",
        hint: "Developer replay. Playback does not advance the prison, clear your draft, or complete a raid.",
        status: finished
          ? "Replay ended. Return to a fresh human attempt."
          : "Watching the recorded inputs.",
        action: finished
          ? "Return to attempt"
          : paused
            ? "Play replay"
            : "Playing replay",
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
