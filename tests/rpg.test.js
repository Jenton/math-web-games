// Run with: node tests/rpg.test.js
// Verifies Creature Quest logic: hands are well-formed, armor math is right, progression works, and
// (the important one) that the math is the CHOICE: a player who ignores the math loses.
const assert = require('assert');
const RPG = require('../js/rpg.js');
const MG = require('../js/engine.js');
const MGP = require('../js/puzzles.js');

const KINDS = ['weakness', 'armor', 'boss'];

/* ---------- hands and enemies are well-formed ---------- */
let hands = 0;
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (const kind of KINDS) {
      for (let i = 0; i < 120; i++) {
        const enemy = RPG.makeEnemy(band, stars, kind, null);
        assert.ok(enemy.name && enemy.emoji && enemy.weakness && enemy.hint, 'enemy needs name/emoji/weakness/hint');
        assert.ok(enemy.hp > 0 && enemy.themes.length >= 1);
        assert.strictEqual(!!enemy.charge, kind === 'boss');
        for (let k = 0; k < 5; k++) {
          const hand = RPG.makeHand(enemy.rule, stars);
          hands++;
          assert.strictEqual(hand.length, stars === 3 ? 6 : 5);
          const good = hand.filter((c) => c.correct).length;
          assert.ok(good >= 1 && good < hand.length, `${band} s${stars} ${kind} ${enemy.weakness}: need 1+ correct and 1+ wrong (got ${good}/${hand.length})`);
          hand.forEach((c) => {
            assert.strictEqual(c.correct, !!enemy.rule.check(c), 'correct flag must match rule.check');
            assert.ok(c.power >= 1 && c.power <= 3);
            assert.ok(c.label && !/NaN|undefined/.test(c.label));
            const text = c.correct ? enemy.rule.ok(c) : enemy.rule.why(c);
            assert.ok(text && !/NaN|undefined/.test(text), 'bad explanation: ' + text);
          });
          if (stars >= 2) {
            const wrong = hand.filter((c) => !c.correct);
            assert.ok(wrong.some((c) => c.power === 3), 'a tempting wrong card must exist at 2+ stars');
          }
        }
      }
    }
  }
}

/* ---------- armor: fraction comparison is exact ---------- */
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (let i = 0; i < 200; i++) {
      const r = RPG.armorRule(band, stars);
      for (let k = 0; k < 20; k++) {
        const c = r.correct();
        const w = r.wrong();
        assert.ok(r.check(c) && !r.check(w), `${band} s${stars} armor ${r.title}: ${c.label} / ${w.label}`);
        assert.ok(c.value >= 0 && c.value < 1 && w.value > 0 && w.value < 1);
        assert.ok(c.value > w.value, 'every passing card must be larger than every failing card');
      }
    }
  }
}

/* ---------- simulation: the math must matter ---------- */
const bots = {
  perfect: (b) => {
    let best = -1;
    b.hand.forEach((c, i) => { if (c.correct && (best < 0 || c.power > b.hand[best].power)) best = i; });
    return best;
  },
  // ignores the math entirely: always plays the highest-power card
  powerGreedy: (b) => {
    let best = 0;
    b.hand.forEach((c, i) => { if (c.power > b.hand[best].power) best = i; });
    return best;
  },
  random: (b) => MG.rnd(0, b.hand.length - 1),
};

function fight(bot, band, stars, kind, level, team, balancesCharges) {
  const enemy = RPG.makeEnemy(band, stars, kind, null);
  const b = RPG.newBattle({ band, stars, enemy, team, level });
  for (let guard = 0; !b.over && guard < 300; guard++) {
    if (b.charging && balancesCharges) {
      // a player who solves the Balance puzzle correctly
      let ok = false;
      for (let v = 0; v <= b.puzzle.max && !ok; v++) if (MGP.checkBalance(b.puzzle, v).balanced) ok = true;
      assert.ok(ok, 'boss charge puzzle must be solvable');
      RPG.cancelCharge(b);
    }
    RPG.play(b, bot(b));
  }
  assert.ok(b.over, 'battle must end');
  return b;
}

const N = 300;
const rate = { perfect: {}, powerGreedy: {}, random: {} };
for (const band of MG.BANDS) {
  for (let stars = 1; stars <= 3; stars++) {
    for (const kind of KINDS) {
      for (const name of Object.keys(bots)) {
        let wins = 0;
        for (let i = 0; i < N; i++) if (fight(bots[name], band, stars, kind, 1, [], true).over === 'win') wins++;
        rate[name][`${band}/s${stars}/${kind}`] = wins / N;
      }
    }
  }
}
const vals = (n, f) => Object.entries(rate[n]).filter(([k]) => f(k)).map(([, v]) => v);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

