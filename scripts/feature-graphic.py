# Builds the Play Store feature graphic (1024x500) from branding/logo.png. Usage: python scripts/feature-graphic.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'handoff', 'store-assets'); os.makedirs(OUT, exist_ok=True)
W, H = 1024, 500
# gradient background blue → teal → green (matches the app)
img = Image.new('RGB', (W, H))
px = img.load()
c1, c2, c3 = (29, 111, 232), (18, 181, 165), (34, 197, 94)
for x in range(W):
    for y in range(H):
        t = (x / W) * 0.75 + (y / H) * 0.25
        a, b, u = (c1, c2, t / 0.55) if t < 0.55 else (c2, c3, (t - 0.55) / 0.45)
        px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))
# soft white glow behind the logo
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse((60, 40, 460, 460), fill=(255, 255, 255, 70))
img = Image.alpha_composite(img.convert('RGBA'), glow.filter(ImageFilter.GaussianBlur(40)))
# logo tile (reuse the icon)
logo = Image.open(os.path.join(ROOT, 'app', 'icons', 'icon-512.png')).convert('RGBA').resize((340, 340), Image.LANCZOS)
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sh.paste((0, 0, 0, 90), (100, 100, 440, 440)); sh = sh.filter(ImageFilter.GaussianBlur(18))
img = Image.alpha_composite(img, sh); img.alpha_composite(logo, (90, 80))
d = ImageDraw.Draw(img)
def font(size, bold=True):
    for f in (['segoeuib.ttf', 'arialbd.ttf'] if bold else ['segoeui.ttf', 'arial.ttf']):
        p = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', f)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
d.text((480, 120), 'CalorieMate', font=font(84), fill=(255, 255, 255))
d.text((484, 222), 'Eat smarter · Live brighter', font=font(34, False), fill=(235, 250, 255))
lines = ['5,300+ Indian foods with real portions', 'Voice logging in English & Hindi', 'Streaks, plans, water — works offline']
y = 290
for l in lines:
    d.ellipse((486, y + 12, 498, y + 24), fill=(255, 255, 255)); d.text((512, y), l, font=font(27, False), fill=(255, 255, 255)); y += 44
img.convert('RGB').save(os.path.join(OUT, 'feature-graphic-1024x500.png'), optimize=True)
print('wrote feature graphic')
