# Adversarial Review of the Design Plan

> Historical critique from the planning stage. Where it conflicts with the "Current decisions" block in `docs/design-plan.md`, that block wins
> (for example, no-reading mode was dropped and cloud sync was later built). The "can it be played without the math?" test is still required.

Reviewer stance: skeptical second person in the room. Ordered by how much
each issue could sink the project.

## Serious flaws

1. **"Math is the mechanic" is asserted, not enforced.**
   Munchers-style games are easy to game: a kid can eat everything, or learn
   "the green ones are usually right". Prodigy fails the same way.
   *Fix:* every game needs a written **"can it be played without the math?"
   test** before it ships, and levels that fail it get redesigned. Penalize
   brute force (limited moves, score for efficiency).

2. **A per-skill adaptive engine is the most expensive part and the easiest
   to get wrong.** Tracking a level for every skill plus auto-adjusting
   means lots of tuning with no real-kid data. A badly tuned engine produces
   boredom or frustration, and for a 5-year-old frustration ends the session.
   *Fix:* v1 is a **manual difficulty picker (grade band + 1-3 stars)** with
   simple "move up after N clean wins" suggestions. Add true adaptivity only
   after playtesting shows where the dial should sit.

3. **Generating puzzles by formula risks "technically correct, boring".**
   Random problems at the right difficulty are drills in disguise, which is
   the thing you said you don't want.
   *Fix:* hand-design puzzle *templates* with a clear aha, and let the
   generator vary only numbers within them. Budget design time for this, not
   just code.

4. **Scope: 6 games + 3 co-op modes + collection + parent view is a lot for
   a hobby project.** The risk is five half-finished games.
   *Fix:* ship **one great game** (Munchers) first and playtest before
   starting the second. Cut Build-a-World and the co-op list from the
   committed plan until the first two games are loved.

## Moderate flaws

5. **Collection layer can become the Prodigy trap.** If rewards are the
   draw, math becomes the toll again.
   *Fix:* rewards must be **earned by the puzzle itself** (a creature
   "appears" because you completed its pattern), never by a score
   threshold alone. Keep it small and cosmetic.

6. **K-6 span is huge, and the 5-year-old's real constraint is reading.**
   Kindergarteners can't read instructions.
   *Fix:* **no-reading mode** for young levels: icons, spoken prompts
   (browser speech synthesis or recorded audio), demonstrated tutorials.
   This is a core requirement, not polish.

7. **localStorage progress is fragile.** Clearing browser data, iPad Safari's
   storage eviction, and separate devices will silently erase progress and
   upset a kid.
   *Fix:* export/import of a save file (already planned) made **easy** (one
   tap, share to Files), plus a visible "last saved" indicator. Revisit
   cloud sync only if it hurts.

8. **Co-op/competitive between a 9-year-old and a 5-year-old is unfair by
   default.** The older kid always wins or the game is trivial for him.
   *Fix:* **handicapped modes**: each player gets puzzles at their own
   level; scoring is relative to level, or both work toward a shared goal.

9. **Theming risk.** Hello Kitty/Pokémon/Minecraft are licensed IP; fine for
   private family use, but it blocks ever sharing the site publicly.
   *Fix:* original characters in the same *style* (cute creatures, block
   worlds) from the start.

## New ideas worth stealing

- **Mistake-as-information:** wrong answers shouldn't just buzz. Show *why*
  (the monster you ate wasn't a multiple, and show 6x? to prove it). This
  is where learning actually happens.
- **Kid-made puzzles:** let the 9-year-old build a Munchers rule or Machine
  puzzle for his sister. Creating a puzzle is deeper math than solving
  one, and it's built-in co-op.
- **"Number sense" before speed:** no timers by default; optional timer as a
  challenge mode. Timers push kids toward guessing and anxiety.
- **Daily puzzle:** one hand-crafted puzzle per day per kid. Low content
  cost, high return habit.
- **Parent "what to talk about" prompts:** the parent view suggests a
  dinner-table question ("Ask him why 17 isn't a multiple of 3"), turning
  screen time into conversation.
- **Offline-first PWA:** installable on iPad, works on car trips.

## Recommended changes to the plan

1. Cut v1 to **Munchers + manual difficulty picker + profiles**, then
   playtest with both kids.
2. Replace the adaptive engine with grade band + stars first.
3. Add a "can it be played without the math?" checklist per game.
4. Make **no-reading mode** a v1 requirement for K-1 content.
5. Make mistakes explain themselves.
6. Move collection, parent view, and co-op after the first playtest.
7. Original characters only.
