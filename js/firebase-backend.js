/* Firebase backend for cloud sync: implements { get, put } from docs/sync-design.md and publishes it as window.MathQuestBackend.
 *
 * It talks to Firebase's REST APIs directly (Identity Toolkit for anonymous sign-in, Firestore for the one encrypted document),
 * so there is no SDK and no third-party script on the page. It needs window.FIREBASE_CONFIG (js/firebase-config.js) and js/sync.js
 * loaded first. If either is missing it publishes nothing and the sync screen says cloud sync is not connected.
 *
 * Rules it works with (firestore.rules): one document families/<64 hex> with exactly { v, rev, iv, ct }; get/create/update only;
 * every update must bump rev by exactly 1. A stale write is therefore refused by the server, and this adapter reports it as a
 * conflict so Sync pulls and merges again.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Sync = isNode ? require('./sync.js') : root.Sync;
  if (!Sync) return;
  const SyncError = Sync.SyncError;

  const AUTH_KEY = 'mathQuest.fbAuth'; // { refreshToken } so every load reuses the same anonymous user
  const REFRESH_MARGIN_MS = 5 * 60 * 1000;

  function create(opts) {
    const cfg = opts.config;
    const doFetch = opts.fetch;
    const storage = opts.storage || null;
    const now = opts.now || Date.now;
    const timeoutMs = opts.timeoutMs || 15000;
    const authBase = opts.authBase || 'https://identitytoolkit.googleapis.com/v1';
    const tokenBase = opts.tokenBase || 'https://securetoken.googleapis.com/v1';
    const dbBase = opts.firestoreBase || 'https://firestore.googleapis.com/v1';
    const key = encodeURIComponent(cfg.apiKey);
    const docUrl = (id) => `${dbBase}/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/families/${encodeURIComponent(id)}`;

    /* ---------- one HTTP call; a network failure or timeout is "offline" ---------- */
    async function request(url, init) {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      try {
        const res = await doFetch(url, Object.assign({}, init, ctl ? { signal: ctl.signal } : {}));
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
        return { status: res.status, json };
      } catch (e) {
        throw new SyncError('offline', 'Could not reach the cloud');
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    const errText = (res) => (res.json && res.json.error && (res.json.error.message || res.json.error.status)) || '';
    function httpError(res, what) {
      if (res.status === 401) return new SyncError('denied', 'Not signed in');
      if (res.status === 429 || res.status >= 500) return new Error(`${what}: the cloud is busy (HTTP ${res.status})`);
      return new Error(`${what} failed (HTTP ${res.status}${errText(res) ? ': ' + errText(res) : ''})`);
    }

    /* ---------- anonymous sign-in (once per device, then refreshed) ---------- */
    let token = null;
    let expiresAt = 0;
    let refreshToken = null;
    try { const s = storage && JSON.parse(storage.getItem(AUTH_KEY) || 'null'); if (s && typeof s.refreshToken === 'string') refreshToken = s.refreshToken; } catch (e) { /* none saved */ }
    let authing = null;

    function remember(idToken, refresh, expiresInSec) {
      token = idToken;
      expiresAt = now() + (Number(expiresInSec) || 3600) * 1000;
      if (refresh && refresh !== refreshToken) {
        refreshToken = refresh;
        try { if (storage) storage.setItem(AUTH_KEY, JSON.stringify({ refreshToken })); } catch (e) { /* private mode: sign in again next load */ }
      }
    }
    async function signUp() {
      const res = await request(`${authBase}/accounts:signUp?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
      if (res.status !== 200 || !res.json || !res.json.idToken) throw new Error(`Anonymous sign-in failed (HTTP ${res.status}${errText(res) ? ': ' + errText(res) : ''})`);
      remember(res.json.idToken, res.json.refreshToken, res.json.expiresIn);
    }
    async function refresh() {
      const res = await request(`${tokenBase}/token?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken) });
      if (res.status === 200 && res.json && res.json.id_token) return remember(res.json.id_token, res.json.refresh_token, res.json.expires_in);
      if (res.status >= 500 || res.status === 429) throw httpError(res, 'Sign-in');
      refreshToken = null; // this user is gone or the token expired: start over with a new anonymous user
      try { if (storage) storage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
      return signUp();
    }
    function getToken(force) {
      if (!force && token && now() < expiresAt - REFRESH_MARGIN_MS) return Promise.resolve(token);
      if (!authing) authing = (refreshToken ? refresh() : signUp()).then(() => token).finally(() => { authing = null; });
      return authing;
    }
    async function authed(url, init) {
      let res = await request(url, Object.assign({}, init, { headers: Object.assign({}, init.headers, { Authorization: 'Bearer ' + (await getToken(false)) }) }));
      if (res.status === 401) { // the token was rejected: get a fresh one and try once more
        token = null;
        res = await request(url, Object.assign({}, init, { headers: Object.assign({}, init.headers, { Authorization: 'Bearer ' + (await getToken(true)) }) }));
      }
      return res;
    }

    /* ---------- the document ---------- */
    function parseDoc(json) {
      const f = json && json.fields;
      const int = (x) => (x && typeof x.integerValue === 'string' && /^-?\d+$/.test(x.integerValue) ? Number(x.integerValue) : NaN);
      const env = f && { v: int(f.v), rev: int(f.rev), iv: f.iv && f.iv.stringValue, ct: f.ct && f.ct.stringValue };
      if (!env || !Number.isFinite(env.v) || !Number.isFinite(env.rev) || typeof env.iv !== 'string' || typeof env.ct !== 'string') throw new Error('The cloud copy has an unexpected shape');
      return env;
    }

    async function get(id) {
      const res = await authed(docUrl(id), { method: 'GET' });
      if (res.status === 200) return parseDoc(res.json);
      if (res.status === 404) return null;
      if (res.status === 403) throw new SyncError('denied', 'The cloud refused to read the save');
      throw httpError(res, 'Reading the save');
    }

    async function put(id, env, expectedRev) {
      const body = { fields: { v: { integerValue: String(env.v) }, rev: { integerValue: String(env.rev) }, iv: { stringValue: env.iv }, ct: { stringValue: env.ct } } };
      // The precondition makes "create" fail if the family already exists, and "update" fail if it vanished.
      const res = await authed(`${docUrl(id)}?currentDocument.exists=${expectedRev === 0 ? 'false' : 'true'}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 200) return { ok: true };
      const st = res.json && res.json.error && res.json.error.status;
      const contested = res.status === 403 || res.status === 404 || res.status === 409 || (res.status === 400 && (st === 'FAILED_PRECONDITION' || st === 'ALREADY_EXISTS'));
      if (!contested) throw httpError(res, 'Saving');
      // A refused write is either "someone else wrote first" (the revision moved) or a real permission problem. Look again.
      const cur = await get(id);
      if (!cur) {
        if (expectedRev === 0) throw new SyncError('denied', 'The cloud refused to create the save');
        return { conflict: true };
      }
      if (cur.rev !== expectedRev) return { conflict: true };
      if (res.status === 403) throw new SyncError('denied', 'The cloud refused to save');
      throw httpError(res, 'Saving');
    }

    return { get, put };
  }

  const api = { create, AUTH_KEY };
  if (isNode) module.exports = api;
  else {
    root.FirebaseBackend = api;
    const cfg = root.FIREBASE_CONFIG;
    if (!root.MathQuestBackend && cfg && cfg.apiKey && cfg.projectId && typeof root.fetch === 'function') { // a backend that is already there (tests) wins
      let st = null;
      try { st = root.localStorage; } catch (e) { st = null; }
      root.MathQuestBackend = create({ config: cfg, fetch: root.fetch.bind(root), storage: st });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
