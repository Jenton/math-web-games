// Browser test for the sync screens. Needs Playwright (not a repo dependency): run with  node tests/browser/sync-ui.browser.js
// Two simulated devices (separate browser profiles) share one in-memory fake cloud that enforces the Firestore rules.
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { makeBackend } = require('../helpers/fake-backend.js');
const { serve } = require('../helpers/static-server.js');
let URL;
const OUT = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'mq-sync-'));
const errors = [];
const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
const cloud = makeBackend();

async function device(browser, name, withBackend = true) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  if (!withBackend) await ctx.route('**/js/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* no config: cloud sync is not connected */' })); // this device must see no backend
  if (withBackend) {
    await ctx.exposeFunction('__bk', async (op, args) => {
      try { return { v: await cloud[op](...args) }; } catch (e) { return { err: { code: e.code || 'error', message: e.message } }; }
    });
    await ctx.addInitScript(() => {
      window.MathQuestSyncDebounceMs = 150;
      const mk = (e) => new window.Sync.SyncError(e.code, e.message);
      window.MathQuestBackend = {
        async get(id) { const r = await window.__bk('get', [id]); if (r.err) throw mk(r.err); return r.v; },
        async put(id, env, exp) { const r = await window.__bk('put', [id, env, exp]); if (r.err) throw mk(r.err); return r.v; },
      };
    });
  }
  await page.goto(URL);
  return { ctx, page, name };
}
async function goHome(page) {
  for (let i = 0; i < 5; i++) {
    if (await page.isVisible('#home')) return;
    for (const sel of ['#setupBack', '#menuBack']) if (await page.isVisible(sel)) { await page.click(sel); break; }
  }
}
const openBox = (page) => page.evaluate(() => (document.getElementById('syncBox').open = true));
const cloudData = async (dev) => {
  const Sync = require('../../js/sync.js');
  const creds = JSON.parse(await dev.page.evaluate(() => localStorage.getItem('mathQuest.sync')));
  return Sync.decryptEnvelope(await Sync.keysFromCreds(creds), [...cloud.docs.values()][0]);
};
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mathQuest.v2')));

