import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelCall, type ModelCall } from "../convex/lib/drilly/model";
import { buildDungeon } from "../convex/lib/drilly/build";
import {
  DUNGEON_DESIGNS,
  dungeonDesignBrief,
  selectDungeonDesign,
  type DungeonDesign,
} from "../convex/lib/drilly/designs";
import { playRaidAttempt } from "../convex/lib/drilly/raid";
import type { RaidAttempt } from "../shared/game/round";
import { RULES } from "../shared/game/rules";
import { parseDrillyModel } from "../shared/validation";
import { replayAttempt, runAttempt } from "../shared/game/replay";
import { drillyCases } from "./evals/drilly-cases";

const HELP = `Usage: npm run eval:drilly -- --live [options]
  --cases saws,wall,spikes,slider,prison,build (default: saws,wall,spikes)
  --deployment <dev name>   Read backend settings; omit to use process environment
  --model <model id>        Override the configured model
  --report /tmp/eval.json   Save briefs, layouts, model decisions, and recordings
  --seed <text>            Reproduce build card selection (not model output)
  --design seeded|all|baseline|${DUNGEON_DESIGNS.map((design) => design.id).join("|")}
                           Build only; default: seeded
  --compare                Pair each design with the old generic brief
  --help                   Show options without calling a provider

Each build makes at most two paid model calls. --design all --compare runs eight
builds (at most 16 calls). Failed runs are retained and cause a nonzero exit code.`;

const { values: options } = parseArgs({
  options: {
    live: { type: "boolean" },
    help: { type: "boolean" },
    deployment: { type: "string" },
    model: { type: "string" },
    cases: { type: "string" },
    report: { type: "string" },
    seed: { type: "string" },
    design: { type: "string" },
    compare: { type: "boolean" },
  },
});
if (options.help) {
  console.log(HELP);
  process.exit(0);
}
// Explicit opt-in: ordinary npm test never calls a paid provider.
if (!options.live) throw new Error(`Use --live to run paid model evaluations.\n${HELP}`);

type EvalRun =
  | { name: "build"; seed: string; design: DungeonDesign | null }
  | { name: keyof typeof drillyCases };

const selected = (options.cases ?? "saws,wall,spikes").split(",");
if (
  selected.length > 6 ||
  new Set(selected).size !== selected.length ||
  selected.some((name) => name !== "build" && !Object.hasOwn(drillyCases, name))
)
  throw new Error("Unknown, repeated, or excessive evaluation cases.");
if (!selected.includes("build") && (options.design || options.seed || options.compare))
  throw new Error("--design, --seed, and --compare require --cases build.");

const baseSeed = options.seed ?? crypto.randomUUID();
const designOption = options.design ?? "seeded";
const chosenDesign = DUNGEON_DESIGNS.find((design) => design.id === designOption);
if (!["seeded", "all", "baseline"].includes(designOption) && !chosenDesign)
  throw new Error(`Unknown design: ${designOption}. Use --help to list designs.`);
if (designOption === "baseline" && options.compare)
  throw new Error("Choose a design to compare with baseline.");

const runs: EvalRun[] = [];
for (const name of selected) {
  if (name !== "build") {
    runs.push({ name: name as keyof typeof drillyCases });
    continue;
  }
  const designs =
    designOption === "all"
      ? DUNGEON_DESIGNS
      : [designOption === "baseline" ? null : (chosenDesign ?? selectDungeonDesign(baseSeed))];
  for (const [index, design] of designs.entries()) {
    const seed = designOption === "all" ? `${baseSeed}-${design!.id}` : baseSeed;
    const pair: EvalRun[] = [{ name: "build", seed, design }];
    if (options.compare) {
      const baseline: EvalRun = { name: "build", seed, design: null };
      // Alternate ordering so neither variant always gets the earlier request.
      if (index % 2 === 0) pair.unshift(baseline);
      else pair.push(baseline);
    }
    runs.push(...pair);
  }
}

