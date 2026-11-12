# Game Ideas Backlog

Self-contained reference for any chat or contributor. Read this together with
`docs/design-plan.md` (plan and decisions) and `docs/design-review.md` (critique).

## Context in brief

- **Who it's for:** two kids, an older child and a younger one who is just learning to read. Content must scale from
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

**Status today (11 Nov 2026):** built = Munchers, Balance, Machine Builder, Number Defense, Lemonade Stand, Escape Room, and Creature Quest (v2 rules, sprite battles, two art themes, world map). Cloud sync is live. Unticked items below are still open; if you find one that is built, tick it.

### Creature Quest (RPG) v2 (see "Creature Quest v2" section for the decisions)
- [x] Stage 1: battle scene with background image, enemy/ally sprites, art manifest with fallbacks, `assets/CREDITS.md` (animations, floating numbers and a placeholder scene exist already)
- [x] Shortlist art from the Kenney All-in-1 bundle (done by a local Claude Code session on the owner's Mac; output: `docs/art-shortlist.md` plus contact sheets), then choose packs for each theme (cute, classic fantasy, default mix) and copy only chosen files into `assets/`
- [x] Art theme setting at game start (cute / classic fantasy / mix)
- [x] Stage 2: 1-3 enemies per fight with their own weaknesses, tap-to-target, every enemy visibly hits back, card power removed, retuned and simulated
- [x] Stage 3 (first version): 11 allies with effects (sweep, split, crit, heal, hint, shield, combo, slice, stun), ally picker, "no team can make a fight unwinnable" tests. **22 allies now**: eleven "story friends" were added (Bruno, Peep, Scout, Quackers, Tusk, Bongo, Waddle, Oink, Zeb, Mossy, Bison), freed only on the world map in Prime Peaks, Fraction Forest and Ember Mountain. Each is an expert at an existing skill (`theme`) and uses an existing effect, so no new combat rules were needed
- [~] Stage 4: scripted ally rescues exist inside the 5-encounter adventure, and a Mario-World-style **world map** (`js/worldmap.js`, five regions: Multiples Meadow, Haunted Keep, Prime Peaks, Fraction Forest and Ember Mountain) launches v2 group fights through `RPG.makeEncounter`, with story, camp, elite, rescue and boss nodes, gold stars for flawless fights, and a boss that opens the next region (classic pixel or cute art). **Camps** give the next fight a head start (a shield, or a wrong card taken out of the first hand), and optional **puzzle spots** reuse Balance and Machine Builder (10 XP, gold star for a first-try Balance solve or the fewest Machine steps). Each new region has a story intro, story spots, and a boss outro that points to the next place. Still to do: customization, deeper story chapters
- [x] Map progress is saved (cleared nodes and gold stars are grow-only sets) and the in-progress Quick adventure is saved too (`rpg.run`, last write wins; a Continue button picks up at the next battle, for the same grade and stars). New progress must follow the merge rules in `docs/sync-design.md` (cleared map nodes are a set, node stars are a max)
- [ ] Tune the numbers after playtesting (`TUNE` in `js/rpg.js`)
- [ ] Character customization (cosmetic only)
- [ ] Spellcraft enemies (exact-HP), Machine Builder bosses
- [ ] Ally upgrades (growth with use)
- [ ] Non-combat variant of the RPG for the younger player (see the idea below; no design yet)

### Creature Quest: backlog for a focused chat
Everything below is open. State of play: v2 rules, sprites in two themes, the world map (5 regions, 22 allies), saved Quick adventure, camp buffs and puzzle spots are all built and merged. Nothing has been playtested with the kids yet, so **playtest first, then pick from this list**.

**Design work (needs a decision before building)**
- [ ] **Tune the numbers** after real play (`TUNE` in `js/rpg.js`). The simulations say a perfect player wins 100%, a learner who misses a third wins about 90/83/82% (1/2/3 stars), and ignoring the math wins about 40/20/16%.
- [ ] **Character customization**, cosmetic only (outfits, colors, hats), unlocked by progress, never sold as advantage.
- [ ] **Spellcraft enemies** (exact-HP) and **Machine Builder bosses**: more enemy types on the same engine (see "Enemy types").
- [ ] **A non-combat variant for the younger player** (see the idea further down; no design yet).
- [ ] **Deeper story chapters**: today each region has an intro, a few story spots and a boss outro. Recurring characters, a through-line, and consequences for choices are not built.
- [ ] **Smarter camps**: only two buffs exist (a shield, or one wrong card taken out). Ideas: a buff chosen from two options, a camp where you swap team members, a camp that teaches a math tip.
- [ ] **More puzzle-spot kinds** (Sort & Rule, Cut & Share, Number Defense wave, Lemonade change) now that those games exist. Today only Balance and Machine Builder.
- [ ] **More allies** beyond 22, ideally with genuinely new effects (every story friend reuses an existing effect). Each needs art in both themes and must keep "perfect play wins with any single ally" true (`tests/rpg.test.js`).
- [ ] **More regions**: new map art, new rescue friends, and an ending beyond Ember Mountain.

**Known rough edges (small fixes)**
- Some enemy names and sprites do not match (for example "Round Snail" shows a white round monster in the cute theme). The classic theme's allies are recolored heroes, so several look alike.
- Classic backdrops are only meadow and dungeon (other regions use a map tint); the cute theme has five.
- A puzzle spot or fight can be replayed for XP again. That is fine for now, but watch for farming.
- A saved Quick adventure restarts the *battle* you were in (not mid-turn), and its plan is regenerated on resume.
- A region's intro shows once per visit to the quest, not once ever (it is not saved).
- No sound is specific to Quest yet beyond the shared hit, wrong, correct, win and lose sounds.
- The Playwright suites cover the map and whole adventures; allies' special effects are covered by node tests only, not clicked through in a browser.

**Rules to keep** (from the v2 decisions): the math never depends on the team; a right answer always works; a wrong answer does no damage and explains itself; no timers; every new region, ally and puzzle goes through `docs/new-game-checklist.md` (scene brief, phone screenshots of each state). Work in `js/worldmap.js` (data) and `js/quest.js` (screens); `js/rpg.js` is the tested engine, so keep changes there small and add tests.

### Existing games, possible extensions
- [ ] Balance: drag-blocks-onto-pans version for the youngest players, negative weights (balloons), limited guesses, two-player "first to level it"
- [ ] Machine Builder: reverse puzzles ("which input makes 24?"), "find the missing card", step trace of a wrong attempt, co-op chain
- [ ] Munchers: two-player (shared board, race or cooperate), optional timer challenge mode

### New games
- [x] Tower Defense, built as **Number Defense** (`js/tdlogic.js` logic + `tests/tdlogic.test.js`, `js/td.js` screen): wave preview, limited gold, towers with rules, automatic run phase, per-number explanations, a winding 7x9 board (three layouts, Kenney Tower Defense tiles) where each pad reaches the path squares within one square of it. Not built yet: co-op, creatures as towers, tower upgrades.
- [x] Number Line Runner (`js/runlogic.js` + `tests/runner.test.js`, `js/runner.js`, `css/runner.css`, `tests/browser/runner.browser.js`): rope-over-a-river number line, aim at a tick and jump, four flags per run, hops and landings, all four bands. Not built: collectibles, a scrolling longer world, number-line estimation without ticks, two-player.
- [x] Sort & Rule (Zoombinis-style logic): built (`js/sortrule.js`, `js/sort.js`)
- [ ] **Arrow Range** (archery, a sibling of Number Line Runner; an idea from the older child, Nov 2026): aim an arrow at a hidden target a number of units away, then add height (coordinates, height differences, slope) and wind (signed numbers). Design plan is in "Arrow Range: design plan" below; no code yet
- [ ] Build-a-World (Minecraft-style)
- [x] Escape Room Locks, built as **Escape Room** (`js/elogic.js` lock logic + `tests/escape.test.js`, `js/escape.js` screen, `css/escape.css`): a Tiny Dungeon room with three chests, a walking hero, four lock kinds (pattern, code with arithmetic clues, scale, machine), hints, a door that opens. Ideas left: a story that spans several rooms, riddle/cipher locks, co-op (one reads clues, one enters).
- [x] Lemonade Stand / Shop (first version: make change, stock up, set the price; ideas left: forecasts and weather, a stand that grows, unit pricing)
- [x] Cut & Share: built (`js/cutshare.js`, `js/share.js`)
- [ ] Dungeon crawler, Potion lab, Map explorer, Co-op raid (see "Other mechanics worth keeping on the list")

### Portal and cross-cutting features
- [x] Breadcrumb navigation (Players > Games > game) on the player menu, setup and every game screen; replaces the single back button. Quest's inner screens (map, prep, battle) keep their own back buttons.
- [ ] Auto-adapting difficulty using the per-skill stats already recorded (only after playtesting)
- [ ] Fuller parent view (per-skill levels, trends, conversation-starter prompts)
- [ ] Daily puzzle per kid
- [ ] Kid-made puzzles (the older child builds a puzzle for the younger one)
- [ ] Co-op / competitive modes, handicapped by each player's own level
- [ ] Optional timer / challenge mode as an opt-in flag per game
- [ ] Offline-first install (PWA) for the iPad
- [ ] Public web address (for example GitHub Pages) so the iPad can open it without files. Needs a go-ahead first, since it makes the site public.

### Creature Quest: owner feedback, Nov 2026 (second playtest)
- **Turn order:** wanted a true turn-based RPG: every ally attacks, then every enemy. Built: a turn is one action per ally (fresh hand each), then the monster phase.
  Monster strength was retuned (`TUNE.ENEMY_ATK`, `ENEMY_HP`, `CHARGE`) so the win rates of the simulated players stay where they were (see `tests/rpg.test.js`).
- **Cards change with the selected monster:** the owner was unsure. Kept on purpose: every monster has its own weakness, so its cards must belong to it, which keeps the
  math as the choice. The hand label now names the acting friend and the monster ("Owlbert attacks! Cards for the Scale Serpent..."). Revisit after the next playtest.
- **Reset:** Quest home, "For grown-ups", "Start Creature Quest over" (confirmed). Resets only Creature Quest; sync-safe via `resetAt` (see `docs/sync-design.md`).
- **Difficulty of "weak to numbers greater / less than":** cards were drawn from the whole range, so the wrong ones were far from the target. Now difficulty is
  closeness and size (`COMPARE` in `js/engine.js`): 1 star far apart, 3 stars within 5 and "equal to" traps; grade 2-3 uses bigger numbers than K-1 (up to three digits).
  This rule is shared with Munchers, so Munchers got harder at 2-3 stars the same way.

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
  `makeLevelRule`, `buildBoard`) and `js/puzzles.js` (Balance and Machine generators), plus `js/tdlogic.js`, `js/shop.js`, `js/elogic.js`, `js/rpg.js`. Tests live in
  `tests/<name>.test.js` (CI runs every `tests/*.test.js`). New game logic should follow this pattern.