for (const [k, v] of Object.entries(rate.perfect)) assert.ok(v >= 0.99, `a perfect player should always win (${k}: ${v})`);
const rnd2 = avg(vals('random', () => true));
const greedy2 = avg(vals('powerGreedy', (k) => !k.includes('/s1/')));
const greedy1 = avg(vals('powerGreedy', (k) => k.includes('/s1/')));
assert.ok(rnd2 < 0.35, `random play should mostly lose (win rate ${rnd2.toFixed(2)})`);
assert.ok(greedy2 < 0.35, `ignoring the math (power-greedy) should mostly lose at 2+ stars (win rate ${greedy2.toFixed(2)})`);
assert.ok(greedy1 < 0.55, `ignoring the math should still lose often at 1 star (win rate ${greedy1.toFixed(2)})`);

// a beginner who gets about a third wrong still usually wins at 1 star (the game must not be punishing)
{
  let w = 0;
  let t = 0;
  for (const band of MG.BANDS) for (const kind of KINDS) for (let i = 0; i < 150; i++) {
    const enemy = RPG.makeEnemy(band, 1, kind, null);
    const b = RPG.newBattle({ band, stars: 1, enemy, team: [], level: 1 });
    for (let g = 0; !b.over && g < 300; g++) {
      if (b.charging) RPG.cancelCharge(b);
      const wrong = b.hand.map((c, k) => (c.correct ? -1 : k)).filter((k) => k >= 0);
      RPG.play(b, Math.random() < 0.35 ? wrong[MG.rnd(0, wrong.length - 1)] : bots.perfect(b));
    }
    t++;
    if (b.over === 'win') w++;
  }
  assert.ok(w / t >= 0.8, `a learner who misses a third of the time should usually win at 1 star (${(w / t).toFixed(2)})`);
}

// not impossible for a young player: one mistake per fight is survivable at level 1
let onceWrong = 0;
let trials = 0;
for (const band of MG.BANDS) for (const kind of KINDS) for (let i = 0; i < 100; i++) {
  const stars = 1;
  const enemy = RPG.makeEnemy(band, stars, kind, null);
  const b = RPG.newBattle({ band, stars, enemy, team: [], level: 1 });
  let slipped = false;
  for (let g = 0; !b.over && g < 300; g++) {
    if (b.charging) RPG.cancelCharge(b);
    if (!slipped && b.turn === 1) { slipped = true; const w = b.hand.findIndex((c) => !c.correct); RPG.play(b, w); continue; }
    RPG.play(b, bots.perfect(b));
  }
  trials++;
  if (b.over === 'win') onceWrong++;
}
assert.ok(onceWrong / trials >= 0.99, 'a single mistake must not lose a fight at 1 star');

