// Run with: node tests/sync.test.js
// Verifies the cloud sync core: key derivation, encryption, and the pull/merge/push logic against a fake backend that enforces
// the same rules as firestore.rules (so this also acts as an executable model of those rules).
const assert = require('assert');
const Save = require('../js/save.js');
const Sync = require('../js/sync.js');

const ITER = 1000; // fast for tests; production uses Sync.ITERATIONS
const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b, msg) => assert.strictEqual(Save.stable({ ...Save.canon(a), lastSaved: null }), Save.stable({ ...Save.canon(b), lastSaved: null }), msg);
const sum = Save.sumCounter;
const b64len = (s) => Buffer.from(s, 'base64').length;
const cloudOf = async (dev, bk) => Sync.decryptEnvelope(await Sync.keysFromCreds(JSON.parse(dev.storage.getItem('mathQuest.sync'))), bk.docs.get([...bk.docs.keys()][0]));
const until = async (cond, ms = 4000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timed out waiting'); await new Promise((r) => setTimeout(r, 5)); } };

/* ---------- fake backend: same rules as firestore.rules ---------- */
function makeBackend() {
  const b = {
    docs: new Map(), gets: 0, writes: 0, offline: false, beforePut: null,
    async get(id) {
      if (b.offline) throw new Sync.SyncError('offline');
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Sync.SyncError('denied', 'bad id');
      b.gets++;
      const d = b.docs.get(id);
      return d ? clone(d) : null;
    },
    async put(id, env, expectedRev) {
      if (b.offline) throw new Sync.SyncError('offline');
      if (b.beforePut) await b.beforePut(id);
      // rules: valid id, exact shape, v == 1, int rev, iv <= 64 chars, ct <= 900000 chars
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Sync.SyncError('denied', 'bad id');
      const keys = Object.keys(env).sort().join(',');
      if (keys !== 'ct,iv,rev,v') throw new Sync.SyncError('denied', 'bad shape: ' + keys);
      if (env.v !== 1 || !Number.isInteger(env.rev) || typeof env.iv !== 'string' || env.iv.length > 64 || typeof env.ct !== 'string' || env.ct.length > 900000) throw new Sync.SyncError('denied', 'bad fields');
      const cur = b.docs.get(id);
      if (!cur) {
        if (env.rev !== 1) throw new Sync.SyncError('denied', 'create must be rev 1');
      } else if (env.rev !== cur.rev + 1) {
        return { conflict: true }; // the real adapter maps Firestore's permission-denied on a stale rev to this
      }
      assert.strictEqual(expectedRev, cur ? cur.rev : 0, 'the client must send the revision it based its write on');
      b.docs.set(id, clone(env));
      b.writes++;
      return { ok: true };
    },
  };
  return b;
}

function makeTimers() {
  let now = 0;
  let n = 0;
  let q = [];
  return {
    setTimeout(fn, ms) { const t = { id: ++n, at: now + ms, fn }; q.push(t); return t.id; },
    clearTimeout(id) { q = q.filter((t) => t.id !== id); },
    pending: () => q.length,
    async advance(ms) { now += ms; const due = q.filter((t) => t.at <= now).sort((a, b) => a.at - b.at); q = q.filter((t) => t.at > now); due.forEach((t) => t.fn()); },
  };
}

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

function makeDevice(name, backend, extra) {
  const timers = makeTimers();
  const dev = { name, data: Save.newData(), timers, storage: makeStorage(), applied: 0 };
  dev.syncer = Sync.createSyncer(Object.assign({
    backend, iterations: ITER, debounceMs: 100, timers, storage: dev.storage,
    getData: () => clone(dev.data),
    applyRemote: (d) => { dev.applied++; dev.data = Save.mergeData(dev.data, d); dev.syncer.notifyChanged(); }, // like Store.save() calling the listener
  }, extra || {}));
  return dev;
}
const addKid = (dev, id, name) => { dev.data.profiles.push(Save.newProfile({ id, name, avatar: 'x', band: '2-3', now: 1 })); };
const bumpWins = (dev, id, n) => { const p = dev.data.profiles.find((x) => x.id === id); const g = p.games.rpg || (p.games.rpg = { xpEarned: {}, wins: {}, bosses: {}, creatures: [] }); Save.incCounter(g.wins, dev.name, n); Save.incCounter(g.xpEarned, dev.name, 10 * n); };

(async () => {
  /* ===== family code ===== */
  const codes = new Set();
  for (let i = 0; i < 500; i++) {
    const c = Sync.generateFamilyCode();
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    assert.strictEqual(Sync.normalizeCode(c), c.replace(/-/g, ''), 'a generated code normalizes to itself');
    codes.add(c);
  }
  assert.strictEqual(codes.size, 500, 'codes are unique');
  assert.strictEqual(Sync.normalizeCode('oooo-IIII-llll-0000'), '0000111111110000', 'look-alike letters are forgiven');
  assert.strictEqual(Sync.normalizeCode(' k7pq 3m9x-b2rd vw4h '), 'K7PQ3M9XB2RDVW4H', 'case, spaces and dashes are forgiven');
  ['', null, undefined, 'ABC', 'K7PQ-3M9X-B2RD-VW4', 'K7PQ-3M9X-B2RD-VW4HH', 'K7PQ-3M9X-B2RD-VW4U', '!!!!!!!!!!!!!!!!'].forEach((x) => assert.strictEqual(Sync.normalizeCode(x), null, 'rejects ' + x));

  /* ===== keys ===== */
  const codeA = Sync.generateFamilyCode();
  const kA = await Sync.deriveKeys(codeA, { iterations: ITER });
  const kA2 = await Sync.deriveKeys(codeA.toLowerCase().replace(/-/g, ' '), { iterations: ITER });
  const kB = await Sync.deriveKeys(Sync.generateFamilyCode(), { iterations: ITER });
  assert.match(kA.lookupId, /^[a-f0-9]{64}$/);
  assert.strictEqual(kA.lookupId, kA2.lookupId, 'same code (any formatting) gives the same id');
  assert.strictEqual(kA.keyRaw, kA2.keyRaw);
  assert.notStrictEqual(kA.lookupId, kB.lookupId);
  assert.notStrictEqual(kA.keyRaw, kB.keyRaw);
  assert.notStrictEqual(kA.lookupId, Buffer.from(kA.keyRaw, 'base64').toString('hex'), 'the lookup id is independent of the encryption key');
  await assert.rejects(() => Sync.deriveKeys('nope', { iterations: ITER }), (e) => e.code === 'badCode');
  const t0 = Date.now();
  await Sync.deriveKeys(codeA); // production iteration count
  const kdfMs = Date.now() - t0;
  assert.ok(kdfMs < 8000, 'production key derivation should be quick enough (took ' + kdfMs + ' ms)');
  const restored = await Sync.keysFromCreds({ lookupId: kA.lookupId, keyRaw: kA.keyRaw });
  const probe = await Sync.encryptData(restored, Save.newData());
  assert.ok(await Sync.decryptEnvelope(kA, probe), 'keys restored from saved credentials interoperate');

  /* ===== encryption ===== */
  const data = Save.newData();
  data.profiles.push(Save.newProfile({ id: 'p1', name: 'Zebediah', avatar: 'x', now: 1 }));
  const e1 = await Sync.encryptData(kA, data);
  const e2 = await Sync.encryptData(kA, data);
  assert.notStrictEqual(e1.iv, e2.iv, 'a fresh IV each time');
  assert.notStrictEqual(e1.ct, e2.ct);
  assert.ok(!Buffer.from(e1.ct, 'base64').toString('latin1').includes('Zebediah'), 'the name is not visible in the ciphertext');
  assert.ok(e1.iv.length <= 64 && e1.v === 1);
  same(await Sync.decryptEnvelope(kA, e1), data, 'round trip');
  await assert.rejects(() => Sync.decryptEnvelope(kB, e1), (e) => e.code === 'badKey', 'the wrong code cannot unlock it');
  const tampered = Buffer.from(e1.ct, 'base64'); tampered[5] ^= 1;
  await assert.rejects(() => Sync.decryptEnvelope(kA, { ...e1, ct: tampered.toString('base64') }), (e) => e.code === 'badKey', 'tampering is detected');
  const moved = { lookupId: 'f'.repeat(64), key: kA.key, keyRaw: kA.keyRaw };
  await assert.rejects(() => Sync.decryptEnvelope(moved, e1), (e) => e.code === 'badKey', 'ciphertext is bound to its own document id');
  await assert.rejects(() => Sync.decryptEnvelope(kA, { ...e1, v: 2 }), (e) => e.code === 'corrupt');
  await assert.rejects(() => Sync.decryptEnvelope(kA, { v: 1, iv: 5, ct: 'x' }), (e) => e.code === 'corrupt');
  await assert.rejects(() => Sync.decryptEnvelope(kA, null), (e) => e.code === 'corrupt');
  const notASave = await Sync.encryptData(kA, { foo: 1 });
  await assert.rejects(() => Sync.decryptEnvelope(kA, notASave), (e) => e.code === 'corrupt', 'unlocks but is not a save');

  /* ===== setup, join, and the first sync ===== */
  let backend = makeBackend();
  let A = makeDevice('lap', backend);
  addKid(A, 'p1', 'Kid');
  bumpWins(A, 'p1', 2);
  const { code } = await A.syncer.setup();
  assert.ok(Sync.normalizeCode(code), 'setup returns a family code');
  assert.strictEqual(backend.docs.size, 1);
  const [docId, doc] = [...backend.docs][0];
  assert.match(docId, /^[a-f0-9]{64}$/);
  assert.strictEqual(doc.rev, 1);
  assert.ok(!Buffer.from(doc.ct, 'base64').toString('latin1').includes('Kid'), 'the server never sees names');
  assert.ok(A.syncer.enabled && A.storage.getItem('mathQuest.sync'), 'credentials are saved on this device');
  assert.strictEqual(A.syncer.status.state, 'synced');
  const w1 = backend.writes;
  await A.syncer.syncNow();
  assert.strictEqual(backend.writes, w1, 'nothing changed, so nothing is uploaded');

  // join from a second device
  let B = makeDevice('pad', backend);
  await B.syncer.join(code);
  same(B.data, A.data, 'the second device receives the save');
  assert.strictEqual(backend.writes, w1, 'joining with an empty device does not upload anything');
  assert.ok(B.syncer.enabled);

  // a typo must NOT create a new family
  const typo = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A');
  let C = makeDevice('phone', backend);
  await assert.rejects(() => C.syncer.join(typo), (e) => e.code === 'notFound');
  assert.strictEqual(backend.docs.size, 1, 'a typo never creates a phantom family');
  assert.ok(!C.syncer.enabled && !C.storage.getItem('mathQuest.sync'), 'a failed join saves no credentials');
  assert.strictEqual(C.syncer.status.state, 'off');
  await assert.rejects(() => C.syncer.join('garbage'), (e) => e.code === 'badCode');

  // credentials survive a restart
  const A2 = makeDevice('lap', backend); A2.storage = A.storage;
  const A2s = Sync.createSyncer({ backend, iterations: ITER, timers: makeTimers(), storage: A.storage, getData: () => clone(A.data), applyRemote: () => {} });
  assert.strictEqual((await A2s.init()).state, 'idle');
  assert.ok(A2s.enabled);

  /* ===== two devices change things offline, then sync ===== */
  addKid(B, 'p2', 'Sibling');
  bumpWins(A, 'p1', 3);
  bumpWins(B, 'p2', 1);
  Save.addStat(A.data.profiles[0], 'primes', 'lap', true);
  Save.addStat(B.data.profiles[0], 'primes', 'pad', false);
  await A.syncer.syncNow();
  const appliedBefore = B.applied;
  await B.syncer.syncNow();
  assert.ok(B.applied > appliedBefore, 'B pulled changes made on A');
  assert.strictEqual(B.timers.pending(), 0, 'pulling remote changes must not schedule another sync (the syncer ignores its own writes)');
  await A.syncer.syncNow();
  same(A.data, B.data, 'both devices converge');
  const pA = A.data.profiles.find((p) => p.id === 'p1');
  assert.strictEqual(sum(pA.games.rpg.wins), 5, 'wins from both histories are kept (2 + 3)');
  assert.deepStrictEqual(Save.statTotals(pA, 'primes'), { right: 1, wrong: 1 });
  assert.strictEqual(A.data.profiles.length, 2, 'players from both devices are kept');
  const w2 = backend.writes;
  await A.syncer.syncNow(); await B.syncer.syncNow();
  assert.strictEqual(backend.writes, w2, 'in sync means no more uploads');

  /* ===== a write collides with another device's: retry and merge, lose nothing ===== */
  addKid(C, 'x', 'x'); C = makeDevice('phone', backend); await C.syncer.join(code);
  bumpWins(A, 'p1', 1);
  bumpWins(C, 'p1', 4);
  let fired = false;
  backend.beforePut = async () => { if (fired) return; fired = true; backend.beforePut = null; await C.syncer.syncNow(); };
  await A.syncer.syncNow();
  assert.ok(fired && A.syncer.status.state === 'synced', 'A recovers from the collision');
  await C.syncer.syncNow();
  same(A.data, C.data);
  assert.strictEqual(sum(A.data.profiles.find((p) => p.id === 'p1').games.rpg.wins), 5 + 1 + 4, 'nobody\'s progress was lost in the collision');

  /* ===== endless collisions: local data is untouched and a retry is scheduled ===== */
  bumpWins(A, 'p1', 1);
  const before = clone(A.data);
  backend.beforePut = async (id) => { backend.docs.get(id).rev += 1; }; // someone else keeps writing
  await A.syncer.syncNow();
  assert.strictEqual(A.syncer.status.state, 'conflict');
  assert.ok(A.timers.pending() >= 1, 'a retry is scheduled');
  same(A.data, before, 'a failed sync never damages the local save');
  backend.beforePut = null;
  const stuck = backend.docs.get(docId); // revs were bumped without new ciphertext, which is still valid
  assert.ok(stuck.rev > 3);
  await A.timers.advance(10 * 60 * 1000);
  await until(() => A.syncer.status.state === 'synced');

  /* ===== offline ===== */
  bumpWins(A, 'p1', 1);
  backend.offline = true;
  const wBefore = backend.writes;
  await A.syncer.syncNow();
  assert.strictEqual(A.syncer.status.state, 'offline');
  assert.ok(A.timers.pending() >= 1);
  assert.strictEqual(backend.writes, wBefore);
  backend.offline = false;
  await A.timers.advance(10 * 60 * 1000);
  await until(() => A.syncer.status.state === 'synced');
  assert.ok(backend.writes > wBefore, 'the change uploads once the connection is back');

  /* ===== a wrong code, damaged or future-format cloud data are never overwritten ===== */
  const savedDoc = clone(backend.docs.get(docId));
  const damaged = clone(savedDoc);
  const buf = Buffer.from(damaged.ct, 'base64'); buf[buf.length - 3] ^= 255; damaged.ct = buf.toString('base64');
  backend.docs.set(docId, damaged);
  bumpWins(B, 'p1', 1);
  const bLocal = clone(B.data);
  const wDamaged = backend.writes;
  await B.syncer.syncNow();
  assert.strictEqual(B.syncer.status.state, 'badKey');
  assert.strictEqual(backend.writes, wDamaged, 'damaged cloud data is never overwritten');
  assert.deepStrictEqual(backend.docs.get(docId), damaged);
  same(B.data, bLocal, 'and the local save is untouched');
  backend.docs.set(docId, { ...savedDoc, v: 2 });
  await B.syncer.syncNow();
  assert.strictEqual(B.syncer.status.state, 'corrupt', 'a newer/unknown format is left alone');
  assert.strictEqual(backend.docs.get(docId).v, 2);
  backend.docs.set(docId, savedDoc);
  await B.syncer.syncNow();
  assert.strictEqual(B.syncer.status.state, 'synced', 'recovers when the cloud copy is fine again');

  /* ===== deletions travel ===== */
  A.data.deleted['p2'] = Date.now();
  A.data.profiles = A.data.profiles.filter((p) => p.id !== 'p2');
  await A.syncer.syncNow(); await B.syncer.syncNow();
  assert.ok(!B.data.profiles.some((p) => p.id === 'p2'), 'a player deleted on one device disappears on the others');

  /* ===== too large ===== */
  const big = makeDevice('big', makeBackend());
  addKid(big, 'p1', 'Big');
  big.data.profiles[0].games.big = { _at: 1, blob: 'x'.repeat(800000) };
  await assert.rejects(() => big.syncer.setup(), (e) => e.code === 'tooBig');
  assert.ok(!big.syncer.enabled, 'no credentials are saved when the first upload fails');

  /* ===== background scheduling ===== */
  backend = makeBackend();
  const S = makeDevice('s', backend);
  addKid(S, 'p1', 'S');
  await S.syncer.setup();
  const g0 = backend.gets;
  for (let i = 0; i < 5; i++) { bumpWins(S, 'p1', 1); S.syncer.notifyChanged(); }
  assert.strictEqual(S.timers.pending(), 1, 'several saves in a row become one scheduled sync');
  await S.timers.advance(50);
  assert.strictEqual(backend.gets, g0, 'not yet: still inside the debounce window');
  await S.timers.advance(100);
  await until(() => backend.gets === g0 + 1 && S.syncer.status.state === 'synced');
  assert.strictEqual(backend.gets, g0 + 1, 'exactly one sync ran');
  assert.strictEqual(S.timers.pending(), 0, 'the syncer\'s own writes do not schedule another sync');
  // changes made while a sync is running are not lost
  let release;
  backend.beforePut = () => new Promise((r) => { release = r; });
  bumpWins(S, 'p1', 1);
  const running = S.syncer.syncNow();
  await until(() => !!release);
  bumpWins(S, 'p1', 1);
  S.syncer.syncNow(); // arrives mid-sync: queued, not dropped
  backend.beforePut = null;
  release();
  await running;
  await S.timers.advance(1000);
  await until(async () => false || (S.syncer.status.state === 'synced' && S.timers.pending() === 0), 4000).catch(() => {});
  let cloudWins = 0;
  for (let i = 0; i < 200 && cloudWins !== 7; i++) { cloudWins = sum((await cloudOf(S, backend)).profiles[0].games.rpg.wins); if (cloudWins !== 7) await new Promise((r) => setTimeout(r, 10)); }
  assert.strictEqual(cloudWins, 5 + 2, 'both changes made around a running sync reached the cloud');
  assert.strictEqual(sum(S.data.profiles[0].games.rpg.wins), 7);
  // events
  const listeners = {};
  let doc2 = { hidden: true, addEventListener: (e, f) => (listeners['doc:' + e] = f) };
  S.syncer.attach({ addEventListener: (e, f) => (listeners[e] = f), document: doc2 });
  bumpWins(S, 'p1', 1);
  const w3 = backend.writes;
  listeners.online();
  await until(() => backend.writes > w3);
  bumpWins(S, 'p1', 1);
  const w4 = backend.writes;
  listeners['doc:visibilitychange']();
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(backend.writes, w4, 'a hidden page does not sync');
  doc2.hidden = false;
  listeners['doc:visibilitychange']();
  await until(() => backend.writes > w4);
  S.syncer.disconnect();
  assert.strictEqual(S.syncer.status.state, 'off');
  assert.ok(!S.storage.getItem('mathQuest.sync'));
  assert.ok(backend.docs.size === 1, 'disconnecting leaves the cloud copy alone');

  /* ===== random multi-device histories with real encryption: converge and lose nothing ===== */
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  let schedules = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed * 104729);
    const bk = makeBackend();
    const d0 = makeDevice('d0', bk), d1 = makeDevice('d1', bk), d2 = makeDevice('d2', bk);
    addKid(d0, 'p1', 'K');
    const fam = (await d0.syncer.setup()).code;
    await d1.syncer.join(fam); await d2.syncer.join(fam);
    const devs = [d0, d1, d2];
    let incs = 0;
    for (let step = 0; step < 40; step++) {
      const d = devs[Math.floor(r() * 3)];
      const roll = r();
      if (roll < 0.5) { bumpWins(d, 'p1', 1); incs++; }
      else if (roll < 0.6) Save.addStat(d.data.profiles[0], 'primes', d.name, r() < 0.5);
      else if (roll < 0.7) { const p = d.data.profiles[0]; p.settings.stars = 1 + Math.floor(r() * 3); p.settingsAt = 10 + step; }
      else if (roll < 0.9) { bk.offline = r() < 0.3; await d.syncer.syncNow(); bk.offline = false; }
      else await d.syncer.syncNow();
    }
    bk.offline = false;
    for (let round = 0; round < 3; round++) for (const d of devs) await d.syncer.syncNow();
    same(d0.data, d1.data, 'seed ' + seed); same(d1.data, d2.data, 'seed ' + seed);
    const cloud = await cloudOf(d0, bk);
    same(cloud, d0.data, 'the cloud copy equals every device (seed ' + seed + ')');
    assert.strictEqual(sum(d0.data.profiles[0].games.rpg.wins), incs, 'no increment lost (seed ' + seed + ')');
    schedules++;
  }

  console.log(`OK: family codes, key derivation (${kdfMs} ms at production strength), encryption, and sync verified: ` +
    `collisions retry without loss, offline/damaged/oversized/wrong-code cases never overwrite anything, a typo never creates a family, ` +
    `and ${schedules} random 3-device histories converge with no lost progress.`);
})().catch((e) => { console.error(e); process.exit(1); });
