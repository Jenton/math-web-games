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
    $('gMinus').addEventListener('click', () => { set(S.guess - 1); });
    $('gPlus').addEventListener('click', () => { set(S.guess + 1); });
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
    S = { n: 0, firstTry: 0, solved: 0 };
    nextPuzzle();
  }

  function exit() {
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  function nextPuzzle() {
    const st = Store.level(ctx.profile, 'balance');
    S.n++;
    S.p = MGP.makeBalance(st.band, st.stars);
    S.guess = 0;
    S.tries = MGP.BAL_TRIES;
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
      b.innerHTML = '<span class="n"></span>';
      b.firstChild.textContent = v;
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

  /* The scale does NOT tip while you change the number, and no totals are shown: you have to work out the
   * weight, then lock it in. It only tips to answer a lock-in, and you get a few tries (guessing is not a strategy). */
  function render(reveal) {
    const { p, guess } = S;
    const tilt = reveal ? -Math.sign(reveal.diff) * Math.min(14, 6 + Math.abs(reveal.diff) * 0.6) : 0;
    $('scale').style.setProperty('--tilt', tilt + 'deg');
    $('scale').classList.toggle('level', !!reveal && reveal.diff === 0);
    [['panL', p.L], ['panR', p.R]].forEach(([id, side]) => {
      const el = $(id);
      el.innerHTML = '';
      el.appendChild(blocks(side, '?'));
    });
    $('gVal').textContent = '? = ' + guess;
    $('balSums').textContent = p.text + '   ·   ' + S.tries + (S.tries === 1 ? ' try left' : ' tries left');
    $('gMinus').disabled = $('gBig-').disabled = guess <= 0;
    $('gPlus').disabled = $('gBig+').disabled = guess >= p.max;
  }

  function lockIn() {
    if (!S) return;
    const res = MGP.checkBalance(S.p, S.guess);
    const prof = ctx.profile;
    render(res);
    const last = S.n >= ROUND;
    const again = () => { S.n = 0; S.firstTry = 0; S.solved = 0; nextPuzzle(); };
    if (res.balanced) {
      Sfx.play('solved');
      setTimeout(() => Sfx.play('win'), 350);
      Store.record(prof, 'balance', true);
      Store.bump(Store.game(prof, 'balance'), 'levels');
      if (!S.missed) S.firstTry++;
      S.solved++;
      ctx.onSave();
      UI.panel({
        icon: S.missed ? 'medals/m1' : 'medals/m3',
        title: S.missed ? 'Balanced! 🎉' : 'Balanced first try! 🌟',
        text: 'One ? weighs ' + S.guess + '. Both sides weigh ' + res.l + '.' + (last ? ' That is the round: ' + S.solved + ' of ' + ROUND + ' solved, ' + S.firstTry + ' on the first try.' : ''),
        btn: last ? 'Play another round' : 'Next puzzle',
        onBtn: last ? again : nextPuzzle,
        btn2: last ? 'Back to setup' : null,
        onBtn2: exit,
      });
      return;
    }
    S.missed = true;
    S.tries--;
    Store.record(prof, 'balance', false);
    ctx.onSave();
    if (S.tries > 0) {
      Sfx.play('wrong');
      const heavy = res.diff > 0 ? 'left' : 'right';
      $('balSums').textContent = 'The ' + heavy + ' side is heavier. ' + S.tries + (S.tries === 1 ? ' try left.' : ' tries left.') + ' Think it through before you guess again.';
      return;
    }
    Sfx.play('lose');
    UI.panel({
      title: 'Out of tries',
      text: MGP.balanceSteps(S.p).join(' ') + (last ? ' That is the round: ' + S.solved + ' of ' + ROUND + ' solved.' : ''),
      btn: last ? 'Play another round' : 'Next puzzle',
      onBtn: last ? again : nextPuzzle,
      btn2: last ? 'Back to setup' : null,
      onBtn2: exit,
      bad: true,
    });
  }

  root.Balance = { start };
})(window);