/* ---------- specialists, boss charge, rewards, progression ---------- */
{
  const enemy = RPG.makeEnemy('4-5', 1, 'weakness', null);
  const matching = enemy.themes[0];
  assert.strictEqual(RPG.specialistBonus([matching], enemy), 1);
  assert.strictEqual(RPG.specialistBonus([], enemy), 0);
  assert.strictEqual(RPG.specialistBonus(['armor'], enemy), 0);
  const b = RPG.newBattle({ band: '4-5', stars: 1, enemy, team: [matching], level: 1 });
  const i = b.hand.findIndex((c) => c.correct);
  const before = b.enemyHp;
  const ev = RPG.play(b, i);
  assert.strictEqual(ev.dmg, RPG.HIT * (b.hand.length ? ev.card.power + 1 : 0), 'specialist adds +1 power');
  assert.strictEqual(b.enemyHp, Math.max(0, before - ev.dmg));
}
{
  const enemy = RPG.makeEnemy('2-3', 2, 'boss', null);
  assert.ok(enemy.themes.includes('boss'));
  const b = RPG.newBattle({ band: '2-3', stars: 2, enemy, team: [], level: 1 });
  assert.ok(!b.charging, 'no charge on turn 1');
  b.turn = 3; // jump to a charge turn by rebuilding the turn
  b.hand = RPG.makeHand(enemy.rule, 2);
  b.charging = true;
  b.puzzle = MGP.makeBalance('2-3', 2);
  const hp0 = b.teamHp;
  assert.ok(RPG.cancelCharge(b));
  const good = b.hand.findIndex((c) => c.correct);
  const ev = RPG.play(b, good);
  assert.strictEqual(ev.taken, 0, 'cancelled charge stuns the boss for the turn');
  assert.strictEqual(b.teamHp, hp0);
  // ignoring the charge takes the big hit
  const b2 = RPG.newBattle({ band: '2-3', stars: 2, enemy, team: [], level: 1 });
  b2.charging = true;
  b2.puzzle = MGP.makeBalance('2-3', 2);
  const ev2 = RPG.play(b2, b2.hand.findIndex((c) => c.correct));
  if (!ev2.over) assert.strictEqual(ev2.taken, RPG.CHARGE.dmg);
}
{
  const p = { settings: { band: '4-5' } };
  const r = RPG.ensureState(p);
  assert.strictEqual(r, p.games.rpg, 'RPG state lives under profile.games.rpg');
  assert.deepStrictEqual(r.creatures, ['multiples', 'factors', 'primes']);
  assert.strictEqual(r.team, undefined, 'a default team is never saved as if the player chose it');
  assert.deepStrictEqual(RPG.currentTeam(r), ['multiples', 'factors', 'primes']);
  assert.strictEqual(RPG.progress(r).level, 1);
  // bad or partial data is repaired
  const q = { settings: { band: '6' }, games: { rpg: { creatures: ['fractions', 'nope', 'fractions'], team: ['exponents', 'fractions'] } } };
  const r2 = RPG.ensureState(q);
  assert.deepStrictEqual(r2.creatures, ['fractions']);
  assert.deepStrictEqual(r2.team, ['fractions']);
  assert.deepStrictEqual(RPG.currentTeam(r2), ['fractions']);
  // rewards
  const e = RPG.makeEnemy('4-5', 1, 'weakness', null);
  const b = RPG.newBattle({ band: '4-5', stars: 1, enemy: e, team: [], level: 1 });
  b.misses = 0;
  const rw = RPG.rewards(b);
  assert.strictEqual(rw.xp, 20);
  b.misses = 1;
  assert.strictEqual(RPG.rewards(b).xp, 15);
  b.misses = 4;
  assert.strictEqual(RPG.rewards(b).xp, 10);
  const boss = RPG.newBattle({ band: '4-5', stars: 1, enemy: RPG.makeEnemy('4-5', 1, 'boss', null), team: [], level: 1 });
  boss.misses = 0;
  assert.strictEqual(RPG.rewards(boss).xp, 50);
  assert.strictEqual(RPG.rewards(boss).creature, 'boss');
  // XP is stored per device and level is derived from the total
  const s = { xpEarned: {}, wins: {}, bosses: {}, creatures: ['multiples'], team: ['multiples'] };
  assert.strictEqual(RPG.addXp(s, 40, 'lap'), 1);
  assert.deepStrictEqual([RPG.progress(s).level, RPG.progress(s).xp, RPG.progress(s).need], [2, 0, 60]);
  assert.strictEqual(RPG.addXp(s, 70, 'pad'), 1, 'XP from another device counts toward the same level');
  assert.deepStrictEqual([RPG.progress(s).level, RPG.progress(s).xp, RPG.progress(s).total], [3, 10, 110]);
  assert.strictEqual(RPG.levelFor(0).level, 1);
  assert.strictEqual(RPG.levelFor(39).level, 1);
  assert.strictEqual(RPG.levelFor(40).level, 2);
  assert.strictEqual(RPG.levelFor(100).level, 3);
  const out = RPG.applyRewards(s, { xp: 5, creature: 'primes', kind: 'weakness' }, 'lap');
  assert.strictEqual(out.joined.id, 'primes');
  assert.deepStrictEqual(RPG.currentTeam(s), ['multiples', 'primes']);
  assert.ok(s.teamAt > 0, 'a team change is timestamped so it can merge across devices');
  assert.strictEqual(RPG.applyRewards(s, { xp: 5, creature: 'primes', kind: 'weakness' }, 'lap').joined, null, 'a creature only joins once');
  assert.strictEqual(RPG.progress(s).wins, 2);
  RPG.applyRewards(s, { xp: 5, creature: 'boss', kind: 'boss' }, 'pad');
  assert.strictEqual(RPG.progress(s).bosses, 1);
  assert.ok(RPG.maxHp(5) > RPG.maxHp(1));
  assert.deepStrictEqual(RPG.reachable('K-1'), ['expressions', 'even-odd', 'compare', 'armor', 'boss']);
  // every skill a band can meet has a creature to befriend and a monster to fight
  for (const band of MG.BANDS) RPG.reachable(band).forEach((id) => assert.ok(RPG.creatureById(id) && RPG.ENEMY_ART[id], band + ' ' + id));
}

const pct = (x) => (x * 100).toFixed(0) + '%';
console.log(`OK: ${hands} hands verified. Win rates over ${N} fights per setting: perfect >= 99% everywhere; ` +
  `random ${pct(rnd2)}, ignoring-the-math (power-greedy) ${pct(greedy2)} at 2-3 stars / ${pct(greedy1)} at 1 star.`);
