// Browser test for the Creature Quest WORLD MAP. Needs Playwright (not a repo dependency): node tests/browser/map.browser.js
// Plays a whole region through the real buttons: the locked-spot rule, a story spot, groups of 1/2/3 monsters, the armored fight, a rescue
// that frees a friend (and the already-a-friend replay), the boss that opens the next region, saving, backing out to the map, a sync
// redrawing the map, the cute theme and a phone. Data rules are in tests/worldmap.test.js; this checks the screens wire them up.
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { serve } = require('../helpers/static-server.js');
let URL;
const OUT = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'mq-map-'));
const errors = [];

async function open(browser, vp, band, name) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await ctx.addInitScript(() => { window.__questFast = true; }); // skips animation waits, including the token walk
  await page.goto(URL);
  await page.click('.player-card.add'); await page.fill('#npName', 'Kid ' + band); await page.selectOption('#npBand', band);
  await page.click('#npForm button[type=submit]');
  await page.waitForSelector('#menu:not([hidden])');
  return { ctx, page };
}
const toQuest = async (page, stars = 2) => {
  await page.click('[data-game=quest]');
  await page.waitForSelector('#setup:not([hidden])');
  await page.locator('#setStars .opt-card').nth(stars - 1).click();
  await page.click('#playNow');
  await page.waitForSelector('#qHome:not([hidden])');
};
const toMap = async (page) => { await page.click('#qMapBtn'); await page.waitForSelector('#qMap:not([hidden])'); };
const st = (page) => page.evaluate(() => { const b = Quest._state().battle; return b && { over: b.over, turn: b.turn, target: b.target, teamHp: b.teamHp, foes: b.foes.map((f) => ({ i: f.i, alive: f.alive, hp: f.hp })), hand: RPG.currentHand(b).map((c) => c.correct), busy: Quest._state().busy }; });
const idle = (page) => page.waitForFunction(() => !Quest._state().busy);
const panelUp = (page) => page.locator('#panel:not([hidden])').count();
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mathQuest.v2')).profiles[0].games.rpg);
const nodeStates = (page) => page.$$eval('.mnode', (els) => Object.fromEntries(els.map((e) => [e.dataset.id, ['cleared', 'open', 'locked'].find((c) => e.classList.contains(c))])));
const openIds = async (page) => Object.entries(await nodeStates(page)).filter(([, s]) => s === 'open').map(([id]) => id).sort();

