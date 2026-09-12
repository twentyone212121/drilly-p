import { useRef, useState, type PointerEvent } from "react";
import { RULES } from "../../shared/game/rules";
import type { Level } from "../../shared/game/types";
import {
  editorObjects,
  findObject,
  hitObject,
  moveObject,
  newObject,
  objectBounds,
  placementError,
  resizePlatform,
  type EditorObject,
  type ObjectKind,
  type Point,
  type Selection,
} from "../game/editor";
import type { Session } from "../game/session";

type Tool = "select" | ObjectKind;
type Drag = {
  pointerId: number;
  origin: Point;
  object: EditorObject;
  operation: "place" | "move" | "resize";
};

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "select", label: "Select / move" },
  { tool: "platform", label: "+ Platform" },
  { tool: "saw", label: "+ Saw" },
  { tool: "treasure", label: "+ Treasure" },
];

export function DungeonEditor({ session, level }: { session: Session; level: Level }) {
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState<EditorObject | null>(null);
  const [message, setMessage] = useState("");
  const drag = useRef<Drag | null>(null);
  const selected = findObject(level, selection);
  const objects = editorObjects(level);
  const error = preview ? placementError(level, preview) : null;

  function chooseTool(next: Tool) {
    drag.current = null;
    setTool(next);
    setPreview(null);
    setMessage("");
  }

  function pointAt(event: PointerEvent<SVGSVGElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * level.width) / bounds.width,
      y: ((event.clientY - bounds.top) * level.height) / bounds.height,
    };
  }

  function commit(object: EditorObject) {
    try {
      session.edit({ type: "put", object });
      setSelection({ kind: object.kind, id: object.value.id });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function deleteSelected() {
    if (!selection) return;

    session.edit({ type: "delete", selection });
    setSelection(null);
    setPreview(null);
    setMessage("");
  }

  function dragObject(point: Point, gesture: Drag): EditorObject {
    if (gesture.operation === "place") return newObject(level, gesture.object.kind, point);

    const delta = {
      x: point.x - gesture.origin.x,
      y: point.y - gesture.origin.y,
    };
    return gesture.operation === "resize"
      ? resizePlatform(gesture.object, delta)
      : moveObject(gesture.object, delta);
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || drag.current) return;

    event.preventDefault();
    event.currentTarget.focus();
    const point = pointAt(event);
    if (tool !== "select") {
      const object = newObject(level, tool, point);
      drag.current = {
        pointerId: event.pointerId,
        origin: point,
        object,
        operation: "place",
      };
      setPreview(object);
      setMessage("");
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const bounds = selected ? objectBounds(selected) : null;
    const resizing =
      selected?.kind === "platform" &&
      bounds !== null &&
      Math.abs(point.x - bounds.x - bounds.width) <= 12 &&
      Math.abs(point.y - bounds.y - bounds.height) <= 12;
    const object = resizing ? selected : hitObject(level, point);
    setSelection(object ? { kind: object.kind, id: object.value.id } : null);
    setMessage("");
    setPreview(null);

    if (object) {
      drag.current = {
        pointerId: event.pointerId,
        origin: point,
        object,
        operation: resizing ? "resize" : "move",
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const point = pointAt(event);
    const gesture = drag.current;
    if (gesture && gesture.pointerId === event.pointerId) {
      setPreview(dragObject(point, gesture));
    } else if (!gesture && tool !== "select") {
      setPreview(newObject(level, tool, point));
    }
  }

  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    commit(dragObject(pointAt(event), gesture));
    drag.current = null;
    setPreview(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function cancelDrag() {
    drag.current = null;
    setPreview(null);
  }

  return (
    <div className="dungeon-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Dungeon objects">
        {TOOLS.map(({ tool: next, label }) => (
          <button key={next} aria-pressed={tool === next} onClick={() => chooseTool(next)}>
            {label}
          </button>
        ))}
        <button disabled={!selected} onClick={deleteSelected}>
          Delete selected
        </button>
        <span className="hint">{RULES.editor.gridSize} px grid · room & spawn fixed</span>
      </div>
      <svg
        className={"editor-canvas tool-" + tool}
        viewBox={`0 0 ${level.width} ${level.height}`}
        role="img"
        aria-label="Dungeon editor. Select and drag objects. Drag the platform corner to resize. Arrow keys move the selected object; Delete removes it; Escape cancels."
        tabIndex={0}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
        onPointerLeave={() => {
          if (!drag.current) setPreview(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancelDrag();
            chooseTool("select");
            return;
          }

          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            cancelDrag();
            deleteSelected();
            return;
          }

          const directions: Record<string, Point> = {
            ArrowLeft: { x: -RULES.editor.gridSize, y: 0 },
            ArrowRight: { x: RULES.editor.gridSize, y: 0 },
            ArrowUp: { x: 0, y: -RULES.editor.gridSize },
            ArrowDown: { x: 0, y: RULES.editor.gridSize },
          };
          if (selected && directions[event.key] && !drag.current) {
            event.preventDefault();
            commit(moveObject(selected, directions[event.key]));
          }
        }}
      >
        <defs>
          <pattern
            id="editor-grid"
            width={RULES.editor.gridSize}
            height={RULES.editor.gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${RULES.editor.gridSize} 0 H 0 V ${RULES.editor.gridSize}`}
              fill="none"
              stroke="#45606f"
              strokeWidth="0.5"
              opacity="0.45"
            />
          </pattern>
        </defs>
        <rect width={level.width} height={level.height} fill="#151c27" />
        <rect width={level.width} height={level.height} fill="url(#editor-grid)" />
        {objects.map((object) => (
          <ObjectShape key={object.value.id} object={object} />
        ))}
        <rect
          x={level.spawn.x}
          y={level.spawn.y}
          width={RULES.playerWidth}
          height={RULES.playerHeight}
          rx="6"
          fill="#b7e9aa"
          stroke="#e7eee9"
          strokeDasharray="3 2"
        />
        <text x={level.spawn.x} y={level.spawn.y - 10} className="spawn-label">
          FIXED SPAWN →
        </text>
        {selected && <ObjectOutline object={selected} resize={tool === "select"} />}
        {preview && (
          <g opacity="0.65" pointerEvents="none">
            <ObjectShape object={preview} />
            <ObjectOutline object={preview} invalid={error !== null} />
          </g>
        )}
      </svg>
      <div className="editor-inspector">
        <label>
          Selected object
          <select
            value={selected?.value.id ?? ""}
            onChange={(event) => {
              const object = objects.find((item) => item.value.id === event.target.value);
              setSelection(object ? { kind: object.kind, id: object.value.id } : null);
              chooseTool("select");
            }}
          >
            <option value="">None</option>
            {objects.map((object) => (
              <option key={object.value.id} value={object.value.id}>
                {object.kind} · {object.value.id}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          {selected
            ? `${selected.value.id} · x ${selected.value.x}, y ${selected.value.y}`
            : "Click an object to select it."}
          {selected?.kind === "platform" &&
            ` · ${selected.value.width} × ${selected.value.height} · drag the corner to resize`}
        </p>
        <p className="hint object-counts">
          Platforms {level.platforms.length}/{RULES.editor.maxPlatforms} · Saws {level.traps.length}
          /{RULES.editor.maxSaws} · Treasures {level.treasures.length}/{RULES.editor.maxTreasures}
        </p>
      </div>
      <p className={error || message ? "editor-feedback invalid" : "editor-feedback"} role="status">
        {error ??
          (message ||
            (tool === "select"
              ? "Drag to move. Drag a selected platform’s bottom-right corner to resize. Arrow keys nudge; Delete removes."
              : "Move over the room to preview, then click to place. Escape returns to selection."))}
      </p>
    </div>
  );
}

function ObjectShape({ object }: { object: EditorObject }) {
  const value = object.value;
  if (object.kind === "saw") {
    return (
      <g>
        <circle
          cx={value.x}
          cy={value.y}
          r={object.value.radius}
          fill="#e58e76"
          stroke="#ffc0a6"
          strokeWidth="4"
          strokeDasharray="5 5"
        />
        <circle cx={value.x} cy={value.y} r="5" fill="#442e2d" />
      </g>
    );
  }

  const rect = object.value;
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx="3"
        fill={object.kind === "treasure" ? "#f1c76c" : "#34434f"}
        stroke={object.kind === "treasure" ? "#ffe2a0" : "#687e8b"}
      />
      {object.kind === "treasure" && (
        <rect
          x={rect.x + rect.width / 2 - 3}
          y={rect.y + rect.height / 2 - 5}
          width="6"
          height="10"
          fill="#9e753d"
        />
      )}
    </g>
  );
}

function ObjectOutline({
  object,
  invalid = false,
  resize = false,
}: {
  object: EditorObject;
  invalid?: boolean;
  resize?: boolean;
}) {
  const bounds = objectBounds(object);
  const color = invalid ? "#ff826e" : "#b7e9aa";
  return (
    <g pointerEvents="none">
      <rect {...bounds} fill="none" stroke={color} strokeWidth="2" strokeDasharray="6 3" />
      {resize && object.kind === "platform" && (
        <rect
          x={bounds.x + bounds.width - 6}
          y={bounds.y + bounds.height - 6}
          width="12"
          height="12"
          fill={color}
          stroke="#182719"
        />
      )}
    </g>
  );
}
