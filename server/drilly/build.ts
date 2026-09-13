import * as v from "valibot";
import { describeRules, RULES } from "../../shared/game/rules";
import { DRILLY_ERRORS } from "../../shared/game/drillyErrors";
import {
  parseBuildContext,
  parseDrillyEdit,
  parseDrillyStrategy,
} from "../../shared/validation";
import type { BuiltDungeon } from "../../shared/game/drilly";
import { withDeadline } from "./deadline";
import { practiceRoom } from "./proof";
import type { Planner } from "./protocol";
import { roomShape, similarRooms } from "./variety";
import { buildSchema } from "./buildSchema";
import { applyEdit, emptyWorkspace } from "./construction";
import { designBrief, DESIGNER_INSTRUCTIONS } from "./buildBrief";

export type BuildProgress = {
  edit: number;
  stage: "validation" | "practice" | "checkpoint" | "finish";
  result: "passed" | "failed";
  reason?: string;
  tick?: number;
  outcome?: string;
};

type Checkpoint = BuiltDungeon & { quality: number };

export async function buildDungeon(
  plan: Planner,
  context: unknown = { recentRaids: [] },
  onProgress: (progress: BuildProgress) => void = () => {},
): Promise<BuiltDungeon> {
  const learning = parseBuildContext(context);
  const boundedPlan = withDeadline(plan, RULES.drilly.buildThinkingTimeoutMs);
  const { budget, recentRooms, inspiration, hazardInspiration } =
    designBrief(learning);
  let working = emptyWorkspace();
  let checkpoint: Checkpoint | undefined;
  let bestChallenge: Checkpoint | undefined;
  let feedback: unknown = null;
  let challengeEdits = 0;

  for (let edit = 1; edit <= RULES.drilly.buildEdits; edit++) {
    let output: unknown;
    try {
      output = await boundedPlan(
        DESIGNER_INSTRUCTIONS,
        {
          rules: describeRules(),
          budget,
          inspiration,
          hazardInspiration,
          workspace: working,
          checkpoint: checkpoint
            ? {
                level: checkpoint.level,
                proof: {
                  endTick: checkpoint.proof.endTick,
                  jumpCount: checkpoint.proof.jumpTicks.length,
                },
              }
            : null,
          challengeReady: Boolean(bestChallenge),
          editsRemaining: RULES.drilly.buildEdits - edit + 1,
          nextStep: checkpoint
            ? challengeEdits > 0
              ? "Improve the challenge or finish with a distinctive title."
              : "Now add a readable hazard to the proven route. Preserve its spatial idea, and choose a distinctive title."
            : "Create a playable route following the inspiration. Ordinary running may complete this first stage: hazards will create the challenge next. Do not add stairs merely to force a jump. Invent a short title.",
          movement: {
            jumpHeight: Math.floor(RULES.jumpSpeed ** 2 / (2 * RULES.gravity)),
            jumpDistance: Math.floor(
              ((2 * RULES.jumpSpeed) / RULES.gravity) * RULES.runSpeed,
            ),
            advice:
              "Use rises well below maximum, a broad approach before the first ledge (usually x >= 220), and broad landing tops. Low ceilings block ascent. A wall jump reverses direction. Floor top supporting spawn is y=420. Do not target full-height wall tops.",
          },
          learning: {
            recentRooms: recentRooms.map(roomShape),
            recentRaids: learning.recentRaids.map(({ level, ...result }) => ({
              ...result,
              room: roomShape(level),
            })),
          },
          feedback,
        },
        {
          schema: buildSchema(
            budget,
            Boolean(bestChallenge) && challengeEdits > 0,
          ),
          schemaName: "drilly_edit",
          reasoning: "low",
        },
      );
    } catch (error) {
      // A late provider failure must not erase a room already built and cleared.
      if (!bestChallenge) throw error;
      onProgress({
        edit,
        stage: "finish",
        result: "passed",
        reason: "using-proven-checkpoint",
      });
      return publish(bestChallenge);
    }

    let command: ReturnType<typeof parseDrillyEdit>;
    let strategy: ReturnType<typeof parseDrillyStrategy>;
    try {
      command = parseDrillyEdit(output);
      if (command.action === "finish") {
        if (bestChallenge) return publish(bestChallenge, command.name);
        feedback = {
          reason:
            "No playable challenge yet. Edit the route; the empty workspace cannot be published.",
        };
        continue;
      }
      const proposal = applyEdit(
        command.base === "checkpoint" && checkpoint
          ? checkpoint.level
          : working,
        command,
        budget,
      );
      strategy = parseDrillyStrategy(command.strategy, proposal);
      if (checkpoint) challengeEdits++;
      working = proposal;
    } catch (error) {
      onProgress({
        edit,
        stage: "validation",
        result: "failed",
        reason: "invalid-edit",
      });
      feedback = {
        edit: output,
        issues: validationIssues(error),
        reason:
          "Repair only the invalid edit. Workspace and checkpoint are unchanged.",
      };
      continue;
    }

    const practice = await practiceRoom(working, strategy);
    const repeated = recentRooms.some((room) => similarRooms(working, room));
    onProgress({
      edit,
      stage: "practice",
      result: practice.cleared ? "passed" : "failed",
      tick: practice.replay.endTick,
      outcome: practice.feedback.outcome,
    });
    const hasHazard =
      working.traps.length + (working.obstacles?.length ?? 0) > 0;
    const quality =
      practice.timingScore +
      (repeated ? 0 : RULES.drilly.novelRoomBonus) +
      (hasHazard ? RULES.drilly.hazardRoomBonus : 0);
    if (practice.cleared) {
      checkpoint = {
        level: structuredClone(working),
        proof: practice.replay,
        quality,
      };
      if (
        practice.meaningful &&
        (!bestChallenge || quality >= bestChallenge.quality)
      )
        bestChallenge = checkpoint;
      onProgress({ edit, stage: "checkpoint", result: "passed" });
    }
    feedback = {
      idea: command.idea,
      cleared: practice.cleared,
      meaningful: practice.meaningful,
      timingVariantsCleared: practice.timingScore,
      similarToRecentRoom: repeated,
      contacts: practice.landings,
      attempt: practice.feedback,
      checkpointAvailable: Boolean(checkpoint),
      challengeReady: Boolean(bestChallenge),
      advice: practice.cleared
        ? "Keep the route. Add danger if auto-running still wins. Increase warning/landing space if timing is tight; vary the journey if similar to recent rooms. Finish when challengeReady is true."
        : "Repair the failing crossing shown by the actual contacts. Do not restart the whole room. You can also return to checkpoint before trying a different edit.",
    };
  }
  if (bestChallenge) return publish(bestChallenge);
  throw new Error(DRILLY_ERRORS.unproven);
}

function publish(
  checkpoint: Checkpoint,
  name = checkpoint.level.name,
): BuiltDungeon {
  const level = { ...checkpoint.level, name };
  return { level, proof: { ...checkpoint.proof, level } };
}

function validationIssues(error: unknown) {
  return v.isValiError(error)
    ? error.issues.slice(0, 8).map((issue) => ({
        path: issue.path?.map((part) => part.key).join("."),
        message: issue.message,
      }))
    : [{ message: error instanceof Error ? error.message : "Invalid edit." }];
}
