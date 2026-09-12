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

Each character has three key poses, not a finished animation cycle. Drilly's
poses are hover, active, and defeated; ESC's are idle, jump, and land.
The renderer loads ESC, Drilly ghosts, platforms, saws, data pickups, and the
background with ambient fan and light animation. Sprite size and collisions remain the
renderer and simulation's responsibility respectively.

Only load files from `public/assets` in the game. The export script removes
baked backgrounds from the supporting character sources, trims empty space,
normalizes opacity, and scales poses together to preserve their relative size.
Gates are visual concepts; this kit does not introduce gate mechanics.

## Runtime format

Characters use RGBA PNG atlases (384 × 128), with three poses in padded 128 × 128 cells.
Props use a 768 × 512 atlas with six padded 256 × 256 cells. JSON files use Phaser's
hash atlas format with tight frame rectangles and bottom-center pivots.
Padding stays outside frame rectangles to avoid texture bleeding.
The background is an opaque WebP bounded to 1600 × 900. Keep linear filtering
for this shaded artwork. The visible silhouette fits inside its frame; frame
dimensions must not be used as collision bounds.

```ts
// In the Phaser scene's preload method:
this.load.atlas('esc', '/assets/characters/esc.png', '/assets/characters/esc.json');
// In create:
this.add.sprite(100, 100, 'esc', 'idle');
```

Drilly uses `hover`, `active`, and `defeated`; the other characters use `idle`,
`jump`, and `land`. Props use `platform`, `wall`, `saw`, `data`, `gate-closed`,
and `gate-open`. These frames are poses, not complete running animations.

## Rebuild

With Python 3 and the packages in `../scripts/art/requirements.txt` installed,
run `python3 scripts/art/export.py` from the repository root. The script can
also be invoked by absolute path. It overwrites only this kit's runtime files.
Retain originals in `source/`; do not edit generated exports by hand.
