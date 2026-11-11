// Browser test for Sort & Rule and Cut & Share: plays each through the real buttons (win and lose), and checks what the new-game checklist asks of
// a screen: its art loads (no 404s, which would silently fall back to emoji), no horizontal scroll at phone width, the floating sound button never
// covers the top-row pills, and the scene reacts to what the player does. Needs Playwright: node tests/browser/newgames.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const { serve } = require('../helpers/static-server.js');

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
  const errors = [];
  const missing = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400 && /\.(png|svg|jpg|webp)(\?|$)/.test(r.url())) missing.push(r.status() + ' ' + r.url()); });
  await page.goto(server.url);
  await page.click('.player-card.add');
  await page.fill('#npName', 'Kid');
  await page.click('#npForm button[type=submit]');
  await page.evaluate(() => {
    const s = MGR.makeSort; MGR.makeSort = (...a) => (window.__sort = s(...a));
    const c = MGC.makeShare; MGC.makeShare = (...a) => (window.__share = c(...a));
  });

  const screenChecks = async (label) => {
    // an image whose src was just swapped is briefly "not complete"; give it a moment before calling it broken
    await page.waitForFunction(() => [...document.querySelectorAll('main .screen:not([hidden]) img')].every((i) => !i.offsetParent || i.complete), null, { timeout: 3000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const scr = [...document.querySelectorAll('main .screen')].find((s) => !s.hidden);
      const btn = document.querySelector('.sound-btn').getBoundingClientRect();
      const covered = [...scr.querySelectorAll('.hud .pill, .hud button, .hud .crumb, .hud .hearts')].filter((e) => e.offsetParent).filter((e) => {
        const b = e.getBoundingClientRect();
        return b.left < btn.right && b.right > btn.left && b.top < btn.bottom && b.bottom > btn.top;
      }).map((e) => e.id || e.textContent.trim());
      const broken = [...scr.querySelectorAll('img')].filter((i) => i.offsetParent && (!i.complete || i.naturalWidth === 0)).map((i) => i.src);
      return { hscroll: document.documentElement.scrollWidth > window.innerWidth, covered, broken, imgs: scr.querySelectorAll('img').length };
    });
    assert.ok(!r.hscroll, label + ': horizontal scroll at 375px');
    assert.deepStrictEqual(r.covered, [], label + ': the sound button covers ' + r.covered.join(', '));
    assert.deepStrictEqual(r.broken, [], label + ': images that did not load: ' + r.broken.join(', '));
    return r;
  };

  /* ================= Sort & Rule ================= */
  await page.click('[data-game=sort]');
  await page.click('#playNow');
  const scene = await screenChecks('sort idle');
  assert.ok(scene.imgs >= 3, 'the gate scene has art (door, guard, emote), not emoji');
  assert.ok((await page.getAttribute('#sortGate', 'src')).endsWith('t46.png'), 'the door starts closed');
  assert.ok(await page.isHidden('#sortEmote'), 'no emote before anything is tested');
  const info = await page.evaluate(() => {
    const p = window.__sort;
    return { pass: p.tray.filter((v) => MGR.gate(p, v)), stop: p.tray.filter((v) => !MGR.gate(p, v)), correct: p.correct, n: p.options.length };
  });
  const tile = async (v) => page.locator('#sortTray .num-card', { hasText: new RegExp('^' + v + '$') }).first();
  assert.ok(info.pass.length && info.stop.length, 'the puzzle has numbers that pass and numbers that stop');
  await (await tile(info.pass[0])).click();
  assert.ok((await page.getAttribute('#sortGate', 'src')).endsWith('t10.png'), 'the door opens when a number goes through');
  assert.ok(await page.locator('#sortPass .sort-chip.pass').count() === 1, 'the number lands in the Let through lane as a tile');
  await (await tile(info.stop[0])).click();
  assert.ok((await page.getAttribute('#sortGate', 'src')).endsWith('t46.png'), 'the door stays shut for a number that is stopped');
  assert.ok(await page.isVisible('#sortEmote'), 'the guard reacts');
  assert.ok(await page.locator('#sortStop .sort-chip.stop').count() === 1, 'the stopped number lands in the Stopped lane');
  await screenChecks('sort mid');
  while (await page.isDisabled('#sortKnow')) { const t = await page.$$('#sortTray .num-card:not(:disabled)'); await t[0].click(); }
  // right answer
  await page.click('#sortKnow');
  await (await page.$$('#sortOpts .opt-card'))[info.correct].click();
  assert.match(await page.textContent('#panelTitle'), /cracked it/);
  assert.ok(await page.isVisible('#panelIcon'), 'the win panel has a medal');
  await screenChecks('sort win panel');
  await page.click('#panelBtn');
  // lose: every wrong option in turn
  while (await page.isDisabled('#sortKnow')) { const t = await page.$$('#sortTray .num-card:not(:disabled)'); await t[0].click(); }
  const info2 = await page.evaluate(() => ({ correct: window.__sort.correct, n: window.__sort.options.length }));
  const wrong = [...Array(info2.n).keys()].filter((i) => i !== info2.correct);
  for (const w of wrong) {
    await page.click('#sortKnow');
    await (await page.$$('#sortOpts .opt-card'))[w].click();
    if (/Not quite/.test(await page.textContent('#panelTitle'))) break;
    const hint = await page.textContent('#panelText');
    assert.ok(!/Test \d+ to tell/.test(hint), 'the hint says which number to test: "' + hint + '"');
    await page.click('#panelBtn');
  }
  assert.match(await page.textContent('#panelTitle'), /Not quite/, 'too many wrong rules ends the puzzle');
  await page.click('#panelBtn'); // dismiss the lose panel (Next puzzle), then leave
  await page.click('#sortBack');
  await page.click('#setupBack');

  /* ================= Cut & Share ================= */
  await page.click('[data-game=share]');
  await page.click('#playNow');
  const sc = await screenChecks('share idle');
  const F = await page.evaluate(() => window.__share.F);
  assert.strictEqual(await page.locator('#shFriends .friend').count(), F, 'one friend (an animal) per friend in the puzzle');
  assert.strictEqual(await page.locator('#shFriends .plate svg').count(), F, 'every friend has a plate showing their share');
  assert.ok(sc.imgs >= F, 'the friends are art, not emoji');
  const before = await page.locator('#shFriends .plate').first().innerHTML();
  await page.click('#cutPlus'); await page.click('#cutPlus'); await page.click('#eachPlus');
  assert.notStrictEqual(await page.locator('#shFriends .plate').first().innerHTML(), before, 'the plates change as you choose');
  await screenChecks('share mid');
  const sol = await page.evaluate(() => {
    const p = window.__share;
    const all = [];
    for (let c = 1; c <= MGC.MAX_CUTS; c++) for (let s = 1; s <= MGC.MAX_CUTS; s++) if (MGC.checkShare(p, c, s).ok) all.push([c, s]);
    return { all, par: p.par };
  });
  // one wrong try first (3 cuts / 1 each is wrong unless it is the solution), then the minimum cuts: the lost star must be explained honestly
  const best = sol.all.find(([c]) => c === sol.par);
  assert.ok(best, 'there is a solution at the minimum number of cuts');
  const setTo = async (c, s) => {
    for (let i = 0; i < 12; i++) { if (+(await page.textContent('#cutVal')).split(' ')[0] > c) await page.click('#cutMinus'); }
    for (let i = 0; i < 12; i++) { if (+(await page.textContent('#cutVal')).split(' ')[0] < c) await page.click('#cutPlus'); }
    for (let i = 0; i < 12; i++) { if (+(await page.textContent('#eachVal')).split(' ')[0] > s) await page.click('#eachMinus'); }
    for (let i = 0; i < 12; i++) { if (+(await page.textContent('#eachVal')).split(' ')[0] < s) await page.click('#eachPlus'); }
  };
  const wrongPair = [[1, 1], [2, 1], [1, 2], [3, 2]].find(([c, s]) => !sol.all.some(([a, b]) => a === c && b === s));
  await setTo(wrongPair[0], wrongPair[1]);
  await page.click('#shGo');
  assert.match(await page.textContent('#panelTitle'), /Not fair yet/);
  assert.ok(await page.isVisible('#panelIcon'), 'the wrong-try panel has an icon');
  await page.click('#panelBtn');
  await setTo(best[0], best[1]);
  await page.click('#shGo');
  assert.match(await page.textContent('#panelTitle'), /Fair shares/);
  const win = await page.textContent('#panelText');
  assert.ok(!/fewer cuts\?/.test(win), 'never ask for fewer cuts when the cuts were already the fewest: "' + win + '"');
  assert.match(win, /fewest cuts possible/);
  await screenChecks('share win panel');
  await page.click('#panelBtn');
  // lose: three wrong tries
  for (let k = 0; k < 3; k++) {
    await setTo(wrongPair[0], wrongPair[1]);
    await page.click('#shGo');
    if (k < 2) await page.click('#panelBtn');
  }
  assert.match(await page.textContent('#panelTitle'), /Out of tries/);

  await browser.close();
  server.close();
  assert.deepStrictEqual(missing, [], 'images that returned an error: ' + missing.join(', '));
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  console.log('OK: Sort & Rule and Cut & Share played through (win and lose) at 375px: art loads, the gate and plates react, the sound button covers nothing, and the win text is honest.');
  console.log('ERRORS: none');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
