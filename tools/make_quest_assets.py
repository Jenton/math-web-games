#!/usr/bin/env python3
"""Builds the art that Creature Quest actually ships, from the CC0 samples in assets/candidates/ (Kenney).

    python3 tools/make_quest_assets.py        (needs Pillow: pip install pillow)

Output goes to assets/quest/{classic,cute}/ and is committed, so the game itself needs no build step.
Re-run only when changing which pieces are used. Deterministic (fixed seed).
"""
import os
import random
import shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, "assets", "candidates")
OUT = os.path.join(ROOT, "assets", "quest")


def out(*p):
    path = os.path.join(OUT, *p)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def tile(pack, n):
    return Image.open(os.path.join(CAND, pack, "Tiles", "tile_%04d.png" % n)).convert("RGBA")


# ---------------------------------------------------------------- classic (pixel, Tiny Dungeon / Tiny Town) ----
CLASSIC_ENEMY = {  # enemy id -> Tiny Dungeon tile
    "multiples": 110, "factors": 122, "primes": 111, "even-odd": 120, "compare": 108, "rounding": 123,
    "expressions": 121, "fractions": 109, "exponents": 124, "armor": 86, "boss": 87,
}
CLASSIC_ALLY = {  # creature id -> Tiny Dungeon tile (a few are recolored in the manifest)
    "multiples": 88, "factors": 85, "primes": 84, "even-odd": 98, "compare": 112, "rounding": 97,
    "expressions": 99, "fractions": 100, "exponents": 96, "armor": 96, "boss": 98,
}
for k, n in CLASSIC_ENEMY.items():
    shutil.copy(os.path.join(CAND, "tiny-dungeon", "Tiles", "tile_%04d.png" % n), out("classic", "enemy", k + ".png"))
for k, n in CLASSIC_ALLY.items():
    shutil.copy(os.path.join(CAND, "tiny-dungeon", "Tiles", "tile_%04d.png" % n), out("classic", "ally", k + ".png"))


def compose(w, h, rows):
    """rows: list of rows of (pack, tile number) or None."""
    img = Image.new("RGBA", (w * 16, h * 16))
    for y, row in enumerate(rows):
        for x, t in enumerate(row):
            for layer in ([t] if isinstance(t, tuple) else (t or [])):  # a cell is one tile or a list of stacked tiles
                img.alpha_composite(tile(*layer), (x * 16, y * 16))
    return img


rng = random.Random(7)
W, H = 24, 12
# dungeon battle backdrop: brick wall with torches on top, sand floor below
wall = [[("tiny-dungeon", 14 if (x % 5) else 40) for x in range(W)] for _ in range(5)]
for x in (3, 9, 15, 21):
    wall[2][x] = ("tiny-dungeon", 29)  # torch
floor = [[("tiny-dungeon", rng.choice([48, 48, 48, 49, 50, 51])) for _ in range(W)] for _ in range(H - 5)]
compose(W, H, wall + floor).save(out("classic", "bg", "dungeon.png"))

# meadow battle backdrop: grass with a tree line on top
rows = []
for y in range(H):
    row = []
    for x in range(W):
        if y < 3:
            row.append([("tiny-town", 0), ("tiny-town", rng.choice([15, 16, 5, 4, 3, 16]))] if y == 2 else ("tiny-town", 0))
        else:
            row.append(("tiny-town", rng.choice([0, 0, 0, 1, 1, 2])))
    rows.append(row)
compose(W, H, rows).save(out("classic", "bg", "meadow.png"))

# world map backdrop (pixel): grass field with scattered trees, flowers and a few rocks
MW, MH = 30, 17
rows = [[("tiny-town", rng.choice([0, 0, 0, 0, 1, 1, 2])) for _ in range(MW)] for _ in range(MH)]
for _ in range(46):
    x, y = rng.randrange(MW), rng.randrange(MH)
    rows[y][x] = [("tiny-town", 0), ("tiny-town", rng.choice([4, 5, 15, 16, 3, 28, 29, 43]))]
compose(MW, MH, rows).save(out("classic", "map", "meadow.png"))

# ---------------------------------------------------------------- cute (smooth, Animal Pack / Monster Builder) ----
CUTE_ALLY = {  # creature id -> Animal Pack Remastered (Round) file
    "multiples": "frog", "factors": "walrus", "primes": "narwhal", "even-odd": "panda", "compare": "owl",
    "rounding": "whale", "expressions": "gorilla", "fractions": "rabbit", "exponents": "crocodile",
    "armor": "sloth", "boss": "rhino",
}
for k, name in CUTE_ALLY.items():
    shutil.copy(os.path.join(CAND, "animal-pack-remastered", "PNG", "Round", name + ".png"), out("cute", "ally", k + ".png"))

# battle backdrops (1024 square sources, shrunk and saved as high quality PNGs to stay small)
for name, src in {"grass": "backgroundColorGrass", "forest": "backgroundColorForest", "fall": "backgroundColorFall",
                  "desert": "backgroundColorDesert", "castle": "backgroundCastles"}.items():
    im = Image.open(os.path.join(CAND, "background-elements-remastered", "Backgrounds", src + ".png")).convert("RGBA")
    im.resize((640, 640), Image.LANCZOS).save(out("cute", "bg", name + ".png"), optimize=True)

