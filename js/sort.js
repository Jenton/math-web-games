/* Sort & Rule UI: send numbers through the gate, see what happens, then name the rule. */
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
    $('sortBack').addEventListener('click', exit);
    $('sortKnow').addEventListener('click', () => { Sfx.play('open'); showChoices(true); });
    $('sortKeep').addEventListener('click', () => showChoices(false));
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { n: 0, stars: 0 };
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
    S.p = MGS.makeSort(st.band, st.stars);
    S.tested = [];
    S.wrong = 0;
    S.out = new Set();
    $('sortNo').textContent = 'Puzzle ' + S.n + ' of ' + ROUND;
    $('sortPass').innerHTML = '';
    $('sortStop').innerHTML = '';
    $('sortGate').textContent = '🚪';
    $('sortMsg').textContent = 'Pick a number to send through the gate.';
    const tray = $('sortTray');
    tray.innerHTML = '';
    S.p.tray.forEach((v) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell num-card';
      b.textContent = v;
      b.addEventListener('click', () => test(v, b));
      tray.appendChild(b);
    });
    showChoices(false);
    update();
  }

  function update() {
    $('sortTests').textContent = '🔬 ' + S.tested.length + ' tested';
    const ready = S.tested.length >= MGS.MIN_TESTS;
    $('sortKnow').disabled = !ready;
    $('sortKnow').textContent = ready ? 'I know the rule!' : 'Test ' + (MGS.MIN_TESTS - S.tested.length) + ' more to guess the rule';
  }

  function test(v, btn) {
    if (!S || S.tested.includes(v)) return;
    S.tested.push(v);
    const ok = MGS.gate(S.p, v);
    Sfx.play(ok ? 'correct' : 'wrong');
    btn.disabled = true;
    btn.classList.add('used');
    const chip = document.createElement('span');
    chip.className = 'blk ' + (ok ? 'known' : 'mystery');
    chip.textContent = v;
    $(ok ? 'sortPass' : 'sortStop').appendChild(chip);
    $('sortGate').textContent = ok ? '✅' : '🚫';
    $('sortMsg').textContent = v + (ok ? ' went through!' : ' was stopped.');
    update();
  }

  function showChoices(on) {
    $('sortChoices').hidden = !on;
    $('sortTray').hidden = on;
    $('sortKnow').hidden = on;
    $('sortKeep').hidden = !on;
    if (!on) return;
    const box = $('sortOpts');
    box.innerHTML = '';
    S.p.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt-card';
      b.disabled = S.out.has(i);
      b.innerHTML = '<span class="o-t"></span>';
      b.querySelector('.o-t').textContent = o.text;
      b.addEventListener('click', () => choose(i, b));
      box.appendChild(b);
    });
  }

  function choose(i, btn) {
    if (!S) return;
    const prof = ctx.profile;
    if (i === S.p.correct) {
      const stars = MGS.starsFor(S.tested.length, S.wrong, S.p.tray.length);
      S.stars += stars;
      Store.record(prof, 'sort', true);
      Store.bump(Store.game(prof, 'sort'), 'levels');
      ctx.onSave();
      Sfx.play(stars === 3 ? 'solved' : 'win');
      const last = S.n >= ROUND;
      UI.panel({
        title: 'You cracked it! ' + '⭐'.repeat(stars),
        text: 'The gate lets through ' + S.p.rule.text + '. You tested ' + S.tested.length + ' of ' + S.p.tray.length + ' numbers.' + (last ? ' Round done: ' + S.stars + ' of ' + ROUND * 3 + ' stars.' : ''),
        btn: last ? 'Play another round' : 'Next puzzle',
        onBtn: last ? () => { S.n = 0; S.stars = 0; nextPuzzle(); } : nextPuzzle,
        btn2: last ? 'Back to setup' : null,
        onBtn2: exit,
      });
      return;
    }
    S.wrong++;
    S.out.add(i);
    Store.record(prof, 'sort', false);
    ctx.onSave();
    btn.disabled = true;
    const why = MGS.explainWrong(S.p, i, S.tested);
    if (S.wrong >= MGS.MAX_WRONG) {
      Sfx.play('lose');
      const last = S.n >= ROUND;
      UI.panel({
        title: 'Not quite',
        text: why + ' The secret rule was: ' + S.p.rule.text + '.',
        btn: last ? 'Play another round' : 'Next puzzle',
        onBtn: last ? () => { S.n = 0; S.stars = 0; nextPuzzle(); } : nextPuzzle,
        btn2: last ? 'Back to setup' : null,
        onBtn2: exit,
        bad: true,
      });
      return;
    }
    Sfx.play('wrong');
    UI.panel({ title: 'Not that one', text: why, btn: 'Keep going', onBtn: () => showChoices(false), bad: true });
  }

  root.Sort = { start };
})(window);
