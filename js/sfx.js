/* Sound for every game: Sfx.play('correct'). Games never name files; the map below does.
 * Kenney CC0 sounds converted to M4A (see tools/make_kenney_assets.sh). The mute choice is a per-device preference kept in
 * localStorage under its own key (not in the game save), and everything fails silent: no audio never breaks a game. */
(function (root) {
  'use strict';
  const BASE = 'assets/kenney/';
  const KEY = 'mathQuest.sound';
  const VOL = { sfx: 0.5, voice: 0.8, music: 0.18 };
  // name -> file (or several to pick from at random so repeats do not sound robotic)
  const MAP = {
    correct: ['sfx/correct', 'sfx/correct2'], wrong: ['sfx/wrong', 'sfx/wrong2'], click: ['sfx/click'], open: ['sfx/open'],
    close: ['sfx/close'], step: ['sfx/step'], solved: ['sfx/solved'], level: ['sfx/level'], place: ['sfx/place'], card: ['sfx/card'],
    lose: ['sfx/lose'], hurt: ['sfx/hurt'], hit: ['sfx/hit'], flip: ['sfx/flip'], win: ['sfx/win00', 'sfx/win03', 'sfx/win07'],
  };
  let muted = false;
  let musicOn = false;
  let music = null;
  const cache = {};
  const listeners = [];
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) { /* storage blocked: default on */ }

  function load(file) {
    if (!cache[file]) {
      const a = new Audio(BASE + file + '.m4a');
      a.preload = 'auto';
      cache[file] = a;
    }
    return cache[file];
  }

  function fire(file, vol) {
    if (muted) return;
    try {
      const a = load(file).cloneNode(true); // clone so quick repeats overlap instead of cutting off
      a.volume = vol;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function play(name) {
    const files = MAP[name];
    if (files) fire(pick(files), VOL.sfx);
  }

  /** Speak a small number or phrase: Sfx.say(7), Sfx.say('level_up'). Only the recorded words exist; others are ignored. */
  function say(word) {
    const w = String(word);
    if (/^(?:[1-9]|10|correct|level_up|congratulations|ready|go)$/.test(w)) fire('voice/' + w, VOL.voice);
  }

  function setMusic(on) {
    musicOn = !!on;
    try {
      if (musicOn && !muted) {
        if (!music) { music = new Audio(BASE + 'music/farm.m4a'); music.loop = true; }
        music.volume = VOL.music;
        const p = music.play();
        if (p && p.catch) p.catch(() => {});
      } else if (music) music.pause();
    } catch (e) { /* ignore */ }
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) { /* ignore */ }
    setMusic(musicOn);
    listeners.forEach((f) => f(muted));
  }

  /** Warm the files after the first tap (browsers need a gesture before audio), so the first sound is not late. */
  function preload() {
    Object.keys(MAP).forEach((k) => MAP[k].forEach(load));
  }
  document.addEventListener('pointerdown', function once() {
    document.removeEventListener('pointerdown', once);
    preload();
  });

  root.Sfx = { play, say, setMuted, isMuted: () => muted, toggle: () => setMuted(!muted), setMusic, onChange: (f) => listeners.push(f) };
})(window);
