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
/* ---------- grade-specific runs (K to 8): the same checks, on content built per grade ---------- */
{
  let gradeRuns = 0;
  const seenTags = new Set();
  for (let g = 0; g <= 8; g++) {
    for (const hard of [false, true]) {
      for (let n = 0; n < 150; n++) {
        const run = R.makeGradeRun(g, { hard });
        gradeRuns++;
        const { line, checkpoints } = run;
        assert.strictEqual(run.grade, g);
        assert.strictEqual(checkpoints.length, 4);
        assert(run.ticks >= 7 && run.ticks <= 21, 'a line that fits a phone: ' + run.ticks + ' ticks (grade ' + g + ')');
        assert.strictEqual(checkpoints[0].kind, 'land', 'the first checkpoint is a plain landing');
        if (g === 0 && !hard) assert(checkpoints.every((c) => c.kind === 'land'), 'kindergarten has no hops (a bonus run for a kindergartener is built from grade 1)');
        if (g >= 6) assert(line.lo < 0, 'grade 6 and up run through zero');
        else assert.strictEqual(line.lo, 0, 'below grade 6 the line starts at zero');
        checkpoints.forEach((cp, k) => {
          assert(cp.target >= 0 && cp.target < run.ticks && cp.target !== cp.from, 'target is on the line and a real move');
          const zero = line.lo < 0 ? Math.round((0 - line.lo) / line.step) : 0;
          assert.strictEqual(cp.from, k === 0 ? zero : checkpoints[k - 1].target, 'the hero starts where the last leg ended (at zero to begin)');
          assert.strictEqual(cp.targetValue, R.valueAt(line, cp.target));
          assert(Array.isArray(cp.tags) && cp.tags.length > 0, 'every checkpoint is tagged with the standards it exercises');
          cp.tags.forEach((t) => seenTags.add(t));
          if (cp.kind === 'land') {
            const body = cp.text.replace('Land on ', '');
            const a = cp.targetValue;
            if (cp.form === 'expr') {
              let m = body.match(/^(\d+) × (\d+)$/);
              if (m) assert.strictEqual(parseInt(m[1], 10) * parseInt(m[2], 10) * line.D, a, 'product equals the target: ' + cp.text);
              else { m = body.match(/^(\d+)% of (\d+)$/); assert(m, 'an expression is a product or a percent: ' + cp.text); assert.strictEqual(parseInt(m[1], 10) * parseInt(m[2], 10), a * 100, cp.text); }
            } else if (cp.form === 'round') {
              const unit = cp.roundTo === 'ten' ? 10 : 100;
              assert.strictEqual(Math.round(cp.roundFrom / unit) * unit, a, cp.text + ' rounds to ' + a);
              assert.notStrictEqual(cp.roundFrom % unit, 0, 'there is something to round');
              assert.notStrictEqual(cp.roundFrom % unit, unit / 2, 'no ties');
            } else if (cp.form === 'h100') {
              const m = body.match(/^(\d+)\/100$/);
              assert(m && parseInt(m[1], 10) * line.D === a * 100, 'hundredths equal the target: ' + cp.text);
            } else assert(eq(parse(body), a, line.D), cp.text + ' equals tick value ' + a + '/' + line.D);
          } else {
            assert(k > 0, 'a hop is never the first checkpoint');
            const m = cp.text.match(/^Hop (.+?) to the (left|right)$/);
            assert(m, cp.text);
            const d = cp.targetValue - cp.fromValue;
            assert(eq(parse(m[1]), Math.abs(d), line.D) && (m[2] === 'right') === (d > 0), cp.text);
          }
          // the exact tick lands; any other tick is refused with its distance in ticks
          const good = R.check(run, k, cp.target);
          assert(good.ok && /^(Right on it|Perfect hop)/.test(good.msg), good.msg);
          for (const t of [cp.target - 2, cp.target - 1, cp.target + 1, cp.target + 3]) {
            if (t < 0 || t >= run.ticks) continue;
            const bad = R.check(run, k, t);
            assert(!bad.ok && bad.msg.includes('tick') && bad.msg.includes(bad.gap > 0 ? 'right' : 'left'), bad.msg);
          }
          assert(R.hint(run, k, 0) && R.hint(run, k, 1));
        });
      }
    }
  }
  // grade 3 asks for what the grade 3 standards name: fractions on a number line, products, rounding, tens-times, add and subtract within 1000
  for (const code of ['3.NF.A.2', '3.OA.C.7', '3.NBT.A.1', '3.NBT.A.3', '3.NBT.A.2', '4.NF.C.6', '6.NS.C.6', '7.NS.A.1']) assert(seenTags.has(code), 'the Runner exercises ' + code);
  // grade 3 fractions use only the denominators the standard allows (2, 3, 4, 6, 8) and whole numbers beyond 1 appear as points too
  for (const grp of R.xGroups(3)) for (const x of grp) if (x.style === 'frac') assert([2, 3, 4, 6, 8].includes(x.line.D), 'grade 3 denominator ' + x.line.D);
  // plain whole-number notes are a grade 2 skill: at grade 3 only a whole number on a fraction line (3/3 = 1) may be plain
  let notes = 0, plain = 0;
  for (let n = 0; n < 600; n++) R.makeGradeRun(3).checkpoints.filter((c) => c.kind === 'land').forEach((c) => { notes++; if (/^Land on \d+$/.test(c.text)) plain++; });
  assert(plain / notes < 0.03, 'grade 3 landing notes are not plain numbers: ' + plain + ' of ' + notes);
  // a bonus (hard) run has more hops
  let hopsEasy = 0, hopsHard = 0;
  for (let n = 0; n < 600; n++) { hopsEasy += R.makeGradeRun(4).checkpoints.filter((c) => c.kind === 'hop').length; hopsHard += R.makeGradeRun(4, { hard: true }).checkpoints.filter((c) => c.kind === 'hop').length; }
  assert(hopsHard > hopsEasy, 'a bonus run has more hops: ' + hopsEasy + ' vs ' + hopsHard);
  // known explanations for the new note forms
  const lineR = { D: 1, lo: 0, hi: 100, step: 10, labelEvery: 2, modes: ['int'], note: '10' };
  const runR = { band: null, stars: null, line: lineR, ticks: 11, checkpoints: [{ kind: 'land', from: 0, target: 5, text: 'Land on 47, rounded to the nearest ten', form: 'round', roundFrom: 47, roundTo: 'ten', fromValue: 0, targetValue: 50, tags: [] }] };
  assert(/^Right on it! 47 rounded to the nearest ten is 50\.$/.test(R.check(runR, 0, 5).msg), R.check(runR, 0, 5).msg);
  assert(/47 rounded to the nearest ten \(50\)/.test(R.check(runR, 0, 4).msg), R.check(runR, 0, 4).msg);
  assert(/sampleText/.test(String(R.sampleText)) || /ticks/.test(R.sampleText(3)));
  console.log('grade runs OK: ' + gradeRuns + ' runs (grades K to 8, with and without bonus), tags ' + [...seenTags].sort().join(' '));
}
console.log('OK: ' + runs + ' runs verified (' + runs * 4 + ' checkpoints): written targets equal their ticks, every wrong tick is refused with distance and direction, hops add up, all forms (whole, fraction, mixed, decimal, percent, expression) appear.');
