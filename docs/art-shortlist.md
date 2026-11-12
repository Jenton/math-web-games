# Art shortlist (Kenney Game Assets All-in-1 3.8.0)

Goal: art for Creature Quest v2 (see `docs/game-ideas.md`: "World map", "Art plan"). Needs a Super Mario World style
world map, battle backgrounds, enemy sprites, ally and hero sprites in a **cute** and a **classic fantasy** theme, UI pieces,
and optionally sound.

Source: the bundle at `AI Projects/Kenney Game Assets All-in-1 3.8.0` (not in this repo, not to be committed). I listed every
folder in it, read every `License.txt` for the packs below (**all CC0**, no credit required, though crediting Kenney is
polite; owner bought the bundle, but CC0 means the license is not a constraint either way), and looked at each pack's preview.

Samples of the top picks are in `assets/candidates/<pack>/` (about 17 MB, no zips). Contact sheets (labeled grids) are in
`assets/candidates/previews/`. `assets/CREDITS.md` is intentionally not written yet.

## What is in the bundle (relevant parts)
- `2D assets/` has about 170 packs. The pixel-art ones that matter here: Tiny Dungeon, Tiny Town, Tiny Battle, Tiny Farm, Micro Roguelike,
  Roguelike Base / Characters / Dungeon / City / Interior, 1-Bit Pack, Pixel Platformer (+ Farm, Food, Industrial, Blocks expansions),
  Monochrome RPG, Pico-8 City/Platformer. The smooth (vector-style, cute) ones: Map Pack, Cartography Pack, Animal Pack (+ Remastered),
  Monster Builder Pack, Background Elements (+ Remastered), Toon Characters, Shape Characters, Platformer Assets Candy / Mushroom.
- `UI assets/`: UI Pack, UI Pack - Adventure, UI Pack - Pixel Adventure, UI Pixel Pack, Fantasy UI Borders, cursors.
- `Audio/`: RPG Audio, Interface Sounds, Impact Sounds, Music Jingles, Music Loops, Retro Sounds 1/2, UI Audio, Foley, Voiceover.
- Also `Icons/`, `Other/Fonts`, `3D assets/`, `Early access/` (not used).

## Key finding: there is no one pack that does everything, and the styles split into two families
1. **Pixel art, 16px, dark outline (Kenney "Tiny" style):** Tiny Dungeon, Tiny Town, Tiny Battle, Roguelike. Cohesive with each other.
2. **Smooth flat vector (rounded, bright, no outline):** Map Pack, Animal Pack, Monster Builder, Background Elements, Fantasy UI Borders.
   Cohesive with each other and very cute, but **not pixel art**.

The owner asked for pixel art on the map. The best *Super-Mario-World-like* map pieces (island tiles with a yellow path, level
dots, stars) are in the **smooth** Map Pack. Decision needed: pixel map built from Tiny Town / Roguelike Base, or the smooth Map Pack.
See "Recommended combos".

## Candidates

### 1. World map / overworld
| Pack | Style | Size | License | Why it fits |
|---|---|---|---|---|
| **Map Pack** | smooth flat vector, bright | 64 px tiles (plus 2x sheet) | CC0 | The closest thing to a Super Mario World map: sand/grass/rock/snow/lava island tiles, a **yellow path with level-node dots and numbered level markers**, trees, pyramid, igloo, castle, medals. Everything needed for node maps is already drawn. Not pixel art. Sheet: `previews/map-pack.png`. |
| **Tiny Town** | pixel, dark outline, cute colors | 16 px, 1 px gap, 132 tiles | CC0 | Grass, dirt road, trees (green and autumn), houses/roofs, fences, signs, items. The cutest of the pixel packs; good for a "pixel overworld" built by hand or from an ASCII layout. Sheet: `previews/tiny-town.png`. |
| **Roguelike Base** | pixel, lighter, no heavy outline | 16 px, 1 px gap, very large sheet (968x526) | CC0 | Biggest terrain set: grass/sand/water/forest/town variants, auto-tile friendly edges, trees, buildings. Best if we want to author maps from a tile grid (option b in game-ideas). Sheet: `previews/roguelike-base.png`. |
| Tiny Battle | pixel, dark outline | 16 px, 198 tiles | CC0 | Grass and water coastline tiles, roads, tiny units, numbers, a heart. Useful water/coast tiles. `previews/tiny-battle.png`. |
| Cartography Pack | hand-drawn ink line icons + parchment textures | vector | CC0 | Optional: a "treasure map" skin (castles, mountains, ships, compass on parchment). Different tone. Not previewed in sheets. |

