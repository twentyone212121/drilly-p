import type { ObstacleKind } from "../../shared/game/obstacleTypes";
import type { Tool } from "../game/phaser/editorInput";
import { GameIcon, GameSprite } from "./GameArt";

const tools: { tool: Tool; label: string; obstacleKind?: ObstacleKind }[] = [
  { tool: "select", label: "Move" },
  { tool: "platform", label: "Platform" },
  { tool: "saw", label: "Saw" },
  { tool: "treasure", label: "Treasure" },
  { tool: "obstacle", obstacleKind: "spikes", label: "Spikes" },
  { tool: "obstacle", obstacleKind: "slider", label: "Sliding saw" },
  { tool: "obstacle", obstacleKind: "turret", label: "Turret" },
  { tool: "obstacle", obstacleKind: "drone", label: "Drone" },
  { tool: "obstacle", obstacleKind: "pursuer", label: "Pursuer" },
];

export function EditorTools({
  tool,
  obstacleKind,
  hasSelection,
  onChoose,
  onDelete,
}: {
  tool: Tool;
  obstacleKind: ObstacleKind;
  hasSelection: boolean;
  onChoose: (tool: Tool, obstacleKind?: ObstacleKind) => void;
  onDelete: () => void;
}) {
  return (
    <div className="editor-tools" role="toolbar" aria-label="Room editing tools">
      {tools.map(({ tool: next, label, obstacleKind: variant }) => (
        <button
          key={label}
          className="editor-tool"
          aria-pressed={tool === next && (!variant || obstacleKind === variant)}
          onClick={() => onChoose(next, variant)}
        >
          {next === "select" ? (
            <GameIcon name="move" />
          ) : next !== "obstacle" ? (
            <GameSprite name={next} />
          ) : variant === "slider" ? (
            <GameSprite name="saw" />
          ) : (
            <img
              src={`/assets/obstacles/${variant}.${variant === "turret" ? "png" : "svg"}`}
              alt=""
            />
          )}
          <span>{label}</span>
        </button>
      ))}
      <button
        className="editor-tool delete-tool"
        onClick={onDelete}
        disabled={!hasSelection}
        aria-label="Delete selected object"
      >
        <GameIcon name="trash" />
        <span>Delete</span>
      </button>
    </div>
  );
}
