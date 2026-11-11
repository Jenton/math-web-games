// Run with: node tests/firebase-backend.test.js
// Verifies the Firebase adapter (js/firebase-backend.js) against a fake of Firebase's REST services that enforces firestore.rules:
// create / get / update, conflicts, permission errors, offline and timeouts, anonymous sign-in reuse and token refresh,
// and finally two devices syncing through the adapter with the real Sync code.
const assert = require('assert');
const Save = require('../js/save.js');
const Sync = require('../js/sync.js');
const FB = require('../js/firebase-backend.js');
const { makeFirebase, makeStorage, KEY, PROJECT } = require('./helpers/fake-firebase.js');

const ID = 'a1b2c3d4'.repeat(8);
const ID2 = '9'.repeat(64);
const env = (rev, ct) => ({ v: 1, rev, iv: 'aXY=', ct: ct || 'Y3Q=' });
const clone = (x) => JSON.parse(JSON.stringify(x));
const code = (fn) => (e) => e instanceof Sync.SyncError && e.code === fn;
const plain = (e) => e instanceof Error && !(e instanceof Sync.SyncError);

function make(fb, storage, extra) {
  return FB.create(Object.assign({ config: { apiKey: KEY, projectId: PROJECT }, fetch: fb.fetch, storage: storage || makeStorage(), now: fb.now,
    authBase: 'https://auth.test/v1', tokenBase: 'https://token.test/v1', firestoreBase: 'https://db.test/v1' }, extra || {}));
}