### 2. Battle backgrounds
| Pack | Style | Size | License | Why it fits |
|---|---|---|---|---|
| **Background Elements Remastered** | smooth flat vector | full 1024x1024 images: Grass, Forest, Desert, Fall, Castles, plus color variants | CC0 | Ready-made full-screen battle backdrops (sky, hills, trees) that match the Map Pack and Animal Pack. Eight in the sample: `previews/backgrounds.png`. The pack also has separate trees, houses, clouds to compose more. |
| Pixel Platformer backgrounds | pixel, soft | 24 px tiles, 8x3 (color + hills/trees/cloud strips) | CC0 | Repeating pixel sky/hill strips (green, desert, ice, ...) to tile into a pixel backdrop. `previews/pixel-platformer_backgrounds.png`. Needs composing, not ready-made. |
| Roguelike Base / Tiny Dungeon floors | pixel | 16 px | CC0 | For a dungeon-interior battle (Tiny Dungeon: brick walls, doors, torches, stairs). |

### 3. Enemies / monsters
| Pack | Style | Size | License | Why it fits |
|---|---|---|---|---|
| **Tiny Dungeon** | pixel, dark outline | 16 px | CC0 | Classic fantasy foes on one sheet: ghost, bat, spider, a green blob/ghost, a one-eyed creature, hooded and red-masked figures, a skull. Cohesive with its heroes. `previews/tiny-dungeon.png` (tiles 108-124). Only about 12 enemy sprites, so variety must come from palette swaps. |
| **Roguelike Characters** | pixel | 16 px, mix-and-match layers | CC0 | A character-builder sheet: bodies in several skin tones (including green ones), hair, armor, weapons and shields. Gives many different humanoid enemies and heroes by combining layers (needs a small compositing step). `previews/roguelike-characters.png`. |
| **Pixel Platformer characters** | pixel, cute, dark outline | 24 px | CC0 | Cute blobby enemies (one-eyed blue robot, spiked red thing, winged brown bat, angry orange block, tiny gold gremlin) and space-suit kids/aliens in 4 colors. Cute, not fantasy: great for the *cute* theme. `previews/pixel-platformer_characters.png`. |
| Monster Builder | smooth flat vector | parts of about 80-180 px, 6 colors | CC0 | Assemble custom monsters from eyes, mouths, arms, legs, bodies. Large variety and very cute, but needs a build step and is not pixel art. `previews/monster-builder.png`. |
| Roguelike Dungeon | pixel | 16 px | CC0 | Mostly dungeon terrain and props (per its preview); not checked for creatures and not sampled. |