const deployment = options.deployment;
function setting(name: string) {
  return deployment
    ? execFileSync("npx", ["convex", "env", "get", name, "--deployment", deployment], {
        encoding: "utf8",
      }).trim() || undefined
    : process.env[name];
}
const requestedModel = options.model;
const model = requestedModel
  ? parseDrillyModel(requestedModel)
  : (setting("DRILLY_MODEL") ?? RULES.drilly.defaultModel);
const apiKey = setting("OPENAI_API_KEY");
const reports: Array<Record<string, unknown>> = [];
const report = options.report;
function writeReport() {
  if (report)
    writeFileSync(
      report,
      JSON.stringify(
        {
          model,
          seed: baseSeed,
          completionController: "direct-inputs-v1",
          reports,
        },
        null,
        2,
      ),
    );
}
for (const run of runs) {
  const { name } = run;
  const calls: {
    instructions: string;
    input: unknown;
    output?: unknown;
    error?: string;
    seconds?: number;
  }[] = [];
  const attempts: RaidAttempt[] = [];
  const entry: Record<string, unknown> = {
    case: name,
    status: "running",
    decisions: calls,
    recordings: attempts,
  };
  reports.push(entry);
  const logCall =
    (callModel: ModelCall): ModelCall =>
    async (instructions, input, output) => {
      const call: (typeof calls)[number] = { instructions, input };
      const started = Date.now();
      calls.push(call);
      try {
        call.output = await callModel(instructions, input, output);
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
    if (run.name === "build") {
      const brief = run.design
        ? dungeonDesignBrief(run.design)
        : "Build a readable room with a distinct spatial idea that requires an intentional jump.";
      Object.assign(entry, {
        seed: run.seed,
        design: run.design?.id ?? "baseline",
        brief,
      });
      writeReport();
      const callModel = logCall(
        createModelCall(apiKey, model, RULES.drilly.buildThinkingTimeoutMs),
      );
      const room = await buildDungeon(callModel, {
        seed: run.seed,
        brief,
      });
      entry.room = room;
      const attempt = await playRaidAttempt(room, callModel);
      attempts.push(attempt);
      const replay = replayAttempt(attempt.replay);
      const noJump = runAttempt(room, []);
      const replaysValid =
        replay.stopReason === attempt.outcome && replay.state.tick === attempt.replay.endTick;
      const jumps = replay.events.filter((event) => event.type === "jumped");
      summary = {
        case: name,
        passed: replaysValid && attempt.outcome === "won" && noJump.stopReason !== "won",
        replaysValid,
        proofOutcome: attempt.outcome,
        noJumpOutcome: noJump.stopReason,
        effectiveJumps: jumps.length,
        wallJumps: jumps.filter((event) => event.kind === "wall").length,
        treasuresCollected: replay.state.collectedTreasureIds.length,
        playSeconds: Math.round((attempt.replay.endTick / RULES.tickRate) * 10) / 10,
        room,
        proof: attempt.replay,
        routeEvents: replay.events.filter((event) =>
          ["jumped", "landed", "treasure-collected", "died", "won"].includes(event.type),
        ),
      };
    } else {
      const level = drillyCases[run.name];
      while (attempts.length < RULES.raidAttempts) {
        const callModel = logCall(
          createModelCall(apiKey, model, RULES.drilly.raidThinkingTimeoutMs),
        );
        const attempt = await playRaidAttempt(level, callModel, attempts);
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
  if (run.name === "build")
    Object.assign(summary, {
      seed: run.seed,
      design: run.design?.id ?? "baseline",
    });
  const {
    recordings: _recordings,
    room: _room,
    proof: _proof,
    routeEvents: _events,
    ...compact
  } = summary;
  void [_recordings, _room, _proof, _events];
  console.log(JSON.stringify(compact));
  Object.assign(entry, summary, { status: "complete" });
  writeReport();
}
if (reports.some((r) => !r.passed)) process.exitCode = 1;
