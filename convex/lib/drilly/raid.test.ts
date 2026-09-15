import { expect, it, vi } from "vitest";
import { replayAttempt, runAttempt } from "../../../shared/game/replay";
import { RULES } from "../../../shared/game/rules";
import { newPlayerDungeon } from "../../../shared/game/rooms";
import { getExampleRoom } from "../../../shared/testing/rooms";
import type { RaidAttempt } from "../../../shared/game/round";
import type { ModelCall } from "./model";
import { playRaidAttempt } from "./raid";

it("executes exactly the model's inputs, retaining ignored jumps and stopping at the actual outcome", async () => {
  const level = getExampleRoom();
  const jumpTicks = [0, 1, RULES.maxTicks - 1];
  const callModel = vi.fn<ModelCall>(async () => ({ jumpTicks }));
  const expected = runAttempt(level, jumpTicks);
  const attempt = await playRaidAttempt(level, callModel);
  const replay = replayAttempt(attempt.replay);

  expect(callModel).toHaveBeenCalledTimes(1);
  expect(attempt.outcome).toBe(expected.stopReason);
  expect(attempt.replay.jumpTicks).toEqual(jumpTicks.filter((tick) => tick < expected.state.tick));
  expect(replay.state).toEqual(expected.state);
  expect(replay.events).toContainEqual({ type: "jump-ignored", tick: 1, reason: "airborne" });
});

it("uses only previous scored failures as feedback and refuses further attempts after the raid ends", async () => {
  const level = getExampleRoom();
  const callModel = vi.fn<ModelCall>(async () => ({ jumpTicks: [] }));
  const attempts: RaidAttempt[] = [];
  for (let index = 0; index < RULES.raidAttempts; index++) {
    attempts.push(await playRaidAttempt(level, callModel, attempts));
  }

  expect(attempts.every((attempt) => attempt.outcome === "dead")).toBe(true);
  expect(callModel.mock.calls[1][1]).toMatchObject({
    attempt: 2,
    previousAttempts: [{ outcome: "dead", jumpTicks: [], tick: attempts[0].replay.endTick }],
  });
  await expect(playRaidAttempt(level, callModel, attempts)).rejects.toThrow("already finished");
  expect(callModel).toHaveBeenCalledTimes(RULES.raidAttempts);

  const easyRoom = newPlayerDungeon();
  const win = await playRaidAttempt(easyRoom, callModel);
  expect(win.outcome).toBe("won");
  await expect(playRaidAttempt(easyRoom, callModel, [win])).rejects.toThrow("already finished");
});

it("rejects invalid inputs and forged failure feedback without repairing them or calling the model again", async () => {
  const level = getExampleRoom();
  const callModel = vi.fn<ModelCall>(async () => ({ jumpTicks: [2, 1] }));
  await expect(playRaidAttempt(level, callModel)).rejects.toThrow("increasing order");
  expect(callModel).toHaveBeenCalledTimes(1);

  const loss = await playRaidAttempt(level, async () => ({ jumpTicks: [] }));
  callModel.mockClear();
  await expect(
    playRaidAttempt(level, callModel, [
      {
        ...loss,
        replay: { ...loss.replay, endTick: 1 },
      },
    ]),
  ).rejects.toThrow("does not match");
  expect(callModel).not.toHaveBeenCalled();
});
