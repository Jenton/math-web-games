/* Arrow Range logic, no DOM, testable in Node.  Design: docs/game-ideas.md, "Arrow Range: design plan".
 *
 * A round is four aimed shots plus a scoring board. A scout's note says where the target is; the target sits in mist, so it is never drawn
 * at its real spot before the shot (you cannot aim by eye). You tap a tick on the distance ruler (across) and/or the height ruler (up), then loose.
 *
 * Shot kinds:
 *   dist    across only: "Shoot to 3/4", "Shoot to 6 × 7"
 *   hop     across only, measured from the last arrow: "Shoot 1/2 further than your last arrow"
 *   wind    across only, with a wind that pushes the arrow: aim at (target - wind)
 *   height  up only, at a tower a fixed distance away: "The target is at height 7"
 *   lift    up only, relative to the platform you stand on: "You stand at 12. The target is 8 below you" (subtraction, negatives)
 *   coord   across AND up: "Across 6, up 3"
 * The scoring board: pick a ring for each arrow so the ring values add to an exact total ("Score exactly 25 with 3 arrows").
 *
 * All values are exact integers counted in units of 1/D (D = the ruler's denominator), reusing the Number Line Runner's helpers
 * (js/runlogic.js) for writing fractions, decimals, percents and negatives, so there is no floating-point error.
 * The arc the arrow draws is purely visual: arcPoints() always ends exactly on the chosen spot.
 */
