/* Cut & Share: logic, no DOM.
 * Share some pizza fairly among friends. The player chooses how many slices to cut each pizza into
 * (c) and how many slices each friend gets (s). It is fair when every slice is used and everyone gets
 * the same: total slices T = P*c/Q must be a whole number and T = F*s.
 * "Fewest cuts" (par) is computed exactly, so star ratings are fair. Nothing is shown live while
 * choosing: the sums only appear when the player shares, so adjusting until it matches is not a strategy.
 *
 * Amount of pizza is P/Q (Q = 1 for whole pizzas; Q > 1 is "a fraction of a pizza", for 6th grade).
 */
(function (root) {
  'use strict';
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const clampStars = (s) => Math.min(3, Math.max(1, s | 0 || 1));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const MAX_CUTS = 24;
  const MAX_PAR = 12;

  /** Fewest slices per pizza that lets the sharing work out exactly. */
  function parCuts(P, Q, F) {
    for (let c = 1; c <= MAX_CUTS; c++) {
      if ((P * c) % Q === 0 && ((P * c) / Q) % F === 0) return c;
    }
    return null;
  }

  const CONFIG = {
    // [P range, F range, Q options]
    'K-1': [[[1, 1], [2, 4], [1]], [[1, 2], [2, 6], [1]], [[1, 3], [2, 6], [1]]],
    '2-3': [[[1, 3], [2, 6], [1]], [[2, 4], [3, 8], [1]], [[2, 5], [3, 10], [1]]],
    '4-5': [[[2, 5], [3, 8], [1]], [[3, 8], [3, 10], [1]], [[3, 9], [4, 12], [1]]],
    '6': [[[1, 3], [2, 4], [2, 3, 4]], [[1, 4], [2, 6], [2, 3, 4, 5]], [[1, 6], [2, 6], [3, 4, 5, 6]]],
  };

  function makeShare(band, stars) {
    const st = clampStars(stars);
    const [pr, fr, qs] = (CONFIG[band] || CONFIG['2-3'])[st - 1];
    for (let attempt = 0; attempt < 2000; attempt++) {
      const Q = qs[rnd(0, qs.length - 1)];
      let P = rnd(pr[0], pr[1]);
      if (Q > 1) P = rnd(1, Q - 1); // a part of one pizza, like 3/4
      const F = rnd(fr[0], fr[1]);
      if (Q === 1 && P % F === 0) continue; // whole pizzas each: no fraction to find
      if (Q > 1 && gcd(P, Q) !== 1) continue;
      const par = parCuts(P, Q, F);
      if (par === null || par > MAX_PAR || par < 2) continue;
      return { id: 'share', band, P, Q, F, par, max: MAX_CUTS, text: describe(P, Q, F) };
    }
    throw new Error('could not build share puzzle');
  }

  function describe(P, Q, F) {
    const what = Q === 1 ? (P === 1 ? '1 pizza' : P + ' pizzas') : P + '/' + Q + ' of a pizza';
    return 'Share ' + what + ' fairly among ' + F + ' friends';
  }

  /** Check cuts c and slices-each s. Returns {ok, msg, total, used}. */
  function checkShare(p, c, s) {
    const top = p.P * c;
    if (top % p.Q !== 0) {
      return { ok: false, kind: 'split', msg: 'Cutting a pizza into ' + c + ' slices makes the ' + p.P + '/' + p.Q + ' of a pizza ' + p.P + ' × ' + c + ' ÷ ' + p.Q + ' = ' + (top / p.Q).toFixed(2).replace(/\.?0+$/, '') + ' slices. That is not a whole number of slices, so the cuts do not line up. Try a different number of cuts.' };
    }
    const total = top / p.Q;
    const used = p.F * s;
    const slices = p.Q === 1 ? p.P + (p.P === 1 ? ' pizza' : ' pizzas') + ' × ' + c + ' slices = ' + total + ' slices' : p.P + '/' + p.Q + ' of a pizza is ' + total + ' of ' + c + ' slices';
    if (used === total) return { ok: true, total, used, msg: 'All ' + total + ' slices used, ' + s + ' each.' };
    const diff = used - total;
    return {
      ok: false,
      kind: diff < 0 ? 'left' : 'short',
      total,
      used,
      msg: slices + '. ' + p.F + ' friends × ' + s + ' = ' + used + ' slices. ' + (diff < 0 ? -diff + ' slice' + (diff === -1 ? '' : 's') + ' left over, so the pizza is not all used up.' : diff + ' slice' + (diff === 1 ? ' is' : 's are') + ' missing, there is not enough pizza.'),
    };
  }

  /** What each friend gets, as the simplest fraction of a whole pizza. */
  function eachGets(p) {
    const n = p.P;
    const d = p.Q * p.F;
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function starsFor(p, c, misses) {
    const base = c === p.par ? 3 : c <= 2 * p.par ? 2 : 1;
    return Math.max(1, base - misses);
  }

  /** Worked solution for the "out of tries" panel. */
  function solution(p) {
    const e = eachGets(p);
    const total = (p.P * p.par) / p.Q;
    return 'Cut into ' + p.par + ' slices: that makes ' + total + ' slices in all, and ' + total + ' ÷ ' + p.F + ' = ' + total / p.F + ' each. Each friend gets ' + e.n + '/' + e.d + ' of a pizza.';
  }

  const api = { makeShare, checkShare, eachGets, starsFor, solution, parCuts, MAX_TRIES: 3, MAX_CUTS, SKILLS: { share: 'Cut & Share: fair fractions' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MGC = api;
})(typeof window !== 'undefined' ? window : globalThis);
