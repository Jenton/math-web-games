#!/usr/bin/env python3
"""Copies the cute-theme sprites of the Creature Quest story friends from the Kenney bundle (CC0, Animal Pack Remastered, Round style).

    python3 tools/make_quest_allies.py "<path to Kenney Game Assets All-in-1>/2D assets"

The classic (pixel) theme needs no new files: each story friend reuses one of the existing hero sprites in another color (see js/art.js).
The older eleven allies and the enemies come from tools/make_quest_assets.py."""
import os
import shutil
import sys

ANIMALS = {  # ally id -> Animal Pack Remastered file
    "bruno": "bear", "peep": "chick", "scout": "dog", "quackers": "duck", "tusk": "elephant", "bongo": "monkey",
    "waddle": "penguin", "oink": "pig", "zeb": "zebra", "mossy": "moose", "bison": "buffalo",
}
src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "quest", "cute", "ally")
for ally, animal in ANIMALS.items():
    shutil.copy(os.path.join(src, "Animal Pack Remastered", "PNG", "Round", animal + ".png"), os.path.join(out, ally + ".png"))
print("wrote", len(ANIMALS), "sprites to", out)
