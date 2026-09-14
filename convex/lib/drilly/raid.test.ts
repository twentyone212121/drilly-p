import { expect, it, vi } from "vitest";
import { replayAttempt, runAttempt } from "../../../shared/game/replay";
import { RULES } from "../../../shared/game/rules";
import { newPlayerDungeon } from "../../../shared/game/rooms";
import { getExampleRoom } from "../../../shared/testing/rooms";
import type { RaidAttempt } from "../../../shared/game/round";
import type { Planner } from "./protocol";
import { playRaidAttempt } from "./raid";

it("executes exactly the model's inputs, retaining ignored jumps and stopping at the actual outcome", async () => {
  const level = getExampleRoom();
  const jumpTicks = [0, 1, RULES.maxTicks - 1];
  const plan = vi.fn<Planner>(async () => ({ jumpTicks }));
  const expected = runAttempt(level, jumpTicks);
  const attempt = await playRaidAttempt(level, plan);
  const replay = replayAttempt(attempt.replay);

  expect(plan).toHaveBeenCalledTimes(1);
  expect(attempt.outcome).toBe(expected.stopReason);
  expect(attempt.replay.jumpTicks).toEqual(jumpTicks.filter((tick) => tick < expected.state.tick));
  expect(replay.state).toEqual(expected.state);
  expect(replay.events).toContainEqual({ type: "jump-ignored", tick: 1, reason: "airborne" });
});

it("uses only previous scored failures as feedback and refuses further attempts after the raid ends", async () => {
  const level = getExampleRoom();
  const plan = vi.fn<Planner>(async () => ({ jumpTicks: [] }));
  const attempts: RaidAttempt[] = [];
  for (let index = 0; index < RULES.raidAttempts; index++) {
    attempts.push(await playRaidAttempt(level, plan, attempts));
  }

  expect(attempts.every((attempt) => attempt.outcome === "dead")).toBe(true);
  expect(plan.mock.calls[1][1]).toMatchObject({
    attempt: 2,
    previousAttempts: [{ outcome: "dead", jumpTicks: [], tick: attempts[0].replay.endTick }],
  });
  await expect(playRaidAttempt(level, plan, attempts)).rejects.toThrow("already finished");
  expect(plan).toHaveBeenCalledTimes(RULES.raidAttempts);

  const easyRoom = newPlayerDungeon();
  const win = await playRaidAttempt(easyRoom, plan);
  expect(win.outcome).toBe("won");
  await expect(playRaidAttempt(easyRoom, plan, [win])).rejects.toThrow("already finished");
});

it("rejects invalid inputs and forged failure feedback without repairing them or calling the model again", async () => {
  const level = getExampleRoom();
  const plan = vi.fn<Planner>(async () => ({ jumpTicks: [2, 1] }));
  await expect(playRaidAttempt(level, plan)).rejects.toThrow("increasing order");
  expect(plan).toHaveBeenCalledTimes(1);

  const loss = await playRaidAttempt(level, async () => ({ jumpTicks: [] }));
  plan.mockClear();
  await expect(
    playRaidAttempt(level, plan, [
      {
        ...loss,
        replay: { ...loss.replay, endTick: 1 },
      },
    ]),
  ).rejects.toThrow("does not match");
  expect(plan).not.toHaveBeenCalled();
});
