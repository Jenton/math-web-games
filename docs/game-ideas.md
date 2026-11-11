# Game Ideas Backlog

Self-contained reference for any chat or contributor. Read this together with
`docs/design-plan.md` (plan and decisions) and `docs/design-review.md` (critique).

## Context in brief

- **Who it's for:** two kids, a 9-year-old and a kindergartener who reads. Content must scale from
  kindergarten to 6th grade, so a younger child can grow into harder levels of the same game.
- **Taste:** classic edutainment (Number Munchers, Zoombinis, Math Blaster), puzzle-first. Not
  Khan/Beast Academy practice problems. Not Prodigy, where the math is a toll booth before the "real" game.
  The kids like Minecraft/building, Pokémon-style creature collecting, fantasy/adventure, and cute things.
- **Solo first.** Co-op/competitive modes are wanted too, but secondary.
- **Devices:** laptop and iPad mainly, phone as a bonus. Touch and keyboard from day one.
- **Light and private:** static site, no accounts, no ads. Progress in localStorage with a backup file.
- **Original characters only** (no licensed IP). Themes are skins.

## The rules every game must follow

1. **Math is the mechanic.** Before a game ships, write down the answer to: *"Could a kid play well
   without understanding the math?"* If yes, redesign. Brute force (eat everything, click everything)
   should cost something, such as hearts, move limits, or an efficiency score.
2. **Wrong answers explain themselves.** Show why, with the arithmetic (see `rule.why()` in `js/engine.js`).
3. **No timers by default.** An optional timed "challenge mode" can come later as a flag.
4. **Hand-design the aha, then generate the numbers.** Puzzle templates are designed by a person; the
   generator only varies the numbers inside them. Random drills in disguise are a failure.
5. **Difficulty = grade band x stars.** Bands: `K-1`, `2-3`, `4-5`, `6`; stars 1-3. Every game must
   produce sensible content for all four bands.
6. **Reward the puzzle, not the score.** Any collectible should appear because a pattern or puzzle was
   completed, never just for hitting a number of points.

## How a new game plugs into the current code

State of the codebase today (check the files; this may drift):

- **Logic modules, no DOM, with Node tests:** `js/engine.js` (Munchers rules; `BANDS`, `SKILLS`,
  `makeLevelRule`, `buildBoard`) and `js/puzzles.js` (Balance and Machine generators). Tests live in
  `tests/engine.test.js` and `tests/puzzles.test.js`. New game logic should follow this pattern.
- **`js/storage.js`:** `Store` with profiles (`settings: {band, stars, theme, monsters}`, `stats`, per-game
  progress such as `munchers: {levels, streak}`), `Store.record(profile, skillId, right)`, `Store.save()`.
  Per-game progress objects must be backward-compatible; `Store.importJSON` fills defaults.
- **Game UI modules:** `js/game.js` (Munchers), `js/balance.js`, `js/machine.js`. Each exposes
  `start(profile, {onSave, onExit})`.
- **`js/ui.js`:** shared toast and result panel used by every game (`UI.toast`, `UI.panel`, `UI.hide`).
- **`js/app.js`:** the portal. A `GAMES` table maps a game key to its name, icon, how-to-play steps, a
  sample puzzle for the setup screen, and its module. `SCREEN_OF` maps a game key to its screen id. Every
  game goes through one shared **setup screen** (pick grade and challenge in plain language, then Play).
- **`index.html`:** a game card in the menu (`data-game="<key>"`) plus one `<section id="<screen>">` per game.

Steps to add a game: (1) DOM-free generators in their own module plus a Node test (verify solvability and
that wrong answers are really wrong); (2) add skill ids to `SKILLS` if they should appear in the grown-ups
stats; (3) a `js/<game>.js` module with `start`, and a `<section>` in `index.html`; (4) add the card,
`GAMES` entry and `SCREEN_OF` entry; (5) add progress to the profile backward-compatibly; (6) update the README.

---

## Already built

These were in the original backlog and now exist. Don't rebuild them; extend them instead.

