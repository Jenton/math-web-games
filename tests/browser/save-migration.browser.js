// Browser test for saving: migrates a v1 save, plays all four games, backups, and merging two devices.
// Needs Playwright (not a repo dependency): node tests/browser/save-migration.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs0 = require('fs');
const OUT = fs0.mkdtempSync(path.join(os.tmpdir(), 'mq-save-')) + path.sep;
const { serve } = require('../helpers/static-server.js');
let PAGE_URL;
const errors = [];
const V1 = {
  version: 1, lastSaved: 1731000000000,
  profiles: [{
    id: 'pOld', name: 'Max', avatar: '🦊',
    settings: { band: '2-3', stars: 1, theme: 'creature', monsters: 'on' },
    stats: { multiples: { right: 12, wrong: 4 }, balance: { right: 3, wrong: 2 } },
    munchers: { levels: 6, streak: 2 }, balance: { levels: 3 }, machine: { levels: 2 },
    rpg: { xp: 25, level: 3, creatures: ['multiples', 'expressions', 'rounding', 'armor'], team: ['multiples', 'armor'], wins: 7, bosses: 1 },
  }],
};
const v2 = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mathQuest.v2')));
const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);

async function newPage(browser, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => { window.__questFast = true; }); // skip battle animation delays
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (seed) await page.addInitScript((v) => { if (!localStorage.getItem('mathQuest.v2') && !localStorage.getItem('seeded')) { localStorage.setItem('mathQuest.v1', JSON.stringify(v)); localStorage.setItem('seeded', '1'); } }, seed);
  await page.goto(PAGE_URL);
  return { ctx, page };
}

