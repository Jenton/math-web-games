# Grades, standards and adaptive difficulty: plan

Status: **Phase 1a in progress** (12 Nov 2026): plan, adversarial review and decisions below; the grade picker, `js/grades.js` and Arrow Range on grades are being built. Written after the owner found Arrow Range's 2-3 grade too easy for a strong 3rd grader and asked for difficulty to be decided from math standards, not guesses.

## What the owner decided
- The family is in **California**, so the reference is the Common Core State Standards for Mathematics (CCSS-M; California adopted it in 2010 with a few California additions, mostly high school). Confirm any code against the official text (corestandards.org, and cde.ca.gov for California's version) before relying on it.
- Players should **pick their grade, and nothing else** (no "band", no "stars" as a difficulty choice). A 3rd grader should be striving toward 4th, so play **skews to the player's grade plus one higher**.
- The end goal is **adaptive difficulty**. Two phases: Phase 1 is grade selection with the grade-and-one-higher skew and standards-tagged content; Phase 2 adapts per skill from how the player is doing.

## Decisions (owner, 12 Nov 2026)
- **State:** California, so CCSS-M is the reference.
- **Who picks the grade:** set when a player profile is created; changeable later in the player's settings.
- **Range:** support grades **K to 8 now**. Grades 9 to 12 are not promised: the games cannot generate that content yet (see the review). The picker stops at 8; each game states the highest grade it really has content for and clamps there.
- **Stretch misses:** a miss (or hint) on a stretch item costs no star.

## Adversarial review of this plan (12 Nov 2026, before building)
Problems found, and what changed because of them:
1. **"Up to 12th grade" is a promise the games cannot keep.** Every game's generators are built for K-6; grades 7-12 need new kinds of problems (rational numbers, slope, functions, quadratics). *Fix:* the picker is K-8. Each game declares a `topGrade`. A player above it gets the game's top content, and the game says so plainly. Grades 7-8 in Arrow Range start as harder grade 6 content (signed fractions, percent-of, no gap limits) with new mechanics (slope, distance by the Pythagorean theorem) as follow-ups. Grades 9-12 are a separate project; a natural fit is Arrow Range with real (parabolic) arcs.
2. **A half-migrated product is confusing.** Until every game is migrated, a grade 3 player gets grade 3 content in Arrow Range and the old "2-3" band elsewhere. *Fix:* unmigrated games keep working exactly as today (they still read `band` and `stars`, which we keep in sync from the grade), and the order of migration is public in this doc. Say so to the grown-up rather than hide it.
3. **Per-game overrides (PR #46) collide with a single grade.** *Fix:* migrated games ignore per-game band and stars and hide those pickers; unmigrated games keep theirs. Nothing is remapped silently.
4. **Where the grade is stored.** `settings` is merged as one object, last write wins (`js/save.js`). An older device that edits another setting later can drop `grade`. *Fix:* the grade is never defaulted as if chosen (hard rule 3); a missing grade falls back to a read-time mapping from the old band (upper grade of the band) and the player is asked once. If whole-object merging bites in practice, move the grade to its own last-write-wins field (follow-up).
5. **Rollback.** *Fix:* `settings.band` is rewritten from the grade each time, so old code and old devices keep working; reverting this PR leaves a harmless extra field.
6. **Stretch needs "next grade" content to exist.** If the next grade adds nothing to a game, there is nothing to stretch to. *Fix:* a stretch item is a *kind* from the next grade's pool when there is one, otherwise a *harder instance* of an on-grade kind (bigger gap, bigger wind, an expression note). At a game's top grade there is no stretch.
7. **Stars after the change.** *Fix:* the first item is always on-grade; misses and hints on stretch items are free; stars stay the medal for slips on on-grade items. A player cannot farm stars by ignoring the math: on-grade items still cost a slip each time.
8. **One grade is not one ability.** A strong fractions kid can be a slow times-tables kid. *Fix for now:* the stretch share (30%) plus an easy grown-up change of grade; the real fix is Phase 2's per-skill adaptation.
9. **Standards fidelity.** The codes were read from an unofficial mirror with short quotes (now covering K to 8). Using a code in a tag means "this item exercises it", not "the school teaches it in this order"; California's framework can sequence differently. Re-check against the official text before quoting a code to a parent.
10. **Tests.** The old tests loop over bands and stars. *Fix:* `makeRound(grade, { stretchShare, rng })` is injectable; tests run every grade with no stretch and with all stretch, and check that the stretch items never cost a slip.
11. **Phase 2 risks (to design then, noted now):** a feedback loop that makes a kid dip down after one bad day; a hidden level a parent cannot see. *Fix then:* windowed counters, a floor at the player's own grade minus one, and a visible "working at" line in the grown-ups view.

## Standards reference (verified against the grade pages on 12 Nov 2026; quotes are short because the reader truncates)
The site used was thecorestandards.org, which calls itself unofficial. Codes below were read from its grade 2, 3, 4, 5 and 6 domain pages. **K and grade 1 codes were not fetched yet.**

| Grade | Code | What it says (short) | Where our games touch it |
|---|---|---|---|
| 2 | 2.MD.B.6 | Whole numbers as lengths from 0 on a number line; sums and differences within 100 on a number line | Number Line Runner and Arrow Range at 2-3 (this is what 2-3 is today) |
| 3 | 3.NF.A.2 | Understand a fraction as a number on the number line; represent fractions on a number line diagram | Runner / Arrow Range fourths and eighths (currently labelled 4-5) |
| 3 | 3.NF.A.3.c | Express whole numbers as fractions; locate 4/4 and 1 at the same point | same |
| 3 | footnote | Grade 3 fractions are limited to denominators 2, 3, 4, 6 and 8 | so eighths are a grade 3 fraction |
| 3 | 3.NBT.A.1 | Round whole numbers to the nearest 10 or 100 | not in any game yet |
| 3 | 3.NBT.A.2 | Fluently add and subtract within 1000 | rulers only go to 100 so far |
| 3 | 3.NBT.A.3 | Multiply one-digit numbers by multiples of 10 (9 × 80, 5 × 60) | not yet |
| 3 | 3.OA.A.3 | Multiplication and division within 100 in word problems | Lemonade (partly) |
| 3 | 3.OA.C.7 | Fluently multiply and divide within 100; know all one-digit products from memory by the end of grade 3 | Machine Builder cards, Munchers multiples |
| 3 | 3.OA.D.8 | Two-step word problems with the four operations | not yet (Arrow Range could: wind then height) |
| 4 | 4.NF.C.5, C.6, C.7 | Tenths as hundredths; decimal notation for fractions with denominators 10 or 100 (locate 0.62 on a number line); compare decimals | Runner / Arrow Range tenths |
| 5 | 5.G.A.1, A.2 | Coordinate system from two perpendicular number lines; graph points in the first quadrant | Arrow Range coordinates (we run ahead of this at K-3) |
| 6 | 6.NS.C.5, C.6 | Positive and negative numbers; rational numbers as points on a number line, extended to the plane | Runner / Arrow Range grade 6 (negative heights; x never goes negative yet) |
| 6 | 6.NS.C.6.b, C.8 | Signs of coordinates give quadrants; graph points in all four quadrants, find distances | not yet in Arrow Range |
| 6 | 6.NS.C.7.c | Absolute value as distance from 0 | not yet |
| 6 | 6.RP.A.1 to A.3 | Ratio, unit rate, ratio reasoning | Arrow Range slope shot (planned) |

Added after a second read (K, 1, 7 and 8 pages; short quotes, same unofficial source):

| Grade | Code | What it says (short) |
|---|---|---|
| K | K.CC.A.1, K.CC.C.7, K.OA.A.2, K.OA.A.5 | Count to 100 by ones and tens; compare two numbers from 1 to 10; add and subtract within 10; fluently add and subtract within 5 |
| 1 | 1.OA.C.6, 1.NBT.B.2, 1.NBT.C.4, 1.NBT.C.5 | Add and subtract within 20 (fluent within 10); tens and ones; add within 100; 10 more or 10 less |
| 7 | 7.NS.A.1 (and .1.c) | Add and subtract rational numbers; distance between two rationals is the absolute value of their difference |
| 7 | 7.RP.A.1 to A.3 | Unit rates with fractions; proportional relationships; multistep ratio and percent problems |
| 8 | 8.EE.B.5, B.6 | Graph proportional relationships, unit rate as slope; similar triangles and slope |
| 8 | 8.G.B.8 | Pythagorean theorem to find the distance between two points in a coordinate system |
| 8 | 8.NS.A.1, A.2 | Irrational numbers; locate approximate irrationals on a number line |

**Finding:** our "2-3" band is really grade 2 content on a number line, and the grade 3 fractions we already have sit in the "4-5" band. A strong 3rd grader is under-served at 2-3 and fairly matched at "4-5 1 star" today. This is what the grade picker should fix properly.

## Design (Phase 1)

**One choke point makes this cheap.** Every game reads its difficulty through `Store.level(profile, gameId)` (`js/storage.js`), which returns `{ band, stars, ... }`. Phase 1 changes that function, so games migrate one at a time, and an unmigrated game keeps working.

- **The setting:** `profile.settings.grade` in `K, 1, 2, 3, 4, 5, 6`, set by the player or a grown-up (one place: the player menu and "For grown-ups"). The per-game grade and challenge pickers (PR #46) go away once every game is migrated; the setup screen then only shows the how-to and a Play button.
- **The skew:** each puzzle is drawn from the player's grade with about 70% probability and from the next grade up with about 30%. The first item of a round is always on-grade (a warm-up). Open: grade 6 players have no grade 7 content (see questions).
- **Stars stop being a difficulty choice.** They stay as the medal you earn (fewer slips = more stars), which already is what they are on the result screen. Today stars are both an input and an output, which is the confusing part.
- **Fairness of the stretch:** a miss on a stretch (grade + 1) item should not cost a star, only a miss on an on-grade item. Open question, see below.
- **Content tables are indexed by grade, not band.** Each generator gets `byGrade[g]` with each cell tagged with its CCSS code, so decisions point at a standard. Arrow Range first (below).
- **Migration of saved data:** the old `band` values are not grades (`2-3` covers two). Never save a guess as if the player chose it (hard rule 3): `Store.grade()` returns `settings.grade` if set, else a *read-time* mapping from the old band that is not saved, and the app asks once, "What grade is <name> in?", which then saves explicitly. `grade` is a last-write-wins field with a timestamp, like `band` today (`docs/sync-design.md`, `js/save.js`, plus a `tests/save.test.js` case).
- **Parent view (later in Phase 1):** the existing per-skill stats get a standards label ("3.NF.A.2: 14 right, 3 oops"), which is what a parent who knows the standards wants.

### Arrow Range by grade (proposed, to build first as the pilot)
| Grade | Content | Standards |
|---|---|---|
| K, 1 | counting to 10, then 20, on a ruler; small sums on the board | codes to fetch |
| 2 | ruler to 100 by tens and fives; hops (sums and differences within 100); wind in whole numbers | 2.MD.B.6 |
| 3 | fractions 0 to 1 with denominators 2, 3, 4, 6, 8 (and 4/4 at the same point as 1); rulers to 1000; "47, rounded to the nearest 10"; "6 × 7" and "3 × 40"; two-step shots (wind, then height) | 3.NF.A.2, 3.NF.A.3.c, 3.NBT.A.1, A.2, A.3, 3.OA.C.7, D.8 |
| 4 | tenths and hundredths (0.3 = 30/100); comparing decimals; larger numbers | 4.NF.C.5 to C.7 |
| 5 | first-quadrant coordinates with fractions and decimals | 5.G.A.1, A.2 |
| 6 | negatives on both axes (four quadrants), absolute-value distances, percents and ratios, the slope shot | 6.NS.C.5 to C.8, 6.RP.A.1 to A.3 |

Then plain "shoot to N" drops out of grade 3 and up, where it is a grade 2 skill.

### What Phase 1a built (12 Nov 2026)
- `js/grades.js` + `tests/grades.test.js`: grade list K to 8 (stored 0 to 12), labels, the old-band mapping both ways, and `pickItem` (first item on-grade, 30% stretch, no stretch at a game's top grade).
- `Store.grade(profile)`, `Store.gradeKnown(profile)`, `Store.setGrade(profile, g)` (also rewrites `settings.band`), and `Store.level` now also returns `grade`. `Save.newProfile` accepts a chosen grade and never defaults one; `tests/save.test.js` covers store, drop-invalid, last-write-wins merge and the old-device fallback.
- The new-player form asks for a grade; the player menu's "Grade" chips change it; a profile with no saved grade is asked once ("What grade is <name> in?"; "Not now" saves nothing).
- **Arrow Range is the first graded game** (`graded: true` in `js/app.js`): its setup screen has no grade or "how tricky" pickers. `ARCH.makeRound(grade, { stretchShare })` builds a round from a per-grade spec; grade 3 rotates through fractions (denominators 2, 3, 4, 6, 8), products, tens-times, and rounding to ten and hundred. Items are tagged with standards codes (`shot.tags`).
- Stretch items show "Bonus challenge" and never cost a slip or a hint's slip; `tests/browser/archery.browser.js` checks that a round of all bonus challenges can still end "Perfect round".
- Grades 7 and 8 in Arrow Range are signed fractions, percent-of ("75% of 80") and uncapped height differences. The grade 8 mechanics (slope, 8.EE.B.5; distance by the Pythagorean theorem, 8.G.B.8) are not built yet.

### Phase 1b: migrating every other game (plan, 12 Nov 2026)
Goal: every game picks its difficulty from the player's grade alone, with stretch items, and no band or "how tricky" pickers. The owner asked for all of them now.

**Approach: an adapter, not ten rewrites.** Each game's generator already works for every band and star level and has tests tuned on those 12 cells. So `Grades.cell(grade, opts)` maps a grade onto a *difficulty ladder* of those 12 cells (K-1 star 1 up to 6 star 3) and picks a stretch item from the next rung with the same 30% rule; `Store.cell(profile, gameId, opts)` returns `{ band, stars, grade, stretch }` and ignores per-game overrides. A game migrates by swapping its `Store.level(...)` call for `Store.cell(...)`, marking `graded: true`, and applying its own bonus rule below.

Ladder (index to cell): 0 K-1/1, 1 K-1/2, 2 K-1/3, 3 2-3/1, 4 2-3/2, 5 2-3/3, 6 4-5/1, 7 4-5/2, 8 4-5/3, 9 6/1, 10 6/2, 11 6/3. Grade to rung: K 0, 1 2, 2 4, 3 5, 4 6, 5 8, 6 10, 7 11, 8 11 (the games' top; no stretch above it). So a 3rd grader plays 2-3/3 with 4-5/1 (fractions, the grade 3 content) as the stretch.

**The bonus rule per game** (a bonus challenge = a stretch item; never punishes): where the game counts slips (Escape Room, Number Line Runner) slips on a bonus item do not count; where stars come from efficiency or a result (Machine Builder steps vs par, Sort & Rule, Cut & Share, Number Defense, Lemonade, Munchers, Creature Quest) a finished bonus item earns at least two stars (or the game's equivalent), and can still earn three. Balance has no stars, so a bonus puzzle is just a harder puzzle.

**Adversarial review of this plan (before building):**
1. *The ladder is coarse* (9 grades on 12 rungs): neighbouring grades can share a rung (6th and 7th grade are 6/2 and 6/3; 7th and 8th grade are the same). *Accepted, stated:* the games top out at 6/3; the grade picker says K to 8 and Arrow Range is the only game with grade-specific content.
2. *The adapter does not add grade-specific content.* A 3rd grader gets the existing 2-3/3 problems plus 4-5/1 stretch, which is better than the old default (2-3/1) but is not a standards audit. *Fix:* the audit table below records, per game, where the content differs from the grade 3 standards, as follow-up work. Do not pretend otherwise in the release notes.
3. *Star meanings differ per game*, so one uniform rule would be wrong somewhere. *Fix:* the per-game bonus rule above, each tested.
4. *Saved state keyed to band and stars.* Creature Quest saves the in-progress Quick adventure with its band and stars. *Fix:* resume uses what the saved run stored; check on migration that changing the grade mid-run cannot corrupt it.
5. *Games with hearts or HP* (Munchers, Quest) have no "miss costs a star" to waive. *Fix:* decided per game from the code (see each game's section in the migration notes), always erring toward not punishing a bonus item.
6. *Per-game overrides saved by PR #46* are ignored once a game is graded, never deleted: nothing is lost, and reverting is safe.
7. *Tests that loop over (band, stars)* stay valid because the generators are unchanged; new tests cover the adapter and each game's bonus rule.
8. *Risk of shipping a half-migrated state* is gone only when all ten are done; each game is migrated and tested on its own commit, so the branch is never in a worse state than main.

### Order of work
1. **Phase 1a (pilot): built, see above.**
2. **Phase 1b:** audit each game against the standards table, then migrate one at a time (Runner shares Arrow Range's number-line tables, so it goes next). Each migration is its own PR, so nothing breaks at once.
3. **Phase 1c:** the standards labels in the grown-ups view.
4. **Phase 2 (adaptive):** see below.

## Phase 2: adaptive (sketch, not a design)
- Track outcomes **per skill and per item grade**: `stats[skill][itemGrade] = { right, wrong }`. These stay grow-only counters, so they merge across devices without conflicts (the existing `Store.record` already does this per skill).
- **Derive** the player's working level per skill from those counters at read time, over recent weekly buckets so it can go down as well as up. Do not store a level that must move both ways: that is not a counter and would need last-write-wins.
- A simple rule to start: if the recent success rate on on-grade items is high, raise the stretch share (and later the base grade for that skill, up to grade + 2); if it is low, lower it, never below the player's own grade minus one. The kid does not see it; the grown-ups view shows "working at grade X in 3.NF.A.2".
- Keep the rules that already exist: no timers, wrong answers explain themselves, a right answer always works, nothing punishes.
- Needs a playtest first: the numbers (70/30, thresholds) are guesses.

## Still open
- Grades 9-12 content (separate project). Candidate for Arrow Range: parabolic arcs and quadratic height (the picker would extend to 12 when a game can serve it).
- Whether the grade should move out of `settings` into its own last-write-wins field (only if syncing proves flaky).
- The 30% stretch share and, in Phase 2, the adaptive thresholds: tune after playtests.
