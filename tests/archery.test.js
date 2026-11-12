// Verifies Arrow Range on GRADES (K = 0 to 8): every round is well formed, the written note really equals the target tick (fractions, products, rounding,
// percent of, tenths), a wrong shot is explained in ticks, wind and height-difference arithmetic is right, the scoring board is always solvable, the
// stretch items (next grade up) behave as designed, and the visual arc always ends exactly on the chosen spot.
const A = require('../js/archerylogic.js');
const R = require('../js/runlogic.js');
const assert = require('assert');

function parse(txt) { // "1 1/2", "3/4", "0.75", "75%", "−3"  ->  { n, d }
  const t = txt.replace('−', '-');
  if (t.endsWith('%')) return { n: parseInt(t, 10), d: 100 };
  if (t.includes('.')) { const places = t.split('.')[1].length; return { n: Math.round(parseFloat(t) * Math.pow(10, places)), d: Math.pow(10, places) }; }
  const m = t.match(/^(-?)(?:(\d+) )?(\d+)\/(\d+)$/);
  if (m) { const w = m[2] ? parseInt(m[2], 10) : 0; const n = w * parseInt(m[4], 10) + parseInt(m[3], 10); return { n: m[1] ? -n : n, d: parseInt(m[4], 10) }; }
  return { n: parseInt(t, 10), d: 1 };
}
const eq = (p, a, D) => p.n * D === a * p.d; // p == a/D
const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let rounds = 0, wrongChecked = 0, unlabeledTargets = 0, targets = 0;
const kindsSeen = {};
const styles = {};
for (const g of GRADES) {
  for (const share of [0, 1, undefined]) {
    const seenHere = new Set();
    for (let n = 0; n < 120; n++) {
      const round = A.makeRound(g, share === undefined ? {} : { stretchShare: share });
      rounds++;
      const { xLine, yLine, shots, board } = round;
      styles[round.style] = (styles[round.style] || 0) + 1;
      assert.strictEqual(round.grade, g);
      assert.strictEqual(shots.length, 4);
      assert.strictEqual(shots[0].kind, 'dist', 'the first shot of a round is a plain distance');
      assert.strictEqual(shots[0].stretch, false, 'the first shot is always on-grade (a warm-up)');
      assert(round.ticksX >= 7 && round.ticksX <= 21, 'distance ruler fits a phone: ' + round.ticksX);
      if (yLine) assert(round.ticksY >= 6 && round.ticksY <= A.MAX_Y_TICKS, 'height ruler fits a phone: ' + round.ticksY);
      else assert(!shots.some((s) => A.Y_KINDS.includes(s.kind)), 'no height shots without a height ruler');

      // stretch: never with share 0; always (below the top grade) with share 1; never at the top grade
      shots.slice(1).forEach((s) => {
        if (share === 0 || g >= A.TOP_GRADE) assert.strictEqual(s.stretch, false, 'no stretch: grade ' + g + ' share ' + share);
        if (share === 1 && g < A.TOP_GRADE) assert.strictEqual(s.stretch, true, 'all stretch: grade ' + g);
        assert.strictEqual(s.grade, s.stretch ? g + 1 : g, 'a stretch item is drawn from the next grade up');
      });
      if (share === 0 || g >= A.TOP_GRADE) assert.strictEqual(board.stretch, false);
      if (share === 1 && g < A.TOP_GRADE) assert.strictEqual(board.stretch, true);
      assert.strictEqual(board.grade, board.stretch ? g + 1 : g);

      shots.forEach((s, i) => {
        seenHere.add(s.kind);
        kindsSeen[s.kind] = (kindsSeen[s.kind] || 0) + 1;
        const allowed = A.poolFor(g).concat(s.stretch ? A.poolFor(Math.min(8, g + 1)) : [], ['dist']);
        assert(allowed.includes(s.kind), 'grade ' + g + ' unexpected kind ' + s.kind);
        assert(Array.isArray(s.tags), 'every item is tagged with the standards it exercises');
        if (A.X_KINDS.includes(s.kind)) {
          assert(s.tx >= 1 && s.tx < round.ticksX, 'target across is on the ruler and not at the archer');
          targets++;
          if (!R.labelOf(xLine, s.tx)) unlabeledTargets++;
          const a = R.valueAt(xLine, s.tx);
          if (s.kind === 'dist') {
            const body = s.text.replace('Shoot to ', '');
            if (s.form === 'expr') {
              let m = body.match(/^(\d+) × (\d+)$/);
              if (m) assert.strictEqual(parseInt(m[1], 10) * parseInt(m[2], 10) * xLine.D, a, 'product equals the target: ' + s.text);
              else {
                m = body.match(/^(\d+)% of (\d+)$/);
                assert(m, 'an expression note is a product or a percent: ' + s.text);
                assert.strictEqual(parseInt(m[1], 10) * parseInt(m[2], 10), a * 100, 'percent of equals the target: ' + s.text);
              }
            } else if (s.form === 'round') {
              const unit = s.roundTo === 'ten' ? 10 : 100;
              assert(s.roundTo === 'ten' || s.roundTo === 'hundred');
              assert.strictEqual(Math.round(s.roundFrom / unit) * unit, a, s.text + ' rounds to ' + a);
              assert.notStrictEqual(s.roundFrom % unit, 0, 'there is something to round');
              assert.notStrictEqual(s.roundFrom % unit, unit / 2, 'no ties in rounding');
              assert.strictEqual(body, s.roundFrom + ', rounded to the nearest ' + s.roundTo);
            } else if (s.form === 'h100') {
              const m = body.match(/^(\d+)\/100$/);
              assert(m && parseInt(m[1], 10) * xLine.D === a * 100, 'hundredths note equals the target: ' + s.text);
            } else assert(eq(parse(body), a, xLine.D), s.text + ' equals tick value ' + a + '/' + xLine.D);
          }
          if (s.kind === 'hop') {
            assert(i > 0 && s.at === shots[i - 1].tx, 'a hop starts where the last arrow landed');
            assert(s.tx !== s.at, 'a hop is a real move');
            const m = s.text.match(/^Shoot (.+?) (further|shorter) than your last arrow$/);
            assert(m, s.text);
            const d = R.valueAt(xLine, s.tx) - R.valueAt(xLine, s.at);
            assert(eq(parse(m[1]), Math.abs(d), xLine.D) && (m[2] === 'further') === (d > 0), s.text);
          }
          if (s.kind === 'wind') {
            assert(s.wind !== 0 && s.tx - s.wind >= 1 && s.tx - s.wind < round.ticksX, 'the aim tick for a wind shot is on the ruler');
            assert.strictEqual(A.aimFor(s).x + s.wind, s.tx, 'aim + wind = target');
            assert(Math.abs(s.wind) <= (g <= 2 ? 2 : 3) + 1, 'wind stays small');
          }
        }
        if (A.Y_KINDS.includes(s.kind)) {
          assert(s.ty >= 0 && s.ty < round.ticksY, 'target height is on the ruler');
          const a = R.valueAt(yLine, s.ty);
          if (s.kind === 'height') assert(eq(parse(s.text.replace('The target is at height ', '')), a, yLine.D), s.text);
          if (s.kind === 'lift') {
            assert(s.platform !== s.ty && Math.abs(s.platform - s.ty) >= 2, 'lift needs a real difference');
            assert(s.platform >= 1 && s.platform <= Math.floor(0.7 * (round.ticksY - 1)), 'the platform leaves headroom for the archer: ' + s.platform + ' of ' + round.ticksY);
            if (s.grade < 5 && !s.stretch) assert(Math.abs(s.platform - s.ty) <= 4, 'gentle height differences below grade 5');
            const m = s.text.match(/^You stand at height (.+?)\. The target is (.+?) (above|below) you\.$/);
            assert(m, s.text);
            const p = R.valueAt(yLine, s.platform);
            assert(eq(parse(m[1]), p, yLine.D), 'platform in the note: ' + s.text);
            const d = parse(m[2]);
            assert(eq({ n: d.n * (m[3] === 'above' ? 1 : -1), d: d.d }, a - p, yLine.D), 'platform plus the difference equals the target: ' + s.text);
          }
          if (s.kind === 'coord') {
            const m = s.text.match(/^Across (.+?), (?:up|height) (.+)$/);
            assert(m, s.text);
            assert(eq(parse(m[1]), R.valueAt(xLine, s.tx), xLine.D) && eq(parse(m[2]), a, yLine.D), 'coordinates in the note: ' + s.text);
          }
        }
        // the exact aim is a hit, and every other nearby aim is a miss that explains itself
        const aim = A.aimFor(s);
        const good = A.check(round, i, aim);
        assert(good.ok && /^Bullseye!/.test(good.msg), 'the right aim hits: ' + good.msg);
        const wrongs = [];
        if (A.X_KINDS.includes(s.kind)) for (const dx of [-3, -1, 1, 2]) if (aim.x + dx >= 0 && aim.x + dx < round.ticksX) wrongs.push({ x: aim.x + dx, y: aim.y });
        if (A.Y_KINDS.includes(s.kind)) for (const dy of [-2, -1, 1, 3]) if (aim.y + dy >= 0 && aim.y + dy < round.ticksY) wrongs.push({ x: aim.x, y: aim.y + dy });
        for (const w of wrongs) {
          const bad = A.check(round, i, w);
          assert(!bad.ok && bad.msg && !/^Bullseye/.test(bad.msg), 'a wrong aim misses');
          const gap = Math.abs(bad.gapX) + Math.abs(bad.gapY);
          assert(gap > 0 && bad.msg.includes('tick'), 'the miss counts ticks: ' + bad.msg);
          if (s.kind === 'wind') assert(/Aim at the target (minus|plus) the wind/.test(bad.msg), 'wind miss shows target minus wind: ' + bad.msg);
          wrongChecked++;
        }
        assert(A.hint(round, i, 0).length > 10 && A.hint(round, i, 1).length > 10, 'hints exist');
      });

      // the scoring board is always solvable and its check is exact
      assert(board.arrows >= 2 && board.rings.length >= 4);
      const sols = A.boardSolutions(board);
      assert(sols.length >= 1, 'the board is solvable');
      assert(sols.some((s) => s.join() === board.solution.join()), 'the stored solution is among the solutions');
      const ok = A.checkBoard(board, board.solution);
      assert(ok.ok && ok.total === board.total && /^Bullseye!/.test(ok.msg), ok.msg);
      const sumOf = (p) => p.reduce((s, i) => s + board.rings[i], 0);
      const all0 = Array(board.arrows).fill(0);
      if (sumOf(all0) !== board.total) {
        const bad = A.checkBoard(board, all0);
        assert(!bad.ok && /short|over/.test(bad.msg), bad.msg);
      }
      assert(board.total > 0);
      if (board.grade >= 6) assert(board.rings.some((v) => v < 0), 'grade 6 and up have a penalty ring');
      assert(A.hintBoard(board, 0).length > 10 && A.hintBoard(board, 1).length > 10);
      assert(sols.length < Math.pow(board.rings.length, board.arrows) / 2, 'a board is not solved by most guesses');
    }
    // with no stretch, every kind in the grade's pool shows up across the rounds
    if (share === 0) for (const kind of A.poolFor(g)) assert(seenHere.has(kind), 'grade ' + g + ' never produced ' + kind);
  }
}
for (const st of ['frac', 'facts', 'big', 'round', 'round100']) assert(styles[st] > 20, 'grade 3 produced the ' + st + ' ruler: ' + JSON.stringify(styles));
for (const st of ['tenths', 'percentOf']) assert(styles[st] > 20, st + ' ruler appears: ' + JSON.stringify(styles));