/** Play the current battle to the end with perfect answers through the real buttons (solving the boss puzzle when it charges). */
async function winBattle(page) {
  for (let guard = 0; guard < 80; guard++) {
    const s = await st(page);
    if (s.over || (await panelUp(page))) break;
    if (!(await page.locator('#qCharge').isHidden())) {
      const target = await page.evaluate(() => { const p = Quest._state().battle.puzzle; for (let v = 0; v <= p.max; v++) if (MGP.checkBalance(p, v).balanced) return v; });
      for (let k = 0; k < target; k++) await page.click('#qgPlus');
      await page.click('#qgLock');
      continue;
    }
    const alive = s.foes.filter((f) => f.alive).sort((a, b) => a.hp - b.hp)[0];
    if (alive.i !== s.target) await page.click('#foe' + alive.i);
    const s2 = await st(page);
    await page.locator('.qcard').nth(s2.hand.indexOf(true)).click();
    await idle(page);
  }
  await page.waitForSelector('#panel:not([hidden])');
  return { title: await page.textContent('#panelTitle'), text: await page.textContent('#panelText') };
}
/** Tap a spot, read any story lines, and (for a fight) return what the prep screen shows. */
async function goTo(page, id) {
  await page.click('.mnode[data-id="' + id + '"]');
  // the first thing that happens is a story panel, a fight prep or a puzzle (the map is already showing, so it can't be what we wait for)
  await page.waitForSelector('#panel:not([hidden]), #qPrep:not([hidden]), #qPuzzle:not([hidden])');
  // each story line is shown, then the next one (or the spot itself) follows immediately, so a click's result is final when it returns
  for (let n = 0; n < 8 && (await panelUp(page)); n++) await page.click('#panelBtn');
}
const prepInfo = async (page) => ({
  label: await page.textContent('#qRun'),
  foes: await page.$$eval('.pv-foe .e-name', (els) => els.map((e) => e.textContent)),
  rescue: (await page.locator('#qPvRescue').isHidden()) ? null : await page.textContent('#qPvRescue'),
});
async function fight(page, atStart) {
  await page.click('#qFight');
  await page.waitForSelector('#qBattle:not([hidden])');
  if (atStart) await atStart();
  return winBattle(page);
}
const shieldNow = (page) => page.evaluate(() => Quest._state().battle.shield);
/** The answer to the open Balance puzzle spot (the test reads it from the puzzle itself). */
const balanceAnswer = (page) => page.evaluate(() => { const p = Quest._state().pz.p; for (let v = 0; v <= p.max; v++) if (MGP.checkBalance(p, v).balanced) return v; });
/** Move the guess with the real + and - buttons. */
const setGuess = async (page, from, to) => {
  const plus = page.locator('#qPzBody .guess button[aria-label="plus 1"]');
  const minus = page.locator('#qPzBody .guess button[aria-label="minus 1"]');
  for (let k = from; k < to; k++) await plus.click();
  for (let k = from; k > to; k--) await minus.click();
};
/** The fewest-steps chain for the open Machine puzzle spot (breadth-first search over its own cards). */
const machineBest = (page) => page.evaluate(() => {
  const p = Quest._state().pz.p;
  let frontier = [{ v: p.start, path: [] }];
  const seen = new Set([p.start]);
  for (let d = 0; d < 8; d++) {
    const next = [];
    for (const f of frontier) for (let i = 0; i < p.ops.length; i++) {
      const v = MGP.stepMachine(p, i, f.v);
      if (v === null || seen.has(v)) continue;
      const path = f.path.concat(i);
      if (v === p.target) return path;
      seen.add(v); next.push({ v, path });
    }
    frontier = next;
  }
  return null;
});

