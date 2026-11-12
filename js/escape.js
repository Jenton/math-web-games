/* Escape Room screen: a pixel dungeon room with three chests. Tap a chest and the hero walks to it; solve its lock and it opens.
 * Open all three and the exit door opens and the hero walks out. Lock puzzles come from js/elogic.js (pure logic). */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const IMG = 'assets/kenney/escape/';
  const COLS = 9;
  const ROWS = 6;
  const CHEST_COLS = [2, 4, 6];
  const CHEST_ROW = 3;
  const DOOR = [4, 1];
  const FLOORS = { Wood: [48, 49, 50], Metal: [0, 0, 0], Marble: [48, 50, 49] };
  const DECOR = { Wood: [[0, 1, 63], [8, 1, 75], [0, 4, 82], [8, 4, 82]], Metal: [[0, 1, 54], [8, 1, 55], [0, 4, 64], [8, 4, 82]], Marble: [[0, 1, 82], [8, 1, 82], [0, 4, 89], [8, 4, 89]] };
  let ctx = null;
  let S = null;
  let bound = false;
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(() => { if (S) fn(); }, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.splice(0).forEach(clearTimeout); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const tile = (n) => IMG + 't' + n + '.png';
  const place = (e, c, r) => { e.style.left = (c / COLS) * 100 + '%'; e.style.top = (r / ROWS) * 100 + '%'; };
  const sprite = (n, c, r, cls) => { const i = el('img', 'esc-t ' + (cls || '')); i.src = tile(n); i.alt = ''; i.draggable = false; place(i, c, r); return i; };

  function init() {
    if (bound) return;
    bound = true;
    $('escBack').addEventListener('click', exit);
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { n: 0, stars: 0 };
    newRoom();
  }

  function exit() {
    clearTimers();
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  function newRoom() {
    clearTimers();
    const st = Store.level(ctx.profile, 'escape');
    S.n++;
    S.room = ESC.makeRoom(st.band, st.stars, S.n);
    S.solved = S.room.locks.map(() => false);
    S.slips = 0;
    S.active = -1;
    S.busy = false;
    S.fails = 0;
    $('escNo').textContent = 'Room ' + S.n;
    $('escStory').textContent = S.room.theme.name + ': ' + S.room.theme.story;
    buildScene();
    paintLocks();
    selectLock(0);
  }

  /* ---------- the room ---------- */

  function buildScene() {
    const th = S.room.theme;
    const scene = $('escScene');
    scene.innerHTML = '';
    scene.dataset.theme = th.tile;
    const floor = FLOORS[th.tile] || FLOORS.Wood;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const n = r === 0 ? 40 : r === 1 ? 28 : floor[(c * 3 + r * 5) % 3];
        scene.appendChild(sprite(n, c, r));
      }
    }
    (DECOR[th.tile] || []).forEach(([c, r, n]) => scene.appendChild(sprite(n, c, r, 'esc-decor')));
    [1, 7].forEach((c) => scene.appendChild(sprite(29, c, 1, 'esc-torch')));
    S.door = sprite(46, DOOR[0], DOOR[1], 'esc-door');
    scene.appendChild(S.door);
    S.chests = S.room.locks.map((lock, i) => {
      const b = el('button', 'esc-chest');
      b.type = 'button';
      b.setAttribute('aria-label', lock.title + ' ' + (i + 1));
      place(b, CHEST_COLS[i], CHEST_ROW);
      const im = el('img');
      im.src = tile(89);
      im.alt = '';
      im.draggable = false;
      b.appendChild(im);
      b.appendChild(el('span', 'esc-num', String(i + 1)));
      b.addEventListener('click', () => { if (!S.busy && !S.solved[i]) selectLock(i); });
      scene.appendChild(b);
      return b;
    });
    S.hero = el('div', 'esc-hero');
    const hi = el('img');
    hi.src = tile(96);
    hi.alt = '';
    hi.draggable = false;
    S.hero.appendChild(hi);
    scene.appendChild(S.hero);
    S.pos = [4, 5];
    place(S.hero, 4, 5);
  }

  function walkTo(c, r, done) {
    const dist = Math.abs(S.pos[0] - c) + Math.abs(S.pos[1] - r);
    S.pos = [c, r];
    S.hero.classList.add('walking');
    place(S.hero, c, r);
    for (let i = 1; i <= Math.min(dist, 4); i++) later(() => Sfx.play('step'), i * 160);
    later(() => { S.hero.classList.remove('walking'); if (done) done(); }, 120 + dist * 90);
  }

  function paintLocks() {
    $('escLocks').textContent = S.solved.map((s) => (s ? '🔓' : '🔒')).join(' ');
    S.chests.forEach((b, i) => {
      b.classList.toggle('open', S.solved[i]);
      b.classList.toggle('active', i === S.active && !S.solved[i]);
      b.querySelector('img').src = tile(S.solved[i] ? 92 : 89);
    });
  }

  function selectLock(i) {
    S.active = i;
    S.input = '';
    S.digits = [];
    S.slot = 0;
    S.path = [];
    S.hints = 0;
    S.fails = 0;
    paintLocks();
    walkTo(CHEST_COLS[i], CHEST_ROW + 1);
    Sfx.play('flip');
    renderPlaque();
  }

  /* ---------- the lock panel ---------- */

  const lock = () => S.room.locks[S.active];

  function renderPlaque() {
    const p = $('escPlaque');
    p.innerHTML = '';
    p.className = 'esc-plaque';
    const lk = lock();
    p.appendChild(el('h2', 'esc-title', lk.title));
    p.appendChild(el('p', 'esc-prompt', lk.prompt));
    S.msg = el('p', 'esc-msg');
    S.msg.setAttribute('role', 'status');
    S.msg.setAttribute('aria-live', 'polite');
    if (lk.kind === 'sequence') seqUI(p, lk);
    else if (lk.kind === 'code') codeUI(p, lk);
    else if (lk.kind === 'balance') balUI(p, lk);
    else macUI(p, lk);
    p.appendChild(S.msg);
    const row = el('div', 'esc-actions');
    const hint = el('button', 'btn ghost small', '💡 Hint');
    hint.type = 'button';
    hint.addEventListener('click', () => giveHint());
    row.appendChild(hint);
    p.appendChild(row);
  }

  /** The keypad used by the number and code locks. */
  function keypad(host, opts) {
    const pad = el('div', 'esc-pad');
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', opts.minus ? '−' : '', '0', '⌫'];
    keys.forEach((k) => {
      if (!k) { pad.appendChild(el('span')); return; }
      const b = el('button', 'esc-key', k);
      b.type = 'button';
      b.addEventListener('click', () => { if (!S.busy) { Sfx.play('card'); opts.onKey(k); } });
      pad.appendChild(b);
    });
    const go = el('button', 'btn big esc-try', opts.tryLabel || 'Try it');
    go.type = 'button';
    go.addEventListener('click', () => { if (!S.busy) opts.onTry(); });
    host.appendChild(pad);
    host.appendChild(go);
  }

  function numberKey(k, maxLen) {
    if (k === '⌫') S.input = S.input.slice(0, -1);
    else if (k === '−') S.input = S.input.startsWith('−') ? S.input.slice(1) : '−' + S.input;
    else if (S.input.replace('−', '').length < maxLen) S.input += k;
    paintAnswer();
  }
  const numberValue = () => (S.input === '' || S.input === '−' ? null : parseInt(S.input.replace('−', '-'), 10));
  function paintAnswer() { if (S.ans) S.ans.textContent = S.input === '' ? '?' : S.input; }

  function seqUI(p, lk) {
    const row = el('div', 'esc-seq');
    lk.terms.forEach((t, i) => { const c = el('span', 'esc-term', ESC.fmt(t)); c.style.setProperty('--d', i * 70 + 'ms'); row.appendChild(c); });
    S.ans = el('span', 'esc-term ask', '?');
    row.appendChild(S.ans);
    p.appendChild(row);
    keypad(p, { minus: lk.terms.some((t) => t < 0) || S.room.band === '6', onKey: (k) => numberKey(k, lk.maxDigits), onTry: () => { const v = numberValue(); if (v !== null) attempt(v); } });
  }

  function codeUI(p, lk) {
    const list = el('div', 'esc-clues');
    S.slots = lk.clues.map((clue, i) => {
      const row = el('div', 'esc-clue');
      row.appendChild(el('span', 'esc-dig', 'Digit ' + (i + 1)));
      row.appendChild(el('span', 'esc-expr', clue));
      row.appendChild(el('span', 'esc-eq', '='));
      const slot = el('button', 'esc-slot', '?');
      slot.type = 'button';
      slot.addEventListener('click', () => { S.slot = i; paintSlots(); });
      row.appendChild(slot);
      list.appendChild(row);
      return slot;
    });
    p.appendChild(list);
    paintSlots();
    keypad(p, {
      onKey: (k) => {
        if (k === '⌫') { if (S.digits[S.slot] == null && S.slot > 0) S.slot--; S.digits[S.slot] = null; }
        else { S.digits[S.slot] = parseInt(k, 10); if (S.slot < lk.n - 1) S.slot++; }
        paintSlots();
      },
      onTry: () => { const a = lk.digits.map((_, i) => S.digits[i]); if (a.every((x) => x != null)) attempt(a); else say('Fill in every digit first.', false); },
    });
  }
  function paintSlots() {
    S.slots.forEach((b, i) => { b.textContent = S.digits[i] == null ? '?' : S.digits[i]; b.classList.toggle('sel', i === S.slot); });
  }

  function balUI(p, lk) {
    const sc = el('div', 'scale esc-scale');
    sc.innerHTML = '<div class="beam"><div class="pan"></div><div class="pan"></div></div><div class="post"></div>';
    S.scale = sc;
    const pans = sc.querySelectorAll('.pan');
    [lk.p.L, lk.p.R].forEach((side, k) => {
      for (let i = 0; i < side.x; i++) { const b = el('span', 'blk mystery' + (side.x > 6 ? ' sm' : '')); b.innerHTML = '<span class="n">?</span>'; pans[k].appendChild(b); }
      if (side.c > 0) pans[k].appendChild(el('span', 'blk known', String(side.c)));
    });
    p.appendChild(sc);
    const eq = el('p', 'esc-eq-line', lk.p.text);
    p.appendChild(eq);
    const ans = el('div', 'esc-seq');
    ans.appendChild(el('span', 'esc-term', '? ='));
    S.ans = el('span', 'esc-term ask', '?');
    ans.appendChild(S.ans);
    p.appendChild(ans);
    keypad(p, { onKey: (k) => numberKey(k, 2), onTry: () => { const v = numberValue(); if (v !== null) attempt(v); }, tryLabel: 'Weigh it' });
  }

  function macUI(p, lk) {
    const now = el('div', 'esc-now');
    S.now = el('span', 'mac-big', ESC.fmt(lk.p.start));
    now.append(S.now, el('span', 'mac-arrow', '→'), el('span', 'mac-big tgt', ESC.fmt(lk.p.target)));
    p.appendChild(now);
    S.steps = el('p', 'esc-steps', 'Your chain: (nothing yet)  ·  the lock jams after ' + lk.limit + ' steps');
    p.appendChild(S.steps);
    const ops = el('div', 'mac-ops');
    lk.p.ops.forEach((op, i) => {
      const b = el('button', 'op-card', op.label);
      b.type = 'button';
      b.addEventListener('click', () => { if (!S.busy) pressOp(i); });
      ops.appendChild(b);
    });
    p.appendChild(ops);
    const row = el('div', 'row center');
    const undo = el('button', 'btn ghost small', 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', () => { if (S.path.length && !S.busy) { S.path.pop(); paintMachine(); } });
    const reset = el('button', 'btn ghost small', 'Start over');
    reset.type = 'button';
    reset.addEventListener('click', () => { if (!S.busy) { S.path = []; paintMachine(); } });
    row.append(undo, reset);
    p.appendChild(row);
    S.opEls = [...ops.children];
    paintMachine();
  }
  function paintMachine() {
    const lk = lock();
    const vs = ESC.machineValues(lk, S.path) || [lk.p.start];
    const cur = vs[vs.length - 1];
    S.now.textContent = ESC.fmt(cur);
    S.steps.textContent = S.path.length ? 'Your chain: ' + vs.map(ESC.fmt).join(' → ') + '  ·  jams after ' + lk.limit : 'Your chain: (nothing yet)  ·  the lock jams after ' + lk.limit + ' steps';
    S.opEls.forEach((b, i) => { b.disabled = MGP.stepMachine(lk.p, i, cur) === null || S.path.length >= lk.limit; });
  }
  function pressOp(i) {
    const lk = lock();
    Sfx.play('card');
    S.path.push(i);
    paintMachine();
    const vs = ESC.machineValues(lk, S.path);
    if (vs[vs.length - 1] === lk.p.target) attempt(S.path.slice());
    else if (S.path.length >= lk.limit) { say('The lock jammed: ' + lk.limit + ' steps and you are on ' + ESC.fmt(vs[vs.length - 1]) + ', not ' + ESC.fmt(lk.p.target) + '. Start over and look for a shorter chain.', false); slip(); S.path = []; paintMachine(); }
  }

  /* ---------- trying and hinting ---------- */

  function say(text, good) {
    S.msg.textContent = text;
    S.msg.className = 'esc-msg ' + (good ? 'good' : 'bad');
  }
  function slip() {
    S.slips++;
    Sfx.play('wrong');
    ctxRecord(false);
    const p = $('escPlaque');
    p.classList.remove('shake');
    void p.offsetWidth; // restart the one-shot shake
    p.classList.add('shake');
    ghost();
  }
  const ctxRecord = (right) => Store.record(ctx.profile, lock().skill, right);

  function attempt(answer) {
    const lk = lock();
    const res = ESC.check(lk, answer);
    if (res.ok) return openLock(res.msg);
    say(res.msg, false);
    if (lk.kind === 'balance' && S.scale) { // the scale tips toward the heavier side so the wrong guess can be seen
      const d = MGP.checkBalance(lk.p, answer).diff;
      S.scale.style.setProperty('--tilt', -Math.sign(d) * Math.min(14, 4 + Math.abs(d) * 1.2) + 'deg');
    }
    slip();
    S.fails++;
    if (S.fails === 3) later(() => giveHint(true), 900); // after three misses the guide steps in
  }

  function giveHint(auto) {
    if (S.busy) return;
    const h = ESC.hint(lock(), S.hints > 0 ? 1 : 0);
    S.hints++;
    S.slips++;
    Sfx.play('flip');
    S.msg.className = 'esc-msg hint';
    S.msg.textContent = '';
    const im = el('img', 'esc-bulb');
    im.src = 'assets/kenney/ui/emote_idea.png';
    im.alt = '';
    S.msg.append(im, document.createTextNode(' ' + (auto ? 'Stuck? ' : '') + h));
  }

  function ghost() {
    const g = sprite(121, CHEST_COLS[S.active], CHEST_ROW - 1, 'esc-ghost');
    $('escScene').appendChild(g);
    later(() => g.remove(), 900);
  }

  function openLock(msg) {
    const i = S.active;
    S.busy = true;
    ctxRecord(true);
    S.solved[i] = true;
    Sfx.play('solved');
    paintLocks();
    say(msg, true);
    const b = S.chests[i];
    const fx = el('img', 'esc-spark');
    fx.src = 'assets/kenney/fx/star_01.png';
    fx.alt = '';
    b.appendChild(fx);
    later(() => fx.remove(), 900);
    S.hero.classList.add('cheer');
    later(() => S.hero.classList.remove('cheer'), 600);
    const next = S.solved.indexOf(false);
    if (next < 0) later(finishRoom, 1100);
    else later(() => { S.busy = false; selectLock(next); }, 1300);
  }

  function finishRoom() {
    S.busy = true;
    $('escPlaque').innerHTML = '';
    $('escPlaque').appendChild(el('h2', 'esc-title', 'All three locks are open!'));
    S.door.src = tile(10);
    Sfx.play('open');
    walkTo(DOOR[0], DOOR[1] + 1, () => {
      S.hero.classList.add('exit');
      Sfx.play('win');
    });
    const stars = ESC.roomStars(S.slips);
    const prof = ctx.profile;
    if (!S.room.counted) {
      S.room.counted = true;
      Store.bump(Store.game(prof, 'escape'), 'rooms');
      if (stars === 3) Store.bump(Store.game(prof, 'escape'), 'perfect');
    }
    S.stars += stars;
    ctx.onSave();
    later(() => {
      if (stars === 3) Sfx.say('correct');
      UI.panel({
        icon: 'medals/m' + stars,
        title: stars === 3 ? (S.slips === 0 ? 'Escaped with no slips! ⭐⭐⭐' : 'You escaped! ⭐⭐⭐') : stars === 2 ? 'You escaped! ⭐⭐' : 'You escaped, barely! ⭐',
        text: S.slips === 0 ? 'Not one wrong try or hint. Wow.' : S.slips + (S.slips === 1 ? ' slip' : ' slips') + ' (wrong tries and hints count). Fewer slips means more stars.',
        btn: 'Next room',
        onBtn: newRoom,
        btn2: 'Back to setup',
        onBtn2: exit,
      });
    }, 1700);
  }

  root.Escape = { start };
})(window);
