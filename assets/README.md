# Drilly P art

P's avatar is ESC, an ivory escape key with cyan eyes. Drilly is the floating
dark spiral drill virus with magenta eyes and lime accents (the right-hand
design in `references/drilly-virus.jpg`). Chip, Fan, and Byte are supporting
character options; their gameplay roles are not decided.

When Drilly took control of the computer, every key obeyed except ESC. Guided
by the human outside the screen, ESC escapes through Drilly's defenses and
builds dungeons for the AI to complete in return.

The setting is an old computer interior: circuit walls, heat sinks, cooling
shafts, and security gates. Keep the background dark and quiet so ESC reads
clearly. Cyan identifies ESC, magenta identifies Drilly and danger, and amber
marks collectible concepts. These are art conventions, not new mechanics.

- `references/`: selected user references only.
- `source/`: original selected artwork for reproducible exports; not shipped.
- `../public/assets/characters/`: transparent character pose strips.
- `../public/assets/backgrounds/`: reusable opaque background plates.
- `../public/assets/environment/`: six named computer prop frames.
- `prompts.json`: generation prompts and tool provenance.

Each character has three key poses. Drilly's
poses are hover, active, and defeated; ESC's are idle, jump, and land.
The renderer loads ESC, Drilly ghosts, platforms, saws, data pickups, and the
background with ambient fan and light animation. Sprite size and collisions remain the
renderer and simulation's responsibility respectively.

Only load files from `public/assets` in the game. The export script removes
baked backgrounds from the supporting character sources, trims empty space,
normalizes opacity, and scales poses together to preserve their relative size.
Gates are visual concepts; this kit does not introduce gate mechanics.

Walls and platforms use size-aware metal panels from
[`platformPanels.ts`](../src/game/art/platformPanels.ts), shared by gameplay and
the editor. Bevels, seams, and status lights retain consistent proportions as
platforms resize; the solid backing matches the collision rectangle exactly.
The original `wall` and `platform` atlas frames remain source-kit references,
but are no longer stretched over gameplay geometry. Panel geometry is built once
per room, with no per-tick texture generation or additional image downloads.

## Runtime format

Character poses use RGBA PNG atlases (384 × 128), with three poses in padded
128 × 128 cells.
Props use a 768 × 512 atlas with six padded 256 × 256 cells. JSON files use Phaser's
hash atlas format with tight frame rectangles and bottom-center pivots.
Padding stays outside frame rectangles to avoid texture bleeding.
The background is an opaque WebP bounded to 1600 × 900. Keep linear filtering
for this shaded artwork. The visible silhouette fits inside its frame; frame
dimensions must not be used as collision bounds.

```ts
// In the Phaser scene's preload method:
this.load.atlas(
  "esc",
  "/assets/characters/esc.png",
  "/assets/characters/esc.json",
);
// In create:
this.add.sprite(100, 100, "esc", "idle");
```

Drilly uses `hover`, `active`, and `defeated`; the other characters use `idle`,
`jump`, and `land`. Props use `platform`, `wall`, `saw`, `data`, `gate-closed`,
and `gate-open`. These frames are poses, not complete running animations.

## Rebuild

With Python 3 and the packages in `../scripts/art/requirements.txt` installed,
run `python3 scripts/art/export.py` from the repository root. The script can
also be invoked by absolute path. It overwrites only this kit's runtime files.
Retain originals in `source/`; do not edit generated exports by hand.

ESC runs with a steady idle keycap and separately animated feet cropped from that
atlas. The old full-body run source is retained for reference, but is not exported
or shipped. Jump and landing feedback follow simulation ticks. Death is an upright
electric shock with shaking and sparks before the next attempt.

## Obstacle artwork

The runtime uses original SVGs for saws, spike rows, turrets, drones, and pursuers.
They share graphite casings, cyan circuitry, and magenta energy accents. Spike rows
repeat teeth instead of stretching them; their mounting rail is solid. Turrets show
charging and firing, drones have animated fans, and pursuers have a tracking eye.
All effects follow simulation state and pause with it. The previous turret source
and generation prompt remain under `assets/` as design references.

## ESC wall slide

The additional `esc-wall` atlas uses one `slide` pose with both hands braced
against a vertical wall. The built-in image generator used the original ESC
atlas as a reference; the [prompt and provenance](esc-wall-prompt.json) and
[source image](source/characters/esc-wall.png) are retained. The runtime PNG
preserves the generated alpha; its atlas selects the visible silhouette without
changing the image. It is separate from the original atlas export script.

The renderer anchors the palms to either wall, mirrors the pose, and adds tiny
friction sparks while descending. A quiet scrape loop follows the same sliding
condition and stops on jumping, landing, death, pause, or hidden tabs.
