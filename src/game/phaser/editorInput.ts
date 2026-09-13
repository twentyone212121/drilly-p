import type { ObstacleKind } from "../../../shared/game/obstacleTypes";
import type { Level } from "../../../shared/game/types";
import { RULES } from "../../../shared/game/rules";
import {
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
} from "../editor";
import type { Session } from "../session";

export type Tool = "select" | ObjectKind;
export type EditorState = {
  tool: Tool;
  obstacleKind: ObstacleKind;
  selection: Selection | null;
  message: string;
};
export const INITIAL_EDITOR: EditorState = {
  tool: "select",
  obstacleKind: "spikes",
  selection: null,
  message: "",
};
export type EditorOptions = {
  enabled: boolean;
  state: EditorState;
  onChange: (state: EditorState) => void;
};

type Drag = {
  pointerId: number;
  origin: Point;
  object: EditorObject;
  operation: "place" | "move" | "resize";
};

// DOM capture keeps releases/cancellation reliable outside the scaled canvas.
// Only selection, tool and changed feedback reach React; previews stay here.
export function createEditorInput(
  canvas: HTMLCanvasElement,
  session: Session,
  options: EditorOptions,
  draw: (
    selected: EditorObject | undefined,
    preview: EditorObject | null,
    invalid: boolean,
  ) => void,
  requestRender: () => void,
) {
  let level = session.getSnapshot().level;
  let drag: Drag | null = null;
  let pendingPoint: Point | null = null;
  let preview: EditorObject | null = null;
  let previewKey = "";

  function enabled() {
    return options.enabled && session.getSnapshot().phase === "build";
  }

  function publish(change: Partial<EditorState>) {
    const state = { ...options.state, ...change };
    if (JSON.stringify(state) === JSON.stringify(options.state)) return;
    options = { ...options, state };
    options.onChange(state);
  }

  function redraw() {
    draw(
      enabled() ? findObject(level, options.state.selection) : undefined,
      enabled() ? preview : null,
      Boolean(options.state.message),
    );
    requestRender();
  }

  function cancel() {
    const pointerId = drag?.pointerId;
    drag = null;
    pendingPoint = preview = null;
    previewKey = "";
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId))
      canvas.releasePointerCapture(pointerId);
    redraw();
  }

  function pointAt(event: PointerEvent): Point {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * level.width) / bounds.width,
      y: ((event.clientY - bounds.top) * level.height) / bounds.height,
    };
  }

  function objectAt(point: Point): EditorObject {
    if (!drag || drag.operation === "place")
      return newObject(
        level,
        drag?.object.kind ?? (options.state.tool as ObjectKind),
        point,
        options.state.obstacleKind,
      );
    const delta = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    return drag.operation === "resize"
      ? resizePlatform(drag.object, delta)
      : moveObject(drag.object, delta);
  }

  function commit(object: EditorObject) {
    try {
      session.edit({ type: "put", object });
      level = session.getSnapshot().editorLevel;
      publish({ selection: { kind: object.kind, id: object.value.id }, message: "" });
    } catch (error) {
      publish({ message: error instanceof Error ? error.message : String(error) });
    }
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || drag) return;
    if (!enabled()) {
      const view = session.getSnapshot();
      if (view.canPlay && !view.paused && view.mode === "human") session.jump();
      return;
    }
    event.preventDefault();
    level = session.getSnapshot().editorLevel;
    canvas.focus();
    const point = pointAt(event);
    const selected = findObject(level, options.state.selection);
    const bounds = selected && objectBounds(selected);
    // Keep the handle usable at every viewport size.
    const handle = (12 * level.width) / canvas.getBoundingClientRect().width;
    const resizing =
      selected?.kind === "platform" &&
      bounds &&
      Math.abs(point.x - bounds.x - bounds.width) <= handle &&
      Math.abs(point.y - bounds.y - bounds.height) <= handle;
    const placing = options.state.tool !== "select";
    const object = placing ? objectAt(point) : resizing ? selected : hitObject(level, point);
    publish({
      message: "",
      ...(placing
        ? {}
        : {
            selection: object ? { kind: object.kind, id: object.value.id } : null,
          }),
    });
    if (object) {
      drag = {
        pointerId: event.pointerId,
        origin: point,
        object,
        operation: placing ? "place" : resizing ? "resize" : "move",
      };
      canvas.setPointerCapture(event.pointerId);
      pendingPoint = point;
    }
    redraw();
  }

  function pointerMove(event: PointerEvent) {
    if (!enabled() || (drag && drag.pointerId !== event.pointerId)) return;
    if (drag || options.state.tool !== "select") {
      pendingPoint = pointAt(event);
      requestRender();
    }
  }

  function pointerUp(event: PointerEvent) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const object = objectAt(pointAt(event));
    // Clear capture before the commit can notify subscribers and change rooms.
    cancel();
    if (enabled()) commit(object);
    redraw();
  }

  function pointerCancel(event: PointerEvent) {
    if (!drag || drag.pointerId === event.pointerId) cancel();
  }

  function pointerLeave() {
    if (!drag) cancel();
  }

  function keyDown(event: KeyboardEvent) {
    if (!enabled() || event.isComposing) return;
    level = session.getSnapshot().editorLevel;
    if (event.key === "Escape" && (drag || options.state.tool !== "select")) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      publish({ tool: "select", message: "" });
      canvas.style.cursor = "grab";
      return;
    }
    const selected = findObject(level, options.state.selection);
    if (!selected) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      cancel();
      session.edit({ type: "delete", selection: options.state.selection! });
      publish({ selection: null, message: "" });
    }
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -RULES.editor.gridSize, y: 0 },
      ArrowRight: { x: RULES.editor.gridSize, y: 0 },
      ArrowUp: { x: 0, y: -RULES.editor.gridSize },
      ArrowDown: { x: 0, y: RULES.editor.gridSize },
    };
    if (directions[event.key] && !drag) {
      event.preventDefault();
      commit(moveObject(selected, directions[event.key]));
    }
    redraw();
  }

  canvas.tabIndex = 0;
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerCancel);
  canvas.addEventListener("lostpointercapture", pointerCancel);
  canvas.addEventListener("pointerleave", pointerLeave);
  canvas.addEventListener("keydown", keyDown);
  window.addEventListener("blur", cancel);

  return {
    setOptions(next: EditorOptions) {
      const changed =
        next.enabled !== options.enabled ||
        next.state.tool !== options.state.tool ||
        next.state.obstacleKind !== options.state.obstacleKind ||
        next.state.selection !== options.state.selection;
      options = next;
      if (changed) cancel();
      canvas.style.touchAction = enabled() ? "none" : "manipulation";
      canvas.setAttribute(
        "aria-label",
        enabled()
          ? "Select and drag objects. Arrow keys move; Delete removes; Escape cancels."
          : "Tap or Space to jump.",
      );
      canvas.style.cursor = enabled()
        ? options.state.tool === "select"
          ? "grab"
          : "crosshair"
        : "pointer";
      redraw();
    },
    setLevel(next: Level) {
      if (level === next) return;
      level = next;
      cancel();
    },
    flushPreview() {
      if (!pendingPoint || !enabled()) return;
      const object = objectAt(pendingPoint);
      pendingPoint = null;
      const key = JSON.stringify(object);
      if (key === previewKey) return;
      previewKey = key;
      preview = object;
      publish({ message: placementError(level, object) ?? "" });
      redraw();
    },
    destroy() {
      cancel();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      canvas.removeEventListener("lostpointercapture", pointerCancel);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("keydown", keyDown);
      window.removeEventListener("blur", cancel);
    },
  };
}
