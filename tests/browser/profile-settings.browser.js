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

  await page.fill('#setName', '  Ada  ');
  await page.press('#setName', 'Tab');
  assert.strictEqual(await page.textContent('#menuName'), 'Ada');
  await page.click('#setAvatar .chip:nth-child(3)');
  const av = await page.$eval('#setAvatar .chip:nth-child(3)', (e) => e.textContent);
  assert.strictEqual(await page.textContent('#menuAv'), av);
  await page.click('#setDefaultBand .chip:nth-child(6)');
  const grade = await page.evaluate(() => Store.grade(Store.profiles[0]));
  await page.fill('#setName', '   ');
  await page.press('#setName', 'Tab');
  assert.strictEqual(await page.inputValue('#setName'), 'Ada', 'an empty name is refused');

  await page.reload();
  await page.click('.player-card:not(.add)');
  await page.waitForSelector('#menu:not([hidden])');
  assert.strictEqual(await page.textContent('#menuName'), 'Ada');
  assert.strictEqual(await page.textContent('#menuAv'), av);
  assert.strictEqual(await page.evaluate(() => Store.grade(Store.profiles[0])), grade);
  assert.notStrictEqual(grade, 2, 'the grade changed');
  assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll');

  await page.click('summary:has-text("For grown-ups")');
  await page.click('#deletePlayer');
  await page.waitForSelector('#home:not([hidden])');
  assert.strictEqual(await page.evaluate(() => Store.profiles.length), 0);
  await browser.close(); server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: name, buddy and grade can be changed from the player menu, persist, refuse an empty name, and the player can be deleted');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
