/* Creature Quest: RPG battle logic (v2). Pure logic, no DOM, unit-tested in Node.
 *
 * Design rules (see "Creature Quest v2" in docs/game-ideas.md):
 *  - The math is the CHOICE, never a gate. A right answer does damage; a wrong answer does none.
 *  - The math NEVER depends on the team. Every enemy has its own weakness and the hand you are dealt for it is the same whichever ally acts.
 *    Allies change what a right answer DOES (hit all, split, crit, heal, shield, stun, hint...), so no team can make a fight unwinnable.
 *  - Fights have 1 to 3 enemies, each with its own weakness. You tap an enemy to target it, pick an ally, and play a card.
 *  - After your turn EVERY living enemy hits back. A wrong turn is costly because all of them still attack, so guessing loses.
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
  const Save = isNode ? require('./save.js') : root.Save;
  const rnd = MG.rnd;
  const pick = (a) => a[rnd(0, a.length - 1)];
  const shuffle = MG.shuffle;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  /* ---------- tunables (a mutable object so simulations and tests can sweep them) ---------- */
  const TUNE = {
    BASE_DMG: 6, // damage of a right answer
    SPECIALIST_BONUS: 3, // extra damage when the acting ally's theme matches the target's skill
    HEAL_AMOUNT: 3,
    SHIELD_MAX: 2,
    TEAM_BASE_HP: 26,
    TEAM_HP_PER_LEVEL: 2,
    TEAM_HP_CAP: 50,
    // enemy strength is the SAME at every star level: stars make the math (and the hand) harder, not the fight longer
    ENEMY_HP: { weakness: [10, 10, 10], armor: [12, 12, 12], boss: [22, 22, 22] },
    HAND_SIZE: [5, 5, 6], // cards dealt, by stars 1..3
    CORRECT_PER_HAND: [[1, 2], [1, 2], [1, 2]], // how many of them fit the weakness (min, max), by stars 1..3: fewer right cards makes guessing a losing plan
    ENEMY_ATK: { weakness: 2, armor: 3, boss: 3 },
    CHARGE: { every: 3, dmg: 7 },
    XP_BASE: { weakness: 8, armor: 12, boss: 25 },
  };
  const TEAM_SIZE = 3;

  // One adventure = five encounters. Armor and boss encounters are rescues: a caged ally is freed when you win.
  const ADVENTURE = [
    { kinds: ['weakness'] },
    { kinds: ['weakness', 'weakness'] },
    { kinds: ['armor', 'weakness'], rescue: true },
    { kinds: ['weakness', 'weakness', 'weakness'] },
    { kinds: ['boss', 'weakness'], rescue: true },
  ];
  const PLAN = ADVENTURE;

  const maxHp = (level) => Math.min(TUNE.TEAM_HP_CAP, TUNE.TEAM_BASE_HP + TUNE.TEAM_HP_PER_LEVEL * (level - 1));
  const xpToNext = (level) => 40 + 20 * (level - 1);

  /* ---------- content ---------- */
  const BAND_SKILLS = {
    'K-1': ['expressions', 'even-odd', 'compare'],
    '2-3': ['multiples', 'expressions', 'rounding', 'compare'],
    '4-5': ['multiples', 'factors', 'primes', 'expressions'],
    '6': ['fractions', 'exponents', 'compare', 'primes', 'factors'],
  };

  // Original characters (plain emoji, no licensed IP). id doubles as the skill theme the ally is an expert in. Each ally has an EFFECT that
  // happens when a right answer is played with them. Effects only add on top of the right answer's damage, so no ally is ever required.
  const CREATURES = [
    { id: 'multiples', name: 'Hopper', emoji: '🦘', blurb: 'A skip-counting champion.', strong: 'multiples', effect: 'sweep', effectName: 'Skip-strike', effectText: 'Also hits every other enemy for half damage.' },
    { id: 'factors', name: 'Splish', emoji: '🦦', blurb: 'Splits numbers into equal pieces.', strong: 'factors', effect: 'split', effectName: 'Split', effectText: 'Also hits the weakest other enemy for half damage.' },
    { id: 'primes', name: 'Primo', emoji: '🦄', blurb: 'One of a kind, just like a prime.', strong: 'prime numbers', effect: 'crit', effectName: 'Lucky strike', effectText: '50% more damage.' },
    { id: 'even-odd', name: 'Pairo', emoji: '🐼', blurb: 'Always sorts things into pairs.', strong: 'even and odd', effect: 'heal', effectName: 'Share', effectText: 'Heals your team a little.' },
    { id: 'compare', name: 'Owlbert', emoji: '🦉', blurb: 'Can tell which is bigger at a glance.', strong: 'greater and less', effect: 'hint', effectName: 'Wise hint', effectText: 'Next turn, every hand has a wrong card removed.' },
    { id: 'rounding', name: 'Puffy', emoji: '🐡', blurb: 'Rounds off to the nearest friend.', strong: 'rounding', effect: 'shield', effectName: 'Puff up', effectText: 'Blocks the next enemy attack (holds up to 2).' },
    { id: 'expressions', name: 'Octo', emoji: '🐙', blurb: 'Eight arms, lots of sums.', strong: 'sums and expressions', effect: 'combo', effectName: 'Many arms', effectText: '+2 damage for each right answer in a row (up to +6).' },
    { id: 'fractions', name: 'Fraxie', emoji: '🐰', blurb: 'Cuts carrots into equal slices.', strong: 'fractions', effect: 'slice', effectName: 'Slice', effectText: 'Takes at least a quarter of the enemy\'s health.' },
    { id: 'exponents', name: 'Powzer', emoji: '🐲', blurb: 'Grows stronger with every power.', strong: 'exponents', effect: 'stun', effectName: 'Roar', effectText: 'The enemy skips its next attack.' },
    { id: 'armor', name: 'Shelly', emoji: '🐢', blurb: 'Knows just how to crack a shield.', strong: 'armored enemies', effect: 'shield', effectName: 'Shell up', effectText: 'Blocks the next enemy attack (holds up to 2).' },
    { id: 'boss', name: 'Pebble', emoji: '🪨', blurb: 'A tiny golem pup. Great against bosses.', strong: 'bosses', effect: 'stun', effectName: 'Rumble', effectText: 'The enemy skips its next attack.' },
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

  /* ---------- player state (profile.games.rpg; see js/save.js for how it merges across devices) ---------- */

  const starters = (band) => (BAND_SKILLS[band] || BAND_SKILLS['2-3']).slice(0, 3);
  /** Creatures a player can still find at this grade: that band's monsters, plus armor and boss. */
  const reachable = (band) => (BAND_SKILLS[band] || BAND_SKILLS['2-3']).concat(['armor', 'boss']);

  /**
   * Saved fields: xpEarned/wins/bosses (per-device counters, they only ever go up), creatures (a set), team (+teamAt, last write wins).
   * Level is DERIVED from total XP. A default team is computed when reading (currentTeam) and never saved as if the player chose it.
   */
  function ensureState(profile) {
    const games = profile.games || (profile.games = {});
    const r = games.rpg || (games.rpg = {});
    ['xpEarned', 'wins', 'bosses'].forEach((k) => { if (!r[k] || typeof r[k] !== 'object') r[k] = {}; });
    if (!Array.isArray(r.creatures) || !r.creatures.length) r.creatures = starters(profile.settings.band);
    r.creatures = [...new Set(r.creatures)].filter((id) => creatureById(id));
    if (Array.isArray(r.team)) r.team = [...new Set(r.team)].filter((id) => r.creatures.includes(id)).slice(0, TEAM_SIZE);
    return r;
  }

  const currentTeam = (r) => {
    const t = (Array.isArray(r.team) ? r.team : []).filter((id) => r.creatures.includes(id)).slice(0, TEAM_SIZE);
    return t.length ? t : r.creatures.slice(0, TEAM_SIZE);
  };

  function setTeam(r, ids, now) {
    r.team = ids.filter((id) => r.creatures.includes(id)).slice(0, TEAM_SIZE);
    r.teamAt = now === undefined ? Date.now() : now;
  }

  const totalXp = (r) => Save.sumCounter(r.xpEarned);

  function levelFor(total) {
    let level = 1;
    let left = total;
    while (left >= xpToNext(level)) {
      left -= xpToNext(level);
      level++;
    }
    return { level, xp: left };
  }

  /** Everything the screens need: level, XP into this level, XP needed, wins, bosses. */
  function progress(r) {
    const total = totalXp(r);
    const l = levelFor(total);
    return { level: l.level, xp: l.xp, need: xpToNext(l.level), total, wins: Save.sumCounter(r.wins), bosses: Save.sumCounter(r.bosses) };
  }

  /** Add XP for this device. Returns how many levels were gained. */
  function addXp(r, amount, dev) {
    const before = levelFor(totalXp(r)).level;
    Save.incCounter(r.xpEarned, dev, amount);
    return levelFor(totalXp(r)).level - before;
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

  /* ---------- enemies, encounters, hands ---------- */

  const weakTitle = (rule) => rule.title.replace(/^Eat /, 'Weak to ');
  const clampStars = (stars) => Math.min(3, Math.max(1, stars | 0 || 1));

  /**
   * avoid: skill ids this enemy's weakness must NOT repeat (the other enemies in the same fight).
   * prefer: skill ids to avoid if possible (for example the previous fight's), relaxed when a grade has too few skills to satisfy it.
   */
  function makeEnemy(band, stars, kind, avoid, prefer) {
    const s = clampStars(stars);
    const hard = [].concat(avoid || []);
    const soft = hard.concat(prefer || []);
    let rule;
    let art;
    let themes;
    if (kind === 'armor') {
      rule = armorRule(band, s);
      art = ENEMY_ART.armor;
      themes = ['armor'];
    } else {
      for (let i = 0; i < 60; i++) {
        rule = MG.makeLevelRule(band, s, null);
        if (!(i < 30 ? soft : hard).includes(rule.id)) break;
      }
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
      hp: TUNE.ENEMY_HP[kind][s - 1],
      atk: TUNE.ENEMY_ATK[kind],
      charge: kind === 'boss' ? Object.assign({}, TUNE.CHARGE) : null,
      themes,
    };
  }

  /** Allies a rescue could free, in order: this grade's creatures you do not own, then Shelly. (Pebble is the boss rescue.) */
  function rescueCandidates(band, owned) {
    return (BAND_SKILLS[band] || BAND_SKILLS['2-3']).concat(['armor']).filter((id, i, a) => !owned.includes(id) && a.indexOf(id) === i);
  }

  /**
   * Build the five encounters of an adventure. Groups have 1 to 3 enemies, each with a different weakness (at 1 star, at most 2 enemies).
   * Two encounters are rescues: the ally freed is the next one the player does not own (the boss always guards Pebble first).
   */
  function planAdventure(band, stars, owned) {
    const s = clampStars(stars);
    const have = owned || [];
    const cand = rescueCandidates(band, have);
    let last = null;
    const encounters = ADVENTURE.map((slot) => {
      const kinds = slot.kinds.slice(0, s === 1 ? 2 : 3);
      const used = [];
      const enemies = kinds.map((kind) => {
        const e = makeEnemy(band, s, kind, used, [last].filter(Boolean));
        if (kind !== 'armor') used.push(e.rule.id);
        return e;
      });
      last = used[used.length - 1] || last;
      return { enemies, rescue: null, rescueSlot: !!slot.rescue, hasBoss: kinds.includes('boss') };
    });
    const first = cand.shift() || null;
    encounters[2].rescue = first;
    encounters[4].rescue = have.includes('boss') ? cand.shift() || null : 'boss';
    return encounters;
  }

  function makeHand(rule, stars) {
    const size = TUNE.HAND_SIZE[stars - 1];
    const [lo, hi] = TUNE.CORRECT_PER_HAND[stars - 1];
    const nCorrect = rnd(lo, hi);
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
      cards.push(Object.assign({}, c, { correct: !!rule.check(c) }));
    };
    for (let i = 0; i < nCorrect; i++) add(rule.correct);
    for (let i = 0; i < size - nCorrect; i++) add(rule.wrong);
    return shuffle(cards);
  }

  /* ---------- battle ---------- */

  const living = (b) => b.foes.filter((f) => f.alive);

  function startTurn(b) {
    if (!b.foes[b.target] || !b.foes[b.target].alive) b.target = b.foes.findIndex((f) => f.alive);
    // one hand per living enemy, dealt once per turn: switching targets never re-rolls a hand
    b.hands = b.foes.map((f) => (f.alive ? makeHand(f.enemy.rule, b.stars) : []));
    if (b.hintNext > 0) {
      b.hands.forEach((h) => {
        for (let n = 0; n < b.hintNext; n++) {
          const wrong = h.map((c, i) => (c.correct ? -1 : i)).filter((i) => i >= 0);
          if (wrong.length > 1) h.splice(pick(wrong), 1); // always leave at least one wrong card so the choice stays real
        }
      });
      b.hintNext = 0;
    }
    b.puzzle = null;
    b.foes.forEach((f) => {
      f.charging = false;
      if (f.alive && f.enemy.charge && b.turn % f.enemy.charge.every === 0) {
        f.charging = true;
        b.puzzle = MGP.makeBalance(b.band, b.stars);
      }
    });
  }

  function newBattle(o) {
    const level = o.level || 1;
    const enemies = o.enemies || [o.enemy];
    const b = {
      band: o.band,
      stars: o.stars,
      level,
      team: (o.team || []).slice(0, TEAM_SIZE),
      teamMax: maxHp(level),
      teamHp: maxHp(level),
      shield: 0,
      foes: enemies.map((enemy, i) => ({ i, enemy, hp: enemy.hp, max: enemy.hp, alive: true, stunned: false, charging: false })),
      rescue: o.rescue || null,
      target: 0,
      ally: 0,
      turn: 1,
      hits: 0,
      misses: 0,
      streak: 0,
      hintNext: 0,
      over: null,
    };
    startTurn(b);
    return b;
  }

  /** Choose which enemy to attack (a free action; the hand for each enemy was dealt at the start of the turn). */
  function setTarget(b, i) {
    if (b.over || !b.foes[i] || !b.foes[i].alive) return false;
    b.target = i;
    return true;
  }
  /** Choose which ally acts (a free action). */
  function setAlly(b, j) {
    if (b.over || j < 0 || j >= b.team.length) return false;
    b.ally = j;
    return true;
  }
  const currentHand = (b) => b.hands[b.target] || [];

  /** Solving the boss's Balance puzzle cancels its charge and stuns it for this turn. */
  function cancelCharge(b) {
    const f = b.foes.find((x) => x.alive && x.charging);
    if (!f) return false;
    f.charging = false;
    f.stunned = true;
    b.puzzle = null;
    return true;
  }

  function damageFoe(f, amount, ev) {
    const dealt = Math.min(f.hp, amount);
    f.hp -= dealt;
    const killed = f.hp <= 0;
    if (killed) f.alive = false;
    ev.hits.push({ i: f.i, amount, killed });
  }

  /** Play hand[i] against the current target with the current ally. Returns an event the UI animates and explains. */
  function play(b, i) {
    if (b.over) return null;
    const hand = currentHand(b);
    const card = hand[i];
    if (!card) return null;
    const foe = b.foes[b.target];
    const allyId = b.team[b.ally];
    const ally = creatureById(allyId);
    const ev = { card, correct: card.correct, target: b.target, ally: allyId, effect: null, specialist: false, hits: [], healed: 0, shieldGained: 0, stunned: null, hint: false, msg: '', attacks: [], over: null };

    if (card.correct) {
      ev.msg = foe.enemy.rule.ok(card);
      let dmg = TUNE.BASE_DMG;
      if (ally && foe.enemy.themes.includes(ally.id)) {
        dmg += TUNE.SPECIALIST_BONUS;
        ev.specialist = true;
      }
      const effect = ally ? ally.effect : null;
      ev.effect = effect;
      if (effect === 'crit') dmg = Math.round(dmg * 1.5);
      if (effect === 'combo') dmg += Math.min(6, 2 * b.streak);
      if (effect === 'slice') dmg = Math.max(dmg, Math.ceil(foe.max / 4));
      const others = living(b).filter((f) => f !== foe);
      damageFoe(foe, dmg, ev);
      if (effect === 'sweep') others.forEach((f) => damageFoe(f, Math.max(1, Math.floor(dmg / 2)), ev));
      if (effect === 'split' && others.length) damageFoe(others.slice().sort((x, y) => x.hp - y.hp)[0], Math.max(1, Math.floor(dmg / 2)), ev);
      if (effect === 'heal') {
        ev.healed = Math.min(TUNE.HEAL_AMOUNT, b.teamMax - b.teamHp);
        b.teamHp += ev.healed;
      }
      if (effect === 'shield') {
        ev.shieldGained = Math.min(TUNE.SHIELD_MAX, b.shield + 1) - b.shield;
        b.shield += ev.shieldGained;
      }
      if (effect === 'stun' && foe.alive) {
        foe.stunned = true;
        ev.stunned = foe.i;
      }
      if (effect === 'hint') {
        b.hintNext = 1;
        ev.hint = true;
      }
      b.hits++;
      b.streak++;
    } else {
      ev.msg = foe.enemy.rule.why(card);
      b.misses++;
      b.streak = 0;
    }

    if (!living(b).length) {
      b.over = ev.over = 'win';
      return ev;
    }

    // every living enemy hits back, one after another
    for (const f of living(b)) {
      const a = { i: f.i, dmg: 0, blocked: false, skipped: false, charged: false };
      if (f.stunned) {
        a.skipped = true;
      } else {
        a.charged = f.charging;
        a.dmg = f.charging ? f.enemy.charge.dmg : f.enemy.atk;
        if (b.shield > 0) {
          b.shield--;
          a.blocked = true;
          a.dmg = 0;
        }
        b.teamHp = Math.max(0, b.teamHp - a.dmg);
      }
      f.stunned = false;
      f.charging = false;
      ev.attacks.push(a);
      if (b.teamHp <= 0) {
        b.over = ev.over = 'lose';
        return ev;
      }
    }
    b.turn++;
    startTurn(b);
    return ev;
  }

  /** XP for a won battle (every enemy counts). XP rewards fighting well, not just showing up. The rescued ally comes from the encounter. */
  function rewards(b) {
    let xp = 0;
    b.foes.forEach((f) => (xp += TUNE.XP_BASE[f.enemy.kind]));
    const boss = b.foes.some((f) => f.enemy.kind === 'boss');
    if (b.misses === 0) xp += boss ? 20 : 10;
    else if (b.misses === 1) xp += 5;
    return { xp, creature: b.rescue || null, boss, clean: b.misses === 0 };
  }

  /** Apply rewards for this device. Returns { levelUps, joined } where joined is the freed ally or null. */
  function applyRewards(r, rw, dev) {
    const levelUps = addXp(r, rw.xp, dev);
    Save.incCounter(r.wins, dev, 1);
    if (rw.boss) Save.incCounter(r.bosses, dev, 1);
    let joined = null;
    if (rw.creature && creatureById(rw.creature) && !r.creatures.includes(rw.creature)) {
      r.creatures.push(rw.creature);
      joined = creatureById(rw.creature);
      const team = currentTeam(r);
      if (team.length < TEAM_SIZE && !team.includes(rw.creature)) setTeam(r, team.concat(rw.creature));
    }
    return { levelUps, joined };
  }

  const sampleText = (band, stars) => 'A group of monsters appears! One of them is ' + weakTitle(MG.makeLevelRule(band, stars, null)).replace(/^Weak/, 'weak') + '. Tap it, then play the card that fits.';

  const api = {
    TUNE, ADVENTURE, PLAN, TEAM_SIZE, CREATURES, ENEMY_ART, SKILLS, BAND_SKILLS,
    creatureById, starters, reachable, ensureState, currentTeam, setTeam, totalXp, levelFor, progress, addXp, xpToNext, maxHp,
    makeEnemy, makeHand, armorRule, weakTitle, sampleText, rescueCandidates, planAdventure,
    newBattle, setTarget, setAlly, currentHand, play, cancelCharge, rewards, applyRewards,
  };
  if (isNode) module.exports = api;
  else root.RPG = api;
})(typeof window !== 'undefined' ? window : globalThis);
