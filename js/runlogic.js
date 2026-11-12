/* Number Line Runner logic, no DOM, testable in Node.
 *
 * A run is four checkpoints along one number line. The hero stands at a value; the sign says where to go ("Land on 3/4",
 * "Hop 1/2 to the right"). The player aims at a tick on the line and jumps. The spot is NEVER drawn on the line, so finding it means
 * reading the ticks: counting by the tick size, locating fractions, decimals, negatives and percents. A miss splashes into the river and
 * explains how far off it was, in ticks and in the arithmetic.
 *
 * All values are exact: integers counted in units of 1/D (D = the line's denominator), so there is no floating-point error.
 */
(function (root) {
  'use strict';
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
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const SKILLS = { numberline: 'Number line: placing numbers', 'numberline-hop': 'Number line: hopping by a distance' };
  const CHECKPOINTS = 4;
  const MAX_SLIPS_FOR = { 3: 1, 2: 3 };

  const minus = (s) => s.replace('-', '−');

  /** Format the value a/D in one of the forms: 'int', 'frac' (mixed numbers), 'dec', 'pct'. Returns null if that form cannot show it exactly. */
  function fmtValue(a, D, mode) {
    if (mode === 'int') return a % D === 0 ? minus(String(a / D)) : null;
    if (mode === 'dec' || mode === 'pct') {
      const scaled = mode === 'pct' ? a * 100 : a;
      const num = (a * (mode === 'pct' ? 100 : 1) * 1000) / D; // thousandths
      if (!Number.isInteger(num)) return null;
      if (mode === 'pct') { const p = (a * 100) / D; return Number.isInteger(p) ? minus(p + '%') : null; }
      let s = (num / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      return minus(s);
    }
    const sign = a < 0 ? '−' : '';
    const n = Math.abs(a);
    const g = gcd(n, D) || 1;
    const nn = n / g;
    const dd = D / g;
    if (dd === 1) return sign + nn;
    const whole = Math.floor(nn / dd);
    const rem = nn - whole * dd;
    return sign + (whole ? whole + ' ' : '') + rem + '/' + dd;
  }

  /* ---------- the lines (one per band and stars) ---------- */
  // D = denominator, lo/hi/step are integers in units of 1/D. labelEvery = label every n-th tick (whole numbers are always labeled).
  function lineFor(band, st) {
    if (band === 'K-1') return st === 1 ? { D: 1, lo: 0, hi: 10, step: 1, labelEvery: 1, modes: ['int'], note: '1' } : { D: 1, lo: 0, hi: 20, step: 1, labelEvery: 5, modes: ['int'], note: '1' };
    if (band === '2-3') return st === 1 ? { D: 1, lo: 0, hi: 100, step: 10, labelEvery: 1, modes: ['int'], note: '10' } : { D: 1, lo: 0, hi: 100, step: 5, labelEvery: 2, modes: ['int'], note: '5' };
    if (band === '4-5') {
      if (st === 1) return { D: 4, lo: 0, hi: 8, step: 1, labelEvery: 4, modes: ['frac'], note: '1/4' }; // 0 to 2 by fourths
      if (st === 2) return pick([{ D: 8, lo: 0, hi: 8, step: 1, labelEvery: 8, modes: ['frac'], note: '1/8' }, { D: 10, lo: 0, hi: 10, step: 1, labelEvery: 10, modes: ['dec'], note: '0.1' }]);
      return { D: 4, lo: 0, hi: 12, step: 1, labelEvery: 4, modes: ['frac', 'dec'], note: '1/4' }; // 0 to 3, mixed numbers and decimals
    }
    if (st === 1) return { D: 1, lo: -5, hi: 5, step: 1, labelEvery: 1, modes: ['int'], note: '1' };
    if (st === 2) return { D: 2, lo: -6, hi: 6, step: 1, labelEvery: 2, modes: ['frac', 'dec'], note: '1/2' }; // -3 to 3 by halves
    return { D: 4, lo: -8, hi: 8, step: 1, labelEvery: 4, modes: ['frac', 'dec', 'pct'], note: '1/4' }; // -2 to 2 by fourths
  }

  /** Indexes 0..N-1 of the ticks; tick k has value (lo + k*step)/D. */
  const ticksOf = (line) => Array.from({ length: Math.floor((line.hi - line.lo) / line.step) + 1 }, (_, k) => k);
  const valueAt = (line, k) => line.lo + k * line.step; // numerator over D

  function labelOf(line, k) {
    const a = valueAt(line, k);
    if (line.labelEvery === 1 || k % line.labelEvery === 0) return fmtValue(a, line.D, line.modes[0] === 'dec' && a % line.D === 0 ? 'int' : line.modes[0]);
    return '';
  }

  /** How a value is written on the sign: picks one of the line's forms that can show it exactly. */
  function writeValue(line, a, preferredMode) {
    const order = [preferredMode].concat(line.modes).concat(['frac']);
    for (const m of order) { const s = fmtValue(a, line.D, m); if (s !== null) return s; }
    return fmtValue(a, line.D, 'frac');
  }

  function makeCheckpoints(line, band, st) {
    const N = ticksOf(line).length;
    const out = [];
    let at = band === '6' ? Math.floor(N / 2) : 0; // negatives: start in the middle (at zero), otherwise at the left end
    const used = new Set([at]);
    for (let c = 0; c < CHECKPOINTS; c++) {
      let kind = 'land';
      if (c > 0 && st >= 3 && Math.random() < 0.5) kind = 'hop';
      else if (c > 0 && st === 2 && band !== 'K-1' && band !== '2-3' && Math.random() < 0.25) kind = 'hop';
      // choose a target tick: far enough to need real counting, never the same as where we stand
      const far = Math.max(2, Math.floor(N / 4));
      let target;
      for (let tries = 0; tries < 200; tries++) {
        target = rnd(0, N - 1);
        if (Math.abs(target - at) < far || target === at) continue;
        if (used.has(target) && tries < 100) continue;
        if (kind === 'land' && labelOf(line, target)) continue; // a labeled tick would give the answer away; ask for an unlabeled one
        break;
      }
      const a = valueAt(line, target);
      const cur = valueAt(line, at);
      let text;
      let form;
      if (kind === 'land') {
        form = band === '6' && st === 3 ? pick(line.modes) : line.modes.length > 1 ? pick(line.modes) : line.modes[0];
        text = 'Land on ' + writeValue(line, a, form);
        if (band === '2-3' && st === 3 && a > 0 && Math.random() < 0.6) {
          // an expression, so the value must be worked out first
          const facs = [];
          for (let f = 2; f <= 10; f++) if (a % f === 0 && a / f >= 2 && a / f <= 10) facs.push([f, a / f]);
          if (facs.length) { const [x, y] = pick(facs); text = 'Land on ' + x + ' × ' + y; form = 'expr'; }
        }
      } else {
        const d = Math.abs(a - cur);
        const dir = a > cur ? 'right' : 'left';
        const fm = line.modes[0];
        text = 'Hop ' + writeValue(line, d, fm) + ' to the ' + dir;
        form = fm;
      }
      out.push({ kind, from: at, target, text, form, fromValue: cur, targetValue: a });
      used.add(target);
      at = target;
    }
    return out;
  }

  function makeRun(band, stars) {
    const st = Math.min(3, Math.max(1, stars | 0 || 1));
    const line = lineFor(band, st);
    const ticks = ticksOf(line).length;
    for (let attempt = 0; attempt < 50; attempt++) {
      const checkpoints = makeCheckpoints(line, band, st);
      // every checkpoint needs a real move and a valid hop
      if (checkpoints.every((c) => c.target !== c.from)) return { band, stars: st, line, ticks, checkpoints };
    }
    throw new Error('could not build a run');
  }

  /* ---------- checking ---------- */
  const tickWord = (n) => n + (n === 1 ? ' tick' : ' ticks');

  /** The player lands on tick index `landing`. Returns { ok, msg, gap } where gap is signed ticks from the landing to the goal. */
  function check(run, cpIndex, landing) {
    const cp = run.checkpoints[cpIndex];
    const line = run.line;
    const a = valueAt(line, landing);
    if (landing === cp.target) {
      const goal = writeValue(line, cp.targetValue, PLAIN_FORMS.includes(cp.form) || cp.kind === 'hop' ? line.modes[0] : cp.form);
      return {
        ok: true,
        gap: 0,
        msg: cp.kind === 'hop'
          ? 'Perfect hop! ' + writeValue(line, cp.fromValue, line.modes[0]) + ' + ' + writeValue(line, Math.abs(cp.targetValue - cp.fromValue), line.modes[0]) + ' = ' + goal + '.'
          : cp.form === 'round' ? 'Right on it! ' + cp.roundFrom + ' rounded to the nearest ' + cp.roundTo + ' is ' + goal + '.' : cp.form === 'expr' ? 'Right on it! ' + cp.text.replace('Land on ', '') + ' = ' + goal + '.' : 'Right on it! That tick is exactly ' + goal + '.',
      };
    }
    const gap = cp.target - landing;
    const dir = gap > 0 ? 'right' : 'left';
    const label = writeValue(line, a, line.modes[0]);
    const goal = writeValue(line, cp.targetValue, PLAIN_FORMS.includes(cp.form) || cp.form === 'hop' ? line.modes[0] : cp.form);
    const unit = writeValue(line, line.step, line.modes[0]);
    const tail = cp.kind === 'hop'
      ? ' The hop needed to land on ' + goal + ', which is ' + tickWord(Math.abs(gap)) + ' (' + unit + ' each) to the ' + dir + '.'
      : ' The spot for ' + (cp.form === 'round' ? cp.roundFrom + ' rounded to the nearest ' + cp.roundTo : cp.text.replace('Land on ', '')) + (cp.form === 'round' || cp.text.replace('Land on ', '') !== goal ? ' (' + goal + ')' : '') + ' is ' + tickWord(Math.abs(gap)) + ' (' + unit + ' each) to the ' + dir + ' of where you landed.';
    return { ok: false, gap, msg: 'You landed on ' + label + '.' + tail };
  }

  function hint(run, cpIndex, level) {
    const cp = run.checkpoints[cpIndex];
    const line = run.line;
    const unit = writeValue(line, line.step, line.modes[0]);
    if (level === 0) return 'Each tick on the line is worth ' + unit + '. Count the ticks from a number you can read.';
    const from = cp.kind === 'hop' ? cp.from : null;
    const base = cp.kind === 'hop' ? cp.from : (line.lo <= 0 && 0 <= line.hi ? Math.round((0 - line.lo) / line.step) : 0);
    const n = Math.abs(cp.target - base);
    const dir = cp.target >= base ? 'right' : 'left';
    return 'Start at ' + writeValue(line, valueAt(line, base), line.modes[0]) + (from !== null ? ' (where you stand)' : '') + ' and count ' + tickWord(n) + ' to the ' + dir + '.';
  }

  /* ---------- grade content (shared with Arrow Range: js/archerylogic.js; docs/grade-and-difficulty-plan.md) ---------- */
  const TOP_GRADE = 8; // the highest grade the Runner has content for
  const L = (D, lo, hi, step, labelEvery, modes, note) => ({ D, lo, hi, step, labelEvery, modes, note });
  const X = (line, style) => ({ line, style: style || 'plain' });
  const wr = (line, a, form) => writeValue(line, a, form || line.modes[0]);
  const PLAIN_FORMS = ['expr', 'round', 'h100']; // note forms that are not a way of writing the ruler's own numbers
  const clampGrade = (g) => Math.max(0, Math.min(TOP_GRADE, Number.isInteger(g) ? g : 3));

  /** Distance rulers for a grade, as GROUPS: a round picks one group, then one ruler in it (so grade 3 rotates through fractions, facts, tens and rounding). */
  function xGroups(g) {
    if (g <= 0) return [[X(L(1, 0, 10, 1, 1, ['int'], '1'))]];
    if (g === 1) return [[X(L(1, 0, 20, 1, 5, ['int'], '1'))]];
    if (g === 2) return [[X(L(1, 0, 100, 10, 1, ['int'], '10')), X(L(1, 0, 100, 5, 2, ['int'], '5'))]];
    if (g === 3) {
      return [
        // 3.NF.A.2: fractions on a number line, denominators 2, 3, 4, 6, 8 only (grade 3 limit)
        [X(L(2, 0, 6, 1, 2, ['frac'], '1/2'), 'frac'), X(L(3, 0, 9, 1, 3, ['frac'], '1/3'), 'frac'), X(L(4, 0, 8, 1, 4, ['frac'], '1/4'), 'frac'), X(L(6, 0, 12, 1, 6, ['frac'], '1/6'), 'frac'), X(L(8, 0, 8, 1, 8, ['frac'], '1/8'), 'frac')],
        [X(L(1, 0, 80, 4, 5, ['int'], '4'), 'facts')], // 3.OA.C.7: products as notes (6 × 7); ticks are multiples of 4
        [X(L(1, 0, 1000, 50, 2, ['int'], '50'), 'big')], // 3.NBT.A.3 and A.2: 9 × 50 style notes, hops within 1000
        [X(L(1, 0, 100, 10, 2, ['int'], '10'), 'round')], // 3.NBT.A.1: round to the nearest ten
        [X(L(1, 0, 1000, 100, 2, ['int'], '100'), 'round100')], // 3.NBT.A.1: round to the nearest hundred
      ];
    }
    if (g === 4) return [[X(L(10, 0, 10, 1, 10, ['dec', 'frac'], '0.1'), 'tenths'), X(L(10, 0, 20, 1, 10, ['dec', 'frac'], '0.1'), 'tenths')]]; // 4.NF.C.5, C.6
    if (g === 5) return [[X(L(4, 0, 12, 1, 4, ['frac', 'dec'], '1/4'))]];
    if (g === 6) return [[X(L(2, 0, 12, 1, 2, ['frac', 'dec'], '1/2')), X(L(4, 0, 12, 1, 4, ['frac', 'dec'], '1/4')), X(L(10, 0, 10, 1, 5, ['pct', 'dec', 'frac'], '10%'))]];
    return [[X(L(1, 0, 80, 4, 5, ['int'], '4'), 'percentOf')], [X(L(4, 0, 12, 1, 4, ['frac', 'dec'], '1/4'))], [X(L(10, 0, 10, 1, 5, ['pct', 'dec', 'frac'], '10%'))]]; // 7.RP.A.3 percent of
  }

  /** Standards each kind of item exercises (traceability, not a claim about school order; see the plan doc). */
  function tagsOf(kind, style, grade, form) {
    if (kind === 'dist') {
      if (style === 'frac') return ['3.NF.A.2'];
      if (style === 'facts') return ['3.OA.C.7'];
      if (style === 'big') return ['3.NBT.A.3'];
      if (style === 'round' || style === 'round100') return ['3.NBT.A.1'];
      if (style === 'tenths') return form === 'h100' ? ['4.NF.C.5', '4.NF.C.6'] : ['4.NF.C.6'];
      if (style === 'percentOf') return ['7.RP.A.3'];
      return grade <= 0 ? ['K.CC.C.7'] : grade === 1 ? ['1.OA.C.6'] : grade === 2 ? ['2.MD.B.6'] : grade === 5 ? ['5.G.A.1'] : grade === 6 ? ['6.NS.C.6'] : ['7.NS.A.1'];
    }
    if (kind === 'hop') return grade <= 1 ? ['1.OA.C.6'] : grade === 2 ? ['2.MD.B.6'] : grade === 3 ? ['3.NBT.A.2'] : grade >= 7 ? ['7.NS.A.1'] : ['6.NS.C.6'];
    if (kind === 'wind') return grade <= 2 ? ['2.MD.B.6'] : grade <= 5 ? ['3.OA.D.8'] : grade === 6 ? ['6.NS.C.6'] : ['7.NS.A.1'];
    if (kind === 'lift') return grade <= 5 ? ['3.OA.D.8'] : grade === 6 ? ['6.NS.C.5', '6.NS.C.6'] : ['7.NS.A.1'];
    if (kind === 'height') return grade <= 1 ? ['K.CC.C.7'] : ['2.MD.B.6'];
    if (kind === 'coord') return grade <= 6 ? ['5.G.A.1', '5.G.A.2'] : ['6.NS.C.6', '7.NS.A.1'];
    return [];
  }

  /** Can a target worth `a` be written in this ruler's note style (a product, tens-times, rounding)? Targets that cannot are not chosen, so a grade 3 ruler never falls back to "Shoot to 44". */
  function canNote(style, a) {
    if (style === 'facts') { if (a < 8) return false; for (let f = 2; f <= 10; f++) if (a % f === 0 && a / f >= 2 && a / f <= 10) return true; return false; }
    if (style === 'big') { for (let d = 2; d <= 9; d++) for (let m = 1; m <= 9; m++) if (d * m * 10 === a) return true; return false; }
    if (style === 'round') return a >= 10;
    if (style === 'round100') return a >= 100;
    if (style === 'percentOf') { for (const p of [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) for (const W of [20, 40, 60, 80]) if ((p * W) % 100 === 0 && (p * W) / 100 === a) return true; return false; }
    return true;
  }

  /** The note body for a target worth `a`, in the style of the ruler (facts, rounding, tens-times, tenths, percent of...); falls back to plain numbers. Returns { form, body }. */
  function noteBody(xl, style, a, shot) {
    const plain = () => {
      const form = xl.modes.length > 1 ? pick(xl.modes) : xl.modes[0];
      return { form, body: wr(xl, a, form) };
    };
    if (style === 'facts' && a >= 8) {
      const facs = [];
      for (let f = 2; f <= 10; f++) if (a % f === 0 && a / f >= 2 && a / f <= 10) facs.push([f, a / f]);
      if (facs.length) { const [p, q] = pick(facs); return { form: 'expr', body: p + ' × ' + q }; }
    }
    if (style === 'big') {
      const facs = [];
      for (let d = 2; d <= 9; d++) for (let m = 1; m <= 9; m++) if (d * m * 10 === a) facs.push([d, m * 10]);
      if (facs.length) { const [p, q] = pick(facs); return { form: 'expr', body: p + ' × ' + q }; }
    }
    if (style === 'round' || style === 'round100') {
      const unit = style === 'round' ? 10 : 100;
      const offs = [];
      for (let o = 1; o < unit / 2; o++) { offs.push(o); offs.push(-o); }
      const n = a + pick(offs);
      if (a >= unit && n > 0) { shot.roundFrom = n; shot.roundTo = unit === 10 ? 'ten' : 'hundred'; return { form: 'round', body: n + ', rounded to the nearest ' + shot.roundTo }; }
    }
    if (style === 'percentOf') {
      const combos = [];
      for (const p of [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) for (const W of [20, 40, 60, 80]) if ((p * W) % 100 === 0 && (p * W) / 100 === a) combos.push([p, W]);
      if (combos.length) { const [p, W] = pick(combos); return { form: 'expr', body: p + '% of ' + W }; }
    }
    if (style === 'tenths') {
      const form = pick(['dec', 'h100', 'frac']);
      if (form === 'h100') return { form, body: (a * (100 / xl.D)) + '/100' };
      return { form, body: wr(xl, a, form) };
    }
    return plain();
  }

  /** The Runner's rulers for a grade, as groups (one group, then one ruler in it, per run). Up to grade 5 they are the shared 0-based rulers; from grade 6 the line runs through zero. */
  function runnerGroups(g) {
    if (g <= 5) return xGroups(g);
    if (g === 6) return [[X(lineFor('6', 1)), X(lineFor('6', 2))]];
    return [[X(lineFor('6', 3))]];
  }

  /** Four checkpoints for a grade: landings written in the ruler's note style, and hops (no hops in kindergarten). `hard` (a bonus run) makes hops likelier. */
  function makeCheckpointsG(line, style, grade, hard) {
    const N = ticksOf(line).length;
    const out = [];
    let at = line.lo < 0 ? Math.round((0 - line.lo) / line.step) : 0; // negatives: start at zero
    const used = new Set([at]);
    const hopP = grade <= 0 ? 0 : grade === 1 ? 0.25 : grade <= 5 ? 0.35 : 0.5;
    for (let c = 0; c < CHECKPOINTS; c++) {
      const kind = c > 0 && Math.random() < hopP + (hard ? 0.15 : 0) ? 'hop' : 'land';
      const targets = (minGap) => {
        const cands = [];
        for (let k = 0; k < N; k++) if (k !== at && Math.abs(k - at) >= minGap && (kind !== 'land' || canNote(style, valueAt(line, k)))) cands.push(k);
        return cands;
      };
      let cands = targets(Math.max(2, Math.floor(N / 4))); // far enough to need real counting
      if (!cands.length) cands = targets(1);
      if (!cands.length) return null;
      const fresh = cands.filter((k) => !used.has(k));
      const pool = fresh.length ? fresh : cands;
      const unlabeled = kind === 'land' ? pool.filter((k) => !labelOf(line, k)) : pool; // a labeled tick would give the spot away
      const target = pick(unlabeled.length ? unlabeled : pool);
      const a = valueAt(line, target);
      const cur = valueAt(line, at);
      const cp = { kind, from: at, target, text: '', form: null, fromValue: cur, targetValue: a, tags: [] };
      if (kind === 'land') {
        const n = noteBody(line, style, a, cp);
        cp.form = n.form;
        cp.text = 'Land on ' + n.body;
      } else {
        cp.form = line.modes[0];
        cp.text = 'Hop ' + writeValue(line, Math.abs(a - cur), line.modes[0]) + ' to the ' + (a > cur ? 'right' : 'left');
      }
      cp.tags = tagsOf(kind === 'land' ? 'dist' : 'hop', style, grade, cp.form);
      out.push(cp);
      used.add(target);
      at = target;
    }
    return out;
  }

  /** One run for a player in `grade` (0 = kindergarten to 8). opts.hard: a bonus (stretch) run. */
  function makeGradeRun(grade, opts) {
    const g = clampGrade(grade);
    const hard = !!(opts && opts.hard);
    for (let attempt = 0; attempt < 100; attempt++) {
      const xs = pick(pick(runnerGroups(g)));
      const checkpoints = makeCheckpointsG(xs.line, xs.style, g, hard);
      if (checkpoints && checkpoints.every((c) => c.target !== c.from)) return { grade: g, band: null, stars: null, line: xs.line, style: xs.style, ticks: ticksOf(xs.line).length, checkpoints };
    }
    throw new Error('could not build a run for grade ' + g);
  }

  /** A line of example text for the setup screen. */
  function sampleText(grade) {
    const r = makeGradeRun(grade);
    return r.checkpoints[0].text + ' (the line has ' + r.ticks + ' ticks, each worth ' + wr(r.line, r.line.step) + ')';
  }

  const runStars = (slips) => (slips <= MAX_SLIPS_FOR[3] ? 3 : slips <= MAX_SLIPS_FOR[2] ? 2 : 1);

  const api = {
    makeRun, makeGradeRun, check, hint, runStars, fmtValue, labelOf, valueAt, ticksOf, writeValue, lineFor, sampleText, SKILLS, CHECKPOINTS,
    // the grade content below is shared with Arrow Range (js/archerylogic.js)
    xGroups, runnerGroups, noteBody, canNote, tagsOf, L, X, PLAIN_FORMS, TOP_GRADE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RUN = api;
})(typeof window !== 'undefined' ? window : globalThis);
