// Verifies Number Defense: every wave is solvable, you cannot just buy everything, the preview matches the rules, and the sim is honest.
const TD = require('../js/tdlogic.js');
const assert = require('assert');
// every board: the path is connected, the pads are free squares, and each pad reaches enough of the path
for (const m of TD.MAPS) {
  const b = TD.buildMap(m);
  b.path.forEach((q, i) => { if (i) assert.strictEqual(Math.abs(q[0] - b.path[i - 1][0]) + Math.abs(q[1] - b.path[i - 1][1]), 1, m.name + ': path steps one square at a time'); });
  b.path.forEach((q) => assert(q[0] >= 0 && q[0] < b.cols && q[1] >= 0 && q[1] < b.rows, m.name + ': path stays on the board'));
  assert.strictEqual(new Set(b.path.map((q) => q.join())).size, b.path.length, m.name + ': path never crosses itself');
  assert.strictEqual(b.pads.length, TD.SLOTS);
  b.pads.forEach((p, k) => {
    assert(!b.path.some((q) => q[0] === p[0] && q[1] === p[1]), m.name + ': pad ' + k + ' is not on the path');
    assert(b.reach[k].length >= 3, m.name + ': pad ' + k + ' reaches at least 3 squares');
  });
  assert(b.path.length >= 18, m.name + ': path is long and winding');
}
const BANDS = ['K-1', '2-3', '4-5', '6'];
let waves = 0, randomWins = 0, randomRuns = 0, noMathWins = 0;
for (const band of BANDS) {
  for (const stars of [1, 2, 3]) {
    for (let i = 0; i < 150; i++) {
      const w = TD.makeWave(band, stars);
      waves++;
      assert(w.shop.length >= 5 && w.shop.length <= 6, 'shop size');
      assert(w.enemies.length >= 7 && w.enemies.length <= 11, 'wave size');
      assert.strictEqual(new Set(w.enemies).size, w.enemies.length, 'enemy numbers are distinct');
      // the intended answer fits the budget and the slots, and catches everything
      const cost = w.solution.reduce((s, k) => s + w.shop[k].cost, 0);
      assert(cost <= w.budget && w.solution.length <= TD.SLOTS, 'solution within budget and slots');
      assert(w.enemies.every((e) => w.solution.some((k) => w.shop[k].test(e))), 'solution covers the wave');
      assert(w.solution.length >= 2, 'one tower must not beat the whole wave');
      // buying everything is not allowed
      assert(w.shop.reduce((s, r) => s + r.cost, 0) > w.budget, 'cannot afford the whole shop');
      // simulating the solution wins with zero leaks
      const place = [null, null, null, null];
      w.solution.forEach((k, slot) => (place[slot] = k));
      const r = TD.simulate(w, place);
      assert.strictEqual(r.leaked.length, 0, 'solution leaks nothing: ' + JSON.stringify(w.enemies));
      assert.strictEqual(r.stars, 3);
      // with no towers everything leaks and the gate falls
      const none = TD.simulate(w, [null, null, null, null]);
      assert.strictEqual(none.leaked.length, w.enemies.length);
      assert(!none.won);
      const txt = TD.explain(w, [null, null, null, null], none).join(' ');
      assert(w.enemies.every((e) => txt.includes(TD.fmt(e))), 'every leaked number is mentioned in the explanation');
      // random affordable placements: count how often they win (should be well below always)
      const idx = w.shop.map((_, k) => k);
      let gold = w.budget;
      const rp = [null, null, null, null];
      for (let s = 0; s < 4; s++) {
        const k = idx[Math.floor(Math.random() * idx.length)];
        if (w.shop[k].cost <= gold) { rp[s] = k; gold -= w.shop[k].cost; }
      }
      randomRuns++;
      const rr = TD.simulate(w, rp);
      if (rr.stars === 3) randomWins++;
      // a tower that matches nothing never fires and says so
      const unused = w.shop.findIndex((x) => w.enemies.every((e) => !x.test(e)));
      if (unused >= 0) {
        const ex = TD.explain(w, [unused, null, null, null], TD.simulate(w, [unused, null, null, null]));
        assert(ex.some((l) => /never fired/.test(l)), 'wasted tower is explained');
      }
    }
  }
}
const rate = randomWins / randomRuns;
assert(rate < 0.2, 'random placement should rarely get 3 stars, got ' + rate);
console.log('OK: ' + waves + ' waves verified (solvable within budget, cannot buy the whole shop, solution wins 3 stars, no towers loses); random affordable placement gets 3 stars ' + Math.round(rate * 100) + '% of the time.');
