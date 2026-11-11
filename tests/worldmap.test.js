// Run with: node tests/worldmap.test.js
// Verifies the world map data and unlock rules, that progress merges across devices, and that every enemy and ally
// has art in both themes (and that the files exist), so a missing image is caught here and not in front of a child.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const W = require('../js/worldmap.js');
const Art = require('../js/art.js');
const RPG = require('../js/rpg.js');
const MGP = require('../js/puzzles.js');
const Save = require('../js/save.js');

/* ---------- the map data is sound ---------- */
assert.deepStrictEqual(W.validate(W.REGIONS), [], 'map data has problems');
W.REGIONS.forEach((reg) => {
  assert.ok(W.nodeById(reg, reg.start), reg.id + ' start exists');
  const fights = reg.nodes.filter((n) => W.enemyKind(n));
  assert.ok(fights.length >= 3, reg.id + ' has real battles');
  // every rescue frees a creature that exists
  reg.nodes.filter((n) => n.type === 'rescue').forEach((n) => assert.ok(RPG.creatureById(n.ally), n.id + ' frees a real creature'));
  // enemy kinds are ones rpg.js can build
  fights.forEach((n) => assert.ok(['weakness', 'armor', 'boss'].includes(W.enemyKind(n))));
});
// every fight node builds a real v2 encounter at every band and star level: a group, each monster with its own weakness
W.REGIONS.forEach((reg) => reg.nodes.filter((n) => W.kindsOf(n)).forEach((n) => {
  ['K-1', '2-3', '4-5', '6'].forEach((band) => [1, 2, 3].forEach((stars) => {
    for (let i = 0; i < 20; i++) {
      const enc = RPG.makeEncounter(band, stars, W.kindsOf(n), { rescue: n.ally || null });
      assert.ok(enc.enemies.length >= 1 && enc.enemies.length <= Math.min(W.kindsOf(n).length, RPG.maxGroup(stars)), n.id + ' group size follows the star cap');
      const skills = enc.enemies.filter((e) => e.kind !== 'armor').map((e) => e.rule.id);
      assert.strictEqual(new Set(skills).size, skills.length, n.id + ': no two monsters share a weakness');
      assert.strictEqual(enc.rescue, n.ally || null, n.id + ' rescue passes straight through');
      const b = RPG.newBattle({ band, stars, enemies: enc.enemies, team: ['multiples'], level: 1, rescue: enc.rescue });
      assert.strictEqual(b.foes.length, enc.enemies.length);
    }
  }));
}));
// story and camp spots are not fights, and an already-owned rescue joins nobody
W.REGIONS.forEach((reg) => reg.nodes.filter((n) => n.type === 'story' || n.type === 'camp').forEach((n) => assert.strictEqual(W.kindsOf(n), null)));
{
  const owned = { creatures: ['compare'], team: [], xpEarned: {}, wins: {}, bosses: {} };
  const enc = RPG.makeEncounter('2-3', 2, ['weakness'], { rescue: 'compare' });
  const b = RPG.newBattle({ band: '2-3', stars: 2, enemies: enc.enemies, team: ['multiples'], level: 1, rescue: enc.rescue });
  assert.strictEqual(RPG.applyRewards(owned, RPG.rewards(b), 'dev').joined, null, 'an owned friend does not join twice');
}
// camps and puzzle spots: optional, with data the screens can use
W.REGIONS.forEach((reg) => reg.nodes.forEach((n) => {
  if (n.type === 'camp' && n.buff) assert.ok(RPG.BUFFS[n.buff], n.id + ' gives a buff rpg.js knows');
  if (n.type === 'puzzle') {
    assert.ok(['balance', 'machine'].includes(n.puzzle), n.id + ' is a balance or machine puzzle');
    assert.strictEqual(W.kindsOf(n), null, 'a puzzle spot has no monsters');
    assert.ok(n.script && n.script.length, n.id + ' tells you what to do');
    // it is a side spot: nothing past it needs it, so a player can always finish the region without it
    assert.ok(!reg.nodes.some((m) => m.next.includes(n.id) && m.type === 'boss'));
    ['K-1', '2-3', '4-5', '6'].forEach((band) => [1, 2, 3].forEach((stars) => {
      const pz = n.puzzle === 'machine' ? MGP.makeMachine(band, stars) : MGP.makeBalance(band, stars);
      assert.ok(pz, n.id + ' builds a puzzle for ' + band + ' ' + stars);
    }));
  }
}));
assert.ok(W.REGIONS.some((r) => r.nodes.some((n) => n.type === 'puzzle' && n.puzzle === 'balance')) && W.REGIONS.some((r) => r.nodes.some((n) => n.type === 'puzzle' && n.puzzle === 'machine')), 'both kinds of puzzle spot exist');
assert.ok(W.validate([{ id: 'x', start: 'a', nodes: [{ id: 'a', type: 'puzzle', x: 1, y: 1, next: ['b'], script: ['hi'] }, { id: 'b', type: 'boss', x: 2, y: 2, next: [] }] }]).some((m) => /puzzle must be/.test(m)), 'the validator flags a puzzle with no kind');
// every friend is freed somewhere: the first eleven keep their older places, and each story friend is freed exactly once, in the region RPG says
{
  const freers = [];
  W.REGIONS.forEach((reg) => reg.nodes.filter((n) => n.ally).forEach((n) => freers.push({ ally: n.ally, region: reg.name })));
  assert.strictEqual(new Set(freers.map((f) => f.ally)).size, freers.length, 'no friend is freed twice');
  RPG.STORY_FRIENDS.forEach((id) => {
    const f = freers.find((x) => x.ally === id);
    assert.ok(f, id + ' is freed on the map');
    assert.strictEqual(f.region, RPG.creatureById(id).where, id + ' says where it is freed');
  });
  assert.strictEqual(RPG.STORY_FRIENDS.length, 11);
  assert.strictEqual(RPG.CREATURES.length, 22, 'eleven first friends plus eleven story friends');
  // the story reads in order: every region after the first opens from the boss before it, and every boss tells how the next place appears
  W.REGIONS.forEach((reg, i) => {
    if (i < W.REGIONS.length - 1) assert.ok(W.bossOf(reg).outro && W.bossOf(reg).outro.length > 20, reg.id + ' boss has an outro');
    if (i >= 2) assert.ok(reg.intro && reg.intro.length >= 1, reg.id + ' has an intro');
    reg.nodes.filter((n) => n.type === 'story').forEach((n) => assert.ok(n.script.length >= 1));
  });
}
// the validator really catches mistakes
assert.ok(W.validate([{ id: 'x', start: 'a', nodes: [{ id: 'a', type: 'battle', x: 1, y: 1, next: ['zz'] }] }]).length > 0, 'validator flags a dangling link and a missing boss');

