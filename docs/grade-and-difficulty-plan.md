# Grades, standards and adaptive difficulty: plan

Status: **plan only, nothing built** (12 Nov 2026). Written after the owner found Arrow Range's 2-3 grade too easy for a strong 3rd grader and asked for difficulty to be decided from math standards, not guesses.

## What the owner decided
- The family is in **California**, so the reference is the Common Core State Standards for Mathematics (CCSS-M; California adopted it in 2010 with a few California additions, mostly high school). Confirm any code against the official text (corestandards.org, and cde.ca.gov for California's version) before relying on it.
- Players should **pick their grade, and nothing else** (no "band", no "stars" as a difficulty choice). A 3rd grader should be striving toward 4th, so play **skews to the player's grade plus one higher**.
- The end goal is **adaptive difficulty**. Two phases: Phase 1 is grade selection with the grade-and-one-higher skew and standards-tagged content; Phase 2 adapts per skill from how the player is doing.

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

### Order of work
1. **Phase 1a (pilot):** `js/grades.js` (the grade list, `Store.grade()`, the 70/30 pick, the read-time band mapping), the one-time "What grade?" prompt, a grade picker replacing the band picker on the player menu, and Arrow Range rebuilt on the grade table above, with tests and a save-merge case.
2. **Phase 1b:** audit each game against the standards table, then migrate one at a time (Runner shares Arrow Range's number-line tables, so it goes next). Each migration is its own PR, so nothing breaks at once.
3. **Phase 1c:** the standards labels in the grown-ups view.
4. **Phase 2 (adaptive):** see below.

## Phase 2: adaptive (sketch, not a design)
- Track outcomes **per skill and per item grade**: `stats[skill][itemGrade] = { right, wrong }`. These stay grow-only counters, so they merge across devices without conflicts (the existing `Store.record` already does this per skill).
- **Derive** the player's working level per skill from those counters at read time, over recent weekly buckets so it can go down as well as up. Do not store a level that must move both ways: that is not a counter and would need last-write-wins.
- A simple rule to start: if the recent success rate on on-grade items is high, raise the stretch share (and later the base grade for that skill, up to grade + 2); if it is low, lower it, never below the player's own grade minus one. The kid does not see it; the grown-ups view shows "working at grade X in 3.NF.A.2".
- Keep the rules that already exist: no timers, wrong answers explain themselves, a right answer always works, nothing punishes.
- Needs a playtest first: the numbers (70/30, thresholds) are guesses.

## Questions for the owner
1. Grade 6 and up: what is the "grade + 1" for a 6th grader? Options: the hardest slice of grade 6 plus a taste of grade 7 content (ratios and negatives in context), or only the hard end of grade 6.
2. Should a miss on a stretch item cost a star? Recommendation: no.
3. Who picks the grade: the player, or a grown-up in "For grown-ups"? Recommendation: asked once when a profile is created or on first launch after this change, and editable in "For grown-ups".
4. Is one grade for all games right, or should a player be able to override a game (e.g. strong at fractions, weaker at multiplication)? Phase 2's per-skill adaptation is meant to cover this, so Phase 1 can use one grade.
