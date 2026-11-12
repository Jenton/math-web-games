// Browser test: keyboard-only play of Escape Room (type digits, Backspace, Enter, arrows) and Cut & Share (up/down between the two entries,
// left/right or typing to change, Enter to share), plus keyboard hints that show on laptops and stay hidden on touch-only tablets until a key is pressed.
// Needs Playwright (not a repo dependency): node tests/browser/keyboard.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

async function newPlayer(page, url, band) {
  await page.goto(url);
  await page.click('.player-card.add'); await page.fill('#npName', 'Kai'); await page.selectOption('#npGrade', String({ 'K-1': 1, '2-3': 3, '4-5': 5, '6': 6 }[band])); await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  };

  /* ---- hints: laptop shows them, a touch-only tablet does not until a physical key is pressed ---- */
  {
    const laptop = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const lp = await laptop.newPage(); watch(lp);
    await newPlayer(lp, server.url, '2-3');
    assert.strictEqual(await lp.evaluate(() => document.documentElement.classList.contains('kbd')), true, 'laptop: keyboard mode on');
    await laptop.close();

    const tablet = await browser.newContext({ viewport: { width: 820, height: 1100 }, hasTouch: true, isMobile: true });
    const tp = await tablet.newPage(); watch(tp);
    await newPlayer(tp, server.url, '2-3');
    assert.strictEqual(await tp.evaluate(() => document.documentElement.classList.contains('kbd')), false, 'tablet without a keyboard: no hints');
    await tp.click('[data-game=share]'); await tp.click('#playNow');
    await tp.waitForSelector('#share:not([hidden])');
    assert.strictEqual(await tp.isVisible('#share .keyhint'), false, 'hint hidden on a touch-only tablet');
    await tp.keyboard.press('ArrowDown');
    assert.strictEqual(await tp.isVisible('#share .keyhint'), true, 'hint appears after the first physical key press (tablet with a keyboard)');
    await tablet.close();
  }

  /* ---- Escape Room with the keyboard only ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage(); watch(page);
    await newPlayer(page, server.url, '4-5');
    await page.evaluate(() => { const o = ESC.makeRoom; ESC.makeRoom = (b, s, n) => (window.__room = o(b, s, n)); });
    await page.click('[data-game=escape]'); await page.click('#playNow');
    await page.waitForSelector('#escape:not([hidden])');
    await page.waitForSelector('.esc-chest.active');
    for (let n = 0; n < 3; n++) {
      await page.waitForFunction(() => !document.querySelector('.esc-chest.active') ? false : true);
      const idx = await page.$$eval('.esc-chest', (c) => c.findIndex((x) => x.classList.contains('active')));
      const lock = await page.evaluate((i) => {
        const lk = window.__room.locks[i];
        const out = { kind: lk.kind, answer: lk.answer, digits: lk.digits, n: lk.n };
        if (lk.kind === 'machine') { // shortest chain by search, as indexes
          const p = lk.p;
          let fr = [{ v: p.start, path: [] }];
          const seen = new Set([p.start]);
          for (let d = 0; d < 8 && !out.path; d++) {
            const nx = [];
            for (const f of fr) for (let k = 0; k < p.ops.length; k++) { const v = MGP.stepMachine(p, k, f.v); if (v === null || seen.has(v)) continue; const path = f.path.concat(k); if (v === p.target) { out.path = path; break; } seen.add(v); nx.push({ v, path }); }
            fr = nx;
          }
        }
        if (lk.kind === 'balance') out.answer = lk.p.x;
        return out;
      }, idx);
      if (n === 0 && lock.kind !== 'machine') { // a wrong try first, by keyboard: it must be explained
        if (lock.kind === 'code') { for (const d of lock.digits) await page.keyboard.press(String((d + 1) % 10)); }
        else await page.keyboard.type(String(lock.answer + 1));
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => /\d/.test(document.querySelector('.esc-msg').textContent) && document.querySelector('.esc-msg').classList.contains('bad'), null, { timeout: 5000 });
        // clear what was typed with Backspace
        const clears = lock.kind === 'code' ? lock.digits.length + 1 : 4;
        for (let i = 0; i < clears; i++) await page.keyboard.press('Backspace');
        if (lock.kind === 'code') await page.keyboard.press('ArrowUp'), await page.keyboard.press('ArrowUp'), await page.keyboard.press('ArrowUp');
      }
      if (lock.kind === 'machine') for (const k of lock.path) await page.keyboard.press(String(k + 1));
      else if (lock.kind === 'code') { for (const d of lock.digits) await page.keyboard.press(String(d)); await page.keyboard.press('Enter'); }
      else { await page.keyboard.type(String(lock.answer).replace('-', '−') === String(lock.answer) ? String(lock.answer) : String(lock.answer).replace('−', '-')); await page.keyboard.press('Enter'); }
      await page.waitForFunction((i) => document.querySelectorAll('.esc-chest')[i].classList.contains('open'), idx, { timeout: 8000 });
      if (n < 2) await page.waitForFunction((i) => { const a = [...document.querySelectorAll('.esc-chest')].findIndex((x) => x.classList.contains('active')); return a >= 0 && a !== i; }, idx, { timeout: 8000 });
    }
    await page.waitForSelector('#panel:not([hidden])', { timeout: 10000 });
    assert(/escaped/i.test(await page.textContent('#panelTitle')), 'escaped with the keyboard alone');
    await ctx.close();
  }

  /* ---- Cut & Share with the keyboard only ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage(); watch(page);
    await newPlayer(page, server.url, '2-3');
    await page.evaluate(() => { const o = MGC.makeShare; MGC.makeShare = (b, s) => (window.__share = o(b, s)); });
    await page.click('[data-game=share]'); await page.click('#playNow');
    await page.waitForSelector('#share:not([hidden])');
    assert(await page.isVisible('#share .keyhint'), 'laptop sees the key hint');
    const ans = await page.evaluate(() => { const p = window.__share; for (let c = 1; c <= 24; c++) for (let s = 1; s <= 24; s++) if (MGC.checkShare(p, c, s).ok) return { c, s }; return null; });
    assert(ans, 'a fair share exists');
    // row 1 is "cut into" (highlighted first); ArrowDown goes to "each friend gets"; ArrowUp goes back
    assert.strictEqual(await page.evaluate(() => document.getElementById('cutRow').classList.contains('kb-row')), true);
    await page.keyboard.press('ArrowDown');
    assert.strictEqual(await page.evaluate(() => document.getElementById('eachRow').classList.contains('kb-row')), true, 'ArrowDown moves to the second entry');
    await page.keyboard.press('ArrowUp');
    assert.strictEqual(await page.evaluate(() => document.getElementById('cutRow').classList.contains('kb-row')), true, 'ArrowUp moves back');
    // type the cuts (two digits typed quickly make one number), then arrow down and set the slices each friend gets with the arrow keys
    await page.keyboard.type(String(ans.c));
    assert.strictEqual(await page.evaluate(() => document.getElementById('cutVal').textContent.replace(/\D/g, '')), String(ans.c), 'typed number sets the cuts');
    await page.keyboard.press('ArrowDown');
    for (let i = 1; i < ans.s; i++) await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.evaluate(() => document.getElementById('eachVal').textContent.replace(/\D/g, '')), String(ans.s), 'right arrow raised the second entry');
    if (ans.s > 1) { await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight'); } // left lowers it, right raises it back
    await page.keyboard.press('Enter');
    await page.waitForSelector('#panel:not([hidden])', { timeout: 5000 });
    const title = await page.textContent('#panelTitle');
    assert(/Fair shares/.test(title), 'Enter shared the pizza; got: ' + title + ' / ' + (await page.textContent('#panelText')) + ' / wanted ' + JSON.stringify(ans));
    await ctx.close();
  }

  /* ---- Arrow Range with the keyboard only (arrows aim, Enter shoots, number keys pick rings, Backspace takes one back, H hints) ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage(); watch(page);
    await newPlayer(page, server.url, 'K-1');
    await page.evaluate(() => { Store.setGrade(Store.profiles[0], 0); const o = ARCH.makeRound; ARCH.makeRound = (g) => (window.__round = o(g, { stretchShare: 0 })); });
    await page.click('[data-game=archery]'); await page.click('#playNow');
    await page.waitForSelector('#archery:not([hidden])');
    assert(await page.isVisible('#archery .keyhint'), 'laptop sees the Arrow Range key hint');
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction((n) => new RegExp('Shot ' + (n + 1) + ' of 4').test(document.getElementById('arSign').textContent) && !document.getElementById('arHint').disabled, i, { timeout: 9000 });
      const aim = await page.evaluate((n) => ARCH.aimFor(window.__round.shots[n]), i);
      for (let k = 0; k < aim.x; k++) await page.keyboard.press('ArrowRight');
      assert.strictEqual(await page.evaluate(() => document.getElementById('arLoose').disabled), false, 'a key aim enables Loose');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('arMsg').classList.contains('good'), null, { timeout: 9000 });
    }
    await page.waitForSelector('#arBoard:not([hidden])', { timeout: 9000 });
    const board = await page.evaluate(() => window.__round.board);
    const shown = board.rings.map((v, i) => i).sort((p, q) => board.rings[q] - board.rings[p]); // chips show the biggest ring first
    await page.keyboard.press('1');
    await page.keyboard.press('Backspace'); // takes the last arrow back
    assert.strictEqual(await page.$$eval('.ar-slot.on', (e) => e.length), 0, 'Backspace took the arrow back');
    for (const ri of board.solution) await page.keyboard.press(String(shown.indexOf(ri) + 1));
    await page.keyboard.press('Enter');
    await page.waitForSelector('#panel:not([hidden])', { timeout: 12000 });
    assert(/⭐/.test(await page.textContent('#panelTitle')), 'finished an Arrow Range round with the keyboard alone');
    await ctx.close();
  }

  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, []);
  console.log('OK: keyboard-only Escape Room (digits, Backspace, Enter, arrows, machine cards), Cut & Share (up/down rows, left/right, typing, Enter) and Arrow Range (arrows aim, Enter shoots, number keys pick rings); hints on laptops, hidden on touch-only tablets until a key is pressed');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
