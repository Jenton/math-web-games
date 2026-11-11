# Kenney assets for the other games (Munchers, Balance, Machine Builder) and sound

> **Status: built.** The picks below were implemented (see "What was built" at the end) and the open questions were settled: smooth-vector art for the three
> puzzle games, sound on by default with a mute button, a spoken "correct" on perfect results (spoken numbers were removed from Balance). The "Where the games are today" section describes the state *before* this work and is out of date (sound now exists in `js/sfx.js`).
> For new games use `docs/new-game-checklist.md` and `docs/art-shortlist.md`; re-run `tools/make_kenney_assets.sh` to regenerate assets.

Scope: everything except Creature Quest art (another chat owns that, see `docs/art-shortlist.md`).
Source bundle: `AI Projects/Kenney Game Assets All-in-1 3.8.0` (CC0, not committed; copy only what we use into `assets/`).

## Where the games are today
- All three games draw with emoji and CSS. Munchers has 4 skins (Block World 🐸/🧟, Creatures 🐣/🦇, Fantasy 🧙/🐉, Cute 🐱/🐛).
  Balance and Machine Builder have no characters at all, just blocks, a scale, and number cards.
- **There is no sound anywhere in this repo** (no AudioContext or audio files on any branch). The Munchers sound effects
  mentioned must live in another chat or branch. Sound is a new feature here, built on Kenney audio.

## Picks per game

### Munchers (grid, eat the numbers that fit)
- **Player and "glitch" characters:** *Animal Pack Remastered* (round cute animals, 8 styles each, CC0). Covers the Cute and
  Creatures skins: frog, penguin, panda, etc. as the muncher. For enemy "glitches": *Monster Builder* or the
  *Pixel Platformer* blob enemies. Fantasy skin: *Tiny Dungeon* wizard and ghost/bat/skull (shared with Quest classic, so the
  family of games feels related).
- **Board cell tiles:** *Letter Tiles* (wood / gold / stone tile backgrounds that hold a glyph) as the number cell base, one
  material per skin. Wood for Block World, stone for Fantasy.
- **Pop effects:** *Particle Pack* (stars, sparkles) for a correct munch; *Emote Pack* bubbles (❗ ❓ 💧 😞) for "wrong, here is why".
- Skip: Board Game / Puzzle packs, too generic for the main character role.

### Balance (scale, level it with the mystery block)
- **Weight blocks and the `?` block:** *Physics Assets* has smiley and one-eyed square and round blocks in 4 colors, built to be
  weights, plus stone planks. Perfect for "mystery block" with a face that reacts (happy when level).
- **Number tokens and coins:** *Puzzle Pack 2* (coins, gems, stars, shapes in 8 colors) as 1/5/10 weights.
- **Scale and pans:** build from *Physics Assets* planks/circles or *Block Pack (Pixel)*; no ready-made scale exists, so one small
  SVG or CSS piece is still hand-made. Reward: *Medals* for the 1-3 star result.

### Machine Builder (operation cards chain start to target)
- **Cards and pipes:** *Puzzle Pack 2* pipe pieces (green, white, blue) are an almost literal "machine" chain between cards;
  *Letter Tiles* for the number cards; *Generic Items* / *Game Icons* for +, -, x, / operator icons.
- **Par/stars:** *Medals* (shared with Balance and Quest) so star ratings look the same everywhere.
- Optional pixel flavor: *Pixel Platformer Industrial Expansion* (gears, pipes, crates).

### Portal / shared
- **Home card icons** (replace ⚔️ 🐸 ⚖️ ⚙️): one small sprite per game, from the same families as its picks.
- **Font:** *Kenney Future / Kenney High* (TTF in `Other/Fonts`) for headings; keep a plain system font for number cells so digits stay readable.
- **Backgrounds:** *Background Elements Remastered* (already planned for Quest cute) or *Pattern Pack* tiles for the portal and puzzle backdrops.

## Sound (new, and better than synthesized beeps)
All 1,286 files are `.ogg`. **Convert before shipping: older iPad Safari cannot play Ogg Vorbis.** `ffmpeg` is installed;
convert the ~25 chosen files to `.m4a` (AAC) or `.mp3` with a small script in `tools/`, keep sizes tiny (under about 1 MB total).

