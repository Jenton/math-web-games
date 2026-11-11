// Run with: node tests/rpg.test.js
// Verifies Creature Quest v2: hands, armor math, encounters and rescues, every ally effect, enemy retaliation, progression, and (the important
// part) that the math is the CHOICE: perfect play always wins with ANY team, a learner usually wins, and ignoring the math mostly loses.
const assert = require('assert');
const RPG = require('../js/rpg.js');
const MG = require('../js/engine.js');
const MGP = require('../js/puzzles.js');
const Bots = require('./helpers/quest-bots.js');

const KINDS = ['weakness', 'armor', 'boss'];
const T = RPG.TUNE;

/* ---------- hands and enemies are well-formed ---------- */
let hands = 0;
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (const kind of KINDS) {
      for (let i = 0; i < 100; i++) {
        const enemy = RPG.makeEnemy(band, stars, kind, null);
        assert.ok(enemy.name && enemy.emoji && enemy.weakness && enemy.hint);
        assert.ok(enemy.hp > 0 && enemy.atk > 0 && enemy.themes.length >= 1);
        assert.strictEqual(!!enemy.charge, kind === 'boss');
        for (let k = 0; k < 5; k++) {
          const hand = RPG.makeHand(enemy.rule, stars);
          hands++;
          assert.strictEqual(hand.length, T.HAND_SIZE[stars - 1]);
          const good = hand.filter((c) => c.correct).length;
          assert.ok(good >= T.CORRECT_PER_HAND[stars - 1][0] && good <= T.CORRECT_PER_HAND[stars - 1][1], `${band} s${stars} ${kind}: ${good} right cards`);
          assert.ok(good < hand.length);
          hand.forEach((c) => {
            assert.strictEqual(c.correct, !!enemy.rule.check(c), 'correct flag must match rule.check');
            assert.strictEqual(c.power, undefined, 'cards have no power any more: a right answer does damage, a wrong one does not');
            assert.ok(c.label && !/NaN|undefined/.test(c.label));
            const text = c.correct ? enemy.rule.ok(c) : enemy.rule.why(c);
            assert.ok(text && !/NaN|undefined/.test(text), 'bad explanation: ' + text);
          });
        }
      }
    }
  }
}

/* ---------- armor: fraction comparison is exact ---------- */
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 150; i++) {
      const r = RPG.armorRule(band, stars);
      for (let k = 0; k < 20; k++) {
        const c = r.correct();
        const w = r.wrong();
        assert.ok(r.check(c) && !r.check(w), `${band} s${stars} armor ${r.title}: ${c.label} / ${w.label}`);
        assert.ok(c.value > w.value, 'every passing card must be larger than every failing card');
      }
    }
  }
}

/* ---------- encounters and scripted rescues ---------- */
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 60; i++) {
      const owned = RPG.starters(band);
      const plan = RPG.planAdventure(band, stars, owned);
      assert.strictEqual(plan.length, 5);
      plan.forEach((enc, slot) => {
        assert.ok(enc.enemies.length >= 1 && enc.enemies.length <= (stars === 1 ? 2 : 3), `slot ${slot + 1} size ${enc.enemies.length} at ${stars} stars`);
        const ids = enc.enemies.filter((e) => e.kind !== 'armor').map((e) => e.rule.id);
        assert.strictEqual(new Set(ids).size, ids.length, 'enemies in one fight must have different weaknesses');
      });
      assert.strictEqual(plan[0].enemies.length, 1, 'the first fight is a single enemy');
      assert.ok(plan[2].enemies.some((e) => e.kind === 'armor'));
      assert.ok(plan[4].enemies.some((e) => e.kind === 'boss') && plan[4].enemies.length >= 2, 'the boss brings a minion');
      assert.ok(plan[3].enemies.length === (stars === 1 ? 2 : 3));
      assert.ok(plan[2].rescue && !owned.includes(plan[2].rescue) && plan[2].rescue !== 'boss', 'the armored fight frees an ally you do not have yet');
      assert.strictEqual(plan[4].rescue, 'boss', 'the boss guards Pebble');
      assert.ok([0, 1, 3].every((s) => plan[s].rescue === null));
    }
  }
}
{
  const owned = RPG.starters('K-1').concat(['armor', 'boss']);
  const plan = RPG.planAdventure('K-1', 1, owned);
  assert.strictEqual(plan[2].rescue, null, 'nothing left to rescue');
  assert.strictEqual(plan[4].rescue, null);
  const some = RPG.planAdventure('6', 2, RPG.starters('6').concat(['boss']));
  assert.ok(some[2].rescue && some[4].rescue && some[2].rescue !== some[4].rescue, 'two different allies are freed in one adventure');
  assert.deepStrictEqual(RPG.rescueCandidates('K-1', ['expressions']), ['even-odd', 'compare', 'armor']);
}

