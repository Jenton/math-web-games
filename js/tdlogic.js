/* Number Defense (tower defense) logic: no DOM, testable in Node.
 *
 * Enemies are numbers marching down a lane. A tower has a rule ("multiples of 3") and only hurts enemies that fit it.
 * You see the whole wave first, then spend limited gold on towers whose rules cover it. Choosing the right rules IS the math.
 * Rules to hold: a wave is solvable (a cheaper-than-everything cover always exists), wrong picks leak and are explained.
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

  const LANE = 9; // columns 0..8; an enemy that walks past column 8 reaches the gate
  const SLOT_COLS = [1, 3, 5, 7];
  const RANGE = 1; // a tower reaches its own column and one either side
  const SLOTS = SLOT_COLS.length;
  const MAX_LEAKS = 2; // a third leak breaks the gate
  const WAVE_SIZE = [7, 9, 11];
  const SLACK = [2, 1, 0]; // spare gold by stars

  const fmt = (n) => (n < 0 ? '−' + -n : String(n));
  const isPrime = (n) => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  const isSquare = (n) => n >= 1 && Number.isInteger(Math.sqrt(n));
  const isPow2 = (n) => n >= 1 && (n & (n - 1)) === 0;

  /* ---------- tower rules (skill ids reuse the Munchers skill names so grown-up stats line up) ---------- */
  const even = () => ({ key: 'even', skill: 'even-odd', name: 'Even', desc: 'even numbers', test: (n) => n % 2 === 0, why: (n) => n + ' is ' + (n % 2 === 0 ? 'even' : 'odd') });
  const odd = () => ({ key: 'odd', skill: 'even-odd', name: 'Odd', desc: 'odd numbers', test: (n) => Math.abs(n) % 2 === 1, why: (n) => n + ' is ' + (n % 2 ? 'odd' : 'even') });
  const multOf = (k) => () => ({ key: 'x' + k, skill: 'multiples', name: 'Multiples of ' + k, desc: 'multiples of ' + k + ' (' + [1, 2, 3].map((i) => i * k).join(', ') + '…)', test: (n) => n > 0 && n % k === 0, why: (n) => (n > 0 && n % k === 0 ? n + ' = ' + k + ' × ' + n / k : n + ' is not in the ' + k + 's') });
  const bigger = (t) => () => ({ key: 'gt' + t, skill: 'compare', name: 'More than ' + t, desc: 'numbers greater than ' + t, test: (n) => n > t, why: (n) => n + (n > t ? ' is more than ' : ' is not more than ') + t });
  const smaller = (t) => () => ({ key: 'lt' + t, skill: 'compare', name: 'Less than ' + t, desc: 'numbers less than ' + t, test: (n) => n < t, why: (n) => n + (n < t ? ' is less than ' : ' is not less than ') + t });
  const prime = () => ({ key: 'prime', skill: 'primes', name: 'Prime', desc: 'prime numbers (2, 3, 5, 7, 11…)', test: isPrime, why: (n) => (isPrime(n) ? n + ' is prime: only 1 and ' + n + ' divide it' : n + ' is not prime' + (n > 3 ? ': ' + (function () { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d + ' × ' + n / d + ' = ' + n; return ''; })() : '')) });
  const factorOf = (N) => () => ({ key: 'f' + N, skill: 'factors', name: 'Factors of ' + N, desc: 'numbers that divide ' + N + ' evenly', test: (n) => n > 0 && N % n === 0, why: (n) => (n > 0 && N % n === 0 ? n + ' × ' + N / n + ' = ' + N : n + ' does not divide ' + N + ' evenly') });
  const squares = () => ({ key: 'sq', skill: 'exponents', name: 'Squares', desc: 'square numbers (1, 4, 9, 16…)', test: isSquare, why: (n) => (isSquare(n) ? n + ' = ' + Math.sqrt(n) + '²' : n + ' is not a square number') });
  const pow2 = () => ({ key: 'p2', skill: 'exponents', name: 'Powers of 2', desc: 'powers of 2 (2, 4, 8, 16…)', test: isPow2, why: (n) => (isPow2(n) ? n + ' = 2 × 2 × … (' + Math.round(Math.log2(n)) + ' twos)' : n + ' is not a power of 2') });
  const negative = () => ({ key: 'neg', skill: 'compare', name: 'Negatives', desc: 'numbers below zero', test: (n) => n < 0, why: (n) => n + (n < 0 ? ' is below zero' : ' is not below zero') });

  // band -> { range of enemy numbers, builders for the shop }
  const BANDS = {
    'K-1': { lo: 1, hi: 20, makers: () => [even, odd, bigger(rnd(8, 12)), smaller(rnd(5, 9)), multOf(5), multOf(10)] },
    '2-3': { lo: 2, hi: 60, makers: () => [multOf(2), multOf(3), multOf(5), multOf(10), multOf(4), odd, bigger(rnd(25, 40)), smaller(rnd(15, 25))] },
    '4-5': { lo: 3, hi: 100, makers: () => [multOf(3), multOf(4), multOf(6), multOf(7), multOf(8), multOf(9), prime, factorOf(pick([24, 36, 48, 60]))] },
    '6': { lo: -8, hi: 120, makers: () => [prime, squares, pow2, multOf(6), multOf(7), multOf(9), multOf(12), negative, factorOf(pick([48, 60, 72, 96]))] },
  };

  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  function costOf(rule, lo, hi) {
    const all = range(lo, hi);
    const d = all.filter(rule.test).length / all.length;
    return d < 0.15 ? 1 : d < 0.35 ? 2 : 3;
  }

  /** Cheapest set of at most SLOTS shop rules that catches every enemy (brute force over subsets). Returns { cost, set } or null. */
  function bestCover(shop, enemies) {
    let best = null;
    for (let m = 1; m < 1 << shop.length; m++) {
      const set = shop.map((_, i) => i).filter((i) => m & (1 << i));
      if (set.length > SLOTS) continue;
      if (!enemies.every((e) => set.some((i) => shop[i].test(e)))) continue;
      const cost = set.reduce((s, i) => s + shop[i].cost, 0);
      if (!best || cost < best.cost || (cost === best.cost && set.length < best.set.length)) best = { cost, set };
    }
    return best;
  }

  /** Build one wave: a shop of 6 towers (the answer plus decoys), the incoming numbers, and a gold budget. */
  function makeWave(band, stars) {
    const cfg = BANDS[band] || BANDS['2-3'];
    const s = Math.min(3, Math.max(1, stars | 0 || 1));
    for (let attempt = 0; attempt < 400; attempt++) {
      const built = shuffle(cfg.makers()).slice(0, 6).map((mk) => mk());
      // drop duplicate keys
      const shop = built.filter((r, i) => built.findIndex((x) => x.key === r.key) === i);
      if (shop.length < 5) continue;
      const lo = band === '6' && !shop.some((r) => r.key === 'neg') ? 2 : cfg.lo;
      shop.forEach((r) => (r.cost = costOf(r, lo, cfg.hi)));
      const aim = shuffle(shop).slice(0, s === 1 ? 2 : s === 2 ? 2 : 3);
      const pool = (r) => range(lo, cfg.hi).filter(r.test);
      const used = new Set();
      const enemies = [];
      const n = WAVE_SIZE[s - 1];
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        const r = aim[k % aim.length];
        const cands = pool(r).filter((v) => !used.has(v));
        if (!cands.length) { ok = false; break; }
        const v = pick(cands);
        used.add(v);
        enemies.push(v);
      }
      if (!ok) continue;
      const cover = bestCover(shop, enemies);
      if (!cover || cover.set.length < 2) continue; // one tower must not beat the whole wave
      const total = shop.reduce((a, r) => a + r.cost, 0);
      const budget = cover.cost + SLACK[s - 1];
      if (budget >= total) continue; // buying everything must not be possible
      return { band, stars: s, shop, enemies: shuffle(enemies), budget, slots: SLOT_COLS.slice(), solution: cover.set, minCost: cover.cost };
    }
    throw new Error('could not build a wave for ' + band + ' ' + stars);
  }

  /**
   * Run a wave. placement: array of shop indexes (or null) per slot. Enemies enter one per tick; each tick every tower shoots the
   * front-most enemy in reach that fits its rule (one shot per tower), then enemies step forward. Returns the full timeline.
   */
  function simulate(wave, placement) {
    const n = wave.enemies.length;
    const alive = wave.enemies.map(() => true);
    const state = wave.enemies.map(() => 'march'); // march | killed | leaked
    const ticks = [];
    const fired = placement.map(() => 0);
    const killedBy = wave.enemies.map(() => -1);
    for (let t = 0; t < n + LANE + 1; t++) {
      const pos = wave.enemies.map((_, i) => t - i); // enemy i enters column 0 at tick i
      const shots = [];
      placement.forEach((ri, slot) => {
        if (ri == null) return;
        const col = SLOT_COLS[slot];
        let target = -1;
        wave.enemies.forEach((v, i) => {
          if (!alive[i] || pos[i] < 0 || pos[i] >= LANE) return;
          if (Math.abs(pos[i] - col) > RANGE) return;
          if (!wave.shop[ri].test(v)) return;
          if (target < 0 || pos[i] > pos[target]) target = i;
        });
        if (target >= 0) {
          alive[target] = false;
          state[target] = 'killed';
          killedBy[target] = slot;
          fired[slot]++;
          shots.push({ slot, enemy: target });
        }
      });
      const leaks = [];
      wave.enemies.forEach((_, i) => {
        if (alive[i] && pos[i] === LANE - 1) {
          alive[i] = false;
          state[i] = 'leaked';
          leaks.push(i);
        }
      });
      ticks.push({ t, pos, shots, leaks, state: state.slice() });
      if (!alive.some(Boolean) && pos[n - 1] >= LANE - 1) break;
    }
    const leaked = state.map((s, i) => (s === 'leaked' ? i : -1)).filter((i) => i >= 0);
    const stars = leaked.length > MAX_LEAKS ? 0 : 3 - leaked.length;
    return { ticks, leaked, killedBy, fired, stars, won: leaked.length <= MAX_LEAKS };
  }

  /** Plain-language reasons for the wave summary: what leaked and why, and which towers did nothing. */
  function explain(wave, placement, result) {
    const lines = [];
    const groups = {}; // leaked numbers grouped by the shop tower that would have caught them
    result.leaked.forEach((i) => {
      const v = wave.enemies[i];
      const k = wave.shop.findIndex((r) => r.test(v));
      (groups[k] = groups[k] || []).push(v);
    });
    Object.keys(groups).forEach((k) => {
      const vals = groups[k];
      const list = vals.map(fmt).join(', ');
      if (+k < 0) lines.push(list + ' got through. None of the towers in the shop fit ' + (vals.length > 1 ? 'them' : 'it') + '.');
      else {
        const r = wave.shop[+k];
        lines.push(list + ' got through. A "' + r.name + '" tower would have stopped ' + (vals.length > 1 ? 'them' : 'it') + ' (' + r.why(vals[0]) + ').');
      }
    });
    placement.forEach((ri, slot) => {
      if (ri != null && result.fired[slot] === 0) {
        lines.push('Your "' + wave.shop[ri].name + '" tower never fired: none of the numbers in this wave are ' + wave.shop[ri].desc.replace(/ \(.*/, '') + '.');
      }
    });
    return lines;
  }

  /** Gold left after placing. */
  const spent = (wave, placement) => placement.reduce((s, ri) => s + (ri == null ? 0 : wave.shop[ri].cost), 0);

  const api = { makeWave, simulate, explain, spent, bestCover, fmt, SLOTS, SLOT_COLS, LANE, RANGE, MAX_LEAKS, BANDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TDL = api;
})(typeof window !== 'undefined' ? window : globalThis);
