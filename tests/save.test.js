// Run with: node tests/save.test.js
// Verifies the v2 save format: migration from v1, and that merging across devices never loses progress and always converges.
const assert = require('assert');
const Save = require('../js/save.js');

/* seeded PRNG so any failure is reproducible */
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b, msg) => assert.deepStrictEqual(Save.canon(a), Save.canon(b), msg);
const merge = Save.mergeData;

/* ---------- migration from v1 ---------- */
{
  const v1 = {
    version: 1,
    lastSaved: 1700000000000,
    profiles: [{
      id: 'pA', name: 'Ada', avatar: '🦊',
      settings: { band: '4-5', stars: 2, theme: 'cute', monsters: 'off' },
      stats: { multiples: { right: 7, wrong: 3 }, balance: { right: 2, wrong: 1 } },
      munchers: { levels: 5, streak: 2 },
      balance: { levels: 4 },
      machine: { levels: 9 },
      rpg: { xp: 30, level: 3, creatures: ['primes', 'multiples', 'primes'], team: ['multiples'], wins: 6, bosses: 1 },
    }, {
      id: 'pB', name: 'Bo', avatar: '🐼', settings: { band: 'K-1' }, stats: {}, munchers: { levels: 0, streak: 0 },
    }],
  };
  const xpTotal = (level, xp) => { let t = xp; for (let l = 1; l < level; l++) t += 40 + 20 * (l - 1); return t; };
  const r = Save.normalize(v1, { deviceId: 'lap', xpTotal });
  assert.ok(r.data && r.migrated, 'v1 should migrate');
  const d = r.data;
  assert.strictEqual(d.schemaVersion, 2);
  assert.strictEqual(d.profiles.length, 2);
  const a = d.profiles.find((p) => p.id === 'pA');
  assert.deepStrictEqual(a.settings, { band: '4-5', stars: 2, theme: 'cute', monsters: 'off', motion: 'full' });
  assert.deepStrictEqual(Save.statTotals(a, 'multiples'), { right: 7, wrong: 3 });
  assert.strictEqual(Save.sumCounter(a.games.munchers.levels), 5);
  assert.strictEqual(a.games.munchers.streak, 2);
  assert.strictEqual(Save.sumCounter(a.games.balance.levels), 4);
  assert.strictEqual(Save.sumCounter(a.games.machine.levels), 9);
  assert.strictEqual(Save.sumCounter(a.games.rpg.xpEarned), 30 + 40 + 60, 'XP total preserved across the level curve');
  assert.strictEqual(Save.sumCounter(a.games.rpg.wins), 6);
  assert.strictEqual(Save.sumCounter(a.games.rpg.bosses), 1);
  assert.deepStrictEqual(a.games.rpg.creatures, ['multiples', 'primes']);
  assert.deepStrictEqual(a.games.rpg.team, ['multiples']);
  const b = d.profiles.find((p) => p.id === 'pB');
  assert.deepStrictEqual(b.games.rpg, undefined, 'no RPG data if none existed');
  // migrating a v2 save again changes nothing
  const again = Save.normalize(clone(d), { deviceId: 'other' });
  assert.ok(!again.migrated);
  assert.deepStrictEqual(again.data, d);
  // v1 data is never mutated by migration
  assert.strictEqual(v1.profiles[0].rpg.level, 3);
}

/* ---------- validation ---------- */
assert.ok(Save.normalize(null).error);
assert.ok(Save.normalize({ profiles: 'x' }).error);
assert.ok(Save.normalize({ profiles: [{ avatar: 'x', settings: {} }] }).error);
assert.ok(Save.normalize({ profiles: [{ name: 'x', settings: 5 }] }).error);

/* ---------- simulated devices ---------- */
const SKILLS = ['multiples', 'primes', 'armor', 'balance', 'fractions'];
const CREATURES = ['multiples', 'factors', 'primes', 'armor', 'boss', 'compare'];

