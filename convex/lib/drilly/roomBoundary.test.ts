import { getExampleRoom } from "../../../shared/testing/rooms";
import { expect, it } from "vitest";
import { runAttempt } from "../../../shared/game/replay";
import { RULES } from "../../../shared/game/rules";
import { parseDrillyBuild } from "../../../shared/validation";

function openRoom() {
  const room = getExampleRoom();
  room.platforms = [{ id: "floor", x: 0, y: 420, width: room.width, height: 24 }];
  return room;
}

it("adds full-height sides outside the interior budget without mutating or duplicating a proposal", () => {
  const original = openRoom();
  const snapshot = structuredClone(original);
  const room = parseDrillyBuild({ level: original }, original);
  expect(room.platforms).toEqual([
    original.platforms[0],
    { id: "boundary-left", x: 0, y: 0, width: 12, height: 480 },
    { id: "boundary-right", x: 888, y: 0, width: 12, height: 480 },
  ]);
  expect(original).toEqual(snapshot);
  expect(parseDrillyBuild({ level: room }, original)).toEqual(room);
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
    const contact = waiting.events.find((event) => event.type === "wall-contact")!;
    const jump = contact.tick + 3;
    const upward = runAttempt(room, [jump], jump + 1);
    expect(upward.state.player).toMatchObject({ direction, wall: direction, grounded: false });
    expect(upward.state.player.y).toBeLessThan(waiting.state.player.y);
    expect(upward.events).toContainEqual({ type: "jumped", kind: "ground", tick: jump });
    const reversed = runAttempt(room, [jump, jump + 1], jump + 8);
    expect(reversed.state.player.direction).toBe(-direction);
    expect(reversed.events).toContainEqual({
      type: "jumped",
      kind: "wall",
      tick: jump + 1,
    });
    expect(runAttempt(room, [jump, jump + 1], jump + 8)).toEqual(reversed);
  },
);

it("rejects treasure buried in a fixed wall", () => {
  const room = openRoom();
  room.treasures[0].x = 4;
  expect(() => parseDrillyBuild({ level: room }, room)).toThrow("inside the side walls");
});
