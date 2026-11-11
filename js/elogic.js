/* Escape Room Locks: logic, no DOM, testable in Node.
 *
 * A room has three locks of different kinds. Each lock is a small hand-designed puzzle whose numbers are generated:
 *   sequence  continue a number pattern
 *   code      a keypad code whose digits are given as arithmetic clues
 *   balance   find the mystery weight (reuses MGP.makeBalance)
 *   machine   chain operation cards to reach the target in a few steps (reuses MGP.makeMachine)
 * Wrong answers never just say "no": check() returns a message that shows the arithmetic.
 */
(function (root) {
  'use strict';
  const MGP = typeof require !== 'undefined' && typeof module !== 'undefined' ? require('./puzzles.js') : root.MGP;
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
  const fmt = (n) => (n < 0 ? '−' + -n : String(n));
  const stars = (s) => Math.min(3, Math.max(1, s | 0 || 1));

  const SKILLS = { pattern: 'Escape Room: number patterns', code: 'Escape Room: code clues', balance: 'Balance: finding the unknown', machine: 'Machine Builder: operation chains' };

  const THEMES = [
    { name: 'The Old Library', story: 'The big door slammed shut behind you. Crack the three locks to get out!', tile: 'Wood' },
    { name: "The Inventor's Workshop", story: 'The workshop locked itself! The inventor left three puzzle locks on the exit.', tile: 'Metal' },
    { name: 'The Treasure Vault', story: 'You found the vault, and it closed behind you. Three locks stand between you and daylight.', tile: 'Marble' },
  ];

  /* ---------- sequence locks ---------- */
  // each maker returns { terms, why(next) } where terms is the full sequence; the last term is the answer
  function arith(start, step, n) {
    const terms = Array.from({ length: n }, (_, i) => start + i * step);
    const word = step > 0 ? 'more' : 'less';
    return { terms, rule: 'Each number is ' + Math.abs(step) + ' ' + word + ' than the one before.', jump: (a, b) => b - a, name: (step > 0 ? '+' : '−') + Math.abs(step) };
  }
  function geo(start, mult, n) {
    const terms = Array.from({ length: n }, (_, i) => start * Math.pow(mult, i));
    return { terms, rule: 'Each number is ' + mult + ' times the one before.', name: '×' + mult };
  }
  function growing(start, d0, n) { // differences grow by 1: +d0, +(d0+1), ...
    const terms = [start];
    for (let i = 1; i < n; i++) terms.push(terms[i - 1] + d0 + (i - 1));
    return { terms, rule: 'The jumps grow by 1 each time: +' + d0 + ', +' + (d0 + 1) + ', +' + (d0 + 2) + '…', name: 'growing' };
  }
  function squares(from, n) {
    const terms = Array.from({ length: n }, (_, i) => (from + i) * (from + i));
    return { terms, rule: 'These are square numbers: ' + terms.slice(0, 3).map((t, i) => (from + i) + ' × ' + (from + i) + ' = ' + t).join(', ') + '…', name: 'squares' };
  }
  function fib(a, b, n) {
    const terms = [a, b];
    while (terms.length < n) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
    return { terms, rule: 'Each number is the two before it added together: ' + terms[0] + ' + ' + terms[1] + ' = ' + terms[2] + '.', name: 'fib' };
  }

  function makeSequence(band, st) {
    const shown = st === 1 ? 4 : 5; // numbers you see; the next one is the answer
    const n = shown + 1;
    let s;
    if (band === 'K-1') {
      const step = pick(st === 1 ? [1, 2, 5, 10] : [2, 5, 10, -1, -2]);
      const start = step > 0 ? rnd(0, 12) : rnd(20, 40);
      s = arith(start, step, n);
    } else if (band === '2-3') {
      const k = pick(st === 1 ? [3, 4] : st === 2 ? [6, 7, 8, 9] : ['down', 'geo']);
      if (k === 'geo') s = geo(rnd(1, 3), 2, n);
      else if (k === 'down') s = arith(rnd(70, 99), -pick([3, 4, 6, 7, 9]), n);
      else s = arith(rnd(0, 20), k, n);
    } else if (band === '4-5') {
      const k = pick(st === 1 ? ['a'] : st === 2 ? ['a', 'grow', 'geo'] : ['grow', 'geo', 'sq']);
      if (k === 'a') s = arith(rnd(10, 80), pick([11, 12, 15, 25]), n);
      else if (k === 'grow') s = growing(rnd(1, 15), rnd(1, 4), n);
      else if (k === 'geo') s = geo(rnd(1, 4), 3, n);
      else s = squares(rnd(2, 4), n);
    } else {
      const k = pick(st === 1 ? ['geo', 'neg'] : st === 2 ? ['geo', 'neg', 'sq', 'grow'] : ['fib', 'geo4', 'sq', 'neg']);
      if (k === 'geo') s = geo(rnd(1, 5), pick([2, 3]), n);
      else if (k === 'geo4') s = geo(rnd(1, 3), 4, n);
      else if (k === 'neg') s = arith(-rnd(8, 30), rnd(3, 9), n);
      else if (k === 'sq') s = squares(rnd(4, 8), n);
      else if (k === 'fib') s = fib(rnd(1, 5), rnd(2, 6), n);
      else s = growing(rnd(1, 15), rnd(1, 4), n);
    }
    const answer = s.terms[shown];
    return { kind: 'sequence', skill: 'pattern', title: 'Pattern lock', prompt: 'What number comes next?', terms: s.terms.slice(0, shown), answer, rule: s.rule, family: s.name, maxDigits: String(Math.abs(answer)).length + 1 };
  }

  /* ---------- code locks: digits from arithmetic clues ---------- */
  // hand-written expression families per band, evaluated with a tiny safe evaluator (no eval)
  function evalExpr(t) {
    // grammar: + − × ÷ ^ parentheses, integers, unary minus via leading "−"
    const tok = t.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '').match(/\d+|[-+*/^()]/g);
    let i = 0;
    const peek = () => tok[i];
    const next = () => tok[i++];
    function prim() {
      const x = next();
      if (x === '(') { const v = expr(); next(); return v; }
      if (x === '-') return -pow();
      return parseInt(x, 10);
    }
    function pow() { const b = prim(); if (peek() === '^') { next(); return Math.pow(b, pow()); } return b; }
    function term() { let v = pow(); while (peek() === '*' || peek() === '/') { const o = next(); const r = pow(); v = o === '*' ? v * r : v / r; } return v; }
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(); const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    const v = expr();
    if (i !== tok.length) throw new Error('bad expression ' + t);
    return v;
  }

  const par = (n) => (n < 0 ? '(−' + -n + ')' : String(n)); // negative numbers get brackets inside an expression

  /** An expression that equals the digit d (0-9). Order of operations matters from 4th grade up. */
  function digitClue(band, st, d) {
    const f = [];
    if (band === 'K-1') {
      const a = rnd(0, d);
      f.push(a + ' + ' + (d - a));
      const b = rnd(1, 10 - d);
      f.push(d + b + ' − ' + b);
      if (st >= 2) { const x = rnd(0, d); const y = rnd(0, d - x); f.push(x + ' + ' + y + ' + ' + (d - x - y)); }
    } else if (band === '2-3') {
      for (let a = 2; a <= 9; a++) if (d > 0 && d % a === 0 && d / a >= 2) f.push(a + ' × ' + d / a);
      const b = rnd(2, st === 1 ? 20 : 40);
      f.push(d + b + ' − ' + b);
      const a = rnd(0, d);
      f.push(a + ' + ' + (d - a));
      if (st >= 2) { const k = rnd(2, 9); f.push(d * k + ' ÷ ' + k); }
    } else if (band === '4-5') {
      const k = rnd(2, 9);
      f.push(d * k + ' ÷ ' + k);
      const x = rnd(2, 9), y = rnd(2, 9);
      f.push(x * y + ' − ' + (x * y - d));
      // order of operations: m + n × k means do n × k first
      const pairs = [];
      for (let n = 1; n <= 9; n++) for (let kk = 2; kk <= 9; kk++) if (n * kk <= d) pairs.push([n, kk]);
      if (pairs.length) { const [n, kk] = pick(pairs); f.push(d - n * kk + ' + ' + n + ' × ' + kk); if (st >= 2) f.push(d - n * kk + ' + ' + n + ' × ' + kk); }
      if (st >= 2) { const m = rnd(2, 4), q = rnd(1, 5); f.push(m * (d + q) + ' ÷ ' + m + ' − ' + q); }
    } else {
      for (const b of [2, 3, 4]) if (b * b - d >= 0) f.push(b + '^2 − ' + (b * b - d));
      const a = rnd(2, 5);
      f.push(par(d - a) + ' − ' + par(-a)); // subtracting a negative
      const p = [];
      for (let m = 1; m <= 5; m++) for (let n = 1; n <= 5; n++) if (m * n <= d) p.push([m, n]);
      if (p.length) { const [m, n] = pick(p); f.push(par(-m) + ' × ' + par(-n) + ' + ' + (d - m * n)); }
      const e = rnd(2, 4);
      f.push(d - e * e + ' + ' + e + '^2');
    }
    const ok = f.map((t) => t.replace(/-/g, '−')).filter((t) => { try { return evalExpr(t) === d; } catch (e) { return false; } });
    const lively = ok.filter((t) => !/(^|[ (])0 [+×]|[+×] 0($| )|\+ 0$/.test(t)); // skip clues like 7 + 0 that are no puzzle at all
    return lively.length ? pick(lively) : ok.length ? pick(ok) : d + ' + 0';
  }

  function makeCode(band, st) {
    const n = st === 3 ? 4 : 3;
    const digits = Array.from({ length: n }, () => rnd(0, 9));
    const clues = digits.map((d) => digitClue(band, st, d));
    return { kind: 'code', skill: 'code', title: 'Code lock', prompt: 'Work out each digit, then enter the code.', clues, digits, n };
  }

  /* ---------- balance and machine locks (reuse the puzzle generators) ---------- */
  function makeBalanceLock(band, st) {
    const p = MGP.makeBalance(band, st);
    return { kind: 'balance', skill: 'balance', title: 'Scale lock', prompt: 'Make the scale level. What does one ? weigh?', p, answer: p.x };
  }
  function makeMachineLock(band, st) {
    const p = MGP.makeMachine(band, st);
    return { kind: 'machine', skill: 'machine', title: 'Machine lock', prompt: 'Turn ' + fmt(p.start) + ' into ' + fmt(p.target) + '.', p, limit: Math.max(p.par + 2, 4) };
  }

  const MAKERS = { sequence: makeSequence, code: makeCode, balance: makeBalanceLock, machine: makeMachineLock };

  /** A room: three different lock kinds, in random order, in a themed room. */
  function makeRoom(band, starCount, roomNo) {
    const st = stars(starCount);
    const kinds = shuffle(Object.keys(MAKERS)).slice(0, 3);
    const theme = THEMES[((roomNo || 1) - 1) % THEMES.length];
    return { band, stars: st, theme, locks: kinds.map((k) => MAKERS[k](band, st)) };
  }

  /* ---------- checking and hints ---------- */
  function machineValues(lock, path) {
    const vs = [lock.p.start];
    for (const i of path) {
      const v = MGP.stepMachine(lock.p, i, vs[vs.length - 1]);
      if (v === null) return null;
      vs.push(v);
    }
    return vs;
  }

  /** answer: sequence/balance = a number, code = array of digits, machine = array of op indexes. Returns { ok, msg }. */
  function check(lock, answer) {
    if (lock.kind === 'sequence') {
      if (answer === lock.answer) return { ok: true, msg: 'The lock clicks open! ' + lock.rule };
      const t = lock.terms;
      const last = t[t.length - 1];
      return { ok: false, msg: fmt(answer) + ' does not fit. ' + lock.rule + ' Look at the jump from ' + fmt(t[t.length - 2]) + ' to ' + fmt(last) + ', then keep going.' };
    }
    if (lock.kind === 'code') {
      const bad = [];
      lock.digits.forEach((d, i) => { if (answer[i] !== d) bad.push('Digit ' + (i + 1) + ': ' + lock.clues[i] + ' = ' + d + (answer[i] == null ? '' : ', not ' + answer[i])); });
      return bad.length ? { ok: false, msg: bad.join('. ') + '.' } : { ok: true, msg: 'Every digit matched. The lock opens!' };
    }
    if (lock.kind === 'balance') {
      const r = MGP.checkBalance(lock.p, answer);
      return { ok: r.balanced, msg: r.balanced ? 'The scale is level! One ? weighs ' + answer + '.' : r.msg };
    }
    const vs = machineValues(lock, answer);
    if (!vs) return { ok: false, msg: 'One of those steps is not allowed there (it does not give a whole number).' };
    const end = vs[vs.length - 1];
    if (end !== lock.p.target) return { ok: false, msg: 'You ended on ' + fmt(end) + ' but the lock needs ' + fmt(lock.p.target) + '.' };
    if (answer.length > lock.limit) return { ok: false, msg: 'That reaches ' + fmt(lock.p.target) + ' in ' + answer.length + ' steps, but the lock jams after ' + lock.limit + '. Find a shorter chain.' };
    return { ok: true, msg: answer.length + ' steps: the lock opens!' };
  }

  /** A nudge that points at the idea without giving the answer. */
  function hint(lock, level) {
    if (lock.kind === 'sequence') {
      const t = lock.terms;
      const diffs = t.slice(1).map((v, i) => fmt(v - t[i]));
      return level > 0 ? 'Jumps between the numbers: ' + diffs.join(', ') + '. Is it adding, or multiplying?' : 'Look at how far it is from each number to the next.';
    }
    if (lock.kind === 'code') return level > 0 ? 'Do the multiplying and dividing before adding and subtracting. Start with the first digit: ' + lock.clues[0] + '.' : 'Each clue is a sum that equals one digit, from 0 to 9. Work out one clue at a time.';
    if (lock.kind === 'balance') return level > 0 ? 'Both sides must weigh the same. Try a number, look at which side is heavier, and move toward the other.' : 'Take the same away from both sides to see what one ? must weigh.';
    return level > 0 ? 'The best chain uses ' + lock.p.par + (lock.p.par === 1 ? ' step' : ' steps') + '. Try working backward from ' + fmt(lock.p.target) + '.' : 'Try each card once to see which way it moves the number.';
  }

  /** Stars for a finished room: slips are wrong tries and hints. */
  const roomStars = (slips) => (slips <= 1 ? 3 : slips <= 4 ? 2 : 1);

  const api = { makeRoom, makeSequence, makeCode, makeBalanceLock, makeMachineLock, check, hint, roomStars, machineValues, evalExpr, fmt, SKILLS, THEMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ESC = api;
})(typeof window !== 'undefined' ? window : globalThis);
