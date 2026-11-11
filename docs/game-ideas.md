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

### Creature Quest (RPG) v2 (see "Creature Quest v2" section for the decisions)
- [ ] Stage 1: battle scene with background image, enemy/ally sprites, attack animations, art manifest with fallbacks, `assets/CREDITS.md`
- [ ] Review and choose CC0 art packs for each theme (cute, classic fantasy, default mix) and verify each license
- [ ] Art theme setting at game start (cute / classic fantasy / mix)
- [ ] **Cross-device saving for every game** (owner priority): see `docs/sync-design.md`
  - [x] Stage 1: v2 save format, v1 migration, merge logic and tests; all games moved onto it
  - [ ] Stage 2: encryption helpers + sync adapter tested against a local fake
  - [ ] Stage 3: Firebase project (owner's existing Google account), Hosting for the site, Firestore rules, deploy. Owner wants step-by-step hand-holding (the Firebase UI is confusing to them)
  - [ ] Stage 4: sync UI (set up family code, add device, sync status, manual sync)
- [ ] Save the in-progress adventure and map node progress (today only XP, level, creatures and wins are saved; the current run restarts at battle 1). New progress must follow the merge rules in `docs/sync-design.md` (cleared map nodes are a set, node stars are a max)
- [ ] Non-combat variant of the RPG for the younger player (see the idea above; no design yet)
- [ ] Stage 2: 2-3 enemies per fight with their own weaknesses, tap-to-target, every enemy visibly hits back, remove card power, retune and re-simulate
- [ ] Stage 3: ally roster (~12 to start, 20+ later) with effects: hit all, shield/heal, stun, remove a wrong card; ally picker UI; "no team can make a fight unwinnable" test
- [ ] Stage 4: Mario-World-style world map (pixel art), node types (battle, elite, boss, rescue, story beat, puzzle, camp), story chapters per region, scripted ally-rescue encounters
- [ ] Tune the numbers after playtesting (`js/rpg.js` tunables)
- [ ] Character customization (cosmetic only)
- [ ] Spellcraft enemies (exact-HP), Machine Builder bosses
- [ ] Creature/ally upgrades (growth with use)

### Existing games, possible extensions
- [ ] Balance: drag-blocks-onto-pans version for the youngest players, negative weights (balloons), limited guesses, two-player "first to level it"
- [ ] Machine Builder: reverse puzzles ("which input makes 24?"), "find the missing card", step trace of a wrong attempt, co-op chain
- [ ] Munchers: two-player (shared board, race or cooperate), optional timer challenge mode

### New games
- [x] Tower Defense, built as **Number Defense** (`js/tdlogic.js` logic + `tests/tdlogic.test.js`, `js/td.js` screen): wave preview, limited gold, towers with rules, automatic run phase, per-number explanations. Not built yet: co-op, creatures as towers, tower upgrades.
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
- **Nov 2026, owner review of Creature Quest first slice:** graphics too plain (wants background and sprites, Earthbound-style); wants multiple enemies at once that visibly hit back; allies felt random and thin (wants story-driven rescues and many more allies that matter); "swords = power" was confusing (right answer should do damage, wrong none); worried allies-supply-cards could cause unwinnable fights. Decisions are in "Creature Quest v2".

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

Steps to add a game (NOTE: follow "How the code works now" in `docs/sync-design.md`: save under `profile.games.<gameId>` via the `Store` helpers, never write a counter backwards, register a merge rule in `js/save.js`, and add tests to `tests/save.test.js`): (1) DOM-free generators in their own module plus a Node test (verify solvability and
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

## Creature Quest v2: design decisions from the first review

The first slice was playtested by the owner and found too thin. **These decisions supersede the first-slice
mechanics described further down** (especially "power" on cards and "allies as stat bonuses"). Read this section first.

### What the owner said (Nov 2026)
- Graphics should be much better: a background image and enemies as **sprites**, Earthbound-style.
- **More than one enemy at a time**, and enemies must visibly **hit back after the player's turn**. (In the first
  slice they did hit back, but only as a text line and a health-bar change, which read as nothing happening.)
- Allies were just randomly added. They want **scripted story events**, e.g. after some battles an encounter frees
  a trapped ally. Capturing monsters, Pokemon-style, was rejected as not scalable.
- **Many more kinds of allies**, and allies that actually matter.
- "Swords = more power" was confusing. **A right answer does damage; a wrong answer does none.** Remove card power.
- Worry about "allies supply the cards": the wrong ally choice could make a fight unwinnable.

### Design principle: the math never depends on the team
The question the player must answer (find the card that fits an enemy's weakness) is the same whichever ally is used.
A right answer always works. **Allies change what a right answer DOES, never whether the player can win.** There must
be no team that makes a fight unwinnable. Add this to the "can it be played without the math?" checklist, and test it.

### Battle loop (v2)
1. Two to three enemies on screen (1-2 in early fights, up to 3 later), each with **its own weakness**.
2. The player taps an **enemy to target it**. The hand is built for that enemy's weakness (reuses `js/engine.js` rules).
   For armored enemies the card rule is the existing armor rule in `js/rpg.js`.
3. The player picks which **ally acts** (default: the first, so the youngest player can skip this) and plays a card.
4. **Right card:** damage to the target plus the acting ally's effect. **Wrong card:** no damage, and the explanation
   is shown (as today).
5. **Every living enemy then attacks**, one after another, with visible animation and damage numbers. A wrong turn is
   costly because all enemies still hit back, which is what makes guessing a bad strategy now that power is gone.
6. Win by defeating all enemies. Lose = retry at full health (keep the gentle failure behavior).

### Ally effects (owner picked all four)
A right answer triggers the acting ally's effect. Each effect is themed to the ally's math skill. Examples:
- **Hit all enemies:** Hopper (multiples) makes a skip-strike across the whole group.
- **Shield / heal:** Shelly (armor) blocks the next hit; a healer ally restores team health.
- **Stun:** Pebble (golem) makes an enemy skip its next attack.
- **Remove a wrong card:** Owlbert (compare) narrows your hand, a hint-style effect.
- Ideas to add later: critical hit (Primo, primes), armor-pierce, combo bonus on consecutive right answers.
Plan for 20+ allies across the grade bands, each with a name, a short personality line, a skill theme and one effect.
Effects must be balanced so no ally is required and none makes the fight trivial (add simulation tests like `tests/rpg.test.js`).

### Getting allies: story chapters, not drops
- **A story chapter per region.** Each region has a few battles, then a **rescue encounter** where a captor holds a
  caged ally. Beating the captor frees the ally. Allies are fixed characters, so the roster grows as the story advances.
- Chapters are **data** (a script file per region: enemies, order, dialogue lines, the ally freed), so adding content
  does not need new code.
- Existing saves: the 11 first-slice creatures map onto the new allies by id where they exist; keep `Store.importJSON`
  backward compatible.

### World map (Super Mario World style)
The owner wants a world map where each **node is an encounter or a story beat** and "something fun or interesting can
happen". Pixel-art style, if assets are available. This replaces the "simple region select" idea: the map IS how the
player moves through the story chapters.
- **Structure:** a map per region (world). A token (the player's avatar or lead ally) walks along paths between nodes.
  Nodes unlock as you clear the ones before them; some paths branch, and there can be optional side nodes and secret exits.
  Finishing a region's boss opens the next region.
- **Node types** (each is data, so new content needs no new code):
  - Battle: 1 to 3 enemies, each with its own weakness (the v2 battle loop).
  - Elite battle: a tougher group, better reward.
  - Boss: ends a region (reuses the boss charge with a Balance puzzle).
  - Rescue: a captor holds a caged ally. Beating it frees the ally (the scripted ally source).
  - Story beat: a short dialogue scene with a funny or interesting character or event. It can have a small choice.
  - Puzzle node: launches an existing mini-game (Balance, Machine Builder or Munchers) for a reward such as XP or a heal,
    for example "fix the bridge" with a Machine Builder chain or "open the chest" with a Balance scale.
  - Camp: restore team health, ally banter, view your allies.
  - Bonus: optional challenge with a cosmetic or ally-flavor reward.
- **Math rule for story beats:** they can be funny and charming, but anything that tests math must follow the same rules as
  every game (the math is the choice or the puzzle, wrong answers explain themselves, no timers).
- **Allies matter on the map too:** an optional secret path can need a particular ally ("Owlbert reads the strange sign").
  Never gate the main story path on a specific ally, so a player can always progress.
- **Progress feedback:** cleared nodes show a check. A flawless clear earns a gold star, like Mario World's exit markers.
  Save node state in the profile (backward compatible).
- **Data sketch** (one file per region, authored as readable data, not code):
  `{ id, type, x, y, next: [...], enemies: [{skill}], script, ally, game, reward }`
- **Visuals:** pixel art scaled with `image-rendering: pixelated`. Two ways to build the region background:
  (a) one hand-composed background image per region with nodes placed on top by coordinates (most flexible), or
  (b) a tile grid generated from a plain-text (ASCII) layout and a tileset, so a map can be designed in a readable file.
  Start with (a) using a CC0 map/background image, add (b) if we want to author many maps quickly.
- **Open question:** art tone. Many free pixel packs lean gritty dungeon-crawler. The kids (especially the younger one) like
  cute, so pick a cute and colorful pack or accept a mix. Check style consistency across map, enemy and ally art before committing.

### Art plan
- **Source: free CC0 art packs** (owner's choice). Backgrounds as images, enemies and allies as sprites.
- **Practical constraints found:** kenney.nl returns 403 to automated downloads (the site blocks it, not our network
  policy). OpenGameArt and itch.io are reachable, but licenses vary per asset, so verify each one is CC0 before use.
  The owner can also download a pack by hand and drop it in the repo.
- **CC0 candidates found on OpenGameArt** (each page's License(s) field read as CC0 on Nov 2026; re-check the license on the
  page at download time, and check art style before using):
  - Map pack (180 assets), by Kenney: https://opengameart.org/content/map-pack-180-assets
  - Pastoral overworld: https://opengameart.org/content/pastoral-overworld
  - Overworld - Grass Biome: https://opengameart.org/content/overworld-grass-biome
  - Dungeon Crawl 32x32 tiles (monsters and characters; gritty style): https://opengameart.org/content/dungeon-crawl-32x32-tiles
  - RogueDB32: https://opengameart.org/content/roguedb32
  - Main art from Monster RPG 2: https://opengameart.org/content/main-art-from-monster-rpg-2
  - Meadow background: https://opengameart.org/content/meadow-background
- **Art themes are switchable (owner decision).** Support at least a **cute** theme and a **classic fantasy** theme, chosen as a
  setting when starting the game (the setup screen already has a "Look" setting for Munchers; enable it for Quest). The default
  is **a mix**: cute allies and heroes with classic-fantasy monsters and landscapes. The art manifest is therefore keyed by
  theme (`theme -> enemy/ally/background -> image`), with each theme falling back to the default and then to plain emoji.
  Check that a theme's pieces look consistent together before shipping it.
- Keep a `assets/CREDITS.md` listing every asset, its source URL and license. Never commit anything without a clear license.
- Build the scene so art is **swappable data**: a manifest maps enemy/ally/background ids to image files, with a plain
  emoji or colored-shape fallback if a file is missing.
- Presentation: a background layer, sprite slots for enemies (left/top) and the team (bottom), attack animations
  (lunge, flash, shake), floating damage numbers, and a visible turn order. Respect `prefers-reduced-motion`.

### Build plan (stages, each playtestable)
1. **Battle scene:** background + sprite slots + animations, art manifest with fallbacks, CREDITS file. Still 1 enemy.
2. **Multi-enemy rules:** remove card power, targeting, every enemy hits back with animation, retune and re-simulate
   (`tests/rpg.test.js`: perfect play always wins, a learner still usually wins at 1 star, random/ignoring-the-math loses).
3. **Allies as effects:** ally roster (start with ~12), effect engine (hit all, shield/heal, stun, remove a wrong card),
   ally picker UI, tests that every effect is optional and no team makes a fight unwinnable.
4. **World map and story chapters:** map screen with a walking token, node types (battle, elite, boss, rescue, story beat, puzzle, camp),
   region data files, rescue encounters that unlock allies, saved node progress, and puzzle nodes that launch the existing games.
5. **Later:** customization, more regions and allies, Spellcraft enemies, Machine Builder bosses.

### Idea: a non-combat variant for the younger player (owner request, no design yet)
The owner wants, eventually, a variant for their daughter that is still an RPG but **not focused on fighting and defeating enemies**.
No concrete idea yet. Seeds to brainstorm from, none decided:
- **Peaceful mode on the same engine:** the same maps, allies and rules, but a "monster" is an upset creature and the weakness is what
  it needs. The right card calms or helps it instead of hurting it (befriend, don't defeat). Cheap to build because only the wording,
  art and animations change, and it could be a setting on the existing game.
- **Caretaker or village:** raise and care for creatures, grow a garden, run a cozy shop, where each task is a small math puzzle.
- **Helper quests on the world map:** nodes are characters who need help (fix a bridge, sort a pantry), reusing Balance, Machine Builder
  and Munchers as the puzzles.
- **Build-a-World / Potion lab:** gentle creative variants from the "Later" list.
The world-map node system is the right foundation, since a node can be a "help someone" encounter just as well as a battle.

### Still to decide
- Roster: how many allies per grade band, their names and effects, which skill each is tied to.
- How many regions and chapters in the first release, and the story/tone (the kids like fantasy and cute things).
- How much of the three-step turn (ally, target, card) is too much for the youngest player. Test with her.
- Which CC0 packs to use for each theme (cute, classic fantasy, and the default mix) once reviewed.
- Number of nodes per region, and what the first region's story is.

---

## The RPG: Creature Quest (first slice built; the sections below describe the FIRST slice, partly superseded by v2 above)

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
