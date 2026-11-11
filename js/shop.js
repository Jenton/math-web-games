/* Lemonade Stand generators: making change, stocking up, and pricing. Pure logic, no DOM, unit-tested in Node.
 *
 * Money is whole cents everywhere. Three task types, each hand-designed, with the generator only varying the numbers:
 *   change : a customer pays with a bill; build the exact change from coins (subtraction, place value, percent at grade 6).
 *   stock  : how many pitchers (or lemons) to buy for the forecast. Too few loses sales, too many is waste (division, ratio).
 *   price  : pick the price that earns the most profit when a higher price sells fewer cups (multiplication, comparing).
 * Math rule: you can't tap your way to a good result. Change must be exact, stock must be right, and the best price is the
 * one with the biggest profit. Every wrong answer shows its arithmetic.
 */
(function (root) {
  'use strict';
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (a) => a[rnd(0, a.length - 1)];
  const clampStars = (s) => Math.min(3, Math.max(1, s | 0 || 1));
  const bandOf = (b) => (['K-1', '2-3', '4-5', '6'].includes(b) ? b : '2-3');

  /** 85 -> "85¢", 225 -> "$2.25", 300 -> "$3" */
  function money(c) {
    if (c < 100) return c + '¢';
    const d = Math.floor(c / 100);
    const r = c % 100;
    return '$' + d + (r ? '.' + (r < 10 ? '0' + r : r) : '');
  }
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  /* ================= make change ================= */

  const COINS = { 'K-1': [1, 5, 10, 25, 100], '2-3': [1, 5, 10, 25, 100], '4-5': [1, 5, 10, 25, 100, 500], '6': [1, 5, 10, 25, 100, 500] };

  function makeChange(band, stars) {
    band = bandOf(band);
    const st = clampStars(stars);
    let owed;
    let paid;
    let text;
    let how;
    if (band === 'K-1') {
      owed = (st === 1 ? rnd(1, 9) * 10 : rnd(1, 19) * 5);
      paid = 100;
      text = 'A friend buys a cup for ' + money(owed) + ' and pays with $1.';
    } else if (band === '2-3') {
      owed = st === 1 ? rnd(1, 19) * 5 : rnd(11, 99);
      paid = st === 3 ? 500 : 100;
      if (st === 3) owed += 100 * rnd(1, 3);
      text = 'A customer owes ' + money(owed) + ' and pays with ' + money(paid) + '.';
    } else if (band === '4-5') {
      const qty = rnd(2, st === 1 ? 4 : 6);
      const unit = pick([25, 35, 40, 45, 50, 75]);
      owed = qty * unit;
      paid = owed > 500 ? 1000 : 500;
      text = 'A customer buys ' + qty + ' cups at ' + money(unit) + ' each and pays with ' + money(paid) + '.';
      how = qty + ' × ' + money(unit) + ' = ' + money(owed);
    } else {
      const qty = rnd(2, 6);
      const unit = pick([20, 40, 60, 80, 100]);
      const pct = pick(st === 1 ? [50, 20] : [10, 20, 25, 50]);
      const base = qty * unit;
      owed = (base * (100 - pct)) / 100;
      paid = owed > 500 ? 1000 : 500;
      text = qty + ' cups at ' + money(unit) + ' each, ' + pct + '% off today. The customer pays with ' + money(paid) + '.';
      how = qty + ' × ' + money(unit) + ' = ' + money(base) + ', and ' + pct + '% off is ' + money(base - owed) + ', so they owe ' + money(owed);
    }
    const change = paid - owed;
    return {
      kind: 'change', band, stars: st, text, owed, paid, change, coins: COINS[band],
      why: (how ? how + '. ' : '') + money(paid) + ' − ' + money(owed) + ' = ' + money(change) + ' change.',
    };
  }

  function checkChange(p, given) {
    const total = sum(given);
    if (total === p.change) return { ok: true, msg: p.why };
    if (total < p.change) return { ok: false, msg: 'That is ' + money(total) + ', which is ' + money(p.change - total) + ' too little. They are owed ' + money(p.change) + '. ' + p.why };
    return { ok: false, msg: 'That is ' + money(total) + ', which is ' + money(total - p.change) + ' too much. ' + p.why };
  }

  /* ================= stock up ================= */

  function makeStock(band, stars) {
    band = bandOf(band);
    const st = clampStars(stars);
    let text;
    let answer;
    let unit;
    let why;
    let check; // (n) -> explanation of what n gets you
    if (band === 'K-1') {
      const k = pick(st === 1 ? [2, 3] : [2, 3, 4, 5]);
      const m = rnd(2, st === 3 ? 6 : 4);
      const N = k * m;
      answer = m;
      unit = 'pitcher';
      text = 'Each pitcher fills ' + k + ' cups. ' + N + ' friends want one cup each. How many pitchers do you make?';
      why = plural(m, 'pitcher') + ' × ' + k + ' cups = ' + N + ' cups, exactly enough.';
      check = (n) => n + ' × ' + k + ' = ' + n * k + ' cups for ' + N + ' friends.';
      return pack(band, st, text, answer, unit, why, check, N);
    }
    if (band === '2-3') {
      const k = pick([4, 6, 8]);
      const c = pick(st === 1 ? [1, 2] : [2, 3]);
      let N;
      do N = rnd(3, st === 3 ? 12 : 8); while (st > 1 && (N * c) % k === 0); // later stars round up
      const need = N * c;
      answer = Math.ceil(need / k);
      unit = 'pitcher';
      text = N + ' customers will each buy ' + c + ' cup' + (c > 1 ? 's' : '') + '. A pitcher fills ' + k + ' cups. How many pitchers do you make?';
      why = N + ' × ' + c + ' = ' + need + ' cups needed. ' + k + ' cups per pitcher: ' + plural(answer, 'pitcher') + ' make' + (answer === 1 ? 's' : '') + ' ' + answer * k + ' cups, enough.' + (answer > 1 ? ' ' + (answer - 1) + ' make only ' + (answer - 1) * k + '.' : '');
      check = (n) => n + ' × ' + k + ' = ' + n * k + ' cups, and ' + need + ' are needed.';
      return pack(band, st, text, answer, unit, why, check, need);
    }
    if (band === '4-5') {
      const k = pick([6, 8, 10]);
      const a = pick([2, 3, 4]);
      const N = rnd(2, st === 3 ? 9 : 6) * k + (st === 1 ? 0 : rnd(1, k - 1));
      const pitchers = Math.ceil(N / k);
      answer = pitchers * a;
      unit = 'lemon';
      text = 'One pitcher uses ' + a + ' lemons and fills ' + k + ' cups. You expect to sell ' + N + ' cups. How many lemons do you buy?';
      why = N + ' cups ÷ ' + k + ' cups per pitcher means ' + pitchers + ' pitchers (rounding up). ' + pitchers + ' × ' + a + ' lemons = ' + answer + ' lemons.';
      check = (n) => n + ' lemons ÷ ' + a + ' per pitcher = ' + plural(n / a, 'pitcher') + ', which fill ' + (n / a) * k + ' cups, and you need ' + N + '.';
      return Object.assign(pack(band, st, text, answer, unit, why, check, N), { step: 1 });
    }
    const b = pick([4, 6, 8]);
    const a = pick([2, 3, 5]);
    const m = rnd(2, st === 3 ? 9 : 6);
    const N = b * m;
    answer = a * m;
    unit = 'lemon';
    text = 'The recipe says ' + a + ' lemons for every ' + b + ' cups. You are making ' + N + ' cups. How many lemons?';
    why = N + ' cups is ' + m + ' groups of ' + b + ' (' + N + ' ÷ ' + b + ' = ' + m + '). Each group needs ' + a + ' lemons: ' + m + ' × ' + a + ' = ' + answer + ' lemons.';
    check = (n) => n + ' lemons feeds ' + n + ' ÷ ' + a + ' × ' + b + ' = ' + Math.round((n / a) * b * 10) / 10 + ' cups, and you need ' + N + '.';
    return pack(band, st, text, answer, unit, why, check, N);
  }

  function pack(band, st, text, answer, unit, why, check, need) {
    return { kind: 'stock', band, stars: st, text, answer, unit, why, explain: check, need, max: Math.max(answer * 2 + 2, 10), step: 1 };
  }

  function checkStock(p, n) {
    if (n === p.answer) return { ok: true, msg: p.why };
    const side = n < p.answer ? 'Not enough: ' : 'Too many (that is wasted money): ';
    return { ok: false, msg: side + p.explain(n) };
  }

  /* ================= set the price ================= */

  const PRICE_BAND = {
    'K-1': { prices: [100, 200, 300, 400], cost: 100, fixed: 0, top: 8, drop: [1, 3] },
    '2-3': { prices: [50, 75, 100, 125], cost: 25, fixed: 0, top: 20, drop: [2, 6] },
    '4-5': { prices: [50, 75, 100, 125, 150], cost: 30, fixed: 200, top: 30, drop: [3, 8] },
    '6': { prices: [60, 80, 100, 120, 140], cost: 35, fixed: 450, top: 40, drop: [3, 9] },
  };

  const profitOf = (o, cost, fixed) => o.sold * (o.price - cost) - fixed;

  function makePrice(band, stars) {
    band = bandOf(band);
    const st = clampStars(stars);
    const B = PRICE_BAND[band];
    const count = st === 1 ? 3 : st === 2 ? 4 : B.prices.length;
    const prices = B.prices.slice(0, count);
    for (let tries = 0; tries < 500; tries++) {
      // a higher price sells fewer cups; the drop varies so the best price changes from puzzle to puzzle
      let sold = rnd(Math.ceil(B.top * 0.6), B.top);
      const opts = prices.map((price, i) => {
        if (i) sold = Math.max(1, sold - rnd(B.drop[0], B.drop[1]));
        return { price, sold };
      });
      if (opts.some((o, i) => i && o.sold >= opts[i - 1].sold)) continue; // a higher price must sell fewer cups
      const profits = opts.map((o) => profitOf(o, B.cost, B.fixed));
      const best = Math.max(...profits);
      if (profits.filter((x) => x === best).length !== 1 || best <= 0) continue;
      const bi = profits.indexOf(best);
      if (st > 1 && (bi === 0 || bi === opts.length - 1) && tries < 400) continue; // the best is usually in the middle
      return {
        kind: 'price', band, stars: st, cost: B.cost, fixed: B.fixed, options: opts.map((o, i) => Object.assign({ profit: profits[i] }, o)), best: bi,
        text: 'Each cup costs you ' + money(B.cost) + ' to make' + (B.fixed ? ', and the sign cost ' + money(B.fixed) + ' today' : '') + '. A higher price sells fewer cups. Which price earns the most profit?',
      };
    }
    return makePrice(band, 1);
  }

  function explainPrice(p, i) {
    const o = p.options[i];
    const fx = p.fixed ? ' − ' + money(p.fixed) : '';
    return money(o.price) + ': ' + o.sold + ' cups × (' + money(o.price) + ' − ' + money(p.cost) + ')' + fx + ' = ' + (o.profit < 0 ? '−' : '') + money(Math.abs(o.profit)) + ' profit';
  }

  function checkPrice(p, i) {
    const lines = p.options.map((_, k) => explainPrice(p, k)).join('. ');
    if (i === p.best) return { ok: true, msg: lines + '.' };
    const o = p.options[i];
    return { ok: false, msg: 'At ' + money(o.price) + ' you would earn ' + (o.profit < 0 ? '−' : '') + money(Math.abs(o.profit)) + ', but ' + money(p.options[p.best].price) + ' earns more. ' + lines + '.' };
  }

  /* ================= a day at the stand ================= */

  /** Stock for a known number of cups (the day's demand). Returns null when the numbers do not suit the band. */
  function makeStockFor(band, stars, S, priceText) {
    band = bandOf(band);
    const st = clampStars(stars);
    const lead = priceText + ' you will serve ' + S + ' cups today. ';
    if (band === 'K-1') {
      const ks = [2, 3, 4, 5].filter((k) => S % k === 0 && S / k >= 2);
      if (!ks.length) return null;
      const k = pick(ks);
      const m = S / k;
      return pack(band, st, lead + 'Each pitcher fills ' + k + ' cups. How many pitchers do you make?', m, 'pitcher',
        S + ' cups ÷ ' + k + ' cups per pitcher = ' + plural(m, 'pitcher') + '.', (n) => n + ' × ' + k + ' = ' + n * k + ' cups, and you need ' + S + '.', S);
    }
    if (band === '2-3') {
      const k = pick([4, 6, 8]);
      const m = Math.ceil(S / k);
      return pack(band, st, lead + 'A pitcher fills ' + k + ' cups. How many pitchers do you make?', m, 'pitcher',
        S + ' cups ÷ ' + k + ' per pitcher is ' + (S / k).toFixed(S % k ? 1 : 0) + ', so ' + plural(m, 'pitcher') + ' (a part-pitcher still needs a whole one). ' + m + ' × ' + k + ' = ' + m * k + ' cups.',
        (n) => n + ' × ' + k + ' = ' + n * k + ' cups, and you need ' + S + '.', S);
    }
    if (band === '4-5') {
      const k = pick([6, 8, 10]);
      const a = pick([2, 3, 4]);
      const pitchers = Math.ceil(S / k);
      return pack(band, st, lead + 'One pitcher uses ' + a + ' lemons and fills ' + k + ' cups. How many lemons do you buy?', pitchers * a, 'lemon',
        S + ' cups ÷ ' + k + ' cups per pitcher means ' + plural(pitchers, 'pitcher') + ' (rounding up). ' + pitchers + ' × ' + a + ' lemons = ' + pitchers * a + ' lemons.',
        (n) => n + ' lemons ÷ ' + a + ' per pitcher = ' + plural(Math.round((n / a) * 10) / 10, 'pitcher') + ', which fill ' + Math.round((n / a) * k * 10) / 10 + ' cups, and you need ' + S + '.', S);
    }
    const a = pick([2, 3, 5]);
    const b = pick([4, 6, 8]);
    const ans = Math.ceil((S * a) / b);
    return pack(band, st, lead + 'The recipe uses ' + a + ' lemons for every ' + b + ' cups. How many whole lemons do you buy?', ans, 'lemon',
      S + ' cups × ' + a + ' lemons ÷ ' + b + ' cups = ' + Math.round(((S * a) / b) * 100) / 100 + ' lemons, so buy ' + ans + ' (you cannot buy part of a lemon).',
      (n) => n + ' lemons feeds ' + n + ' ÷ ' + a + ' × ' + b + ' = ' + Math.round((n / a) * b * 10) / 10 + ' cups, and you need ' + S + '.', S);
  }

  /** A customer buying at the day's price, so the change job uses numbers the player chose. */
  function makeChangeFor(band, stars, unit) {
    band = bandOf(band);
    const st = clampStars(stars);
    const bill = (x) => [100, 500, 1000].find((b) => b > x);
    let owed;
    let text;
    let how = '';
    if (band === 'K-1' || band === '2-3') {
      owed = unit;
      text = 'A customer buys a cup at your price, ' + money(unit) + ', and pays with ' + money(bill(owed)) + '.';
    } else if (band === '4-5') {
      const qty = rnd(2, 4);
      owed = qty * unit;
      text = 'A customer buys ' + qty + ' cups at ' + money(unit) + ' each and pays with ' + money(bill(owed)) + '.';
      how = qty + ' × ' + money(unit) + ' = ' + money(owed) + '. ';
    } else {
      const qty = rnd(2, 4);
      const pct = pick(st === 1 ? [50, 20] : [10, 20, 25, 50]);
      const base = qty * unit;
      owed = (base * (100 - pct)) / 100;
      text = qty + ' cups at ' + money(unit) + ' each, ' + pct + '% off today. The customer pays with ' + money(bill(owed)) + '.';
      how = qty + ' × ' + money(unit) + ' = ' + money(base) + ', and ' + pct + '% off is ' + money(base - owed) + ', so they owe ' + money(owed) + '. ';
    }
    const paid = bill(owed);
    const change = paid - owed;
    return { kind: 'change', band, stars: st, text, owed, paid, change, coins: COINS[band], why: how + money(paid) + ' − ' + money(owed) + ' = ' + money(change) + ' change.' };
  }

  /**
   * One day is four linked jobs: set the price (which decides how many cups you will sell), stock up for exactly those cups,
   * then make change for two customers paying that price. The day's profit is real: cups × (price − cost) − fixed costs.
   */
  function makeDay(band, stars) {
    band = bandOf(band);
    for (let tries = 0; tries < 300; tries++) {
      const price = makePrice(band, stars);
      const o = price.options[price.best];
      const stock = makeStockFor(band, stars, o.sold, 'At ' + money(o.price) + ' a cup,');
      if (!stock) continue;
      return {
        jobs: [price, stock, makeChangeFor(band, stars, o.price), makeChangeFor(band, stars, o.price)],
        price: o.price, cups: o.sold, cost: price.cost, fixed: price.fixed, profit: o.profit,
      };
    }
    throw new Error('could not build a day for ' + band);
  }

  const SKILLS = { 'lemon-change': 'Lemonade Stand: making change', 'lemon-stock': 'Lemonade Stand: how much to buy', 'lemon-price': 'Lemonade Stand: pricing and profit' };
  const skillOf = (kind) => 'lemon-' + kind;

  const api = { money, makeChange, checkChange, makeStock, checkStock, makePrice, checkPrice, explainPrice, makeDay, makeStockFor, makeChangeFor, SKILLS, skillOf, COINS, PRICE_BAND };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MGS = api;
})(typeof window !== 'undefined' ? window : globalThis);
