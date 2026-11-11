// A fake of the two Firebase REST services the adapter uses (anonymous sign-in + Firestore), as a fetch() replacement.
// Firestore part enforces the same rules as firestore.rules. Knobs let tests break things: offline, hang, server errors, expired tokens.
const KEY = 'test-api-key';
const PROJECT = 'demo-project';

function makeFirebase() {
  const fb = {
    KEY, PROJECT,
    clock: 1000000, // ms; tests move it forward to expire tokens
    docs: new Map(), // id -> { v, rev, iv, ct }
    users: 0, signUps: 0, refreshes: 0, calls: [],
    tokens: new Map(), // idToken -> expiry (ms)
    refreshTokens: new Set(),
    offline: false, hang: false, signUpError: null, failNext: [], preconditionFirst: false, rejectTokensOnce: false,
    now: () => fb.clock,
  };
  let n = 0;
  const reply = (status, body) => ({ status, ok: status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  const err = (status, st, message) => reply(status, { error: { code: status, status: st, message: message || st } });
  const issue = () => { const idToken = 'id-' + (++n); fb.tokens.set(idToken, fb.clock + 3600 * 1000); return idToken; };

  fb.fetch = async function (url, init) {
    init = init || {};
    fb.calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if (fb.offline) throw new TypeError('Failed to fetch');
    if (fb.hang) return new Promise((_, rej) => { if (init.signal) init.signal.addEventListener('abort', () => rej(new Error('aborted'))); });
    if (fb.failNext.length) { const f = fb.failNext.shift(); return f.status === 'throw' ? Promise.reject(new TypeError('Failed to fetch')) : err(f.status, f.code || 'INTERNAL', f.message); }
    const u = new URL(url);

    if (u.pathname.endsWith('/accounts:signUp')) {
      if (u.searchParams.get('key') !== KEY) return err(400, 'INVALID_ARGUMENT', 'API key not valid');
      if (fb.signUpError) return err(400, 'OPERATION_NOT_ALLOWED', fb.signUpError);
      fb.signUps++; fb.users++;
      const refreshToken = 'rt-' + (++n); fb.refreshTokens.add(refreshToken);
      return reply(200, { idToken: issue(), refreshToken, expiresIn: '3600', localId: 'u' + fb.users });
    }
    if (u.pathname.endsWith('/token')) {
      const form = new URLSearchParams(init.body || '');
      if (form.get('grant_type') !== 'refresh_token' || !fb.refreshTokens.has(form.get('refresh_token'))) return err(400, 'INVALID_ARGUMENT', 'INVALID_REFRESH_TOKEN');
      fb.refreshes++;
      return reply(200, { id_token: issue(), refresh_token: form.get('refresh_token'), expires_in: '3600' });
    }

    // Firestore
    const m = u.pathname.match(new RegExp('^/v1/projects/' + PROJECT + '/databases/\\(default\\)/documents/families/([^/]*)$'));
    if (!m) return err(404, 'NOT_FOUND', 'no such path ' + u.pathname);
    const auth = (init.headers && init.headers.Authorization) || '';
    const tok = auth.replace(/^Bearer /, '');
    const exp = fb.tokens.get(tok);
    if (fb.rejectTokensOnce) { fb.rejectTokensOnce = false; return err(401, 'UNAUTHENTICATED', 'token rejected'); }
    const signedIn = exp !== undefined && exp > fb.clock;
    const id = decodeURIComponent(m[1]);
    const cur = fb.docs.get(id);
    const validId = /^[a-f0-9]{64}$/.test(id);
    const method = init.method || 'GET';

    if (method === 'GET') {
      if (!signedIn && tok) return err(401, 'UNAUTHENTICATED');
      if (!signedIn || !validId) return err(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
      if (!cur) return err(404, 'NOT_FOUND', 'Document not found');
      return reply(200, { name: 'x', fields: { v: { integerValue: String(cur.v) }, rev: { integerValue: String(cur.rev) }, iv: { stringValue: cur.iv }, ct: { stringValue: cur.ct } } });
    }
    if (method === 'PATCH') {
      if (!signedIn && tok) return err(401, 'UNAUTHENTICATED');
      const want = u.searchParams.get('currentDocument.exists');
      const precondition = () => (want === 'false' && cur ? err(409, 'ALREADY_EXISTS', 'Document already exists') : want === 'true' && !cur ? err(404, 'NOT_FOUND', 'No document to update') : null);
      if (fb.preconditionFirst) { const p = precondition(); if (p) return p; }
      let f;
      try { f = JSON.parse(init.body).fields; } catch (e) { return err(400, 'INVALID_ARGUMENT'); }
      const names = Object.keys(f || {}).sort().join(',');
      const isInt = (x) => x && typeof x.integerValue === 'string' && /^-?\d+$/.test(x.integerValue);
      const shapeOk = names === 'ct,iv,rev,v' && isInt(f.v) && Number(f.v.integerValue) === 1 && isInt(f.rev) && typeof f.iv.stringValue === 'string' && f.iv.stringValue.length <= 64 && typeof f.ct.stringValue === 'string' && f.ct.stringValue.length <= 900000;
      const rev = shapeOk ? Number(f.rev.integerValue) : NaN;
      const allowed = signedIn && validId && shapeOk && (cur ? rev === cur.rev + 1 : rev === 1);
      if (!allowed) return err(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
      if (!fb.preconditionFirst) { const p = precondition(); if (p) return p; }
      fb.docs.set(id, { v: 1, rev, iv: f.iv.stringValue, ct: f.ct.stringValue });
      return reply(200, { name: 'x', fields: f });
    }
    return err(403, 'PERMISSION_DENIED'); // delete and anything else
  };
  return fb;
}

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

module.exports = { makeFirebase, makeStorage, KEY, PROJECT };