/* ---------- makeEncounter: build one fight from enemy kinds (used by the world map) ---------- */
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 40; i++) {
      for (const kinds of [['weakness'], ['weakness', 'weakness'], ['armor', 'weakness'], ['weakness', 'weakness', 'weakness'], ['boss', 'weakness'], ['boss', 'weakness', 'weakness']]) {
        const enc = RPG.makeEncounter(band, stars, kinds, { rescue: kinds.includes('armor') ? 'armor' : null });
        const cap = RPG.maxGroup(stars);
        assert.strictEqual(RPG.maxGroup(1), 2); assert.strictEqual(RPG.maxGroup(3), 3);
        assert.strictEqual(enc.enemies.length, Math.min(kinds.length, cap), 'the group is capped by the star level');
        assert.deepStrictEqual(enc.enemies.map((e) => e.kind), kinds.slice(0, cap), 'kinds are kept in order');
        const ids = enc.enemies.filter((e) => e.kind !== 'armor').map((e) => e.rule.id);
        assert.strictEqual(new Set(ids).size, ids.length, 'different weaknesses in one fight');
        assert.deepStrictEqual(enc.skills, ids);
        assert.strictEqual(enc.hasBoss, kinds.slice(0, cap).includes('boss'));
        assert.strictEqual(enc.rescue, kinds.includes('armor') ? 'armor' : null, 'a named rescue passes straight through');
        // it plugs straight into a battle
        const b = RPG.newBattle({ band, stars, enemies: enc.enemies, team: RPG.starters(band), level: 1, rescue: enc.rescue });
        assert.strictEqual(b.foes.length, enc.enemies.length);
        assert.strictEqual(RPG.rewards(b).creature, enc.rescue);
      }
    }
  }
  // "prefer" is honored when the grade has enough skills, and relaxed (never an error) when it does not
  const withPrefer = RPG.makeEncounter('4-5', 2, ['weakness', 'weakness'], { prefer: ['multiples', 'factors'] });
  assert.ok(withPrefer.skills.every((id) => !['multiples', 'factors'].includes(id)) && withPrefer.skills.length === 2);
  const tooMany = RPG.makeEncounter('K-1', 3, ['weakness', 'weakness', 'weakness'], { prefer: ['expressions', 'even-odd', 'compare'] });
  assert.strictEqual(new Set(tooMany.skills).size, 3, 'with only 3 skills at this grade, "prefer" gives way and the weaknesses stay different');
  // a map node that names its rescue ally and one that already owns it: rewards only join someone new
  const own = { xpEarned: {}, wins: {}, bosses: {}, creatures: ['multiples', 'armor'], team: ['multiples'] };
  const fightB = RPG.newBattle({ band: '4-5', stars: 1, enemies: RPG.makeEncounter('4-5', 1, ['armor', 'weakness'], { rescue: 'armor' }).enemies, team: ['multiples'], level: 1, rescue: 'armor' });
  assert.strictEqual(RPG.applyRewards(own, RPG.rewards(fightB), 'dev').joined, null, 'already owned: nobody joins (the UI shows a thank-you instead)');
  assert.strictEqual(RPG.rewards(fightB).creature, 'armor');
}

/* ---------- battle mechanics ---------- */
// build a battle whose enemies do not match any ally's theme, so damage is the plain base amount
function mk(team, n, o) {
  o = o || {};
  const band = o.band || 'K-1';
  const stars = o.stars || 1;
  const enemies = [];
  for (let guard = 0; enemies.length < n && guard < 500; guard++) {
    const e = RPG.makeEnemy(band, stars, o.kind || 'weakness', enemies.map((x) => x.rule.id));
    if (!e.themes.some((t) => team.includes(t)) && !enemies.some((x) => x.rule.id === e.rule.id)) enemies.push(e);
  }
  assert.strictEqual(enemies.length, n);
  const b = RPG.newBattle({ band, stars, enemies, team, level: o.level || 1 });
  (o.hp || []).forEach((h, i) => { b.foes[i].hp = h; b.foes[i].max = Math.max(b.foes[i].max, h); });
  return b;
}
const right = (b) => RPG.currentHand(b).findIndex((c) => c.correct);
const wrong = (b) => RPG.currentHand(b).findIndex((c) => !c.correct);
const atkSum = (b, idx) => idx.reduce((n, i) => n + b.foes[i].enemy.atk, 0);

