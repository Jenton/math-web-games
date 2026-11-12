/* Lemonade Stand screens. The jobs come from js/shop.js (pure logic). One day is four jobs; wrong answers show the arithmetic
 * and let you try again, and a job only counts as "first try" if you got it right straight away. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const M = () => root.MGS;
  let ctx = null;
  let S = null;
  let bound = false;
  const IMG = 'assets/kenney/lemonade/';
  const ANIMALS = ['bear', 'chick', 'cow', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'hippo', 'monkey', 'owl', 'panda', 'penguin', 'pig', 'rabbit', 'zebra'];
  const COIN_ART = { 1: 'coinBronze', 5: 'coinSilver', 10: 'coinSilver', 25: 'coinGold', 100: 'cash', 500: 'cash' };
  const coinBtn = (c, small) => {
    const b = el('button', 'coin' + (small ? ' small' : '') + ' c' + c);
    b.type = 'button';
    const im = el('img');
    im.src = IMG + COIN_ART[c] + '.png';
    im.alt = '';
    b.append(im, el('span', null, M().money(c)));
    return b;
  };

  function init() {
    if (bound) return;
    bound = true;
    $('lemBack').addEventListener('click', exit);
    $('lemGo').addEventListener('click', () => S && S.go && S.go());
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { day: 0 };
    newDay();
  }

  function exit() {
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  function newDay() {
    const st = Store.level(ctx.profile, 'lemonade');
    S.day++;
    S.day_ = M().makeDay(st.band, st.stars);
    S.jobs = S.day_.jobs;
    S.queue = [];
    S.waiting = [];
    S.i = 0;
    S.firstTry = 0;
    job();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const randAnimal = () => ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const EMOTE = { happy: 'assets/kenney/ui/emote_faceHappy.png', sad: 'assets/kenney/ui/emote_question.png', stars: 'assets/kenney/ui/emote_stars.png', heart: 'assets/kenney/ui/emote_heart.png' };

  function paintQueue() {
    const q = $('lemQueue');
    q.innerHTML = '';
    S.waiting.forEach((a, i) => {
      const im = el('img', 'lem-wait');
      im.src = IMG + 'animals/' + a + '.png';
      im.alt = '';
      if (i < (S.queueShown || 0)) im.style.animation = 'none'; // already in line: do not replay the entrance on every job
      else im.style.animationDelay = (i - (S.queueShown || 0)) * 0.12 + 's';
      q.appendChild(im);
    });
    S.queueShown = S.waiting.length;
    const more = S.day_.cups - S.waiting.length - (S.served || 0);
    if (S.waiting.length && more > 0 && S.i >= 1) q.appendChild(el('span', 'lem-more', '+' + more));
  }

  /** The customer at the counter for this job. Customers in the line come from the day's demand: the cups you will sell. */
  function arrive(p) {
    const who = $('lemWho');
    const emote = $('lemEmote');
    emote.hidden = true;
    who.classList.remove('leave', 'walk');
    if (p.kind === 'price') {
      S.waiting = Array.from({ length: Math.min(S.day_.cups, 6) }, randAnimal);
      S.served = 0;
      S.queueShown = 0;
      who.src = IMG + 'animals/' + randAnimal() + '.png';
    } else if (p.kind === 'change' && S.waiting.length) {
      who.src = IMG + 'animals/' + S.waiting.shift() + '.png';
      S.served = (S.served || 0) + 1;
    } else {
      who.src = IMG + 'animals/' + randAnimal() + '.png';
    }
    paintQueue();
    void who.offsetWidth; // restart the walk-in animation
    who.classList.add('walk');
  }

  function react(kind) {
    const e = $('lemEmote');
    e.src = EMOTE[kind];
    e.hidden = false;
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  }

  function job() {
    const p = (S.p = S.jobs[S.i]);
    S.missed = false;
    S.done = false;
    $('lemNo').textContent = 'Day ' + S.day + ' · job ' + (S.i + 1) + ' of ' + S.jobs.length;
    $('lemText').textContent = p.text;
    arrive(p);
    $('lemMsg').textContent = '';
    $('lemMsg').className = 'sums';
    const body = $('lemBody');
    body.innerHTML = '';
    if (p.kind === 'change') drawChange(p, body);
    else if (p.kind === 'stock') drawStock(p, body);
    else drawPrice(p, body);
  }

  function say(text, good) {
    const m = $('lemMsg');
    m.textContent = text;
    m.className = 'sums ' + (good ? 'lem-good' : 'lem-bad');
    UI.flash(m, 'in', 220);
  }

  /** Record the attempt and, when right, show the result and move on. */
  function answer(res) {
    const p = S.p;
    Store.record(ctx.profile, M().skillOf(p.kind), res.ok);
    if (!res.ok) {
      S.missed = true;
      Sfx.play('wrong');
      react('sad');
      say(res.msg, false);
      ctx.onSave();
      return false;
    }
    Sfx.play('correct');
    react(p.kind === 'change' ? 'happy' : 'stars');
    if (p.kind === 'change') $('lemWho').classList.add('leave');
    if (!S.missed) S.firstTry++;
    S.done = true;
    say((S.missed ? 'Got it! ' : 'First try! ') + res.msg, true);
    ctx.onSave();
    const last = S.i + 1 >= S.jobs.length;
    const go = $('lemGo');
    go.hidden = false;
    go.textContent = last ? 'Close the stand' : 'Next job';
    go.focus();
    UI.flash(go, 'attn', 440);
    S.go = last ? endDay : () => { S.i++; job(); };
    return true;
  }

  /* ---------- make change ---------- */

  function drawChange(p, body) {
    $('lemTitle').textContent = 'Make change';
    $('lemGo').hidden = false;
    $('lemGo').textContent = 'Give change';
    const tray = el('div', 'lem-tray');
    const total = el('div', 'lem-total');
    const given = [];
    let fresh = null; // value of the coin just added, so only it drops into the tray
    const paint = () => {
      tray.innerHTML = '';
      given.forEach((c, k) => {
        const b = coinBtn(c, true);
        b.setAttribute('aria-label', 'Take back ' + M().money(c));
        b.addEventListener('click', () => { if (S.done) return; given.splice(k, 1); paint(); });
        if (fresh === c) { UI.flash(b, 'drop', 240); fresh = null; }
        tray.appendChild(b);
      });
      if (!given.length) tray.appendChild(el('span', 'note', 'Tap coins to add them to the change.'));
      const sum = 'Change so far: ' + M().money(given.reduce((a, b) => a + b, 0));
      if (total.textContent !== sum) { total.textContent = sum; UI.flash(total, 'tick', 180); }
    };
    const box = el('div', 'lem-coins');
    p.coins.forEach((c) => {
      const b = coinBtn(c);
      b.setAttribute('aria-label', 'Add ' + M().money(c));
      b.addEventListener('click', () => { if (S.done) return; given.push(c); given.sort((a, b2) => b2 - a); fresh = c; UI.flash(b, 'tap', 150); paint(); });
      box.appendChild(b);
    });
    const clear = el('button', 'btn ghost small', 'Clear');
    clear.type = 'button';
    clear.addEventListener('click', () => { if (S.done) return; given.length = 0; paint(); });
    body.append(box, tray, total, clear);
    paint();
    S.go = () => { if (!S.done) answer(M().checkChange(p, given)); };
  }

  /* ---------- stock up ---------- */

  function drawStock(p, body) {
    $('lemTitle').textContent = 'Stock up';
    $('lemGo').hidden = false;
    $('lemGo').textContent = 'Buy ' + p.unit + 's';
    let n = 0;
    const row = el('div', 'guess');
    const minus = el('button', 'btn ghost big', '−');
    const plus = el('button', 'btn ghost big', '+');
    const val = el('div', 'gval');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', 'one fewer');
    plus.setAttribute('aria-label', 'one more');
    const art = el('div', 'lem-stock');
    art.setAttribute('aria-hidden', 'true');
    const paint = () => {
      val.textContent = n + ' ' + p.unit + (n === 1 ? '' : 's');
      minus.disabled = n <= 0;
      plus.disabled = n >= p.max;
      art.innerHTML = '';
      for (let k = 0; k < Math.min(n, 40); k++) {
        if (p.unit === 'lemon') art.appendChild(el('span', 'lem-lemon', '🍋'));
        else { const im = el('img'); im.src = IMG + 'pitcher.png'; im.alt = ''; art.appendChild(im); }
      }
    };
    const set = (v) => {
      if (S.done) return;
      const was = n;
      n = Math.max(0, Math.min(p.max, v));
      paint();
      if (n !== was) UI.flash(val, 'tick', 180);
      if (n > was && n <= 40 && art.lastChild) UI.flash(art.lastChild, 'drop', 240); // only a genuinely new item drops in (the icon row stops growing at 40)
    };
    minus.addEventListener('click', () => set(n - 1));
    plus.addEventListener('click', () => set(n + 1));
    row.append(minus, val, plus);
    body.append(row, art);
    paint();
    S.go = () => { if (!S.done) answer(M().checkStock(p, n)); };
  }

  /* ---------- set the price ---------- */

  function drawPrice(p, body) {
    $('lemTitle').textContent = 'Set the price';
    $('lemGo').hidden = true;
    const grid = el('div', 'lem-prices');
    p.options.forEach((o, i) => {
      const b = el('button', 'opt-card');
      b.type = 'button';
      const gl = el('img', 'lem-glass');
      gl.src = IMG + 'glass.png';
      gl.alt = '';
      b.append(gl, el('span', 'o-t', M().money(o.price) + ' a cup'), el('span', 'o-d', 'You would sell ' + o.sold + ' cups'));
      b.addEventListener('click', () => {
        if (S.done || b.disabled) return;
        const ok = answer(M().checkPrice(p, i));
        if (ok) { b.classList.add('on'); UI.flash(b, 'lem-pop', 260); } else { UI.flash(b, 'lem-shake', 300); b.disabled = true; }
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
    body.appendChild(el('p', 'note', 'Profit = cups sold × (price − cost to make)' + (p.fixed ? ', minus the sign.' : '.')));
    S.go = null;
  }

  /* ---------- end of day ---------- */

  function endDay() {
    const g = Store.game(ctx.profile, 'lemonade');
    Store.bump(g, 'days');
    const perfect = S.firstTry === S.jobs.length;
    if (perfect) Store.bump(g, 'perfect');
    ctx.onSave();
    Sfx.play('win');
    const scene = document.querySelector('.lem-scene');
    if (scene && !UI.reduced()) UI.burst(scene, perfect ? 12 : 6);
    UI.panel({
      icon: perfect ? 'medals/m3' : 'medals/m1',
      title: perfect ? 'A perfect day! 🌟' : 'Day ' + S.day + ' done! 🎉',
      text: 'You served ' + S.day_.cups + ' cups at ' + M().money(S.day_.price) + '. Cups × (price − ' + M().money(S.day_.cost) + ' to make)' + (S.day_.fixed ? ' − ' + M().money(S.day_.fixed) + ' for the sign' : '') + ' = ' + M().money(S.day_.profit) + ' profit today. You got ' + S.firstTry + ' of ' + S.jobs.length + ' jobs right on the first try.' + (perfect ? ' Every customer left happy.' : ''),
      btn: 'Open for another day',
      onBtn: newDay,
      btn2: 'Back to setup',
      onBtn2: exit,
    });
  }

  root.Lemonade = { start };
})(window);
