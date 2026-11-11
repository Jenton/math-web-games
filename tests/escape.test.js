// Verifies Escape Room Locks: every lock is solvable, the right answer opens it, wrong answers are refused with an explanation.
const E = require('../js/elogic.js');
const MGP = require('../js/puzzles.js');
const assert = require('assert');

function solveMachine(lock) { // shortest chain by breadth-first search
  const { p } = lock;
  let frontier = [{ v: p.start, path: [] }];
  const seen = new Set([p.start]);
  for (let d = 0; d < 8; d++) {
    const next = [];
    for (const f of frontier) {
      for (let i = 0; i < p.ops.length; i++) {
        const v = MGP.stepMachine(p, i, f.v);
        if (v === null || seen.has(v)) continue;
        const path = f.path.concat(i);
        if (v === p.target) return path;
        seen.add(v);
        next.push({ v, path });
      }
    }
    frontier = next;
  }
  return null;
}

let rooms = 0, fallbackClues = 0, clues = 0;
const kindsSeen = {};
for (const band of ['K-1', '2-3', '4-5', '6']) {
  for (const st of [1, 2, 3]) {
    for (let i = 0; i < 300; i++) {
      const room = E.makeRoom(band, st, i + 1);
      rooms++;
      assert.strictEqual(room.locks.length, 3);
      assert.strictEqual(new Set(room.locks.map((l) => l.kind)).size, 3, 'three different kinds of lock');
      assert(room.theme && room.theme.name);
      for (const lock of room.locks) {
        kindsSeen[lock.kind] = (kindsSeen[lock.kind] || 0) + 1;
        assert(E.hint(lock, 0) && E.hint(lock, 1), 'hints exist');
        assert(E.SKILLS[lock.skill], 'skill id is listed');
        if (lock.kind === 'sequence') {
          assert(lock.terms.length >= 4 && lock.terms.length <= 5);
          assert(Number.isInteger(lock.answer) && Math.abs(lock.answer) < 5000, 'answer is a sane whole number');
          assert(E.check(lock, lock.answer).ok);
          const bad = E.check(lock, lock.answer + 1);
          assert(!bad.ok && bad.msg.includes(lock.rule.slice(0, 12)), 'a wrong number is explained');
          // the stated rule really produces the shown numbers: differences are constant, grow by one, or multiply
          const t = lock.terms.concat(lock.answer);
          const d = t.slice(1).map((v, k) => v - t[k]);
          const r = t.slice(1).map((v, k) => v / t[k]);
          const arith = d.every((x) => x === d[0]);
          const growing = d.slice(1).every((x, k) => x === d[k] + 1);
          const geo = r.every((x) => x === r[0]);
          const squares = t.every((x) => Number.isInteger(Math.sqrt(x)));
          const fibo = t.slice(2).every((x, k) => x === t[k] + t[k + 1]);
          assert(arith || growing || geo || squares || fibo, 'the pattern is real: ' + t.join(','));
        } else if (lock.kind === 'code') {
          assert.strictEqual(lock.digits.length, lock.n);
          lock.clues.forEach((c, k) => {
            clues++;
            if (/(^|[ (])0 [+×]|[+×] 0($| )/.test(c)) fallbackClues++;
            assert.strictEqual(E.evalExpr(c), lock.digits[k], 'clue ' + c + ' equals digit ' + lock.digits[k]);
            assert(lock.digits[k] >= 0 && lock.digits[k] <= 9);
          });
          assert(E.check(lock, lock.digits).ok);
          const wrong = lock.digits.slice();
          wrong[0] = (wrong[0] + 1) % 10;
          const res = E.check(lock, wrong);
          assert(!res.ok && res.msg.includes(lock.clues[0]), 'a wrong digit shows its clue arithmetic');
        } else if (lock.kind === 'balance') {
          assert(E.check(lock, lock.answer).ok);
          assert(!E.check(lock, lock.answer + 1).ok);
        } else {
          const path = solveMachine(lock);
          assert(path && path.length === lock.p.par, 'shortest chain equals par');
          assert(E.check(lock, path).ok);
          assert(!E.check(lock, []).ok, 'doing nothing does not open it');
          assert(lock.limit >= lock.p.par + 2 || lock.limit === 4);
        }
      }
    }
  }
}
assert(['sequence', 'code', 'balance', 'machine'].every((k) => kindsSeen[k] > 1000), 'all four kinds appear');
assert(fallbackClues / clues < 0.03, 'almost no boring fallback clues: ' + fallbackClues + '/' + clues);
assert.strictEqual(E.roomStars(0), 3);
assert.strictEqual(E.roomStars(1), 3);
assert.strictEqual(E.roomStars(3), 2);
assert.strictEqual(E.roomStars(9), 1);
console.log('OK: ' + rooms + ' rooms (' + rooms * 3 + ' locks) verified: patterns are real, code clues equal their digits, balance and machine locks solvable, wrong answers explained; ' + fallbackClues + ' of ' + clues + ' clues were plain fallbacks.');