| Need | Pack | Suggested files |
|---|---|---|
| Correct munch / right answer | Retro Sounds 2 or Digital Audio | `coin1-3`, `pickup1-2`, `pepSound1-3` |
| Wrong (gentle, kid-friendly, not harsh) | Interface Sounds | `error_004`..`error_006`, `bong_001`, soft `drop_00x` |
| Step / move | UI Audio, Impact Sounds | `rollover1-3`, `footstep_grass_00x` |
| Button click, open/close panel | Interface Sounds / UI Audio | `click_00x`, `open_001`, `close_001`, `switch1-5` |
| Balance level / solved | Digital Audio, Interface Sounds | `powerUp1-3`, `confirmation_001-003`, `glass_00x` for the scale tink |
| Block placed on scale | Impact Sounds | `impactGeneric_light_00x`, `impactBell_heavy_00x` |
| Machine card chained | Interface Sounds, Foley | `maximize_00x`, `metalClick`/`beltHandle` from RPG Audio |
| Win a puzzle / earn stars | Music Jingles | `jingles-pizzicato_*` or `jingles-retro_*` (short, cheerful; pick one set so games match) |
| Lose a heart / game over | Retro Sounds 2 | `lose1-3` (mild), `gameover1`; avoid `explosion*` |
| Quest battle hit / spell | RPG Audio, Impact Sounds | `knifeSlice`, `impactGeneric_*`, `chop`; cloth/book sounds for cards |
| Background music (optional, off by default) | Music Loops | `Farm Frolics`, `Mishief Stroll`, `Wacky Waiting` (calm, loopable) |
| Voice ("Ready, set, go", "Level up", "Correct") | Voiceover Pack | numbers 1-10 and `correct`, `level_up`, `congratulations`. Nice for the kindergartener who reads but may like hearing the number. Skip the `war_*` lines. |

Design rules: sound on by default but with one mute toggle in the portal (and a "calm" mode that mutes buzzy sounds); play at
low volume; preload the ~25 files; keep audio behind one `js/sfx.js` module (`Sfx.play('correct')`) so games never name files.
Honor the "calm" setting the Munchers already has.

## Style coherence (the one decision worth making)
Two families again: **smooth flat vector** (Animal Pack, Physics Assets, Puzzle Pack 2, Letter Tiles, Medals) and **pixel**
(Tiny Dungeon, Pixel Platformer). My recommendation: **use the smooth family as the default look for Munchers, Balance and Machine**
(it covers all three and matches Quest's Cute theme), and offer pixel only where a skin is already pixel-flavored (Munchers'
Fantasy skin with Tiny Dungeon). That keeps one art setting per player, consistent with the Quest `questArt` setting.

## Suggested order
1. `js/sfx.js` plus ~25 converted sound files plus a mute toggle (cheapest, biggest feel upgrade, touches every game).
2. Balance blocks and weights (Physics Assets): the most visible win for the least code.
3. Munchers characters and tile cells per skin.
4. Machine Builder pipes/cards, shared Medals for stars, portal card icons and font.
5. `assets/CREDITS.md` (shared with Quest; CC0 so optional, but polite).

## Open questions for the owner
- Smooth-vector default for the three puzzle games, or keep the pixel look to match Quest classic?
- Sound on by default (with a mute), or opt-in? Voice numbers (Voiceover Pack) wanted?
- Where did the Munchers sound effects mentioned come from (another branch)? Replace them with the picks above?

## What was built (branch `kenney-assets`, for review)
- `tools/make_kenney_assets.sh` copies, downsizes and converts the chosen assets into `assets/kenney/` (about 1 MB, 90 files, re-runnable).
- `js/sfx.js` (`Sfx.play('correct')`, `Sfx.say(7)`), a mute button in the top-right corner (saved on the device, separate from the game save),
  and a soft click on every button. Sounds are wired into Munchers, Balance and Machine Builder. Music exists in the module but has no UI yet.
- Munchers: wooden/blue/marble/yellow tiles per skin, animal player and alien glitch sprites, star pop on a correct munch, "!" on a wrong one.
- Balance: alien face blocks as the mystery weight, metal tiles as known weights, hop when level. (It used to say the number aloud for 1-10; removed at the owner's request, it was annoying.)
- Machine Builder: tile cards and numbers; medal for 1-3 stars in the result panel (same medals as Balance and Munchers).
- Portal: Kenney Future headings, sprite icons on the game cards, `assets/CREDITS.md`.
- Deviations from the plan above: Tiny Dungeon (pixel) was not used, so the three games are all the smooth style; no Particle/Generic Items beyond one star.
  Creature Quest is untouched except its card icon (a medal). Voice numbers play only in Balance.
