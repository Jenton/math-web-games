/* Standards labels for the grown-ups view, no DOM, testable in Node. Design: docs/grade-and-difficulty-plan.md ("Standards reference").
 *
 * Each skill id a game records (Store.record) maps to the Common Core (CCSS-M, which California uses) codes it CAN practise. A skill spans
 * several grades, so the wording is "can practise", never "has mastered". Only codes read from the standards text are listed (grade pages on
 * thecorestandards.org and the California CDE PDF); a skill with no verified code stays unlabeled rather than guessed. */
(function (root) {
  'use strict';
  const CODES = {
    numberline: ['2.MD.B.6', '3.NF.A.2', '4.NF.C.6', '6.NS.C.6'],
    'numberline-hop': ['2.MD.B.6', '6.NS.C.5'],
    'archery-distance': ['2.MD.B.6', '3.NF.A.2', '4.NF.C.6'],
    'archery-height': ['5.G.A.2', '6.NS.C.6'],
    'archery-wind': ['6.NS.C.5', '7.NS.A.1'],
    'archery-score': ['2.NBT.B.5', '3.NBT.A.2'],
    expressions: ['1.OA.C.6', '2.OA.B.2'],
    compare: ['K.CC.C.7', '4.NF.C.7'],
    multiples: ['3.OA.C.7', '4.OA.B.4'],
    rounding: ['3.NBT.A.1'],
    factors: ['4.OA.B.4', '6.NS.B.4'],
    primes: ['4.OA.B.4'],
    fractions: ['4.NF.A.1', '4.NF.A.2'],
    fractions3: ['3.NF.A.3'],
    armor: ['4.NF.A.1'],
    share: ['3.NF.A.3'],
    exponents: ['5.NBT.A.2', '6.EE.A.1'],
    tens: ['3.NBT.A.3'],
    sums1000: ['3.NBT.A.2'],
    tenths: ['4.NF.C.6', '4.NF.C.7'],
    balance: ['6.EE.B.7'],
    pattern: ['3.OA.D.9'],
    'lemon-change': ['2.MD.C.8'],
    'lemon-stock': ['3.OA.A.3'],
  };
  // No verified code yet (left out on purpose): even-odd, boss, code, machine, sort, lemon-price.

  const CODE_RE = /^(K|[1-8])\.[A-Z]{1,3}\.[A-Z]\.[0-9]+$/;
  const codesFor = (skill) => (Object.prototype.hasOwnProperty.call(CODES, skill) ? CODES[skill].slice() : []);
  /** The text shown under a skill in the grown-ups list, or '' when the skill has no verified code. */
  const label = (skill) => { const c = codesFor(skill); return c.length ? 'Can practise: ' + c.join(', ') : ''; };

  const api = { CODES, CODE_RE, codesFor, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Standards = api;
})(typeof window !== 'undefined' ? window : globalThis);
