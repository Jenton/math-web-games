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

/* ---------- grade-specific rules (grade 3: fractions, tens-times, sums within 1000; grade 4: tenths) ---------- */
{
  const Grades = require('../js/grades.js');
  let gradeRules = 0;
  const idsAt = (grade) => {
    const seen = {};
    for (let i = 0; i < 600; i++) { const r = MG.makeLevelRule('2-3', 3, null, grade); seen[r.id] = (seen[r.id] || 0) + 1; }
    return seen;
  };
  // every grade, with and without a stretch item: the rule a game would really build is sound (cells agree with check(), wrong ones explain themselves)
  for (let g = 0; g <= 8; g++) {
    for (const stretchShare of [0, 1]) {
      for (let n = 0; n < 120; n++) {
        const c = Grades.cell(g, { stretchShare });
        const rule = MG.makeLevelRule(c.band, c.stars, null, c.grade);
        gradeRules++;
        assert.ok(rule.id in MG.SKILLS, 'unknown skill id ' + rule.id);
        for (let i = 0; i < 12; i++) {
          const good = rule.correct();
          const bad = rule.wrong();
          assert.ok(rule.check(good), `[grade ${g}] ${rule.title}: correct() failed check: ${JSON.stringify(good)}`);
          assert.ok(!rule.check(bad), `[grade ${g}] ${rule.title}: wrong() passed check: ${JSON.stringify(bad)}`);
          const text = rule.why(bad) + ' ' + rule.ok(good) + ' ' + good.label + ' ' + bad.label;
          assert.ok(!/NaN|undefined|\[object/.test(text), 'bad text for ' + rule.title + ': ' + text);
          assert.ok(!/exactly [0-9/]+ than/.test(text), 'garbled sentence: ' + text);
        }
        const want = [8, 10, 12][c.stars - 1];
        const board = MG.buildBoard(rule, 30, want);
        assert.strictEqual(board.length, 30);
        assert.strictEqual(board.filter((x) => x.correct).length, want, rule.title + ': wrong number of correct cells');
      }
    }
  }
  // grade 3 meets what its standards name (fractions 3.NF.A.3, tens-times 3.NBT.A.3, sums within 1000 3.NBT.A.2), and grade 4 meets tenths (4.NF.C.5, C.6)
  const g3 = idsAt(3);
  for (const id of ['fractions3', 'tens', 'sums1000', 'multiples', 'rounding', 'expressions', 'compare']) assert.ok(g3[id] > 20, 'grade 3 builds ' + id + ': ' + JSON.stringify(g3));
  assert.ok(idsAt(4).tenths > 20, 'grade 4 builds tenths');
  for (const g of [0, 1, 2, 5, 6, 7, 8]) assert.ok(!idsAt(g).tenths && !idsAt(g).tens && !idsAt(g).sums1000, 'grade ' + g + ' does not get the grade 3 and 4 extras');
  assert.ok(MG.GRADE_EXTRA[3].length === 4 && MG.GRADE_EXTRA[4].length === 3);
  for (const g of [3, 4]) for (const mk of MG.GRADE_EXTRA[g]) assert.ok(mk(1).tags.length > 0, 'extra rules are tagged with their standards');

  // grade 3 fractions use only the denominators the standard allows (2, 3, 4, 6, 8), and "equal to" cells really are equal
  for (let n = 0; n < 300; n++) {
    for (const mk of [MG.GRADE_EXTRA[3][0], MG.GRADE_EXTRA[3][1]]) {
      const rule = mk(1 + (n % 3));
      for (let i = 0; i < 10; i++) for (const cell of [rule.correct(), rule.wrong()]) assert.ok([2, 3, 4, 6, 8].includes(cell.den), 'denominator ' + cell.den);
    }
    const eq = MG.GRADE_EXTRA[3][0](1 + (n % 3));
    const [p, q] = eq.title.replace('Eat the fractions equal to ', '').split('/').map(Number);
    for (let i = 0; i < 10; i++) { const c = eq.correct(); assert.strictEqual(c.num * q, p * c.den, c.label + ' equals ' + p + '/' + q); const w = eq.wrong(); assert.notStrictEqual(w.num * q, p * w.den); }
  }
  // the explanations teach the idea: a common denominator, half of the bottom, tens, hundredths
  const sample = (mk, stars, test) => { for (let i = 0; i < 400; i++) { const r = mk(stars); const w = r.wrong(); const t = r.why(w); if (test(r, w, t)) return t; } return null; };
  assert.ok(sample(MG.GRADE_EXTRA[3][0], 1, (r, w, t) => /^\d+\/\d+ = \d+\/\d+ and \d+\/\d+ = \d+\/\d+, so .* is (bigger|smaller), not equal\.$/.test(t)), 'equal-fraction explanation uses a common denominator');
  assert.ok(sample(MG.GRADE_EXTRA[3][1], 3, (r, w, t) => /exactly 1\/2, not (bigger|smaller) than it\.$/.test(t)), 'the exactly-a-half trap exists at 3 stars and reads correctly');
  assert.ok(sample(MG.GRADE_EXTRA[3][2], 2, (r, w, t) => /tens = \d+ tens = \d+, not \d+\.$/.test(t) || /^\d+ tens = \d+, not \d+\.$/.test(t)), 'tens-times explanation talks in tens');
  assert.ok(sample(MG.GRADE_EXTRA[4][0], 3, (r, w, t) => /hundredths, but \d\/10 is \d0 hundredths \(0\.\d\)\.$/.test(t)), 'tenths explanation counts hundredths');
  console.log('OK: ' + gradeRules + ' grade rule instances verified (grades K to 8, with and without a stretch item); grade 3 and 4 extras, denominators, explanations.');
}
console.log(`OK: ${rulesSeen} rule instances verified across all bands and star levels.`);