function makeOps(dev) {
  let n = 0;
  return function op(d, r, clock) {
    if (!d.profiles.length) return;
    const p = d.profiles[Math.floor(r() * d.profiles.length)];
    const g = (id) => p.games[id] || (p.games[id] = {});
    const bump = (gid, f) => { const o = g(gid); Save.incCounter(o[f] || (o[f] = {}), dev, 1); };
    const roll = r();
    if (roll < 0.2) Save.addStat(p, SKILLS[Math.floor(r() * SKILLS.length)], dev, r() < 0.6);
    else if (roll < 0.3) bump('munchers', 'levels');
    else if (roll < 0.38) bump('balance', 'levels');
    else if (roll < 0.46) { if (r() < 0.5) bump('machine', 'levels'); else { bump('td', 'waves'); if (r() < 0.5) bump('td', 'perfect'); if (r() < 0.3) bump('escape', 'rooms'); if (r() < 0.3) bump('runner', 'runs'); if (r() < 0.3) bump('sort', 'levels'); if (r() < 0.3) bump('share', 'levels'); } }
    else if (roll < 0.56) {
      const o = g('rpg');
      o.creatures = [...new Set([...(o.creatures || []), CREATURES[Math.floor(r() * CREATURES.length)]])];
      bump('rpg', 'xpEarned');
      Save.incCounter(o.xpEarned, dev, Math.floor(r() * 30));
    } else if (roll < 0.62) bump('rpg', 'wins');
    else if (roll < 0.7) {
      const o = g('rpg');
      o.team = (o.creatures || []).filter(() => r() < 0.5);
      o.teamAt = clock();
    } else if (roll < 0.78) { p.settings.stars = 1 + Math.floor(r() * 3); p.settingsAt = clock(); }
    else if (roll < 0.84) { const o = g('munchers'); o.streak = Math.floor(r() * 5); o.streakAt = clock(); }
    else if (roll < 0.9) {
      const np = Save.newProfile({ id: dev + '-' + n++, name: 'K' + n, avatar: 'x', band: 'K-1', now: clock() });
      d.profiles.push(np);
    } else if (roll < 0.95) { p.name = 'N' + Math.floor(r() * 99); p.metaAt = clock(); }
    else if (roll < 0.97 && d.profiles.length > 1) { d.deleted[p.id] = clock(); d.profiles = d.profiles.filter((x) => x !== p); }
  };
}

function forkDevices(seed, k, steps) {
  const r = rng(seed);
  let t = 10;
  const clock = () => (r() < 0.15 ? t : ++t); // some timestamp ties on purpose
  const base = Save.newData();
  base.profiles.push(Save.newProfile({ id: 'p1', name: 'Kid', avatar: 'x', band: '2-3', now: 1 }));
  base.profiles.push(Save.newProfile({ id: 'p2', name: 'Kid2', avatar: 'y', band: 'K-1', now: 2 }));
  const devs = [];
  for (let i = 0; i < k; i++) {
    const d = clone(base);
    const op = makeOps('dev' + i);
    for (let s = 0; s < steps; s++) op(d, r, clock);
    devs.push(d);
  }
  return devs;
}

let laws = 0;
for (let seed = 1; seed <= 400; seed++) {
  const [a, b, c] = forkDevices(seed, 3, 25 + (seed % 40));
  eq(merge(a, b), merge(b, a), `commutative (seed ${seed})`);
  eq(merge(merge(a, b), c), merge(a, merge(b, c)), `associative (seed ${seed})`);
  eq(merge(merge(a, b), c), merge(merge(c, a), b), `any order (seed ${seed})`);
  eq(merge(a, a), a, `idempotent (seed ${seed})`);
  const m = merge(a, b);
  eq(merge(m, a), m, `re-merging an input changes nothing (seed ${seed})`);
  eq(merge(m, b), m, `re-merging an input changes nothing (seed ${seed})`);
  laws++;
}