(async () => {
  /* ===== basics: create, read, update ===== */
  let fb = makeFirebase();
  let be = make(fb);
  assert.strictEqual(await be.get(ID), null, 'a missing family reads as null');
  assert.deepStrictEqual(await be.put(ID, env(1), 0), { ok: true }, 'create');
  assert.deepStrictEqual(await be.get(ID), env(1), 'round trip with real numbers');
  assert.deepStrictEqual(await be.put(ID, env(2, 'bmV3'), 1), { ok: true }, 'update with rev + 1');
  assert.deepStrictEqual(await be.get(ID), env(2, 'bmV3'));
  assert.strictEqual(fb.docs.size, 1);
  const big = 'A'.repeat(899000);
  assert.deepStrictEqual(await be.put(ID2, env(1, big), 0), { ok: true }, 'a large save goes through');
  assert.strictEqual((await be.get(ID2)).ct.length, 899000);

  /* ===== what goes over the wire ===== */
  const patch = fb.calls.find((c) => c.method === 'PATCH');
  assert.ok(patch.url.includes('/projects/' + PROJECT + '/databases/(default)/documents/families/' + ID), 'writes the one family document');
  assert.ok(patch.url.includes('currentDocument.exists=false'), 'create is marked create-only');
  assert.ok(/^Bearer id-/.test(patch.headers.Authorization), 'sends the anonymous id token');
  assert.deepStrictEqual(Object.keys(JSON.parse(patch.body).fields).sort(), ['ct', 'iv', 'rev', 'v'], 'exactly the four allowed fields');
  assert.strictEqual(JSON.parse(patch.body).fields.rev.integerValue, '1', 'integers are sent as REST integerValue strings');
  assert.ok(fb.calls.filter((c) => c.method !== 'POST').every((c) => !c.url.includes(KEY)), 'the api key is only sent to the sign-in endpoints');
  assert.ok(!fb.calls.some((c) => c.method === 'DELETE' || c.method === 'GET' && c.url.endsWith('/families')), 'never lists or deletes');

  /* ===== conflicts (two devices racing) ===== */
  for (const first of [false, true]) {
    fb = makeFirebase(); fb.preconditionFirst = first; // the server may check the precondition before or after the rules
    be = make(fb);
    await be.put(ID, env(1), 0);
    assert.deepStrictEqual(await be.put(ID, env(1, 'eHg='), 0), { conflict: true }, 'create when it already exists is a conflict (precondition first: ' + first + ')');
    assert.deepStrictEqual(await be.put(ID, env(2), 1), { ok: true });
    assert.deepStrictEqual(await be.put(ID, env(2, 'c3RhbGU='), 1), { conflict: true }, 'a stale update (based on rev 1, cloud is at 2) is a conflict');
    assert.deepStrictEqual(await be.put(ID, env(9), 8), { conflict: true }, 'a wrong base revision is a conflict');
    assert.deepStrictEqual(await be.get(ID), env(2), 'a refused write changed nothing');
    assert.deepStrictEqual(await be.put(ID2, env(3), 2), { conflict: true }, 'updating a family that is missing is a conflict');
    assert.strictEqual(fb.docs.has(ID2), false, 'and creates nothing');
  }

  /* ===== permission problems are not conflicts ===== */
  fb = makeFirebase(); be = make(fb);
  await assert.rejects(() => be.get('short-id'), code('denied'), 'reading a malformed id is denied');
  await assert.rejects(() => be.put('short-id', env(1), 0), code('denied'), 'writing a malformed id is denied');
  await assert.rejects(() => be.put(ID, env(2), 0), code('denied'), 'create with rev 2 is denied (not a conflict)');
  await assert.rejects(() => be.put(ID, { v: 2, rev: 1, iv: 'x', ct: 'y' }, 0), code('denied'), 'a wrong format version is denied');
  await assert.rejects(() => be.put(ID, env(1, 'A'.repeat(900001)), 0), code('denied'), 'an oversized save is denied');
  assert.strictEqual(fb.docs.size, 0);
  await be.put(ID, Object.assign(env(1), { extra: 'leak', name: 'Zebediah' }), 0);
  const sent = JSON.parse(fb.calls.filter((c) => c.method === 'PATCH').pop().body).fields;
  assert.deepStrictEqual(Object.keys(sent).sort(), ['ct', 'iv', 'rev', 'v'], 'the adapter never sends fields beyond the four the rules allow');
  assert.deepStrictEqual(Object.keys(fb.docs.get(ID)).sort(), ['ct', 'iv', 'rev', 'v']);
  await assert.rejects(() => be.put(ID, env(5), 1), code('denied'), 'skipping a revision (cloud at 1, write 3 or 5 based on 1) is denied by the rules, not a conflict');

  /* ===== offline, timeouts, server trouble ===== */
  fb = makeFirebase(); be = make(fb); await be.put(ID, env(1), 0);
  fb.offline = true;
  await assert.rejects(() => be.get(ID), code('offline'), 'get while offline');
  await assert.rejects(() => be.put(ID, env(2), 1), code('offline'), 'put while offline');
  fb.offline = false;
  assert.deepStrictEqual(await be.get(ID), env(1), 'recovers when the connection returns');
  fb.failNext.push({ status: 'throw' });
  await assert.rejects(() => be.get(ID), code('offline'), 'a single dropped request');
  fb.hang = true;
  const slow = make(fb, null, { timeoutMs: 40 });
  const t0 = Date.now();
  await assert.rejects(() => slow.get(ID), code('offline'), 'a hung request times out as offline');
  assert.ok(Date.now() - t0 < 2000);
  fb.hang = false;
  fb.failNext.push({ status: 503, code: 'UNAVAILABLE' });
  await assert.rejects(() => be.get(ID), plain, 'server error is a plain error (the syncer retries with backoff)');
  fb.failNext.push({ status: 429, code: 'RESOURCE_EXHAUSTED' });
  await assert.rejects(() => be.put(ID, env(2), 1), plain, 'quota or rate limit is a plain error');
  fb.failNext.push({ status: 400, code: 'INVALID_ARGUMENT', message: 'bad' });
  await assert.rejects(() => be.put(ID, env(2), 1), (e) => plain(e) && /400/.test(e.message), 'unexpected client error is a plain error');
  assert.deepStrictEqual(await be.get(ID), env(1), 'none of that changed the cloud copy');
  fb.docs.set(ID, { v: 1, rev: 'x', iv: 5, ct: null });
  await assert.rejects(() => be.get(ID), plain, 'a garbled cloud document is an error, not data');
  fb.docs.set(ID, env(1));

  /* ===== anonymous sign-in ===== */
  fb = makeFirebase(); let st = makeStorage(); be = make(fb, st);
  await Promise.all([be.get(ID), be.get(ID), be.put(ID, env(1), 0)]);
  assert.strictEqual(fb.signUps, 1, 'concurrent first calls share one sign-in');
  await be.get(ID); await be.get(ID);
  assert.strictEqual(fb.signUps, 1, 'later calls reuse the session');
  assert.ok(JSON.parse(st.getItem(FB.AUTH_KEY)).refreshToken, 'the refresh token is saved on this device');
  assert.ok(!/id-\d/.test(st.getItem(FB.AUTH_KEY)), 'the short-lived id token is not saved');
  const be2 = make(fb, st); // same device, page reloaded
  await be2.get(ID);
  assert.strictEqual(fb.signUps, 1, 'a reload reuses the same anonymous user');
  assert.strictEqual(fb.refreshes, 1, '...by refreshing, not by creating a new user');
  fb.clock += 3600 * 1000 - 60 * 1000; // inside the 5 minute margin
  await be2.get(ID);
  assert.strictEqual(fb.refreshes, 2, 'refreshes the token shortly before it expires');
  fb.clock += 10 * 3600 * 1000; // long idle: token long expired
  await be2.get(ID);
  assert.strictEqual(fb.refreshes, 3, 'an expired token is refreshed');
  fb.rejectTokensOnce = true;
  assert.deepStrictEqual(await be2.get(ID), env(1), 'a token the server rejects is refreshed and the call retried once');
  assert.strictEqual(fb.refreshes, 4);
  fb.refreshTokens.clear(); // the user was deleted on the server
  fb.clock += 10 * 3600 * 1000;
  assert.deepStrictEqual(await be2.get(ID), env(1), 'a dead refresh token falls back to a new anonymous user');
  assert.strictEqual(fb.signUps, 2);
  const fresh = make(fb, makeStorage()); // a device with nothing saved
  await fresh.get(ID);
  assert.strictEqual(fb.signUps, 3, 'a brand new device signs in once');

  fb = makeFirebase(); fb.signUpError = 'ADMIN_ONLY_OPERATION';
  await assert.rejects(() => make(fb).get(ID), (e) => plain(e) && /sign-in failed/i.test(e.message) && /ADMIN_ONLY_OPERATION/.test(e.message), 'anonymous sign-in switched off gives a clear error');
  fb = makeFirebase();
  await assert.rejects(() => FB.create({ config: { apiKey: 'wrong', projectId: PROJECT }, fetch: fb.fetch, storage: makeStorage(), now: fb.now }).get(ID), plain, 'a wrong api key is an error');
  fb.offline = true;
  await assert.rejects(() => make(fb).get(ID), code('offline'), 'sign-in while offline is offline, and no user is created');
  assert.strictEqual(fb.users, 0);
  fb.offline = false;
  fb.failNext.push({ status: 503 });
  await assert.rejects(() => make(fb).get(ID), plain, 'sign-in server error');
  assert.strictEqual((await make(fb).get(ID)), null, 'and works on the next try');

  /* ===== two devices syncing through the adapter with the real Sync code ===== */
  const ITER = 1000;
  function makeTimers() {
    let nowT = 0, nn = 0, q = [];
    return { setTimeout(fn, ms) { const t = { id: ++nn, at: nowT + ms, fn }; q.push(t); return t.id; }, clearTimeout(id) { q = q.filter((t) => t.id !== id); },
      async advance(ms) { nowT += ms; const due = q.filter((t) => t.at <= nowT).sort((a, b) => a.at - b.at); q = q.filter((t) => t.at > nowT); due.forEach((t) => t.fn()); } };
  }
  function makeDevice(name, backend) {
    const timers = makeTimers();
    const dev = { name, data: Save.newData(), timers, storage: makeStorage() };
    dev.syncer = Sync.createSyncer({ backend, iterations: ITER, debounceMs: 100, timers, storage: dev.storage, getData: () => clone(dev.data),
      applyRemote: (d) => { dev.data = Save.mergeData(dev.data, d); dev.syncer.notifyChanged(); } });
    return dev;
  }
  fb = makeFirebase();
  const bA = make(fb), bB = make(fb);
  const A = makeDevice('lap', bA), B = makeDevice('ipad', bB);
  A.data.profiles.push(Save.newProfile({ id: 'p1', name: 'Zebediah', avatar: 'x', band: '2-3', now: 1 }));
  const { code: familyCode } = await A.syncer.setup();
  assert.strictEqual(fb.docs.size, 1, 'set up created the family in the cloud');
  const doc = [...fb.docs.values()][0];
  assert.ok(!Buffer.from(doc.ct, 'base64').toString('latin1').includes('Zebediah'), 'the cloud only holds ciphertext');
  assert.deepStrictEqual(Object.keys(doc).sort(), ['ct', 'iv', 'rev', 'v']);
  await B.syncer.join(familyCode);
  assert.ok(B.data.profiles.find((p) => p.id === 'p1'), 'the second device received the first device\'s player');
  // both play offline-ish and change different things, then converge
  const wins = (dev, n) => { const p = dev.data.profiles.find((x) => x.id === 'p1'); const g = p.games.rpg || (p.games.rpg = { xpEarned: {}, wins: {}, bosses: {}, creatures: [] }); Save.incCounter(g.wins, dev.name, n); Save.incCounter(g.xpEarned, dev.name, 10 * n); };
  wins(A, 2); wins(B, 3);
  B.syncer.notifyChanged(); A.syncer.notifyChanged();
  await Promise.all([A.timers.advance(200), B.timers.advance(200)]);
  await new Promise((r) => setTimeout(r, 300));
  await A.syncer.syncNow(); await B.syncer.syncNow(); await A.syncer.syncNow();
  const total = (dev) => Save.sumCounter(dev.data.profiles.find((p) => p.id === 'p1').games.rpg.wins);
  assert.strictEqual(total(A), 5, 'laptop has both devices\' wins');
  assert.strictEqual(total(B), 5, 'ipad has both devices\' wins');
  assert.ok([...fb.docs.values()][0].rev >= 2, 'the revision moved forward');
  fb.offline = true;
  wins(B, 1);
  await B.syncer.syncNow().catch(() => {});
  assert.strictEqual(B.syncer.status.state, 'offline', 'the sync screen reports offline');
  assert.strictEqual(total(B), 6, 'offline never touches local progress');
  fb.offline = false;
  await B.syncer.syncNow(); await A.syncer.syncNow();
  assert.strictEqual(total(A), 6, 'progress made offline arrives after reconnecting');
  await assert.rejects(() => makeDevice('x', make(fb)).syncer.join(Sync.generateFamilyCode()), code('notFound'), 'a mistyped code never creates a family');
  assert.strictEqual(fb.docs.size, 1);

  console.log('firebase-backend: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