{ // a wrong answer does no damage, explains itself, and every enemy still hits back
  const b = mk(['rounding'], 3, { band: '6' });
  const hp = b.foes.map((f) => f.hp);
  const t0 = b.teamHp;
  const ev = RPG.play(b, wrong(b));
  assert.strictEqual(ev.correct, false);
  assert.deepStrictEqual(ev.hits, [], 'no damage');
  assert.ok(ev.msg.length > 0 && !/NaN|undefined/.test(ev.msg), 'a wrong answer is explained');
  assert.deepStrictEqual(b.foes.map((f) => f.hp), hp);
  assert.strictEqual(ev.attacks.length, 3, 'all three enemies hit back');
  assert.strictEqual(b.teamHp, t0 - 3 * RPG.enemyDmg(b, T.ENEMY_ATK.weakness));
  assert.strictEqual(b.misses, 1);
  assert.strictEqual(b.turn, 2);
}
{ // a right answer: base damage, then the living enemies hit back; a dead enemy does not
  const b = mk(['rounding'], 2, { band: '6', hp: [T.BASE_DMG, 99] }); // rounding's effect (shield) is not used here: blocked below
  const t0 = b.teamHp;
  const ev = RPG.play(b, right(b));
  assert.deepStrictEqual(ev.hits, [{ i: 0, amount: T.BASE_DMG, killed: true }]);
  assert.strictEqual(b.foes[0].alive, false);
  assert.deepStrictEqual(ev.attacks.map((a) => a.i), [1], 'only the survivor attacks');
  assert.strictEqual(ev.shieldGained, 1);
  assert.strictEqual(ev.attacks[0].blocked, true, 'the shield from this very answer blocks the survivor');
  assert.strictEqual(b.teamHp, t0);
  assert.strictEqual(b.target, 1, 'the target moves to a living enemy');
}
{ // winning: no retaliation
  const b = mk(['even-odd'], 1, { band: '4-5', hp: [1] });
  const t0 = b.teamHp;
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.over, 'win');
  assert.strictEqual(ev.attacks.length, 0);
  assert.strictEqual(b.teamHp, t0);
  assert.strictEqual(RPG.play(b, 0), null, 'a finished battle accepts no more moves');
}
{ // losing
  const b = mk(['even-odd'], 3, { band: '6' });
  b.teamHp = 2;
  const ev = RPG.play(b, wrong(b));
  assert.strictEqual(ev.over, 'lose');
  assert.strictEqual(b.teamHp, 0);
  assert.ok(ev.attacks.length >= 1 && ev.attacks.length <= 3);
}
{ // the specialist bonus: an ally whose theme matches the target's skill hits harder, but is never required
  let b;
  for (let g = 0; g < 500; g++) {
    const e = RPG.makeEnemy('4-5', 1, 'weakness', null);
    if (e.rule.id === 'primes') { b = RPG.newBattle({ band: '4-5', stars: 1, enemies: [e, RPG.makeEnemy('4-5', 1, 'weakness', ['primes'])], team: ['even-odd'], level: 1 }); break; }
  }
  const ev1 = RPG.play(b, right(b)); // Pairo (even-odd) is not an expert in primes
  assert.strictEqual(ev1.specialist, false);
  assert.strictEqual(ev1.hits[0].amount, T.BASE_DMG);
  let c;
  for (let g = 0; g < 500; g++) {
    const e = RPG.makeEnemy('4-5', 1, 'weakness', null);
    if (e.rule.id === 'multiples') { c = RPG.newBattle({ band: '4-5', stars: 1, enemies: [e, RPG.makeEnemy('4-5', 1, 'weakness', ['multiples'])], team: ['factors', 'multiples'], level: 1 }); break; }
  }
  RPG.setAlly(c, 1);
  const ev2 = RPG.play(c, right(c)); // Hopper is the multiples expert; sweep also hits the other enemy
  assert.strictEqual(ev2.specialist, true);
  assert.strictEqual(ev2.hits[0].amount, T.BASE_DMG + T.SPECIALIST_BONUS);
}

