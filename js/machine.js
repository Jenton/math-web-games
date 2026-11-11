/* Machine Builder: tap operation cards to turn the start number into the target in few steps. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ROUND = 5;
  const MAX_STEPS = 8;
  let ctx = null;
  let S = null;
  let bound = false;

  function init() {
    if (bound) return;
    bound = true;
    $('macBack').addEventListener('click', exit);
    $('macUndo').addEventListener('click', () => { if (S && S.path.length) { S.path.pop(); render(); } });
    $('macReset').addEventListener('click', () => { if (S) { S.path = []; render(); } });
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
    S.p = MGP.makeMachine(st.band, st.stars);
    S.path = [];
    S.counted = false;
    $('macNo').textContent = 'Puzzle ' + S.n + ' of ' + ROUND;
    $('macPar').textContent = '🎯 Best: ' + S.p.par + (S.p.par === 1 ? ' step' : ' steps');
    $('macTitle').textContent = 'Turn ' + MGP.fmt(S.p.start) + ' into ' + MGP.fmt(S.p.target);
    $('macTarget').textContent = MGP.fmt(S.p.target);
    const ops = $('macOps');
    ops.innerHTML = '';
    S.p.ops.forEach((op, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'op-card';
      b.textContent = op.label;
      b.addEventListener('click', () => press(i));
      ops.appendChild(b);
    });
    render();
  }

  function values() {
    const vs = [S.p.start];
    S.path.forEach((i) => vs.push(MGP.stepMachine(S.p, i, vs[vs.length - 1])));
    return vs;
  }

  function render() {
    const vs = values();
    const cur = vs[vs.length - 1];
    $('macVal').textContent = MGP.fmt(cur);
    const path = $('macPath');
    path.innerHTML = '';
    S.path.forEach((i, k) => {
      const li = document.createElement('li');
      li.textContent = MGP.fmt(vs[k]) + '  ' + S.p.ops[i].label + '  =  ' + MGP.fmt(vs[k + 1]);
      path.appendChild(li);
    });
    if (!S.path.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Your steps will show up here.';
      path.appendChild(li);
    }
    [...$('macOps').children].forEach((b, i) => {
      const ok = MGP.stepMachine(S.p, i, cur) !== null && S.path.length < MAX_STEPS;
      b.disabled = !ok;
      b.title = ok ? '' : S.path.length >= MAX_STEPS ? 'Too many steps. Undo or start over.' : "Can't use this here (not a whole number, or too big).";
    });
    $('macUndo').disabled = $('macReset').disabled = !S.path.length;
  }

  function press(i) {
    if (!S) return;
    Sfx.play('card');
    S.path.push(i);
    render();
    const vs = values();
    if (vs[vs.length - 1] !== S.p.target) {
      if (S.path.length >= MAX_STEPS) UI.toast('That is a lot of steps. Try Undo or Start over.', false);
      return;
    }
    const steps = S.path.length;
    const stars = steps <= S.p.par ? 3 : steps <= S.p.par + 1 ? 2 : 1;
    const prof = ctx.profile;
    Store.record(prof, 'machine', true);
    if (!S.counted) {
      S.counted = true;
      Store.bump(Store.game(prof, 'machine'), 'levels'); // counted once per puzzle: saved counters can only go up
    }
    S.stars += stars;
    Sfx.play('win');
    if (stars === 3) setTimeout(() => Sfx.say('correct'), 700);
    ctx.onSave();
    const last = S.n >= ROUND;
    UI.panel({
      icon: 'medals/m' + stars,
      title: 'Target reached! ' + '⭐'.repeat(stars),
      text: steps + (steps === 1 ? ' step' : ' steps') + (steps <= S.p.par ? ': that is the best possible!' : '. The best is ' + S.p.par + '. Want to try for fewer next time?') + (last ? ' Round done: ' + S.stars + ' of ' + ROUND * 3 + ' stars.' : ''),
      btn: last ? 'Play another round' : 'Next puzzle',
      onBtn: last ? () => { S.n = 0; S.stars = 0; nextPuzzle(); } : nextPuzzle,
      btn2: 'Try this one again',
      onBtn2: () => { S.stars -= stars; S.path = []; render(); },
    });
  }

  root.Machine = { start };
})(window);
