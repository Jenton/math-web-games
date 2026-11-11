<<<<<<< HEAD
# Art credits

All art below is from **Kenney** (https://kenney.nl), published under **CC0 1.0** (public domain, no credit required; credited anyway).
Source: "Kenney Game Assets All-in-1 3.8.0". Each pack's own `License.txt` is kept in `assets/candidates/<pack>/`.
The bundle itself is not in this repo.

| Used for | Pack | Files |
|---|---|---|
| Classic theme: monsters and heroes, dungeon backdrop (pixel, 16 px) | Tiny Dungeon | `assets/quest/classic/enemy/`, `classic/ally/`, `classic/bg/dungeon.png` |
| Classic theme: meadow backdrop, world map (pixel) | Tiny Town | `assets/quest/classic/bg/meadow.png`, `classic/map/meadow.png` |
| Cute theme: allies (round animal faces) | Animal Pack Remastered | `assets/quest/cute/ally/` |
| Cute theme: monsters (assembled from parts) | Monster Builder Pack | `assets/quest/cute/enemy/` |
| Cute theme: battle backdrops | Background Elements Remastered | `assets/quest/cute/bg/` |
| Cute theme: world map decorations | Map Pack | `assets/quest/cute/map/` |

`assets/quest/` is generated from `assets/candidates/` by `tools/make_quest_assets.py` (deterministic; the cute monsters are composites).
`assets/candidates/` holds samples and contact sheets of other packs that were shortlisted (`docs/art-shortlist.md`) but are not used yet:
Tiny Battle, Pixel Platformer, Roguelike Base and Characters, UI packs, Fantasy UI Borders, and sound samples.
=======
# Credits

Art and sound in `assets/kenney/` come from the **Kenney Game Assets All-in-1** bundle by Kenney (https://kenney.nl),
released under **CC0 1.0** (public domain). Credit is not required but is given with thanks.

Packs used: Animal Pack Remastered, Platformer Assets Base, Generic Items (Lemonade Stand, via `tools/make_lemonade_assets.py`), Physics Assets, Letter Tiles, Medals, Particle Pack, Emote Pack, Puzzle Pack 2,
Fonts (Kenney Future), and the audio packs Interface Sounds, UI Audio, Digital Audio, Retro Sounds 2, Impact Sounds,
RPG Audio, Music Jingles, Music Loops and Voiceover Pack. Images were downscaled and audio was converted from Ogg to M4A
with `tools/make_kenney_assets.sh`.
>>>>>>> origin/main
