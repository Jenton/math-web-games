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
    fractions3: 'Fractions: equal fractions and comparing with a half',
    tens: 'Multiplying by multiples of 10',
    sums1000: 'Adding and subtracting within 1000',
    tenths: 'Tenths, hundredths and decimals',
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

  /* ---------- greater / less than ----------
   * Difficulty is how CLOSE the cards sit to the target number, and how big the numbers are. At 1 star the cards are far on either side, so you can
   * judge by eye. At 3 stars every card is within a few of the target and the target itself shows up as a trap ("is 12 greater than 12?").
   * cfg per grade band, one entry per star: target range [lo, hi], spread (how far from the target a card may be), traps (chance a wrong card
   * is exactly the target). Negative targets (grade 6) use the number line. */
  const COMPARE = {
    'K-1': { target: [[5, 12], [8, 20], [10, 30]], spread: [8, 6, 5], traps: [0.1, 0.2, 0.25] },
    '2-3': { target: [[20, 60], [50, 200], [100, 900]], spread: [30, 15, 8], traps: [0.1, 0.2, 0.25] },
    '6': { target: [[-8, 4], [-15, 8], [-30, 12]], spread: [10, 7, 5], traps: [0.1, 0.2, 0.25], neg: true },
  };

  function compareRule(band) {
    const cfg = COMPARE[band];
    return (stars) => {
      const neg = !!cfg.neg;
      const dir = pick(['greater', 'less']);
      const [tlo, thi] = cfg.target[stars - 1];
      const N = rnd(tlo, thi);
      const spread = cfg.spread[stars - 1];
      const isMatch = (n) => (dir === 'greater' ? n > N : n < N);
      const sign = dir === 'greater' ? 1 : -1;
      // a card on the matching side of N, 1..spread away (never below 1 for counting numbers)
      const right = () => {
        for (let i = 0; i < 20; i++) {
          const n = N + sign * rnd(1, spread);
          if (neg || n >= 1) return num(n);
        }
        return num(N + sign);
      };
      // a card on the wrong side, 1..spread away, or sometimes N itself
      const wrong = () => {
        if (Math.random() < cfg.traps[stars - 1]) return num(N);
        for (let i = 0; i < 20; i++) {
          const n = N - sign * rnd(1, spread);
          if (neg || n >= 1) return num(n);
        }
        return num(N);
      };
      return {
        id: 'compare',
        title: 'Eat numbers ' + dir + ' than ' + fmt(N),
        hint: neg ? 'Think of the number line: bigger numbers are further right.' : 'Careful: the number itself is not ' + dir + ' than itself!',
        correct: right,
        wrong,
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
      compareRule('K-1'),
    ],
    '2-3': [
      multiplesRule({ ks: [[2, 5, 10], [2, 3, 4, 5, 10], [3, 4, 6]], max: [50, 60, 60] }),
      expressionsRule({ ops: ['+', '-', '*'], ranges: [[6, 20], [10, 40], [20, 100]] }),
      roundingRule,
      compareRule('2-3'),
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
      compareRule('6'),
      primesRule([60, 100, 150]),
      factorsRule([[36, 48, 60], [72, 84, 96, 120], [144, 180, 210, 240]]),
    ],
  };


  /* ---------- grade-specific additions (docs/grade-and-difficulty-plan.md) ----------
   * The band/star rules above already cover multiples, products, rounding and 3-digit comparing for a 3rd grader. What grade 3 also asks for, and
   * Munchers lacked, is fractions (3.NF.A.3), tens-times (3.NBT.A.3) and sums within 1000 (3.NBT.A.2); grade 4 adds tenths (4.NF.C.5, C.6).
   * These are mixed into the pool for those grades only (GRADE_EXTRA, used when makeLevelRule gets a grade). */
  const lcm = (a, b) => (a / gcd(a, b)) * b; // (gcd is defined with the fraction rule above)
  const DEN3 = [2, 3, 4, 6, 8]; // grade 3 fractions use only these denominators (CCSS 3.NF footnote)
  const fracCell = (a, b) => ({ label: a + '/' + b, value: a / b, num: a, den: b });
  const halfText = (n) => (n % 2 === 0 ? String(n / 2) : (n - 1) / 2 + ' 1/2');

  /** Eat the fractions equal to p/q (2/4 and 3/6 are 1/2): equivalent fractions, denominators 2, 3, 4, 6, 8 only. */
  function fractionEqRule(stars) {
    const targets = [[[1, 2]], [[1, 2], [1, 4], [3, 4], [1, 3]], [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]][stars - 1];
    const [p, q] = pick(targets);
    const eq = [];
    const other = [];
    DEN3.forEach((b) => {
      for (let a = 1; a < b; a++) (a * q === p * b ? eq : other).push([a, b]);
    });
    // nearer misses at 3 stars (3/8 against 1/2), anywhere at 1 star
    const near = other.filter(([a, b]) => Math.abs(a / b - p / q) <= 0.2);
    const wrongPool = stars === 3 && near.length ? near : other;
    return {
      id: 'fractions3',
      tags: ['3.NF.A.3'],
      title: 'Eat the fractions equal to ' + p + '/' + q,
      hint: 'Equal fractions are the same size, like 1/2 = 2/4 = 3/6. Multiply the top and the bottom by the same number.',
      correct: () => fracCell(...pick(eq)),
      wrong: () => fracCell(...pick(wrongPool)),
      check: (c) => c.num * q === p * c.den,
      why: (c) => {
        const L = lcm(c.den, q);
        const mine = (c.num * L) / c.den;
        const theirs = (p * L) / q;
        return c.label + ' = ' + mine + '/' + L + ' and ' + p + '/' + q + ' = ' + theirs + '/' + L + ', so ' + c.label + ' is ' + (mine > theirs ? 'bigger' : 'smaller') + ', not equal.';
      },
      ok: (c) => {
        const k = c.den / q;
        return k === 1 ? c.label + ' is ' + p + '/' + q + ' itself' : c.label + ' = ' + p + '/' + q + ': ' + p + ' × ' + k + ' = ' + c.num + ' and ' + q + ' × ' + k + ' = ' + c.den;
      },
    };
  }

  /** Eat the fractions bigger (or smaller) than 1/2: compare by asking whether the top is more than half of the bottom. */
  function fractionHalfRule(stars) {
    const bigger = Math.random() < 0.5;
    const cells = [];
    DEN3.forEach((b) => {
      for (let a = 1; a < b; a++) cells.push(fracCell(a, b));
    });
    const rel = (c) => Math.sign(2 * c.num - c.den); // 1: more than half, 0: exactly half, -1: less
    const want = bigger ? 1 : -1;
    const good = cells.filter((c) => rel(c) === want);
    const bad = cells.filter((c) => rel(c) !== want && (stars === 3 || rel(c) !== 0)); // exactly-a-half is a trap at 3 stars
    const nearHalf = (c) => Math.abs(c.num / c.den - 0.5) <= 0.17;
    const goodPool = stars === 3 && good.filter(nearHalf).length >= 2 ? good.filter(nearHalf) : good;
    const badPool = stars === 3 && bad.filter(nearHalf).length >= 2 ? bad.filter(nearHalf) : bad;
    const word = bigger ? 'bigger' : 'smaller';
    const cmp = (c) => (rel(c) > 0 ? 'more than' : rel(c) < 0 ? 'less than' : 'exactly');
    return {
      id: 'fractions3',
      tags: ['3.NF.A.3.d'],
      title: 'Eat the fractions ' + word + ' than 1/2',
      hint: 'A half of the bottom number is the middle. Is the top number past it?',
      correct: () => Object.assign({}, pick(goodPool)),
      wrong: () => Object.assign({}, pick(badPool)),
      check: (c) => rel(c) === want,
      why: (c) => (rel(c) === 0
        ? 'Half of ' + c.den + ' is ' + halfText(c.den) + ' and the top is ' + c.num + ', so ' + c.label + ' is exactly 1/2, not ' + word + ' than it.'
        : 'Half of ' + c.den + ' is ' + halfText(c.den) + ', and ' + c.num + ' is ' + cmp(c) + ' that, so ' + c.label + ' is ' + (rel(c) > 0 ? 'bigger' : 'smaller') + ' than 1/2, not ' + word + '.'),
      ok: (c) => 'Half of ' + c.den + ' is ' + halfText(c.den) + ', and ' + c.num + ' is ' + cmp(c) + ' that, so ' + c.label + ' is ' + word + ' than 1/2.',
    };
  }

  /** Eat every product that equals 240: tens-times (6 × 40, 40 × 6, 24 tens). One-digit numbers times multiples of 10 (10 to 90). */
  function tensTimesRule(stars) {
    const N = pick([[120, 180], [160, 240, 360], [180, 240, 360]][stars - 1]);
    const T = N / 10; // the number of tens
    const pairs = [];
    for (let d = 2; d <= 9; d++) for (let m = 1; m <= 9; m++) if (d * m === T) pairs.push([d, m]);
    const mk = (d, m, form) => {
      const tens = d * m;
      const label = form === 0 ? d + ' × ' + m * 10 : form === 1 ? m * 10 + ' × ' + d : tens + ' tens';
      return { label, value: tens * 10, d, m, tens: form === 2 };
    };
    const near = stars === 3 ? 3 : 8;
    return {
      id: 'tens',
      tags: ['3.NBT.A.3'],
      title: 'Eat every product that equals ' + N,
      hint: 'Think in tens: 6 × 40 is 6 × 4 tens = 24 tens = 240.',
      correct: () => {
        const [d, m] = pick(pairs);
        return mk(d, m, rnd(0, 2));
      },
      wrong: () => {
        let d;
        let m;
        do {
          d = rnd(2, 9);
          m = rnd(1, 9);
        } while (d * m === T || Math.abs(d * m - T) > near);
        return mk(d, m, rnd(0, 2));
      },
      check: (c) => c.value === N,
      why: (c) => (c.tens ? c.label + ' = ' + c.value + ', not ' + N + '.' : c.d + ' × ' + c.m + ' tens = ' + c.d * c.m + ' tens = ' + c.value + ', not ' + N + '.'),
      ok: (c) => (c.tens ? c.label + ' = ' + N : c.d + ' × ' + c.m + ' tens = ' + c.d * c.m + ' tens = ' + N),
    };
  }

  /** Eat every sum or difference that equals 350: adding and subtracting within 1000. */
  function sumsTo1000Rule(stars) {
    const [lo, hi] = [[200, 500], [200, 800], [300, 1000]][stars - 1];
    const step = stars === 1 ? 10 : 1;
    const t = Math.round(rnd(lo, hi) / step) * step;
    const mk = (v) => {
      if (Math.random() < 0.6) {
        const a = Math.round(rnd(Math.max(10, Math.floor(v * 0.2)), Math.max(20, Math.floor(v * 0.8))) / step) * step;
        return { label: a + ' + ' + (v - a), value: v };
      }
      const b = Math.round(rnd(20, 400) / step) * step;
      return { label: v + b + ' − ' + b, value: v };
    };
    // the common slips: a ten or a hundred off, or the ones digit
    const offs = stars === 1 ? [10, 20, 100] : stars === 2 ? [10, 20, 100, 1, 2] : [10, 100, 1, 9, 11];
    return {
      id: 'sums1000',
      tags: ['3.NBT.A.2'],
      title: 'Eat every sum or difference that equals ' + t,
      hint: 'Add the hundreds, then the tens, then the ones.',
      correct: () => mk(t),
      wrong: () => {
        let v;
        do {
          v = t + (Math.random() < 0.5 ? -1 : 1) * pick(offs);
        } while (v < 20 || v > 1100 || v === t);
        return mk(v);
      },
      check: (c) => c.value === t,
      why: (c) => c.label + ' = ' + c.value + ', not ' + t + '.',
      ok: (c) => c.label + ' = ' + t,
    };
  }

  /** Eat the numbers equal to 3/10: tenths, hundredths and decimals say the same number (0.3 = 3/10 = 30/100). */
  function tenthsRule(stars) {
    const t = rnd(1, 9);
    const forms = [() => ({ label: '0.' + t, h: t * 10 }), () => ({ label: t + '/10', h: t * 10 }), () => ({ label: t * 10 + '/100', h: t * 10 }), () => ({ label: '0.' + t + '0', h: t * 10 })];
    const cell = (c) => Object.assign(c, { value: c.h });
    const wrongs = () => {
      const u = pick(stars === 1 ? [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => Math.abs(x - t) >= 3 && x !== t) : [t - 1, t + 1].filter((x) => x >= 1 && x <= 9));
      const v = u || (t === 1 ? 2 : t - 1);
      return pick([
        () => ({ label: '0.0' + t, h: t }), // t hundredths, not tenths
        () => ({ label: t + '/100', h: t }),
        () => ({ label: '0.' + v, h: v * 10 }),
        () => ({ label: v + '/10', h: v * 10 }),
        () => ({ label: '0.' + t + t, h: t * 10 + t }),
      ])();
    };
    return {
      id: 'tenths',
      tags: ['4.NF.C.5', '4.NF.C.6'],
      title: 'Eat the numbers equal to ' + t + '/10',
      hint: 'Tenths: 0.3 = 3/10 = 30/100. The first place after the point is tenths, the second is hundredths.',
      correct: () => cell(pick(forms)()),
      wrong: () => {
        let c;
        do c = cell(wrongs()); while (c.h === t * 10);
        return c;
      },
      check: (c) => c.h === t * 10,
      why: (c) => c.label + ' is ' + c.h + ' hundredths, but ' + t + '/10 is ' + t * 10 + ' hundredths (0.' + t + ').',
      ok: (c) => c.label + ' is ' + t * 10 + ' hundredths, the same as ' + t + '/10 = 0.' + t,
    };
  }

  /** Extra rule makers mixed into a grade's pool (on top of its band's rules), when makeLevelRule is given the grade. */
  const GRADE_EXTRA = {
    3: [fractionEqRule, fractionHalfRule, tensTimesRule, sumsTo1000Rule],
    4: [tenthsRule, fractionHalfRule, tensTimesRule],
  };

  /** Pick a rule for the band/stars, avoiding the previous skill when possible. `grade` (optional) adds that grade's extra rules (GRADE_EXTRA) to the band's pool. */
  function makeLevelRule(band, stars, lastId, grade) {
    const makers = (RULES[band] || RULES['2-3']).concat((grade != null && GRADE_EXTRA[grade]) || []);
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

  const api = { BANDS, SKILLS, makeLevelRule, buildBoard, shuffle, rnd, RULES, GRADE_EXTRA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MG = api;
})(typeof window !== 'undefined' ? window : globalThis);
