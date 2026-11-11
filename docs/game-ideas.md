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

## Not built yet (tracker)

The single place to see what is left. Tick items off (`[x]`) and move notes into the detailed sections below when
something is built. Details and design notes for each item are further down in this file.

**Status today:** built = Munchers, Balance, Machine Builder, Creature Quest (first slice). Everything below is open.

### Creature Quest (RPG) next steps
- [ ] **Tune the numbers after playtesting** (`js/rpg.js` tunables: heal, enemy attack, HP, XP). First suspect: 1 star may be too forgiving, since power-only play still wins ~42%.
- [ ] World map: regions themed by skill ("Multiples Mountain"), enemies and a boss per region
- [ ] Character customization (cosmetic only: outfits, colors, hats)
- [ ] Spellcraft enemies (exact-HP: choose the spell whose damage lands on the enemy's HP)
- [ ] Machine Builder bosses (reduce the boss's power to 0 in the fewest steps)
- [ ] More enemy and boss variety, art, and sound beyond emoji
- [ ] Creature upgrades (stronger creatures that grow with use)
- [ ] Limited cards / mana, if the lost-turn-plus-heal penalty turns out too soft

### Existing games, possible extensions
- [ ] Balance: drag-blocks-onto-pans version for the youngest players, negative weights (balloons), limited guesses, two-player "first to level it"
- [ ] Machine Builder: reverse puzzles ("which input makes 24?"), "find the missing card", step trace of a wrong attempt, co-op chain
- [ ] Munchers: two-player (shared board, race or cooperate), optional timer challenge mode

### New games
- [ ] Tower Defense (the son's favorite genre): plan phase with wave preview, then a run phase
- [ ] Number Line Runner
- [ ] Sort & Rule (Zoombinis-style logic)
- [ ] Build-a-World (Minecraft-style)
- [ ] Escape Room Locks
- [ ] Lemonade Stand / Shop
- [ ] Cut & Share
- [ ] Dungeon crawler, Potion lab, Map explorer, Co-op raid (see "Other mechanics worth keeping on the list")

### Portal and cross-cutting features
- [ ] Auto-adapting difficulty using the per-skill stats already recorded (only after playtesting)
- [ ] Fuller parent view (per-skill levels, trends, conversation-starter prompts)
- [ ] Daily puzzle per kid
- [ ] Kid-made puzzles (the older child builds a puzzle for the younger one)
- [ ] Co-op / competitive modes, handicapped by each player's own level
- [ ] Optional timer / challenge mode as an opt-in flag per game
- [ ] Offline-first install (PWA) for the iPad
- [ ] Public web address (for example GitHub Pages) so the iPad can open it without files. Needs a go-ahead first, since it makes the site public.

### Playtest notes (add what the kids say and do)
Write observations here so any chat can act on them. Suggested format: date, who played, game, what happened.
- _No playtests recorded yet._

---

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

## The RPG: Creature Quest (first slice built; the design below still guides the rest)

**Decision:** the RPG is ONE game that rolls up several mechanics, not separate games. Munchers, Balance and
Machine Builder stay as standalone games and also appear inside the RPG as mini-challenges and bosses.

**Design decisions from the owner (do not reverse without asking):**
- **Math is the *choice*, never a gate.** Do NOT build "answer a question, then your hero swings" (that is
  the Prodigy toll booth). Instead the player picks the best attack/spell, and working out which one is best
  takes math. A normal-feeling RPG attack, chosen with brains.
- **Turn-based.** No time pressure; fair to the kindergartener. (A timed mode can be an opt-in flag later.)
- **The son likes all four Prodigy hooks:** collecting a team of creatures, exploring a world/map, leveling up
  and getting stronger, and customizing his character. The meta layer should serve all four.

### Combat (turn-based)
- You field a team of up to 3 creatures and hold a **hand of attack cards/spells**. The enemy has HP and a
  visible **weakness rule** (reuse `js/engine.js` rules: "weak to multiples of 6", "weak to primes", "weak
  to fractions equal to 1/2"...). Playing a card that fits the weakness does big damage; a card that does
  not fit is resisted and may heal the enemy.
- **Cards must require computing, not eyeballing.** At low stars the cards are plain numbers; at higher stars
  they are expressions ("7 x 6", "48 / 8") and near-miss distractors (use `rule.wrong()` near misses at
  3 stars). Otherwise a kid can pick by sight.
- **Wrong picks have a real cost** (spent mana, a used-up card, an enemy heal), so guessing is a bad
  strategy. Cards are limited per fight and mana is limited.
- **A wrong pick explains itself** (`rule.why(card)`), shown after the turn resolves.
- "Can it be played without the math?" answer: no, because the best card is only identifiable by working out
  the weakness rule, and guessing burns limited resources.

### Enemy types (encounter variety, one engine)
1. **Weakness enemies** (the everyday fight): weakness rule from the Munchers rule set for the band.
2. **Spellcraft enemies** (exact HP): the enemy has exactly N HP; choose from your spellbook the spell whose
   damage lands on it. Overkill wastes mana; underkill leaves it alive. Choose-from-options, not free
   calculation, to match the "math is the choice" decision.
3. **Armored enemies** (fractions and ratios): armor is a fraction, "3/4 armored"; choose the attack that
   removes the right fraction to break the shield. At 6th grade: ratios and percents ("deal 25% of its HP").
4. **Boss fights** (reuse existing puzzles): the boss locks its attack on a Balance scale (level it to
   cancel the attack) or its power is a Machine Builder puzzle (reduce it to zero in the fewest steps).

### Meta layer
- **Creature collection:** a creature is earned by completing a pattern/puzzle that fits it (for example
  "Divisor Dragon" for a factors-of-48 puzzle), never by a score threshold. Collected creatures are your team.
  Each creature has a theme (e.g. multiples) that makes some cards stronger when it is on the team, which
  makes team choice a decision too. Original characters only.
- **Leveling:** XP comes from solving fights well (fewer wasted cards, no heals), not just from showing up.
  Levels grant stats and extra spell slots. Do not let XP farming replace the math.
- **World map:** regions are themed by skill ("Multiples Mountain", "Fraction Forest", "Prime Peaks"), each
  with enemies and a boss. The player's grade band and stars set difficulty everywhere; the map is for
  variety and exploration, not a hard grade gate.
- **Customization:** cosmetic only (outfits, colors, hats), unlocked by progress. Never sells advantage.

### Grade scaling of enemy rules (starting point)
| Band | Weakness rules | Armored / extras |
|------|----------------|------------------|
| K-1  | even/odd, greater/less, sums to a target | halves ("1/2 armored") |
| 2-3  | multiples of 2/5/10, rounding, expressions | quarters, equal groups |
| 4-5  | multiples, factors, primes | fractions with unlike denominators |
| 6    | equivalent fractions, exponents, number line | ratios and percents |

### Technical notes
- New DOM-free logic module (for example `js/rpg.js`) with a Node test (`tests/rpg.test.js`): every generated
  hand must contain at least one correct card, wrong cards must truly be wrong, damage math must be
  deterministic, and boss puzzles must be solvable (reuse the checks in `tests/puzzles.test.js`).
- Reuse `js/engine.js` rules for weaknesses and `js/puzzles.js` for bosses; do not copy them.
- New profile data (backward-compatible, with defaults in `Store.importJSON`): `profile.rpg = { team, creatures,
  xp, level, regions, cosmetics }`. A save backup must keep working.
- Follow the "How a new game plugs into the current code" steps above for the card, setup screen and section.

### First slice (BUILT: `js/rpg.js` logic, `js/quest.js` screens, `tests/rpg.test.js`)
What exists now, and where it differs from the plan above:
- **An adventure is 5 battles:** weakness, weakness, armored, weakness, boss. Win a battle for XP; lose and you retry
  the same monster at full health (no setback, no lost XP).
- **Hand and turn:** 5 cards (6 at 3 stars) refreshed every turn, each with a power of 1-3 (shown as swords). A card that
  fits the weakness hits for 3 x (power + specialist bonus). A card that does not fit does nothing, **heals the monster 4**,
  and the monster still attacks (2 per turn). A deliberately tempting high-power card that does NOT fit is always in the hand,
  so "pick the strongest-looking card" is a losing strategy. This replaces the planned limited cards/mana: the cost of a wrong
  pick is a lost turn plus a heal. Revisit if it feels too forgiving or too harsh.
- **Armored monsters:** the armor is a fraction; only cards of that value or more break through (comparing fractions). K-1 halves,
  thirds, quarters; 6th grade mixes fractions, decimals and percents.
- **Boss:** a normal weakness fight, but every 3rd turn it charges a big attack (5 damage). A Balance puzzle (reusing
  `MGP.makeBalance`) appears; solving it cancels the attack and stuns the boss for the turn. The player may ignore it and take the hit.
  Machine Builder bosses are not built yet.
- **Team and creatures:** 11 original creatures (emoji). A player starts with three matching their grade band and befriends the rest
  by beating the matching monster (armor and boss included). Up to 3 on the team. A creature strong against the monster's weakness
  adds +1 power (max +2) and shows a star in the picker. Locked creatures only show if they can be found at the player's grade.
- **Leveling:** XP is 10/15/30 per monster/armored/boss, +10 (+20 boss) for a flawless fight, +5 for one mistake. Level n needs
  40 + 20(n-1) XP and gives +2 team health (16 at level 1).
- **Difficulty:** the player's grade band and stars apply as in the other games. Simulations in `tests/rpg.test.js` check that a
  perfect player always wins, a learner who misses a third of the time still wins about 85% at 1 star, and random or
  power-only play mostly loses.
- **Not built yet:** world map, character customization, Spellcraft (exact-HP) enemies, Machine Builder bosses, sound/art beyond emoji.
  Next steps after playtesting: tune the numbers in the tunables block at the top of `js/rpg.js`, then add the map and customization.

---

## Later

### Tower Defense (the son's favorite genre)
**Pitch:** enemies are numbers marching down a lane; towers target by number property. The math is choosing
the right tower for the incoming wave, not answering a quiz.
**Mechanic:** a **planning phase** (turn-based, no pressure) where you see the incoming wave ("12, 15, 18, 20,
21, 24...") and place towers on tiles with limited gold; then a run phase where the wave plays out. A
"Multiples of 3" tower only hurts multiples of 3, a "Prime" tower only primes, a "Fraction" tower only matches a
fraction value. The wave preview rewards reading the whole wave and planning coverage.
**Scaling:** K-1 even/odd and sums; 2-3 multiples and rounding; 4-5 factors and primes; 6 fractions,
exponents and negatives. Wave size and the number of towers grow with stars.
**Anti-brute-force:** limited gold, and a mistargeted tower wastes its shot. A wrong placement is explained in
the wave summary (which enemies leaked through, and why that tower could not hit them).
**Reuse:** targeting rules come from the `js/engine.js` rule set; collected RPG creatures could later serve as
towers. Needs a small real-time run phase, so build after the RPG slice.
**Co-op:** two players share a lane, each placing a different tower type.

### Other mechanics worth keeping on the list
- **Dungeon crawler:** each room is a puzzle type (lock, scale, pattern); path choices have math trade-offs
  ("this door costs 12 mana"). Could become a region type inside the RPG.
- **Potion lab:** mix ingredients in ratios to match a target potion. Fractions, ratios, proportional reasoning.
- **Map explorer:** coordinates and grid distances; plot a route where the cost is the distance.
- **Co-op raid:** two players each hold half of a spell (one the tens, one the ones) and must coordinate to
  hit an exact number. Works fairly across a 5- and a 9-year-old.

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

- **Creature/block collection:** now part of the RPG plan above. Items appear because a pattern or puzzle was
  completed, never for a score. Must not become the reason to play on its own.
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

Playtest the existing games, especially Creature Quest, with both kids first. Then: grow the RPG (map,
customization, Spellcraft enemies, more bosses), then Tower Defense, then Munchers
two-player, then Number Line Runner or Sort & Rule depending on what the kids ask for.
