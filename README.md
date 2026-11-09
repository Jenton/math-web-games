# Math Quest

Puzzle-first math games for kids, kindergarten through 6th grade. The math *is*
the gameplay (think Number Munchers), not a quiz you answer to unlock the game.

## Play
Open `index.html` in any browser (no install, no server, no accounts).
Progress is saved privately on the device; use "Save a backup file" on the
home screen to back it up or move it to another device.

## What's here (v1)
- Player profiles with a grade level (K-1, 2-3, 4-5, 6) and a 1-3 star challenge setting
- **Munchers**: munch only the numbers that fit the rule. Wrong munches explain why.
  Skills: sums to a target, even/odd, greater/less (and the number line), multiples,
  rounding, factors, primes, expressions, equivalent fractions, exponents.
- **Balance**: a scale tips as you change the number for the mystery block `?`; level it to solve K-6 equations
  (one unknown at K-1, unknown on both sides at 6th)
- **Machine Builder**: chain operation cards to turn a start number into a target in the fewest steps
  (par is computed exactly by search, so star ratings are fair)
- One setup screen per game: pick grade and challenge in plain language, then Play
- Four visual skins (Block World, Creatures, Fantasy, Cute), "calm" mode with no glitches

## Develop
```
node tests/engine.test.js    # verifies every Munchers rule at every band/star level
node tests/puzzles.test.js   # verifies Balance solutions are unique and Machine par is optimal
```
Code layout: `js/engine.js` (rules/generators, no DOM), `js/storage.js`, `js/game.js`
(Munchers), `js/balance.js`, `js/machine.js`, `js/puzzles.js` (their logic, no DOM), `js/ui.js` (shared toast/panel), `js/app.js` (portal), `css/style.css`.

See `docs/design-plan.md` and `docs/design-review.md` for the plan and critique.
