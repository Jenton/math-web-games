# Math Web Games: Design Plan (v1 draft)

## Goal
A web portal of fun, puzzle-first math games for two kids (9 and 5½) that
scales from kindergarten through 6th grade. Inspired by Number Munchers and
Zoombinis, with Prodigy's collecting/progression appeal, but where the math
*is* the gameplay, not a toll booth before the "real" game.

## Design principles
1. **Math is the mechanic.** If a kid can play well without understanding the
   math, the design fails.
2. **Puzzles over drills.** No worksheet-style question/answer screens.
3. **Scale by grade, not by kid.** Every game reads a skill/difficulty
   setting, so the 5-year-old can grow into harder content without new games.
4. **Solo first, co-op/competitive second.**
5. **Light, private, no accounts.** Progress lives on the device.
6. **Works on iPad and laptop first, phone as a bonus.**

## Themes
Minecraft/building, Pokémon-style creature collecting, fantasy/adventure,
plus a cute/kawaii skin (Hello Kitty-style) for the younger kid.
Theme is a *skin*, separate from game logic, so one game can have multiple skins.
(Use original characters, not licensed IP.)

## Grade-scaling system
Each game declares which **skills** it can generate content for. Skills are
tagged by grade band:

| Band | Example skills |
|------|----------------|
| K-1  | counting, number bonds to 10, add/sub within 20, shapes, patterns |
| 2-3  | add/sub within 1000, intro multiplication, arrays, simple fractions, money |
| 4-5  | multi-digit multiplication, factors/multiples, primes, fraction ops, decimals |
| 6    | ratios, negatives, exponents, one-step equations, area/volume |

A kid profile stores a **skill level per skill** (not one global grade).
Games ask the engine for "a puzzle at skill X, level Y" and adapt up or down
based on recent success. Parents can override.

## Game roster
**Launch set (solo):**
1. **Munchers**: grid game; eat numbers matching a rule (multiples, factors,
   primes, fractions equal to 1/2, etc.) while dodging monsters.
2. **Balance**: put items on a scale to find the unknown (K: equal groups;
   6th: equations).
3. **Machine Builder**: chain operations to turn input into a target in
   the fewest steps.

**Next:**
4. Number Line Runner (platformer, land on exact values).
5. Sort & Rule (Zoombinis-style logic / hidden rules).
6. Build-a-World (Minecraft-style: area, perimeter, volume constraints).

**Co-op / competitive (secondary):**
- Munchers 2-player (shared board, race or cooperate).
- Balance Duel (first to solve the same scale).
- Co-op Machine (two players each control half of the chain).

## Meta layer
- Per-kid profile (name, avatar), picked on a home screen.
- Collection: creatures/blocks earned by *solving puzzles well*, not by
  answering quiz questions.
- Parent view: per-skill levels, recent accuracy, what they're stuck on.

## Tech
- Static site: HTML/CSS/JavaScript (TypeScript if we want), canvas/DOM, no
  backend, no accounts, no ads, no tracking.
- Progress in `localStorage` (with export/import of a save file as backup).
- Shared modules: `engine/` (skills, difficulty, puzzle generators),
  `ui/` (themes, input), `games/<name>/`, `portal/` (profiles, collection).
- Touch + keyboard input from day one; responsive layout.
- Deployable on GitHub Pages or any static host.

## Milestones
1. Portal shell + profile picker + skill engine skeleton.
2. Munchers playable end-to-end, K-6 content generators.
3. Playtest with both kids, adjust.
4. Balance, then Machine Builder.
5. Collection layer and parent view.
6. Co-op modes.

## Decisions after review (v1)

**Current decisions (these win over anything earlier in this file or in `docs/design-review.md`):**
- Original characters only; no licensed IP. Art is Kenney CC0 (smooth vector for the puzzle games, pixel for Quest classic, Escape Room and Number Defense). Emoji is only a fallback.
- No timers by default. Difficulty is grade band x 1-3 stars, set by the player; auto-adapt only after playtesting.
- No-reading mode is **dropped** (the younger player reads), although numbers can be spoken (`Sfx.say`).
- Progress is private by default (localStorage plus a backup file); opt-in encrypted cloud sync is built and live (`docs/sync-design.md`).
- Every game must pass the "can it be played without the math?" test (`docs/design-review.md` item 1) and the polish bar in `docs/new-game-checklist.md`.

Earlier decisions, kept for history:

- **No-reading mode: dropped.** The younger player reads, so written prompts are fine at every level.
- **v1 limits are deliberate, and meant to be revisited after playtesting.** Each is built as a
  setting or extension point so it can be lifted without a rewrite:

| v1 limit | How it can be lifted |
|----------|----------------------|
| No timers | Add a timed "challenge mode" flag per game |
| Manual difficulty (band + stars), with a "try harder?" suggestion after 3 clean levels | Replace the suggestion with auto-adapt using the per-skill stats already recorded |
| One game (Munchers) | Games are separate modules; Balance and Machine Builder have placeholder cards |
| No collection / rewards layer | Profiles already have room for it; add after playtest |
| No co-op / competitive | Add per-game modes later; handicapped by each player's own level |
| Original characters only (emoji skins) | Skins are data in `js/game.js`; swap in art any time |

## Status
v1 built: profiles, settings, Munchers (all four bands, 10 skills), Balance, Machine Builder, Creature Quest
(RPG first slice), backup/restore, tests. See `docs/game-ideas.md` for what is next.
