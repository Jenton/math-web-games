// Browser test for Creature Quest v2. Needs Playwright (not a repo dependency): node tests/browser/quest.browser.js
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { serve } = require('../helpers/static-server.js');
let URL;
const OUT = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'mq-quest-'));
const errors = [];

async function open(browser, vp, band, name, fast = true) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  if (fast) await ctx.addInitScript(() => { window.__questFast = true; });
  await page.goto(URL);
  await page.click('.player-card.add'); await page.fill('#npName', 'Kid ' + band); await page.selectOption('#npBand', band);
  await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');
  return { ctx, page };
}
const toQuest = async (page, stars = 1) => {
  await page.click('[data-game=quest]');
  await page.waitForSelector('#setup:not([hidden])');
  await page.locator('#setStars .opt-card').nth(stars - 1).click();
  await page.click('#playNow');
  await page.waitForSelector('#qHome:not([hidden])');
};
const st = (page) => page.evaluate(() => { const b = Quest._state().battle; return b && { over: b.over, turn: b.turn, target: b.target, teamHp: b.teamHp, foes: b.foes.map((f) => ({ i: f.i, alive: f.alive, hp: f.hp, ch: f.charging, name: f.enemy.name })), hand: RPG.currentHand(b).map((c) => c.correct), puzzle: b.puzzle && { max: b.puzzle.max }, busy: Quest._state().busy }; });
const idle = (page) => page.waitForFunction(() => !Quest._state().busy);
const panelUp = (page) => page.locator('#panel:not([hidden])').count();

/** Play the current battle to the end with perfect answers through the real buttons. */
async function winBattle(page, opts = {}) {
  let sawCharge = false;
  for (let guard = 0; guard < 60; guard++) {
    const s = await st(page);
    if (s.over || (await panelUp(page))) break;
    if (!(await page.locator('#qCharge').isHidden())) {
      sawCharge = true;
      const target = await page.evaluate(() => { const p = Quest._state().battle.puzzle; for (let v = 0; v <= p.max; v++) if (MGP.checkBalance(p, v).balanced) return v; });
      for (let k = 0; k < target; k++) await page.click('#qgPlus');
      if (opts.shotCharge) await page.screenshot({ path: path.join(OUT, opts.shotCharge) });
      await page.click('#qgLock');
      continue;
    }
    const alive = s.foes.filter((f) => f.alive).sort((a, b) => a.hp - b.hp)[0];
    if (alive.i !== s.target) await page.click('#foe' + alive.i);
    if (opts.ally !== undefined) await page.locator('.ally').nth(opts.ally).click();
    const s2 = await st(page);
    await page.locator('.qcard').nth(s2.hand.indexOf(true)).click();
    await idle(page);
  }
  await page.waitForSelector('#panel:not([hidden])');
  return { title: await page.textContent('#panelTitle'), text: await page.textContent('#panelText'), sawCharge };
}