/* every ally effect, one by one */
{ // sweep (Hopper): the target takes full damage, every other enemy half
  const b = mk(['multiples'], 3, { band: 'K-1' });
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.effect, 'sweep');
  assert.deepStrictEqual(ev.hits.map((h) => [h.i, h.amount]), [[0, T.BASE_DMG], [1, T.BASE_DMG / 2], [2, T.BASE_DMG / 2]]);
}
{ // split (Splish): the weakest OTHER enemy takes half
  const b = mk(['factors'], 3, { band: 'K-1', hp: [10, 9, 4] });
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.effect, 'split');
  assert.deepStrictEqual(ev.hits.map((h) => [h.i, h.amount]), [[0, T.BASE_DMG], [2, T.BASE_DMG / 2]]);
  const alone = mk(['factors'], 1, { band: 'K-1' });
  assert.strictEqual(RPG.play(alone, right(alone)).hits.length, 1, 'with no other enemy, split just hits the target');
}
{ // crit (Primo): 50% more
  const b = mk(['primes'], 2, { band: 'K-1' });
  assert.strictEqual(RPG.play(b, right(b)).hits[0].amount, Math.round(T.BASE_DMG * 1.5));
}
{ // combo (Octo): +2 per right answer in a row, capped at +6, reset by a miss
  const b = mk(['expressions'], 1, { band: '6', hp: [999] });
  const dmg = [];
  for (let n = 0; n < 5; n++) dmg.push(RPG.play(b, right(b)).hits[0].amount);
  assert.deepStrictEqual(dmg, [6, 8, 10, 12, 12].map((x) => x - 6 + T.BASE_DMG));
  RPG.play(b, wrong(b));
  assert.strictEqual(RPG.play(b, right(b)).hits[0].amount, T.BASE_DMG, 'a wrong answer resets the combo');
}
{ // slice (Fraxie): at least a quarter of the enemy's max health
  const b = mk(['fractions'], 1, { band: 'K-1', hp: [60] });
  assert.strictEqual(RPG.play(b, right(b)).hits[0].amount, 15);
  const small = mk(['fractions'], 1, { band: 'K-1' });
  assert.strictEqual(RPG.play(small, right(small)).hits[0].amount, T.BASE_DMG, 'never less than the base damage');
}
{ // heal (Pairo): restores some health, capped at the maximum
  const b = mk(['even-odd'], 2, { band: '6' });
  b.teamHp = 5;
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.healed, T.HEAL_AMOUNT);
  const full = mk(['even-odd'], 2, { band: '6' });
  assert.strictEqual(RPG.play(full, right(full)).healed, 0, 'no healing past the maximum');
  assert.ok(full.teamHp <= full.teamMax);
}
{ // shield (Puffy, Shelly): blocks attacks one at a time, holds at most 2
  const b = mk(['rounding'], 3, { band: '6' });
  const t0 = b.teamHp;
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.effect, 'shield');
  assert.deepStrictEqual(ev.attacks.map((a) => a.blocked), [true, false, false], 'one shield blocks one attack');
  assert.strictEqual(b.teamHp, t0 - 2 * RPG.enemyDmg(b, T.ENEMY_ATK.weakness));
  const c = mk(['rounding'], 1, { band: '6', hp: [999] });
  c.shield = T.SHIELD_MAX;
  RPG.play(c, right(c));
  assert.ok(c.shield <= T.SHIELD_MAX, 'the shield never exceeds its maximum');
}
{ // stun (Powzer, Pebble): the target skips its attack this turn, once
  const b = mk(['exponents'], 2, { band: 'K-1', hp: [999, 999] });
  const t0 = b.teamHp;
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.stunned, 0);
  assert.deepStrictEqual(ev.attacks.map((a) => [a.i, a.skipped]), [[0, true], [1, false]]);
  assert.strictEqual(b.teamHp, t0 - RPG.enemyDmg(b, T.ENEMY_ATK.weakness));
  const ev2 = RPG.play(b, wrong(b));
  assert.strictEqual(ev2.attacks.find((a) => a.i === 0).skipped, false, 'the stun lasts one attack');
}
{ // hint (Owlbert): next turn every hand has a wrong card removed, and always keeps at least one right and one wrong
  for (let trial = 0; trial < 60; trial++) {
    const b = mk(['compare'], 2, { band: '6', stars: 2, hp: [999, 999] });
    const sizes = b.hands.map((h) => h.length);
    const ev = RPG.play(b, right(b));
    assert.strictEqual(ev.hint, true);
    b.hands.forEach((h, i) => {
      assert.strictEqual(h.length, sizes[i] - 1, 'one wrong card was removed');
      assert.ok(h.some((c) => c.correct) && h.some((c) => !c.correct));
    });
    RPG.play(b, wrong(b));
    b.hands.forEach((h, i) => assert.strictEqual(h.length, sizes[i], 'the hint lasts one turn'));
  }
}
{ // retargeting is free and never re-rolls a hand
  const b = mk(['rounding'], 3, { band: '6' });
  const snap = JSON.stringify(b.hands);
  RPG.setTarget(b, 2); RPG.setTarget(b, 0); RPG.setTarget(b, 1); RPG.setAlly(b, 0);
  assert.strictEqual(JSON.stringify(b.hands), snap);
  assert.strictEqual(RPG.setTarget(b, 9), false);
  b.foes[2].alive = false;
  assert.strictEqual(RPG.setTarget(b, 2), false, 'cannot target a defeated enemy');
  assert.strictEqual(RPG.setAlly(b, 3), false);
}
{ // the boss: every third turn it charges a big attack that a Balance puzzle cancels (or you take the hit)
  const e = [RPG.makeEnemy('2-3', 2, 'boss', null), RPG.makeEnemy('2-3', 2, 'weakness', null)];
  const b = RPG.newBattle({ band: '2-3', stars: 2, enemies: e, team: ['exponents'], level: 1 });
  b.foes.forEach((f) => { f.hp = f.max = 999; });
  assert.ok(!b.puzzle, 'no charge on turn 1');
  RPG.play(b, wrong(b)); RPG.play(b, wrong(b));
  assert.strictEqual(b.turn, 3);
  assert.ok(b.puzzle && b.foes[0].charging, 'the boss charges on turn 3');
  let solved = false;
  for (let v = 0; v <= b.puzzle.max; v++) if (MGP.checkBalance(b.puzzle, v).balanced) solved = true;
  assert.ok(solved, 'the puzzle can be solved');
  const hit = JSON.parse(JSON.stringify(b)); // not used; the same state is played two ways below
  const take = RPG.newBattle({ band: '2-3', stars: 2, enemies: e, team: ['exponents'], level: 1 });
  take.turn = 3; take.foes.forEach((f) => { f.hp = f.max = 999; f.charging = false; });
  take.foes[0].charging = true; take.puzzle = MGP.makeBalance('2-3', 2);
  const t0 = take.teamHp;
  const evTake = RPG.play(take, wrong(take));
  assert.strictEqual(evTake.attacks[0].charged, true);
  assert.strictEqual(t0 - take.teamHp, RPG.enemyDmg(take, T.CHARGE.dmg) + RPG.enemyDmg(take, T.ENEMY_ATK.weakness), 'ignoring the charge takes the big hit');
  assert.ok(RPG.cancelCharge(b), 'solving the puzzle cancels it');
  const t1 = b.teamHp;
  const evCancel = RPG.play(b, wrong(b));
  assert.strictEqual(evCancel.attacks[0].skipped, true, 'a cancelled boss is stunned and skips its attack');
  assert.strictEqual(t1 - b.teamHp, RPG.enemyDmg(b, T.ENEMY_ATK.weakness), 'only the minion hit back');
  assert.strictEqual(RPG.cancelCharge(b), false, 'nothing left to cancel');
}

