/* Cloud sync core: encryption + the pull / merge / push logic. No Firebase in here (see docs/sync-design.md).
 * The real backend is a small adapter (get / put) plugged in later; tests use an in-memory fake that enforces the same rules as
 * firestore.rules. Pure logic apart from the WebCrypto it calls, so it runs and is tested in Node.
 *
 * Security model, in short:
 *  - The family SECRET is either a generated FAMILY CODE (16 random characters, 80 bits) or a FAMILY PASSWORD the owner chose (at least
 *    10 characters, checked for the obvious weak ones). It is stretched with PBKDF2, then split with HKDF into two independent values:
 *    a LOOKUP ID (the name of the cloud document) and an AES-GCM KEY. The server only ever sees the id and ciphertext.
 *  - Every save is encrypted on the device before upload. The ciphertext is bound to its document id.
 *  - Anyone who knows the code or password can read and write that family's save, so treat it like a password. A chosen password is
 *    weaker than a random code in principle, which is why it needs a minimum length and a weak-password check when it is created.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Save = isNode ? require('./save.js') : root.Save;
  const webcrypto = (typeof globalThis !== 'undefined' && globalThis.crypto) || (isNode ? require('crypto').webcrypto : null);
  const subtle = webcrypto && webcrypto.subtle;

  const ITERATIONS = 600000; // all devices must agree on this; tests may lower it explicitly
  const ENVELOPE_V = 1;
  const MAX_CT = 900000; // must match firestore.rules (a Firestore document is limited to 1 MiB)
  const MAX_ATTEMPTS = 6;
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
  const CREDS_KEY = 'mathQuest.sync';

  class SyncError extends Error {
    constructor(code, message) {
      super(message || code);
      this.code = code;
    }
  }

  /* ---------- small helpers ---------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  // two saves are "the same" if they hold the same progress; lastSaved is per-device bookkeeping and must not cause pointless uploads
  const comparable = (d) => Save.stable(Object.assign({}, Save.canon(d), { lastSaved: null }));

  /* ---------- family code ---------- */

  /** A new random family code like "K7PQ-3M9X-B2RD-VW4H" (80 bits). */
  function generateFamilyCode() {
    const b = webcrypto.getRandomValues(new Uint8Array(16));
    const chars = [...b].map((x) => ALPHABET[x & 31]).join(''); // 256 is a multiple of 32, so this is uniform
    return chars.match(/.{4}/g).join('-');
  }

  /** Normalizes what someone typed (case, spaces, dashes, look-alike letters). Returns the 16 characters, or null if it can't be a code. */
  function normalizeCode(input) {
    const s = String(input || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(s) ? s : null;
  }

  /* ---------- family password (chosen by the owner instead of a generated code) ---------- */

  const MIN_PASSWORD = 10;
  const COMMON = new Set(('password passphrase passw0rd letmein welcome iloveyou ilovemyfamily qwerty qwertyuiop asdfghjkl zxcvbnm monkey dragon football baseball basketball soccer hockey ' +
    'princess superman batman spiderman minecraft roblox fortnite pokemon starwars sunshine shadow mustang master login admin administrator secret changeme default ' +
    'whatever freedom computer internet trustno abc abcdef abcdefgh hello helloworld test testing family myfamily ourfamily thefamily familyfamily familypassword ' +
    'mathquest mathgames mathfamily mathquestfamily mathrocks mathisfun kidsmath school summer winter ').split(' ').filter(Boolean));
  const KEYBOARD = 'qwertyuiopasdfghjklzxcvbnm'; // letters in keyboard order; a long stretch of it (either direction) is a keyboard walk

  /** What someone typed as a password -> the form that is hashed: Unicode-normalized, trimmed, one space between words, lower case. */
  function normalizePassword(input) {
    return String(input == null ? '' : input).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Is this an acceptable NEW family password? Returns { ok, problem, strength, length }.
   * problem: 'short' | 'repetitive' | 'common' | null. strength: 'weak' | 'okay' | 'good' | 'great' (a hint for the screen, not a guarantee).
   * Only applied when creating a family. Joining accepts whatever unlocks an existing family.
   */
  function checkPassword(input) {
    const pw = normalizePassword(input);
    const length = [...pw].length;
    const fail = (problem) => ({ ok: false, problem, strength: 'weak', length });
    if (length < MIN_PASSWORD) return fail('short');
    const chars = pw.replace(/\s/g, '');
    if (new Set(chars).size <= 3 || /^(.+?)\1+$/.test(chars)) return fail('repetitive'); // aaaaaaaaaa, abababab, passwordpassword
    const step = (i) => chars.charCodeAt(i) - chars.charCodeAt(i - 1);
    const run = [...chars].every((c, i) => i === 0 || step(i) === 1) || [...chars].every((c, i) => i === 0 || step(i) === -1);
    if (run || KEYBOARD.includes(chars) || [...KEYBOARD].reverse().join('').includes(chars)) return fail('common'); // abcdefghij, asdfghjklzxcv, poiuytrewq
    // a common word with digits or symbols around it or swapped in (password123, P@ssw0rd!!, mathquest2026) is still a common word
    const letters = chars.replace(/^[^a-z]+|[^a-z]+$/g, '').replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[$5]/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
    if (COMMON.has(letters) || /^\d+$/.test(chars)) return fail('common'); // password123, P@ssw0rd!, mathquest2026, all digits
    const words = pw.split(' ').length;
    const strength = length >= 20 ? 'great' : (length >= 14 || words >= 3 ? 'good' : 'okay');
    return { ok: true, problem: null, strength, length };
  }

  /** What someone typed -> { kind: 'code' | 'password', secret } or null if it could be neither. A code-shaped entry is always read as a code. */
  function parseSecret(input) {
    const code = normalizeCode(input);
    if (code) return { kind: 'code', secret: code };
    const pw = normalizePassword(input);
    return [...pw].length >= MIN_PASSWORD ? { kind: 'password', secret: pw } : null;
  }

  /* ---------- keys and encryption ---------- */

  /**
   * Derive { lookupId, key, keyRaw, kind, secret } from a family code or password. Slow on purpose (PBKDF2).
   * Generated codes use the original salt, so families created before passwords existed are unaffected. Passwords use their own salt.
   */
  async function deriveKeys(input, opts) {
    const parsed = parseSecret(input);
    if (!parsed) throw new SyncError('badCode', 'That is not a valid family code or password.');
    const base = await subtle.importKey('raw', enc.encode(parsed.secret), 'PBKDF2', false, ['deriveBits']);
    const master = await subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(parsed.kind === 'code' ? 'mathquest-family-v1' : 'mathquest-family-password-v1'), iterations: (opts && opts.iterations) || ITERATIONS },
      base,
      256
    );
    const hk = await subtle.importKey('raw', master, 'HKDF', false, ['deriveBits']);
    const part = (info) => subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) }, hk, 256);
    const idBits = await part('mathquest lookup id');
    const keyBits = await part('mathquest encryption key');
    const key = await subtle.importKey('raw', keyBits, 'AES-GCM', true, ['encrypt', 'decrypt']);
    return { lookupId: hex(idBits), key, keyRaw: b64(keyBits), kind: parsed.kind, secret: parsed.secret };
  }

  async function keysFromCreds(c) {
    const key = await subtle.importKey('raw', unb64(c.keyRaw), 'AES-GCM', true, ['encrypt', 'decrypt']);
    return { lookupId: c.lookupId, key, keyRaw: c.keyRaw };
  }

  const aad = (id) => enc.encode('mathquest:' + ENVELOPE_V + ':' + id);

  /** Encrypt a v2 save. Returns { v, iv, ct } (rev is added by the sync step). */
  async function encryptData(keys, data) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(keys.lookupId) }, keys.key, enc.encode(JSON.stringify(data)));
    return { v: ENVELOPE_V, iv: b64(iv), ct: b64(ct) };
  }

  /** Decrypt an envelope to a v2 save. Throws SyncError('badKey') for a wrong code or damaged data, 'corrupt' for a malformed one. */
  async function decryptEnvelope(keys, env) {
    if (!env || env.v !== ENVELOPE_V || typeof env.iv !== 'string' || typeof env.ct !== 'string') throw new SyncError('corrupt', 'The cloud copy is not in a format this version understands.');
    let plain;
    try {
      plain = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: aad(keys.lookupId) }, keys.key, unb64(env.ct));
    } catch (e) {
      throw new SyncError('badKey', 'Could not unlock the cloud copy: the family code is wrong, or the copy is damaged.');
    }
    let obj;
    try {
      obj = JSON.parse(dec.decode(plain));
    } catch (e) {
      throw new SyncError('corrupt', 'The cloud copy unlocked but is not readable.');
    }
    const r = Save.normalize(obj, { deviceId: 'cloud' });
    if (r.error) throw new SyncError('corrupt', 'The cloud copy unlocked but is not a Puzzle Lab save.');
    return r.data;
  }

  /* ---------- one sync pass ---------- */

  /**
   * deps: { backend: { get(id), put(id, envelope, expectedRev) }, getData(), applyRemote(data) }
   * mode: 'normal' (create the cloud copy if missing), 'join' (the cloud copy must already exist), 'create' (it must NOT exist).
   * Merges, never overwrites: the cloud copy and this device's save are combined before anything is written.
   */
  async function syncOnce(keys, deps, mode) {
    const id = keys.lookupId;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const local = deps.getData();
      const remote = await deps.backend.get(id);
      if (!remote) {
        if (mode === 'join') throw new SyncError('notFound', 'No family matches that code.');
        const e = await encryptData(keys, local);
        if (e.ct.length > MAX_CT) throw new SyncError('tooBig', 'The save is too large to upload.');
        const res = await deps.backend.put(id, { v: ENVELOPE_V, rev: 1, iv: e.iv, ct: e.ct }, 0);
        if (res && res.conflict) continue;
        return { pushed: true, pulled: false, rev: 1 };
      }
      if (mode === 'create') throw new SyncError('exists', 'A family with that code already exists.');
      const remoteData = await decryptEnvelope(keys, remote);
      const merged = Save.mergeData(local, remoteData);
      const changedLocal = comparable(merged) !== comparable(local);
      const changedRemote = comparable(merged) !== comparable(remoteData);
      if (changedLocal) deps.applyRemote(remoteData); // this device now has everything the cloud had
      if (!changedRemote) return { pushed: false, pulled: changedLocal, rev: remote.rev };
      const e = await encryptData(keys, merged);
      if (e.ct.length > MAX_CT) throw new SyncError('tooBig', 'The save is too large to upload.');
      const res = await deps.backend.put(id, { v: ENVELOPE_V, rev: remote.rev + 1, iv: e.iv, ct: e.ct }, remote.rev);
      if (res && res.conflict) continue; // another device wrote first: pull again and re-merge
      return { pushed: true, pulled: changedLocal, rev: remote.rev + 1 };
    }
    throw new SyncError('conflict', 'Other devices keep changing the save. Try again in a moment.');
  }

  /* ---------- the syncer: setup / join / automatic background sync ---------- */

  const MESSAGES = {
    off: 'Sync is not set up on this device.',
    idle: 'Sync is on.',
    syncing: 'Syncing…',
    synced: 'Synced.',
    offline: 'Offline. Will sync when the connection is back.',
    badKey: 'The family code or password does not unlock the cloud copy.',
    tooShort: 'A family password needs at least ' + MIN_PASSWORD + ' characters.',
    weakPassword: 'That password is too easy to guess.',
    corrupt: 'The cloud copy could not be read. Nothing was overwritten.',
    tooBig: 'The save is too large to sync.',
    conflict: 'Other devices are changing the save. Will try again.',
    denied: 'The cloud service refused the request.',
    notFound: 'No family matches that code or password.',
    exists: 'A family with that code or password already exists.',
    error: 'Sync hit a problem. Will try again.',
  };

  /**
   * opts: { backend, getData(), applyRemote(data), storage (localStorage-like), iterations?, debounceMs?, timers?, now?,
   *         setTimeout/clearTimeout via timers }
   */
  function createSyncer(opts) {
    const storage = opts.storage || { getItem() { return null; }, setItem() {}, removeItem() {} };
    const timers = opts.timers || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t) };
    const now = opts.now || (() => Date.now());
    const debounceMs = opts.debounceMs === undefined ? 4000 : opts.debounceMs;
    const listeners = [];
    let keys = null;
    let status = { state: 'off', message: MESSAGES.off, lastSynced: null, rev: null };
    let timer = null;
    let inFlight = null;
    let again = false;
    let applying = false;
    let failures = 0;
    let savedCode = null;
    let savedKind = null;

    const deps = {
      backend: opts.backend,
      getData: opts.getData,
      applyRemote: (d) => {
        applying = true; // our own writes must not trigger another sync
        try {
          opts.applyRemote(d);
        } finally {
          applying = false;
        }
      },
    };

    function setStatus(state, extra) {
      status = Object.assign({}, status, { state, message: MESSAGES[state] || state }, extra || {});
      listeners.slice().forEach((f) => f(status));
    }

    const formatCode = (c) => c.match(/.{4}/g).join('-');
    // The code or password is kept on this device (like the key it derives, it grants access to the family's save) so a grown-up can show it again.
    function saveCreds(k) {
      savedCode = k.secret;
      savedKind = k.kind;
      storage.setItem(CREDS_KEY, JSON.stringify({ lookupId: k.lookupId, keyRaw: k.keyRaw, code: savedCode, kind: savedKind, at: now() }));
    }

    function stateFor(e) {
      return e instanceof SyncError && MESSAGES[e.code] ? e.code : 'error';
    }

    /** Load saved credentials, if this device already joined a family. */
    async function init() {
      const raw = storage.getItem(CREDS_KEY);
      if (!raw) return status;
      try {
        const c = JSON.parse(raw);
        keys = await keysFromCreds(c);
        savedKind = c.kind === 'password' ? 'password' : 'code'; // older saves have no kind: they are generated codes
        savedCode = savedKind === 'password' ? normalizePassword(c.code) : normalizeCode(c.code);
        setStatus('idle');
      } catch (e) {
        storage.removeItem(CREDS_KEY);
        keys = null;
      }
      return status;
    }

    async function guarded(fn) {
      if (inFlight) await inFlight.catch(() => {});
      setStatus('syncing');
      const p = fn();
      inFlight = p;
      try {
        return await p;
      } finally {
        if (inFlight === p) inFlight = null;
      }
    }

    /**
     * First device: make a new family and upload this device's save. With { password } the owner's chosen password is used (it must pass
     * checkPassword), otherwise a random family code is generated. Returns { code, kind } only if the upload worked.
     */
    async function setup(choice) {
      let input;
      if (choice && choice.password !== undefined) {
        const c = checkPassword(choice.password);
        if (c.problem === 'short') throw new SyncError('tooShort', MESSAGES.tooShort);
        if (!c.ok) throw new SyncError('weakPassword', MESSAGES.weakPassword);
        input = choice.password;
      } else {
        input = generateFamilyCode();
      }
      const k = await deriveKeys(input, { iterations: opts.iterations });
      try {
        const r = await guarded(() => syncOnce(k, deps, 'create'));
        keys = k;
        saveCreds(k);
        failures = 0;
        setStatus('synced', { lastSynced: now(), rev: r.rev });
        return { code: k.kind === 'code' ? formatCode(k.secret) : k.secret, kind: k.kind };
      } catch (e) {
        setStatus(keys ? 'idle' : 'off');
        throw e;
      }
    }

    /** Another device: enter the family code. The family must already exist (a typo never creates a new one). */
    async function join(input) {
      const k = await deriveKeys(input, { iterations: opts.iterations });
      try {
        const r = await guarded(() => syncOnce(k, deps, 'join'));
        keys = k;
        saveCreds(k);
        failures = 0;
        setStatus('synced', { lastSynced: now(), rev: r.rev });
        return r;
      } catch (e) {
        setStatus(keys ? 'idle' : 'off');
        throw e;
      }
    }

    /** One sync now. Never throws: failures show up in the status and are retried. */
    async function syncNow() {
      if (!keys) return status;
      if (inFlight) {
        again = true;
        return status;
      }
      try {
        const r = await guarded(() => syncOnce(keys, deps, 'normal'));
        failures = 0;
        setStatus('synced', { lastSynced: now(), rev: r.rev });
      } catch (e) {
        const state = stateFor(e);
        failures++;
        setStatus(state);
        if (state === 'offline' || state === 'conflict' || state === 'error') schedule(Math.min(300000, 15000 * Math.pow(2, Math.min(failures - 1, 5))));
      }
      if (again) {
        again = false;
        schedule(debounceMs);
      }
      return status;
    }

    function schedule(ms) {
      if (!keys) return;
      if (timer) timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = null;
        syncNow();
      }, ms);
    }

    /** Call after every local save. Several saves in a row become one sync. */
    function notifyChanged() {
      if (!keys || applying) return;
      schedule(debounceMs);
    }

    /** Sync again when the connection returns or the page comes back to the front. `env` is the window (injectable for tests). */
    function attach(env) {
      env.addEventListener('online', () => syncNow());
      if (env.document && env.document.addEventListener) env.document.addEventListener('visibilitychange', () => { if (!env.document.hidden) syncNow(); });
    }

    /** Stop syncing on this device. The cloud copy is left alone. */
    function disconnect() {
      storage.removeItem(CREDS_KEY);
      keys = null;
      savedCode = null;
      savedKind = null;
      if (timer) timers.clearTimeout(timer);
      timer = null;
      setStatus('off', { lastSynced: null, rev: null });
    }

    return {
      init, setup, join, syncNow, notifyChanged, attach, disconnect,
      onStatus: (f) => listeners.push(f),
      get status() { return status; },
      get enabled() { return !!keys; },
      /** The family code (formatted like K7PQ-3M9X-B2RD-VW4H) or password saved on this device (null if sync is off). */
      getCode: () => (savedCode ? (savedKind === 'password' ? savedCode : formatCode(savedCode)) : null),
      /** 'code' or 'password' (null if sync is off). */
      getKind: () => (savedCode ? savedKind : null),
    };
  }

  const api = {
    ITERATIONS, ENVELOPE_V, MAX_CT, MIN_PASSWORD, SyncError, MESSAGES,
    generateFamilyCode, normalizeCode, normalizePassword, checkPassword, parseSecret, deriveKeys, keysFromCreds, encryptData, decryptEnvelope, syncOnce, createSyncer,
  };
  if (isNode) module.exports = api;
  else root.Sync = api;
})(typeof window !== 'undefined' ? window : globalThis);
