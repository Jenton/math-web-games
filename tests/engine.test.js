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
console.log(`OK: ${rulesSeen} rule instances verified across all bands and star levels.`);
