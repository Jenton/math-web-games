// Browser test: a grown-up can change a player's name, buddy and default grade from the player menu; it shows right away, survives a reload,
// an empty name is refused, and a player can be deleted. Needs Playwright (not a repo dependency): node tests/browser/profile-settings.browser.js
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
  page.on('dialog', (d) => d.accept());
  await page.goto(server.url);
  await page.click('.player-card.add'); await page.fill('#npName', 'Kid'); await page.selectOption('#npGrade', '2'); await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');

  // the settings are NOT on the menu under the games: they live on their own page, behind the gear in the menu header
  for (const sel of ['#setName', '#setAvatar', '#setDefaultBand', '#setMotion', '#deletePlayer']) assert.strictEqual(await page.isVisible(sel), false, sel + ' is not on the menu');
  assert.strictEqual(await page.locator('#menu h2:has-text("Settings")').count(), 0, 'no Settings heading under the games');
  assert.strictEqual(await page.isVisible('#openSettings'), true, 'the gear button is in the menu header');
  assert.strictEqual(await page.getAttribute('#openSettings', 'aria-label'), 'Settings');
  await page.click('#openSettings');
  await page.waitForSelector('#settings:not([hidden])');
  assert.strictEqual(await page.isVisible('#menu'), false, 'the settings are a separate page');
  assert.strictEqual(await page.isVisible('#setName'), true);
  assert.strictEqual(await page.evaluate(() => document.querySelector('#settings nav.crumbs').textContent.replace(/\s+/g, ' ').trim()), 'Players › Games › Settings', 'the crumbs show where you are');

  await page.fill('#setName', '  Ada  ');
  await page.press('#setName', 'Tab');
  await page.click('#setAvatar .chip:nth-child(3)');
  const av = await page.$eval('#setAvatar .chip:nth-child(3)', (e) => e.textContent);
  assert.strictEqual(await page.textContent('#settingsAv'), av, 'the settings header shows the new buddy');
  await page.click('#setDefaultBand .chip:nth-child(6)');
  const grade = await page.evaluate(() => Store.grade(Store.profiles[0]));
  await page.fill('#setName', '   ');
  await page.press('#setName', 'Tab');
  assert.strictEqual(await page.inputValue('#setName'), 'Ada', 'an empty name is refused');
  assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll on the settings page');

  // back to the games: the menu header shows the new name and buddy
  await page.click('#settings .crumb:has-text("Games")');
  await page.waitForSelector('#menu:not([hidden])');
  assert.strictEqual(await page.textContent('#menuName'), 'Ada');
  assert.strictEqual(await page.textContent('#menuAv'), av);

  await page.reload();
  await page.click('.player-card:not(.add)');
  await page.waitForSelector('#menu:not([hidden])');
  assert.strictEqual(await page.textContent('#menuName'), 'Ada');
  assert.strictEqual(await page.textContent('#menuAv'), av);
  assert.strictEqual(await page.evaluate(() => Store.grade(Store.profiles[0])), grade);
  assert.notStrictEqual(grade, 2, 'the grade changed');
  assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll');

  await page.click('#openSettings');
  await page.click('summary:has-text("For grown-ups")');
  await page.click('#deletePlayer');
  await page.waitForSelector('#home:not([hidden])');
  assert.strictEqual(await page.evaluate(() => Store.profiles.length), 0);
  await browser.close(); server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: the settings live on their own page behind a gear in the menu header: name, buddy and grade can be changed there, persist, refuse an empty name, and the player can be deleted');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
