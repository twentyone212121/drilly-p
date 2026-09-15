import type { ObstacleKind } from "../../shared/game/obstacleTypes";
import type { Tool } from "../game/phaser/editorInput";
import { GameSprite } from "./GameArt";

const tools: {
  tool: Exclude<Tool, "select">;
  label: string;
  obstacleKind?: ObstacleKind;
}[] = [
  { tool: "platform", label: "Platform" },
  { tool: "treasure", label: "Treasure" },
  { tool: "obstacle", obstacleKind: "spikes", label: "Spikes" },
  { tool: "saw", label: "Saw" },
  { tool: "obstacle", obstacleKind: "turret", label: "Turret" },
  { tool: "obstacle", obstacleKind: "drone", label: "Drone" },
  { tool: "obstacle", obstacleKind: "pursuer", label: "Pursuer" },
];

export function EditorTools({
  tool,
  obstacleKind,
  onChoose,
}: {
  tool: Tool;
  obstacleKind: ObstacleKind;
  onChoose: (tool: Tool, obstacleKind?: ObstacleKind) => void;
}) {
  return (
    <div
      className="editor-tools"
      role="toolbar"
      aria-label="Room editing tools"
    >
      {tools.map(({ tool: next, label, obstacleKind: variant }) => (
        <button
          key={label}
          className="editor-tool"
          aria-pressed={tool === next && (!variant || obstacleKind === variant)}
          onClick={() =>
            onChoose(
              tool === next && (!variant || obstacleKind === variant)
                ? "select"
                : next,
              variant,
            )
          }
        >
          {next === "saw" ? (
            <img src="/assets/obstacles/saw.svg" alt="" />
          ) : next !== "obstacle" ? (
            <GameSprite name={next} />
          ) : (
            <img src={`/assets/obstacles/${variant}.svg`} alt="" />
          )}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
