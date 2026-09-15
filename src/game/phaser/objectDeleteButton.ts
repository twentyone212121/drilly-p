import type { Level, Rect } from "../../../shared/game/types";

/** DOM control stays crisp and touch-sized beside the scaled canvas selection. */
export function createObjectDeleteButton(
  canvas: HTMLCanvasElement,
  onDelete: () => void,
  onRotate: () => void,
) {
  const host = canvas.parentElement!;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "object-delete";
  button.setAttribute("aria-label", "Delete selected object");
  button.title = "Delete";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>';
  button.hidden = true;
  button.addEventListener("click", onDelete);
  host.append(button);
  const rotate = document.createElement("button");
  rotate.type = "button";
  rotate.className = "object-delete object-rotate";
  rotate.setAttribute("aria-label", "Rotate obstacle 90 degrees");
  rotate.title = "Rotate 90°";
  rotate.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path/></svg>';
  const directionPath = rotate.querySelector("path")!;
  rotate.hidden = true;
  rotate.addEventListener("click", onRotate);
  host.append(rotate);
  let canRotate = false;
  let bounds: Rect | null = null;
  let level: Level | null = null;

  function position() {
    button.hidden = !bounds || !level;
    rotate.hidden = button.hidden || !canRotate;
    if (!bounds || !level) return;
    const rect = canvas.getBoundingClientRect();
    const parent = host.getBoundingClientRect();
    const x =
      rect.left -
      parent.left +
      ((bounds.x + bounds.width) * rect.width) / level.width +
      6;
    const y =
      rect.top - parent.top + (bounds.y * rect.height) / level.height - 44;
    button.style.left = `${Math.max(4, Math.min(host.clientWidth - (canRotate ? 88 : 44), x))}px`;
    rotate.style.left = `${parseFloat(button.style.left) + 44}px`;
    button.style.top = `${Math.max(4, Math.min(host.clientHeight - 44, y))}px`;
    rotate.style.top = button.style.top;
  }

  const resize = new ResizeObserver(position);
  resize.observe(host);
  resize.observe(canvas);
  return {
    update(
      next: Rect | null,
      room: Level,
      rotatable = false,
      horizontalOnly = false,
    ) {
      rotate.setAttribute(
        "aria-label",
        horizontalOnly
          ? "Reverse turret direction"
          : "Rotate obstacle 90 degrees",
      );
      rotate.title = horizontalOnly ? "Switch left / right" : "Rotate 90°";
      directionPath.setAttribute(
        "d",
        horizontalOnly
          ? "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"
          : "M20 10a8 8 0 1 0-1 7M20 4v6h-6",
      );
      canRotate = rotatable;
      bounds = next;
      level = room;
      position();
    },
    destroy() {
      resize.disconnect();
      button.remove();
      rotate.remove();
    },
  };
}
