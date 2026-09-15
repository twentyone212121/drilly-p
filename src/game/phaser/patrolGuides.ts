import type { EditorObject, Level } from "../../../shared/game/types";

/** Browser vectors keep editing guides smooth independently of canvas resolution. */
export function createPatrolGuides(canvas: HTMLCanvasElement) {
  const host = canvas.parentElement!;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("shape-rendering", "geometricPrecision");
  Object.assign(svg.style, {
    position: "absolute",
    pointerEvents: "none",
    zIndex: "5",
    display: "none",
  });
  host.append(svg);
  function position() {
    if (svg.style.display === "none") return;
    const rect = canvas.getBoundingClientRect();
    const parent = host.getBoundingClientRect();
    Object.assign(svg.style, {
      left: `${rect.left - parent.left}px`,
      top: `${rect.top - parent.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }
  const resize = new ResizeObserver(position);
  resize.observe(canvas);
  resize.observe(host);
  const layout = new MutationObserver(position);
  layout.observe(canvas, { attributes: true, attributeFilter: ["style"] });
  return {
    update(
      object: EditorObject | null | undefined,
      room: Level,
      invalid: boolean,
    ) {
      if (
        object?.kind !== "obstacle" ||
        (object.value.kind !== "drone" && object.value.kind !== "slider")
      ) {
        svg.style.display = "none";
        return;
      }
      const o = object.value;
      const color = invalid ? "#ff568e" : "#82edf5";
      svg.setAttribute("viewBox", `0 0 ${room.width} ${room.height}`);
      svg.innerHTML = `<g fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="${o.x - o.radius}" y="${o.y - o.radius}" width="${o.radius * 2}" height="${o.radius * 2}" rx="1"/>
        <path d="M${o.x} ${o.y}L${o.endX} ${o.endY}"/>
        <circle cx="${o.endX}" cy="${o.endY}" r="${o.radius}"/>
        <circle cx="${o.endX}" cy="${o.endY}" r="8" fill="#102733"/>
        <path d="M${o.endX - 3} ${o.endY}h6M${o.endX} ${o.endY - 3}v6"/>
      </g>`;
      svg.style.display = "block";
      position();
    },
    destroy() {
      resize.disconnect();
      layout.disconnect();
      svg.remove();
    },
  };
}
