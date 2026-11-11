# Math Quest

Puzzle-first math games for kids, kindergarten through 6th grade. The math *is*
the gameplay (think Number Munchers), not a quiz you answer to unlock the game.

## Play
Open `index.html` in any browser (no install, no accounts). If saving ever seems flaky when opened as a plain file (some browsers treat `file://` pages differently), run
`python3 -m http.server` in this folder and open http://localhost:8000 instead; the hosted site behaves like that.
Progress is saved privately on the device; use "Save a backup file" on the
home screen to back it up or move it to another device.

### How saving works
Everything is stored in the browser's `localStorage` on the device you play on (key `mathQuest.v2`). Nothing is sent anywhere, and there
are no accounts. Each player has their own settings, per-skill right/wrong counts, game progress, and Creature Quest level, XP,
creatures and team. Saves happen automatically (after each card played, each win, each puzzle). The home screen shows when it last saved.
The save format is built so that progress from several devices can be **merged without losing anything**, ready for cloud sync (see
`docs/sync-design.md`). Cloud sync itself is not built yet, so for now progress does not move between browsers or devices on its own:
use the backup file. Clearing site data or some iPad/Safari storage clean-ups can erase it, so back up now and then.
Older (v1) saves are migrated automatically on first load, and the old data is kept untouched as a backup.
In Creature Quest the current five-battle adventure is not saved: leaving mid-adventure restarts it at battle 1, but XP, level and
creatures already earned are kept.

## What's here (v1)
- Player profiles with a grade level (K-1, 2-3, 4-5, 6) and a 1-3 star challenge setting
- **Munchers**: munch only the numbers that fit the rule. Wrong munches explain why.
  Skills: sums to a target, even/odd, greater/less (and the number line), multiples,
  rounding, factors, primes, expressions, equivalent fractions, exponents.
- **Balance**: work out the mystery weight `?` to level the scale (it only tips after you lock in, 3 tries per puzzle, worked solution after a miss); K-6 equations
  (one unknown at K-1, unknown on both sides at 6th)
- **Machine Builder**: chain operation cards to turn a start number into a target in the fewest steps
  (par is computed exactly by search, so star ratings are fair)
- **Number Defense**: tower defense where the math is choosing towers. Numbers march at your castle; each tower has a rule
  ("multiples of 3", "primes") and only stops numbers that fit. Read the whole wave, spend limited gold to cover it, then watch it play out.
- **Creature Quest**: a turn-based RPG. You fight groups of 1 to 3 monsters, each with its own weakness ("multiples of 6", "armored: only 3/4 or more breaks
  through"). Tap a monster to target it, pick a friend to act, and play the card that fits: a right card does damage, a wrong one does none, and every
  monster hits back. Friends have special powers (hit all, shield, heal, stun, hints...). Five encounters per adventure, including a boss whose big attack a
  Balance puzzle cancels, and two cages: win to free a friend. XP, levels, and a team of up to 3.
- **Sort & Rule**: a gate has a secret rule; test numbers, spot the pattern, then pick the rule (fewer tests = more stars)
- **Cut & Share**: cut pizzas into equal slices so every friend gets a fair share (fewest cuts is computed exactly)
- One setup screen per game: pick grade and challenge in plain language, then Play
- Four visual skins (Block World, Creatures, Fantasy, Cute), "calm" mode with no glitches

## Develop
```
node tests/engine.test.js    # verifies every Munchers rule at every band/star level
node tests/puzzles.test.js   # verifies Balance solutions are unique and Machine par is optimal
node tests/newgames.test.js  # Sort & Rule has one fitting rule; Cut & Share par is minimal; Balance worked steps
node tests/shop.test.js      # verifies Lemonade Stand jobs have one right answer in every band
node tests/rpg.test.js       # verifies Quest: every ally effect, enemy retaliation, rescues, and that perfect play always wins while ignoring the math loses
node tests/tdlogic.test.js   # verifies every Number Defense wave is solvable within budget and that you cannot buy the whole shop
node tests/worldmap.test.js  # verifies the Quest world-map data and unlock rules, and that every enemy and ally has art in both themes
node tests/save.test.js      # verifies the save format: v1 migration, and that merging devices never loses progress
node tests/sync.test.js      # verifies cloud sync: encryption, family codes, and pull/merge/push against a fake backend
node tests/firebase-backend.test.js  # verifies the Firebase adapter against a fake of Firebase's sign-in and Firestore (conflicts, offline, tokens)
node tests/browser/sync-ui.browser.js        # optional, needs Playwright: drives the sync screens with two simulated devices
node tests/browser/save-migration.browser.js # optional, needs Playwright: v1 migration, all four games, backups, merging two devices
node tests/browser/quest.browser.js          # optional, needs Playwright: plays whole Creature Quest adventures through the real buttons
node tests/browser/spacing.browser.js        # optional, needs Playwright: every back button has breathing room above the content below it (any new screen is checked automatically)
```
Code layout: `js/engine.js` (rules/generators, no DOM), `js/save.js` (save format, migration and merge, no DOM), `js/sync.js` (cloud sync core) and `js/sync-ui.js` (its screens; they need a cloud backend that is not connected yet), `js/storage.js`, `js/game.js`
(Munchers), `js/balance.js`, `js/machine.js`, `js/puzzles.js` (their logic, no DOM), `js/tdlogic.js` and `js/td.js` (Number Defense logic and screen), `js/shop.js` (Lemonade Stand jobs, no DOM), `js/lemonade.js` (its screens), `js/sortrule.js` + `js/sort.js` (Sort & Rule), `js/cutshare.js` + `js/share.js` (Cut & Share), `js/rpg.js` (Quest battle logic and balance numbers, no DOM), `js/quest.js` (Quest screens), `js/ui.js` (shared toast/panel), `js/app.js` (portal), `css/style.css`.

See `docs/design-plan.md` (plan and decisions), `docs/design-review.md` (critique) and
`docs/sync-design.md` (cross-device saving plan), `docs/game-ideas.md` (backlog of future games, a "not built yet" checklist, and how to plug a new one in).
