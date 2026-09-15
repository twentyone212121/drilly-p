import type Phaser from "phaser";

/** A recessed instruction plate fitted inside the floor casing. */
export function createEngravedLabel(
  scene: Phaser.Scene,
  text: string,
  density: number,
) {
  const key = "tutorial-engraving";
  const font = "600 11px Arial, sans-serif";
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width) + 44;
  const height = 26;
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
  const x = 22,
    y = 17;

  context.fillStyle = "#102531";
  context.beginPath();
  context.roundRect(0.5, 0.5, width - 1, height - 1, 4);
  context.fill();
  context.strokeStyle = "#3d5968";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#091a25";
  context.fillRect(5, 2, width - 10, 1);
  for (const boltX of [10, width - 10]) {
    context.beginPath();
    context.arc(boltX, height / 2, 2.2, 0, Math.PI * 2);
    context.fillStyle = "#435e6b";
    context.fill();
    context.fillStyle = "#122b39";
    context.fillRect(boltX - 1.5, height / 2 - 0.5, 3, 1);
  }

  // Subpixel edges suggest a shallow etch while leaving the letterforms clean.
  context.fillStyle = "#46606d";
  context.fillText(text, x, y + 0.65);
  context.strokeStyle = "#081722";
  context.lineWidth = 0.8;
  context.strokeText(text, x, y - 0.3);
  context.fillStyle = "#bddcdb";
  context.fillText(text, x, y);
  texture.refresh();
  return scene.add
    .image(0, 0, key)
    .setDisplaySize(width, height)
    .setDepth(80)
    .setVisible(false);
}
