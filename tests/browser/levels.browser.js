// Browser test: the player's grade is the only difficulty setting. Every game's setup screen has no grade or "how tricky" picker, an old per-game
// override left in a save is ignored (not deleted), changing the grade in the player menu changes the level every game plays, and it survives a reload.
// Needs Playwright (not a repo dependency): node tests/browser/levels.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(server.url);
  await page.click('.player-card.add'); await page.fill('#npName', 'Kai'); await page.selectOption('#npGrade', '3'); await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');
  const cell = (game) => page.evaluate((g) => { const c = Store.cell(Store.profiles[0], g, { stretchShare: 0 }); return [c.band, c.stars]; }, game);
  const GAMES = ['munchers', 'balance', 'machine', 'td', 'lemonade', 'escape', 'runner', 'archery', 'sort', 'share', 'rpg'];

  // 1. grade 3 plays rung 2-3 star 3 in every game
  for (const g of GAMES) assert.deepStrictEqual(await cell(g), ['2-3', 3], g + ' at grade 3');

  // 2. an old per-game override (from before grades) is ignored, and kept in the save
  await page.evaluate(() => { Store.setLevel(Store.profiles[0], 'balance', { band: 'K-1', stars: 1 }); Store.save(); });
  assert.deepStrictEqual(await cell('balance'), ['2-3', 3], 'the old override is ignored');
  assert.strictEqual(await page.evaluate(() => Store.profiles[0].games.balance.band), 'K-1', 'and not deleted');

  // 3. the settings page changes the grade, and every game follows
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])');
  await page.click('#setDefaultBand [aria-label="Kindergarten"]');
  for (const g of GAMES) assert.deepStrictEqual(await cell(g), ['K-1', 1], g + ' at kindergarten');
  await page.click('#setDefaultBand [aria-label="6th grade"]');
  for (const g of GAMES) assert.deepStrictEqual(await cell(g), ['6', 2], g + ' at 6th grade');
  await page.click('#settings .crumb:has-text("Games")'); await page.waitForSelector('#menu:not([hidden])');

  // 4. no game's setup screen has a grade or "how tricky" picker
  for (const g of ['munchers', 'balance', 'machine', 'defense', 'lemonade', 'escape', 'runner', 'archery', 'sort', 'share', 'quest']) {
    await page.click('[data-game=' + g + ']');
    await page.waitForSelector('#setup:not([hidden])');
    assert.strictEqual(await page.isVisible('#bandBox'), false, g + ': no grade picker');
    assert.strictEqual(await page.isVisible('#starsBox'), false, g + ': no "how tricky" picker');
    assert(/6th grade/.test(await page.textContent('#summary')), g + ': the summary names the grade');
    assert((await page.textContent('#setupHow')).includes('bonus challenge'), g + ': the how-to explains bonus challenges');
    await page.click('#setup .crumb:has-text("Games")');
    await page.waitForSelector('#menu:not([hidden])');
  }

  // 5. it all survives a reload
  await page.reload();
  await page.click('.player-card:has-text("Kai")');
  assert.deepStrictEqual(await cell('runner'), ['6', 2], 'the grade survived the reload');
  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: the grade is the only difficulty setting: every game follows it, old per-game overrides are ignored (and kept), no per-game pickers, survives a reload');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
