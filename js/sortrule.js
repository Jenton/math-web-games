/* Sort & Rule: logic, no DOM.
 * A gate lets some numbers through and stops others, by a hidden rule. The player tests numbers,
 * watches what happens, then picks the rule from four choices.
 * Fairness guarantees (checked in tests/sortrule.test.js):
 *   - exactly ONE of the four choices fits every number in the tray (so the answer can be inferred),
 *   - the tray has several numbers that pass and several that are stopped,
 *   - every wrong choice is contradicted by at least one number in the tray.
 */
(function (root) {
  'use strict';
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const clampStars = (s) => Math.min(3, Math.max(1, s | 0 || 1));
  const shuffle = (a) => {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = rnd(0, i);
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  const isPrime = (n) => {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  };
  const isSquare = (n) => Number.isInteger(Math.sqrt(n));
  const R = (tier, text, f) => ({ tier, text, f });

  /** Fresh rule list for a band (numbers inside the rules are re-rolled on every call). */
  function rulesFor(band) {
    if (band === 'K-1') {
      const n = rnd(5, 9);
      const m = rnd(12, 16);
      return [
        R(1, 'even numbers', (x) => x % 2 === 0),
        R(1, 'odd numbers', (x) => x % 2 === 1),
        R(2, 'bigger than ' + n, (x) => x > n),
        R(2, 'smaller than ' + n, (x) => x < n),
        R(3, 'counting by 5s (5, 10, 15, 20)', (x) => x % 5 === 0),
        R(3, 'between ' + n + ' and ' + m, (x) => x > n && x < m),
        R(3, 'bigger than ' + m, (x) => x > m),
      ];
    }
    if (band === '2-3') {
      const n = rnd(12, 18);
      const m = n + rnd(8, 12);
      return [
        R(1, 'multiples of 2', (x) => x % 2 === 0),
        R(1, 'multiples of 5', (x) => x % 5 === 0),
        R(1, 'multiples of 10', (x) => x % 10 === 0),
        R(2, 'multiples of 3', (x) => x % 3 === 0),
        R(2, 'multiples of 4', (x) => x % 4 === 0),
        R(2, 'between ' + n + ' and ' + m, (x) => x > n && x < m),
        R(3, 'even and bigger than ' + n, (x) => x % 2 === 0 && x > n),
        R(3, 'odd and smaller than ' + m, (x) => x % 2 === 1 && x < m),
        R(3, 'multiples of 3 or multiples of 5', (x) => x % 3 === 0 || x % 5 === 0),
      ];
    }
    if (band === '4-5') {
      const k = pickOf([24, 30, 36, 48]);
      return [
        R(1, 'multiples of 6', (x) => x % 6 === 0),
        R(1, 'multiples of 7', (x) => x % 7 === 0),
        R(1, 'multiples of 8', (x) => x % 8 === 0),
        R(1, 'multiples of 9', (x) => x % 9 === 0),
        R(2, 'prime numbers', isPrime),
        R(2, 'square numbers', isSquare),
        R(2, 'factors of ' + k, (x) => k % x === 0),
        R(3, 'multiples of 3 that are odd', (x) => x % 3 === 0 && x % 2 === 1),
        R(3, 'multiples of both 4 and 6', (x) => x % 4 === 0 && x % 6 === 0),
        R(3, 'one more than a multiple of 5', (x) => x % 5 === 1),
      ];
    }
    return [
      R(1, 'prime numbers', isPrime),
      R(1, 'square numbers', isSquare),
      R(1, 'multiples of 4 but not multiples of 8', (x) => x % 4 === 0 && x % 8 !== 0),
      R(2, 'prime or square', (x) => isPrime(x) || isSquare(x)),
      R(2, 'odd and a multiple of 3', (x) => x % 2 === 1 && x % 3 === 0),
      R(2, 'not a multiple of 2 or 3', (x) => x % 2 !== 0 && x % 3 !== 0),
      R(3, 'not prime and not even', (x) => !isPrime(x) && x % 2 === 1),
      R(3, 'factors of 60', (x) => 60 % x === 0),
      R(3, 'square numbers or one less than a square', (x) => isSquare(x) || isSquare(x + 1)),
      R(3, 'multiples of 3 but not multiples of 6', (x) => x % 3 === 0 && x % 6 !== 0),
    ];
  }
  function pickOf(a) { return a[rnd(0, a.length - 1)]; }

  const RANGE = { 'K-1': [1, 20, 10], '2-3': [1, 40, 12], '4-5': [1, 60, 14], '6': [1, 60, 16] }; // lo, hi, tray size
  const MIN_TESTS = 3;

  function makeSort(band, stars) {
    const st = clampStars(stars);
    const [lo, hi, size] = RANGE[band] || RANGE['2-3'];
    for (let attempt = 0; attempt < 2000; attempt++) {
      const rules = rulesFor(band);
      const pool = rules.filter((r) => r.tier === st);
      const truth = pickOf(pool);
      const tray = shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, size).sort((a, b) => a - b);
      const vec = (r) => tray.map(r.f).join('');
      const passes = tray.filter(truth.f).length;
      if (passes < 4 || tray.length - passes < 4) continue;
      const tv = vec(truth);
      const seen = new Set([truth.text]);
      const distract = shuffle(rules).filter((r) => {
        if (seen.has(r.text) || vec(r) === tv) return false;
        seen.add(r.text);
        return true;
      }).slice(0, 3);
      if (distract.length < 3) continue;
      const options = shuffle([truth].concat(distract));
      return { id: 'sort', band, tray, rule: truth, options, correct: options.indexOf(truth) };
    }
    throw new Error('could not build sort puzzle');
  }

  const gate = (p, n) => !!p.rule.f(n);

  /** Plain-language reason a wrong choice is wrong, using a number the player actually tested if possible. */
  function explainWrong(p, optionIndex, tested) {
    const opt = p.options[optionIndex];
    const contradicts = (n) => !!opt.f(n) !== gate(p, n);
    const hit = tested.find(contradicts);
    if (hit !== undefined) {
      return gate(p, hit)
        ? hit + ' went through the gate, but it is not one of the ' + opt.text + '.'
        : hit + ' was stopped, but it is one of the ' + opt.text + '. So that is not the rule.';
    }
    const untested = p.tray.find((n) => contradicts(n) && !tested.includes(n));
    return 'Not sure yet! Test the number ' + untested + ' to tell the choices apart.';
  }

  /** Fewer tests = more stars. A wrong guess costs a star (never below one). */
  function starsFor(tests, wrong, size) {
    const base = tests <= Math.ceil(size / 2) ? 3 : tests <= Math.ceil(size * 0.75) ? 2 : 1;
    return Math.max(1, base - wrong);
  }

  const api = { makeSort, gate, explainWrong, starsFor, rulesFor, MIN_TESTS, MAX_WRONG: 2, RANGE, SKILLS: { sort: 'Sort & Rule: finding the hidden rule' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MGR = api;
})(typeof window !== 'undefined' ? window : globalThis);
