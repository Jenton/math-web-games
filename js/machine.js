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
    $('macUndo').addEventListener('click', () => { if (S && !S.locked && S.path.length) { S.path.pop(); render(true, false); } });
    $('macReset').addEventListener('click', () => { if (S && !S.locked) { S.path = []; render(true, false); } });
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
    const st = Store.cell(ctx.profile, 'machine', { first: S.n === 0 }); // the player's grade on the difficulty ladder; sometimes a stretch (bonus) puzzle
    S.n++;
    S.bonus = st.stretch;
    S.p = MGP.makeMachine(st.band, st.stars);
    S.path = [];
    S.counted = false;
    S.locked = false;
    $('macNo').textContent = 'Puzzle ' + S.n + ' of ' + ROUND + (S.bonus ? ' · Bonus challenge' : '');
    $('macPar').textContent = '🎯 Best: ' + S.p.par + (S.p.par === 1 ? ' step' : ' steps');
    $('macTitle').textContent = 'Turn ' + MGP.fmt(S.p.start) + ' into ' + MGP.fmt(S.p.target);
    $('macTarget').textContent = MGP.fmt(S.p.target);
    UI.flash($('macTarget'), 'pop-in', 300);
    UI.flash($('macVal'), 'pop-in', 300);
    const ops = $('macOps');
    ops.innerHTML = '';
    S.p.ops.forEach((op, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'op-card';
      b.textContent = op.label;
      b.style.setProperty('--d', i * 60 + 'ms'); // cards drop in one after another (delay applies only to the drop-in)
      b.addEventListener('click', () => press(i));
      ops.appendChild(b);
      UI.flash(b, 'enter', 220 + i * 60 + 40);
    });
    render();
  }

  function values() {
    const vs = [S.p.start];
    S.path.forEach((i) => vs.push(MGP.stepMachine(S.p, i, vs[vs.length - 1])));
    return vs;
  }

  /** animate: roll the number; added: the newest path line slides in (not on Undo / Start over). */
  function render(animate, added) {
    const vs = values();
    const cur = vs[vs.length - 1];
    const prev = S.shown;
    S.shown = cur;
    $('macVal').textContent = MGP.fmt(cur);
    if (animate && prev !== undefined && prev !== cur) {
      // the number rolls in from below when it grows and from above when it shrinks: motion that says which way it went
      $('macVal').style.setProperty('--from', cur > prev ? '38%' : '-38%');
      UI.flash($('macVal'), 'roll', 260);
    }
    const path = $('macPath');
    path.innerHTML = '';
    S.path.forEach((i, k) => {
      const li = document.createElement('li');
      li.textContent = MGP.fmt(vs[k]) + '  ' + S.p.ops[i].label + '  =  ' + MGP.fmt(vs[k + 1]);
      if (added && k === S.path.length - 1) li.className = 'new';
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
    if (!S || S.locked) return;
    Sfx.play('card');
    S.path.push(i);
    UI.flash($('macOps').children[i], 'used', 160);
    UI.flash(document.querySelector('.mac-arrow'), 'nudge', 200);
    render(true, true);
    const vs = values();
    if (vs[vs.length - 1] !== S.p.target) {
      if (S.path.length >= MAX_STEPS) UI.toast('That is a lot of steps. Try Undo or Start over.', false);
      return;
    }
    const steps = S.path.length;
    const raw = steps <= S.p.par ? 3 : steps <= S.p.par + 1 ? 2 : 1;
    const stars = S.bonus ? Math.max(2, raw) : raw; // a bonus (stretch) puzzle always earns at least two stars
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
    S.locked = true; // no extra taps during the celebration; a timer (not an animation event) releases the panel
    const calm = UI.reduced();
    if (!calm) {
      UI.flash($('macTarget'), 'hit', 500);
      UI.burst($('macTarget'), stars === 3 ? 12 : 8);
    }
    const game = S;
    setTimeout(() => S === game && UI.panel({
      icon: 'medals/m' + stars,
      title: 'Target reached! ' + '⭐'.repeat(stars),
      text: steps + (steps === 1 ? ' step' : ' steps') + (steps <= S.p.par ? ': that is the best possible!' : '. The best is ' + S.p.par + '. Want to try for fewer next time?') + (S.bonus && raw < 2 ? ' (A bonus challenge from the next grade earns at least two stars.)' : '') + (last ? ' Round done: ' + S.stars + ' of ' + ROUND * 3 + ' stars.' : ''),
      btn: last ? 'Play another round' : 'Next puzzle',
      onBtn: last ? () => { S.n = 0; S.stars = 0; nextPuzzle(); } : nextPuzzle,
      btn2: 'Try this one again',
      onBtn2: () => { S.stars -= stars; S.path = []; S.locked = false; render(true, false); },
    }), calm ? 0 : 380);
  }

  root.Machine = { start };
})(window);