(async () => {
  const server = await serve();
  PAGE_URL = server.url;
  const browser = await chromium.launch();

  /* ===== 1. migrate a real v1 save ===== */
  let { ctx, page } = await newPage(browser, V1);
  let d = await v2(page);
  assert.strictEqual(d.schemaVersion, 2, 'v2 save written on first load');
  const old = await page.evaluate(() => localStorage.getItem('mathQuest.v1'));
  assert.deepStrictEqual(JSON.parse(old), V1, 'v1 data left untouched as a backup');
  const dev = await page.evaluate(() => Store.deviceId);
  const p = d.profiles[0];
  assert.strictEqual(sum(p.games.munchers.levels), 6);
  assert.strictEqual(sum(p.games.rpg.xpEarned), 25 + 40 + 60, 'XP total preserved across the level curve');
  console.log('1. migrated v1 -> v2; v1 backup untouched; players:', d.profiles.length, '| Max total XP:', sum(p.games.rpg.xpEarned));

  await page.click('.player-card'); // open Max
  await page.click('#menu summary');
  console.log('   grown-ups panel:', (await page.textContent('#levelsCleared')).trim());
  assert.match(await page.textContent('#levelsCleared'), /6 Munchers levels, 3 Balance puzzles, 2 Machine puzzles solved, 0 Lemonade days run, 0 Defense waves held, 0 Escape Rooms cleared, 7 Quest battles won/);
  const stats = await page.textContent('#statsList');
  assert.match(stats, /12 right, 4 oops/);

  /* ===== 2. Creature Quest shows the migrated progress and saves new progress ===== */
  await page.click('[data-game=quest]'); await page.click('#playNow');
  console.log('   quest home:', (await page.textContent('#qLevel')), '|', (await page.textContent('#qXpText')), '|', (await page.textContent('#qStats')));
  assert.match(await page.textContent('#qLevel'), /Level 3/);
  assert.match(await page.textContent('#qXpText'), /25 \/ 80 XP to level 4/);
  assert.match(await page.textContent('#qStats'), /7 battles won .* 4 of 22 friends/);
  await page.click('#qBegin'); await page.click('#qFight');
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => { const b = Quest._state().battle; return { over: b.over, hand: RPG.currentHand(b).map((c) => c.correct), foes: b.foes.map((f) => ({ i: f.i, alive: f.alive, hp: f.hp })), target: b.target }; });
    if (st.over) break;
    const foe = st.foes.filter((f) => f.alive).sort((a, b) => a.hp - b.hp)[0];
    if (foe.i !== st.target) await page.click('#foe' + foe.i);
    const hand = await page.evaluate(() => RPG.currentHand(Quest._state().battle).map((c) => c.correct));
    await page.locator('.qcard').nth(hand.indexOf(true)).click();
    await page.waitForFunction(() => !Quest._state().busy);
    if (await page.locator('#panel:not([hidden])').count()) break;
  }
  await page.waitForSelector('#panel:not([hidden])');
  console.log('   battle result:', await page.textContent('#panelTitle'), '|', await page.textContent('#panelText'));
  d = await v2(page);
  assert.strictEqual(sum(d.profiles[0].games.rpg.wins), 8, 'win counted');
  assert.ok(sum(d.profiles[0].games.rpg.xpEarned) > 125, 'XP added');
  assert.ok(d.profiles[0].games.rpg.xpEarned[dev] > 0 && d.profiles[0].games.rpg.wins[dev] === 1 || d.profiles[0].games.rpg.wins[dev] >= 1, 'new progress filed under this device');
  await page.click('#panelBtn'); // next battle prep
  await page.click('#qPrepBack'); // back to home
  await page.reload();
  await page.click('.player-card'); await page.click('[data-game=quest]'); await page.click('#playNow');
  console.log('   after reload:', await page.textContent('#qLevel'), '|', await page.textContent('#qStats'));
  assert.match(await page.textContent('#qStats'), /8 battles won/);

  /* ===== 3. Balance, Machine Builder (including "Try this one again"), Munchers still work and save ===== */
  await page.click('#qBack'); await page.click('#setupBack');
  await page.click('[data-game=balance]'); await page.click('#playNow');
  for (let i = 0; i < 60; i++) { await page.click('#gPlus'); await page.click('#balCheck'); if (await page.locator('#panel:not([hidden])').count()) break; }
  assert.match(await page.textContent('#panelTitle'), /Balanced/);
  await page.click('#panelBtn'); await page.click('#balBack'); await page.click('#setupBack');

  await page.click('[data-game=machine]'); await page.click('#playNow');
  const solveMachine = async () => {
    const title = await page.textContent('#macTitle'); const [, s, t] = title.match(/Turn (−?\d+) into (−?\d+)/).map(x => +x.replace('−', '-') || x);
    const start = +title.match(/Turn (−?\d+)/)[1].replace('−', '-'), target = +title.match(/into (−?\d+)/)[1].replace('−', '-');
    const labels = await page.$$eval('#macOps button', bs => bs.map(b => b.textContent.trim()));
    const ops = labels.map(l => { const n = +l.replace(/[^0-9]/g, ''); return l.startsWith('+') ? v => v + n : l.startsWith('−') ? v => v - n : l.startsWith('×') ? v => v * n : l.startsWith('÷') ? v => (v % n === 0 ? v / n : null) : v => v * v; });
    const seen = new Map([[start, []]]); let fr = [start];
    while (!seen.has(target) && fr.length) { const nx = []; for (const v of fr) ops.forEach((f, i) => { const r = f(v); if (r !== null && r >= 0 && r <= 100 && !seen.has(r)) { seen.set(r, seen.get(v).concat(i)); nx.push(r); } }); fr = nx; }
    for (const i of seen.get(target)) await page.locator('#macOps button').nth(i).click();
  };
  await solveMachine();
  await page.waitForSelector('#panel:not([hidden])'); // the result panel opens after a short celebration
  assert.match(await page.textContent('#panelTitle'), /Target reached/);
  let before = sum((await v2(page)).profiles[0].games.machine.levels);
  await page.click('#panelBtn2'); // Try this one again
  await solveMachine();
  await page.waitForSelector('#panel:not([hidden])');
  let after = sum((await v2(page)).profiles[0].games.machine.levels);
  assert.strictEqual(after, before, 'solving the same puzzle again does not count twice (counters only go up)');
  await page.click('#panelBtn'); await page.click('#macBack'); await page.click('#setupBack');
  console.log('3. Balance and Machine Builder play and save; machine levels', before, '->', after, 'after replaying the same puzzle');

  await page.click('[data-game=munchers]'); await page.click('#playNow');
  await page.waitForSelector('#board .cell');
  for (let i = 0; i < 6; i++) { await page.locator('.cell').nth(i * 3).click(); await page.waitForTimeout(900); if (await page.locator('#panel:not([hidden])').count()) await page.click('#panelBtn'); }
  const ms = (await v2(page)).profiles[0].stats;
  console.log('   Munchers recorded stats for:', Object.keys(ms).join(', '));
  await page.click('#gameMenu');

  /* ===== 4. backups: v2 export round-trips, and an old v1 backup file still imports ===== */
  await page.click('#setupBack'); await page.click('#menuBack');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupBtn')]);
  await dl.saveAs(OUT + 'backup-v2.json');
  const exported = JSON.parse(require('fs').readFileSync(OUT + 'backup-v2.json', 'utf8'));
  assert.strictEqual(exported.schemaVersion, 2);
  require('fs').writeFileSync(OUT + 'backup-v1.json', JSON.stringify(V1));
  page.once('dialog', x => x.accept());
  await page.setInputFiles('#restoreInput', OUT + 'backup-v1.json');
  await page.waitForTimeout(400);
  const restored = await v2(page);
  assert.strictEqual(sum(restored.profiles[0].games.munchers.levels), 6, 'a v1 backup file imports and migrates');
  console.log('4. v2 backup exports; an old v1 backup file imports and migrates');
  await ctx.close();

  /* ===== 5. two devices ===== */
  const A = await newPage(browser, null), B = await newPage(browser, null);
  const play = async (pg, name) => {
    await pg.click('.player-card.add'); await pg.fill('#npName', name); await pg.click('#npForm button[type=submit]');
  };
  // device A creates the player; B receives it by merging A's save (what sync will do)
  await play(A.page, 'Sam');
  const aSave1 = await A.page.evaluate(() => Store.exportJSON());
  await B.page.evaluate((j) => { const e = Store.mergeIn(JSON.parse(j)); if (e) throw new Error(e); }, aSave1);
  assert.strictEqual(await B.page.evaluate(() => Store.profiles.length), 1);
  // both play offline: A wins quest battles, B plays Balance puzzles and changes a setting later
  const act = (pg, fn) => pg.evaluate(fn);
  await act(A.page, () => { const p = Store.profiles[0]; RPG.ensureState(p); const r = p.games.rpg; RPG.applyRewards(r, { xp: 50, creature: 'multiples', kind: 'weakness' }, Store.deviceId); RPG.applyRewards(r, { xp: 20, creature: 'primes', kind: 'weakness' }, Store.deviceId); Store.record(p, 'multiples', true); Store.record(p, 'multiples', false); Store.save(); });
  await act(B.page, () => { const p = Store.profiles[0]; RPG.ensureState(p); const r = p.games.rpg; RPG.applyRewards(r, { xp: 40, creature: 'factors', kind: 'weakness' }, Store.deviceId); Store.bump(Store.game(p, 'balance'), 'levels', 4); Store.record(p, 'multiples', true); Store.setSettings(p, { stars: 3 }); Store.save(); });
  const sa = await A.page.evaluate(() => Store.exportJSON()), sb = await B.page.evaluate(() => Store.exportJSON());
  await A.page.evaluate((j) => Store.mergeIn(JSON.parse(j)), sb);
  await B.page.evaluate((j) => Store.mergeIn(JSON.parse(j)), sa);
  const mA = await v2(A.page), mB = await v2(B.page);
  const pa = mA.profiles[0], pb = mB.profiles[0];
  console.log('5. two devices merged:', 'wins', sum(pa.games.rpg.wins), '| XP', sum(pa.games.rpg.xpEarned), '| creatures', pa.games.rpg.creatures.join(','), '| balance', sum(pa.games.balance.levels), '| multiples', JSON.stringify(await A.page.evaluate(() => Store.stat(Store.profiles[0], 'multiples'))), '| stars', pa.settings.stars);
  assert.strictEqual(sum(pa.games.rpg.wins), 3, 'A won 2 battles and B won 1');
  assert.strictEqual(sum(pa.games.rpg.xpEarned), 110);
  assert.strictEqual(sum(pa.games.balance.levels), 4);
  assert.deepStrictEqual(await A.page.evaluate(() => Store.stat(Store.profiles[0], 'multiples')), { right: 2, wrong: 1 });
  assert.strictEqual(pa.settings.stars, 3, 'the newer setting wins');
  assert.deepStrictEqual(pa.games.rpg.creatures, pb.games.rpg.creatures);
  assert.ok(['factors', 'multiples', 'primes'].every(c => pa.games.rpg.creatures.includes(c)), 'creatures from both devices are kept');
  assert.deepStrictEqual(pa.stats, pb.stats);
  await A.ctx.close(); await B.ctx.close();

  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  server.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
