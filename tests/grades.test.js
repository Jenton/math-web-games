// Verifies the grade helpers: labels, the old-band mapping (both ways), and the on-grade / stretch pick.
const G = require('../js/grades.js');
const assert = require('assert');

assert.strictEqual(G.label(0), 'Kindergarten');
assert.strictEqual(G.label(3), '3rd grade');
assert.strictEqual(G.label(8), '8th grade');
assert.strictEqual(G.label('x'), '3rd grade', 'an invalid grade reads as the middle of the road, never undefined');
assert.deepStrictEqual(G.options().map((o) => o[0]), [0, 1, 2, 3, 4, 5, 6, 7, 8], 'the picker offers K to 8');
assert.strictEqual(G.clean(13), null);
assert.strictEqual(G.clean(-1), null);
assert.strictEqual(G.clean(2.5), null);
assert.strictEqual(G.clean(12), 12);

// grade -> old band covers every grade; band -> grade -> band is stable
const bands = { 0: 'K-1', 1: 'K-1', 2: '2-3', 3: '2-3', 4: '4-5', 5: '4-5', 6: '6', 7: '6', 8: '6', 12: '6' };
for (const [g, b] of Object.entries(bands)) assert.strictEqual(G.bandOf(+g), b, 'grade ' + g);
for (const b of ['K-1', '2-3', '4-5', '6']) assert.strictEqual(G.bandOf(G.legacyGrade(b)), b, 'round trip ' + b);
assert.strictEqual(G.legacyGrade('nope'), 3);

// the pick: the first item of a round is always on-grade; share 0 never stretches; share 1 always does (below the top)
for (let g = 0; g <= 8; g++) {
  for (let i = 0; i < 200; i++) {
    assert.deepStrictEqual(G.pickItem(g, { first: true, stretchShare: 1 }), { grade: g, stretch: false });
    assert.deepStrictEqual(G.pickItem(g, { stretchShare: 0 }), { grade: g, stretch: false });
    const all = G.pickItem(g, { stretchShare: 1, top: 8 });
    assert.deepStrictEqual(all, g >= 8 ? { grade: 8, stretch: false } : { grade: g + 1, stretch: true }, 'grade ' + g);
  }
}
// a player above a game's top grade gets the top content and never a stretch
assert.deepStrictEqual(G.pickItem(8, { top: 6, stretchShare: 1 }), { grade: 6, stretch: false });
assert.deepStrictEqual(G.pickItem(6, { top: 6, stretchShare: 1 }), { grade: 6, stretch: false });
// the default share is about 30%
let stretched = 0;
for (let i = 0; i < 20000; i++) if (G.pickItem(3, { top: 8 }).stretch) stretched++;
assert(stretched > 5400 && stretched < 6600, 'about 30% stretch, got ' + stretched / 200 + '%');
// a seeded rng is honored
assert.strictEqual(G.pickItem(3, { rng: () => 0.1 }).stretch, true);
assert.strictEqual(G.pickItem(3, { rng: () => 0.9 }).stretch, false);

// the difficulty ladder: every grade has a valid cell, rungs never go down with grade, a stretch item is always on a HIGHER rung, the first item never stretches
assert.strictEqual(G.LADDER.length, 12);
let prev = -1;
for (let g = 0; g <= 8; g++) {
  const c = G.cell(g, { stretchShare: 0 });
  assert(['K-1', '2-3', '4-5', '6'].includes(c.band) && [1, 2, 3].includes(c.stars), 'a valid cell for grade ' + g);
  assert(c.rung >= prev, 'rungs do not go down with grade');
  prev = c.rung;
  assert.strictEqual(c.stretch, false);
  assert.strictEqual(G.cell(g, { first: true, stretchShare: 1 }).stretch, false, 'the first item never stretches');
  const up = G.cell(g, { stretchShare: 1 });
  if (g >= 7) assert.deepStrictEqual([up.stretch, up.rung], [false, 11], 'the top has no stretch'); else { assert.strictEqual(up.stretch, true); assert(up.rung > c.rung, 'a stretch item is on a higher rung: grade ' + g); }
}
const g3 = G.cell(3, { stretchShare: 0 }); const g3s = G.cell(3, { stretchShare: 1 });
assert.deepStrictEqual([g3.band, g3.stars, g3s.band, g3s.stars], ['2-3', 3, '4-5', 1], 'a 3rd grader plays 2-3/3 with 4-5/1 (the fractions) as the stretch');
assert.deepStrictEqual([G.cell(0, { stretchShare: 0 }).band, G.cell(8, { stretchShare: 1 }).band], ['K-1', '6']);

console.log('grades.test.js ok');
