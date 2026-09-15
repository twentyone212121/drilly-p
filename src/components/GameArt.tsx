import props from "../../public/assets/environment/computer-props.json";

const sprites = {
  treasure: {
    atlas: "environment/computer-props",
    data: props,
    frame: props.frames.data.frame,
  },
  platform: {
    atlas: "environment/computer-props",
    data: props,
    frame: props.frames.platform.frame,
  },
};

export function GameSprite({
  name,
  className = "",
}: {
  name: keyof typeof sprites | "esc" | "drilly";
  className?: string;
}) {
  if (name === "esc" || name === "drilly") {
    return (
      <img
        className={`game-sprite ${className}`}
        src={`/assets/characters/${name}-portrait.svg`}
        alt=""
        aria-hidden="true"
      />
    );
  }
  const { atlas, data, frame } = sprites[name];
  return (
    <svg
      className={`game-sprite ${className}`}
      viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
      aria-hidden="true"
    >
      <image
        href={`/assets/${atlas}.png`}
        width={data.meta.size.w}
        height={data.meta.size.h}
      />
    </svg>
  );
}

const paths = {
  fullscreen: "M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6",
  "fullscreen-exit": "M3 9h6V3M15 3v6h6M9 21v-6H3M21 15h-6v6",
  play: "m8 4 13 8-13 8z",
  pause: "M7 5h3v14H7zM15 5h3v14h-3z",
  sound: "M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8M20 5q8 7 0 14",
  mute: "M3 9h4l5-4v14l-5-4H3zM17 9l5 6M22 9l-5 6",
  arrow: "M4 12h16m-7-7 7 7-7 7",
  replay: "M5 8a8 8 0 1 1-1 8M5 3v6h6",
  back: "M20 12H4m7-7-7 7 7 7",
  wrench:
    "m14 7 3-4a6 6 0 0 0-7 8l-7 7a2.8 2.8 0 0 0 4 4l7-7a6 6 0 0 0 8-7l-4 3z",
  medal: "M18 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM8 14l-2 8 6-3 6 3-2-8",
  check: "m4 12 5 5L21 5",
};

export function GameIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="game-icon"
      viewBox="0 0 24 24"
      fill={["play", "pause"].includes(name) ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
