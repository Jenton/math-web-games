/* Math Quest engine: skill rules + puzzle generators (no DOM, testable in Node).
 *
 * A "rule" is one Munchers-style challenge, e.g. "Eat the multiples of 6".
 * Each rule can generate correct cells, wrong cells (near-misses at higher
 * stars), check an arbitrary cell, and explain WHY a wrong cell is wrong.
 *
 * Difficulty = grade band (K-1, 2-3, 4-5, 6) x stars (1-3).
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
  const fmt = (n) => (n < 0 ? '−' + -n : String(n));
  const num = (v) => ({ label: fmt(v), value: v });

  const BANDS = ['K-1', '2-3', '4-5', '6'];
  const SKILLS = {
    expressions: 'Expressions that equal a number',
    'even-odd': 'Even and odd',
    compare: 'Greater / less than (and the number line)',
    multiples: 'Multiples and skip counting',
    rounding: 'Rounding',
    factors: 'Factors',
    primes: 'Prime numbers',
    fractions: 'Equivalent fractions',
    exponents: 'Exponents',
  };

  /* ---------- expressions that equal a target ---------- */

  function exprFor(v, ops) {
    const pool = ops.slice();
    while (pool.length) {
      const op = pool.splice(rnd(0, pool.length - 1), 1)[0];
      if (op === '+') {
        const a = rnd(0, v);
        return a + ' + ' + (v - a);
      }
      if (op === '-') {
        const b = rnd(1, Math.max(1, Math.min(v || 1, 12)));
        return v + b + ' − ' + b;
      }
      if (op === '*') {
        const f = [];
        for (let a = 2; a * a <= v; a++) if (v % a === 0) f.push(a);
        if (f.length) {
          const a = pick(f);
          return Math.random() < 0.5 ? a + ' × ' + v / a : v / a + ' × ' + a;
        }
      }
      if (op === '/') {
        const d = rnd(2, 9);
        return v * d + ' ÷ ' + d;
      }
    }
    return v + ' − 0';
  }

  function expressionsRule(cfg) {
    return (stars) => {
      const [lo, hi] = cfg.ranges[stars - 1];
      const t = rnd(lo, hi);
      const offs = [[2, 5], [1, 3], [1, 2]][stars - 1];
      const mk = (v) => ({ label: exprFor(v, cfg.ops), value: v });
      return {
        id: 'expressions',
        title: 'Eat every expression that equals ' + t,
        hint: 'Work each one out in your head!',
        correct: () => mk(t),
        wrong: () => {
          let v;
          do {
            v = t + (Math.random() < 0.5 ? -1 : 1) * rnd(offs[0], offs[1]);
          } while (v < 0 || v === t);
          return mk(v);
        },
        check: (c) => c.value === t,
        why: (c) => c.label + ' = ' + c.value + ', not ' + t + '.',
        ok: (c) => c.label + ' = ' + t,
      };
    };
  }

  /* ---------- even / odd ---------- */

  function parityRule(stars) {
    const want = pick(['even', 'odd']);
    const max = [12, 20, 40][stars - 1];
    const match = (n) => (want === 'even' ? n % 2 === 0 : n % 2 === 1);
    const draw = (f) => {
      let n;
      do n = rnd(1, max);
      while (!f(n));
      return num(n);
    };
    return {
      id: 'even-odd',
      title: 'Eat the ' + want + ' numbers',
      hint: want === 'even' ? 'Even numbers split into two equal groups.' : 'Odd numbers always have one left over.',
      correct: () => draw(match),
      wrong: () => draw((n) => !match(n)),
      check: (c) => match(c.value),
      why: (c) =>
        c.value % 2 === 0
          ? c.value + ' is even: it splits into two equal groups of ' + c.value / 2 + '.'
          : c.value + ' is odd: split it into pairs and one is left over.',
      ok: (c) => c.value + ' is ' + want + '.',
    };
  }

  /* ---------- greater / less than (positive, or negative = number line) ---------- */

  function compareRule(neg) {
    return (stars) => {
      const dir = pick(['greater', 'less']);
      const N = neg ? rnd(-6, 3) : rnd(5, 15);
      const spread = neg ? [6, 9, 12][stars - 1] : [5, 7, 9][stars - 1];
      const lo = neg ? N - spread : Math.max(0, N - spread);
      const hi = N + spread;
      const isMatch = (n) => (dir === 'greater' ? n > N : n < N);
      const set = (f) => {
        const a = [];
        for (let n = lo; n <= hi; n++) if (f(n)) a.push(n);
        return a;
      };
      return {
        id: 'compare',
        title: 'Eat numbers ' + dir + ' than ' + fmt(N),
        hint: neg ? 'Think of the number line: bigger numbers are further right.' : 'Careful: the number itself is not ' + dir + ' than itself!',
        correct: () => num(pick(set(isMatch))),
        wrong: () => num(pick(set((n) => !isMatch(n)))),
        check: (c) => isMatch(c.value),
        why: (c) => {
          const n = c.value;
          if (n === N) return fmt(n) + ' is equal to ' + fmt(N) + ', not ' + dir + ' than it.';
          return (
            fmt(n) + ' is ' + (n < N ? 'less' : 'greater') + ' than ' + fmt(N) +
            (neg ? ': it sits to the ' + (n < N ? 'left' : 'right') + ' on the number line.' : '.')
          );
        },
        ok: (c) => fmt(c.value) + ' is ' + dir + ' than ' + fmt(N) + '.',
      };
    };
  }

  /* ---------- multiples ---------- */

  function multiplesRule(cfg) {
    return (stars) => {
      const k = pick(cfg.ks[stars - 1]);
      const max = cfg.max[stars - 1];
      const m = Math.floor(max / k);
      return {
        id: 'multiples',
        title: 'Eat the multiples of ' + k,
        hint: 'Count by ' + k + 's: ' + k + ', ' + 2 * k + ', ' + 3 * k + '…',
        correct: () => num(k * rnd(1, m)),
        wrong: () => {
          let n;
          do {
            n = stars === 3 && Math.random() < 0.6 ? k * rnd(1, m) + pick([-1, 1, -2, 2]) : rnd(1, max);
          } while (n < 1 || n % k === 0);
          return num(n);
        },
        check: (c) => c.value % k === 0,
        why: (c) => {
          const n = c.value;
          if (n < k) return n + ' is smaller than ' + k + ', so it is not a multiple of ' + k + '.';
          const q = Math.floor(n / k);
          return (
            n + ' is not a multiple of ' + k + ': ' + k + ' × ' + q + ' = ' + k * q + ' and ' + k + ' × ' + (q + 1) + ' = ' + k * (q + 1) + ', so ' + n + ' falls in between.'
          );
        },
        ok: (c) => c.value + ' = ' + k + ' × ' + c.value / k,
      };
    };
  }

  /* ---------- rounding ---------- */

  function roundingRule(stars) {
    const unit = stars === 3 ? 100 : 10;
    const half = unit / 2;
    const T = stars === 2 ? 10 * rnd(10, 40) : unit * rnd(2, 9);
    const nearest = (n) => Math.round(n / unit) * unit;
    return {
      id: 'rounding',
      title: 'Eat numbers that round to ' + T,
      hint: 'Round to the nearest ' + unit + '. (Exactly halfway rounds up.)',
      correct: () => num(rnd(T - half, T + half - 1)),
      wrong: () => num(Math.random() < 0.5 ? rnd(T - unit, T - half - 1) : rnd(T + half, T + unit)),
      check: (c) => nearest(c.value) === T,
      why: (c) => {
        const r = nearest(c.value);
        return c.value + ' rounds to ' + r + ', not ' + T + ': it is only ' + Math.abs(c.value - r) + ' away from ' + r + '.';
      },
      ok: (c) => c.value + ' is closest to ' + T + '.',
    };
  }

  /* ---------- factors ---------- */

  function factorsRule(lists) {
    return (stars) => {
      const N = pick(lists[stars - 1]);
      const facs = [];
      const non = [];
      for (let i = 1; i <= N; i++) (N % i === 0 ? facs : non).push(i);
      return {
        id: 'factors',
        title: 'Eat the factors of ' + N,
        hint: 'A factor divides ' + N + ' with nothing left over.',
        correct: () => num(pick(facs)),
        wrong: () => num(pick(non)),
        check: (c) => N % c.value === 0,
        why: (c) =>
          N + ' ÷ ' + c.value + ' = ' + Math.floor(N / c.value) + ' with ' + (N % c.value) + ' left over, so ' + c.value + ' is not a factor of ' + N + '.',
        ok: (c) => N + ' ÷ ' + c.value + ' = ' + N / c.value,
      };
    };
  }

  /* ---------- primes ---------- */

  function smallestFactor(n) {
    for (let p = 2; p * p <= n; p++) if (n % p === 0) return p;
    return n;
  }

  function primesRule(maxes) {
    return (stars) => {
      const max = maxes[stars - 1];
      const primes = [];
      let comps = [];
      for (let n = 2; n <= max; n++) (smallestFactor(n) === n ? primes : comps).push(n);
      if (stars === 3) {
        const tricky = comps.filter((n) => smallestFactor(n) >= 5);
        if (tricky.length) comps = tricky;
      }
      return {
        id: 'primes',
        title: 'Eat the prime numbers',
        hint: 'A prime has exactly two factors: 1 and itself. (1 is not prime.)',
        correct: () => num(pick(primes)),
        wrong: () => num(pick(comps)),
        check: (c) => c.value > 1 && smallestFactor(c.value) === c.value,
        why: (c) => {
          const p = smallestFactor(c.value);
          return c.value + ' = ' + p + ' × ' + c.value / p + ', so it has more factors than just 1 and itself.';
        },
        ok: (c) => c.value + ' is prime: only 1 × ' + c.value + ' makes it.',
      };
    };
  }

  /* ---------- equivalent fractions ---------- */

  function fractionsRule(stars) {
    const targets = [
      [[1, 2]],
      [[1, 2], [1, 3], [1, 4], [2, 3], [3, 4]],
      [[1, 2], [2, 3], [3, 4], [2, 5], [3, 5], [5, 6], [3, 8]],
    ][stars - 1];
    const [A, B] = pick(targets);
    const kmax = [5, 8, 12][stars - 1];
    const fr = (n, d) => ({ label: n + '/' + d, value: n / d, num: n, den: d });
    return {
      id: 'fractions',
      title: 'Eat every fraction equal to ' + A + '/' + B,
      hint: 'Equivalent fractions: multiply or divide the top and bottom by the same number.',
      correct: () => {
        const k = rnd(2, kmax);
        return fr(A * k, B * k);
      },
      wrong: () => {
        let n, d;
        do {
          if (stars === 3 || Math.random() < 0.5) {
            const k = rnd(2, kmax);
            d = B * k;
            n = A * k + pick([-1, 1, -2, 2]);
          } else {
            d = rnd(3, 24);
            n = rnd(1, d - 1);
          }
        } while (n < 1 || n >= d || n * B === d * A);
        return fr(n, d);
      },
      check: (c) => c.num * B === c.den * A,
      why: (c) => {
        const g = gcd(c.num, c.den);
        return g === 1
          ? c.label + ' is already in simplest form, and it is not ' + A + '/' + B + '.'
          : c.label + ' simplifies to ' + c.num / g + '/' + c.den / g + ', not ' + A + '/' + B + '.';
      },
      ok: (c) => c.label + ' simplifies to ' + A + '/' + B + '.',
    };
  }

  /* ---------- exponents ---------- */

  const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
  const POWERS = [];
  for (let b = 2; b <= 12; b++)
    for (let e = 2; e <= 5; e++) if (Math.pow(b, e) <= 1500) POWERS.push({ b, e, v: Math.pow(b, e), label: b + SUP[e], value: Math.pow(b, e) });
  const powInfo = (label) => POWERS.find((p) => p.label === label);

  function exponentsRule(stars) {
    const t = pick(stars === 1 ? [16, 25, 36, 49, 64, 81, 100] : [16, 27, 32, 64, 81, 100, 125]);
    const correctPool = POWERS.filter((p) => p.v === t).map((p) => ({ label: p.label, value: p.v }));
    for (let a = 2; a * a <= t; a++) if (t % a === 0) correctPool.push({ label: a + ' × ' + t / a, value: t });
    let wrongPool = POWERS.filter((p) => p.v !== t);
    if (stars === 3) {
      const near = wrongPool.filter((p) => Math.abs(p.v - t) <= t * 0.6);
      if (near.length) wrongPool = near;
    }
    return {
      id: 'exponents',
      title: 'Eat every expression equal to ' + t,
      hint: 'The little number says how many times to multiply: 2³ = 2 × 2 × 2.',
      correct: () => Object.assign({}, pick(correctPool)),
      wrong: () => {
        const p = pick(wrongPool);
        return { label: p.label, value: p.v };
      },
      check: (c) => c.value === t,
      why: (c) => {
        const p = powInfo(c.label);
        return c.label + ' = ' + (p ? Array(p.e).fill(p.b).join(' × ') + ' = ' + p.v : c.value) + ', not ' + t + '.';
      },
      ok: (c) => c.label + ' = ' + t,
    };
  }

  /* ---------- band tables ---------- */

  const RULES = {
    'K-1': [
      expressionsRule({ ops: ['+'], ranges: [[3, 6], [5, 10], [8, 15]] }),
      parityRule,
      compareRule(false),
    ],
    '2-3': [
      multiplesRule({ ks: [[2, 5, 10], [2, 3, 4, 5, 10], [3, 4, 6]], max: [50, 60, 60] }),
      expressionsRule({ ops: ['+', '-', '*'], ranges: [[6, 20], [10, 40], [20, 100]] }),
      roundingRule,
      compareRule(false),
    ],
    '4-5': [
      multiplesRule({ ks: [[3, 4, 6], [6, 7, 8, 9], [7, 8, 9, 11, 12]], max: [60, 100, 144] }),
      factorsRule([[12, 18, 20, 24], [24, 30, 36, 40, 48], [48, 60, 72, 84, 96]]),
      primesRule([30, 50, 70]),
      expressionsRule({ ops: ['*', '/', '+', '-'], ranges: [[12, 50], [24, 100], [36, 200]] }),
    ],
    '6': [
      fractionsRule,
      exponentsRule,
      compareRule(true),
      primesRule([60, 100, 150]),
      factorsRule([[36, 48, 60], [72, 84, 96, 120], [144, 180, 210, 240]]),
    ],
  };

  /** Pick a rule for the band/stars, avoiding the previous skill when possible. */
  function makeLevelRule(band, stars, lastId) {
    const makers = RULES[band] || RULES['2-3'];
    const s = Math.min(3, Math.max(1, stars | 0 || 1));
    let rule = null;
    for (let i = 0; i < 12; i++) {
      rule = pick(makers)(s);
      if (rule.id !== lastId) break;
    }
    return rule;
  }

  /** Build a shuffled board of n cells with (about) nCorrect correct ones. */
  function buildBoard(rule, n, nCorrect) {
    const cells = [];
    const seen = new Set();
    const add = (gen) => {
      let c;
      let tries = 0;
      do {
        c = gen();
        tries++;
      } while (seen.has(c.label) && tries < 40);
      seen.add(c.label);
      cells.push(Object.assign({}, c, { correct: !!rule.check(c), eaten: false }));
    };
    for (let i = 0; i < nCorrect; i++) add(rule.correct);
    for (let i = 0; i < n - nCorrect; i++) add(rule.wrong);
    return shuffle(cells);
  }

  const api = { BANDS, SKILLS, makeLevelRule, buildBoard, shuffle, rnd, RULES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MG = api;
})(typeof window !== 'undefined' ? window : globalThis);
