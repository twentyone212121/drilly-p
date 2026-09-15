import { createPrisonArt } from "./prisonArt";
import { createRunLegs } from "./runLegs";
import { drawRoomFrame } from "./roomFrame";
import { isFixedRoomPlatform } from "../../../shared/game/roomBoundary";
import { drawWallSparks } from "./wallSlide";
import { DEATH_ANIMATION_MS, isWallSliding } from "../presentation";
import { drawElectricDeath } from "./electricDeath";
import { createObstacleArt, setObstacleImage } from "./obstacleArt";
import type Phaser from "phaser";
import type {
  EditorObject,
  GameEvent,
  Level,
  State,
} from "../../../shared/game/types";
import { RULES } from "../../../shared/game/rules";
import { objectBounds } from "../editor";
import { flameBounds } from "../../../shared/game/obstacles";

export function createRoomArt(scene: Phaser.Scene, level: Level, density = 1) {
  const objects: Phaser.GameObjects.Image[] = [];
  const prison = createPrisonArt(scene, level, density);
  const props = (
    frame: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const image = scene.add
      .image(
        x,
        y,
        frame === "saw" ? "obstacle-saw" : "computer-props",
        frame === "saw" ? undefined : frame,
      )
      .setOrigin(0);
    image.setDisplaySize(width, height);
    objects.push(image);
    return image;
  };

  const grid = scene.add.graphics().setDepth(-1).setVisible(false);
  grid.lineStyle(0.5, 0x45606f, 0.45);
  for (let x = 0; x <= level.width; x += RULES.editor.gridSize)
    grid.lineBetween(x, 0, x, level.height);
  for (let y = 0; y <= level.height; y += RULES.editor.gridSize)
    grid.lineBetween(0, y, level.width, y);
  const guides = scene.add.graphics().setDepth(60);
  const previewPanels = scene.add.graphics().setDepth(70).setAlpha(0.65);
  const previewImage = props("saw", 0, 0, 1, 1)
    .setDepth(70)
    .setAlpha(0.65)
    .setVisible(false);
  const platforms = scene.add.graphics();
  platforms.scaleCanvas(density, density);
  for (const platform of level.platforms) {
    if (isFixedRoomPlatform(platform, level)) continue;
    for (const panel of platformPanels(platform)) {
      platforms.fillStyle(panel.color);
      platforms.fillRect(panel.x, panel.y, panel.width, panel.height);
    }
  }
  drawRoomFrame(platforms, level);
  // Bake static panel details once per room/edit instead of replaying their draw commands.
  platforms.generateTexture(
    "room-platforms",
    level.width * density,
    level.height * density,
  );
  platforms.destroy();
  const platformImage = scene.add
    .image(0, 0, "room-platforms")
    .setOrigin(0)
    .setDisplaySize(level.width, level.height);
  const saws = level.traps.map((trap) => {
    const image = props(
      "saw",
      trap.x,
      trap.y,
      trap.radius * 2,
      trap.radius * 2,
    );
    return image.setOrigin(0.5).setDepth(20);
  });
  const treasures = level.treasures.map((treasure) =>
    props(
      "data",
      treasure.x,
      treasure.y,
      treasure.width,
      treasure.height,
    ).setDepth(30),
  );
  const obstacleArt = createObstacleArt(scene, level);
  const player = scene.add
    .image(0, 0, "esc", "idle")
    .setOrigin(0.5, 1)
    .setDepth(40);
  const comparisonGhost = scene.add
    .image(0, 0, "esc", "idle")
    .setOrigin(0.5, 1)
    .setDepth(39)
    .setTint(0x65eaff)
    .setAlpha(0.35)
    .setVisible(false);
  objects.push(player, comparisonGhost);
  const legs = createRunLegs(scene);
  const fragments = scene.add.graphics().setDepth(50);
  let jumpTick = -100;
  let wallJumpTick = -100;
  let wallContactTick = -100;
  let deathMs = 0;
  let lastTick = -1;
  let landingTick = -100;
  let lastState: State | null = null;
  let lastGhost = false;
  let lastEditing = false;

  return {
    setWaiting(waiting: boolean) {
      player.setVisible(!waiting);
      if (waiting) legs.update(player, 0, false);
    },
    editor(
      selected: EditorObject | undefined,
      preview: EditorObject | null,
      invalid: boolean,
    ) {
      guides.clear();
      previewPanels.clear();
      previewImage.setVisible(false);
      if (selected) drawGuides(guides, selected, level, false, true);
      if (!preview) return;
      drawGuides(guides, preview, level, invalid, false);
      if (preview.kind === "platform") {
        for (const panel of platformPanels(preview.value)) {
          previewPanels.fillStyle(panel.color);
          previewPanels.fillRect(panel.x, panel.y, panel.width, panel.height);
        }
      } else {
        previewImage.setVisible(true);
        if (preview.kind === "obstacle")
          setObstacleImage(previewImage, preview.value);
        else {
          const b = objectBounds(preview);
          previewImage
            .setTexture(
              preview.kind === "saw" ? "obstacle-saw" : "computer-props",
              preview.kind === "saw" ? undefined : "data",
            )
            .setOrigin(0)
            .setPosition(b.x, b.y)
            .setDisplaySize(b.width, b.height)
            .setRotation(0)
            .setFlipY(false);
        }
      }
    },
    comparison(ghost: State["player"] | null) {
      comparisonGhost.setVisible(ghost !== null);
      if (!ghost) return;

      const braced = !ghost.grounded && ghost.wall !== 0;
      const texture = braced ? "esc-wall" : "esc";
      const frame = braced ? "slide" : ghost.grounded ? "idle" : "jump";
      const reference = scene.textures.getFrame(
        texture,
        braced ? "slide" : "idle",
      );
      comparisonGhost
        .setTexture(texture, frame)
        .setOrigin(0.5, 1)
        .setScale(RULES.playerHeight / reference.height)
        .setFlipX((ghost.wall || ghost.direction) < 0)
        .setPosition(
          ghost.x + RULES.playerWidth / 2,
          ghost.y + RULES.playerHeight,
        );
      if (ghost.wall !== 0) {
        const wallX = ghost.x + (ghost.wall > 0 ? RULES.playerWidth : 0);
        comparisonGhost.setX(
          wallX - (ghost.wall * comparisonGhost.displayWidth) / 2,
        );
      }
    },
    consume(events: GameEvent[]) {
      for (const event of events) {
        if (event.type === "wall-contact") wallContactTick = event.tick;
        if (event.type === "landed") landingTick = event.tick;
        if (event.type === "jumped") {
          jumpTick = event.tick;
          if (event.kind === "wall") wallJumpTick = event.tick;
        }
      }
    },
    update(state: State, ghost: boolean, delta: number, editing = false) {
      const dying =
        !editing &&
        !ghost &&
        state.status === "dead" &&
        deathMs < DEATH_ANIMATION_MS;
      if (
        state === lastState &&
        ghost === lastGhost &&
        editing === lastEditing &&
        !dying
      )
        return false;
      lastState = state;
      lastGhost = ghost;
      lastEditing = editing;
      grid.setVisible(editing);
      obstacleArt.update(state);
      prison?.update(state);
      if (state.tick === 0 || state.tick < lastTick) {
        landingTick = jumpTick = wallJumpTick = wallContactTick = -100;
        deathMs = 0;
      }
      lastTick = state.tick;
      if (state.status !== "dead") deathMs = 0;
      else
        deathMs = Math.min(
          DEATH_ANIMATION_MS,
          deathMs + Math.max(0, Math.min(delta, 100)),
        );
      fragments.clear();
      const landed = state.tick - landingTick < 6;
      const wallContact =
        !editing &&
        !ghost &&
        state.status === "running" &&
        state.player.wall !== 0;
      const braced = wallContact && !state.player.grounded;
      const wallImpact = wallContact
        ? Math.max(0, 1 - (state.tick - wallContactTick) / 9)
        : 0;
      const wallPush =
        !editing && !ghost && state.status === "running"
          ? Math.max(0, 1 - (state.tick - wallJumpTick) / 14)
          : 0;
      const running =
        !editing &&
        !ghost &&
        state.status === "running" &&
        state.tick > 0 &&
        state.player.grounded &&
        !landed &&
        !wallContact &&
        Math.abs(state.player.vx) > 0;
      const frame = editing
        ? "idle"
        : ghost
          ? state.status === "dead"
            ? "defeated"
            : state.player.grounded
              ? "hover"
              : "active"
          : state.status === "dead"
            ? "idle"
            : wallContact
              ? "idle"
              : !state.player.grounded
                ? "jump"
                : landed
                  ? "land"
                  : "idle";
      const texture = ghost ? "drilly" : braced ? "esc-wall" : "esc";
      const pose = braced ? "slide" : frame;
      if (player.texture.key !== texture || player.frame.name !== pose)
        player.setTexture(texture, pose);
      player.setOrigin(0.5, 1);
      const reference = scene.textures.getFrame(
        texture,
        ghost ? "hover" : braced ? "slide" : "idle",
      );
      const scale =
        (RULES.playerHeight * RULES.playerVisualScale) / reference.height;
      const jumpStrength =
        !ghost && state.status === "running"
          ? Math.max(0, 1 - (state.tick - jumpTick) / 8)
          : 0;
      const landStrength =
        !ghost && state.status === "running" && landed
          ? Math.max(0, 1 - (state.tick - landingTick) / 6)
          : 0;
      player.setScale(
        scale *
          (1 -
            jumpStrength * 0.08 +
            landStrength * 0.08 -
            wallImpact * 0.1 -
            wallPush * 0.06),
        scale *
          (1 +
            jumpStrength * 0.1 -
            landStrength * 0.08 +
            wallImpact * 0.06 +
            wallPush * 0.09),
      );
      player.setPosition(
        state.player.x + RULES.playerWidth / 2,
        state.player.y + RULES.playerHeight,
      );
      player.setFlipX(!ghost && state.player.direction < 0);
      player.setRotation(
        !editing && state.status === "running"
          ? wallContact
            ? state.player.wall * (0.14 + wallImpact * 0.12)
            : state.player.direction * (0.02 + wallPush * 0.18)
          : 0,
      );
      if (running) player.setScale(scale).setRotation(0);
      legs.update(player, state.tick, running);
      if (wallContact) {
        // Grounded corners use an upright, planted pose; airborne contact uses the palms.
        // Anchor the visible edge so the wider artwork cannot lean into the wall.
        player
          .setScale(scale)
          .setRotation(0)
          .setFlipX(state.player.wall < 0);
        // Atlas frames with custom pivots mirror around their origin. A centered
        // origin keeps flipped and unflipped sprites on the same side of the wall.
        const wallX =
          state.player.x + (state.player.wall > 0 ? RULES.playerWidth : 0);
        player.setOrigin(0.5, 1);
        player.setX(wallX - (state.player.wall * player.displayWidth) / 2);
      }
      if (wallContact && (wallImpact > 0 || isWallSliding(state)))
        drawWallSparks(fragments, state);
      player.setAlpha(ghost ? 0.8 : 1).clearTint();
      if (!editing && !ghost && state.status === "dead") {
        drawElectricDeath(player, fragments, deathMs, scale);
      }
      saws.forEach((image) => image.setRotation(state.tick / 10));
      treasures.forEach((image, index) =>
        image.setVisible(
          !(
            level.id === "prison" && level.treasures[index].id === "escape-door"
          ) && !state.collectedTreasureIds.includes(level.treasures[index].id),
        ),
      );
      return (
        !editing &&
        !ghost &&
        state.status === "dead" &&
        deathMs < DEATH_ANIMATION_MS
      );
    },
    destroy() {
      prison?.destroy();
      legs.destroy();
      grid.destroy();
      guides.destroy();
      previewPanels.destroy();
      platformImage.destroy();
      scene.textures.remove("room-platforms");
      obstacleArt.destroy();
      fragments.destroy();
      objects.forEach((image) => image.destroy());
    },
  };
}

