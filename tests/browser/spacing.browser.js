// Browser test: every back button (or the HUD row holding it) must have breathing room above the content below it.
// Found 0px on every setup screen and the player menu, and 8-10px on Quest screens. Needs Playwright: node tests/browser/spacing.browser.js
// New screens are discovered automatically: a .btn.small that is the first child of a .screen, or the first child of a .hud row.
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');
const MIN_GAP = 12;

const measure = () => {
  const seen = new Set();
  const out = [];
  document.querySelectorAll('.screen > .btn.small:first-child, .hud > .btn.small:first-child, .screen > nav.crumbs:first-child, .hud > nav.crumbs:first-child').forEach((b) => {
    if (!b.offsetParent || seen.has(b)) return;
    seen.add(b);
    const row = b.parentElement.classList.contains('hud') ? b.parentElement : b;
    let n = row.nextElementSibling;
    while (n && (!n.offsetParent || n.getBoundingClientRect().height === 0)) n = n.nextElementSibling;
    if (!n) return;
    out.push({ id: b.id || b.textContent.trim(), gap: Math.round(n.getBoundingClientRect().top - row.getBoundingClientRect().bottom), next: (n.id || n.className || n.tagName).toString().slice(0, 30) });
  });
  return out;
};

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const rows = [];
  for (const [vn, vp] of [['phone', { width: 390, height: 820 }], ['desktop', { width: 1000, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(() => { window.__questFast = true; });
    const page = await ctx.newPage();
    await page.goto(server.url);
    await page.click('.player-card.add'); await page.fill('#npName', 'Ada'); await page.selectOption('#npBand', '4-5'); await page.click('#npForm button[type=submit]');
    await page.waitForSelector('#menu:not([hidden])');
    const note = async (where) => (await page.evaluate(measure)).forEach((m) => rows.push({ vn, where, ...m }));
    await note('player menu');
    const games = await page.$$eval('[data-game]', (e) => e.map((x) => x.dataset.game));
    for (const g of games) {
      await page.goto(server.url); await page.click('.player-card:not(.add)');
      await page.click(`[data-game=${g}]`); await page.waitForSelector('#setup:not([hidden])');
      await note(g + ' setup');
      await page.click('#playNow'); await page.waitForTimeout(250);
      await note(g + ' game');
      if (g === 'quest') {
        await page.click('#qMapBtn'); await page.waitForSelector('#qMap:not([hidden])'); await note('quest world map');
        await page.click('#qMapBack'); await page.waitForSelector('#qHome:not([hidden])');
        await page.click('#qBegin'); await note('quest prep');
        await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])'); await page.waitForTimeout(200); await note('quest battle');
      }
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  const tight = rows.filter((r) => r.gap < MIN_GAP);
  assert.ok(rows.some((r) => r.where === 'quest world map'), 'the world map screen was measured');
  assert.ok(rows.length >= 20, 'expected to measure every screen (measured ' + rows.length + ')');
  assert.deepStrictEqual(tight, [], 'back buttons with less than ' + MIN_GAP + 'px of space below: ' + JSON.stringify(tight));
  console.log('OK: ' + rows.length + ' back buttons measured across ' + new Set(rows.map((r) => r.where)).size + ' screens, phone and desktop; the smallest gap is ' + Math.min(...rows.map((r) => r.gap)) + 'px (minimum ' + MIN_GAP + 'px).');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