/* ---------- no progress is ever lost (monotone) ---------- */
function totals(d) {
  const t = {};
  d.profiles.forEach((p) => {
    Object.keys(p.stats).forEach((k) => { const s = Save.statTotals(p, k); t[`${p.id}.stat.${k}.right`] = s.right; t[`${p.id}.stat.${k}.wrong`] = s.wrong; });
    Object.keys(p.games).forEach((gid) => {
      const g = p.games[gid];
      ['levels', 'xpEarned', 'wins', 'bosses'].forEach((f) => { if (g[f]) t[`${p.id}.${gid}.${f}`] = Save.sumCounter(g[f]); });
      if (g.creatures) g.creatures.forEach((c) => (t[`${p.id}.${gid}.owns.${c}`] = 1));
    });
  });
  return t;
}
for (let seed = 1; seed <= 300; seed++) {
  const devs = forkDevices(seed + 5000, 3, 30);
  const m = merge(merge(devs[0], devs[1]), devs[2]);
  const mt = totals(m);
  const deleted = new Set(Object.keys(m.deleted));
  devs.forEach((d) => {
    const dt = totals(d);
    Object.keys(dt).forEach((k) => {
      if (deleted.has(k.split('.')[0])) return;
      assert.ok((mt[k] || 0) >= dt[k], `merge lost progress: ${k} ${mt[k]} < ${dt[k]} (seed ${seed})`);
    });
  });
}

/* Sort & Rule and Cut & Share keep their progress as per-device counters under games.sort / games.share (levels): a game with no merge rule can lose progress */
{
  const mk = (dev, sortN, shareN) => {
    const d = Save.newData();
    const p = Save.newProfile({ id: 'p1', name: 'K', avatar: 'x', now: 1 });
    p.games.sort = { levels: { [dev]: sortN } };
    p.games.share = { levels: { [dev]: shareN } };
    d.profiles.push(p);
    return d;
  };
  const m = merge(merge(mk('lap', 3, 1), mk('pad', 5, 4)), mk('phone', 2, 0));
  const p = m.profiles[0];
  assert.strictEqual(Save.sumCounter(p.games.sort.levels), 10, 'Sort & Rule: every device\'s puzzles are summed');
  assert.strictEqual(Save.sumCounter(p.games.share.levels), 5, 'Cut & Share: every device\'s puzzles are summed');
  eq(merge(mk('lap', 3, 1), mk('pad', 5, 4)), merge(mk('pad', 5, 4), mk('lap', 3, 1)), 'Sort & Rule / Cut & Share merge in any order');
}

/* each device only increments its own counter, so the merged total must equal the SUM of what every device did (no lost increments) */
{
  const mk = (dev, wins) => {
    const d = Save.newData();
    const p = Save.newProfile({ id: 'p1', name: 'K', avatar: 'x', now: 1 });
    p.games.rpg = { xpEarned: { [dev]: 10 * wins }, wins: { [dev]: wins }, creatures: [], team: [], teamAt: 0 };
    Save.addStat(p, 'multiples', dev, true);
    d.profiles.push(p);
    return d;
  };
  const m = merge(merge(mk('lap', 3), mk('pad', 5)), mk('phone', 2));
  const p = m.profiles[0];
  assert.strictEqual(Save.sumCounter(p.games.rpg.wins), 10);
  assert.strictEqual(Save.sumCounter(p.games.rpg.xpEarned), 100);
  assert.strictEqual(Save.statTotals(p, 'multiples').right, 3, 'one right answer per device is summed');
}

