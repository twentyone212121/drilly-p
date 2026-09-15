import { afterEach, expect, it, vi } from "vitest";
import checkpoint from "../../../shared/levels/checkpoint.json";
import { parseLevel } from "../../../shared/validation";
import { applyEdit } from "../editor";
import type { Session } from "../session";
import {
  createEditorInput,
  INITIAL_EDITOR,
  type EditorOptions,
} from "./editorInput";

vi.mock("./objectDeleteButton", () => ({
  createObjectDeleteButton: () => ({ update() {}, destroy() {} }),
}));

vi.mock("./patrolGuides", () => ({
  createPatrolGuides: () => ({ update() {}, destroy() {} }),
}));

afterEach(() => vi.unstubAllGlobals());

it("finishes consecutive quick edits across redraws and equivalent selection updates", () => {
  vi.stubGlobal("window", new EventTarget());
  let level = parseLevel(checkpoint);
  const session = {
    getSnapshot: () => ({ phase: "build", level, editorLevel: level }),
    edit: (edit: Parameters<Session["edit"]>[0]) => {
      level = applyEdit(level, edit);
    },
  } as unknown as Session;
  const captured = new Set<number>();
  const canvas = Object.assign(new EventTarget(), {
    style: {},
    focus() {},
    setAttribute() {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: level.width,
      height: level.height,
    }),
    hasPointerCapture: (id: number) => captured.has(id),
    setPointerCapture: (id: number) => {
      captured.add(id);
    },
    releasePointerCapture: (id: number) => {
      captured.delete(id);
    },
  }) as unknown as HTMLCanvasElement;
  let options: EditorOptions = {
    enabled: true,
    state: { ...INITIAL_EDITOR, tool: "platform" },
    onChange: (state) => {
      options = { ...options, state };
    },
  };
  const delayedOptions = options;
  const editor = createEditorInput(
    canvas,
    session,
    options,
    () => {},
    () => {},
  );
  const pointer = (type: string, x: number, y: number) => {
    canvas.dispatchEvent(
      Object.assign(new Event(type), {
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  };
  // Release must use its own coordinates, even before a preview frame runs.
  pointer("pointerdown", 184, 96);
  pointer("pointerup", 200, 96);
  const id = options.state.selection!.id;
  expect(level.platforms.find((p) => p.id === id)?.x).toBe(200);
  pointer("pointerdown", 210, 104);
  editor.setLevel(level);
  editor.setOptions(delayedOptions);
  editor.setOptions({
    ...options,
    state: { ...options.state, selection: { ...options.state.selection! } },
  });
  pointer("lostpointercapture", 210, 104);
  captured.clear();
  pointer("lostpointercapture", 250, 152);
  window.dispatchEvent(
    Object.assign(new Event("pointerup"), {
      pointerId: 1,
      button: 0,
      clientX: 250,
      clientY: 152,
    }),
  );
  expect(level.platforms.find((p) => p.id === id)).toMatchObject({
    x: 240,
    y: 144,
  });
  editor.destroy();
});
