/* Save format v2: versioned, namespaced per game, and MERGEABLE across devices. Pure logic, no DOM, unit-tested in Node.
 *
 * Why: progress must follow the kids across devices. Two devices can play offline and reconnect, so merging must never lose
 * progress. See docs/sync-design.md.
 *
 * Field types (each game declares one per field with Save.registerGame):
 *   counter : per-device counters {deviceId: n}, summed for display. Merge = per-device max. COUNTERS NEVER GO DOWN.
 *   set     : grow-only list of ids (creatures owned, nodes cleared). Merge = union.
 *   max     : best value (stars, high score). Merge = max.
 *   lww     : last write wins, stored with a sibling "<field>At" timestamp. Merge = newer; ties break deterministically.
 *
 * Merge is commutative, associative and idempotent (tested), so devices can sync in any order and converge.
 */
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 2;
  const DEFAULT_SETTINGS = { band: '2-3', stars: 1, theme: 'block', monsters: 'on' };

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (isObj(v)) {
      const o = {};
      Object.keys(v).sort().forEach((k) => (o[k] = sortKeys(v[k])));
      return o;
    }
    return v;
  };
  const stable = (v) => JSON.stringify(sortKeys(v === undefined ? null : v));
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
  const union = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].sort();

  /** Last write wins. Ties resolve to the larger stable string so merge stays commutative. */
  function pickLww(aVal, aAt, bVal, bAt) {
    if (aAt > bAt) return [aVal, aAt];
    if (bAt > aAt) return [bVal, bAt];
    return stable(aVal) >= stable(bVal) ? [aVal, aAt] : [bVal, bAt];
  }

  /* ---------- counters ---------- */

  const sumCounter = (m) => Object.values(m || {}).reduce((x, y) => x + num(y), 0);
  function incCounter(m, dev, n) {
    m[dev] = num(m[dev]) + (n === undefined ? 1 : n);
    return m;
  }
  function mergeCounter(a, b) {
    const out = {};
    union(a, b).forEach((k) => {
      const v = Math.max(num((a || {})[k]), num((b || {})[k]));
      if (v > 0) out[k] = v;
    });
    return out;
  }

  /* ---------- per-game schemas ---------- */

  const SCHEMAS = {};
  /** fields: { fieldName: 'counter' | 'set' | 'max' | 'lww' }. post(game) may repair invariants after a merge (must be idempotent). */
  function registerGame(id, fields, post) {
    SCHEMAS[id] = { fields, post };
  }

  registerGame('munchers', { levels: 'counter', streak: 'lww' });
  registerGame('balance', { levels: 'counter' });
  registerGame('machine', { levels: 'counter' });
  registerGame(
    'rpg',
    { xpEarned: 'counter', wins: 'counter', bosses: 'counter', creatures: 'set', team: 'lww' },
    (g) => {
      // the team can only hold creatures you own, at most 3. This only FILTERS: it never invents a team (a defaulted value
      // saved as if a player chose it would make the merge order matter). Games compute their default team when reading.
      if (Array.isArray(g.team)) g.team = g.team.filter((id) => (g.creatures || []).includes(id)).slice(0, 3);
    }
  );

  function mergeField(type, key, a, b, out) {
    if (type === 'counter') {
      const m = mergeCounter(a[key], b[key]);
      out[key] = m;
    } else if (type === 'set') {
      out[key] = [...new Set([...(a[key] || []), ...(b[key] || [])])].sort();
    } else if (type === 'max') {
      out[key] = Math.max(num(a[key]), num(b[key]));
    } else {
      const hasA = a[key] !== undefined;
      const hasB = b[key] !== undefined;
      if (!hasA && !hasB) return;
      const [v, at] = pickLww(a[key], num(a[key + 'At']), b[key], num(b[key + 'At']));
      if (v !== undefined) {
        out[key] = v;
        out[key + 'At'] = at;
      }
    }
  }

  function mergeGame(id, a, b) {
    a = a || {};
    b = b || {};
    const sc = SCHEMAS[id];
    const out = {};
    if (!sc) {
      // game without a registered merge rule: the newer whole object wins (register a schema to do better)
      const [v] = pickLww(a, num(a._at), b, num(b._at));
      return clone(v);
    }
    const lwwAt = new Set(Object.keys(sc.fields).filter((k) => sc.fields[k] === 'lww').map((k) => k + 'At'));
    Object.keys(sc.fields).forEach((k) => mergeField(sc.fields[k], k, a, b, out));
    // fields not in the schema are kept (never silently dropped); the larger stable value wins deterministically
    union(a, b).forEach((k) => {
      if (sc.fields[k] || lwwAt.has(k)) return;
      const cand = [a[k], b[k]].filter((x) => x !== undefined);
      out[k] = clone(cand.sort((x, y) => (stable(x) < stable(y) ? 1 : -1))[0]);
    });
    if (sc.post) sc.post(out);
    return out;
  }

  /* ---------- stats: stats[skillId][deviceId] = { right, wrong } ---------- */

  function addStat(profile, skillId, dev, right) {
    const s = profile.stats[skillId] || (profile.stats[skillId] = {});
    const d = s[dev] || (s[dev] = { right: 0, wrong: 0 });
    if (right) d.right++;
    else d.wrong++;
  }
  function statTotals(profile, skillId) {
    const s = (profile.stats || {})[skillId] || {};
    let right = 0;
    let wrong = 0;
    Object.values(s).forEach((d) => {
      right += num(d.right);
      wrong += num(d.wrong);
    });
    return { right, wrong };
  }
  function mergeStats(a, b) {
    const out = {};
    union(a, b).forEach((skill) => {
      out[skill] = {};
      union((a || {})[skill], (b || {})[skill]).forEach((dev) => {
        const x = ((a || {})[skill] || {})[dev] || {};
        const y = ((b || {})[skill] || {})[dev] || {};
        out[skill][dev] = { right: Math.max(num(x.right), num(y.right)), wrong: Math.max(num(x.wrong), num(y.wrong)) };
      });
    });
    return out;
  }

  /* ---------- profiles and data ---------- */

  function newProfile(o) {
    const now = o.now === undefined ? Date.now() : o.now;
    return {
      id: o.id,
      name: String(o.name || 'Player').trim().slice(0, 20) || 'Player',
      avatar: o.avatar,
      createdAt: now,
      metaAt: now,
      settings: Object.assign({}, DEFAULT_SETTINGS, { band: o.band || DEFAULT_SETTINGS.band }),
      settingsAt: now,
      stats: {},
      games: {},
    };
  }

  function mergeProfile(a, b) {
    const [meta] = pickLww({ name: a.name, avatar: a.avatar }, num(a.metaAt), { name: b.name, avatar: b.avatar }, num(b.metaAt));
    const [settings, settingsAt] = pickLww(a.settings, num(a.settingsAt), b.settings, num(b.settingsAt));
    const games = {};
    union(a.games, b.games).forEach((id) => (games[id] = mergeGame(id, (a.games || {})[id], (b.games || {})[id])));
    return {
      id: a.id,
      name: meta.name,
      avatar: meta.avatar,
      createdAt: Math.min(num(a.createdAt), num(b.createdAt)),
      metaAt: Math.max(num(a.metaAt), num(b.metaAt)),
      settings: Object.assign({}, DEFAULT_SETTINGS, clone(settings)),
      settingsAt,
      stats: mergeStats(a.stats, b.stats),
      games,
    };
  }

  function newData() {
    return { schemaVersion: SCHEMA_VERSION, profiles: [], deleted: {}, lastSaved: null };
  }

  /** Merge two v2 data objects. Never loses progress. Deleted profiles stay deleted (deletion is explicit and confirmed). */
  function mergeData(a, b) {
    const deleted = {};
    union(a.deleted, b.deleted).forEach((id) => (deleted[id] = Math.max(num((a.deleted || {})[id]), num((b.deleted || {})[id])) || 1));
    // normalize both sides the same way first, so the order of the arguments can never matter
    const index = (d) => {
      const m = {};
      (d.profiles || []).forEach((p) => (m[p.id] = m[p.id] ? mergeProfile(m[p.id], p) : mergeProfile(p, p)));
      return m;
    };
    const A = index(a);
    const B = index(b);
    const byId = {};
    union(A, B).forEach((id) => (byId[id] = A[id] && B[id] ? mergeProfile(A[id], B[id]) : A[id] || B[id]));
    const profiles = Object.keys(byId)
      .filter((id) => !deleted[id])
      .map((id) => byId[id])
      .sort((x, y) => num(x.createdAt) - num(y.createdAt) || (x.id < y.id ? -1 : 1));
    return { schemaVersion: SCHEMA_VERSION, profiles, deleted, lastSaved: Math.max(num(a.lastSaved), num(b.lastSaved)) || null };
  }

  /** Canonical form (so equal states compare equal). */
  const canon = (d) => mergeData(d, newData());

  /* ---------- migration and validation ---------- */

  function migrateProfileV1(p, dev, xpTotal) {
    const np = newProfile({ id: p.id, name: p.name, avatar: p.avatar, band: (p.settings || {}).band, now: 0 });
    np.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings || {});
    Object.keys(p.stats || {}).forEach((k) => {
      const s = p.stats[k] || {};
      np.stats[k] = { [dev]: { right: num(s.right), wrong: num(s.wrong) } };
    });
    const counter = (n) => (num(n) > 0 ? { [dev]: num(n) } : {});
    np.games.munchers = { levels: counter((p.munchers || {}).levels), streak: num((p.munchers || {}).streak), streakAt: 0 };
    if (p.balance) np.games.balance = { levels: counter(p.balance.levels) };
    if (p.machine) np.games.machine = { levels: counter(p.machine.levels) };
    if (p.rpg) {
      const r = p.rpg;
      np.games.rpg = {
        xpEarned: counter(xpTotal(num(r.level) || 1, num(r.xp))),
        wins: counter(r.wins),
        bosses: counter(r.bosses),
        creatures: [...new Set(Array.isArray(r.creatures) ? r.creatures : [])].sort(),
        team: Array.isArray(r.team) ? r.team : [],
        teamAt: 0,
      };
    }
    return np;
  }

  /** Accepts a v1 save, a v2 save, or a backup of either. Returns { data } or { error }. v1 counters are filed under this device. */
  function normalize(input, opts) {
    opts = opts || {};
    const dev = opts.deviceId || 'device';
    const xpTotal = opts.xpTotal || ((level, xp) => xp);
    if (!isObj(input) || !Array.isArray(input.profiles)) return { error: 'That file does not look like a Math Quest backup.' };
    const valid = input.profiles.every((p) => isObj(p) && typeof p.name === 'string' && isObj(p.settings));
    if (!valid) return { error: 'That file does not look like a Math Quest backup.' };
    const data = newData();
    data.lastSaved = num(input.lastSaved) || null;
    const seen = new Set();
    if (input.schemaVersion === SCHEMA_VERSION) {
      input.profiles.forEach((p) => {
        const id = p.id || 'p' + Math.random().toString(36).slice(2, 8);
        if (seen.has(id)) return;
        seen.add(id);
        const np = newProfile({ id, name: p.name, avatar: p.avatar, band: p.settings.band, now: num(p.createdAt) });
        np.metaAt = num(p.metaAt);
        np.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings);
        np.settingsAt = num(p.settingsAt);
        np.stats = isObj(p.stats) ? clone(p.stats) : {};
        np.games = isObj(p.games) ? clone(p.games) : {};
        data.profiles.push(np);
      });
      data.deleted = isObj(input.deleted) ? clone(input.deleted) : {};
    } else {
      input.profiles.forEach((p) => {
        const id = p.id || 'p' + Math.random().toString(36).slice(2, 8);
        if (seen.has(id)) return;
        seen.add(id);
        data.profiles.push(migrateProfileV1(Object.assign({}, p, { id }), dev, xpTotal));
      });
    }
    return { data: canon(data), migrated: input.schemaVersion !== SCHEMA_VERSION };
  }

  const api = {
    SCHEMA_VERSION, DEFAULT_SETTINGS,
    registerGame, newData, newProfile, mergeData, mergeProfile, mergeGame, canon, normalize,
    incCounter, sumCounter, mergeCounter, addStat, statTotals, pickLww, stable,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Save = api;
})(typeof window !== 'undefined' ? window : globalThis);
