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
