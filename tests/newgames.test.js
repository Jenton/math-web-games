// Run with: node tests/newgames.test.js
const assert = require('assert');
const MG = require('../js/engine.js');
const P = require('../js/puzzles.js');
const S = require('../js/sortrule.js');
const C = require('../js/cutshare.js');
let n = 0;
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 300; i++) {
      // ---- Balance worked solution is consistent ----
      const b = P.makeBalance(band, stars);
      const steps = P.balanceSteps(b);
      assert.ok(steps.length >= 2 && steps[steps.length - 1] === 'So one ? weighs ' + b.x + '.', 'steps end: ' + b.text);
      assert.ok(!/NaN|undefined|-\d/.test(steps.join(' ')), 'bad steps ' + steps.join(' | '));

      // ---- Sort & Rule: exactly one option fits the whole tray ----
      const s = S.makeSort(band, stars);
      assert.strictEqual(s.options.length, 4);
      assert.strictEqual(new Set(s.options.map((o) => o.text)).size, 4, 'duplicate option text');
      const truthVec = s.tray.map((x) => S.gate(s, x)).join();
      const fits = s.options.filter((o) => s.tray.map((x) => !!o.f(x)).join() === truthVec);
      assert.strictEqual(fits.length, 1, 'ambiguous: ' + s.options.map((o) => o.text).join(' / '));
      assert.strictEqual(s.options[s.correct], fits[0]);
      const pass = s.tray.filter((x) => S.gate(s, x)).length;
      assert.ok(pass >= 4 && s.tray.length - pass >= 4, 'unbalanced tray');
      assert.strictEqual(new Set(s.tray).size, s.tray.length);
      s.options.forEach((o, k) => {
        if (k === s.correct) return;
        const msg = S.explainWrong(s, k, s.tray.slice(0, 3));
        assert.ok(msg.length > 10 && !/undefined|NaN/.test(msg), msg);
      });

      // ---- Cut & Share: par is minimal and valid; wrong answers are really wrong ----
      const c = C.makeShare(band, stars);
      assert.ok(c.par >= 2 && c.par <= 12);
      const e = C.eachGets(c);
      const total = (c.P * c.par) / c.Q;
      assert.ok(C.checkShare(c, c.par, total / c.F).ok, 'par must work: ' + c.text);
      for (let k = 1; k < c.par; k++) {
        for (let sl = 1; sl <= 40; sl++) assert.ok(!C.checkShare(c, k, sl).ok, `smaller cut works: ${c.text} c=${k}`);
      }
      for (let k = 1; k <= C.MAX_CUTS; k++) {
        for (let sl = 1; sl <= 40; sl++) {
          const r = C.checkShare(c, k, sl);
          assert.ok(!/NaN|undefined/.test(r.msg), r.msg);
          // ok exactly when each friend gets the true share s/k = n/d
          assert.strictEqual(r.ok, sl * e.d === k * e.n, `ok mismatch ${c.text} c=${k} s=${sl}`);
        }
      }
      assert.ok(!/NaN|undefined/.test(C.solution(c)));
      n++;
    }
  }
}
console.log('OK: ' + n + ' rounds of Balance steps, Sort & Rule (one fitting rule) and Cut & Share (par minimal) verified.');
