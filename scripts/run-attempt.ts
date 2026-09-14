import {
  obstacleRoom,
  OBSTACLE_CASES,
  type ObstacleCase,
} from "../shared/testing/obstacles";
import { readFileSync } from "node:fs";
import { parseLevel, parseJumpTicks, parseReplay } from "../shared/validation";
import { describeRules } from "../shared/game/rules";
import { replayAttempt, runAttempt } from "../shared/game/replay";
try {
  const [command, path, ticks = "[]"] = process.argv.slice(2);
  if (command === "--describe")
    console.log(JSON.stringify(describeRules(), null, 2));
  else if (
    command === "--lab" &&
    path &&
    OBSTACLE_CASES.some((room) => room === path)
  )
    console.log(
      JSON.stringify(
        runAttempt(
          obstacleRoom(path as ObstacleCase),
          parseJumpTicks(JSON.parse(ticks)),
        ),
        null,
        2,
      ),
    );
  else if (command === "--replay" && path)
    console.log(
      JSON.stringify(
        replayAttempt(parseReplay(JSON.parse(readFileSync(path, "utf8")))),
        null,
        2,
      ),
    );
  else if (command === "--level" && path)
    console.log(
      JSON.stringify(
        runAttempt(
          parseLevel(JSON.parse(readFileSync(path, "utf8"))),
          parseJumpTicks(JSON.parse(ticks)),
        ),
        null,
        2,
      ),
    );
  else
    throw new Error(
      "Usage: npm run run:attempt -- --describe | --replay <file> | --lab <showcase|spikes|slider|fixed|flame|aimed|drone|pursuer> '[13,86,140]' | --level <file> '[44, 199, 200]'",
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
