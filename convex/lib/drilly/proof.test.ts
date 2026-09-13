import { getExampleRoom } from "../../../shared/testing/rooms";
import { it, expect } from "vitest";
import { newPlayerDungeon } from "../../../shared/game/rooms";
import { replayAttempt } from "../../../shared/game/replay";
import { practiceRoom } from "./proof";
import { playAttempt } from "./attempt";
import { directStrategy } from "../../../shared/testing/planner";

it("proves the room using the exact raid controller, not a separate perfect solver", async () => {
  const level = getExampleRoom();
  const strategy = directStrategy(level);
  const proof = await practiceRoom(level, strategy);
  const raid = await playAttempt(level, async () => strategy, []);
  expect(proof.cleared).toBe(true);
  expect(proof.meaningful).toBe(true);
  expect(proof.replay).toEqual(raid.attempt.replay);
  expect(replayAttempt(proof.replay).stopReason).toBe("won");
});

it("never labels an uncompleted room proven or removes its unreachable goal", async () => {
  const level = newPlayerDungeon();
  level.treasures[0].y = 10;
  const before = structuredClone(level);
  const proof = await practiceRoom(level, directStrategy(level));
  expect(proof.cleared).toBe(false);
  expect(proof.meaningful).toBe(false);
  expect(level).toEqual(before);
});

it("distinguishes empty scaffolding from a challenge", async () => {
  const level = newPlayerDungeon();
  const proof = await practiceRoom(level, directStrategy(level));
  expect(proof.cleared).toBe(true);
  expect(proof.meaningful).toBe(false);
});
