import { getExampleRoom } from "../../../shared/testing/rooms";
import { expect, it, vi } from "vitest";
import { runAttempt } from "../../../shared/game/replay";
import { RULES } from "../../../shared/game/rules";
import { parseDrillyBuild } from "../../../shared/validation";
import { buildDungeon } from "./build";
import { roomEdit } from "../../../shared/testing/planner";

function openRoom() {
  const room = getExampleRoom();
  room.platforms = [
    { id: "floor", x: 0, y: 420, width: room.width, height: 24 },
  ];
  return room;
}

it("adds full-height sides outside the interior budget without mutating or duplicating a proposal", () => {
  const original = openRoom();
  const snapshot = structuredClone(original);
  const budget = { platforms: 1, hazards: 2, treasures: 1 };
  const room = parseDrillyBuild({ level: original }, original, budget);
  expect(room.platforms).toEqual([
    original.platforms[0],
    { id: "boundary-left", x: 0, y: 0, width: 24, height: 480 },
    { id: "boundary-right", x: 876, y: 0, width: 24, height: 480 },
  ]);
  expect(original).toEqual(snapshot);
  expect(parseDrillyBuild({ level: room }, original, budget)).toEqual(room);
});

it.each([-1, 1] as const)(
  "stops auto-running at side %i and reverses only on a replayable wall jump",
  (direction) => {
    const proposal = openRoom();
    proposal.spawn.direction = direction;
    proposal.traps = [{ id: "overhead", x: 450, y: 40, radius: 18 }];
    proposal.treasures[0].y = 100;
    const room = parseDrillyBuild({ level: proposal }, proposal);
    const waiting = runAttempt(room, [], 240);
    expect(waiting.stopReason).toBe("tick-limit");
    expect(waiting.state.player.wall).toBe(direction);
    expect(waiting.state.player.direction).toBe(direction);
    expect(waiting.state.player.x).toBe(
      direction === -1
        ? RULES.drilly.sideWallWidth
        : room.width - RULES.drilly.sideWallWidth - RULES.playerWidth,
    );
    const contact = waiting.events.find(
      (event) => event.type === "wall-contact",
    )!;
    const jump = contact.tick + 3;
    const reversed = runAttempt(room, [jump], jump + 8);
    expect(reversed.state.player.direction).toBe(-direction);
    expect(reversed.events).toContainEqual({
      type: "jumped",
      kind: "wall",
      tick: jump,
    });
    expect(runAttempt(room, [jump], jump + 8)).toEqual(reversed);
  },
);

it("proves and plays enclosed geometry when the designer omits both walls", async () => {
  const proposal = openRoom();
  let calls = 0;
  const plan = vi.fn(async () => ({
    ...roomEdit(proposal),
    action: ++calls > 1 ? "finish" : "edit",
  }));
  const built = await buildDungeon(plan);
  expect(built.level.platforms).toHaveLength(3);
  expect(built.proof.level).toEqual(built.level);
  expect(runAttempt(built.level, built.proof.jumpTicks).stopReason).toBe("won");
});

it("rejects treasure buried in a fixed wall", () => {
  const room = openRoom();
  room.treasures[0].x = 4;
  expect(() => parseDrillyBuild({ level: room }, room)).toThrow(
    "inside the side walls",
  );
});
