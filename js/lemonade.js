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
    const st = ctx.profile.settings;
    S.day++;
    S.jobs = M().makeDay(st.band, st.stars);
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

  function job() {
    const p = (S.p = S.jobs[S.i]);
    S.missed = false;
    S.done = false;
    $('lemNo').textContent = 'Day ' + S.day + ' · job ' + (S.i + 1) + ' of ' + S.jobs.length;
    $('lemText').textContent = p.text;
    $('lemWho').src = IMG + 'animals/' + ANIMALS[Math.floor(Math.random() * ANIMALS.length)] + '.png';
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
  }

  /** Record the attempt and, when right, show the result and move on. */
  function answer(res) {
    const p = S.p;
    Store.record(ctx.profile, M().skillOf(p.kind), res.ok);
    if (!res.ok) {
      S.missed = true;
      Sfx.play('wrong');
      say(res.msg, false);
      ctx.onSave();
      return false;
    }
    Sfx.play('correct');
    if (!S.missed) S.firstTry++;
    S.done = true;
    say((S.missed ? 'Got it! ' : 'First try! ') + res.msg, true);
    ctx.onSave();
    const last = S.i + 1 >= S.jobs.length;
    const go = $('lemGo');
    go.hidden = false;
    go.textContent = last ? 'Close the stand' : 'Next job';
    go.focus();
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
    const paint = () => {
      tray.innerHTML = '';
      given.forEach((c, k) => {
        const b = coinBtn(c, true);
        b.setAttribute('aria-label', 'Take back ' + M().money(c));
        b.addEventListener('click', () => { if (S.done) return; given.splice(k, 1); paint(); });
        tray.appendChild(b);
      });
      if (!given.length) tray.appendChild(el('span', 'note', 'Tap coins to add them to the change.'));
      total.textContent = 'Change so far: ' + M().money(given.reduce((a, b) => a + b, 0));
    };
    const box = el('div', 'lem-coins');
    p.coins.forEach((c) => {
      const b = coinBtn(c);
      b.setAttribute('aria-label', 'Add ' + M().money(c));
      b.addEventListener('click', () => { if (S.done) return; given.push(c); given.sort((a, b2) => b2 - a); paint(); });
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
    const set = (v) => { if (S.done) return; n = Math.max(0, Math.min(p.max, v)); paint(); };
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
        if (ok) b.classList.add('on');
        else b.disabled = true;
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
    UI.panel({
      icon: perfect ? 'medals/m3' : 'medals/m1',
      title: perfect ? 'A perfect day! 🌟' : 'Day ' + S.day + ' done! 🎉',
      text: 'You got ' + S.firstTry + ' of ' + S.jobs.length + ' jobs right on the first try. ' + (perfect ? 'Every customer left happy.' : 'Practice makes the stand better every day.'),
      btn: 'Open for another day',
      onBtn: newDay,
      btn2: 'Back to setup',
      onBtn2: exit,
    });
  }

  root.Lemonade = { start };
})(window);