/* ---------- turn order: every friend acts, THEN every monster acts ---------- */
{
  const team = ['multiples', 'factors', 'primes'];
  const b = mk(team, 2, { band: 'K-1', hp: [999, 999] });
  const t0 = b.teamHp;
  assert.deepStrictEqual(b.acted, [false, false, false]);
  const ev1 = RPG.play(b, wrong(b));
  assert.strictEqual(ev1.turnEnded, false, 'the monsters wait for the other friends');
  assert.deepStrictEqual(ev1.attacks, []);
  assert.strictEqual(b.teamHp, t0);
  assert.strictEqual(b.turn, 1);
  assert.strictEqual(ev1.nextAlly, 1);
  assert.strictEqual(b.ally, 1, 'the turn moves on to the next friend');
  assert.deepStrictEqual(b.acted, [true, false, false]);
  assert.strictEqual(RPG.setAlly(b, 0), false, 'a friend who has acted cannot act twice');
  assert.strictEqual(RPG.setAlly(b, 2), true, 'but the others can go in any order');
  const old = JSON.stringify(b.hands);
  const ev2 = RPG.play(b, wrong(b));
  assert.strictEqual(ev2.ally, 'primes');
  assert.strictEqual(ev2.turnEnded, false);
  assert.strictEqual(b.ally, 1, 'the one friend left goes next');
  assert.notStrictEqual(JSON.stringify(b.hands), old, 'every action deals a fresh hand');
  const ev3 = RPG.play(b, wrong(b));
  assert.strictEqual(ev3.turnEnded, true);
  assert.deepStrictEqual(ev3.attacks.map((a) => a.i), [0, 1], 'now every living monster acts, once each');
  assert.strictEqual(b.teamHp, t0 - 2 * T.ENEMY_ATK.weakness, 'a full team takes full-strength hits');
  assert.strictEqual(b.turn, 2);
  assert.deepStrictEqual(b.acted, [false, false, false], 'a new round: everyone can act again');
  assert.strictEqual(b.ally, 0);
}
{ // a win in the middle of your phase ends the fight at once; nobody hits back
  const b = mk(['multiples', 'factors', 'primes'], 1, { band: 'K-1', hp: [1] });
  const t0 = b.teamHp;
  const ev = RPG.play(b, right(b));
  assert.strictEqual(ev.over, 'win');
  assert.deepStrictEqual(ev.attacks, []);
  assert.strictEqual(b.teamHp, t0);
}
{ // a stunned monster skips the monster phase, a shield blocks one hit in it, and the hint lands on the very next hand
  const b = mk(['exponents', 'rounding', 'compare'], 2, { band: '6', stars: 2, hp: [999, 999] });
  const e1 = RPG.play(b, right(b)); // exponents: stun the target
  assert.strictEqual(e1.effect, 'stun');
  RPG.setAlly(b, 1);
  const e2 = RPG.play(b, right(b)); // rounding: shield
  assert.strictEqual(e2.effect, 'shield');
  const sizes = b.hands.map((h) => h.length);
  const e3 = RPG.play(b, right(b)); // compare: hint, used up by the next deal (the next round)
  assert.strictEqual(e3.effect, 'hint');
  assert.strictEqual(e3.turnEnded, true);
  assert.deepStrictEqual(e3.attacks.map((a) => [a.i, a.skipped, a.blocked]), [[0, true, false], [1, false, true]]);
  b.hands.forEach((h, i) => assert.ok(h.length < sizes[i] || h.length === 0, 'the first hand of the next round has a wrong card removed'));
}
{ // a smaller team acts fewer times per round, so monsters hit softer and it stays winnable
  const one = mk(['rounding'], 1, { band: '6', hp: [999] });
  assert.strictEqual(RPG.enemyDmg(one, T.ENEMY_ATK.weakness), Math.floor(T.ENEMY_ATK.weakness / 3));
  const three = mk(['multiples', 'factors', 'primes'], 1, { band: 'K-1', hp: [999] });
  assert.strictEqual(RPG.enemyDmg(three, T.ENEMY_ATK.weakness), T.ENEMY_ATK.weakness);
  assert.ok(RPG.enemyDmg(one, 1) >= 1, 'never zero');
}
{ // the boss charge belongs to the whole round and is not cancelled by dealing new hands
  const e = [RPG.makeEnemy('2-3', 2, 'boss', null)];
  const b = RPG.newBattle({ band: '2-3', stars: 2, enemies: e, team: ['exponents', 'multiples', 'factors'], level: 1 });
  b.foes[0].hp = b.foes[0].max = 999;
  RPG.play(b, wrong(b)); RPG.play(b, wrong(b)); RPG.play(b, wrong(b));
  RPG.play(b, wrong(b)); RPG.play(b, wrong(b)); RPG.play(b, wrong(b));
  assert.strictEqual(b.turn, 3);
  assert.ok(b.foes[0].charging && b.puzzle);
  RPG.play(b, wrong(b)); RPG.play(b, wrong(b));
  assert.ok(b.foes[0].charging && b.puzzle, 'the charge survives to the end of the round');
  b.teamHp = b.teamMax = 99;
  const t0 = b.teamHp;
  const ev = RPG.play(b, wrong(b));
  assert.strictEqual(ev.attacks[0].charged, true);
  assert.strictEqual(t0 - b.teamHp, T.CHARGE.dmg);
}