### 4. Allies / heroes (cute AND classic fantasy)
| Theme | Pack | Style | Why it fits |
|---|---|---|---|
| Classic fantasy | **Tiny Dungeon** | pixel 16 px | Heroes on one sheet: a purple wizard, several knights/adventurers, a woman with long hair, a green-hooded ranger (tiles 84-100, 112). Lines up with its monsters. |
| Classic fantasy | **Roguelike Characters** | pixel 16 px | Build many distinct heroes with hair, armor and weapon layers (character customization is one of the owner's four "hooks"). |
| Cute | **Animal Pack Remastered** (Round style) | smooth flat 154 px | 30 round animal faces (bear, bunny, owl, frog, penguin, panda, sloth, wolf, ...). They map directly onto the planned allies (Hopper the bunny, Owlbert the owl, Shelly the turtle/frog). Each animal comes in 8 styles; only Round is sampled. `previews/animal-pack-remastered.png`. Not pixel art. |
| Cute | **Pixel Platformer characters** | pixel 24 px | Space kids and tiny creatures in four colors; works as cute pixel allies. |
| Cute | Toon Characters, Shape Characters | smooth vector | Not sampled; possible player avatars. |

### 5. UI
| Pack | Style | Size | License | Why it fits |
|---|---|---|---|---|
| **UI Pack - Pixel Adventure** | pixel, brown/blue/gray, thick or thin outline | small and large tiles (about 91 large tiles in the Thick set) | CC0 | Panels, buttons, bars, sliders, icons in an adventure-RPG look; matches the pixel enemy and hero packs. `previews/ui-pack-pixel-adventure.png`. |
| **UI Pixel Pack** | pixel, bright (white, yellow, green, orange, blue, tan) | one spritesheet | CC0 | Chunky, colorful, cute panels and buttons plus arrows and cursors. Good for the cute theme and for the Munchers menu. `previews/ui-pixel-pack.png`. |
| Fantasy UI Borders | smooth vector, white line frames | scalable | CC0 | Ornate dialog and portrait frames (square, round, hex), dividers; for story-beat dialogue. Recolor in CSS. `previews/fantasy-ui-borders.png`. |
| Others in the bundle | UI Pack, UI Pack - Adventure, Mobile Controls, Cursor packs | various | CC0 | Not sampled. |

### 6. Sound (optional)
All CC0 `.ogg`:
- **RPG Audio** (full sample copied, 50+ files): book flips, door open and close, cloth, coins, footsteps, knife slices, metal pots, leather. Map and camp flavor.
- **Impact Sounds** (sample of 14): punches, bell, soft and wood hits. Attack and damage hits.
- **Interface Sounds** (sample of 18): confirmation, error, select, click, pluck, question, open, close. Right/wrong answers and menus.
- **Music Jingles, Retro** (full set): short fanfares and stingers for win, level-up, and rescue. Other jingle families (Hit, Pizzicato, Saxophone, Steeldrum) are in the bundle.
- Not sampled: Music Loops (background music), Retro Sounds 1/2, Voiceover, Foley.
Wrong answers must stay gentle (no harsh buzzers), so prefer the soft `pluck` and `question` sounds there.

## Recommended combos
**A. Classic fantasy (pixel, all one family):** Tiny Dungeon (heroes, monsters, items, dungeon backdrop) + Roguelike Characters (extra
heroes/customization) + Roguelike Base or Tiny Town (overworld) + UI Pack - Pixel Adventure. Consistent 16 px look, gritty-ish,
limited monster count.

**B. Cute (pick one):**
- *B1, pixel cute:* Tiny Town (map) + Pixel Platformer (characters, enemies, backgrounds) + UI Pixel Pack. Consistent pixel look.
- *B2, smooth cute:* Map Pack + Animal Pack Remastered + Background Elements Remastered + Monster Builder + Fantasy UI Borders.
  The richest and cutest set and the best match for the Mario-World map, but not pixel art.

**Default mix (cute allies and heroes, classic monsters and landscapes, per game-ideas):** the pixel pairing is
Tiny Dungeon monsters + Pixel Platformer cute allies on a Tiny Town map. The smooth pairing mixes Animal Pack allies with
Tiny Dungeon monsters, which would clash (smooth vs outlined pixel), so avoid mixing the two families inside one scene.

My recommendation: **pixel for the classic theme (A) and B2 smooth for the cute theme**, as the two switchable themes, because
the smooth family is where the real Mario-World map pieces and the ally animals are. If the owner insists on pixel everywhere,
use A and B1 and build the map from Tiny Town / Roguelike Base.

## Gaps and risks
- **Few pixel monsters:** Tiny Dungeon has about 12 and Pixel Platformer about 10. Expect palette swaps and Roguelike Characters layering.
- **No pixel Mario-style path/node tiles.** Only the smooth Map Pack has them; in pixel we draw node markers ourselves.
- **No animations,** only static frames. Attack animations (lunge, flash, shake) must be done with CSS, as planned.
- **Different tile sizes:** 16 px (Tiny/Roguelike), 18 px (Pixel Platformer tiles), 24 px (Pixel Platformer chars/backgrounds), 64 px (Map Pack). Scale
  by integers with `image-rendering: pixelated` and do not mix scales in one scene.
- The Roguelike sheets are large single images; slice by 16 px with a 1 px gap. Tiny Dungeon/Town/Battle and Pixel Platformer ship
  individual `Tiles/*.png` files too.

## Files
- Samples: `assets/candidates/{tiny-dungeon,tiny-town,tiny-battle,pixel-platformer,roguelike-base,roguelike-characters,map-pack,monster-builder,animal-pack-remastered,background-elements-remastered,ui-pack-pixel-adventure,ui-pixel-pack,fantasy-ui-borders,audio-*}/`
  (each keeps its `License.txt`).
- Contact sheets: `assets/candidates/previews/*.png`.

## Arrow Range (archery) art
Searched separately: see `docs/game-ideas.md`, "Arrow Range: design plan" > "Art". Chosen from the smooth family (Background Elements Remastered, Shooting Gallery, Platformer Pack Remastered, Toon Characters);
the bundle has no bow, arrow or quiver, so those are original SVG.
