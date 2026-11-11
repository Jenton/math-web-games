// Run with: node tests/shop.test.js
// Lemonade Stand: every generated job is solvable, has exactly one right answer, and wrong answers are really wrong.
const assert = require('assert');
const S = require('../js/shop.js');
const Save = require('../js/save.js');

const BANDS = ['K-1', '2-3', '4-5', '6'];
assert.deepStrictEqual([S.money(5), S.money(85), S.money(100), S.money(225), S.money(1000), S.money(105)], ['5¢', '85¢', '$1', '$2.25', '$10', '$1.05']);

for (const band of BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 300; i++) {
      // change: the exact amount passes, anything else fails, and the coins can make it
      const c = S.makeChange(band, stars);
      assert.ok(Number.isInteger(c.owed) && c.owed > 0 && c.paid > c.owed, band + ' change owed/paid sane: ' + c.text);
      assert.strictEqual(c.change, c.paid - c.owed);
      assert.ok(S.checkChange(c, [c.change]).ok);
      assert.ok(!S.checkChange(c, [c.change + 1]).ok && !S.checkChange(c, [c.change - 1]).ok);
      assert.ok(S.checkChange(c, [c.change - 1]).msg.includes('too little'));
      let left = c.change;
      c.coins.slice().sort((a, b) => b - a).forEach((d) => { left %= d; });
      assert.strictEqual(left, 0, 'coins can always make the change');
      assert.ok(c.coins.includes(1), 'pennies always available');

      // stock: exactly one count is right, and fewer or more are wrong with an explanation
      const s = S.makeStock(band, stars);
      assert.ok(s.answer >= 1 && s.answer <= s.max, band + ' stock answer in stepper range');
      assert.ok(S.checkStock(s, s.answer).ok);
      assert.ok(!S.checkStock(s, s.answer + 1).ok && !S.checkStock(s, s.answer - 1).ok);
      assert.ok(S.checkStock(s, s.answer - 1).msg.length > 10);

      // price: exactly one best price, the answer is the maximum, and a lower price never sells fewer cups
      const p = S.makePrice(band, stars);
      const profits = p.options.map((o) => o.sold * (o.price - p.cost) - p.fixed);
      assert.deepStrictEqual(profits, p.options.map((o) => o.profit));
      assert.strictEqual(profits.filter((x) => x === Math.max(...profits)).length, 1, 'one best price');
      assert.strictEqual(p.best, profits.indexOf(Math.max(...profits)));
      assert.ok(profits[p.best] > 0);
      for (let k = 1; k < p.options.length; k++) assert.ok(p.options[k].sold < p.options[k - 1].sold, 'higher price sells fewer');
      p.options.forEach((_, k) => assert.strictEqual(S.checkPrice(p, k).ok, k === p.best));
      if (stars > 1) assert.ok(p.options.length >= 4 || stars === 2);

      // a day is linked: the price you pick sets the cups, the cups set the stock, the price sets the change
      const d = S.makeDay(band, stars);
      assert.deepStrictEqual(d.jobs.map((j) => j.kind), ['price', 'stock', 'change', 'change']);
      const best = d.jobs[0].options[d.jobs[0].best];
      assert.strictEqual(d.cups, best.sold);
      assert.strictEqual(d.price, best.price);
      assert.strictEqual(d.profit, d.cups * (d.price - d.cost) - d.fixed);
      assert.strictEqual(d.jobs[1].need, d.cups, 'stock is for exactly the cups you will sell');
      assert.ok(S.checkStock(d.jobs[1], d.jobs[1].answer).ok && !S.checkStock(d.jobs[1], d.jobs[1].answer + 1).ok);
      d.jobs.slice(2).forEach((j) => {
        assert.ok(S.checkChange(j, [j.change]).ok && !S.checkChange(j, [j.change + 1]).ok);
        assert.ok(Number.isInteger(j.owed) && j.paid > j.owed);
        if (band === 'K-1' || band === '2-3') assert.strictEqual(j.owed, d.price, 'the customer pays your price');
        else if (j.text.indexOf('%') < 0) assert.strictEqual(j.owed % d.price, 0, 'owed is a whole number of cups at your price');
        let left = j.change;
        j.coins.slice().sort((a, b2) => b2 - a).forEach((c2) => { left %= c2; });
        assert.strictEqual(left, 0);
      });
    }
  }
}

// the grade 6 discount always gives whole cents
for (let i = 0; i < 500; i++) { const c = S.makeChange('6', 3); assert.ok(Number.isInteger(c.owed)); }

// the cheapest-looking and the dearest price are not always the best: brute-force clicking one end loses often
{
  let lo = 0; let hi = 0;
  for (let i = 0; i < 400; i++) { const p = S.makePrice('2-3', 2); if (p.best === 0) lo++; if (p.best === p.options.length - 1) hi++; }
  assert.ok(lo < 60 && hi < 60, 'always picking the cheapest or dearest is not a strategy');
}

// progress merges: days and perfect days are counters
{
  const a = { games: { lemonade: { days: { d1: 3 }, perfect: { d1: 1 } } } };
  const b = { games: { lemonade: { days: { d1: 2, d2: 4 }, perfect: { d2: 2 } } } };
  const m = Save.mergeGame('lemonade', a.games.lemonade, b.games.lemonade);
  assert.strictEqual(Save.sumCounter(m.days), 7);
  assert.strictEqual(Save.sumCounter(m.perfect), 3);
}
console.log('OK: change, stock and price jobs are solvable with one right answer in every band and star level; wrong answers are really wrong.');
