import type Phaser from "phaser";

/** Quiet etched lettering with a narrow recessed edge. */
export function createEngravedLabel(
  scene: Phaser.Scene,
  text: string,
  density: number,
) {
  const key = "tutorial-engraving";
  const font = "600 12px Arial, sans-serif";
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width) + 10;
  const height = 24;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(
    key,
    width * density,
    height * density,
  )!;
  const context = texture.context;
  context.scale(density, density);
  context.font = font;
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  const x = 5,
    y = 16;

  // Subpixel edges suggest a shallow etch while leaving the letterforms clean.
  context.fillStyle = "#46606d";
  context.fillText(text, x, y + 0.65);
  context.strokeStyle = "#081722";
  context.lineWidth = 0.8;
  context.strokeText(text, x, y - 0.3);
  context.fillStyle = "#9dc7ca";
  context.fillText(text, x, y);
  texture.refresh();
  return scene.add
    .image(0, 0, key)
    .setDisplaySize(width, height)
    .setDepth(80)
    .setVisible(false);
}
