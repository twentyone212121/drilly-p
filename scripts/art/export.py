"""Rebuild game art with Python 3, Pillow and numpy. Run from any directory."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/source'
OUTPUT = ROOT / 'public/assets'


def clean(image, checker=False):
    image = image.convert('RGBA')
    pixels = np.array(image)
    if checker:
        rgb = pixels[:, :, :3].astype(int)
        neutral = (rgb.max(2) - rgb.min(2) < 32) & (rgb.min(2) > 65)
        barrier = Image.fromarray(np.where(neutral, 0, 255).astype('uint8')).copy()
        # Only remove neutral pixels connected to the outside; preserve metal faces.
        ImageDraw.floodfill(barrier, (0, 0), 128)
        mask = Image.fromarray(np.where(np.array(barrier) == 128, 0, 255).astype('uint8'))
        mask = mask.filter(ImageFilter.MedianFilter(3))
        pixels[:, :, 3] = np.array(mask)
    else:
        # Drop distant glow and normalize near-opaque generated interiors.
        alpha = pixels[:, :, 3].astype(float)
        pixels[:, :, 3] = np.clip((alpha - 24) * 255 / 229, 0, 255).astype('uint8')
    pixels[pixels[:, :, 3] == 0] = 0
    result = Image.fromarray(pixels)
    return result.crop(result.getbbox())


def export_atlas(name, sprites, labels, cell, columns, directory):
    rows = (len(sprites) + columns - 1) // columns
    atlas = Image.new('RGBA', (columns * cell, rows * cell))
    frames = {}
    scale = (cell - 24) / max(max(sprite.size) for sprite in sprites)
    for index, (sprite, label) in enumerate(zip(sprites, labels)):
        size = tuple(max(1, round(value * scale)) for value in sprite.size)
        sprite = sprite.resize(size, Image.Resampling.LANCZOS)
        x, y = (index % columns) * cell, (index // columns) * cell
        atlas.alpha_composite(sprite, (x + (cell - size[0]) // 2, y + cell - 12 - size[1]))
        left = x + (cell - size[0]) // 2
        top = y + cell - 12 - size[1]
        frames[label] = {'frame': {'x': left, 'y': top, 'w': size[0], 'h': size[1]},
                         'rotated': False, 'trimmed': False,
                         'spriteSourceSize': {'x': 0, 'y': 0, 'w': size[0], 'h': size[1]},
                         'sourceSize': {'w': size[0], 'h': size[1]},
                         'pivot': {'x': 0.5, 'y': 1}}
    directory.mkdir(parents=True, exist_ok=True)
    atlas.save(directory / f'{name}.png', optimize=True)
    metadata = {'frames': frames, 'meta': {'image': f'{name}.png', 'format': 'RGBA8888',
                'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}
    (directory / f'{name}.json').write_text(json.dumps(metadata, indent=2) + '\n')


def main():
    for name in ['esc', 'drilly', 'chip', 'fan', 'byte']:
        image = Image.open(SOURCE / 'characters' / f'{name}.png')
        sprites = [clean(image.crop((round(i * image.width / 3), 0,
                    round((i + 1) * image.width / 3), image.height)),
                    checker=name in ['chip', 'fan', 'byte']) for i in range(3)]
        labels = ['hover', 'active', 'defeated'] if name == 'drilly' else ['idle', 'jump', 'land']
        export_atlas(name, sprites, labels, 128, 3, OUTPUT / 'characters')

    image = Image.open(SOURCE / 'environment/computer-props.png')
    bounds = [(0, 0, 550, 500), (550, 0, 1030, 500), (1030, 0, 1536, 500),
              (0, 500, 512, 1024), (512, 500, 1024, 1024), (1024, 500, 1536, 1024)]
    sprites = [clean(image.crop(box)) for box in bounds]
    export_atlas('computer-props', sprites,
                 ['platform', 'wall', 'saw', 'data', 'gate-closed', 'gate-open'],
                 256, 3, OUTPUT / 'environment')
    image = Image.open(SOURCE / 'environment/computer-interior.png').convert('RGB')
    image.thumbnail((1600, 900), Image.Resampling.LANCZOS)
    (OUTPUT / 'backgrounds').mkdir(exist_ok=True)
    image.save(OUTPUT / 'backgrounds/computer-interior.webp', quality=85, method=6)


if __name__ == '__main__':
    main()
