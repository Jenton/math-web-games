/* Balance: the scale tips as you change the number for "?". Make it level. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ROUND = 5;
  let ctx = null;
  let S = null;
  let bound = false;

  function init() {
    if (bound) return;
    bound = true;
    $('balBack').addEventListener('click', exit);
    $('gMinus').addEventListener('click', () => set(S.guess - 1));
    $('gPlus').addEventListener('click', () => set(S.guess + 1));
    $('gBig-').addEventListener('click', () => set(S.guess - 10));
    $('gBig+').addEventListener('click', () => set(S.guess + 10));
    $('balCheck').addEventListener('click', lockIn);
    document.addEventListener('keydown', (e) => {
      if (!S || $('balance').hidden || !$('panel').hidden) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(S.guess + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(S.guess - 1); }
      else if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); lockIn(); }
    });
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    if (!profile.balance) profile.balance = { levels: 0 };
    S = { n: 0, firstTry: 0 };
    nextPuzzle();
  }

  function exit() {
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  function nextPuzzle() {
    const st = ctx.profile.settings;
    S.n++;
    S.p = MGP.makeBalance(st.band, st.stars);
    S.guess = 0;
    S.missed = false;
    $('balNo').textContent = 'Puzzle ' + S.n + ' of ' + ROUND;
    $('gBig-').hidden = $('gBig+').hidden = S.p.max <= 20;
    render();
  }

  function set(v) {
    if (!S) return;
    S.guess = Math.max(0, Math.min(S.p.max, v));
    render();
  }

  function blocks(side, v) {
    const frag = document.createDocumentFragment();
    const small = side.x > 6 ? ' sm' : '';
    for (let i = 0; i < side.x; i++) {
      const b = document.createElement('span');
      b.className = 'blk mystery' + small;
      b.textContent = v;
      frag.appendChild(b);
    }
    if (side.c > 0) {
      const b = document.createElement('span');
      b.className = 'blk known';
      b.textContent = side.c;
      frag.appendChild(b);
    }
    return frag;
  }

  function render() {
    const { p, guess } = S;
    const l = MGP.sideVal(p.L, guess);
    const r = MGP.sideVal(p.R, guess);
    const diff = l - r;
    const tilt = diff === 0 ? 0 : -Math.sign(diff) * Math.min(16, 4 + Math.abs(diff) * 1.2);
    $('scale').style.setProperty('--tilt', tilt + 'deg');
    $('scale').classList.toggle('level', diff === 0);
    [['panL', p.L], ['panR', p.R]].forEach(([id, side]) => {
      const el = $(id);
      el.innerHTML = '';
      el.appendChild(blocks(side, guess));
    });
    $('gVal').textContent = '? = ' + guess;
    $('balSums').textContent = 'Left ' + l + '  ·  Right ' + r + '   (' + p.text.replace('?', '?') + ')';
    $('gMinus').disabled = $('gBig-').disabled = guess <= 0;
    $('gPlus').disabled = $('gBig+').disabled = guess >= p.max;
  }

  function lockIn() {
    if (!S) return;
    const res = MGP.checkBalance(S.p, S.guess);
    const prof = ctx.profile;
    if (res.balanced) {
      Store.record(prof, 'balance', true);
      prof.balance.levels++;
      if (!S.missed) S.firstTry++;
      ctx.onSave();
      const last = S.n >= ROUND;
      UI.panel({
        title: S.missed ? 'Balanced! 🎉' : 'Balanced first try! 🌟',
        text: 'One ? weighs ' + S.guess + '. ' + res.msg + (last ? ' That is the round: ' + S.firstTry + ' of ' + ROUND + ' on the first try.' : ''),
        btn: last ? 'Play another round' : 'Next puzzle',
        onBtn: last ? () => { S.n = 0; S.firstTry = 0; nextPuzzle(); } : nextPuzzle,
        btn2: last ? 'Back to setup' : null,
        onBtn2: exit,
      });
    } else {
      S.missed = true;
      Store.record(prof, 'balance', false);
      ctx.onSave();
      UI.toast(res.msg, false);
    }
  }

  root.Balance = { start };
})(window);