- **`js/storage.js`:** `Store` with profiles (`settings: {band, stars, theme, monsters}`, `stats`, per-game
  progress such as `munchers: {levels, streak}`), `Store.record(profile, skillId, right)`, `Store.save()`.
  Per-game progress objects must be backward-compatible; `Store.importJSON` fills defaults.
- **Game UI modules:** `js/game.js` (Munchers), `js/balance.js`, `js/machine.js`, `js/td.js`, `js/lemonade.js`, `js/escape.js`, `js/quest.js`. Each exposes
  `start(profile, {onSave, onExit})`.
- **`js/ui.js`:** shared toast and result panel used by every game (`UI.toast`, `UI.panel`, `UI.hide`).
- **`js/app.js`:** the portal. A `GAMES` table maps a game key to its name, icon, how-to-play steps, a
  sample puzzle for the setup screen, and its module. `SCREEN_OF` maps a game key to its screen id. Every
  game goes through one shared **setup screen** (pick grade and challenge in plain language, then Play).
- **`index.html`:** a game card in the menu (`data-game="<key>"`) plus one `<section id="<screen>">` per game.

**Before you write any UI, read `docs/new-game-checklist.md`** (scene brief, polish bar, review steps).

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
   *(Changed Nov 2026, see "Turn order" below: every ally now gets one action per turn.)*
