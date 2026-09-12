import type { SessionSnapshot } from "./session";

// Presentation only: transitions and outcomes belong to the session.
export function sessionView(view: SessionSnapshot) {
  const { phase, state, paused, finished } = view;
  const replayActivity = view.flow.phase === "replay" ? view.flow.returnTo : null;
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
          ? "This version is cleared and ready to submit."
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
            : "Collect every treasure to clear this version.",
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
        status: `Version ${view.layoutRevision + 1} cleared. Editing it requires a new clear.`,
        action: "Submit & raid",
      };
    case "raiding":
      return {
        step: 3,
        title: "Into Drilly’s vault",
        hint: "Two saws guard the treasure. Leave time to land before your next jump.",
        status: finished
          ? "Raid failed. Retry, or return to your draft."
          : paused
            ? state.tick === 0
              ? "Ready to raid The double lock."
              : "Raid paused."
            : "Get past both saws and take the treasure.",
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
        title: "Treasure secured",
        hint: "You cleared Drilly’s first dungeon. Return to your draft to try another design.",
        status: "Local raid complete. Drilly’s counter-raid and round medals are coming later.",
        action: "Revise your dungeon",
      };
    case "replay":
      return {
        step: replayActivity === "prison" ? 0 : replayActivity === "testing" ? 2 : 3,
        title: "Review an attempt",
        hint: "Developer replay. Playback does not advance the prison, clear your draft, or complete a raid.",
        status: finished
          ? "Replay ended. Return to a fresh human attempt."
          : "Watching the recorded inputs.",
        action: finished ? "Return to attempt" : paused ? "Play replay" : "Playing replay",
      };
  }
}

function prisonStatus(view: SessionSnapshot): string {
  const { state, paused, finished, events } = view;
  if (finished) {
    if (state.status === "running") return "Time’s up. Jump at a wall to turn around and climb.";

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
  if (state.player.wall !== 0) return "Jump off the wall to reverse direction and reach the ledge.";
  if (state.player.direction === -1) return "Land on the ledge, then jump over the upper saw.";
  if (state.collectedTreasureIds.length > 0)
    return "One treasure left. Reach the far wall, then jump back onto the ledge.";

  return "Jump over the floor saw. You need both treasures to escape.";
}