(function (root) {
  'use strict';
  const RUN = typeof module !== 'undefined' && module.exports ? require('./runlogic.js') : root.RUN;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[rnd(0, arr.length - 1)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const SKILLS = {
    'archery-distance': 'Arrow Range: distance on a number line',
    'archery-height': 'Arrow Range: height and coordinates',
    'archery-wind': 'Arrow Range: wind (adding and subtracting signed numbers)',
    'archery-score': 'Arrow Range: scoring rings (sums to a total)',
  };
  const AIMED_SHOTS = 4;
  const MAX_Y_TICKS = 13; // the height ruler is vertical and must stay thumb-sized at phone height
  const X_KINDS = ['dist', 'hop', 'wind', 'coord'];
  const Y_KINDS = ['height', 'lift', 'coord'];

  /* ---------- the rulers (one per band and stars) ---------- */
  const L = (D, lo, hi, step, labelEvery, modes, note) => ({ D, lo, hi, step, labelEvery, modes, note });

  /** The distance ruler: always starts at 0 (the archer's feet). */
  function xLine(band, st) {
    if (band === 'K-1') return st === 1 ? L(1, 0, 10, 1, 1, ['int'], '1') : L(1, 0, 20, 1, 5, ['int'], '1');
    if (band === '2-3') return st === 1 ? L(1, 0, 100, 10, 1, ['int'], '10') : L(1, 0, 100, 5, 2, ['int'], '5');
    if (band === '4-5') {
      if (st === 1) return L(4, 0, 8, 1, 4, ['frac'], '1/4');
      if (st === 2) return pick([L(8, 0, 8, 1, 8, ['frac'], '1/8'), L(10, 0, 10, 1, 10, ['dec'], '0.1')]);
      return L(4, 0, 12, 1, 4, ['frac', 'dec'], '1/4');
    }
    if (st === 1) return L(2, 0, 12, 1, 2, ['frac', 'dec'], '1/2');
    if (st === 2) return L(4, 0, 12, 1, 4, ['frac', 'dec'], '1/4');
    return L(10, 0, 10, 1, 5, ['pct', 'dec', 'frac'], '10%'); // percent of the field
  }

  /** The height ruler, or null when that band and stars have no height shots. Grade 6 reaches below ground level 0 (a well, a valley). */
  function yLine(band, st) {
    if (band === 'K-1') return st === 1 ? null : st === 2 ? L(1, 0, 5, 1, 1, ['int'], '1') : L(1, 0, 10, 1, 5, ['int'], '1');
    if (band === '2-3') return st === 1 ? null : st === 2 ? L(1, 0, 50, 5, 2, ['int'], '5') : L(1, 0, 100, 10, 1, ['int'], '10');
    if (band === '4-5') return st === 1 ? null : st === 2 ? L(2, 0, 8, 1, 2, ['frac', 'dec'], '1/2') : L(4, 0, 12, 1, 4, ['frac', 'dec'], '1/4');
    if (st === 1) return L(1, -5, 5, 1, 1, ['int'], '1');
    if (st === 2) return L(2, -6, 6, 1, 2, ['frac', 'dec'], '1/2');
    return L(4, -6, 6, 1, 4, ['frac', 'dec', 'pct'], '1/4');
  }

  /** Which kinds of shot a band and stars can ask for (the first shot of a round is always a plain 'dist'). */
  function poolFor(band, st) {
    if (band === 'K-1') return st === 1 ? ['dist'] : st === 2 ? ['dist', 'height', 'coord'] : ['coord', 'wind', 'height'];
    if (band === '2-3') return st === 1 ? ['dist', 'hop'] : st === 2 ? ['dist', 'hop', 'wind', 'lift'] : ['dist', 'coord', 'wind', 'lift'];
    if (band === '4-5') return st === 1 ? ['dist', 'hop'] : st === 2 ? ['dist', 'hop', 'wind', 'height'] : ['coord', 'wind', 'lift', 'hop'];
    return st === 1 ? ['dist', 'hop', 'height'] : st === 2 ? ['dist', 'wind', 'lift'] : ['coord', 'wind', 'lift', 'hop'];
  }

  const ticksIn = (line) => RUN.ticksOf(line).length;
  const wr = (line, a, form) => RUN.writeValue(line, a, form || line.modes[0]);
  const tickWord = (n) => n + (n === 1 ? ' tick' : ' ticks');

  /** Pick a tick that satisfies ok(); prefers an unlabeled one so the ruler cannot be read off the note. */
  function pickTick(line, from, to, ok) {
    const all = [];
    for (let k = from; k <= to; k++) if (ok(k)) all.push(k);
    if (!all.length) return null;
    const unlabeled = all.filter((k) => !RUN.labelOf(line, k));
    return pick(unlabeled.length ? unlabeled : all);
  }

  const groundTick = (line) => (line.lo <= 0 && line.hi >= 0 && (0 - line.lo) % line.step === 0 ? (0 - line.lo) / line.step : null);

  /* ---------- making shots ---------- */
  function makeShot(kind, ctx) {
    const { xl, yl, band, st, at } = ctx;
    const NX = ticksIn(xl);
    const NY = yl ? ticksIn(yl) : 0;
    const far = Math.max(2, Math.floor(NX / 4));
    const shot = { kind, tx: null, ty: null, at: null, wind: 0, platform: null, tower: null, form: null, text: '' };

    const writeAcross = () => {
      const form = xl.modes.length > 1 ? pick(xl.modes) : xl.modes[0];
      return { form, body: wr(xl, RUN.valueAt(xl, shot.tx), form) };
    };

    if (kind === 'dist' || kind === 'wind' || kind === 'coord') {
      shot.tx = pickTick(xl, 1, NX - 1, (k) => k >= far);
      if (kind === 'wind') {
        // a wind of 1 to 3 ticks, either way, as long as the tick you must aim at is still on the ruler
        const maxW = band === 'K-1' ? 2 : 3;
        const opts = [];
        for (let w = -maxW; w <= maxW; w++) if (w !== 0 && shot.tx - w >= 1 && shot.tx - w <= NX - 1) opts.push(w);
        if (!opts.length) return null;
        shot.wind = pick(opts);
      }
    }
    if (kind === 'hop') {
      if (at === null) return null;
      shot.at = at;
      shot.tx = pickTick(xl, 1, NX - 1, (k) => Math.abs(k - at) >= far);
      if (shot.tx === null) return null;
    }
    if (kind === 'dist' && shot.tx === null) return null;

    if (kind === 'height' || kind === 'coord') {
      const g = groundTick(yl);
      shot.ty = pickTick(yl, 0, NY - 1, (k) => k !== g && (g !== null || k >= 1));
    }
    if (kind === 'lift') {
      shot.platform = yl.lo >= 0 ? rnd(Math.ceil(NY / 2), NY - 1) : rnd(1, NY - 2);
      shot.ty = pickTick(yl, 0, NY - 1, (k) => Math.abs(k - shot.platform) >= 2);
    }
    if (kind === 'height' || kind === 'lift') shot.tower = rnd(Math.ceil(NX / 3), NX - 1);
    if ((X_KINDS.includes(kind) && shot.tx === null) || (Y_KINDS.includes(kind) && shot.ty === null)) return null;

    // the note
    if (kind === 'dist') {
      const w = writeAcross();
      shot.form = w.form;
      shot.text = 'Shoot to ' + w.body;
      const a = RUN.valueAt(xl, shot.tx);
      if (band === '2-3' && st === 3 && a > 0 && Math.random() < 0.6) {
        const facs = [];
        for (let f = 2; f <= 10; f++) if (a % f === 0 && a / f >= 2 && a / f <= 10) facs.push([f, a / f]);
        if (facs.length) { const [p, q] = pick(facs); shot.text = 'Shoot to ' + p + ' × ' + q; shot.form = 'expr'; }
      }
    } else if (kind === 'hop') {
      const d = RUN.valueAt(xl, shot.tx) - RUN.valueAt(xl, shot.at);
      shot.form = xl.modes[0];
      shot.text = 'Shoot ' + wr(xl, Math.abs(d)) + (d > 0 ? ' further' : ' shorter') + ' than your last arrow';
    } else if (kind === 'wind') {
      const w = writeAcross();
      shot.form = w.form;
      shot.text = 'Target at ' + w.body + '. The wind ' + windWords(xl, shot.wind) + '.';
    } else if (kind === 'height') {
      shot.form = yl.modes.length > 1 ? pick(yl.modes) : yl.modes[0];
      shot.text = 'The target is at height ' + wr(yl, RUN.valueAt(yl, shot.ty), shot.form);
    } else if (kind === 'lift') {
      const d = RUN.valueAt(yl, shot.ty) - RUN.valueAt(yl, shot.platform);
      shot.form = yl.modes[0];
      shot.text = 'You stand at height ' + wr(yl, RUN.valueAt(yl, shot.platform)) + '. The target is ' + wr(yl, Math.abs(d)) + (d > 0 ? ' above' : ' below') + ' you.';
    } else if (kind === 'coord') {
      const w = writeAcross();
      shot.form = w.form;
      const hv = wr(yl, RUN.valueAt(yl, shot.ty), yl.modes.length > 1 ? pick(yl.modes) : yl.modes[0]);
      shot.text = 'Across ' + w.body + (band === 'K-1' || band === '2-3' ? ', up ' : ', height ') + hv;
    }
    return shot;
  }

  function windWords(xl, wk) {
    return 'pushes the arrow ' + wr(xl, Math.abs(wk) * xl.step) + ' to the ' + (wk > 0 ? 'right' : 'left');
  }

  /* ---------- the scoring board ---------- */
  const BOARDS = {
    'K-1': [
      { D: 1, rings: [1, 2, 3, 4], arrows: 2, mode: 'int' },
      { D: 1, rings: [1, 2, 3, 5], arrows: 3, mode: 'int' },
      { D: 1, rings: [2, 3, 5, 6], arrows: 3, mode: 'int' },
    ],
    '2-3': [
      { D: 1, rings: [10, 20, 30, 50], arrows: 3, mode: 'int' },
      { D: 1, rings: [5, 10, 25, 50], arrows: 3, mode: 'int' },
      { D: 1, rings: [5, 10, 15, 25], arrows: 4, mode: 'int' },
    ],
    '4-5': [
      { D: 2, rings: [1, 2, 3, 5], arrows: 3, mode: 'dec' }, // 0.5, 1, 1.5, 2.5
      { D: 4, rings: [1, 2, 3, 5], arrows: 3, mode: 'frac' }, // 1/4, 1/2, 3/4, 1 1/4
      { D: 10, rings: [3, 5, 8, 12], arrows: 4, mode: 'dec' }, // 0.3, 0.5, 0.8, 1.2
    ],
    '6': [
      { D: 1, rings: [-2, 1, 3, 5], arrows: 3, mode: 'int', penalty: true },
      { D: 2, rings: [-1, 1, 2, 3], arrows: 4, mode: 'dec', penalty: true },
      { D: 4, rings: [-1, 2, 3, 5], arrows: 4, mode: 'frac', penalty: true },
    ],
  };

  const ringText = (board, v) => RUN.fmtValue(v, board.D, board.mode) || RUN.fmtValue(v, board.D, 'frac');
  const sumText = (board, picks) => {
    const vals = picks.map((i) => board.rings[i]);
    const parts = vals.map((v) => (v < 0 ? '(' + ringText(board, v) + ')' : ringText(board, v)));
    return parts.join(' + ') + ' = ' + ringText(board, vals.reduce((s, v) => s + v, 0));
  };

  function makeBoard(band, stars) {
    const st = clampStars(stars);
    const def = BOARDS[band][st - 1];
    for (let attempt = 0; attempt < 200; attempt++) {
      const solution = Array.from({ length: def.arrows }, () => rnd(0, def.rings.length - 1));
      if (new Set(solution).size < 2) continue; // all arrows in one ring is a guess, not a puzzle
      const hasPenalty = solution.some((i) => def.rings[i] < 0);
      if (def.penalty && st >= 2 && !hasPenalty && Math.random() < 0.6) continue; // grade 6 usually has to use the penalty ring
      const total = solution.reduce((s, i) => s + def.rings[i], 0);
      if (total <= 0) continue;
      const board = { D: def.D, rings: def.rings.slice(), arrows: def.arrows, mode: def.mode, total, solution: solution.slice().sort((a, b) => a - b) };
      board.text = 'Score exactly ' + ringText(board, total) + ' with ' + def.arrows + ' arrows';
      return board;
    }
    throw new Error('could not build a board');
  }

  /** Every way to fill the arrows (order does not matter) that makes the total: arrays of ring indexes, sorted. */
  function boardSolutions(board) {
    const out = [];
    const walk = (start, left, acc, sum) => {
      if (!left) { if (sum === board.total) out.push(acc.slice()); return; }
      for (let i = start; i < board.rings.length; i++) { acc.push(i); walk(i, left - 1, acc, sum + board.rings[i]); acc.pop(); }
    };
    walk(0, board.arrows, [], 0);
    return out;
  }

  function checkBoard(board, picks) {
    const total = picks.reduce((s, i) => s + board.rings[i], 0);
    const goal = ringText(board, board.total);
    if (total === board.total) return { ok: true, total, gap: 0, msg: 'Bullseye! ' + sumText(board, picks) + '.' };
    const gap = board.total - total;
    const diff = ringText(board, Math.abs(gap));
    return {
      ok: false, total, gap,
      msg: 'Your arrows scored ' + sumText(board, picks) + '. The goal is ' + goal + ', so you are ' + diff + (gap > 0 ? ' short' : ' over') + '.',
    };
  }

  function hintBoard(board, level) {
    if (level === 0) {
      return 'Add up the rings. ' + (board.rings.some((v) => v < 0) ? 'A negative ring takes points away. ' : '') + 'Which ' + board.arrows + ' numbers make ' + ringText(board, board.total) + '? You can use a ring more than once.';
    }
    const i = board.solution[board.solution.length - 1];
    return 'One of the arrows should land in the ' + ringText(board, board.rings[i]) + ' ring. What do the others need to add up to?';
  }

  /* ---------- making a round ---------- */
  const clampStars = (stars) => Math.min(3, Math.max(1, stars | 0 || 1));

  function makeRound(band, stars) {
    const st = clampStars(stars);
    const yl = yLine(band, st);
    for (let attempt = 0; attempt < 100; attempt++) {
      const xl = xLine(band, st);
      const pool = poolFor(band, st).filter((k) => k !== 'dist');
      const kinds = ['dist'];
      const order = shuffle(pool);
      for (let i = 1; i < AIMED_SHOTS; i++) kinds.push(order.length ? order[(i - 1) % order.length] : 'dist');
      const shots = [];
      let at = null;
      let okRound = true;
      for (let i = 0; i < AIMED_SHOTS; i++) {
        let kind = kinds[i];
        if (kind === 'hop' && at === null) kind = 'dist';
        let s = makeShot(kind, { xl, yl, band, st, at });
        if (!s) s = makeShot('dist', { xl, yl, band, st, at });
        if (!s) { okRound = false; break; }
        shots.push(s);
        at = X_KINDS.includes(s.kind) ? s.tx : null; // a hop continues from the last arrow's distance
      }
      if (!okRound) continue;
      return { band, stars: st, xLine: xl, yLine: yl, ticksX: ticksIn(xl), ticksY: yl ? ticksIn(yl) : 0, shots, board: makeBoard(band, st) };
    }
    throw new Error('could not build a round');
  }

  /* ---------- checking ---------- */
  /** What the player must tap for a shot (the tick to aim at). */
  function aimFor(shot) {
    return { x: shot.kind === 'wind' ? shot.tx - shot.wind : shot.tx, y: shot.ty };
  }

  /** The player aimed at ans = { x, y } (the ticks that matter for this kind). Returns { ok, landX, landY, gapX, gapY, msg }. */
  function check(round, i, ans) {
    const s = round.shots[i];
    const xl = round.xLine;
    const yl = round.yLine;
    const usesX = X_KINDS.includes(s.kind);
    const usesY = Y_KINDS.includes(s.kind);
    const landX = usesX ? (s.kind === 'wind' ? ans.x + s.wind : ans.x) : null;
    const landY = usesY ? ans.y : null;
    const gapX = usesX ? s.tx - landX : 0; // signed ticks from where it landed to the target
    const gapY = usesY ? s.ty - landY : 0;
    const res = { ok: gapX === 0 && gapY === 0, landX, landY, gapX, gapY, msg: '' };

    const xUnit = xl ? wr(xl, xl.step) : '';
    const yUnit = yl ? wr(yl, yl.step) : '';
    const goalX = usesX ? wr(xl, RUN.valueAt(xl, s.tx), s.form === 'expr' || s.kind === 'hop' ? xl.modes[0] : s.form) : '';
    const goalY = usesY ? wr(yl, RUN.valueAt(yl, s.ty), s.kind === 'lift' ? yl.modes[0] : s.form) : '';
    const xMiss = () => 'you were ' + tickWord(Math.abs(gapX)) + ' (' + xUnit + ' each) ' + (gapX > 0 ? 'short' : 'too far');
    const yMiss = () => 'you were ' + tickWord(Math.abs(gapY)) + ' (' + yUnit + ' each) ' + (gapY > 0 ? 'too low' : 'too high');

    if (res.ok) {
      if (s.kind === 'dist') res.msg = 'Bullseye! ' + (s.form === 'expr' ? s.text.replace('Shoot to ', '') + ' = ' + goalX : 'That tick is exactly ' + goalX) + '.';
      else if (s.kind === 'hop') res.msg = 'Bullseye! ' + wr(xl, RUN.valueAt(xl, s.at)) + (s.tx > s.at ? ' + ' : ' − ') + wr(xl, Math.abs(RUN.valueAt(xl, s.tx) - RUN.valueAt(xl, s.at))) + ' = ' + goalX + '.';
      else if (s.kind === 'wind') res.msg = 'Bullseye! You aimed at ' + wr(xl, RUN.valueAt(xl, ans.x)) + ', the wind ' + windWords(xl, s.wind) + ', and it landed on ' + goalX + '.';
      else if (s.kind === 'height') res.msg = 'Bullseye! That tick is exactly height ' + goalY + '.';
      else if (s.kind === 'lift') res.msg = 'Bullseye! ' + wr(yl, RUN.valueAt(yl, s.platform)) + (s.ty > s.platform ? ' + ' : ' − ') + wr(yl, Math.abs(RUN.valueAt(yl, s.ty) - RUN.valueAt(yl, s.platform))) + ' = ' + goalY + '.';
      else res.msg = 'Bullseye! Across ' + goalX + ' and height ' + goalY + '.';
      return res;
    }

    if (s.kind === 'dist') {
      res.msg = 'Your arrow landed at ' + wr(xl, RUN.valueAt(xl, landX)) + '. The spot for ' + s.text.replace('Shoot to ', '') + (s.form === 'expr' ? ' (' + goalX + ')' : '') + ' is ' + tickWord(Math.abs(gapX)) + ' (' + xUnit + ' each) ' + (gapX > 0 ? 'further' : 'closer') + '.';
    } else if (s.kind === 'hop') {
      res.msg = 'Your arrow landed at ' + wr(xl, RUN.valueAt(xl, landX)) + '. The shot needed to reach ' + goalX + ', which is ' + tickWord(Math.abs(gapX)) + ' (' + xUnit + ' each) ' + (gapX > 0 ? 'further' : 'closer') + '.';
    } else if (s.kind === 'wind') {
      const needAim = RUN.valueAt(xl, s.tx - s.wind);
      res.msg = 'You aimed at ' + wr(xl, RUN.valueAt(xl, ans.x)) + '. The wind ' + windWords(xl, s.wind) + ', so it landed at ' + wr(xl, RUN.valueAt(xl, landX)) + ', ' + tickWord(Math.abs(gapX)) + ' (' + xUnit + ' each) ' + (gapX > 0 ? 'short of' : 'past') + ' the target at ' + goalX + '. Aim at the target ' + (s.wind > 0 ? 'minus' : 'plus') + ' the wind: ' + goalX + (s.wind > 0 ? ' − ' : ' + ') + wr(xl, Math.abs(s.wind) * xl.step) + ' = ' + wr(xl, needAim) + '.';
    } else if (s.kind === 'height') {
      res.msg = 'Your arrow hit at height ' + wr(yl, RUN.valueAt(yl, landY)) + '. The target is at height ' + goalY + ', ' + tickWord(Math.abs(gapY)) + ' (' + yUnit + ' each) ' + (gapY > 0 ? 'higher' : 'lower') + '.';
    } else if (s.kind === 'lift') {
      const d = RUN.valueAt(yl, s.ty) - RUN.valueAt(yl, s.platform);
      res.msg = 'Your arrow hit at height ' + wr(yl, RUN.valueAt(yl, landY)) + '. Work out the target first: ' + wr(yl, RUN.valueAt(yl, s.platform)) + (d > 0 ? ' + ' : ' − ') + wr(yl, Math.abs(d)) + ' = ' + goalY + ', which is ' + tickWord(Math.abs(gapY)) + ' (' + yUnit + ' each) ' + (gapY > 0 ? 'higher' : 'lower') + ' than your arrow.';
    } else if (gapX !== 0 && gapY !== 0) {
      res.msg = 'Across: ' + xMiss() + ' (the target is across ' + goalX + '). Height: ' + yMiss() + ' (the target is at height ' + goalY + ').';
    } else if (gapX !== 0) {
      res.msg = 'Right height, but ' + xMiss() + ': the target is across ' + goalX + '.';
    } else {
      res.msg = 'Right distance, but ' + yMiss() + ': the target is at height ' + goalY + '.';
    }
    return res;
  }

  function hint(round, i, level) {
    const s = round.shots[i];
    const xl = round.xLine;
    const yl = round.yLine;
    const line = X_KINDS.includes(s.kind) ? xl : yl;
    const unit = wr(line, line.step);
    if (level === 0) {
      if (s.kind === 'wind') return 'The wind will push your arrow, so you must aim somewhere other than the target. Each tick is worth ' + unit + '.';
      if (s.kind === 'lift') return 'Work out the target height first from where you stand. Each tick is worth ' + unit + '.';
      return 'Each tick on the ruler is worth ' + unit + '. Count the ticks from a number you can read.';
    }
    const aim = aimFor(s);
    const parts = [];
    if (X_KINDS.includes(s.kind)) {
      const base = s.kind === 'hop' ? s.at : 0;
      const n = Math.abs(aim.x - base);
      parts.push('across: start at ' + wr(xl, RUN.valueAt(xl, base)) + (s.kind === 'hop' ? ' (your last arrow)' : '') + ' and count ' + tickWord(n) + ' to the ' + (aim.x >= base ? 'right' : 'left'));
    }
    if (Y_KINDS.includes(s.kind)) {
      const g = s.kind === 'lift' ? s.platform : groundTick(yl) !== null ? groundTick(yl) : 0;
      const n = Math.abs(aim.y - g);
      parts.push('height: start at ' + wr(yl, RUN.valueAt(yl, g)) + (s.kind === 'lift' ? ' (your platform)' : '') + ' and count ' + tickWord(n) + (aim.y >= g ? ' up' : ' down'));
    }
    return 'Try this. ' + parts.join('; ') + '.';
  }

  /** Which Skills a shot trains (for the grown-ups stats). */
  function skillsOf(kind) {
    if (kind === 'wind') return ['archery-wind'];
    if (kind === 'coord') return ['archery-distance', 'archery-height'];
    if (kind === 'height' || kind === 'lift') return ['archery-height'];
    if (kind === 'board') return ['archery-score'];
    return ['archery-distance'];
  }

  /** The visual arc: points from `from` to `to` ({x, y}, any units), bulging upward by `peak`. Always ends exactly on `to`. */
  function arcPoints(from, to, steps, peak) {
    const n = Math.max(2, steps | 0);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t + 4 * peak * t * (1 - t) });
    }
    out[n] = { x: to.x, y: to.y };
    return out;
  }

  const roundStars = (slips) => RUN.runStars(slips);

  const api = {
    makeRound, makeBoard, check, checkBoard, hint, hintBoard, aimFor, boardSolutions, skillsOf, arcPoints, roundStars,
    xLine, yLine, poolFor, ringText, sumText, SKILLS, AIMED_SHOTS, MAX_Y_TICKS, X_KINDS, Y_KINDS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ARCH = api;
})(typeof window !== 'undefined' ? window : globalThis);