/* ---------- convergence through a shared cloud copy (real sync schedule) ---------- */
let syncs = 0;
for (let seed = 1; seed <= 200; seed++) {
  const r = rng(seed * 7919);
  let t = 10;
  const clock = () => ++t;
  const base = Save.newData();
  base.profiles.push(Save.newProfile({ id: 'p1', name: 'Kid', avatar: 'x', band: '2-3', now: 1 }));
  let cloud = clone(base);
  const devs = ['lap', 'pad', 'phone'].map((n) => ({ n, d: clone(base), op: makeOps(n) }));
  for (let step = 0; step < 80; step++) {
    const x = devs[Math.floor(r() * devs.length)];
    if (r() < 0.7) x.op(x.d, r, clock);
    else { cloud = merge(cloud, x.d); x.d = clone(cloud); syncs++; } // pull+merge+push, then adopt
  }
  for (let round = 0; round < 2; round++) devs.forEach((x) => { cloud = merge(cloud, x.d); x.d = clone(cloud); });
  devs.forEach((x) => eq(x.d, cloud, `every device converges to the cloud copy (seed ${seed})`));
}

/* ---------- deletes, ties, unknown games, never-dropped fields ---------- */
{
  const mk = () => { const d = Save.newData(); d.profiles.push(Save.newProfile({ id: 'p1', name: 'K', avatar: 'x', now: 1 })); return d; };
  const A = mk();
  const B = mk();
  A.deleted.p1 = 50; A.profiles = [];
  Save.incCounter(((B.profiles[0].games.munchers = { levels: {} }).levels), 'pad', 4); // B keeps playing after A deleted
  const m = merge(A, B);
  assert.strictEqual(m.profiles.length, 0, 'a deleted profile stays deleted');
  eq(merge(A, B), merge(B, A));
  assert.ok(m.deleted.p1 >= 50);
}
{
  // LWW ties are deterministic regardless of order
  const a = Save.newProfile({ id: 'p', name: 'K', avatar: 'x', now: 5 });
  const b = clone(a);
  a.settings.stars = 2; a.settingsAt = 9;
  b.settings.stars = 3; b.settingsAt = 9;
  assert.deepStrictEqual(Save.mergeProfile(a, b), Save.mergeProfile(b, a));
  b.settingsAt = 10;
  assert.strictEqual(Save.mergeProfile(a, b).settings.stars, 3, 'newer write wins');
}
{
  // a game with no registered merge rule: newer whole object wins, and merge still commutes
  const a = Save.newProfile({ id: 'p', name: 'K', avatar: 'x', now: 5 });
  const b = clone(a);
  a.games.future = { _at: 1, score: 5 };
  b.games.future = { _at: 2, score: 3 };
  assert.deepStrictEqual(Save.mergeProfile(a, b).games.future, { _at: 2, score: 3 });
  assert.deepStrictEqual(Save.mergeProfile(a, b), Save.mergeProfile(b, a));
  // registering a rule lets a new game merge properly
  Save.registerGame('future', { score: 'max', gems: 'counter', found: 'set' });
  const c = Save.mergeGame('future', { score: 5, gems: { x: 2 }, found: ['a'] }, { score: 3, gems: { x: 1, y: 4 }, found: ['b'], note: 'keep me' });
  assert.deepStrictEqual(c, { score: 5, gems: { x: 2, y: 4 }, found: ['a', 'b'], note: 'keep me' });
}
{
  // RPG invariant repair: the team only holds owned creatures
  const g = Save.mergeGame('rpg', { creatures: ['primes'], team: ['primes', 'ghost'], teamAt: 3 }, { creatures: ['armor'], team: [], teamAt: 1 });
  assert.deepStrictEqual(g.team, ['primes']);
  const e = Save.mergeGame('rpg', { creatures: ['a', 'b', 'c', 'd'], team: ['a', 'b', 'c', 'd'], teamAt: 3 }, {});
  assert.deepStrictEqual(e.team, ['a', 'b', 'c'], 'a team holds at most 3');
  const f = Save.mergeGame('rpg', { creatures: ['a', 'b'] }, { creatures: ['c'] });
  assert.strictEqual(f.team, undefined, 'merging never invents a team; the game computes its own default when reading');
}