function drawGuides(
  graphics: Phaser.GameObjects.Graphics,
  object: EditorObject,
  level: Level,
  invalid: boolean,
  resize: boolean,
) {
  if (
    object.kind === "obstacle" &&
    (object.value.kind === "drone" || object.value.kind === "slider")
  )
    return;
  const b = objectBounds(object);
  graphics.lineStyle(2, invalid ? 0xff568e : 0x50dcf3);
  graphics.strokeRect(b.x, b.y, b.width, b.height);
  if (
    resize &&
    (object.kind === "platform" ||
      (object.kind === "obstacle" && object.value.kind === "spikes"))
  ) {
    graphics.fillStyle(0x50dcf3);
    graphics.fillRect(b.x + b.width - 6, b.y + b.height - 6, 12, 12);
  }
  if (object.kind !== "obstacle") return;
  const o = object.value;
  graphics.lineStyle(1.5, 0x61e0eb);
  if (o.kind === "turret") {
    if (o.mode === "aimed") graphics.strokeCircle(o.x, o.y, o.range);
    else if (o.mode === "flame") {
      const flame = flameBounds(o, level);
      graphics.strokeRect(flame.x, flame.y, flame.width, flame.height);
    } else graphics.lineBetween(o.x, o.y, o.x + o.direction * o.range, o.y);
  }
}

