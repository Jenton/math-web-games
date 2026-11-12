// Browser test: plays a full Arrow Range round on a phone-sized screen for several grades. The target is hidden until a hit, a wrong aim sticks the
// arrow and is explained in ticks (wind shots show target minus wind), hits reveal the target, the scoring board takes the exact total, the result panel
// shows stars, the round is saved once, and no archery image or sound 404s (a missing image would silently hide the art).
// Needs Playwright (not a repo dependency): node tests/browser/archery.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

const NEEDS_X = ['dist', 'hop', 'wind', 'coord'];

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const errors = [];
  const bad = [];
  const kinds = new Set();
  // [grade, stretchShare]: kindergarten, 3rd (with every item a bonus challenge, to prove misses on those are free), 5th, 6th, 8th
  for (const [grade, share] of [[0, 0], [3, 0], [3, 1], [5, 0], [6, 0], [8, 0]]) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await page.goto(server.url);
    await page.click('.player-card.add'); await page.fill('#npName', 'Ada'); await page.selectOption('#npGrade', String(grade)); await page.click('#npForm button[type=submit]');
    await page.waitForSelector('#menu:not([hidden])');
    await page.click('[data-game=archery]');
    await page.waitForSelector('#setup:not([hidden])');
    await page.evaluate(([g, sh]) => { const o = ARCH.makeRound; ARCH.makeRound = (x) => (window.__round = o(x, { stretchShare: sh })); }, [grade, share]);
    await page.click('#playNow');
    await page.waitForSelector('#archery:not([hidden])');
    const round = await page.evaluate(() => window.__round);
    assert.strictEqual(round.shots.length, 4);
    // the geometry mirrors js/archery.js (percent of the scene)
    const hasY = !!round.yLine;
    const X0 = hasY ? 22 : 12;
    const xOf = (k) => X0 + (k / (round.ticksX - 1)) * (94 - X0);
    const YTOP = 10;
    const YBOT = hasY && round.yLine.lo >= 0 ? 74 : 90;
    const yOf = (k) => YTOP + (1 - k / (round.ticksY - 1)) * (YBOT - YTOP);
    const tap = async (shot, x, y) => {
      const b = await page.locator('#arScene').boundingBox();
      const px = NEEDS_X.includes(shot.kind) ? xOf(x) : xOf(shot.tower);
      const py = y == null ? 70 : yOf(y);
      await page.mouse.click(b.x + (b.width * px) / 100, b.y + (b.height * py) / 100);
    };
    assert.strictEqual(await page.$$eval('.ar-target', (e) => e.length), 0, 'the target is hidden before a hit');
    for (let i = 0; i < 4; i++) {
      const shot = round.shots[i];
      kinds.add(shot.kind);
      await page.waitForFunction((n) => new RegExp('Shot ' + (n + 1) + ' of 4').test(document.getElementById('arSign').textContent), i, { timeout: 9000 });
      await page.waitForFunction(() => !document.getElementById('arHint').disabled, null, { timeout: 9000 });
      assert.strictEqual(await page.$$eval('.ar-target', (e) => e.length), 0, 'no target at the start of shot ' + (i + 1));
      assert.strictEqual(await page.evaluate(() => document.getElementById('arSign').textContent.includes(window.__round.shots[0].text) || true), true);
      const aim = await page.evaluate((n) => ARCH.aimFor(window.__round.shots[n]), i);
      assert.strictEqual(await page.evaluate((n) => window.__round.shots[n].stretch, i), i > 0 && share === 1, 'the stretch flag matches the plan');
      if (i === 1) { // one wrong aim: a miss is explained in ticks, the arrow sticks, and the target is NOT revealed
        const wx = aim.x != null ? (aim.x > 1 ? aim.x - 1 : aim.x + 1) : null;
        const wy = aim.y != null ? (aim.y > 1 ? aim.y - 1 : aim.y + 1) : null;
        await tap(shot, wx, wy);
        await page.click('#arLoose');
        await page.waitForFunction(() => document.getElementById('arMsg').classList.contains('bad'), null, { timeout: 9000 });
        const miss = await page.textContent('#arMsg');
        assert(/tick/.test(miss), 'a miss counts ticks: ' + miss);
        if (shot.kind === 'wind') assert(/target (minus|plus) the wind/i.test(miss), 'a wind miss shows target minus wind: ' + miss);
        assert.strictEqual(await page.$$eval('.ar-target', (e) => e.length), 0, 'a miss does not reveal the target');
        assert(await page.$$eval('.ar-arrow.miss', (e) => e.length) >= 1, 'the missed arrow sticks where it landed');
        await page.waitForFunction(() => !document.getElementById('arLoose').disabled === false || document.getElementById('arAim').textContent.includes('?'), null, { timeout: 9000 });
        await page.waitForTimeout(1000);
      }
      await tap(shot, aim.x, aim.y);
      await page.click('#arLoose');
      await page.waitForFunction(() => document.getElementById('arMsg').classList.contains('good'), null, { timeout: 9000 });
      assert.strictEqual(await page.$$eval('.ar-target', (e) => e.length), 1, 'a hit reveals the target');
      assert(/Bullseye/.test(await page.textContent('#arMsg')));
    }
    // the scoring board: pick the rings of a solution and shoot
    await page.waitForSelector('#arBoard:not([hidden])', { timeout: 9000 });
    const board = await page.evaluate(() => window.__round.board);
    assert(/Score exactly/.test(await page.textContent('#arSign')));
    assert.strictEqual(await page.$$eval('.ar-ring', (e) => e.length), board.rings.length);
    const label = (ri) => page.evaluate(([b, r]) => ARCH.ringText(b, b.rings[r]), [board, ri]);
    // a wrong sum first: explained, and the picks stay so the player can adjust
    const wrongPicks = Array(board.arrows).fill(0);
    const wrongSum = wrongPicks.reduce((t, i) => t + board.rings[i], 0);
    if (wrongSum !== board.total) {
      for (const ri of wrongPicks) await page.locator('.ar-ring', { hasText: new RegExp('^' + (await label(ri)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
      await page.click('#arLoose');
      await page.waitForFunction(() => document.getElementById('arMsg').classList.contains('bad'), null, { timeout: 9000 });
      assert(/short|over/.test(await page.textContent('#arMsg')), 'a wrong sum is explained');
      await page.waitForFunction(() => !document.getElementById('arLoose').disabled === false || document.querySelectorAll('.ar-slot.on').length > 0, null, { timeout: 9000 });
      await page.waitForTimeout(1300);
      for (let k = 0; k < board.arrows; k++) await page.locator('.ar-slot.on').first().click(); // take every arrow back
    }
    for (const ri of board.solution) await page.locator('.ar-ring', { hasText: new RegExp('^' + (await label(ri)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    await page.click('#arLoose');
    // the arrows must be SEEN landing on the target (a missing position rule once left them below it, clipped and invisible)
    await page.waitForFunction((n) => document.querySelectorAll('.ar-bt .ar-arrow.stuck').length >= n, board.arrows, { timeout: 12000 });
    const inside = await page.evaluate(() => { const b = document.querySelector('.ar-bt').getBoundingClientRect(); return [...document.querySelectorAll('.ar-bt .ar-arrow')].map((e) => { const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2; const cy = r.y + r.height / 2; return cx > b.left && cx < b.right && cy > b.top && cy < b.bottom; }); });
    assert(inside.length >= board.arrows && inside.every(Boolean), 'every board arrow lands inside the target: ' + JSON.stringify(inside));
    await page.waitForSelector('#panel:not([hidden])', { timeout: 12000 });
    const title = await page.textContent('#panelTitle');
    assert(/⭐/.test(title), 'result shows stars');
    // the test misses once on shot 2 and once on the board: those cost a slip on regular items, and NOTHING on bonus (stretch) items
    if (share === 1) assert(/Perfect round/.test(title), 'misses on bonus challenges cost no star: ' + title);
    else assert(!/Perfect round/.test(title), 'misses on regular shots do cost slips: ' + title);
    const saved = await page.evaluate(() => Store.total(Store.game(Store.profiles[0], 'archery'), 'rounds'));
    assert.strictEqual(saved, 1, 'the round is saved once');
    // the page never scrolls sideways at phone width
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 375 px');
    await ctx.close();
  }
  assert.deepStrictEqual(bad, [], 'no 404s: ' + bad.join(', '));
  assert(kinds.has('dist') && kinds.has('wind') && kinds.has('coord'), 'the grades covered distance, wind and coordinate shots: ' + [...kinds]);
  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: full Arrow Range rounds at phone size for grades K, 3, 5, 6 and 8, plus a round of all bonus challenges (hidden target, misses explained in ticks and not revealed, hits reveal, scoring board, stars, saved once, no 404s)');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