4. **Right card:** damage to the target plus the acting ally's effect. **Wrong card:** no damage, and the explanation
   is shown (as today).
5. **Every living enemy then attacks** (after EVERY ally has acted, see "Turn order"), one after another, with visible animation and damage numbers. A wrong turn is
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
- **Asset workflow (owner decision):** the owner bought **Kenney Game Assets All-in-1 (3.8.0)**, a very large collection. It stays
  **outside this repo** (at `/Volumes/JentMini Drive/AI Projects/...` on the owner's Mac). Only the specific files we choose are copied into
  `assets/<theme>/...` and listed in `assets/CREDITS.md`; never commit the whole bundle (repo size, and the deployed site is public).
  `.gitignore` blocks `assets/Kenney*/` and `assets/incoming/` as a safety net. **A cloud Claude session cannot read that folder** (the Mac's
  folder is not offered to cloud sessions), so shortlisting and copying must be done by a Claude Code session running on the owner's Mac.
  That session should write `docs/art-shortlist.md` and small contact-sheet preview images so a cloud session can see the options.
  Kenney assets are released under CC0, but confirm the license file inside each pack and record it in `CREDITS.md`.
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

## The RPG: original design notes (partly superseded: where this disagrees with "Creature Quest v2" above or "What is built now" below, those win)

**Decision:** the RPG is ONE game that rolls up several mechanics, not separate games. Munchers, Balance and
Machine Builder stay as standalone games and also appear inside the RPG as mini-challenges and bosses.

**Design decisions from the owner (do not reverse without asking):**
- **Math is the *choice*, never a gate.** Do NOT build "answer a question, then your hero swings" (that is
  the Prodigy toll booth). Instead the player picks the best attack/spell, and working out which one is best
  takes math. A normal-feeling RPG attack, chosen with brains.
- **Turn-based.** No time pressure; fair to the kindergartener. (A timed mode can be an opt-in flag later.)
- **The older child likes all four Prodigy hooks:** collecting a team of creatures, exploring a world/map, leveling up
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

### What is built now (v2 rules slice: `js/rpg.js` logic, `js/quest.js` screens, `tests/rpg.test.js`, `tests/browser/quest.browser.js`)
The v2 decisions above are implemented except for art and the world map. What exists, and where it differs from the older plan below:
- **An adventure is 5 encounters** with groups of monsters: 1 enemy; 2; armored + 1 (a rescue); 3 (2 at 1 star); boss + a minion (a rescue). Each enemy has
  **its own weakness** and no two enemies in a fight share a skill. Lose and you retry the same encounter at full health (nothing lost).
- **Turn:** tap a monster to target it (its hand was dealt at the start of the turn, so retargeting never re-rolls), tap an ally to choose who acts, play a
  card. **A right card does damage (6); a wrong card does none** and is explained. **Card power and the enemy-heals penalty are gone.** **Turn order (Nov 2026):**
  every ally acts once (any order; an ally who has acted is greyed out), each action gets a FRESH hand, and only then **every living monster hits back in turn**
  (8 for ordinary, 9 for armored and bosses, 14 for a boss charge, with a full team of 3), with a lunge animation, floating damage numbers and a team-health flash.
  A team of fewer than 3 acts fewer times per turn, so monster damage is scaled by team size (`RPG.enemyDmg`) and a small team stays winnable.
- **Ally effects on a right answer** (all 11 allies have one; none is required): Hopper *sweep* (every other enemy takes half), Splish *split* (the weakest other enemy takes half),
  Primo *crit* (+50%), Pairo *heal* (+3), Owlbert *hint* (the next hand loses a wrong card), Puffy and Shelly *shield* (block the next attack, max 2), Octo *combo*
  (+2 per right answer in a row, max +6), Fraxie *slice* (at least a quarter of the enemy's health), Powzer and Pebble *stun* (the target skips its next attack).
  An ally whose theme matches the target's skill is an **expert**: +3 damage and a star in the picker.
- **Scripted rescues instead of random allies:** two encounters per adventure free a caged ally (the armored fight frees the next ally you do not own, the boss fight frees
  Pebble first). Ordinary fights free nobody. This is the first step toward the story chapters and world map.
- **Armor:** only attacks of at least the armor fraction break through (comparing fractions; 6th grade mixes fractions, decimals and percents).
- **Boss:** every 3rd turn it charges a 7-damage attack; a Balance puzzle cancels it and stuns the boss for the turn, or you take the hit.
- **Leveling:** XP per enemy (8 ordinary, 12 armored, 25 boss) +10 (+20 with a boss) for a flawless fight, +5 for one mistake. Level n needs 40 + 20(n-1) XP and gives +2 team health (26 at level 1).
- **Balance, verified by simulation** (`tests/rpg.test.js`, helpers in `tests/helpers/quest-bots.js`): a perfect player wins 100%; perfect answers win 100% even with the least useful
  single ally; a learner who misses a third of the time wins about 90/83/82% at 1/2/3 stars; ignoring the math (random enemy, ally and card) wins about 40/20/16%. Enemy strength is the same at every star
  level (stars change the math and the hand: 5, 5, 6 cards; 1-2 right cards at 1 star, exactly 1 at 2 and 3 stars). Fewer right cards per hand is what makes guessing lose, and it does not hurt a player
  who knows the math (measured). All numbers are in the `TUNE` object at the top of `js/rpg.js`. A world map or any other caller can build a fight with `RPG.makeEncounter(band, stars, kinds, { prefer, rescue })`.
- **Art and map:** sprites and themed backdrops (classic pixel or cute, chosen in Setup), your team standing in the scene with animated retaliation, and a world map of nodes that each launch a group fight (see the Stage 4 line above). **Not built yet:** story chapters, customization,
  more allies beyond the 22, Spellcraft enemies, Machine Builder bosses, sound. Nothing here has been playtested with the kids yet: expect to retune.

---

## Arrow Range: design plan (archery game, idea from the older child, Nov 2026)

Status: **plan only, nothing built.** The older child liked Number Line Runner and asked for an archery version: shoot an arrow a certain
distance, tied to the math already in the game, and maybe add height. This section is the proposal for the owner to react to before any code.

### Pitch
You are an archer at a misty range. A scout's note says where the target is ("It is 3/4 of the way down the field", "7 × 8 m away",
"4 m further than your last arrow"). The target is hidden in the mist, so you work out the number, set the bow to that spot on a ruler,
and loose the arrow. The mist then clears: a hit shows the arithmetic that made it right, a miss shows exactly how many ticks short or long.

It is the Runner's number-line skill (read ticks, place fractions, decimals and negatives, hop by a distance) in a theme the kids asked for,
and then it grows a **second axis for height**, which the Runner does not have.

### Why a new game and not a Runner mode
Runner is one horizontal line. Archery has a natural second line (up), wind, scoring rings and a bow, so it needs its own screen and scene.
The **logic** can still borrow from `js/runlogic.js` (`lineFor`, `fmtValue`, `writeValue`, the tick and hop checking) so fractions, decimals,
percents and negatives are not written twice. Build `js/archerylogic.js` (DOM-free, `tests/archery.test.js`) that calls those helpers, and
leave the merged Runner alone.

### Could a kid play well without the math? (rule 1)
Not if these hold. The target is **never drawn at its real spot before the shot** (it sits in mist, like the Runner's unmarked landing
tick), so you cannot aim by eye. The ruler is labeled sparsely (whole numbers, or every 5th tick), so you must count ticks or place a
fraction. Arrows are limited (3 stars = at most one wasted arrow, like the Runner's slips), and a miss costs one. The note often gives the
distance in a different form from the ruler (a fraction note on a decimal ruler, an expression like 6 × 7, a percent). So trial and error
is expensive, and reading the note correctly is the game.

### The height idea (the owner's son's suggestion), three honest ways to do it
Real arrow flight needs physics, which is not the math here. These versions keep the math and drop gravity ("magic arrows fly straight").
Each one maps to a grade band, so the height grows up with the player.

1. **Two rulers: across and up (coordinates).** The target is on a hill, a tree or a tower. You set two numbers: how far across and how high.
   The field gets a vertical ruler on the left edge, and the target's spot is a point (across, up). K-1 counts squares ("4 across, 3 up");
   2-3 skip-counts the scale (each square is 5 m); 4-5 uses fractions and decimals on both axes; 6 uses all four quadrants.
2. **Height differences (subtraction, negatives).** The archer stands on a platform at height 12. The note says the target is at height 5, or
   "8 m below you". You have to work out how far to aim up or down, so it is "how much lower is 5 than 12?" and later "−3 m is a well below ground
   level 0". Natural home for negative numbers and comparing, which the Runner only touches on a flat line.
3. **Sight line = slope (grade 6 and strong 5).** Instead of picking a height, you pick the *steepness* of the shot: "up 2 for every 5 across".
   The arrow's sight line is a straight line from the bow, so hitting a target at (10, 4) needs the slope 4/10 = 2/5. This is unit rate and
   proportional reasoning, and a wrong slope is explained on the grid (the arrow passes at height 5 at distance 10, one square too high).
   Shown as a faint ruler-line from the bow; the player picks the rise and run from steppers, the line previews only after Loose.

Recommendation: ship 1 and 2 first (they reuse the tick-tap input), and treat 3 as the grade 6 headliner after a playtest.

### Archery-only mechanics that add fun and are real math
- **Wind (signed numbers).** A flag shows the wind ("+3" pushes the arrow 3 right, "−2" pushes it 2 left). You aim to the target *minus* the wind. K-1
  is only a calm day (no wind); 2-3 whole-number wind; 4-5 fraction or decimal wind; 6 negative wind and "wind then height" chains. The explanation on a miss
  shows target − wind = where to aim.
- **Scoring rings (sum to a target).** A target board with rings worth different amounts. The challenge: "score exactly 25 with 3 arrows". You pick the
  rings, so this is Munchers-style sums with a bow, and it scales up (rings worth 0.5 and 0.25; rings worth 1/2, 1/4; total 25 with negatives for a penalty ring).
  Each arrow's landing spot is fixed by the ring you choose, so it is a planning puzzle first and a shot second.
- **Chain shots (hops).** "Shoot 1/2 further than your last arrow." Reuses the Runner's hop kind: from where the last arrow stuck, count the new distance.
- **Moving target (patterns).** The target slides 2 squares each turn. "Where will it be after 3 turns?" is a pattern and multiplication; aim at where it
  will be, not where it is. Only at 2 and 3 stars, and with no timer (it moves by turn, not by clock).
- **Bow upgrades by stars, never by points.** A longer bow or a golden arrow unlocks from perfect rounds and only changes the look (rule 6, cosmetic).

### How a round plays
1. The scout's note appears (and can be read aloud, for the younger player). Wind flag and ruler(s) are visible; the target is in the mist.
2. Tap a tick on the distance ruler (and, in height modes, on the height ruler). The bow turns to match, the aim shows as a number label.
3. Press **Loose**. The arrow flies (a straight line, or a gentle arc that is purely visual and always ends exactly on the chosen spot).
4. Mist clears. Hit: a short line with the arithmetic ("3/4 of 8 = 6 ✓"). Miss: the arrow sticks where it landed, the target shows where it was,
   and the message counts ticks off and gives the arithmetic. Try again with the arrows you have left, then the next target.
5. A round is four targets (matching the Runner's four flags). Stars come from wasted arrows. No timers.

### Scaling (every band, 1-3 stars)
| Band | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| K-1 | Distance only, ruler 0-10, count ticks, calm day | Ruler 0-20, labeled every 5; height by counting squares (up to 5) | Across and up on a 10 x 10 grid; wind of 1 or 2 squares; ring sums to 10 |
| 2-3 | Ruler 0-100 by tens | By fives; height differences within 100; whole-number wind | Notes as multiplication (6 × 7); coordinates with a scale of 5 or 10; ring sums to 50 or 100 |
| 4-5 | Fourths of the field (0 to 2) | Eighths or tenths; decimal and fraction heights; wind in tenths | Mixed numbers and decimals; coordinate pairs in quadrant 1 with fraction units; height differences with decimals; ring sums with halves |
| 6 | Integers −5 to 5 on both rulers | Halves; negative heights (a well, a valley); negative wind | Quarters, percents ("80% of the way"); four-quadrant coordinates; slope as rise over run |

### Wrong answers explain themselves (rule 2)
Always counted and shown with arithmetic, in the Runner's style: "You aimed at 5. The target was 3/4 of 8 = 6, which is 1 tick (1 m) further."
Height misses name the axis ("Right distance, 2 squares too low: the target is at 7 up, you aimed at 5"). Wind misses show target − wind.
A hint button counts from a known tick (as the Runner does), and a second press names the starting tick.

### Build plan (each stage playtestable)
1. **Stage 1, flat range:** `js/archerylogic.js` + `tests/archery.test.js` (every target equals its tick, every wrong tick is explained, all four bands and
   three stars), `js/archery.js` screen, `css/archery.css`, scene brief in `docs/scene-briefs.md`, registry entries (`GAMES`, `SCREEN_OF`, `index.html`). Distance and
   hops only, plus the wind flag. This alone is the "Runner with a bow" the kids asked for.
2. **Stage 2, height:** vertical ruler, coordinate targets, height differences and negative heights. Phone layout check at 375 px (two rulers have to stay thumb-sized).
3. **Stage 3, scoring rings and slope:** the sum-to-total board and the grade 6 slope shot.
4. **Stage 4, extras:** moving targets, bow cosmetics from perfect rounds, a two-player "closest to the note" mode (handicapped by band), and a region on the Quest world map.

Saving follows the usual rules (hard rule 3): `profile.games.archery` holds counters (rounds played, perfect rounds, best stars per band as a max) with a
`Save.registerGame` merge rule and a `tests/save.test.js` case; nothing defaulted is saved as a choice. Skill ids for the grown-ups stats: `archery-distance`,
`archery-height`, `archery-wind`, `archery-score`. Sound only through `js/sfx.js`: fixed bow-twang, hit and miss sounds, and the result sound must not be masked by the flight sound.
Motion: follow `docs/animation-guide.md`; the arrow flight is skipped to a quick fade under Reduce motion.

### Art
Check `docs/art-shortlist.md` before drawing anything; a quick search of the shortlist docs found no archery-specific Kenney pack (the bundle itself was not searched), so the bow, arrow, target and flag may have to be
small original SVG or CSS shapes, with Kenney tiles or UI pieces for the ground, trees and tower (CC0, recorded in `assets/CREDITS.md`). Original characters only.

### Open questions for the owner
- Should the field be a **side view** (clear height, like a castle wall and a tree) or a **top-down view** with height on a separate meter? Side view is recommended: it makes the height ruler obvious.
- Is a straight "magic arrow" fine, or does the older child want a visible arc? The recommendation is a visual arc with the math unchanged.
- Start with Stage 1 (flat) as its own game, or hold it until Stage 2 so the first release already has the height idea? Recommendation: Stage 1 and 2 together, since height is the new part.
- Do you want the scoring-rings puzzle in the first release, or keep it for later?

## Later

### Tower Defense (the older child's favorite genre)
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
  hit an exact number. Works fairly across a younger and an older child.

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
- **Co-op/competitive modes:** handicapped by each player's own level so a younger and an older child can play fairly.
  Munchers two-player (shared board, race or cooperate) is the simplest first one.
- **Offline-first PWA:** installable on the iPad and works without internet.
- **Optional timer / challenge mode:** an opt-in flag per game.

## Suggested order

Playtest the existing games, especially Creature Quest, with both kids first. Then: grow the RPG (map,
customization, Spellcraft enemies, more bosses), then Tower Defense, then Munchers
two-player, then Number Line Runner or Sort & Rule depending on what the kids ask for.
