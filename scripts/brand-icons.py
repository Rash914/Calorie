# Generates all app icons from branding/logo.png (the CalorieMate tile on a white background).
# Usage: python scripts/brand-icons.py
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import os, shutil

ROOT = os.path.join(os.path.dirname(__file__), '..')
raw = Image.open(os.path.join(ROOT, 'branding', 'logo.png')).convert('RGBA')
src = Image.new('RGBA', raw.size, (255, 255, 255, 255)); src.alpha_composite(raw)  # flatten onto white

# 1. find the tile: bbox of *coloured* pixels (saturation), which ignores the grey drop shadow
r, g, b, _ = src.split()
sat = ImageChops.subtract(ImageChops.lighter(ImageChops.lighter(r, g), b), ImageChops.darker(ImageChops.darker(r, g), b))
mask = sat.point(lambda v: 255 if v > 40 else 0)
bbox = mask.getbbox()
x0, y0, x1, y1 = bbox
# the shadow makes the bbox slightly wider at the bottom; trim to a square centred on the tile
side = min(x1 - x0, y1 - y0)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
print('tile bbox', bbox)
tile = src.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((1024, 1024), Image.LANCZOS)

# 2. rounded-rect alpha so the corners are transparent (iOS/PWA "any" icon, legacy Android launcher)
def rounded(img, radius_frac=0.22):
    m = Image.new('L', img.size, 0)
    r = int(img.size[0] * radius_frac)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius=r, fill=255)
    out = img.copy(); out.putalpha(m); return out
tile_r = rounded(tile)

# 3. background colour for full-bleed variants = average of the tile's border pixels
border = list(tile.crop((0, 0, 1024, 12)).convert('RGB').getdata()) + list(tile.crop((0, 1012, 1024, 1024)).convert('RGB').getdata())
bg = tuple(sum(p[i] for p in border) // len(border) for i in range(3)) + (255,)

def full_bleed(scale, transparent_bg=False):
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0) if transparent_bg else bg)
    s = int(1024 * scale)
    inner = rounded(tile.resize((s, s), Image.LANCZOS))
    canvas.alpha_composite(inner, ((1024 - s) // 2, (1024 - s) // 2))
    return canvas

icons = os.path.join(ROOT, 'app', 'icons')
os.makedirs(icons, exist_ok=True)
tile_r.resize((512, 512), Image.LANCZOS).save(os.path.join(icons, 'icon-512.png'))
tile_r.resize((192, 192), Image.LANCZOS).save(os.path.join(icons, 'icon-192.png'))
tile_r.resize((180, 180), Image.LANCZOS).save(os.path.join(icons, 'apple-touch-icon.png'))
tile_r.resize((64, 64), Image.LANCZOS).save(os.path.join(icons, 'favicon.png'))
full_bleed(0.82).resize((512, 512), Image.LANCZOS).save(os.path.join(icons, 'icon-maskable-512.png'))
print('web icons ok, bg =', bg)

# 4. Android launcher icons
res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
fg = full_bleed(0.62, transparent_bg=True)  # adaptive foreground: artwork inside the 66 dp safe circle
for d, m in DENS.items():
    dd = os.path.join(res, f'mipmap-{d}'); os.makedirs(dd, exist_ok=True)
    leg = int(48 * m); f = int(108 * m)
    tile_r.resize((leg, leg), Image.LANCZOS).save(os.path.join(dd, 'ic_launcher.png'))
    circ = tile.resize((leg, leg), Image.LANCZOS); cm = Image.new('L', (leg, leg), 0); ImageDraw.Draw(cm).ellipse((0, 0, leg - 1, leg - 1), fill=255); circ.putalpha(cm)
    circ.save(os.path.join(dd, 'ic_launcher_round.png'))
    fg.resize((f, f), Image.LANCZOS).save(os.path.join(dd, 'ic_launcher_foreground.png'))
with open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % bg[:3])

# 5. splash screens: tile centred on the background colour
splash = Image.new('RGBA', (1280, 1280), bg)
sp = rounded(tile.resize((520, 520), Image.LANCZOS)); splash.alpha_composite(sp, (380, 380))
for name in os.listdir(res):
    if name.startswith('drawable-'):  # density copies are unnecessary (Android scales the single drawable)
        p = os.path.join(res, name, 'splash.png')
        if os.path.exists(p): os.remove(p)
splash.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(res, 'drawable', 'splash.png'), optimize=True)
print('android icons + splash ok')