(async () => {
  const server = await serve();
  URL = server.url;
  const browser = await chromium.launch();

  /* ---- 0. a site with no backend says so, and nothing breaks ---- */
  { const d = await device(browser, 'nobackend', false); await openBox(d.page);
    assert.ok(await d.page.isVisible('#syncUnavailable'), 'explains that sync is not connected');
    assert.ok(!(await d.page.isVisible('#syncOff')));
    await d.ctx.close(); }

  /* ---- 1. device A: create a player, set up sync, see the code ---- */
  const A = await device(browser, 'laptop');
  await A.page.click('.player-card.add'); await A.page.fill('#npName', 'Ada'); await A.page.click('#npForm button[type=submit]');
  await A.page.click('#menuBack');
  await openBox(A.page);
  assert.ok(await A.page.isVisible('#syncOff'), 'sync is off by default');
  assert.ok(!(await A.page.isVisible('#syncPill')));
  await A.page.screenshot({ path: path.join(OUT, 'a1-off.png') });
  await A.page.click('#syncSetupBtn');
  await A.page.screenshot({ path: path.join(OUT, 'a2-intro.png') });
  await A.page.click('#ssCreate');
  await A.page.waitForSelector('#ssCode:not([hidden])');
  const code = (await A.page.textContent('#ssCodeText')).trim();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/, 'a formatted family code is shown');
  assert.ok(await A.page.isDisabled('#ssDone'), 'Done stays disabled until the code is confirmed saved');
  await A.page.screenshot({ path: path.join(OUT, 'a3-code.png') });
  await A.page.click('#ssCopy');
  assert.strictEqual(await A.page.evaluate(() => navigator.clipboard.readText()), code, 'Copy puts the code on the clipboard');
  const [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.click('#ssSave')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  assert.ok(txt.includes(code) && /private/i.test(txt), 'the saved text file has the code and a privacy note');
  await A.page.check('#ssSaved');
  await A.page.click('#ssDone');
  assert.ok(await A.page.isVisible('#syncOn'));
  assert.match(await A.page.textContent('#syncPill'), /Synced/);
  assert.strictEqual(cloud.docs.size, 1, 'one cloud document was created');
  const raw = JSON.stringify([...cloud.docs.values()][0]);
  assert.ok(!Buffer.from(JSON.parse(raw).ct, 'base64').toString('latin1').includes('Ada'), 'the server never sees the name');
  await A.page.screenshot({ path: path.join(OUT, 'a4-on.png') });
  // the code can be shown again on this device
  await A.page.click('#syncShowBtn');
  assert.strictEqual((await A.page.textContent('#ssCodeText')).trim(), code);
  assert.ok(await A.page.isHidden('#ssSavedLabel'), 'viewing again has no "I saved it" checkbox');
  await A.page.click('#ssDone');
  console.log('1. device A set up sync; family code', code.slice(0, 4) + '-****-****-****', '| cloud docs:', cloud.docs.size);

  /* ---- 2. device B: typo fails safely, correct code (sloppily typed) works ---- */
  const B = await device(browser, 'pad');
  await openBox(B.page);
  await B.page.click('#syncJoinBtn');
  const typo = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A');
  await B.page.fill('#sjCode', typo);
  await B.page.click('#sjGo');
  await B.page.waitForFunction(() => !document.getElementById('sjError').hidden);
  assert.match(await B.page.textContent('#sjError'), /No family matches/);
  assert.strictEqual(cloud.docs.size, 1, 'a typo did not create a second family');
  await B.page.screenshot({ path: path.join(OUT, 'b1-typo.png') });
  await B.page.fill('#sjCode', 'hello');
  await B.page.click('#sjGo');
  await B.page.waitForFunction(() => /doesn't look like a family code/.test(document.getElementById('sjError').textContent));
  await B.page.fill('#sjCode', code.toLowerCase().replace(/-/g, ' '));
  await B.page.click('#sjGo');
  await B.page.waitForSelector('#syncJoin', { state: 'hidden' });
  await B.page.waitForSelector('.player-card .nm');
  assert.match(await B.page.textContent('.players'), /Ada/, 'the player appears on device B without a reload');
  assert.match(await B.page.textContent('#syncPill'), /Synced/);
  console.log('2. device B: typo and nonsense rejected without creating anything; the real code brought Ada over');

  /* ---- 3. play on B (real game), see it on A ---- */
  await B.page.click('.player-card:not(.add)'); await B.page.click('[data-game=balance]'); await B.page.click('#playNow');
  for (let i = 0; i < 60; i++) { await B.page.click('#gPlus'); await B.page.click('#balCheck'); if (await B.page.locator('#panel:not([hidden])').count()) break; }
  assert.match(await B.page.textContent('#panelTitle'), /Balanced/);
  await B.page.click('#panelBtn'); await B.page.click('#balBack');
  const revBefore = [...cloud.docs.values()][0].rev;
  await B.page.waitForFunction((r) => true, revBefore);
  await new Promise((r) => setTimeout(r, 1500)); // debounce (150 ms) + encryption + upload
  assert.ok([...cloud.docs.values()][0].rev > 1, 'the puzzle solved on B was uploaded in the background');
  await A.page.click('#syncNowBtn');
  await A.page.waitForFunction(() => /Synced/.test(document.getElementById('syncPill').textContent));
  const aStore = await stored(A.page);
  assert.strictEqual(sum(aStore.profiles[0].games.balance.levels), 1, 'A received the Balance puzzle B solved');
  console.log('3. Balance puzzle solved on B arrived on A; cloud rev', [...cloud.docs.values()][0].rev);

  /* ---- 4. both change things while apart, then both sync: nothing lost ---- */
  await A.page.evaluate(() => { const p = Store.profiles[0]; Store.bump(Store.game(p, 'munchers'), 'levels', 3); Store.record(p, 'primes', true); Store.save(); });
  cloud.offline = true; // B changes while the cloud is unreachable
  await B.page.evaluate(() => { const p = Store.profiles[0]; Store.bump(Store.game(p, 'machine'), 'levels', 2); Store.record(p, 'primes', false); Store.save(); });
  await B.page.waitForFunction(() => /Offline/.test(document.getElementById('syncPill').textContent), null, { timeout: 8000 });
  await goHome(B.page); await openBox(B.page);
  await B.page.screenshot({ path: path.join(OUT, 'b2-offline.png') });
  cloud.offline = false;
  await B.page.click('#syncNowBtn');
  await B.page.waitForFunction(() => /Synced/.test(document.getElementById('syncPill').textContent));
  await A.page.click('#syncNowBtn');
  await A.page.waitForFunction(() => Store.total(Store.game(Store.profiles[0], 'machine'), 'levels') === 2);
  await B.page.click('#syncNowBtn'); // B syncs once more to pick up what A pushed after B's turn
  await B.page.waitForFunction(() => Store.total(Store.game(Store.profiles[0], 'munchers'), 'levels') === 3);
  const fin = [await stored(A.page), await stored(B.page), await cloudData(A)];
  fin.forEach((d, i) => {
    const p = d.profiles[0];
    assert.strictEqual(sum(p.games.munchers.levels), 3, 'Munchers levels from A (device ' + i + ')');
    assert.strictEqual(sum(p.games.machine.levels), 2, 'Machine levels from B (device ' + i + ')');
    assert.strictEqual(sum(p.games.balance.levels), 1);
    const pr = Object.values(p.stats.primes).reduce((a, x) => ({ right: a.right + x.right, wrong: a.wrong + x.wrong }), { right: 0, wrong: 0 });
    assert.deepStrictEqual(pr, { right: 1, wrong: 1 }, 'stats from both devices (device ' + i + ')');
  });
  console.log('4. offline edits on both devices merged after reconnecting; A, B and the cloud all agree');

  /* ---- 5. a sync landing while a game is running must not lose what the game saves afterwards ---- */
  await goHome(B.page);
  await B.page.evaluate(() => Store.setSettings(Store.profiles[0], { monsters: 'off' })); // calm mode: no glitches, so every munch records exactly one answer
  await B.page.click('.player-card:not(.add)'); await B.page.click('[data-game=munchers]'); await B.page.click('#playNow');
  await B.page.waitForSelector('#board .cell');
  const answers = () => B.page.evaluate(() => { let n = 0; const p = Store.profiles[0]; Object.keys(p.stats).forEach((k) => { const s = Store.stat(p, k); n += s.right + s.wrong; }); return n; });
  const munch = async (i) => {
    await B.page.locator('.cell').nth(i).click();
    await B.page.waitForTimeout(1100);
    if (await B.page.locator('#panel:not([hidden])').count()) await B.page.click('#panelBtn');
  };
  await munch(0);
  const a0 = await answers();
  await B.page.evaluate(() => { window.__held = Store.profiles[0]; }); // the object the running game is holding
  await A.page.evaluate(() => { const p = Store.profiles[0]; Store.bump(Store.game(p, 'balance'), 'levels', 5); Store.save(); });
  await A.page.click('#syncNowBtn'); await A.page.waitForFunction(() => /Synced/.test(document.getElementById('syncPill').textContent));
  await B.page.evaluate(() => SyncUI._syncer().syncNow()); // a pull lands on B while its game screen is open
  await B.page.waitForFunction(() => Store.total(Store.game(Store.profiles[0], 'balance'), 'levels') === 6);
  assert.ok(await B.page.evaluate(() => Store.profiles[0] === window.__held), 'the merge updated the profile IN PLACE, so the running game still holds the live object');
  await munch(7); await munch(14); await munch(21);
  const a1 = await answers();
  assert.strictEqual(a1, a0 + 3, 'every answer the game recorded after the merge was saved (' + a0 + ' before, ' + a1 + ' after)');
  const persisted = await stored(B.page);
  const pCount = Object.keys(persisted.profiles[0].stats).reduce((n, k) => n + Object.values(persisted.profiles[0].stats[k]).reduce((x, d) => x + d.right + d.wrong, 0), 0);
  assert.strictEqual(pCount, a1, 'and it is in what was written to storage');
  await B.page.click('#gameMenu');
  console.log('5. a sync that landed during a Munchers game kept the game\'s profile live; the 3 answers after it were saved (' + a0 + ' -> ' + a1 + ')');

  /* ---- 6. stop syncing on B ---- */
  await goHome(B.page);
  await openBox(B.page);
  B.page.once('dialog', (d) => d.accept());
  await B.page.click('#syncStopBtn');
  assert.ok(await B.page.isVisible('#syncOff'));
  assert.strictEqual(await B.page.evaluate(() => localStorage.getItem('mathQuest.sync')), null, 'credentials removed');
  assert.strictEqual(cloud.docs.size, 1, 'the cloud copy is untouched');
  assert.ok((await B.page.textContent('.players')).includes('Ada'), 'players stay on the device');
  console.log('6. stop syncing: credentials removed, players kept, cloud untouched');

  /* ---- 7. after a restart, device A is still syncing ---- */
  await A.page.reload();
  await A.page.waitForFunction(() => document.getElementById('syncPill') && !document.getElementById('syncPill').hidden && /Synced/.test(document.getElementById('syncPill').textContent), null, { timeout: 8000 });
  console.log('7. after reloading, device A resumed syncing on its own');

  await A.ctx.close(); await B.ctx.close();
  console.log('Screenshots:', OUT);
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  server.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
