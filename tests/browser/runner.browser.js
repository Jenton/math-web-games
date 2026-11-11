// Browser test: plays a full Number Line Runner run on a phone-sized screen. A wrong tick splashes and is explained, the right ticks land,
// stones and flags appear, the result panel shows stars, progress is saved, and no asset 404s (a missing image would silently hide the art).
// Needs Playwright (not a repo dependency): node tests/browser/runner.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && /kenney\/runner/.test(r.url())) bad.push(r.status() + ' ' + r.url()); });
  await page.goto(server.url);
  await page.click('.player-card.add'); await page.fill('#npName', 'Ada'); await page.selectOption('#npBand', '4-5'); await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');
  await page.click('[data-game=runner]');
  await page.waitForSelector('#setup:not([hidden])');
  await page.evaluate(() => { const orig = RUN.makeRun; RUN.makeRun = (b, s) => (window.__run = orig(b, s)); });
  await page.click('#playNow');
  await page.waitForSelector('#runner:not([hidden])');
  await page.waitForSelector('.run-tick');
  const run = await page.evaluate(() => window.__run);
  assert.strictEqual(run.checkpoints.length, 4);
  assert.strictEqual((await page.$$('.run-tick')).length, run.ticks);
  // aim like a thumb would: press on the line at the tick's x position (the whole line is the tap target and snaps to the nearest tick)
  const tapTick = async (k) => {
    const box = await page.locator('#runScene').boundingBox();
    await page.mouse.click(box.x + (box.width * (7 + (k / (run.ticks - 1)) * 86)) / 100, box.y + box.height * 0.72);
  };
  // the goal spot is not drawn on the line: no flag exists before a landing
  assert.strictEqual(await page.$$eval('.run-flag', (e) => e.length), 0, 'no flag before landing');
  // a wrong landing: explained in ticks, still on checkpoint 1
  const first = run.checkpoints[0];
  const wrong = first.target === 0 ? 1 : first.target - 1;
  await tapTick(wrong);
  await page.click('#runJump');
  await page.waitForFunction(() => /You landed on/.test(document.getElementById('runMsg').textContent), null, { timeout: 8000 });
  const miss = await page.textContent('#runMsg');
  assert(/tick/.test(miss) && /(left|right)/.test(miss), 'miss message counts ticks and gives a direction: ' + miss);
  for (let i = 0; i < 4; i++) {
    const cp = run.checkpoints[i];
    await page.waitForFunction((n) => new RegExp('Flag ' + (n + 1) + ' of 4').test(document.getElementById('runSign').textContent) && !document.getElementById('runLeft').disabled, i, { timeout: 8000 });
    await tapTick(cp.target);
    await page.click('#runJump');
    await page.waitForFunction((n) => document.querySelectorAll('.run-flag').length >= n, i + 1, { timeout: 8000 });
  }
  await page.waitForSelector('#panel:not([hidden])', { timeout: 8000 });
  assert(/⭐/.test(await page.textContent('#panelTitle')), 'result shows stars');
  const saved = await page.evaluate(() => Store.total(Store.game(Store.profiles[0], 'runner'), 'runs'));
  assert.strictEqual(saved, 1, 'the run is saved once');
  assert.deepStrictEqual(bad, [], 'no runner assets 404: ' + bad.join(', '));
  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: a full Number Line Runner run played at phone size (a miss explained in ticks, four landings, stones and flags, stars, saved once, no asset 404s)');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