(async () => {
  const server = await serve();
  URL = server.url;
  const browser = await chromium.launch();

  /* ===== 1. a full adventure (grade 4-5, 1 star) ===== */
  let { ctx, page } = await open(browser, { width: 1000, height: 1000 }, '4-5', 'adv');
  await toQuest(page);
  assert.match(await page.textContent('#qLevel'), /Level 1/);
  await page.click('#qBegin');
  const seenGroups = [];
  const seenRescues = [];
  for (let battle = 0; battle < 5; battle++) {
    await page.waitForSelector('#qPrep:not([hidden])');
    const foes = await page.$$eval('.pv-foe .e-name', (els) => els.map((e) => e.textContent));
    const rescue = (await page.locator('#qPvRescue').isHidden()) ? null : await page.textContent('#qPvRescue');
    seenGroups.push(foes.length); seenRescues.push(rescue);
    if (battle === 2) await page.screenshot({ path: path.join(OUT, 'prep-rescue.png') });
    await page.click('#qFight');
    await page.waitForSelector('#qBattle:not([hidden])');
    assert.strictEqual((await page.$$('.foe')).length, foes.length, 'one monster card per monster');
    if (battle === 3) await page.screenshot({ path: path.join(OUT, 'battle-group.png') });
    if (battle === 4) { // the boss: let two turns pass (wrong cards) so it charges on turn 3
      assert.ok(await page.locator('#qCharge').isHidden(), 'no charge on turn 1');
      for (let n = 0; n < 2; n++) {
        const s0 = await st(page);
        await page.locator('.qcard').nth(s0.hand.indexOf(false)).click();
        await idle(page);
        if (await panelUp(page)) await page.click('#panelBtn');
      }
      assert.ok(!(await page.locator('#qCharge').isHidden()), 'the boss charges a big attack on turn 3');
      assert.ok((await st(page)).foes.some((f) => f.ch), 'and its card shows it is charging');
      assert.ok((await page.textContent('.foe .e-tags')).includes('⚡') || (await page.$$eval('.e-tags', (e) => e.some((x) => x.textContent.includes('⚡')))));
      const target = await page.evaluate(() => { const p = Quest._state().battle.puzzle; for (let v = 0; v <= p.max; v++) if (MGP.checkBalance(p, v).balanced) return v; });
      for (let k = 0; k < target; k++) await page.click('#qgPlus');
      await page.screenshot({ path: path.join(OUT, 'battle-boss-charge.png') });
      const hpBeforeLock = (await st(page)).teamHp;
      await page.click('#qgLock');
      assert.match(await page.textContent('#qLog'), /Cancelled/);
      assert.ok(await page.locator('#qCharge').isHidden(), 'the puzzle goes away once solved');
      const s1 = await st(page);
      await page.locator('.qcard').nth(s1.hand.indexOf(false)).click(); // a wrong card on the stunned turn: the boss skips its attack
      await idle(page);
      if (await panelUp(page)) await page.click('#panelBtn');
      assert.ok((await st(page)).teamHp >= hpBeforeLock - 2 * 3, 'the cancelled boss did not hit (only the minion did)');
    }
    const r = await winBattle(page);
    console.log(`1.${battle + 1}`, foes.join(' + '), '=>', r.title, '|', r.text.slice(0, 120), r.sawCharge ? '(boss puzzle solved)' : '');
    await page.click('#panelBtn');
  }
  assert.deepStrictEqual(seenGroups, [1, 2, 2, 2, 2], 'group sizes at 1 star: 1, 2, 2, 2, 2');
  assert.ok(seenRescues[0] === null && seenRescues[1] === null && seenRescues[3] === null);
  assert.match(seenRescues[2], /trapped in a cage/); assert.match(seenRescues[4], /Pebble/);
  await page.waitForSelector('#qHome:not([hidden])');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mathQuest.v2')).profiles[0].games.rpg);
  const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum(saved.wins), 5); assert.strictEqual(sum(saved.bosses), 1);
  assert.ok(saved.creatures.includes('boss'), 'Pebble was freed by the boss fight');
  assert.strictEqual(saved.creatures.length, 5, 'three starters plus two rescued allies');
  assert.ok(sum(saved.xpEarned) > 100);
  console.log('1. adventure complete: wins', sum(saved.wins), '| XP', sum(saved.xpEarned), '| allies', saved.creatures.join(','));
  await ctx.close();

  /* ===== 2. targeting, retaliation you can SEE, wrong answers, allies (3 monsters, real animation timing) ===== */
  ({ ctx, page } = await open(browser, { width: 1000, height: 1100 }, '6', 'anim', false));
  await toQuest(page, 2);
  await page.click('#qBegin');
  // jump to a three-monster fight by playing through quickly with animations skipped
  await page.evaluate(() => { window.__questFast = true; });
  for (let battle = 0; battle < 3; battle++) {
    await page.waitForSelector('#qPrep:not([hidden])'); await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
    await winBattle(page); await page.click('#panelBtn');
  }
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.strictEqual((await page.$$('.pv-foe')).length, 3, 'a three-monster fight at 2 stars');
  await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
  await page.evaluate(() => { window.__questFast = false; }); // real timing from here
  assert.strictEqual((await page.$$('.foe')).length, 3);
  // targeting changes the weakness and the hand, and is free
  const w0 = await page.textContent('#qWeakTitle');
  const hand0 = await page.$$eval('.qcard .lbl', (e) => e.map((x) => x.textContent).join(','));
  await page.click('#foe1');
  const w1 = await page.textContent('#qWeakTitle');
  assert.notStrictEqual(w0, w1, 'each monster has its own weakness');
  assert.ok((await page.getAttribute('#foe1', 'class')).includes('target'));
  await page.click('#foe0');
  assert.strictEqual(await page.$$eval('.qcard .lbl', (e) => e.map((x) => x.textContent).join(',')), hand0, 'switching targets does not re-roll the hand');
  // allies: the team shows its special powers and a star for experts
  const allyText = await page.$$eval('.ally', (e) => e.map((x) => x.textContent));
  assert.ok(allyText.length >= 1 && allyText.every((t) => t.includes(' · ')), 'allies show their power');
  await page.screenshot({ path: path.join(OUT, 'battle-3foes.png') });
  // play a WRONG card and watch the three monsters hit back
  const hpBefore = (await st(page)).teamHp;
  const foeHp = (await st(page)).foes.map((f) => f.hp);
  const wrongIdx = (await st(page)).hand.indexOf(false);
  await page.locator('.qcard').nth(wrongIdx).click();
  await page.waitForSelector('.foe.lunge', { timeout: 3000 });
  await page.screenshot({ path: path.join(OUT, 'battle-retaliation.png') });
  await page.waitForSelector('.float.dmg', { timeout: 3000 });
  const lunged = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 4000 && !(await panelUp(page))) { (await page.$$eval('.foe.lunge', (e) => e.map((x) => x.id))).forEach((x) => lunged.add(x)); await page.waitForTimeout(40); }
  await page.waitForSelector('#panel:not([hidden])', { timeout: 5000 });
  assert.strictEqual(await page.textContent('#panelTitle'), 'Not quite!');
  console.log('2. wrong card explanation:', (await page.textContent('#panelText')).slice(0, 140));
  assert.ok(lunged.size >= 2, 'each living monster visibly attacked (' + [...lunged] + ')');
  const after = await st(page);
  assert.deepStrictEqual(after.foes.map((f) => f.hp), foeHp, 'a wrong answer damages nobody');
  assert.strictEqual(hpBefore - after.teamHp, 3 * 2, 'all three monsters hit for 2 each');
  await page.screenshot({ path: path.join(OUT, 'battle-wrong.png') });
  await page.click('#panelBtn');
  await page.evaluate(() => { window.__questFast = true; });

  /* ===== 3. losing is gentle: retry at full health, nothing lost ===== */
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mathQuest.v2')).profiles[0].games.rpg);
  for (let n = 0; n < 40; n++) {
    const s = await st(page);
    if (s.over) break;
    const w = s.hand.indexOf(false);
    await page.locator('.qcard').nth(w >= 0 ? w : 0).click();
    await idle(page);
    if ((await panelUp(page)) && /rest/.test(await page.textContent('#panelTitle'))) break;
    if (await panelUp(page)) await page.click('#panelBtn');
  }
  assert.match(await page.textContent('#panelTitle'), /needs a rest/);
  await page.screenshot({ path: path.join(OUT, 'battle-lose.png') });
  await page.click('#panelBtn'); // Try again
  const again = await st(page);
  assert.ok(!again.over && again.turn === 1 && again.foes.every((f) => f.alive && f.hp > 0), 'the fight restarts fresh');
  const afterLoss = await page.evaluate(() => JSON.parse(localStorage.getItem('mathQuest.v2')).profiles[0].games.rpg);
  assert.deepStrictEqual(afterLoss.creatures, before.creatures); assert.deepStrictEqual(afterLoss.xpEarned, before.xpEarned);
  console.log('3. lost a fight: retry started fresh, XP and allies unchanged');
  await ctx.close();

  /* ===== 4. phone layout ===== */
  ({ ctx, page } = await open(browser, { width: 390, height: 800 }, 'K-1', 'phone'));
  await toQuest(page, 3);
  await page.click('#qBegin');
  await page.waitForSelector('#qPrep:not([hidden])'); await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
  await winBattle(page); await page.click('#panelBtn');
  await page.waitForSelector('#qPrep:not([hidden])'); await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
  await page.screenshot({ path: path.join(OUT, 'phone-battle.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.ok(!overflow, 'no horizontal scrolling on a phone');
  await ctx.close();

  console.log('Screenshots:', OUT);
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  server.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