/* ---------- rewards ---------- */
{
  const mkB = (kinds, rescue) => RPG.newBattle({ band: '4-5', stars: 1, enemies: kinds.map((k) => RPG.makeEnemy('4-5', 1, k, null)), team: ['multiples'], level: 1, rescue });
  const two = mkB(['weakness', 'weakness'], null);
  assert.strictEqual(RPG.rewards(two).xp, 8 + 8 + 10, 'flawless fight bonus');
  two.misses = 1; assert.strictEqual(RPG.rewards(two).xp, 16 + 5);
  two.misses = 4; assert.strictEqual(RPG.rewards(two).xp, 16);
  const boss = mkB(['boss', 'weakness'], 'boss');
  assert.strictEqual(RPG.rewards(boss).xp, 25 + 8 + 20);
  assert.strictEqual(RPG.rewards(boss).boss, true);
  assert.strictEqual(RPG.rewards(boss).creature, 'boss', 'the rescued ally comes from the encounter');
  assert.strictEqual(RPG.rewards(two).creature, null, 'ordinary fights free nobody');
}

/* ---------- starting over ---------- */
{
  const p = { settings: { band: '4-5' }, games: { rpg: { xpEarned: { lap: 300 }, wins: { lap: 9 }, bosses: { lap: 1 }, creatures: ['multiples', 'armor', 'boss', 'primes'], team: ['armor', 'boss'], teamAt: 9, cleared: ['m1', 'm2'], gold: ['m1'] } }, stats: { primes: { lap: { right: 5, wrong: 1 } } } };
  assert.ok(RPG.progress(RPG.ensureState(p)).level > 3);
  const r = RPG.resetState(p, 1234);
  assert.strictEqual(r, p.games.rpg, 'reset works in place on the live save');
  assert.strictEqual(RPG.progress(r).level, 1);
  assert.strictEqual(RPG.progress(r).wins, 0);
  assert.strictEqual(RPG.progress(r).bosses, 0);
  assert.deepStrictEqual(r.creatures, RPG.starters('4-5'), 'back to the starting friends');
  assert.deepStrictEqual(RPG.currentTeam(r), RPG.starters('4-5'));
  assert.deepStrictEqual([r.cleared, r.gold], [[], []], 'the world map is empty again');
  assert.strictEqual(r.team, undefined);
  assert.strictEqual(r.resetAt, 1234);
  assert.ok(p.stats.primes.lap.right === 5, 'practice stats for the grown-up report are not touched');
  assert.ok(RPG.resetState(p).resetAt > 1234, 'a later reset always gets a later stamp');
  assert.strictEqual(RPG.resetState({ settings: { band: 'K-1' } }, 5).resetAt, 5, 'resetting a brand new save is fine');
}