/* ---------- grade 3 follows the standards it claims ---------- */
{
  const seen = new Set();
  for (let n = 0; n < 400; n++) A.makeRound(3, { stretchShare: 0 }).shots.forEach((s) => s.tags.forEach((t) => seen.add(t)));
  for (const code of ['3.NF.A.2', '3.OA.C.7', '3.NBT.A.1', '3.NBT.A.3']) assert(seen.has(code), 'grade 3 rounds exercise ' + code + ': ' + [...seen]);
  // grade 3 fractions use only the denominators the standard allows: 2, 3, 4, 6, 8
  for (const grp of A.xGroups(3)) for (const x of grp) if (x.style === 'frac') assert([2, 3, 4, 6, 8].includes(x.line.D), 'grade 3 denominator ' + x.line.D);
  // plain "shoot to N" is a grade 2 skill: grade 3 distance notes are fractions, products, rounding or tens-times, with (almost) no plain numbers
  let notes = 0, plain = 0;
  for (let n = 0; n < 600; n++) A.makeRound(3, { stretchShare: 0 }).shots.filter((s) => s.kind === 'dist').forEach((s) => { notes++; if (/^Shoot to \d+$/.test(s.text)) plain++; });
  assert(plain / notes < 0.02, 'grade 3 distance notes are not plain numbers: ' + plain + ' of ' + notes);
}

