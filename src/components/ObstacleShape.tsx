import type { Level } from "../../shared/game/types";
import type { Obstacle } from "../../shared/game/obstacleTypes";
import { obstacleBounds, flameBounds } from "../../shared/game/obstacles";
import propsAtlas from "../../public/assets/environment/computer-props.json";

export function ObstacleShape({ obstacle }: { obstacle: Obstacle }) {
  const bounds = obstacleBounds(obstacle);
  if (obstacle.kind === "slider") {
    const f = propsAtlas.frames.saw.frame;
    return (
      <svg
        {...bounds}
        viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`}
        overflow="hidden"
        pointerEvents="none"
        aria-hidden="true"
      >
        <image
          href="/assets/environment/computer-props.png"
          width={propsAtlas.meta.size.w}
          height={propsAtlas.meta.size.h}
        />
      </svg>
    );
  }
  return (
    <image
      {...bounds}
      href={`/assets/obstacles/${obstacle.kind}.${obstacle.kind === "turret" ? "png" : "svg"}`}
      transform={
        obstacle.kind === "turret" && obstacle.direction === -1
          ? `translate(${obstacle.x * 2} 0) scale(-1 1)`
          : undefined
      }
      preserveAspectRatio="none"
      pointerEvents="none"
    />
  );
}

export function ObstacleGuides({ obstacle: o, level }: { obstacle: Obstacle; level: Level }) {
  return (
    <g pointerEvents="none" fill="none" stroke="#61e0eb" strokeWidth="1.5" strokeDasharray="6 4">
      {(o.kind === "slider" || o.kind === "drone") && (
        <>
          <path d={`M${o.x} ${o.y}L${o.endX} ${o.endY}`} />
          <circle cx={o.endX} cy={o.endY} r={o.radius} />
        </>
      )}
      {o.kind === "pursuer" && (
        <>
          <circle cx={o.x} cy={o.y} r={o.detectionRange} />
          <circle cx={o.x} cy={o.y} r={o.chaseRange} stroke="#ee5fb9" />
        </>
      )}
      {o.kind === "turret" &&
        (o.mode === "aimed" ? (
          <circle cx={o.x} cy={o.y} r={o.range} />
        ) : o.mode === "flame" ? (
          <rect {...flameBounds(o, level)} stroke="#ffb15b" />
        ) : (
          <path d={`M${o.x} ${o.y}h${o.direction * o.range}`} stroke="#ee5fb9" />
        ))}
    </g>
  );
}
