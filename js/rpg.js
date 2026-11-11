/* Creature Quest: RPG battle logic (first slice). Pure logic, no DOM, unit-tested in Node.
 *
 * Design rule: the math is the CHOICE, never a gate. Each turn the player is dealt a hand of attack
 * cards and an enemy with a weakness rule. Cards that fit the rule hit for big damage; cards that don't
 * are resisted, heal the enemy, and cost a turn. A wrong card is shown with a tempting high power on
 * purpose, so picking by power alone (ignoring the math) is a losing strategy (see tests/rpg.test.js).
 *
 * Enemy kinds:
 *   weakness : rule from the Munchers rule set for the player's grade band (js/engine.js)
 *   armor    : fractions. Only attacks >= the armor value break through (comparing fractions)
 *   boss     : weakness rule + every 3rd turn a big "charge" that a Balance puzzle (js/puzzles.js) cancels
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const MG = isNode ? require('./engine.js') : root.MG;
  const MGP = isNode ? require('./puzzles.js') : root.MGP;
  const rnd = MG.rnd;
  const pick = (a) => a[rnd(0, a.length - 1)];
  const shuffle = MG.shuffle;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  /* ---------- tunables ---------- */
  const PLAN = ['weakness', 'weakness', 'armor', 'weakness', 'boss']; // one adventure = 5 battles
  const HIT = 3; // damage per point of (power + specialist bonus)
  const HEAL = 4; // enemy heals this much when a wrong card is played
  const ENEMY_HP = { weakness: [15, 18, 21], armor: [18, 21, 24], boss: [30, 36, 42] };
  const ENEMY_ATK = 2;
  const CHARGE = { every: 3, dmg: 5 };
  const XP_BASE = { weakness: 10, armor: 15, boss: 30 };
  const TEAM_SIZE = 3;

  const maxHp = (level) => Math.min(40, 16 + 2 * (level - 1));
  const xpToNext = (level) => 40 + 20 * (level - 1);

  /* ---------- content ---------- */
  const BAND_SKILLS = {
    'K-1': ['expressions', 'even-odd', 'compare'],
    '2-3': ['multiples', 'expressions', 'rounding', 'compare'],
    '4-5': ['multiples', 'factors', 'primes', 'expressions'],
    '6': ['fractions', 'exponents', 'compare', 'primes', 'factors'],
  };

  // Original characters (plain emoji, no licensed IP). id doubles as the skill theme the creature is strong against.
  const CREATURES = [
    { id: 'multiples', name: 'Hopper', emoji: '🦘', blurb: 'A skip-counting champion.', strong: 'multiples' },
    { id: 'factors', name: 'Splish', emoji: '🦦', blurb: 'Splits numbers into equal pieces.', strong: 'factors' },
    { id: 'primes', name: 'Primo', emoji: '🦄', blurb: 'One of a kind, just like a prime.', strong: 'prime numbers' },
    { id: 'even-odd', name: 'Pairo', emoji: '🐼', blurb: 'Always sorts things into pairs.', strong: 'even and odd' },
    { id: 'compare', name: 'Owlbert', emoji: '🦉', blurb: 'Can tell which is bigger at a glance.', strong: 'greater and less' },
    { id: 'rounding', name: 'Puffy', emoji: '🐡', blurb: 'Rounds off to the nearest friend.', strong: 'rounding' },
    { id: 'expressions', name: 'Octo', emoji: '🐙', blurb: 'Eight arms, lots of sums.', strong: 'sums and expressions' },
    { id: 'fractions', name: 'Fraxie', emoji: '🐰', blurb: 'Cuts carrots into equal slices.', strong: 'fractions' },
    { id: 'exponents', name: 'Powzer', emoji: '🐲', blurb: 'Grows stronger with every power.', strong: 'exponents' },
    { id: 'armor', name: 'Shelly', emoji: '🐢', blurb: 'Knows just how to crack a shield.', strong: 'armored enemies' },
    { id: 'boss', name: 'Pebble', emoji: '🪨', blurb: 'A tiny golem pup. Great against bosses.', strong: 'bosses' },
  ];
  const creatureById = (id) => CREATURES.find((c) => c.id === id);

  const ENEMY_ART = {
    multiples: { name: 'Skipper Goblin', emoji: '👺' },
    factors: { name: 'Splitter Spider', emoji: '🕷️' },
    primes: { name: 'Lone Wolf', emoji: '🐺' },
    'even-odd': { name: 'Pair Bat', emoji: '🦇' },
    compare: { name: 'Scale Serpent', emoji: '🐍' },
    rounding: { name: 'Round Snail', emoji: '🐌' },
    expressions: { name: 'Sum Ghost', emoji: '👻' },
    fractions: { name: 'Slice Ogre', emoji: '👹' },
    exponents: { name: 'Power Wyrm', emoji: '🐉' },
    armor: { name: 'Armor Crab', emoji: '🦀' },
    boss: { name: 'Grumble Golem', emoji: '🗿' },
  };

  const SKILLS = { armor: 'Fractions: breaking armor' };

  /* ---------- player state (lives on profile.rpg, backward compatible) ---------- */

  /** Creatures a player can still find at this grade: that band's monsters, plus armor and boss. */
  const reachable = (band) => (BAND_SKILLS[band] || BAND_SKILLS['2-3']).concat(['armor', 'boss']);
  const starters = (band) => (BAND_SKILLS[band] || BAND_SKILLS['2-3']).slice(0, 3);

  function ensureState(profile) {
    const r = profile.rpg || (profile.rpg = {});
    if (typeof r.xp !== 'number') r.xp = 0;
    if (typeof r.level !== 'number' || r.level < 1) r.level = 1;
    if (!Array.isArray(r.creatures) || !r.creatures.length) r.creatures = starters(profile.settings.band);
    r.creatures = [...new Set(r.creatures)].filter((id) => creatureById(id));
    if (!Array.isArray(r.team)) r.team = [];
    r.team = [...new Set(r.team)].filter((id) => r.creatures.includes(id)).slice(0, TEAM_SIZE);
    if (!r.team.length) r.team = r.creatures.slice(0, TEAM_SIZE);
    r.wins = r.wins || 0;
    r.bosses = r.bosses || 0;
    return r;
  }

  function addXp(r, amount) {
    let ups = 0;
    r.xp += amount;
    while (r.xp >= xpToNext(r.level)) {
      r.xp -= xpToNext(r.level);
      r.level++;
      ups++;
    }
    return ups;
  }

  /* ---------- armor rule: compare fractions ---------- */

  const ARMOR_DENOMS = {
    'K-1': [[2, 3, 4], [2, 3, 4], [2, 3, 4, 6]],
    '2-3': [[2, 3, 4], [2, 3, 4, 6, 8], [2, 3, 4, 5, 6, 8, 10]],
    '4-5': [[2, 3, 4, 5, 6], [3, 4, 5, 6, 8, 10], [5, 6, 7, 8, 9, 10, 12]],
    '6': [[2, 4, 5, 8, 10], [4, 5, 8, 10, 20, 25], [3, 5, 6, 8, 12, 20, 25]],
  };
  const pctText = (c) => Math.round((c.n / c.d) * 1000) / 10 + '%';
  const named = (c) => (c.label.endsWith('%') ? c.label : c.label + ' (' + pctText(c) + ')');

  function makeCard(n, d, mixed) {
    let label = n + '/' + d;
    const rd = d / gcd(n, d);
    if (mixed && 100 % rd === 0 && Math.random() < 0.5) {
      label = Math.random() < 0.5 ? String(Math.round((n / d) * 100) / 100) : Math.round((n / d) * 100) + '%';
    }
    return { label, n, d, value: n / d };
  }

  function armorRule(band, stars) {
    const denoms = (ARMOR_DENOMS[band] || ARMOR_DENOMS['2-3'])[stars - 1];
    const mixed = band === '6';
    const pool = [];
    denoms.forEach((d) => {
      for (let n = 1; n < d; n++) pool.push({ n, d, v: n / d });
    });
    // the armor needs at least two cards that break through and two that bounce off
    const split = (a) => {
      const pass = pool.filter((p) => p.n * a.d >= a.n * p.d).length;
      return [pass, pool.length - pass];
    };
    let cands = pool.filter((a) => a.v >= 0.25 && a.v <= 0.85 && split(a)[0] >= 2 && split(a)[1] >= 2);
    if (!cands.length) cands = pool.filter((a) => split(a)[0] >= 2 && split(a)[1] >= 2);
    const a0 = pick(cands);
    const A = makeCard(a0.n, a0.d, mixed);
    const passes = pool.filter((p) => p.n * A.d >= A.n * p.d);
    const fails = pool.filter((p) => p.n * A.d < A.n * p.d);
    const near = fails.filter((p) => A.value - p.v <= 0.15);
    return {
      id: 'armor',
      title: 'Armored! Only attacks of ' + A.label + ' or more break through',
      hint: 'Compare each card to ' + A.label + '. Bigger or equal gets through; smaller bounces off.',
      correct: () => {
        const p = pick(passes);
        return makeCard(p.n, p.d, mixed);
      },
      wrong: () => {
        const p = pick(stars === 3 && near.length && Math.random() < 0.6 ? near : fails);
        return makeCard(p.n, p.d, mixed);
      },
      check: (c) => c.n * A.d >= A.n * c.d,
      why: (c) => named(c) + ' is smaller than the armor ' + named(A) + ', so it bounces off.',
      ok: (c) => named(c) + ' is at least ' + named(A) + ': it breaks through!',
    };
  }

  /* ---------- enemies, hands ---------- */

  const weakTitle = (rule) => rule.title.replace(/^Eat /, 'Weak to ');

  function makeEnemy(band, stars, kind, lastRuleId) {
    const s = Math.min(3, Math.max(1, stars | 0 || 1));
    let rule;
    let art;
    let themes;
    if (kind === 'armor') {
      rule = armorRule(band, s);
      art = ENEMY_ART.armor;
      themes = ['armor'];
    } else {
      rule = MG.makeLevelRule(band, s, lastRuleId);
      art = kind === 'boss' ? ENEMY_ART.boss : ENEMY_ART[rule.id];
      themes = kind === 'boss' ? [rule.id, 'boss'] : [rule.id];
    }
    return {
      kind,
      name: art.name,
      emoji: art.emoji,
      rule,
      weakness: kind === 'armor' ? rule.title : weakTitle(rule),
      hint: rule.hint,
      hp: ENEMY_HP[kind][s - 1],
      atk: ENEMY_ATK,
      charge: kind === 'boss' ? Object.assign({}, CHARGE) : null,
      themes,
    };
  }

  function makeHand(rule, stars) {
    const size = stars === 3 ? 6 : 5;
    const nCorrect = stars === 3 ? pick([1, 2]) : pick([2, 3]);
    const cards = [];
    const seen = new Set();
    const add = (gen) => {
      let c;
      let tries = 0;
      do {
        c = gen();
        tries++;
      } while (seen.has(c.label) && tries < 40);
      seen.add(c.label);
      cards.push(Object.assign({}, c, { correct: !!rule.check(c), power: rnd(1, 3) }));
    };
    for (let i = 0; i < nCorrect; i++) add(rule.correct);
    for (let i = 0; i < size - nCorrect; i++) add(rule.wrong);
    // a tempting wrong card at every level: the strongest-looking card is never a free pick
    const wrong = cards.filter((c) => !c.correct);
    if (wrong.length && !wrong.some((c) => c.power === 3)) pick(wrong).power = 3;
    return shuffle(cards);
  }

  /* ---------- battle ---------- */

  function specialistBonus(teamIds, enemy) {
    const n = teamIds.filter((id) => {
      const c = creatureById(id);
      return c && enemy.themes.includes(c.id);
    }).length;
    return Math.min(2, n);
  }

  function startTurn(b) {
    const e = b.enemy;
    b.hand = makeHand(e.rule, b.stars);
    b.charging = false;
    b.puzzle = null;
    if (e.charge && b.turn % e.charge.every === 0) {
      b.charging = true;
      b.puzzle = MGP.makeBalance(b.band, b.stars);
    }
  }

  function newBattle(o) {
    const level = o.level || 1;
    const team = (o.team || []).slice(0, TEAM_SIZE);
    const b = {
      band: o.band,
      stars: o.stars,
      enemy: o.enemy,
      team,
      level,
      teamMax: maxHp(level),
      teamHp: maxHp(level),
      enemyMax: o.enemy.hp,
      enemyHp: o.enemy.hp,
      bonus: specialistBonus(team, o.enemy),
      turn: 1,
      hits: 0,
      misses: 0,
      over: null,
      stunned: false,
    };
    startTurn(b);
    return b;
  }

  /** Solving the boss's Balance puzzle cancels its charge and stuns it for this turn. */
  function cancelCharge(b) {
    if (!b.charging) return false;
    b.charging = false;
    b.puzzle = null;
    b.stunned = true;
    return true;
  }

  /** Play hand[i]. Returns an event describing what happened (the UI explains it to the player). */
  function play(b, i) {
    if (b.over) return null;
    const card = b.hand[i];
    if (!card) return null;
    const e = b.enemy;
    const ev = { card, correct: card.correct, dmg: 0, heal: 0, taken: 0, charged: false, stunned: false, over: null, msg: '' };
    if (card.correct) {
      ev.dmg = HIT * (card.power + b.bonus);
      b.enemyHp = Math.max(0, b.enemyHp - ev.dmg);
      b.hits++;
      ev.msg = e.rule.ok(card);
    } else {
      ev.heal = Math.min(HEAL, b.enemyMax - b.enemyHp);
      b.enemyHp += ev.heal;
      b.misses++;
      ev.msg = e.rule.why(card);
    }
    if (b.enemyHp <= 0) {
      b.over = ev.over = 'win';
      return ev;
    }
    if (b.charging) {
      ev.taken = e.charge.dmg;
      ev.charged = true;
    } else if (b.stunned) {
      ev.stunned = true;
    } else {
      ev.taken = e.atk;
    }
    b.stunned = false;
    b.charging = false;
    b.teamHp = Math.max(0, b.teamHp - ev.taken);
    if (b.teamHp <= 0) {
      b.over = ev.over = 'lose';
      return ev;
    }
    b.turn++;
    startTurn(b);
    return ev;
  }

  /** XP and unlocks for a won battle. XP rewards fighting well, not just showing up. */
  function rewards(b) {
    const k = b.enemy.kind;
    let xp = XP_BASE[k];
    if (b.misses === 0) xp += k === 'boss' ? 20 : 10;
    else if (b.misses === 1) xp += 5;
    return { xp, creature: k === 'boss' ? 'boss' : b.enemy.rule.id, kind: k, clean: b.misses === 0 };
  }

  /** Apply rewards to profile.rpg. Returns { levelUps, joined } where joined is a creature or null. */
  function applyRewards(r, rw) {
    const levelUps = addXp(r, rw.xp);
    r.wins++;
    if (rw.kind === 'boss') r.bosses++;
    let joined = null;
    if (rw.creature && creatureById(rw.creature) && !r.creatures.includes(rw.creature)) {
      r.creatures.push(rw.creature);
      joined = creatureById(rw.creature);
      if (r.team.length < TEAM_SIZE) r.team.push(rw.creature);
    }
    return { levelUps, joined };
  }

  const sampleText = (band, stars) => 'A monster appears! ' + weakTitle(MG.makeLevelRule(band, stars, null)) + '. Which card do you play?';

  const api = {
    PLAN, TEAM_SIZE, CREATURES, ENEMY_ART, SKILLS, BAND_SKILLS, HIT, HEAL, CHARGE,
    creatureById, starters, reachable, ensureState, addXp, xpToNext, maxHp,
    makeEnemy, makeHand, armorRule, weakTitle, sampleText,
    newBattle, play, cancelCharge, specialistBonus, rewards, applyRewards,
  };
  if (isNode) module.exports = api;
  else root.RPG = api;
})(typeof window !== 'undefined' ? window : globalThis);
