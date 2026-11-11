// Verifies Number Line Runner: every run is well formed, the spot is never labeled when it should be read from ticks,
// the written target really equals the tick, and a wrong landing is explained with its distance in ticks.
const R = require('../js/runlogic.js');
const assert = require('assert');

function parse(txt) { // "1 1/2", "3/4", "0.75", "75%", "−3"  ->  numerator over D (we compare as exact rationals via common scale)
  const t = txt.replace('−', '-');
  if (t.endsWith('%')) return { n: parseInt(t, 10), d: 100 };
  if (t.includes('.')) { const places = t.split('.')[1].length; return { n: Math.round(parseFloat(t) * Math.pow(10, places)), d: Math.pow(10, places) }; }
  const m = t.match(/^(-?)(?:(\d+) )?(\d+)\/(\d+)$/);
  if (m) { const w = m[2] ? parseInt(m[2], 10) : 0; const n = w * parseInt(m[4], 10) + parseInt(m[3], 10); return { n: m[1] ? -n : n, d: parseInt(m[4], 10) }; }
  return { n: parseInt(t, 10), d: 1 };
}
const eq = (p, a, D) => p.n * D === a * p.d; // p == a/D

let runs = 0, landTotal = 0, landLabeled = 0, forms = {};
for (const band of ['K-1', '2-3', '4-5', '6']) {
  for (const st of [1, 2, 3]) {
    for (let i = 0; i < 300; i++) {
      const run = R.makeRun(band, st);
      runs++;
      const { line, checkpoints } = run;
      assert.strictEqual(checkpoints.length, 4);
      assert(run.ticks >= 9 && run.ticks <= 21, 'a line that fits a phone: ' + run.ticks + ' ticks');
      assert.strictEqual(checkpoints[0].kind, 'land', 'the first checkpoint is a plain landing');
      checkpoints.forEach((cp, k) => {
        assert(cp.target >= 0 && cp.target < run.ticks && cp.target !== cp.from, 'target is on the line and a real move');
        if (k > 0) assert.strictEqual(cp.from, checkpoints[k - 1].target, 'the hero starts each leg where the last one ended');
        assert.strictEqual(cp.targetValue, R.valueAt(line, cp.target));
        // the sign text really says the target value
        if (cp.kind === 'land') {
          const body = cp.text.replace('Land on ', '');
          forms[cp.form] = (forms[cp.form] || 0) + 1;
          if (cp.form === 'expr') {
            const m = body.match(/^(\d+) × (\d+)$/);
            assert(m && parseInt(m[1], 10) * parseInt(m[2], 10) * line.D === cp.targetValue, 'expression equals the target: ' + cp.text);
          } else {
            assert(eq(parse(body), cp.targetValue, line.D), cp.text + ' equals tick value ' + cp.targetValue + '/' + line.D);
          }
          landTotal++;
          if (R.labelOf(line, cp.target)) landLabeled++;
        } else {
          const m = cp.text.match(/^Hop (.+) to the (right|left)$/);
          assert(m, cp.text);
          const hop = parse(m[1]);
          assert(eq(hop, Math.abs(cp.targetValue - cp.fromValue), line.D), 'hop distance matches: ' + cp.text);
          assert.strictEqual(m[2], cp.targetValue > cp.fromValue ? 'right' : 'left');
        }
        // right landing opens, every other tick is refused with the distance in ticks
        assert(R.check(run, k, cp.target).ok);
        for (let t = 0; t < run.ticks; t++) {
          if (t === cp.target) continue;
          const r = R.check(run, k, t);
          assert(!r.ok && r.gap === cp.target - t);
          assert(r.msg.includes('You landed on ' + R.writeValue(line, R.valueAt(line, t), line.modes[0])), 'names where you landed');
          assert(r.msg.includes(Math.abs(r.gap) + (Math.abs(r.gap) === 1 ? ' tick' : ' ticks')), 'says how many ticks off');
          assert(r.msg.includes(r.gap > 0 ? 'right' : 'left'), 'says which way');
        }
        assert(R.hint(run, k, 0) && R.hint(run, k, 1));
      });
    }
  }
}
// lines with unlabeled ticks: the spot to land on is read from the ticks, not from a printed label
assert(landLabeled / landTotal < 0.3, 'most landing spots are unlabeled ticks (' + landLabeled + '/' + landTotal + ' labeled; the K-1 starter line labels every tick on purpose)');
['expr', 'dec', 'pct', 'frac', 'int'].forEach((f) => assert(forms[f] > 0, 'form appears: ' + f));
assert.strictEqual(R.runStars(0), 3);
assert.strictEqual(R.runStars(1), 3);
assert.strictEqual(R.runStars(3), 2);
assert.strictEqual(R.runStars(8), 1);
assert.strictEqual(R.fmtValue(3, 4, 'frac'), '3/4');
assert.strictEqual(R.fmtValue(-3, 4, 'frac'), '−3/4');
assert.strictEqual(R.fmtValue(6, 4, 'frac'), '1 1/2');
assert.strictEqual(R.fmtValue(3, 4, 'dec'), '0.75');
assert.strictEqual(R.fmtValue(3, 4, 'pct'), '75%');
console.log('OK: ' + runs + ' runs verified (' + runs * 4 + ' checkpoints): written targets equal their ticks, every wrong tick is refused with distance and direction, hops add up, all forms (whole, fraction, mixed, decimal, percent, expression) appear.');
