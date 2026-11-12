// Browser test: every game that plays by grade can START on a bonus (stretch) item without errors, shows its "Bonus" label, and shows none at its top grade. A normal first item is never a bonus, so this forces one: Store.cell is wrapped to stretch every time, first item included.
// Needs Playwright (not a repo dependency): node tests/browser/bonus.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

// the highest grade each game has its own content for; no stretch at or above it (games on the shared difficulty ladder top out at 7; the Runner and Arrow Range have grade 8)
const TOP = { runner: 8, archery: 8 };
const GAMES = [['munchers', '#levelNo'], ['balance', '#balNo'], ['machine', '#macNo'], ['defense', '#tdNo'], ['lemonade', '#lemNo'], ['escape', '#escNo'], ['runner', '#runNo'], ['sort', '#sortNo'], ['share', '#shNo']];

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const errors = [];
  let played = 0;
  for (const grade of [0, 3, 6, 7, 8]) {
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1100 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('grade ' + grade + ' pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('grade ' + grade + ' console: ' + m.text()); });
    await page.goto(server.url);
    await page.click('.player-card.add'); await page.fill('#npName', 'Ada'); await page.selectOption('#npGrade', String(grade)); await page.click('#npForm button[type=submit]');
    await page.waitForSelector('#menu:not([hidden])');
    for (const [game, label] of GAMES) {
      await page.goto(server.url);
      await page.click('.player-card:not(.add)');
      await page.waitForSelector('#menu:not([hidden])');
      await page.evaluate(() => {
        const force = (opts) => Object.assign({}, opts, { first: false, stretchShare: 1 });
        const o = Store.cell; Store.cell = (p, g, opts) => o(p, g, force(opts));
        const pi = Grades.pickItem; Grades.pickItem = (g, opts) => pi(g, force(opts)); // the Runner picks its own grade items (grade-specific content)
      });
      await page.click('[data-game=' + game + ']');
      await page.waitForSelector('#setup:not([hidden])');
      await page.click('#playNow');
      await page.waitForFunction((sel) => { const e = document.querySelector(sel); return e && e.offsetParent !== null && e.textContent.trim().length > 0; }, label, { timeout: 8000 });
      const text = await page.textContent(label);
      if (grade < (TOP[game] || 7)) assert(/[Bb]onus/.test(text), game + ' at grade ' + grade + ' should start on a bonus item: "' + text + '"');
      else assert(!/[Bb]onus/.test(text), game + ' at grade ' + grade + ' has no stretch: "' + text + '"');
      played++;
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: ' + played + ' game starts (9 games x grades 0, 3, 6, 7, 8) with a forced bonus item: label shown below each top grade of a game, none at or above it, no errors');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
