// Run with: node tests/engine.test.js
// Checks that every rule at every band/star level generates correct/wrong cells
// that agree with its own check(), and that boards have the right shape.
const assert = require('assert');
const MG = require('../js/engine.js');

let rulesSeen = 0;
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let iter = 0; iter < 150; iter++) {
      const rule = MG.makeLevelRule(band, stars, null);
      rulesSeen++;
      assert.ok(rule.id in MG.SKILLS, `unknown skill id ${rule.id}`);
      assert.ok(rule.title && rule.hint, 'rule needs title and hint');
      for (let i = 0; i < 20; i++) {
        const c = rule.correct();
        assert.ok(rule.check(c), `[${band} s${stars} ${rule.title}] correct() cell failed check: ${JSON.stringify(c)}`);
        assert.ok(rule.ok(c).length > 0);
        const w = rule.wrong();
        assert.ok(!rule.check(w), `[${band} s${stars} ${rule.title}] wrong() cell passed check: ${JSON.stringify(w)}`);
        assert.ok(rule.why(w).length > 0);
        assert.ok(!/NaN|undefined/.test(rule.why(w) + rule.ok(c) + c.label + w.label), 'bad text for ' + rule.title);
      }
      const want = [8, 10, 12][stars - 1];
      const board = MG.buildBoard(rule, 30, want);
      assert.strictEqual(board.length, 30);
      assert.strictEqual(board.filter((c) => c.correct).length, want, `${rule.title}: wrong number of correct cells`);
    }
  }
}

// Greater / less than: more stars means cards that sit closer to the target (and the target itself as a trap), never the same difficulty at every level.
{
  const meanGap = (band, stars) => {
    let sum = 0, n = 0, traps = 0;
    for (let i = 0; i < 400; i++) {
      let r;
      do r = MG.makeLevelRule(band, stars, null); while (r.id !== 'compare');
      const N = Number(r.title.replace(/.*than /, '').replace('\u2212', '-'));
      for (let k = 0; k < 6; k++) {
        const c = k < 2 ? r.correct() : r.wrong();
        assert.strictEqual(!!r.check(c), k < 2, band + ' ' + stars + ' ' + r.title + ' card ' + c.label);
        sum += Math.abs(c.value - N); n++;
        if (c.value === N) traps++;
      }
    }
    return { gap: sum / n, traps: traps / n };
  };
  for (const band of ['K-1', '2-3', '6']) {
    const g = [1, 2, 3].map((s) => meanGap(band, s));
    assert.ok(g[0].gap > g[1].gap && g[1].gap > g[2].gap, `${band}: cards get closer to the target as stars go up (${g.map((x) => x.gap.toFixed(1))})`);
    assert.ok(g[2].gap <= 5, `${band} 3 stars: every card is within 5 of the target`);
    assert.ok(g[2].traps > g[0].traps, `${band}: the "equal to the target" trap shows up more at 3 stars`);
  }
  // grade 2-3 uses bigger numbers than K-1
  let big = 0;
  for (let i = 0; i < 100; i++) { let r; do r = MG.makeLevelRule('2-3', 3, null); while (r.id !== 'compare'); big = Math.max(big, r.correct().value); }
  assert.ok(big >= 100, 'grade 2-3 at 3 stars compares three-digit numbers');
}
console.log(`OK: ${rulesSeen} rule instances verified across all bands and star levels.`);
