/* Light, private, on-device storage. No accounts, no network.
 * Everything lives in localStorage; export/import gives a backup file. */
(function (root) {
  'use strict';
  const KEY = 'mathQuest.v1';
  let data = { version: 1, profiles: [], lastSaved: null };
  let ok = true;

  const DEFAULT_SETTINGS = { band: '2-3', stars: 1, theme: 'block', monsters: 'on' };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.profiles)) data = d;
      }
    } catch (e) {
      ok = false;
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
    return ok;
  }

  function newProfile(name, avatar, band) {
    const p = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim().slice(0, 20) || 'Player',
      avatar,
      settings: Object.assign({}, DEFAULT_SETTINGS, { band }),
      stats: {},
      munchers: { levels: 0, streak: 0 },
    };
    data.profiles.push(p);
    save();
    return p;
  }

  function remove(id) {
    data.profiles = data.profiles.filter((p) => p.id !== id);
    save();
  }

  function record(profile, skillId, right) {
    const s = profile.stats[skillId] || (profile.stats[skillId] = { right: 0, wrong: 0 });
    if (right) s.right++;
    else s.wrong++;
  }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  /** Returns null on success, or an error message. */
  function importJSON(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      return 'That file is not a valid backup.';
    }
    if (!d || !Array.isArray(d.profiles) || d.profiles.some((p) => !p || typeof p.name !== 'string' || !p.settings)) {
      return 'That file does not look like a Math Quest backup.';
    }
    d.profiles.forEach((p) => {
      p.id = p.id || 'p' + Math.random().toString(36).slice(2, 8);
      p.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings);
      p.stats = p.stats || {};
      p.munchers = p.munchers || { levels: 0, streak: 0 };
    });
    data = { version: 1, profiles: d.profiles, lastSaved: d.lastSaved || null };
    save();
    return null;
  }

  root.Store = {
    load,
    save,
    newProfile,
    remove,
    record,
    exportJSON,
    importJSON,
    get profiles() {
      return data.profiles;
    },
    get lastSaved() {
      return data.lastSaved;
    },
    get ok() {
      return ok;
    },
    find: (id) => data.profiles.find((p) => p.id === id),
  };
})(window);