/* ---------- rulers: sensible for every grade ---------- */
for (const g of GRADES) {
  for (const grp of A.xGroups(g)) for (const x of grp) assert.strictEqual(x.line.lo, 0, 'the distance ruler starts at the archer');
  const yl = A.yLineFor(g);
  if (yl && g >= 6) assert(yl.lo < 0, 'grade 6 and up reach below ground');
  if (yl && g < 6) assert.strictEqual(yl.lo, 0);
}
assert.strictEqual(A.yLineFor(0), null);

/* ---------- known cases: wind, height difference, rounding ---------- */
{
  const xl = { D: 1, lo: 0, hi: 20, step: 1, labelEvery: 5, modes: ['int'], note: '1' };
  const round = { xLine: xl, yLine: null, ticksX: 21, ticksY: 0, shots: [{ kind: 'wind', tx: 12, ty: null, at: null, wind: 3, platform: null, tower: null, form: 'int', text: 'Target at 12. The wind pushes the arrow 3 to the right.' }], board: null };
  assert(A.check(round, 0, { x: 9 }).ok, 'aim 9 plus wind 3 lands on 12');
  const miss = A.check(round, 0, { x: 12 });
  assert(!miss.ok && miss.landX === 15 && miss.gapX === -3 && miss.msg.includes('12 − 3 = 9'), miss.msg);
  round.shots[0].wind = -2;
  assert(A.check(round, 0, { x: 14 }).ok, 'aim 14 plus wind -2 lands on 12');
  assert(A.check(round, 0, { x: 12 }).msg.includes('12 + 2 = 14'));
}
{
  const yl = { D: 1, lo: -5, hi: 5, step: 1, labelEvery: 1, modes: ['int'], note: '1' }; // heights -5..5, ground at tick 5
  const xl = { D: 1, lo: 0, hi: 10, step: 1, labelEvery: 1, modes: ['int'], note: '1' };
  const round = { xLine: xl, yLine: yl, ticksX: 11, ticksY: 11, shots: [{ kind: 'lift', tx: null, ty: 2, at: null, wind: 0, platform: 8, tower: 6, form: 'int', text: '' }], board: null };
  const r = A.check(round, 0, { y: 2 });
  assert(r.ok && r.msg.includes('3 − 6 = −3'), r.msg);
  const w = A.check(round, 0, { y: 4 });
  assert(!w.ok && w.gapY === -2 && w.msg.includes('3 − 6 = −3'), w.msg);
  const c = { xLine: xl, yLine: yl, ticksX: 11, ticksY: 11, shots: [{ kind: 'coord', tx: 4, ty: 7, at: null, wind: 0, platform: null, tower: null, form: 'int', text: '' }], board: null };
  assert(/^Right height, but/.test(A.check(c, 0, { x: 3, y: 7 }).msg));
  assert(/^Right distance, but/.test(A.check(c, 0, { x: 4, y: 5 }).msg));
  assert(/^Across:.*Height:/.test(A.check(c, 0, { x: 1, y: 5 }).msg));
}
{
  const xl = { D: 1, lo: 0, hi: 100, step: 10, labelEvery: 2, modes: ['int'], note: '10' };
  const round = { xLine: xl, yLine: null, ticksX: 11, ticksY: 0, shots: [{ kind: 'dist', tx: 5, ty: null, at: null, wind: 0, platform: null, tower: null, form: 'round', roundFrom: 47, roundTo: 'ten', text: 'Shoot to 47, rounded to the nearest ten' }], board: null };
  assert(/^Bullseye! 47 rounded to the nearest ten is 50\.$/.test(A.check(round, 0, { x: 5 }).msg), A.check(round, 0, { x: 5 }).msg);
  const miss = A.check(round, 0, { x: 4 });
  assert(!miss.ok && miss.msg.includes('47 rounded to the nearest ten (50)') && miss.msg.includes('1 tick'), miss.msg);
}