### Balance (built)
A scale tips as the player changes the number for a mystery block `?`; they level it to solve an equation.
K-1: one unknown (`? + 3 = 10`). 2-3: equal groups and add/multiply. 4-5: two-step. 6: unknown on both
sides. Generator is in `js/puzzles.js` (`makeBalance`); tests check every puzzle has a unique solution.
It uses a number stepper for the guess rather than the drag-the-blocks idea in the first sketch.
**Possible extensions:** the drag-blocks-onto-pans version for the youngest players, negative weights
(balloons that lift) at 6th grade, a limited-guess mode, and a two-player "first to level it" mode.

### Machine Builder (built)
Tap operation cards to turn a start number into a target in as few steps as possible. Par is computed
exactly by breadth-first search, so star ratings are fair. Generator is in `js/puzzles.js` (`makeMachine`).
**Possible extensions:** reverse puzzles ("which input makes 24?"), "find the missing card", step-by-step
trace of where a wrong attempt diverged, and a co-op mode where each player owns half the chain.

---

## Later

### Number Line Runner
Platformer where you land on exact values (3/4, 0.6, 7x8, -2). Jump distances are number-line lengths.
Builds number sense and fractions/decimals. Scale: whole numbers to 20, then tens/hundreds, then fractions
and decimals, then negatives. Mistake explanation: show where the landing was relative to the target on a
number line. Needs the most animation/physics work of any idea, so it's a good candidate to build after
the puzzle-style games.

### Sort & Rule (Zoombinis-style logic)
Sort creatures or numbers through gates that each have a hidden rule; infer the rule from what gets
accepted and rejected. Teaches pattern finding and logical reasoning. Scale: one visible property (K-1),
number properties like even/odd/multiple of (2-3, 4-5), compound rules with and/or/not (6). The "can it be
played without the math?" answer here is tricky because trial and error is the game; require the player to
*state* the rule at the end (choose from options) before the level counts as solved.

### Build-a-World (Minecraft-style)
Construct structures under constraints: "a garden with perimeter 24", "a room with volume 60 using these
blocks". Area, perimeter, volume, and multiplication arrays. Scale: counting blocks (K-1), arrays and
perimeter (2-3), area/volume (4-5), surface area and scaling (6). Creative mode is the hook; the
constraints are the math. Watch the scope; this is the biggest idea on the list.

### Escape Room Locks
A story wrapper around number-pattern and equation puzzles: each room has a lock (a sequence to continue,
a balance to solve, a cipher). Could reuse the Balance and Machine Builder generators as lock puzzles.

### Lemonade Stand / Shop
Run a tiny business: money, change, profit, ratios, unit pricing. Decisions are the math (how many cups to
make given the forecast?). Scale: coin counting (K-1) up to percent and ratio (6). Needs careful design so
that it doesn't become a clicker game.

### Cut & Share
Split pizzas, ropes, or maps fairly. Fractions and area intuition. Scale: halves/quarters (K-1) up to
adding and comparing fractions with unlike denominators (4-5) and fraction of a fraction (6).

## Cross-cutting features (not games)

- **Creature/block collection:** items appear because a pattern or puzzle was completed (e.g. a creature
  is "unlocked" by solving its rule). Keep it small and cosmetic. Must not become the reason to play.
- **Auto-adapt difficulty:** replace the "try harder?" suggestion with automatic adjustment, using the
  per-skill `stats` already recorded. Do this only after real playtesting shows where the dial should sit.
- **Kid-made puzzles:** the older child builds a Munchers rule or Machine puzzle for the younger one.
  Creating a puzzle is deeper math than solving it, and it's built-in co-op.
- **Daily puzzle:** one hand-crafted puzzle per kid per day.
- **Parent prompts:** the grown-ups view suggests a conversation starter ("ask why 17 isn't a multiple of 3").
- **Co-op/competitive modes:** handicapped by each player's own level so a 5- and 9-year-old can play fairly.
  Munchers two-player (shared board, race or cooperate) is the simplest first one.
- **Offline-first PWA:** installable on the iPad and works without internet.
- **Optional timer / challenge mode:** an opt-in flag per game.

## Suggested order

Playtest the three existing games with both kids first. Then: collection layer, Munchers two-player,
then Number Line Runner or Sort & Rule depending on what the kids ask for.