/* ---------- unlock rules ---------- */
{
  const reg = W.REGIONS[0];
  const cleared = new Set();
  let st = W.nodeStates(reg, cleared);
  assert.strictEqual(st[reg.start], 'open', 'the start is open');
  reg.nodes.filter((n) => n.id !== reg.start).forEach((n) => assert.strictEqual(st[n.id], 'locked', n.id + ' starts locked'));
  assert.strictEqual(W.regionOpen(1, cleared), false, 'region 2 is closed at first');
  assert.strictEqual(W.currentRegion(cleared), 0);

  // clear greedily: always a node that is open. The whole region must be completable, and optional nodes must not block.
  let steps = 0;
  const order = [];
  while (!W.regionDone(reg, cleared)) {
    st = W.nodeStates(reg, cleared);
    const open = reg.nodes.filter((n) => st[n.id] === 'open');
    assert.ok(open.length, 'never stuck before the boss');
    const pick = open.find((n) => n.type !== 'camp' && n.type !== 'puzzle') || open[0]; // skip optional camps and puzzle spots to prove they are optional
    cleared.add(pick.id);
    order.push(pick.id);
    assert.ok(++steps < 50);
  }
  assert.ok(!order.includes('m2c'), 'the picnic side spot is optional');
  assert.strictEqual(W.regionOpen(1, cleared), true, 'beating the boss opens region 2');
  assert.strictEqual(W.currentRegion(cleared), 1);
  assert.strictEqual(W.tokenAt(reg, cleared), 'm7');
  assert.strictEqual(W.tokenAt(W.REGIONS[1], new Set()), W.REGIONS[1].start, 'token starts on the start node');
}

