/* Puzzle generators for Balance and Machine Builder. Pure logic, no DOM.
 * Balance:  an equation as two sides, each  x*? + c  ; the player finds ?.
 * Machine:  start number + a few operation cards -> reach a target; par comes from a
 *           breadth-first search, so "fewest steps" is always exactly known.
 */
(function (root) {
  'use strict';
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (a) => a[rnd(0, a.length - 1)];
  const clampStars = (s) => Math.min(3, Math.max(1, s | 0 || 1));
  const fmt = (n) => (n < 0 ? '−' + -n : String(n));

  /* ================= Balance ================= */

  const BAL_MAX = { 'K-1': 12, '2-3': 40, '4-5': 20, '6': 30 }; // upper limit of the guess stepper

  const sideVal = (s, v) => s.x * v + s.c;

  function sideText(s) {
    const parts = [];
    if (s.x === 1) parts.push('?');
    else if (s.x > 1) parts.push(s.x + ' × ?');
    if (s.c > 0 || !parts.length) parts.push(String(s.c));
    return parts.join(' + ');
  }

  function makeBalance(band, stars) {
    const st = clampStars(stars);
    let L;
    let R;
    let x;
    if (band === 'K-1') {
      x = rnd(1, [5, 9, 10][st - 1]);
      const a = rnd(1, st === 1 ? 4 : 8);
      L = { x: 1, c: a };
      R = { x: 0, c: x + a };
    } else if (band === '2-3') {
      const kind = st === 1 ? pick(['two', 'add']) : st === 2 ? pick(['add', 'twoadd']) : pick(['twoadd', 'three']);
      if (kind === 'two') {
        x = rnd(2, 9);
        L = { x: 2, c: 0 };
        R = { x: 0, c: 2 * x };
      } else if (kind === 'add') {
        x = rnd(1, st === 1 ? 20 : 25);
        const a = rnd(1, 20);
        L = { x: 1, c: a };
        R = { x: 0, c: x + a };
      } else if (kind === 'twoadd') {
        x = rnd(2, 12);
        const a = rnd(1, 20);
        L = { x: 2, c: a };
        R = { x: 0, c: 2 * x + a };
      } else {
        x = rnd(2, 12);
        L = { x: 3, c: 0 };
        R = { x: 0, c: 3 * x };
      }
    } else if (band === '4-5') {
      if (st === 1) {
        const k = rnd(2, 5);
        x = rnd(2, 10);
        L = { x: k, c: 0 };
        R = { x: 0, c: k * x };
      } else {
        const k = rnd(2, st === 2 ? 9 : 12);
        x = rnd(2, st === 2 ? 10 : 12);
        const a = rnd(1, st === 2 ? 30 : 50);
        L = { x: k, c: a };
        R = { x: 0, c: k * x + a };
      }
    } else {
      // 6th grade: unknown can be on both sides from star 2
      if (st === 1) {
        const k = rnd(2, 9);
        x = rnd(2, 15);
        const a = rnd(1, 40);
        L = { x: k, c: a };
        R = { x: 0, c: k * x + a };
      } else {
        const m = rnd(1, st === 2 ? 4 : 6);
        const k = m + rnd(1, st === 2 ? 4 : 5);
        x = rnd(2, st === 2 ? 15 : 20);
        const a = rnd(0, st === 2 ? 20 : 30);
        L = { x: k, c: a };
        R = { x: m, c: (k - m) * x + a };
      }
    }
    if (Math.random() < 0.5) [L, R] = [R, L];
    const max = BAL_MAX[band] || 30;
    if (x > max) throw new Error('solution above guess max');
    return { id: 'balance', L, R, x, max, text: sideText(L) + ' = ' + sideText(R) };
  }

  /** Check a guess for ?. Returns balance state plus a kid-friendly explanation. */
  function checkBalance(p, v) {
    const l = sideVal(p.L, v);
    const r = sideVal(p.R, v);
    const diff = l - r;
    if (diff === 0) return { balanced: true, l, r, diff, msg: 'Balanced! Both sides weigh ' + l + '.' };
    const slope = p.L.x - p.R.x;
    const tooBig = (diff > 0) === (slope > 0);
    return {
      balanced: false,
      l,
      r,
      diff,
      tooBig,
      msg: 'With ? = ' + v + ', the left side is ' + l + ' and the right side is ' + r + '. The ' + (diff > 0 ? 'left' : 'right') + ' is heavier, so try a ' + (tooBig ? 'smaller' : 'bigger') + ' number.',
    };
  }

  /* ================= Machine Builder ================= */

  const mk = (label, f) => ({ label, f });
  const add = (n) => mk('+' + n, (v) => v + n);
  const sub = (n) => mk('−' + n, (v) => v - n);
  const mul = (n) => mk('×' + n, (v) => v * n);
  const div = (n) => mk('÷' + n, (v) => (v % n === 0 ? v / n : null));
  const sq = () => mk('square', (v) => v * v);

  const POOLS = {
    'K-1': [add(1), add(2), add(3), add(5), add(10), sub(1), sub(2), sub(3)],
    '2-3': [add(5), add(10), add(9), sub(3), sub(5), mul(2), mul(3), mul(5)],
    '4-5': [mul(2), mul(3), mul(4), mul(5), add(7), add(12), sub(8), div(2), div(3), div(5)],
    '6': [mul(2), mul(3), sub(7), add(9), sub(15), div(2), div(3), sq()],
  };
  const LIMITS = { 'K-1': [0, 30], '2-3': [0, 100], '4-5': [0, 300], '6': [-100, 500] };
  const STARTS = { 'K-1': [0, 8], '2-3': [1, 12], '4-5': [2, 15], '6': [-5, 12] };

  function applyOp(op, v, band) {
    const r = op.f(v);
    if (r === null) return null;
    const [lo, hi] = LIMITS[band];
    return r < lo || r > hi ? null : r;
  }

  function bfs(start, ops, band, maxDepth) {
    const dist = new Map([[start, 0]]);
    let frontier = [start];
    for (let d = 1; d <= maxDepth; d++) {
      const next = [];
      frontier.forEach((v) => ops.forEach((op) => {
        const r = applyOp(op, v, band);
        if (r !== null && !dist.has(r)) {
          dist.set(r, d);
          next.push(r);
        }
      }));
      frontier = next;
    }
    return dist;
  }

  function makeMachine(band, stars) {
    const st = clampStars(stars);
    const pool = POOLS[band] || POOLS['2-3'];
    const nOps = st === 1 ? 3 : 4;
    const shift = band === 'K-1' ? 1 : 0;
    const lo = st + shift;
    const hi = st + 1 + shift;
    for (let attempt = 0; attempt < 200; attempt++) {
      const ops = [];
      const bag = pool.slice();
      while (ops.length < nOps && bag.length) ops.push(bag.splice(rnd(0, bag.length - 1), 1)[0]);
      const start = rnd(STARTS[band][0], STARTS[band][1]);
      const dist = bfs(start, ops, band, hi);
      const cands = [...dist.entries()].filter(([v, d]) => d >= lo && d <= hi && v !== start).map(([v, d]) => ({ v, d }));
      if (!cands.length) continue;
      const t = pick(cands);
      return { id: 'machine', start, target: t.v, par: t.d, ops, band };
    }
    throw new Error('could not build machine puzzle');
  }

  /** Apply op index i to value v for a puzzle; null if not allowed (not divisible / out of range). */
  function stepMachine(p, i, v) {
    return applyOp(p.ops[i], v, p.band);
  }

  const api = { makeBalance, checkBalance, sideVal, sideText, makeMachine, stepMachine, fmt, BAL_MAX, SKILLS: { balance: 'Balance: finding the unknown', machine: 'Machine Builder: operation chains' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MGP = api;
})(typeof window !== 'undefined' ? window : globalThis);
