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
- Four visual skins (Block World, Creatures, Fantasy, Cute), "calm" mode with no glitches

## Develop
```
node tests/engine.test.js   # verifies every rule at every band/star level
```
Code layout: `js/engine.js` (rules/generators, no DOM), `js/storage.js`, `js/game.js`
(Munchers), `js/app.js` (portal), `css/style.css`.

See `docs/design-plan.md` and `docs/design-review.md` for the plan and critique.
