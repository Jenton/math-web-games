// An in-memory stand-in for the cloud that enforces the same rules as firestore.rules, so tests double as an executable model of them.
const assert = require('assert');
const Sync = require('../../js/sync.js');
const clone = (x) => JSON.parse(JSON.stringify(x));

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


module.exports = { makeBackend };
