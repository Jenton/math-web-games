#!/usr/bin/env python3
"""Copies the few Kenney (CC0) sprites Lemonade Stand uses into assets/kenney/lemonade/. Needs Pillow.
    python3 tools/make_lemonade_assets.py "<path to Kenney Game Assets All-in-1>/2D assets"
The pitcher is Generic Items #107 recolored from orange to lemon yellow."""
import colorsys, os, shutil, sys
from PIL import Image

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "kenney", "lemonade")
base = os.path.join(src, "Platformer Assets Base", "PNG", "Items")
gen = os.path.join(src, "Generic Items", "PNG", "Colored")
for n in ("coinGold", "coinSilver", "coinBronze", "cloud1", "cloud2", "cloud3", "bush"):
    shutil.copy(os.path.join(base, n + ".png"), os.path.join(out, n + ".png"))
for n, name in ((158, "cash"), (126, "cup"), (152, "bell"), (118, "glass")):
    shutil.copy(os.path.join(gen, "genericItem_color_%03d.png" % n), os.path.join(out, name + ".png"))
im = Image.open(os.path.join(gen, "genericItem_color_107.png")).convert("RGBA")
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s > 0.4:  # the orange liquid becomes lemon yellow
            r, g, b = (int(c * 255) for c in colorsys.hsv_to_rgb(0.15, min(1, s * 0.95), min(1, v * 1.08)))
            px[x, y] = (r, g, b, a)
im.save(os.path.join(out, "pitcher.png"))
for a in ("bear", "chick", "cow", "dog", "duck", "elephant", "frog", "giraffe", "hippo", "monkey", "owl", "panda", "penguin", "pig", "rabbit", "zebra"):
    shutil.copy(os.path.join(src, "Animal Pack Remastered", "PNG", "Round", a + ".png"), os.path.join(out, "animals", a + ".png"))
print("wrote", out)
