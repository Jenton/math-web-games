// Optional, needs the Firebase emulators (Java 21+). Runs the adapter against the REAL Firestore and Auth emulators with the REAL firestore.rules:
//   npx firebase-tools emulators:exec --only auth,firestore --project demo-mathquest "node tests/firebase-backend.emulator.js"
// (run from the repo root; it only talks to the local emulators, never to your real Firebase project)
const assert = require('assert');
const Save = require('../js/save.js');
const Sync = require('../js/sync.js');
const FB = require('../js/firebase-backend.js');

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) { console.error('Run this through: npx firebase-tools emulators:exec --only auth,firestore --project demo-mathquest "node tests/firebase-backend.emulator.js"'); process.exit(2); }
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-mathquest';
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const make = (storage) => FB.create({ config: { apiKey: 'fake-key', projectId: PROJECT }, fetch: fetch, storage: storage || mem(),
  authBase: `http://${AUTH}/identitytoolkit.googleapis.com/v1`, tokenBase: `http://${AUTH}/securetoken.googleapis.com/v1`, firestoreBase: `http://${FS}/v1` });
const rnd = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
const env = (rev, ct) => ({ v: 1, rev, iv: 'aXY=', ct: ct || 'Y3Q=' });
const code = (c) => (e) => e instanceof Sync.SyncError && e.code === c;
const clone = (x) => JSON.parse(JSON.stringify(x));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

(async () => {
  const be = make();
  const id = rnd();
  eq(await be.get(id), null, 'missing family is null');
  eq(await be.put(id, env(1), 0), { ok: true }, 'create');
  eq(await be.get(id), env(1), 'read back');
  eq(await be.put(id, env(2, 'bmV3'), 1), { ok: true }, 'update rev+1');
  eq(await be.put(id, env(2, 'c3RhbGU='), 1), { conflict: true }, 'stale update is a conflict');
  eq(await be.put(id, env(1, 'eHg='), 0), { conflict: true }, 'create when it exists is a conflict');
  eq(await be.get(id), env(2, 'bmV3'), 'refused writes changed nothing');
  eq(await be.put(rnd(), env(3), 2), { conflict: true }, 'update of a missing family is a conflict');
  await assert.rejects(() => be.put(rnd(), env(2), 0), code('denied')); checks++;                  // create with rev 2: rules refuse
  await assert.rejects(() => be.put(rnd(), { v: 2, rev: 1, iv: 'x', ct: 'y' }, 0), code('denied')); checks++;
  await assert.rejects(() => be.put(rnd(), env(1, 'A'.repeat(900001)), 0), code('denied')); checks++;
  await assert.rejects(() => be.get('short-id'), code('denied')); checks++;
  await assert.rejects(() => be.put('short-id', env(1), 0), code('denied')); checks++;
  await assert.rejects(() => be.put(id, env(4), 2), code('denied')); checks++;                     // skipping a revision
  eq((await be.get(id)).rev, 2, 'still at rev 2');

  // the rules, hit directly without the adapter: no token, no access; no list; no delete
  const base = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
  eq((await fetch(`${base}/families/${id}`)).status, 403, 'no token: read refused');
  eq((await fetch(`${base}/families`)).status, 403, 'no token: list refused');
  const tok = (await (await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=k`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json()).idToken;
  eq((await fetch(`${base}/families`, { headers: { Authorization: 'Bearer ' + tok } })).status, 403, 'signed in: list still refused');
  eq((await fetch(`${base}/families/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } })).status, 403, 'signed in: delete refused');
  eq((await fetch(`${base}/other/x`, { headers: { Authorization: 'Bearer ' + tok } })).status, 403, 'other collections closed');
  eq((await fetch(`${base}/families/${id}`, { headers: { Authorization: 'Bearer ' + tok } })).status, 200, 'signed in: read of a known id works');

  // token reuse across page loads
  const st = mem();
  await make(st).get(id);
  const users = async () => (await (await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`)).json());
  const before = (await users()).length;
  await make(st).get(id); await make(st).get(id);
  eq((await users()).length, before, 'reloads reuse the same anonymous user');

  // two devices through the adapter with the real Sync code
  const timersFor = () => { let nowT = 0, n = 0, q = []; return { setTimeout(fn, ms) { const t = { id: ++n, at: nowT + ms, fn }; q.push(t); return t.id; }, clearTimeout(i) { q = q.filter((t) => t.id !== i); }, async advance(ms) { nowT += ms; const d = q.filter((t) => t.at <= nowT); q = q.filter((t) => t.at > nowT); d.forEach((t) => t.fn()); } }; };
  const dev = (name) => { const d = { name, data: Save.newData(), storage: mem(), timers: timersFor() }; d.syncer = Sync.createSyncer({ backend: make(), iterations: 1000, debounceMs: 100, timers: d.timers, storage: d.storage, getData: () => clone(d.data), applyRemote: (x) => { d.data = Save.mergeData(d.data, x); d.syncer.notifyChanged(); } }); return d; };
  const A = dev('lap'), B = dev('ipad');
  A.data.profiles.push(Save.newProfile({ id: 'p1', name: 'Zebediah', avatar: 'x', band: '2-3', now: 1 }));
  const { code: fam } = await A.syncer.setup();
  await B.syncer.join(fam);
  ok(B.data.profiles.some((p) => p.id === 'p1'), 'ipad got the laptop\'s player');
  const wins = (d, n) => { const g = d.data.profiles[0].games.rpg || (d.data.profiles[0].games.rpg = { xpEarned: {}, wins: {}, bosses: {}, creatures: [] }); Save.incCounter(g.wins, d.name, n); Save.incCounter(g.xpEarned, d.name, 10 * n); };
  wins(A, 2); wins(B, 3);
  A.syncer.notifyChanged(); B.syncer.notifyChanged();
  await Promise.all([A.timers.advance(200), B.timers.advance(200)]);
  await new Promise((r) => setTimeout(r, 500));
  await A.syncer.syncNow(); await B.syncer.syncNow(); await A.syncer.syncNow();
  const total = (d) => Save.sumCounter(d.data.profiles[0].games.rpg.wins);
  eq([total(A), total(B)], [5, 5], 'both devices converge on 5 wins through the real emulators');
  await assert.rejects(() => dev('x').syncer.join(Sync.generateFamilyCode()), code('notFound')); checks++;

  console.log(`firebase-backend (emulators): ${checks} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