(async () => {
  const server = await serve();
  URL = server.url;
  const browser = await chromium.launch();

  /* ===== 1. a whole region (grade 2-3, 2 stars: groups of up to 3) ===== */
  let { ctx, page } = await open(browser, { width: 1000, height: 1000 }, '2-3', 'region');
  await toQuest(page, 2);
  await toMap(page);
  assert.strictEqual(await page.textContent('#qMapName'), 'Multiples Meadow');
  assert.strictEqual((await page.$$('.mnode')).length, 9, 'seven spots on the path plus the optional picnic and the bridge puzzle');
  assert.deepStrictEqual(await openIds(page), ['m1'], 'only the first spot is open');
  assert.ok(await page.locator('#qMapPrev').isHidden(), 'one region so far: no arrows');
  await page.screenshot({ path: path.join(OUT, 'map-start.png') });

  // a locked spot refuses, and the map stays
  await page.click('.mnode[data-id="m3"]');
  assert.match(await page.textContent('#toast'), /Clear the path/);
  assert.ok(await page.locator('#qMap:not([hidden])').count(), 'still on the map');

  // m1: one monster
  await goTo(page, 'm1');
  await page.waitForSelector('#qPrep:not([hidden])');
  let p = await prepInfo(page);
  assert.strictEqual(p.label, 'Meadow gate', 'the prep screen names the map spot');
  assert.strictEqual(p.foes.length, 1);
  await page.click('#qPrepBack'); // backing out returns to the MAP, not the quest home
  await page.waitForSelector('#qMap:not([hidden])');
  assert.deepStrictEqual(await openIds(page), ['m1'], 'backing out cleared nothing');
  await goTo(page, 'm1');
  await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
  assert.strictEqual(await page.textContent('#qRunPill'), 'Meadow gate');
  await page.click('#qFlee'); // leaving a fight also returns to the map
  await page.waitForSelector('#qMap:not([hidden])');
  await goTo(page, 'm1');
  let r = await fight(page);
  assert.strictEqual(r.title, 'Victory! 🎉');
  assert.strictEqual(await page.textContent('#panelBtn'), 'Back to the map');
  await page.click('#panelBtn');
  await page.waitForSelector('#qMap:not([hidden])');
  let s = await saved(page);
  assert.deepStrictEqual(s.cleared, ['m1']); assert.deepStrictEqual(s.gold, ['m1'], 'a flawless fight earns a gold star');
  assert.deepStrictEqual(await openIds(page), ['m2'], 'clearing a spot opens the next');
  assert.match(await page.textContent('#qMapStars'), /1 of 9 spots · 1/);
  assert.strictEqual(await page.$eval('#qToken', (e) => e.style.left), '8%', 'your friend stands on the cleared spot');
  console.log('1.1 first fight cleared with a gold star');

  // m2: a story spot (two lines, never any math), then the path forks into the optional picnic
  await page.click('.mnode[data-id="m2"]');
  await page.waitForSelector('#panel:not([hidden])');
  assert.ok((await page.textContent('#panelTitle')).includes('The talking sign'));
  assert.strictEqual(await page.textContent('#panelBtn'), 'Next');
  await page.click('#panelBtn'); await page.waitForSelector('#panel:not([hidden])');
  assert.strictEqual(await page.textContent('#panelBtn'), 'Continue');
  await page.click('#panelBtn');
  await page.waitForSelector('#qMap:not([hidden])');
  s = await saved(page);
  assert.ok(s.cleared.includes('m2') && !s.gold.includes('m2'), 'story spots clear but never earn a star');
  assert.deepStrictEqual(await openIds(page), ['m2c', 'm3'], 'the path forks: the picnic is optional');

  // the picnic camp is optional and gives the NEXT fight a head start (a shield) until that fight is won
  await goTo(page, 'm2c'); // its story lines, then back to the map
  await page.waitForSelector('#qMap:not([hidden])');
  assert.match(await page.textContent('#qMapHint'), /Rested: .*shield/, 'the map says you are rested');
  assert.ok((await saved(page)).cleared.includes('m2c'));

  // groups grow: m3 is 2 monsters, m4 is 3 (at 2 stars), m5 is armored
  const sizes = {};
  const shields = {};
  for (const id of ['m3', 'm4', 'm5']) {
    await goTo(page, id);
    await page.waitForSelector('#qPrep:not([hidden])');
    p = await prepInfo(page);
    sizes[id] = p.foes.length;
    if (id === 'm5') assert.ok(p.foes.some((f) => /Armored/.test(f)), 'the elite spot has an armored monster');
    const weak = await page.$$eval('.pv-weak', (e) => e.map((x) => x.textContent));
    assert.strictEqual(new Set(weak).size, weak.length, 'monsters in a group have different weaknesses');
    if (id === 'm4') await page.screenshot({ path: path.join(OUT, 'prep-3-monsters.png') });
    r = await fight(page, async () => {
      shields[id] = await shieldNow(page);
      if (id === 'm3') assert.match(await page.textContent('#qLog'), /Cozy fire/, 'the battle log says why you have a shield');
    });
    assert.strictEqual(r.title, 'Victory! 🎉');
    await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
    if (id === 'm3') assert.ok(!/Rested/.test(await page.textContent('#qMapHint')), 'the head start is used up once that fight is won');
  }
  assert.deepStrictEqual(sizes, { m3: 2, m4: 3, m5: 2 });
  assert.deepStrictEqual(shields, { m3: 1, m4: 0, m5: 0 }, 'only the fight right after the camp starts with the shield');
  console.log('1.2 groups of', sizes.m3, sizes.m4, sizes.m5, 'monsters cleared; the camp shield was used once');

  // the wobbly bridge: an optional Balance puzzle spot with no monsters. A wrong lock explains itself and costs nothing; solving pays XP
  assert.ok((await openIds(page)).includes('m4p'), 'the bridge puzzle opened after the fight before it');
  const xpBefore = (await saved(page)).xpEarned;
  const sumXp = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
  await goTo(page, 'm4p'); // the helper's story line first
  await page.waitForSelector('#qPuzzle:not([hidden])');
  assert.strictEqual(await page.textContent('#qPzTitle'), 'Make the scale level');
  assert.ok((await page.textContent('#qPzSay')).length > 10, 'the helper says what they need');
  await page.screenshot({ path: path.join(OUT, 'puzzle-balance.png') });
  const ans = await balanceAnswer(page);
  const wrongGuess = ans > 0 ? ans - 1 : ans + 1;
  await setGuess(page, 0, wrongGuess);
  await page.click('#qPzGo');
  assert.ok((await page.textContent('#qPzMsg')).length > 5, 'a wrong lock explains why');
  assert.strictEqual(await panelUp(page), 0, 'a wrong lock does not end the puzzle');
  assert.ok(sumXp((await saved(page)).xpEarned) === sumXp(xpBefore), 'a wrong lock costs and pays nothing');
  await setGuess(page, wrongGuess, ans);
  await page.click('#qPzGo');
  await page.waitForSelector('#panel:not([hidden])');
  assert.strictEqual(await page.textContent('#panelTitle'), 'Puzzle solved! 🎉');
  const pzText = await page.textContent('#panelText');
  assert.match(pzText, /\+10 XP/); assert.ok(!pzText.includes('⭐'), 'a puzzle solved after a miss earns no star');
  await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
  s = await saved(page);
  assert.ok(s.cleared.includes('m4p') && !s.gold.includes('m4p'), 'cleared, no star');
  assert.strictEqual(sumXp(s.xpEarned) - sumXp(xpBefore), 10, 'exactly 10 XP for the puzzle');
  console.log('1.2b balance puzzle spot solved (a miss first, so no star)');

  // m6: a rescue. The cage story first, then the fight, then the friend joins
  const before = (await saved(page)).creatures;
  assert.ok(!before.includes('compare'));
  await goTo(page, 'm6');
  await page.waitForSelector('#qPrep:not([hidden])');
  p = await prepInfo(page);
  assert.match(p.rescue, /trapped in a cage/);
  await page.screenshot({ path: path.join(OUT, 'prep-rescue.png') });
  r = await fight(page);
  assert.match(r.text, /You freed/); assert.match(r.text, /Owlbert/);
  await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
  s = await saved(page);
  assert.ok(s.creatures.includes('compare') && s.creatures.length === before.length + 1, 'the friend joined exactly once');
  console.log('1.3 rescue freed Owlbert');

  // m7: the boss (with a minion). Beating it opens the next region
  assert.deepStrictEqual(await openIds(page), ['m7'], 'the camp and the puzzle are already cleared, so only the boss is left');
  await goTo(page, 'm7');
  await page.waitForSelector('#qPrep:not([hidden])');
  p = await prepInfo(page);
  assert.ok(p.foes.some((f) => /Boss/.test(f)) && p.foes.length === 2, 'a boss and a minion');
  r = await fight(page);
  assert.strictEqual(r.title, 'Region boss beaten! 🏆');
  await page.click('#panelBtn');
  await page.waitForFunction(() => document.getElementById('qMapName').textContent === 'Haunted Keep');
  assert.match(await page.textContent('#toast'), /A new region opens: Haunted Keep/);
  s = await saved(page);
  ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'].forEach((id) => assert.ok(s.cleared.includes(id), id + ' saved as cleared'));
  assert.deepStrictEqual(await openIds(page), ['k1'], 'the new region starts at its first spot');
  assert.ok(!(await page.locator('#qMapPrev').isHidden()), 'two regions now: arrows appear');
  await page.screenshot({ path: path.join(OUT, 'map-region2.png') });
  await page.click('#qMapPrev');
  assert.strictEqual(await page.textContent('#qMapName'), 'Multiples Meadow');
  assert.match(await page.textContent('#qMapHint'), /Region complete/);
  console.log('1.4 boss beaten: Haunted Keep opened');

  // replaying the rescue spot when the friend is already yours: no second copy, a thank-you and a gold star
  await page.click('.mnode[data-id="m6"]');
  await page.waitForSelector('#qPrep:not([hidden])'); // a cleared rescue skips its cage story
  p = await prepInfo(page);
  assert.strictEqual(p.rescue, null, 'no cage for a friend you already have');
  const owned = (await saved(page)).creatures.length;
  r = await fight(page);
  assert.match(r.text, /already your friend/);
  await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
  s = await saved(page);
  assert.strictEqual(s.creatures.length, owned, 'nobody joined twice'); assert.ok(s.gold.includes('m6'));
  console.log('1.5 replayed rescue: thank-you, no duplicate');

  // progress that arrives from another device (a sync) redraws the map from the fresh save
  await page.click('#qMapNext'); // Haunted Keep: nothing cleared yet
  await page.waitForFunction(() => document.getElementById('qMapName').textContent === 'Haunted Keep');
  const starsBefore = await page.textContent('#qMapStars');
  await page.evaluate(() => {
    const prof = Store.profiles[0];
    prof.games.rpg = Object.assign({}, prof.games.rpg, { cleared: prof.games.rpg.cleared.concat(['k1', 'k2', 'k3']) }); // the profile object stays, the save is replaced
    document.dispatchEvent(new CustomEvent('mq:data-changed'));
  });
  await page.waitForFunction((b) => document.getElementById('qMapStars').textContent !== b, starsBefore);
  const ks = await nodeStates(page);
  assert.ok(ks.k1 === 'cleared' && ks.k3 === 'cleared', 'the map redrew from the new data');
  assert.deepStrictEqual(await openIds(page), ['k3c', 'k3p', 'k4'], 'the optional camp and the gear lock open beside the armor gallery');
  console.log('1.6 a sync redrew the map');

  // the gear lock: an optional Machine Builder puzzle spot. Solving it in the fewest steps earns the gold star
  const xpMachine = sumXp((await saved(page)).xpEarned);
  await goTo(page, 'k3p');
  await page.waitForSelector('#qPuzzle:not([hidden])');
  assert.match(await page.textContent('#qPzTitle'), /^Turn .+ into .+/);
  await page.screenshot({ path: path.join(OUT, 'puzzle-machine.png') });
  const best = await machineBest(page);
  assert.ok(best && best.length >= 1, 'the puzzle has a shortest chain');
  for (const i of best) await page.locator('#qPzOps button').nth(i).click();
  await page.waitForSelector('#panel:not([hidden])');
  assert.strictEqual(await page.textContent('#panelTitle'), 'Puzzle solved! 🎉');
  assert.match(await page.textContent('#panelText'), /fewest possible/); assert.ok((await page.textContent('#panelText')).includes('⭐'));
  await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
  s = await saved(page);
  assert.ok(s.cleared.includes('k3p') && s.gold.includes('k3p'), 'the fewest steps earns the gold star');
  assert.strictEqual(sumXp(s.xpEarned) - xpMachine, 10);
  // the camp in the Keep gives a different head start: a wrong card taken out of the first hand
  await goTo(page, 'k3c');
  await page.waitForSelector('#qMap:not([hidden])');
  assert.match(await page.textContent('#qMapHint'), /Rested: .*wrong card/);
  await goTo(page, 'k4');
  await page.waitForSelector('#qPrep:not([hidden])');
  await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
  assert.match(await page.textContent('#qLog'), /Quiet thinking/);
  assert.ok((await st(page)).hand.length === 4, 'at 2 stars a hand is 5 cards; the camp took one wrong card out');
  await page.click('#qFlee'); await page.waitForSelector('#qMap:not([hidden])');
  assert.match(await page.textContent('#qMapHint'), /Rested/, 'leaving the fight keeps the head start for next time');
  console.log('1.7 machine puzzle spot (fewest steps = star) and the second camp buff');

  // quest home keeps working alongside the map
  await page.click('#qMapBack');
  await page.waitForSelector('#qHome:not([hidden])');
  assert.ok(await page.locator('#qBegin').isVisible() && await page.locator('#qMapBtn').isVisible(), 'quick adventure and the map both live on the quest home');
  await ctx.close();

  /* ===== 2. losing on the map is gentle, and Leave returns to the map ===== */
  ({ ctx, page } = await open(browser, { width: 1000, height: 1000 }, '4-5', 'lose'));
  await toQuest(page, 3);
  await toMap(page);
  await goTo(page, 'm1');
  await page.waitForSelector('#qPrep:not([hidden])');
  await page.click('#qFight'); await page.waitForSelector('#qBattle:not([hidden])');
  for (let n = 0; n < 60; n++) {
    const s0 = await st(page);
    if (s0.over) break;
    const w = s0.hand.indexOf(false);
    await page.locator('.qcard').nth(w >= 0 ? w : 0).click();
    await idle(page);
    if ((await panelUp(page)) && /rest/.test(await page.textContent('#panelTitle'))) break;
    if (await panelUp(page)) await page.click('#panelBtn');
  }
  assert.match(await page.textContent('#panelTitle'), /needs a rest/);
  await page.click('#panelBtn2'); // Leave
  await page.waitForSelector('#qMap:not([hidden])');
  s = await saved(page);
  assert.ok(!(s.cleared || []).includes('m1'), 'a lost fight clears nothing and takes nothing away');
  assert.deepStrictEqual(await openIds(page), ['m1']);
  console.log('2. lost a fight on the map: Leave returned to the map, nothing cleared');

  // the youngest players get smaller groups: at 1 star a 3-monster spot has 2 (checked via a save that already cleared m1-m3)
  await page.evaluate(() => { const g = Store.profiles[0].games.rpg; g.cleared = ['m1', 'm2', 'm3']; Store.save(); });
  await page.click('#qMapBack'); await page.waitForSelector('#qHome:not([hidden])');
  await page.click('#qBack'); await page.waitForSelector('#setup:not([hidden])');
  await page.locator('#setStars .opt-card').nth(0).click();
  await page.click('#playNow'); await page.waitForSelector('#qHome:not([hidden])');
  await toMap(page);
  await goTo(page, 'm4');
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.strictEqual((await prepInfo(page)).foes.length, 2, 'at 1 star the 3-monster spot has 2 monsters');
  console.log('2.1 1 star: the 3-monster spot shrank to 2');
  await ctx.close();

  /* ===== 2b. the Quick adventure is saved: leave, come back, and continue where you stopped ===== */
  ({ ctx, page } = await open(browser, { width: 1000, height: 1000 }, '2-3', 'resume'));
  await toQuest(page, 1);
  assert.ok(await page.locator('#qResume').isHidden(), 'nothing to continue before an adventure is started');
  await page.click('#qBegin');
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.strictEqual((await saved(page)).run.i, 0, 'starting an adventure saves it');
  await fight(page);
  await page.click('#panelBtn'); // Next battle
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.strictEqual((await saved(page)).run.i, 1, 'winning saves the NEXT battle');
  await page.click('#qPrepBack'); // leave to the quest home
  await page.waitForSelector('#qHome:not([hidden])');
  assert.ok(await page.locator('#qResume').isVisible());
  assert.match(await page.textContent('#qResume'), /battle 2 of 5/);
  // a different grade or star setting is a different adventure, so there is nothing to continue
  await page.click('#qBack'); await page.waitForSelector('#setup:not([hidden])');
  await page.locator('#setStars .opt-card').nth(1).click();
  await page.click('#playNow'); await page.waitForSelector('#qHome:not([hidden])');
  assert.ok(await page.locator('#qResume').isHidden(), 'a saved 1-star adventure is not offered at 2 stars');
  await page.click('#qBack'); await page.waitForSelector('#setup:not([hidden])');
  await page.locator('#setStars .opt-card').nth(0).click();
  await page.click('#playNow'); await page.waitForSelector('#qHome:not([hidden])');
  assert.ok(await page.locator('#qResume').isVisible(), 'and it is back at 1 star');
  await page.click('#qResume');
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.strictEqual(await page.textContent('#qRun'), 'Battle 2 of 5', 'continuing picks up at the next battle');
  for (let battle = 1; battle < 5; battle++) {
    if (battle > 1) await page.waitForSelector('#qPrep:not([hidden])');
    await fight(page);
    await page.click('#panelBtn');
  }
  await page.waitForSelector('#qHome:not([hidden])');
  assert.strictEqual((await saved(page)).run, null, 'a finished adventure is cleared');
  assert.ok(await page.locator('#qResume').isHidden(), 'nothing to continue after finishing');
  console.log('2b. quick adventure saved, resumed at battle 2, and cleared when finished');
  await ctx.close();

  /* ===== 2c. the later regions: story intros, story friends freed on the map, boss outros, and the last friend ===== */
  ({ ctx, page } = await open(browser, { width: 1000, height: 1000 }, '4-5', 'story'));
  await toQuest(page, 2);
  // shortcut: pretend the first two regions are done (the save format makes this a plain set of node ids)
  const clearIds = (ids) => page.evaluate((list) => {
    const g = Store.profiles[0].games.rpg;
    g.cleared = [...new Set((g.cleared || []).concat(list))];
    Store.save();
    document.dispatchEvent(new CustomEvent('mq:data-changed'));
  }, ids);
  const regionIds = (i, except) => page.evaluate(([k, x]) => WorldMap.REGIONS[k].nodes.map((n) => n.id).filter((id) => !(x || []).includes(id)), [i, except]);
  await clearIds(await regionIds(0)); await clearIds(await regionIds(1));
  await toMap(page);
  const goRegion = async (name) => { for (let k = 0; k < 6 && (await page.textContent('#qMapName')) !== name; k++) await page.click('#qMapNext'); assert.strictEqual(await page.textContent('#qMapName'), name); };
  await goRegion('Prime Peaks');
  // arriving in a new region opens its story, once
  await page.waitForSelector('#panel:not([hidden])');
  assert.match(await page.textContent('#panelTitle'), /Prime Peaks/);
  assert.match(await page.textContent('#panelText'), /PRIME PEAKS/);
  for (let n = 0; n < 4 && (await panelUp(page)); n++) await page.click('#panelBtn');
  await page.click('#qMapPrev'); await page.click('#qMapNext');
  assert.strictEqual(await panelUp(page), 0, 'the intro is told once, not every time you look');
  assert.strictEqual(await page.getAttribute('#qMapBoard', 'data-region'), 'peaks');
  await page.screenshot({ path: path.join(OUT, 'map-peaks.png') });
  assert.deepStrictEqual(await openIds(page), ['p1']);
  // a story friend is freed on the map (and only there)
  assert.ok(!(await saved(page)).creatures.includes('scout'));
  await clearIds(['p1', 'p2', 'p2c', 'p3', 'p3p']);
  await goTo(page, 'p4');
  await page.waitForSelector('#qPrep:not([hidden])');
  p = await prepInfo(page);
  assert.match(p.rescue, /Scout/);
  r = await fight(page);
  assert.match(r.text, /You freed/); assert.match(r.text, /Scout/);
  await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
  assert.ok((await saved(page)).creatures.includes('scout'), 'Scout joined');
  // the team picker shows the new friend, and counts the ones still waiting
  await page.click('#qMapBack'); await page.click('#qMyTeam');
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.ok((await page.$$eval('#qRoster .creature .c-name', (e) => e.map((x) => x.textContent))).includes('Scout'));
  assert.match(await page.textContent('#qRoster .roster-note'), /10 more friends are waiting on the world map/);
  await page.click('#qFight'); await page.waitForSelector('#qHome:not([hidden])');
  // a boss tells how the story goes on, and the next region opens with its own intro
  await toMap(page); await goRegion('Prime Peaks');
  await clearIds(await regionIds(2, ['p9']));
  await goTo(page, 'p9');
  await page.waitForSelector('#qPrep:not([hidden])');
  r = await fight(page);
  assert.strictEqual(r.title, 'Region boss beaten! 🏆');
  assert.match(r.text, /Fraction Forest/, 'the outro points to the next place');
  await page.click('#panelBtn');
  await page.waitForFunction(() => document.getElementById('qMapName').textContent === 'Fraction Forest');
  await page.waitForSelector('#panel:not([hidden])'); // the forest's own story
  assert.match(await page.textContent('#panelText'), /FRACTION FOREST/);
  for (let n = 0; n < 4 && (await panelUp(page)); n++) await page.click('#panelBtn');
  console.log('2c.1 story intros, a story friend freed, and a boss outro that opens the next region');
  // the last boss frees the last friend and ends the story
  await clearIds(await regionIds(3));
  await clearIds(await regionIds(4, ['e9']));
  await goRegion('Ember Mountain');
  await goTo(page, 'e9');
  await page.waitForSelector('#qPrep:not([hidden])');
  assert.match((await prepInfo(page)).rescue, /Bison/);
  r = await fight(page);
  assert.match(r.text, /You freed/); assert.match(r.text, /Bison/); assert.match(r.text, /Thank you, hero/);
  await page.click('#panelBtn'); await page.waitForSelector('#qMap:not([hidden])');
  assert.ok((await saved(page)).creatures.includes('bison'));
  assert.match(await page.textContent('#qMapHint'), /Region complete/);
  await page.screenshot({ path: path.join(OUT, 'map-ember.png') });
  console.log('2c.2 the last boss freed Bison and finished the story');
  await ctx.close();

  /* ===== 3. cute theme and phone ===== */
  ({ ctx, page } = await open(browser, { width: 390, height: 800 }, 'K-1', 'phone'));
  await toQuest(page, 1);
  await page.evaluate(() => { Store.setSettings(Store.profiles[0], { questArt: 'cute' }); Store.save(); });
  await toMap(page);
  assert.strictEqual(await page.getAttribute('#qMapBoard', 'data-art'), 'cute');
  assert.ok((await page.$$('#qMapBoard .island')).length === 1 && (await page.$$('#qMapBoard .decor')).length > 0, 'the cute map is an island with decorations');
  await page.screenshot({ path: path.join(OUT, 'phone-map-cute.png'), fullPage: true });
  assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no horizontal scrolling on a phone');
  // every spot is a real, labelled, tappable button at least 40px wide
  const nodes = await page.$$eval('.mnode', (els) => els.map((e) => ({ label: e.getAttribute('aria-label'), w: e.getBoundingClientRect().width })));
  assert.ok(nodes.length === 9 && nodes.every((n) => n.label && n.w >= 40), 'every spot has an accessible name and a big enough tap target');
  await page.evaluate(() => { Store.setSettings(Store.profiles[0], { questArt: 'classic' }); Store.save(); });
  await page.click('#qMapBack'); await toMap(page);
  assert.strictEqual(await page.getAttribute('#qMapBoard', 'data-art'), 'classic');
  await page.screenshot({ path: path.join(OUT, 'phone-map-classic.png'), fullPage: true });
  assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no horizontal scrolling in the classic theme either');
  await ctx.close();

  console.log('Screenshots:', OUT);
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  server.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
