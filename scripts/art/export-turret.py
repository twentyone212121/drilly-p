"""Export the selected shaded turret; retain original art and real alpha."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
image = Image.open(ROOT / 'assets/source/obstacles/turret.png').convert('RGBA')
pixels = np.array(image)
mask = Image.fromarray(np.where(pixels[:, :, 3] >= 64, 255, 0).astype('uint8')).copy()
ImageDraw.floodfill(mask, (image.width // 2, image.height // 2), 128)
main = Image.fromarray(np.where(np.array(mask) == 128, 255, 0).astype('uint8'))
bounds = main.getbbox()
if not bounds:
    raise ValueError('No connected turret silhouette found')
image = image.crop(bounds)
image.thumbnail((160, 160), Image.Resampling.LANCZOS)
image.save(ROOT / 'public/assets/obstacles/turret.png', optimize=True)