/* ---------- state and progression ---------- */
{
  const p = { settings: { band: '4-5' } };
  const r = RPG.ensureState(p);
  assert.strictEqual(r, p.games.rpg, 'RPG state lives under profile.games.rpg');
  assert.deepStrictEqual(r.creatures, ['multiples', 'factors', 'primes']);
  assert.strictEqual(r.team, undefined, 'a default team is never saved as if the player chose it');
  assert.deepStrictEqual(RPG.currentTeam(r), ['multiples', 'factors', 'primes']);
  assert.strictEqual(RPG.progress(r).level, 1);
  const q = { settings: { band: '6' }, games: { rpg: { creatures: ['fractions', 'nope', 'fractions'], team: ['exponents', 'fractions'] } } };
  const r2 = RPG.ensureState(q);
  assert.deepStrictEqual(r2.creatures, ['fractions']);
  assert.deepStrictEqual(r2.team, ['fractions']);
  const s = { xpEarned: {}, wins: {}, bosses: {}, creatures: ['multiples'], team: ['multiples'] };
  assert.strictEqual(RPG.addXp(s, 40, 'lap'), 1);
  assert.deepStrictEqual([RPG.progress(s).level, RPG.progress(s).xp, RPG.progress(s).need], [2, 0, 60]);
  assert.strictEqual(RPG.addXp(s, 70, 'pad'), 1, 'XP from another device counts toward the same level');
  assert.deepStrictEqual([RPG.progress(s).level, RPG.progress(s).xp, RPG.progress(s).total], [3, 10, 110]);
  assert.strictEqual(RPG.levelFor(39).level, 1);
  assert.strictEqual(RPG.levelFor(40).level, 2);
  assert.strictEqual(RPG.levelFor(100).level, 3);
  const out = RPG.applyRewards(s, { xp: 5, creature: 'primes', boss: false }, 'lap');
  assert.strictEqual(out.joined.id, 'primes');
  assert.deepStrictEqual(RPG.currentTeam(s), ['multiples', 'primes']);
  assert.ok(s.teamAt > 0, 'a team change is timestamped so it can merge across devices');
  assert.strictEqual(RPG.applyRewards(s, { xp: 5, creature: 'primes', boss: false }, 'lap').joined, null, 'an ally only joins once');
  assert.strictEqual(RPG.applyRewards(s, { xp: 5, creature: null, boss: false }, 'lap').joined, null);
  assert.strictEqual(RPG.progress(s).wins, 3);
  RPG.applyRewards(s, { xp: 5, creature: 'boss', boss: true }, 'pad');
  assert.strictEqual(RPG.progress(s).bosses, 1);
  assert.ok(RPG.maxHp(5) > RPG.maxHp(1));
  assert.deepStrictEqual(RPG.reachable('K-1'), ['expressions', 'even-odd', 'compare', 'armor', 'boss']);
  for (const band of MG.BANDS) RPG.reachable(band).forEach((id) => assert.ok(RPG.creatureById(id) && RPG.ENEMY_ART[id], band + ' ' + id));
  // every ally has an effect, and all four kinds the owner asked for exist
  RPG.CREATURES.forEach((c) => assert.ok(c.effect && c.effectName && c.effectText, c.id + ' needs an effect'));
  const kinds = new Set(RPG.CREATURES.map((c) => c.effect));
  ['sweep', 'shield', 'heal', 'stun', 'hint'].forEach((k) => assert.ok(kinds.has(k), 'missing effect ' + k));
}

/* ---------- simulations: the math must matter, and no team can make a fight unwinnable ---------- */
const teamFor = (band) => RPG.starters(band);
const N = 120;
const perfect = Bots.winRates(Bots.policies.perfect, { teamFor, trials: N });
const anyAlly = Bots.winRates(Bots.policies.perfectAnyAlly, { teamFor, trials: N });
const learner = Bots.winRates(Bots.policies.learner(0.35), { teamFor, trials: N });
const random = Bots.winRates(Bots.policies.random, { teamFor, trials: N });

for (const [k, v] of Object.entries(perfect)) assert.ok(v >= 0.99, `perfect play must always win (${k}: ${v})`);
for (const [k, v] of Object.entries(anyAlly)) assert.ok(v >= 0.96, `perfect answers must win whichever ally and enemy are chosen (${k}: ${v})`);
assert.ok(Bots.byStars(learner, 1) >= 0.8, `a learner who misses a third still usually wins at 1 star (${Bots.byStars(learner, 1).toFixed(2)})`);
assert.ok(Bots.byStars(learner, 2) >= 0.7 && Bots.byStars(learner, 3) >= 0.7, 'and at 2 and 3 stars');
assert.ok(Bots.byStars(random, 1) <= 0.5 && Bots.byStars(random, 2) <= 0.3 && Bots.byStars(random, 3) <= 0.28, `ignoring the math mostly loses (${[1, 2, 3].map((s) => Bots.byStars(random, s).toFixed(2))})`);
assert.ok(Bots.overall(random) <= 0.35, 'overall, ignoring the math loses at least 65% of the time');

// no team makes a fight unwinnable: perfect answers win with EACH ally alone on the team (worst-case effects)
const lone = {};
for (const ally of RPG.CREATURES) {
  let w = 0;
  let n = 0;
  for (const band of MG.BANDS) for (let stars = 1; stars <= 3; stars++) for (let t = 0; t < 10; t++) {
    RPG.planAdventure(band, stars, [ally.id]).forEach((enc) => {
      n++;
      if (Bots.fight(enc, { band, stars, team: [ally.id] }, Bots.policies.perfect).over === 'win') w++;
    });
  }
  lone[ally.id] = w / n;
  assert.ok(w / n >= 0.95, `perfect answers with only ${ally.name} (${ally.effect}) must win (${(w / n).toFixed(3)})`);
}
// and no ally is so strong that the fight is trivial for someone who guesses
for (const ally of RPG.CREATURES) {
  let w = 0;
  let n = 0;
  for (const band of MG.BANDS) for (let stars = 1; stars <= 3; stars++) for (let t = 0; t < 12; t++) {
    RPG.planAdventure(band, stars, [ally.id]).forEach((enc) => {
      n++;
      if (Bots.fight(enc, { band, stars, team: [ally.id] }, Bots.policies.random).over === 'win') w++;
    });
  }
  assert.ok(w / n <= 0.5, `guessing with only ${ally.name} should still mostly lose (${(w / n).toFixed(2)})`);
}

