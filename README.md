# Math Quest

Puzzle-first math games for kids, kindergarten through 6th grade. The math *is*
the gameplay (think Number Munchers), not a quiz you answer to unlock the game.

## Play
Open `index.html` in any browser (no install, no server, no accounts).
Progress is saved privately on the device; use "Save a backup file" on the
home screen to back it up or move it to another device.

### How saving works
Everything is stored in the browser's `localStorage` on the device you play on (key `mathQuest.v1`). Nothing is sent anywhere, and there
are no accounts. Each player has their own settings, per-skill right/wrong counts, game progress, and Creature Quest level, XP,
creatures and team. Saves happen automatically (after each card played and each win). The home screen shows when it last saved.
Limits: progress does not move between browsers or devices on its own (use the backup file), and clearing site data or some
iPad/Safari storage clean-ups can erase it, so back up now and then. In Creature Quest the current five-battle adventure is not
saved: leaving mid-adventure restarts it at battle 1, but XP, level and creatures already earned are kept.

## What's here (v1)
- Player profiles with a grade level (K-1, 2-3, 4-5, 6) and a 1-3 star challenge setting
- **Munchers**: munch only the numbers that fit the rule. Wrong munches explain why.
  Skills: sums to a target, even/odd, greater/less (and the number line), multiples,
  rounding, factors, primes, expressions, equivalent fractions, exponents.
- **Balance**: a scale tips as you change the number for the mystery block `?`; level it to solve K-6 equations
  (one unknown at K-1, unknown on both sides at 6th)
- **Machine Builder**: chain operation cards to turn a start number into a target in the fewest steps
  (par is computed exactly by search, so star ratings are fair)
- **Creature Quest**: a turn-based RPG. Each monster has a weakness ("multiples of 6", "armored: only 3/4 or more
  breaks through"); you pick the attack card that fits it. A card that doesn't fit does nothing and heals the monster.
  Five battles per adventure (monsters, an armored monster, a boss whose big attack a Balance puzzle cancels),
  a team of up to 3 creatures with specialist bonuses, XP and levels, and creatures you befriend by winning.
- One setup screen per game: pick grade and challenge in plain language, then Play
- Four visual skins (Block World, Creatures, Fantasy, Cute), "calm" mode with no glitches

## Develop
```
node tests/engine.test.js    # verifies every Munchers rule at every band/star level
node tests/puzzles.test.js   # verifies Balance solutions are unique and Machine par is optimal
node tests/rpg.test.js       # verifies Quest hands, armor math, progression, and that ignoring the math loses
```
Code layout: `js/engine.js` (rules/generators, no DOM), `js/storage.js`, `js/game.js`
(Munchers), `js/balance.js`, `js/machine.js`, `js/puzzles.js` (their logic, no DOM), `js/rpg.js` (Quest battle logic, no DOM), `js/quest.js` (Quest screens), `js/ui.js` (shared toast/panel), `js/app.js` (portal), `css/style.css`.

See `docs/design-plan.md` (plan and decisions), `docs/design-review.md` (critique) and
`docs/game-ideas.md` (backlog of future games, a "not built yet" checklist, and how to plug a new one in).