type Bounds = { x: number; y: number; width: number; height: number };
type PanelRect = Bounds & { color: number };

/** Size-aware hardware panels for the room and its editor preview. */
function platformPanels(bounds: Bounds): PanelRect[] {
  const result: PanelRect[] = [];
  const add = (
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ) => {
    if (width > 0 && height > 0) result.push({ x, y, width, height, color });
  };
  const { x, y, width, height } = bounds;
  const vertical = height > width;
  const columns = Math.max(1, Math.ceil(width / 96));
  const rows = Math.max(1, Math.ceil(height / 96));
  const w = width / columns;
  const h = height / rows;
  const bevel = Math.min(2, width / 8, height / 8);

  // A continuous dark backing keeps every solid edge aligned with its collider.
  add(x, y, width, height, 0x101b29);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const px = x + column * w;
      const py = y + row * h;
      add(px + bevel, py + bevel, w - bevel * 2, h - bevel * 2, 0x2b3c50);
      add(px + bevel, py + bevel, w - bevel * 2, bevel, 0x61758a);
      add(px + bevel, py + bevel * 2, bevel, h - bevel * 4, 0x41566c);
      add(px + w - bevel * 2, py + bevel * 2, bevel, h - bevel * 3, 0x1a293a);
      add(px + bevel * 2, py + h - bevel * 3, w - bevel * 4, bevel, 0x1b2a3c);

      // Recessed face plate and short status light; never scale a bolt or a bevel.
      if (w >= 12 && h >= 12) {
        add(px + 5, py + 5, w - 10, h - 10, 0x223246);
        if (vertical && h >= 28) {
          add(px + w / 2 - 1, py + 9, 2, Math.min(14, h - 18), 0x142233);
          add(px + w / 2 - 1, py + h - 14, 2, 6, 0x51bbc7);
        } else if (!vertical && w >= 28) {
          add(px + 9, py + h / 2 - 1, Math.min(18, w - 18), 2, 0x142233);
          add(px + w - 15, py + h / 2 - 1, 6, 2, 0x51bbc7);
        }
      }
    }
  }

  // Continuous edge rails separate playable surfaces from the dark background.
  if (vertical) {
    add(x, y, bevel, height, 0x526c80);
    add(x + width - bevel, y, bevel, height, 0x526c80);
  } else {
    add(x, y, width, bevel, 0x91a6b8);
    add(x, y + bevel, width, bevel, 0x526c80);
  }
  return result;
}