/* ---------- progress is grow-only and merges ---------- */
{
  const r = {};
  W.clearNode(r, 'm1', true);
  W.clearNode(r, 'm1', false); // clearing again can never remove the gold star
  W.clearNode(r, 'm2', false);
  assert.deepStrictEqual(r.cleared, ['m1', 'm2']);
  assert.deepStrictEqual(r.gold, ['m1']);

  const dev = (cl, gd) => ({ games: { rpg: { cleared: cl, gold: gd, creatures: ['multiples'], xpEarned: {}, wins: {}, bosses: {} } } });
  const merged = Save.mergeGame('rpg', dev(['m1', 'm2'], ['m1']).games.rpg, dev(['m2', 'm3'], ['m3']).games.rpg);
  assert.deepStrictEqual(merged.cleared, ['m1', 'm2', 'm3'], 'cleared nodes union across devices');
  assert.deepStrictEqual(merged.gold, ['m1', 'm3'], 'gold stars union across devices');
  const back = Save.mergeGame('rpg', dev(['m2', 'm3'], ['m3']).games.rpg, dev(['m1', 'm2'], ['m1']).games.rpg);
  assert.deepStrictEqual(back, merged, 'merge order does not matter');
}

/* ---------- art coverage ---------- */
{
  const root = path.join(__dirname, '..');
  const enemyIds = Object.keys(RPG.ENEMY_ART);
  const allyIds = RPG.CREATURES.map((c) => c.id);
  Object.keys(Art.THEMES).forEach((t) => {
    enemyIds.forEach((id) => assert.ok(Art.src(t, 'enemy', id), t + ' has an enemy for ' + id));
    allyIds.forEach((id) => assert.ok(Art.src(t, 'ally', id), t + ' has an ally for ' + id));
    const T = Art.THEMES[t];
    Object.values(T.bgFor).forEach((k) => assert.ok(T.bg[k], t + ' backdrop ' + k + ' exists'));
    W.REGIONS.forEach((reg) => {
      const a = reg.art[t];
      assert.ok(a, reg.id + ' has ' + t + ' map art');
      if (t === 'classic') assert.ok(Art.src('classic', 'map', a.map), reg.id + ' classic map image exists');
      if (a.bg) assert.ok(Art.get(t, 'bg', a.bg), reg.id + ' ' + t + ' backdrop ' + a.bg + ' exists');
      (reg.decor || []).forEach(([k]) => t !== 'cute' || assert.ok(Art.get('cute', 'map', k), 'decor ' + k + ' is in the cute manifest'));
    });
    const all = [];
    ['enemy', 'ally', 'bg', 'map'].forEach((kind) => Object.keys(T[kind] || {}).forEach((id) => all.push(Art.src(t, kind, id))));
    all.forEach((p) => assert.ok(fs.existsSync(path.join(root, p)), 'image file missing: ' + p));
  });
  assert.strictEqual(Art.themeId({ settings: { questArt: 'cute' } }), 'cute');
  assert.strictEqual(Art.themeId({ settings: { questArt: 'bogus' } }), 'classic', 'unknown theme falls back to the default');
  assert.strictEqual(Art.themeId(null), 'classic');
  assert.strictEqual(Art.src('classic', 'enemy', 'nope'), null, 'missing art returns null so the UI falls back to emoji');
}

console.log('OK: map data valid, regions completable with optional spots skipped, progress merges, and every enemy/ally/backdrop has art in both themes.');