/* ---------- the board's arithmetic text ---------- */
{
  const b = { D: 1, rings: [-2, 1, 3, 5], arrows: 3, mode: 'int', total: 6, solution: [0, 3, 3] };
  assert.strictEqual(A.sumText(b, [0, 3, 3]), '(−2) + 5 + 5 = 8');
  assert(A.checkBoard(b, [1, 2, 3]).msg.includes('1 + 3 + 5 = 9') && A.checkBoard(b, [1, 2, 3]).msg.includes('3 over'));
  const f = { D: 4, rings: [1, 2, 3, 5], arrows: 2, mode: 'frac', total: 5, solution: [1, 2] };
  assert.strictEqual(A.sumText(f, [1, 2]), '1/2 + 3/4 = 1 1/4');
  const d = { D: 10, rings: [3, 5, 8, 12], arrows: 2, mode: 'dec', total: 8, solution: [0, 1] };
  assert.strictEqual(A.sumText(d, [0, 1]), '0.3 + 0.5 = 0.8');
}

/* ---------- the arc ends exactly on the chosen spot ---------- */
for (let n = 0; n < 200; n++) {
  const from = { x: Math.random() * 10, y: Math.random() * 10 };
  const to = { x: Math.random() * 100, y: Math.random() * 100 - 20 };
  const pts = A.arcPoints(from, to, 24, 5 + Math.random() * 20);
  assert.strictEqual(pts.length, 25);
  assert.deepStrictEqual(pts[0], from);
  assert.deepStrictEqual(pts[24], to, 'the arc ends exactly on the target');
}

/* ---------- stars and skills ---------- */
assert.strictEqual(A.roundStars(0), 3);
assert.strictEqual(A.roundStars(1), 3);
assert.strictEqual(A.roundStars(2), 2);
assert.strictEqual(A.roundStars(5), 1);
for (const k of ['dist', 'hop', 'wind', 'height', 'lift', 'coord', 'board']) A.skillsOf(k).forEach((id) => assert(A.SKILLS[id], id));
assert(unlabeledTargets / targets > 0.4, 'many targets sit on unlabeled ticks, so the ruler cannot be read off the note: ' + unlabeledTargets / targets);
assert(/ticks/.test(A.sampleText(3)) && /ticks/.test(A.sampleText(0)));

console.log('archery.test.js ok: ' + rounds + ' rounds, ' + wrongChecked + ' wrong aims explained, kinds ' + JSON.stringify(kindsSeen));