# map decorations from Map Pack (64 px tiles, transparent)
for name, n in {"tree": 40, "tree2": 55, "bush": 54, "rock": 39, "cactus": 35, "pine": 40, "snowman": 94, "igloo": 95, "pyramid": 50, "crystal": 44, "lock": 59, "mound": 49}.items():
    shutil.copy(os.path.join(CAND, "map-pack", "PNG", "mapTile_%03d.png" % n), out("cute", "map", name + ".png"))

# monsters built from Monster Builder parts
MB = os.path.join(CAND, "monster-builder", "PNG", "Default")


def part(name, flip=False):
    im = Image.open(os.path.join(MB, name + ".png")).convert("RGBA")
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def build(color, body, ears=None, eyes=("eye_cute_dark",), mouth="mouthA", leg="A", arm="A", brows=None, cyclops=False):
    cv = Image.new("RGBA", (520, 520))
    b = part("body_%s%s" % (color, body))
    bx, by = (520 - b.width) // 2, 170 - 0
    cx = 260

    def put(im, x, y):  # x,y = top-left on the canvas
        cv.alpha_composite(im, (int(x), int(y)))

    bottom = by + b.height
    leg_im = part("leg_%s%s" % (color, leg))
    for sx in (-1, 1):
        lim = leg_im if sx == -1 else leg_im.transpose(Image.FLIP_LEFT_RIGHT)
        put(lim, cx + sx * b.width * 0.22 - lim.width / 2, bottom - 70)
    arm_im = part("arm_%s%s" % (color, arm))
    for sx in (-1, 1):
        aim = arm_im if sx == -1 else arm_im.transpose(Image.FLIP_LEFT_RIGHT)
        put(aim, cx + sx * (b.width / 2) - (aim.width if sx == -1 else 0) + sx * 4, by + b.height * 0.38)
    if ears:
        e = part(ears)
        for sx in (-1, 1):
            eim = e if sx == -1 else e.transpose(Image.FLIP_LEFT_RIGHT)
            put(eim, cx + sx * b.width * 0.3 - eim.width / 2, by - eim.height * 0.55)
    put(b, bx, by)
    ey = by + b.height * 0.30
    if cyclops:
        e = part(eyes[0])
        e = e.resize((int(e.width * 1.5), int(e.height * 1.5)), Image.LANCZOS)
        put(e, cx - e.width / 2, ey - 8)
    else:
        for i, sx in enumerate((-1, 1)):
            e = part(eyes[i % len(eyes)])
            e = e.resize((int(e.width * 0.9), int(e.height * 0.9)), Image.LANCZOS)
            put(e, cx + sx * b.width * 0.2 - e.width / 2, ey)
    if brows:
        bw = part(brows)
        put(bw, cx - bw.width / 2, ey - 26)
    m = part(mouth)
    put(m, cx - m.width / 2, by + b.height * 0.66)
    return cv.crop(cv.getbbox())


CUTE_MONSTERS = {  # enemy id -> build() arguments
    "multiples": dict(color="green", body="A", ears="detail_green_ear", eyes=("eye_angry_green",), mouth="mouth_closed_fangs", leg="B"),
    "factors": dict(color="dark", body="C", ears="detail_dark_antenna_small", eyes=("eye_psycho_dark",), mouth="mouthC", leg="C", arm="B"),
    "primes": dict(color="blue", body="D", ears="detail_blue_horn_small", eyes=("eye_human_blue",), mouth="mouth_closed_teeth", leg="A", arm="C"),
    "even-odd": dict(color="red", body="B", ears="detail_red_ear_round", eyes=("eye_cute_light", "eye_cute_dark"), mouth="mouth_closed_happy", leg="D", arm="D"),
    "compare": dict(color="yellow", body="A", ears="detail_yellow_antenna_large", eyes=("eye_yellow",), mouth="mouthB", leg="E", arm="E"),
    "rounding": dict(color="white", body="B", ears="detail_white_ear_round", eyes=("eye_closed_happy",), mouth="mouth_closed_happy", leg="A", arm="A"),
    "expressions": dict(color="white", body="D", ears=None, eyes=("eye_dead",), mouth="mouthF", leg="B", arm="B"),
    "fractions": dict(color="red", body="A", ears="detail_red_horn_large", eyes=("eye_red",), mouth="mouth_closed_sad", leg="C", arm="C", cyclops=True),
    "exponents": dict(color="green", body="D", ears="detail_green_horn_large", eyes=("eye_angry_green",), mouth="mouthH", leg="D", arm="D"),
    "armor": dict(color="dark", body="B", ears="detail_dark_ear", eyes=("eye_psycho_dark",), mouth="mouth_closed_teeth", leg="E", arm="E", brows="eyebrowA"),
    "boss": dict(color="red", body="D", ears="detail_red_horn_large", eyes=("eye_angry_red",), mouth="mouth_closed_fangs", leg="E", arm="E", brows="eyebrowB"),
}
for k, kw in CUTE_MONSTERS.items():
    im = build(**kw)
    s = 200 / max(im.size)
    im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS).save(out("cute", "enemy", k + ".png"), optimize=True)

print("wrote", OUT)
