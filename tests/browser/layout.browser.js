// Browser test: wide layouts. On an iPad-sized or laptop screen each game puts its picture and its controls side by side so the game fits
// without scrolling; on a phone the columns stack and nothing overflows sideways. New games add a line to js/layout.js and are picked up here.
// Needs Playwright (not a repo dependency): node tests/browser/layout.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

const SIZES = [
  { name: 'iPad portrait', width: 820, height: 1100, side: true, fits: true },
  { name: 'iPad landscape / laptop', width: 1180, height: 820, side: true, fits: true },
  { name: 'phone', width: 375, height: 812, side: false, fits: false },
];
const FITS_ALLOWED_OVERFLOW = 40; // px; the page may scroll a hair past the window
const SKIP_FIT = new Set(['defense']); // the tower board is taller than a laptop window by design (it is capped, not split)

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const errors = [];
  const rows = [];
  for (const sz of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height }, hasTouch: sz.width < 700, isMobile: sz.width < 700 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(server.url);
    await page.click('.player-card.add'); await page.fill('#npName', 'Ada'); await page.selectOption('#npGrade', '5'); await page.click('#npForm button[type=submit]');
    await page.waitForSelector('#menu:not([hidden])');
    const games = await page.$$eval('[data-game]', (e) => e.map((x) => x.dataset.game));
    for (const g of games) {
      if (g === 'quest') continue; // its screens are not split yet
      await page.evaluate(() => { const s = [...document.querySelectorAll('main > .screen')].find((x) => !x.hidden); const b = s && s.querySelector('nav.crumbs .crumb[data-go=menu]'); if (b) b.click(); });
      if (!(await page.isVisible('#menu'))) { await page.goto(server.url); await page.click('.player-card:not(.add)'); }
      await page.click('[data-game=' + g + ']');
      await page.waitForSelector('#setup:not([hidden])');
      await page.click('#playNow');
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const sec = [...document.querySelectorAll('main > .screen')].find((x) => !x.hidden);
        const split = sec.querySelector('.split');
        const de = document.documentElement;
        const r = split ? [split.children[0].getBoundingClientRect(), split.children[1].getBoundingClientRect()] : null;
        return { id: sec.id, hasSplit: !!split, sideBySide: r ? r[1].left >= r[0].right - 2 && Math.abs(r[0].top - r[1].top) < 6 : false, scrollH: de.scrollHeight, hOverflow: de.scrollWidth > de.clientWidth + 1 };
      });
      if (g === 'escape') { // the lock panels differ in height: check all three chests of this room
        for (let i = 0; i < 3; i++) {
          await page.click('.esc-chest:nth-of-type(' + (i + 1) + ')').catch(() => {});
          await page.waitForTimeout(250);
          m.scrollH = Math.max(m.scrollH, await page.evaluate(() => document.documentElement.scrollHeight));
        }
      }
      rows.push({ size: sz.name, game: g, ...m });
      assert.strictEqual(m.hOverflow, false, g + ' overflows sideways on ' + sz.name);
      if (sz.side && m.hasSplit) assert.strictEqual(m.sideBySide, true, g + ' should be side by side on ' + sz.name);
      if (!sz.side && m.hasSplit) assert.strictEqual(m.sideBySide, false, g + ' should stack on ' + sz.name);
      if (sz.fits && m.hasSplit && !SKIP_FIT.has(g)) assert(m.scrollH <= sz.height + FITS_ALLOWED_OVERFLOW, g + ' should fit the ' + sz.name + ' window without scrolling (page ' + m.scrollH + ' px tall, window ' + sz.height + ')');
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  assert(rows.some((r) => r.hasSplit && r.size === 'iPad portrait'), 'split layouts were found');
  assert.deepStrictEqual(errors, []);
  console.log('OK: ' + rows.length + ' game screens checked at 3 sizes: side by side and fitting on iPad and laptop, stacked on a phone, nothing overflows sideways');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