/* ---------- Quest world map: cleared nodes and gold stars only grow, and merge as unions ---------- */
{
  const a = { creatures: [], cleared: ['m1', 'm2'], gold: ['m1'] };
  const b = { creatures: [], cleared: ['m2', 'm3'], gold: ['m3'] };
  const ab = Save.mergeGame('rpg', a, b);
  assert.deepStrictEqual(ab.cleared, ['m1', 'm2', 'm3'], 'cleared nodes union across devices');
  assert.deepStrictEqual(ab.gold, ['m1', 'm3'], 'gold stars union across devices');
  assert.deepStrictEqual(Save.mergeGame('rpg', b, a), ab, 'merge order does not matter');
  assert.deepStrictEqual(Save.mergeGame('rpg', ab, ab), ab, 'merging twice changes nothing');
  assert.deepStrictEqual(Save.mergeGame('rpg', { creatures: [] }, { creatures: [], cleared: ['m1'] }).cleared, ['m1'], 'a device with no map progress loses nothing');
}

/* ---------- Quest: the in-progress Quick adventure is last-write-wins (never invented, never half-merged) ---------- */
{
  const a = { creatures: [], run: { i: 1, band: '2-3', stars: 2 }, runAt: 100 };
  const b = { creatures: [], run: { i: 3, band: '2-3', stars: 2 }, runAt: 200 };
  const ab = Save.mergeGame('rpg', a, b);
  assert.deepStrictEqual(ab.run, b.run, 'the newer save of the run wins');
  assert.strictEqual(ab.runAt, 200);
  assert.deepStrictEqual(Save.mergeGame('rpg', b, a), ab, 'merge order does not matter');
  const done = Save.mergeGame('rpg', { creatures: [], run: b.run, runAt: 200 }, { creatures: [], run: null, runAt: 300 });
  assert.strictEqual(done.run, null, 'finishing the adventure on one device clears it everywhere (a newer null beats an older run)');
  assert.deepStrictEqual(Save.mergeGame('rpg', { creatures: [] }, a).run, a.run, 'a device that never saved a run does not erase one');
}

/* ---------- merging in place keeps object identity (a running game must keep saving into live data) ---------- */
{
  const mk = (id, name) => Save.newProfile({ id, name, avatar: 'x', now: 1 });
  const local = Save.newData();
  local.profiles.push(mk('p1', 'One'), mk('p2', 'Two'));
  const held = local.profiles[0]; // what a game holds
  const heldArray = local.profiles;
  const remote = clone(local);
  Save.incCounter((remote.profiles[0].games.munchers = { levels: {} }).levels, 'pad', 7);
  remote.profiles.push(mk('p3', 'Three'));
  remote.deleted.p2 = 99; remote.profiles = remote.profiles.filter((p) => p.id !== 'p2');
  const merged = Save.mergeData(local, remote);
  Save.assignInPlace(local, merged);
  assert.strictEqual(local.profiles, heldArray, 'the profiles array is the same object');
  assert.strictEqual(local.profiles[0], held, 'an existing profile is updated in place, not replaced');
  assert.strictEqual(Save.sumCounter(held.games.munchers.levels), 7, 'and it holds the merged progress');
  assert.deepStrictEqual(local.profiles.map((p) => p.id), ['p1', 'p3'], 'removed players go, new players arrive');
  assert.deepStrictEqual(Save.canon(local), Save.canon(merged), 'the result equals the merge');
  // a game that keeps saving into `held` after a merge still saves into live data
  Save.incCounter(held.games.munchers.levels, 'lap', 1);
  assert.strictEqual(Save.sumCounter(local.profiles[0].games.munchers.levels), 8);
}

console.log(`OK: migration verified; merge is commutative, associative and idempotent over ${laws} random multi-device histories; ` +
  `no progress lost over 300 more; all devices converge across ${syncs} simulated syncs.`);
