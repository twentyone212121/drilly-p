import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { openAIPlanner } from "../convex/lib/drilly/provider";
import { buildDungeon } from "../convex/lib/drilly/build";
import { playRaidAttempt } from "../convex/lib/drilly/raid";
import type { Planner } from "../convex/lib/drilly/protocol";
import type { RaidAttempt } from "../shared/game/round";
import { RULES } from "../shared/game/rules";
import { parseDrillyModel } from "../shared/validation";
import { replayAttempt } from "../shared/game/replay";
import { drillyCases } from "./evals/drilly-cases";
import type { BuildProgress } from "../convex/lib/drilly/build";

// Explicit opt-in: ordinary npm test never calls a paid provider.
const args = process.argv.slice(2);
if (!args.includes("--live"))
  throw new Error(
    "Use --live to run paid model evaluations. Optional: --deployment <dev name>, --model <model id>, --cases saws,wall,spikes,slider,prison,build --report /tmp/drilly-eval.json",
  );
const option = (name: string) => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return value;
};
const deployment = option("--deployment");
function setting(name: string) {
  return deployment
    ? execFileSync("npx", ["convex", "env", "get", name, "--deployment", deployment], {
        encoding: "utf8",
      }).trim() || undefined
    : process.env[name];
}
const requestedModel = option("--model");
const model = requestedModel
  ? parseDrillyModel(requestedModel)
  : (setting("DRILLY_MODEL") ?? RULES.drilly.defaultModel);
const base = openAIPlanner(setting("OPENAI_API_KEY"), model);
const selected = (option("--cases") ?? "saws,wall,spikes").split(",");
if (
  selected.length > 6 ||
  selected.some((k) => k !== "build" && !Object.keys(drillyCases).includes(k))
)
  throw new Error("Unknown or excessive evaluation cases.");
const reports: Array<Record<string, unknown>> = [];
const report = option("--report");
function writeReport() {
  if (report)
    writeFileSync(
      report,
      JSON.stringify(
        {
          model,
          completionController: "direct-inputs-v1",
          reports,
        },
        null,
        2,
      ),
    );
}
for (const name of selected) {
  const calls: { input: unknown; output?: unknown; error?: string; seconds?: number }[] = [];
  const attempts: RaidAttempt[] = [];
  const progress: BuildProgress[] = [];
  const entry: Record<string, unknown> = {
    case: name,
    status: "running",
    decisions: calls,
    progress,
    recordings: attempts,
  };
  reports.push(entry);
  const planner: Planner = async (instructions, input, options) => {
    const call: (typeof calls)[number] = { input };
    const started = Date.now();
    calls.push(call);
    try {
      call.output = await base(instructions, input, options);
      return call.output;
    } catch (error) {
      call.error = error instanceof Error ? error.message : "Unknown failure";
      throw error;
    } finally {
      call.seconds = (Date.now() - started) / 1000;
      writeReport();
    }
  };
  const start = Date.now();
  let summary: Record<string, unknown>;
  try {
    if (name === "build") {
      const built = await buildDungeon(planner, (event) => {
        progress.push(event);
        writeReport();
      });
      const room = built.level;
      summary = {
        case: name,
        passed: replayAttempt(built.proof).stopReason === "won",
        room,
        proof: built.proof,
      };
    } else {
      const level = drillyCases[name as keyof typeof drillyCases];
      while (attempts.length < RULES.raidAttempts) {
        const attempt = await playRaidAttempt(level, planner, attempts);
        attempts.push(attempt);
        writeReport();
        if (attempt.outcome === "won") break;
      }
      const valid = attempts.every((a) => replayAttempt(a.replay).stopReason === a.outcome);
      summary = {
        case: name,
        passed: valid && attempts.some((a) => a.outcome === "won"),
        replaysValid: valid,
        attempts: attempts.map((a) => ({
          outcome: a.outcome,
          ticks: a.replay.endTick,
          jumps: a.replay.jumpTicks,
        })),
        recordings: attempts,
      };
    }
  } catch (error) {
    summary = {
      case: name,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown failure",
    };
  }
  summary.seconds = Math.round((Date.now() - start) / 100) / 10;
  summary.calls = calls.length;
  const { recordings: _recordings, room: _room, proof: _proof, ...compact } = summary;
  void [_recordings, _room, _proof];
  console.log(JSON.stringify(compact));
  Object.assign(entry, summary, { status: "complete" });
  writeReport();
}
if (reports.some((r) => !r.passed)) process.exitCode = 1;