/* ---------- story friends: 22 allies, the new eleven are expert at an existing skill and only come from the map ---------- */
{
  const skills = new Set(RPG.CREATURES.filter((c) => !c.story).map((c) => c.id));
  assert.strictEqual(RPG.CREATURES.length, 22);
  assert.strictEqual(new Set(RPG.CREATURES.map((c) => c.id)).size, 22, 'ids are unique');
  RPG.CREATURES.filter((c) => c.story).forEach((c) => {
    assert.ok(skills.has(c.theme), c.id + ' is an expert at a real skill (' + c.theme + ')');
    assert.ok(c.where && c.blurb && c.effect && c.effectName && c.effectText, c.id + ' is fully described');
    assert.strictEqual(RPG.themeOf(c.id), c.theme);
  });
  RPG.CREATURES.filter((c) => !c.story).forEach((c) => assert.strictEqual(RPG.themeOf(c.id), c.id));
  // a Quick adventure never frees a story friend, and they are not offered at the start
  for (const band of MG.BANDS) {
    assert.ok(RPG.rescueCandidates(band, []).every((id) => !RPG.STORY_FRIENDS.includes(id)), 'Quick adventures only free the first eleven');
    assert.ok(RPG.starters(band).every((id) => !RPG.STORY_FRIENDS.includes(id)));
    for (let i = 0; i < 20; i++) RPG.planAdventure(band, 1 + (i % 3), []).forEach((enc) => assert.ok(!RPG.STORY_FRIENDS.includes(enc.rescue)));
  }
  // the expert bonus follows the theme: Bruno (multiples) hits a multiples monster harder than a primes monster
  const find = (rule) => { for (let i = 0; i < 500; i++) { const e = RPG.makeEnemy('4-5', 2, 'weakness', null); if (e.rule.id === rule) return e; } return null; };
  const mult = find('multiples');
  const other = find('primes') || find('factors');
  if (mult && other) {
    const dmgOn = (enemy) => {
      const b = RPG.newBattle({ band: '4-5', stars: 2, enemies: [enemy], team: ['bruno'], level: 1 });
      const ev = RPG.play(b, RPG.currentHand(b).findIndex((c) => c.correct));
      return { dmg: ev.hits[0].amount, specialist: ev.specialist };
    };
    const a = dmgOn(mult);
    const c = dmgOn(other);
    assert.ok(a.specialist && !c.specialist && a.dmg === c.dmg + T.SPECIALIST_BONUS, 'Bruno is an expert against multiples only');
  }
}

/* ---------- camp buffs: a head start that only helps, and never replaces the math ---------- */
{
  assert.deepStrictEqual(Object.keys(RPG.BUFFS).sort(), ['hint', 'shield']);
  for (const band of MG.BANDS) for (let stars = 1; stars <= 3; stars++) for (let i = 0; i < 20; i++) {
    const enc = RPG.makeEncounter(band, stars, ['weakness', 'weakness'], {});
    const fresh = () => RPG.newBattle({ band, stars, enemies: enc.enemies, team: ['multiples'], level: 1 });
    // shield: the first enemy attack is blocked, the rest still land
    let b = fresh();
    assert.strictEqual(RPG.applyBuff(b, 'shield'), true);
    assert.strictEqual(b.shield, 1);
    const wrong = RPG.currentHand(b).findIndex((c) => !c.correct);
    const hp0 = b.teamHp;
    const ev = RPG.play(b, wrong);
    assert.ok(ev.attacks[0].blocked, 'the first attack is blocked');
    assert.ok(ev.attacks.length < 2 || !ev.attacks[1].blocked, 'only one attack is blocked');
    assert.ok(b.teamHp > hp0 - ev.attacks.reduce((n, a) => n + a.dmg, 0) - 1, 'a block can only save health');
    // hint: every hand is one card shorter, still has a right card and a wrong card
    b = fresh();
    const before = b.hands.map((h) => h.length);
    RPG.applyBuff(b, 'hint');
    b.hands.forEach((h, k) => {
      assert.strictEqual(h.length, before[k] - 1);
      assert.ok(h.some((c) => c.correct) && h.some((c) => !c.correct), 'the choice stays real');
    });
    // a buff never makes a wrong card right
    assert.ok(!RPG.currentHand(b)[RPG.currentHand(b).findIndex((c) => !c.correct)].correct);
    // shield never stacks past the cap
    b = fresh(); RPG.applyBuff(b, 'shield'); RPG.applyBuff(b, 'shield'); RPG.applyBuff(b, 'shield');
    assert.ok(b.shield <= T.SHIELD_MAX);
  }
  assert.strictEqual(RPG.applyBuff({ shield: 0, hands: [] }, 'nope'), false, 'unknown buffs do nothing');
}

const pct = (x) => (100 * x).toFixed(0) + '%';
console.log(`OK: ${hands} hands; encounters, rescues, enemy retaliation and all ally effects verified. Win rates (1/2/3 stars): ` +
  `perfect ${[1, 2, 3].map((s) => pct(Bots.byStars(perfect, s))).join('/')}, perfect with any ally ${[1, 2, 3].map((s) => pct(Bots.byStars(anyAlly, s))).join('/')} ` +
  `(worst single-ally team ${pct(Math.min(...Object.values(lone)))}), learner missing 1 in 3 ${[1, 2, 3].map((s) => pct(Bots.byStars(learner, s))).join('/')}, ` +
  `ignoring the math ${[1, 2, 3].map((s) => pct(Bots.byStars(random, s))).join('/')}.`);
