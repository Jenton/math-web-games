/* Light, private, on-device storage. No accounts, no network (cloud sync is planned: see docs/sync-design.md).
 *
 * Saves use the v2 format in js/save.js, which is versioned, namespaced per game, and mergeable across devices.
 * Games must save ONLY through this module: progress lives under profile.games.<gameId>, using the helpers below
 * (counters only go up; sets only grow; "last write wins" fields carry a timestamp), and every game must have a merge
 * rule in js/save.js (Save.registerGame) with tests.
 *
 * Old (v1) saves are migrated on first load. The v1 data is never deleted or modified, so it stays as a backup.
 */
(function (root) {
  'use strict';
  const KEY = 'mathQuest.v2';
  const OLD_KEY = 'mathQuest.v1';
  const DEV_KEY = 'mathQuest.device';
  let data = Save.newData();
  let ok = true;
  let deviceId = null;
  let saveListener = null;

  const genId = (prefix) => prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

  function getDeviceId() {
    try {
      let d = localStorage.getItem(DEV_KEY);
      if (!d) {
        d = genId('d');
        localStorage.setItem(DEV_KEY, d);
      }
      return d;
    } catch (e) {
      return genId('d');
    }
  }

  /** v1 stored XP as "level + XP into that level"; v2 stores total XP earned. Uses the RPG level curve when available. */
  function xpTotal(level, xp) {
    let t = xp;
    if (root.RPG) for (let l = 1; l < level; l++) t += root.RPG.xpToNext(l);
    return t;
  }

  function tryLoad(key) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (e) {
      ok = false;
      return null;
    }
    if (!raw) return null;
    try {
      const r = Save.normalize(JSON.parse(raw), { deviceId, xpTotal });
      if (r.data) return r;
    } catch (e) {
      /* fall through */
    }
    // unreadable: keep a copy instead of overwriting it silently
    try {
      localStorage.setItem(key + '.unreadable', raw);
    } catch (e) {
      /* nothing more we can do */
    }
    return null;
  }

  function load() {
    deviceId = getDeviceId();
    const v2 = tryLoad(KEY);
    if (v2) {
      data = v2.data;
      return;
    }
    const v1 = tryLoad(OLD_KEY);
    if (v1) {
      data = v1.data;
      save(); // writes v2; the v1 entry is left untouched as a backup
    }
  }

  function save() {
    data.lastSaved = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      ok = true;
    } catch (e) {
      ok = false;
    }
    if (saveListener) saveListener();
    return ok;
  }

  function newProfile(name, avatar, band, grade) {
    const p = Save.newProfile({ id: genId('p'), name, avatar, band, grade });
    data.profiles.push(p);
    save();
    return p;
  }

  /** Deleting leaves a marker so that, once devices sync, another device does not bring the player back. */
  function remove(id) {
    data.deleted[id] = Date.now();
    data.profiles = data.profiles.filter((p) => p.id !== id);
    save();
  }

  /* ---- helpers games use (see the rules at the top of this file) ---- */
  const record = (profile, skillId, right) => Save.addStat(profile, skillId, deviceId, right);
  const stat = (profile, skillId) => Save.statTotals(profile, skillId);
  const statSkills = (profile) => Object.keys(profile.stats || {});
  const game = (profile, id) => (profile.games[id] || (profile.games[id] = {}));
  /** Add to this device's counter for a field. Counters only go up. */
  const bump = (gameObj, key, n) => Save.incCounter(gameObj[key] || (gameObj[key] = {}), deviceId, n);
  const total = (gameObj, key) => Save.sumCounter(gameObj[key]);
  /** A "last write wins" value; stored with a timestamp so the newest change wins when devices merge. */
  function setField(gameObj, key, value) {
    gameObj[key] = value;
    gameObj[key + 'At'] = Date.now();
  }
  /** The grade and challenge to PLAY a game at. A game's own choice wins; otherwise it follows the player's default grade
   *  (profile.settings.band). Other settings (look, glitches, motion) come from the profile as before. Returns a copy: change it with setLevel. */
  function level(profile, gameId) {
    const g = (profile.games && profile.games[gameId]) || {};
    return Object.assign({}, profile.settings, { band: g.band || profile.settings.band, stars: g.stars || profile.settings.stars, grade: grade(profile) });
  }
  /** The player's grade (0 = kindergarten). If they never chose one this is a read-time guess from the old band (the upper grade of it), NOT saved: ask with gradeKnown. */
  function grade(profile) {
    const g = Grades.clean((profile.settings || {}).grade);
    return g != null ? g : Grades.legacyGrade((profile.settings || {}).band);
  }
  const gradeKnown = (profile) => Grades.clean((profile.settings || {}).grade) != null;
  /** Choose the grade. Also rewrites the old band from it, so games that have not moved to grades yet, and older devices, keep working. */
  function setGrade(profile, g) {
    const v = Grades.clean(g);
    if (v == null) return;
    setSettings(profile, { grade: v, band: Grades.bandOf(v) });
  }
  /** Set the grade and/or challenge for ONE game. Pass null to go back to following the player's default. */
  function setLevel(profile, gameId, patch) {
    const g = game(profile, gameId);
    if ('band' in patch) setField(g, 'band', patch.band);
    if ('stars' in patch) setField(g, 'stars', patch.stars);
  }
  const hasOwnLevel = (profile, gameId, field) => !!(profile.games && profile.games[gameId] && profile.games[gameId][field || 'band']);
  function setSettings(profile, patch) {
    Object.assign(profile.settings, patch);
    profile.settingsAt = Date.now();
  }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  /** Replace everything with a backup (v1 or v2 file). Returns null on success, or an error message. */
  function importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return 'That file is not a valid backup.';
    }
    const r = Save.normalize(parsed, { deviceId, xpTotal });
    if (r.error) return r.error;
    data = r.data;
    save();
    return null;
  }

  /** Merge a v2 save from elsewhere (for example the cloud copy) into this device's data without losing anything. */
  function mergeIn(remote) {
    const r = Save.normalize(remote, { deviceId, xpTotal });
    if (r.error) return r.error;
    // merge IN PLACE: a running game holds a reference to its profile object and must keep saving into the live data
    Save.assignInPlace(data, Save.mergeData(data, r.data));
    save();
    return null;
  }

  /** A copy of everything saved on this device (what cloud sync reads). */
  const snapshot = () => JSON.parse(JSON.stringify(data));
  /** Called after every save (cloud sync uses this to schedule an upload). One listener. */
  const onSave = (fn) => { saveListener = fn; };

  root.Store = {
    load, save, newProfile, remove, snapshot, onSave,
    record, stat, statSkills, game, bump, total, setField, setSettings, level, setLevel, hasOwnLevel, grade, gradeKnown, setGrade,
    exportJSON, importJSON, mergeIn,
    get profiles() { return data.profiles; },
    get lastSaved() { return data.lastSaved; },
    get ok() { return ok; },
    get deviceId() { return deviceId; },
    find: (id) => data.profiles.find((p) => p.id === id),
  };
})(window);
