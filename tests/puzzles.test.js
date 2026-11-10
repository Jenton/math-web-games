// Run with: node tests/puzzles.test.js
const assert = require('assert');
const P = require('../js/puzzles.js');
const MG = require('../js/engine.js');
let n = 0;
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 300; i++) {
      // Balance: solution balances, it is an integer in the stepper range, and it is unique
      const b = P.makeBalance(band, stars);
      assert.ok(b.L.c >= 0 && b.R.c >= 0 && b.L.x >= 0 && b.R.x >= 0 && b.L.x !== b.R.x, 'bad sides ' + b.text);
      assert.ok(Number.isInteger(b.x) && b.x >= 1 && b.x <= b.max);
      assert.ok(P.checkBalance(b, b.x).balanced, 'solution must balance: ' + b.text);
      for (let v = 0; v <= b.max; v++) if (v !== b.x) {
        const c = P.checkBalance(b, v);
        assert.ok(!c.balanced, `non-unique: ${b.text} v=${v}`);
        const next = c.tooBig ? v - 1 : v + 1; // hint direction moves toward solution
        assert.ok(Math.abs(next - b.x) < Math.abs(v - b.x), `wrong hint direction ${b.text} v=${v}`);
      }
      assert.ok(!/NaN|undefined/.test(b.text));
      // Machine: par is reachable and optimal (brute force), target != start
      const m = P.makeMachine(band, stars);
      assert.notStrictEqual(m.start, m.target);
      let level = new Set([m.start]);
      let found = -1;
      for (let d = 1; d <= m.par && found < 0; d++) {
        const nx = new Set();
        level.forEach((v) => m.ops.forEach((_, k) => { const r = P.stepMachine(m, k, v); if (r !== null) nx.add(r); }));
        if (nx.has(m.target)) found = d;
        level = nx;
      }
      assert.strictEqual(found, m.par, `par ${m.par} not optimal/reachable (found ${found})`);
      assert.ok(m.par >= 1 && m.ops.length >= 3);
      n++;
    }
  }
}
console.log('OK: ' + n + ' Balance + Machine puzzles verified (solutions unique, hints point the right way, par optimal).');
