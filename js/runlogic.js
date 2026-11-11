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
      const goal = writeValue(line, cp.targetValue, cp.form === 'expr' || cp.kind === 'hop' ? line.modes[0] : cp.form);
      return {
        ok: true,
        gap: 0,
        msg: cp.kind === 'hop'
          ? 'Perfect hop! ' + writeValue(line, cp.fromValue, line.modes[0]) + ' + ' + writeValue(line, Math.abs(cp.targetValue - cp.fromValue), line.modes[0]) + ' = ' + goal + '.'
          : 'Right on it! That tick is exactly ' + goal + '.',
      };
    }
    const gap = cp.target - landing;
    const dir = gap > 0 ? 'right' : 'left';
    const label = writeValue(line, a, line.modes[0]);
    const goal = writeValue(line, cp.targetValue, cp.form === 'expr' ? line.modes[0] : cp.form === 'hop' ? line.modes[0] : cp.form);
    const unit = writeValue(line, line.step, line.modes[0]);
    const tail = cp.kind === 'hop'
      ? ' The hop needed to land on ' + goal + ', which is ' + tickWord(Math.abs(gap)) + ' (' + unit + ' each) to the ' + dir + '.'
      : ' The spot for ' + cp.text.replace('Land on ', '') + (cp.text.replace('Land on ', '') === goal ? '' : ' (' + goal + ')') + ' is ' + tickWord(Math.abs(gap)) + ' (' + unit + ' each) to the ' + dir + ' of where you landed.';
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

  const runStars = (slips) => (slips <= MAX_SLIPS_FOR[3] ? 3 : slips <= MAX_SLIPS_FOR[2] ? 2 : 1);

  const api = { makeRun, check, hint, runStars, fmtValue, labelOf, valueAt, ticksOf, writeValue, lineFor, SKILLS, CHECKPOINTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RUN = api;
})(typeof window !== 'undefined' ? window : globalThis);
