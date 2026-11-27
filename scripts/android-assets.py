"""Generează iconițele și ecranele de pornire Android pentru Catedra (necesită Pillow).
Rulare: python3 scripts/android-assets.py
"""
import glob
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
DARK = (23, 50, 58, 255)
TEAL = (92, 184, 178, 255)
INK = (13, 31, 34, 255)


def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def letter(d, box, size, fill):
    f = font(size)
    b = d.textbbox((0, 0), 'C', font=f)
    w, h = b[2] - b[0], b[3] - b[1]
    x0, y0, x1, y1 = box
    d.text((x0 + (x1 - x0 - w) / 2 - b[0], y0 + (y1 - y0 - h) / 2 - b[1]), 'C', font=f, fill=fill)


def legacy(px, round_):
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if round_:
        d.ellipse([0, 0, px - 1, px - 1], fill=DARK)
        m = px * 0.14
        d.ellipse([m, m, px - m, px - m], fill=TEAL)
    else:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=px * 0.2, fill=DARK)
        m = px * 0.1
        d.rounded_rectangle([m, m, px - m, px - m], radius=px * 0.15, fill=TEAL)
    letter(d, (0, 0, px, px), int(px * 0.55), INK)
    return im


def foreground(px):
    # zona sigură a iconiței adaptive: cercul central de ~66%
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = px * 0.25
    d.rounded_rectangle([m, m, px - m, px - m], radius=px * 0.09, fill=TEAL)
    letter(d, (0, 0, px, px), int(px * 0.33), INK)
    return im


DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENS.items():
    folder = os.path.join(ROOT, 'mipmap-' + name)
    legacy(int(48 * k), False).save(os.path.join(folder, 'ic_launcher.png'))
    legacy(int(48 * k), True).save(os.path.join(folder, 'ic_launcher_round.png'))
    foreground(int(108 * k)).save(os.path.join(folder, 'ic_launcher_foreground.png'))

with open(os.path.join(ROOT, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#17323A</color>\n</resources>\n')

# Ecrane de pornire: fundal închis, sigla în centru, numele dedesubt.
for path in glob.glob(os.path.join(ROOT, 'drawable*', 'splash.png')):
    w, h = Image.open(path).size
    im = Image.new('RGB', (w, h), DARK[:3])
    d = ImageDraw.Draw(im)
    s = int(min(w, h) * 0.28)
    x0, y0 = (w - s) // 2, (h - s) // 2 - int(s * 0.15)
    d.rounded_rectangle([x0, y0, x0 + s, y0 + s], radius=s * 0.22, fill=TEAL)
    letter(d, (x0, y0, x0 + s, y0 + s), int(s * 0.62), INK)
    f = font(max(14, int(s * 0.22)))
    b = d.textbbox((0, 0), 'Catedra', font=f)
    d.text(((w - (b[2] - b[0])) / 2 - b[0], y0 + s + s * 0.18), 'Catedra', font=f, fill=(230, 240, 238))
    im.save(path)
print('ok')
