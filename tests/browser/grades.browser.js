// Browser test: the grade is the one setting. A new profile picks a grade; a profile with no saved grade is asked once ("Not now" saves nothing,
// a pick saves the grade AND the old band); the player menu changes it; no game's setup screen has a grade or "how tricky" picker. Needs Playwright (not a repo dependency): node tests/browser/grades.browser.js
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

  // 1. a new profile picks a grade; the picker offers K to 8
  await page.click('.player-card.add');
  const opts = await page.$$eval('#npGrade option', (o) => o.map((x) => x.textContent));
  assert.deepStrictEqual(opts, ['Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade', '6th grade', '7th grade', '8th grade'], 'the picker offers K to 8');
  await page.fill('#npName', 'Ada'); await page.selectOption('#npGrade', '3'); await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');
  let s = await page.evaluate(() => ({ g: Store.profiles[0].settings.grade, b: Store.profiles[0].settings.band, known: Store.gradeKnown(Store.profiles[0]) }));
  assert.deepStrictEqual(s, { g: 3, b: '2-3', known: true }, 'the chosen grade is saved with its old band');
  assert.strictEqual(await page.isVisible('#gradeAsk'), false, 'a profile with a grade is not asked');

  // 2. a profile made before grades existed has a band but no grade: asked once; "Not now" saves nothing
  await page.evaluate(() => { const p = Store.newProfile('Old', '🦊', '4-5'); delete p.settings.grade; Store.save(); });
  await page.reload();
  await page.click('.player-card:has-text("Old")');
  await page.waitForSelector('#gradeAsk[open]');
  assert(/What grade is Old in/.test(await page.textContent('#gradeAsk h2')));
  await page.click('#gaLater');
  s = await page.evaluate(() => { const p = Store.profiles.find((x) => x.name === 'Old'); return { known: Store.gradeKnown(p), has: 'grade' in p.settings, guess: Store.grade(p), band: p.settings.band }; });
  assert.deepStrictEqual(s, { known: false, has: false, guess: 5, band: '4-5' }, '"Not now" saves nothing; the read-time guess is the upper grade of the old band');
  await page.click('#menuBack');
  await page.click('.player-card:has-text("Old")');
  assert.strictEqual(await page.isVisible('#gradeAsk'), false, 'not asked again in the same visit');
  // after a reload it asks again, and a pick is saved (grade and band)
  await page.reload();
  await page.click('.player-card:has-text("Old")');
  await page.waitForSelector('#gradeAsk[open]');
  await page.click('#gaChips .chip:has-text("4th grade")');
  await page.waitForSelector('#menu:not([hidden])');
  s = await page.evaluate(() => { const p = Store.profiles.find((x) => x.name === 'Old'); return { g: p.settings.grade, b: p.settings.band }; });
  assert.deepStrictEqual(s, { g: 4, b: '4-5' });

  // 3. the player menu changes the grade (and the old band that the other games read)
  await page.click('#setDefaultBand .chip:has-text("6th grade")');
  s = await page.evaluate(() => { const p = Store.profiles.find((x) => x.name === 'Old'); return { g: p.settings.grade, b: p.settings.band }; });
  assert.deepStrictEqual(s, { g: 6, b: '6' }, 'the menu changes the grade and the band follows');
  await page.click('#menuBack');
  assert(/6th grade/.test(await page.textContent('.player-card:has-text("Old") .sub')), 'the player card shows the grade');

  // 4. a graded game has no grade or "how tricky" pickers; a game not moved over yet still does
  await page.click('.player-card:has-text("Ada")');
  await page.click('[data-game=archery]');
  await page.waitForSelector('#setup:not([hidden])');
  assert.strictEqual(await page.isVisible('#bandBox'), false, 'Arrow Range: no grade picker');
  assert.strictEqual(await page.isVisible('#starsBox'), false, 'Arrow Range: no "how tricky" picker');
  assert(/3rd grade/.test(await page.textContent('#summary')), 'the setup summary shows the grade: ' + await page.textContent('#summary'));
  assert(/ticks/.test(await page.textContent('#sampleRule')), 'an example is shown');
  await page.click('#setupBack, #setup .crumb:has-text("Games")').catch(() => {});
  await page.evaluate(() => { document.querySelector('#setup').hidden = true; });
  await page.reload();
  await page.click('.player-card:has-text("Ada")');
  await page.click('[data-game=munchers]');
  await page.waitForSelector('#setup:not([hidden])');
  assert.strictEqual(await page.isVisible('#bandBox'), false, 'Munchers: no grade picker either (every game plays by grade)');
  assert.strictEqual(await page.isVisible('#starsBox'), false, 'and no "how tricky" picker');

  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: grade chosen at creation, asked once for old profiles ("Not now" saves nothing), changed in the player menu, no per-game pickers');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
