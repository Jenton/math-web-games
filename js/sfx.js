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
    correct: ['sfx/correct'], wrong: ['sfx/wrong'], // one fixed sound each: kids learn "coin ding = right", so no random variants here
    click: ['sfx/click'], open: ['sfx/open'],
    close: ['sfx/close'], step: ['sfx/step'], solved: ['sfx/solved'], level: ['sfx/level'], place: ['sfx/place'], card: ['sfx/card'],
    lose: ['sfx/lose'], hurt: ['sfx/hurt'], hit: ['sfx/hit'], flip: ['sfx/flip'], win: ['sfx/win00', 'sfx/win08'],
  };
  let muted = false;
  let musicOn = false;
  let music = null;
  const listeners = [];
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) { /* storage blocked: default on */ }

  /* Sounds are decoded once into memory and played through the Web Audio API. Cloning <audio> elements (what this used to do)
   * is unreliable on iPad/iPhone Safari: each clone can reload the file, so a sound fired right after another can arrive late or never.
   * If Web Audio is missing, it falls back to plain <audio> elements. */
  const AC = root.AudioContext || root.webkitAudioContext;
  let ac = null;
  const buffers = {}; // file -> AudioBuffer
  const loading = {}; // file -> promise
  const media = {}; // fallback: file -> <audio>
  let lastLoud = 0; // when the last important sound started (to keep footsteps from masking it)
  let lastStep = 0;

  function ctx() {
    if (!AC) return null;
    if (!ac) { try { ac = new AC(); } catch (e) { ac = null; } }
    return ac;
  }

  function load(file) {
    const c = ctx();
    if (!c) return Promise.resolve(null);
    if (buffers[file]) return Promise.resolve(buffers[file]);
    if (!loading[file]) {
      loading[file] = fetch(BASE + file + '.m4a')
        .then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, no) => {
          // decodeAudioData also returns its own promise; handle it too, or a browser that cannot decode AAC logs an unhandled rejection on every sound
          const p = c.decodeAudioData(data, ok, no);
          if (p && p.catch) p.catch(() => {});
        }))
        .then((buf) => (buffers[file] = buf))
        .catch(() => { delete loading[file]; return null; });
    }
    return loading[file];
  }

  function fire(file, vol) {
    if (muted) return;
    try {
      const c = ctx();
      if (c) {
        if (c.state === 'suspended') c.resume();
        const buf = buffers[file];
        if (!buf) { // not decoded yet (first moments after the first tap): play it as soon as it is ready, unless that is too late to matter
          const asked = Date.now();
          load(file).then((b) => { if (b && Date.now() - asked < 600) fire(file, vol); });
          return;
        }
        const src = c.createBufferSource();
        const g = c.createGain();
        g.gain.value = vol;
        src.buffer = buf;
        src.connect(g);
        g.connect(c.destination);
        src.start(0);
        return;
      }
      const a = media[file] || (media[file] = new Audio(BASE + file + '.m4a'));
      a.volume = vol;
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function play(name) {
    const files = MAP[name];
    if (!files) return;
    const now = Date.now();
    if (name === 'step') {
      // footsteps are low priority: never right on top of a result sound, and never faster than a walking pace
      if (now - lastLoud < 220 || now - lastStep < 90) return;
      lastStep = now;
    } else if (name !== 'click') {
      lastLoud = now;
    }
    fire(pick(files), VOL.sfx);
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

  /** Browsers only allow audio after a tap or key press: start the audio engine then and decode every sound up front. */
  let warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    const c = ctx();
    if (c && c.state === 'suspended') c.resume();
    Object.keys(MAP).forEach((k) => MAP[k].forEach(load));
    ['voice/correct', 'voice/level_up'].concat(range10()).forEach(load);
  }
  const range10 = () => Array.from({ length: 10 }, (_, i) => 'voice/' + (i + 1));
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, warm, { passive: true }));

  root.Sfx = { play, say, setMuted, isMuted: () => muted, toggle: () => setMuted(!muted), setMusic, onChange: (f) => listeners.push(f) };
})(window);
