// Simulated players for Creature Quest balance tests and sweeps.
const RPG = require('../../js/rpg.js');
const MGP = require('../../js/puzzles.js');
const MG = require('../../js/engine.js');
const rnd = MG.rnd;

const alive = (b) => b.foes.filter((f) => f.alive);
const correctIdx = (h) => h.map((c, i) => (c.correct ? i : -1)).filter((i) => i >= 0);
const wrongIdx = (h) => h.map((c, i) => (c.correct ? -1 : i)).filter((i) => i >= 0);
const pickOne = (a) => a[rnd(0, a.length - 1)];
/** Allies who have not acted yet this turn (each friend acts once per turn, then the enemies act). */
const ready = (b) => b.team.map((id, j) => j).filter((j) => !b.acted[j]);

/** Can the player solve this turn's Balance puzzle? (always possible: puzzles have a unique solution) */
function solveCharge(b) {
  if (!b.puzzle) return;
  for (let v = 0; v <= b.puzzle.max; v++) if (MGP.checkBalance(b.puzzle, v).balanced) return RPG.cancelCharge(b);
}

// policies: each takes the battle and returns { target, ally, card, solves }
const policies = {
  /** Always answers right. Targets the enemy that will die soonest, and the ally whose theme matches (else the first). */
  perfect: (b) => {
    const tgt = alive(b).slice().sort((x, y) => x.hp - y.hp)[0].i;
    const match = ready(b).find((j) => b.foes[tgt].enemy.themes.includes(b.team[j]));
    return { target: tgt, ally: match !== undefined ? match : ready(b)[0], card: pickOne(correctIdx(b.hands[tgt])), solves: true };
  },
  /** Always answers right, but acts with a random ally and a random enemy (the effects can never be required). */
  perfectAnyAlly: (b) => {
    const tgt = pickOne(alive(b)).i;
    return { target: tgt, ally: pickOne(ready(b)), card: pickOne(correctIdx(b.hands[tgt])), solves: true };
  },
  /** A learner: answers wrong with probability q (and does not always solve the boss puzzle). */
  learner: (q) => (b) => {
    const tgt = alive(b).slice().sort((x, y) => x.hp - y.hp)[0].i;
    const h = b.hands[tgt];
    const wrong = wrongIdx(h);
    const card = Math.random() < q && wrong.length ? pickOne(wrong) : pickOne(correctIdx(h));
    return { target: tgt, ally: ready(b)[0], card, solves: Math.random() < 0.8 };
  },
  /** Ignores the math: random enemy, random ally, random card; never solves the puzzle. */
  random: (b) => {
    const tgt = pickOne(alive(b)).i;
    return { target: tgt, ally: pickOne(ready(b)), card: rnd(0, b.hands[tgt].length - 1), solves: false };
  },
};

/** Fight one encounter to the end. Returns the battle. */
function fight(encounter, o, policy) {
  const b = RPG.newBattle({ band: o.band, stars: o.stars, enemies: encounter.enemies, team: o.team, level: o.level || 1, rescue: encounter.rescue });
  for (let guard = 0; !b.over && guard < 200; guard++) {
    const a = policy(b);
    if (a.solves) solveCharge(b);
    RPG.setTarget(b, a.target);
    RPG.setAlly(b, a.ally);
    RPG.play(b, a.card);
  }
  if (!b.over) throw new Error('battle did not end');
  return b;
}

/** Win rate per (stars, encounter slot) for a policy, over all grade bands. */
function winRates(policy, { teamFor, trials, levelFor }) {
  const out = {};
  for (const band of MG.BANDS) {
    for (let stars = 1; stars <= 3; stars++) {
      for (let t = 0; t < trials; t++) {
        const team = teamFor(band);
        const plan = RPG.planAdventure(band, stars, team);
        plan.forEach((enc, slot) => {
          const b = fight(enc, { band, stars, team, level: levelFor ? levelFor(slot) : 1 }, policy);
          const k = `s${stars}/slot${slot + 1}`;
          (out[k] || (out[k] = { w: 0, n: 0 }));
          out[k].n++;
          if (b.over === 'win') out[k].w++;
        });
      }
    }
  }
  const rates = {};
  Object.keys(out).forEach((k) => (rates[k] = out[k].w / out[k].n));
  return rates;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const byStars = (rates, s) => mean(Object.keys(rates).filter((k) => k.startsWith('s' + s + '/')).map((k) => rates[k]));
const overall = (rates) => mean(Object.values(rates));

module.exports = { policies, fight, winRates, byStars, overall, mean, solveCharge };
