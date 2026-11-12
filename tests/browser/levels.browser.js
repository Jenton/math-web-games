// Browser test: the player's DEFAULT grade (set on the player menu) is separate from each game's own grade and challenge.
// Changing the grade inside one game must change only that game; changing the default moves every game that has no choice of its own;
// "Use my default grade" puts a game back on the default; and it all survives a reload.
// Needs Playwright (not a repo dependency): node tests/browser/levels.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(server.url);
  await page.click('.player-card.add'); await page.fill('#npName', 'Kai'); await page.selectOption('#npBand', '2-3'); await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');

  const state = () => page.evaluate(() => {
    const p = Store.profiles[0];
    return { def: p.settings.band, balance: (p.games.balance || {}).band, balanceStars: (p.games.balance || {}).stars, munchers: (p.games.munchers || {}).band };
  });
  const selectedGrade = () => page.$eval('#setBand .opt-card.on .o-t', (e) => e.textContent.replace(/\s*✓\s*$/, '').trim());
  const openSetup = async (game) => { await page.click('[data-game=' + game + ']'); await page.waitForSelector('#setup:not([hidden])'); };
  const toMenu = async () => { await page.click('#setup nav.crumbs button#setupBack'); await page.waitForSelector('#menu:not([hidden])'); };

  // 1. change the grade inside Balance only
  await openSetup('balance');
  assert.strictEqual(await selectedGrade(), '2nd – 3rd', 'starts on the default grade');
  assert(/Using your default/.test(await page.textContent('#bandHelp')));
  await page.click('#setBand .opt-card:has-text("6th grade")');
  assert.strictEqual(await selectedGrade(), '6th grade');
  assert(/Set just for Balance/.test(await page.textContent('#bandHelp')));
  let s = await state();
  assert.strictEqual(s.def, '2-3', 'the player default did not change');
  assert.strictEqual(s.balance, '6', 'Balance has its own grade');

  // 2. another game still follows the default
  await toMenu();
  await openSetup('munchers');
  assert.strictEqual(await selectedGrade(), '2nd – 3rd', 'Munchers did not move');
  assert.strictEqual(await page.isVisible('#bandReset'), false, 'nothing to reset on a game that follows the default');
  await toMenu();

  // 3. Balance really plays at its own grade
  await page.evaluate(() => { const o = MGP.makeBalance; MGP.makeBalance = (b, st) => { window.__bal = { band: b, stars: st }; return o(b, st); }; });
  await openSetup('balance');
  await page.click('#setStars .opt-card:nth-child(2)');
  await page.click('#playNow');
  await page.waitForSelector('#balance:not([hidden])');
  const played = await page.evaluate(() => window.__bal);
  assert.deepStrictEqual(played, { band: '6', stars: 2 }, 'Balance plays at its own grade and challenge');
  await page.click('#balance nav.crumbs .crumb[data-go=menu]');
  await page.waitForSelector('#menu:not([hidden])');
  assert.strictEqual((await state()).def, '2-3', 'playing did not change the default either');

  // 4. change the DEFAULT on the player menu: Munchers follows, Balance keeps its own
  await page.click('#setDefaultBand .chip:has-text("4th – 5th")');
  s = await state();
  assert.strictEqual(s.def, '4-5');
  assert.strictEqual(s.balance, '6');
  await openSetup('munchers');
  assert.strictEqual(await selectedGrade(), '4th – 5th', 'Munchers follows the new default');
  await toMenu();

  // 5. reload: everything is remembered
  await page.reload();
  await page.click('.player-card:not(.add)');
  await page.waitForSelector('#menu:not([hidden])');
  await openSetup('balance');
  assert.strictEqual(await selectedGrade(), '6th grade', 'Balance kept its own grade after a reload');
  assert.strictEqual((await state()).def, '4-5');

  // 6. "Use my default grade" puts Balance back on the default (the challenge you picked stays)
  await page.click('#bandReset');
  await page.waitForSelector('#setBand .opt-card.on');
  assert.strictEqual(await selectedGrade(), '4th – 5th', 'Balance is back on the default');
  assert.strictEqual(await page.isVisible('#bandReset'), false);
  s = await state();
  assert.strictEqual(s.balance, null, 'Balance no longer has its own grade');
  assert.strictEqual(s.balanceStars, 2, 'the challenge choice for Balance is kept');

  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: grade and challenge are per game; the player default is separate; a game follows the default until it has its own choice; reset and reload work');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
