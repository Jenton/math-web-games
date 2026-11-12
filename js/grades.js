/* Grades, no DOM, testable in Node. Design: docs/grade-and-difficulty-plan.md.
 *
 * A player has ONE setting: their grade (0 = kindergarten, 1..12). Games that are "graded" draw each item from the player's grade, or, a
 * share of the time, from the grade above (a "stretch" item: a miss or hint on it never costs a star). Games not yet migrated keep reading the
 * old band ('K-1', '2-3', '4-5', '6'), which is derived from the grade (bandOf) so nothing breaks.
 * Grades are numbers 0..12. The picker offers K to 8 (PICK_MAX): no game has content above that yet. */
(function (root) {
  'use strict';
  const PICK_MAX = 8;
  const STORE_MAX = 12; // accepted when saved or imported, so a future picker can reach it
  const STRETCH_SHARE = 0.3;
  const LABELS = ['Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade', '6th grade', '7th grade', '8th grade', '9th grade', '10th grade', '11th grade', '12th grade'];
  const SHORT = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const clean = (g) => (Number.isInteger(g) && g >= 0 && g <= STORE_MAX ? g : null);
  const label = (g) => LABELS[clean(g) == null ? 3 : g];
  const short = (g) => SHORT[clean(g) == null ? 3 : g];
  /** The old band that a grade falls in (for games that have not moved to grades yet). */
  const bandOf = (g) => (g <= 1 ? 'K-1' : g <= 3 ? '2-3' : g <= 5 ? '4-5' : '6');
  /** A grade for a profile that only has an old band: the UPPER grade of the band (a read-time guess, never saved as a choice). */
  const legacyGrade = (band) => ({ 'K-1': 1, '2-3': 3, '4-5': 5, '6': 6 }[band] != null ? { 'K-1': 1, '2-3': 3, '4-5': 5, '6': 6 }[band] : 3);
  const options = () => Array.from({ length: PICK_MAX + 1 }, (_, g) => [g, label(g)]);

  /**
   * Which grade should the next item come from? Returns { grade, stretch }.
   *  opts.top           the highest grade this game has content for (a player above it gets the top content, with no stretch)
   *  opts.first         true for the first item of a round: always on-grade (a warm-up)
   *  opts.stretchShare  chance of a stretch item (default STRETCH_SHARE); 0 = never, 1 = always (for tests)
   *  opts.rng           () => number in [0, 1)
   */
  function pickItem(grade, opts) {
    const o = opts || {};
    const top = o.top == null ? PICK_MAX : o.top;
    const g = Math.min(clean(grade) == null ? 3 : grade, top);
    const share = o.stretchShare == null ? STRETCH_SHARE : o.stretchShare;
    const rng = o.rng || Math.random;
    if (o.first || g >= top || share <= 0) return { grade: g, stretch: false };
    return rng() < share ? { grade: g + 1, stretch: true } : { grade: g, stretch: false };
  }

  /* The difficulty ladder for games that still build puzzles from (band, stars): the 12 cells every one of them already handles, in order of difficulty. */
  const LADDER = [['K-1', 1], ['K-1', 2], ['K-1', 3], ['2-3', 1], ['2-3', 2], ['2-3', 3], ['4-5', 1], ['4-5', 2], ['4-5', 3], ['6', 1], ['6', 2], ['6', 3]];
  const RUNG = [0, 2, 4, 5, 6, 8, 10, 11, 11]; // grade K..8 -> rung on the ladder
  const LADDER_TOP = 7; // the highest grade with a rung of its own (the top cell, 6 star 3); above it a player plays that cell with no stretch

  /**
   * The cell to build the next puzzle from, for a player in `grade`: { band, stars, grade, stretch, rung }.
   * Same pick as pickItem (first item on-grade, about 30% stretch from the next grade up); opts as pickItem, minus `top`.
   */
  function cell(grade, opts) {
    const it = pickItem(grade, Object.assign({}, opts, { top: LADDER_TOP }));
    const rung = RUNG[it.grade];
    return { band: LADDER[rung][0], stars: LADDER[rung][1], grade: it.grade, stretch: it.stretch, rung };
  }

  const api = { PICK_MAX, STORE_MAX, STRETCH_SHARE, LADDER, RUNG, LADDER_TOP, clean, label, short, bandOf, legacyGrade, options, pickItem, cell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Grades = api;
})(typeof window !== 'undefined' ? window : globalThis);
