/* Munchers: a grid game where the math IS the movement.
 * Move onto a number and munch it. Only numbers that fit the rule are safe.
 * A wrong munch explains itself. No timer by default (see TIMER_ENABLED hook).
 */
(function (root) {
  'use strict';
  const ROWS = 5;
  const COLS = 6;
  const TARGET_CORRECT = [8, 10, 12];
  const MONSTER_INTERVAL = [1800, 1300, 900]; // ms between monster steps, by stars
  const MONSTER_COUNT = [1, 2, 3];
  const TICK_MS = 120;
  const TELL_MS = [400, 300, 220]; // glitch wind-up before each step, by stars (+100 ms for K-1): a fair warning, see docs/animation-guide.md
  const HIT_PAUSE_MS = 70;

  // Themes are skins only: same game, different look. Original characters (no licensed IP).
  const THEMES = {
    // player / monster are the emoji fallback; art is Kenney CC0 (assets/kenney): a round animal and an alien "glitch", per skin
    block: { name: 'Block World', player: '🐸', monster: '🧟', art: { player: 'animals/frog', monster: 'aliens/Green', tile: 'Wood' } },
    creature: { name: 'Creatures', player: '🐣', monster: '🦇', art: { player: 'animals/chick', monster: 'aliens/Blue', tile: 'Blue' } },
    fantasy: { name: 'Fantasy', player: '🧙', monster: '🐉', art: { player: 'animals/owl', monster: 'aliens/Pink', tile: 'Marble' } },
    cute: { name: 'Cute', player: '🐱', monster: '🐛', art: { player: 'animals/rabbit', monster: 'aliens/Yellow', tile: 'Yellow' } },
  };

  let S = null;
  let ctx = null;
  let timer = null;
  let toastTimer = null;
  let cellEls = [];
  let layer = null;
  let bound = false;
  const el = {};

  const $ = (id) => document.getElementById(id);

  function init() {
    if (bound) return;
    bound = true;
    ['board', 'ruleTitle', 'ruleHint', 'hearts', 'levelNo', 'left', 'panel', 'panelTitle', 'panelText', 'panelBtn', 'panelBtn2', 'toast', 'gameMenu', 'munchBtn'].forEach((id) => (el[id] = $(id)));
    el.gameMenu.addEventListener('click', exit);
    el.munchBtn.addEventListener('click', () => {
      if (S && !S.paused) eat();
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => syncActors(true));
  }

  function theme() {
    return THEMES[ctx.profile.settings.theme] || THEMES.block;
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { level: 0, rule: null, streak: Store.game(profile, 'munchers').streak || 0 };
    newLevel(false);
    stop();
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function exit() {
    stop();
    S = null;
    hidePanel();
    ctx.onSave();
    ctx.onExit();
  }

  /* ---------- level setup ---------- */

  function newLevel(sameRule) {
    if (!sameRule || !S.rule) {
      // a new level: the player's grade on the difficulty ladder, sometimes a stretch (bonus) level; a retry of the same level keeps its cell
      S.cur = Store.cell(ctx.profile, 'munchers', { first: !S.level });
      S.rule = MG.makeLevelRule(S.cur.band, S.cur.stars, S.rule && S.rule.id);
      S.level++;
    }
    const st = S.cur;
    S.cells = MG.buildBoard(S.rule, ROWS * COLS, TARGET_CORRECT[st.stars - 1]);
    S.maxLives = 3 + (st.stretch ? 1 : 0); // a bonus (stretch) level is harder, so it gives one extra heart
    S.lives = S.maxLives;
    S.clean = true;
    S.player = { r: 0, c: 0 };
    S.target = null;
    S.paused = false;
    S.invuln = Date.now() + 1500;
    S.lastMonster = Date.now();
    S.lastTick = Date.now();
    S.freezeUntil = 0;
    S.plan = null;
    placeMonsters();
    hidePanel();
    buildBoardDom();
    update();
  }

  function monsterCount() {
    return Store.level(ctx.profile, 'munchers').monsters === 'off' ? 0 : MONSTER_COUNT[S.cur.stars - 1];
  }

  function placeMonsters() {
    (S.monsters || []).forEach((m) => m.el && m.el.remove());
    S.plan = null;
    S.monsters = [];
    const n = monsterCount();
    let guard = 0;
    while (S.monsters.length < n && guard++ < 200) {
      const r = MG.rnd(0, ROWS - 1);
      const c = MG.rnd(0, COLS - 1);
      if (Math.abs(r - S.player.r) + Math.abs(c - S.player.c) < 4) continue;
      if (S.monsters.some((m) => m.r === r && m.c === c)) continue;
      S.monsters.push({ r, c });
    }
  }

  function buildBoardDom() {
    el.board.innerHTML = '';
    cellEls = S.cells.map((cell, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (cell.label.length > 3 ? ' long' : '');
      b.setAttribute('aria-label', cell.label);
      b.dataset.i = i;
      b.innerHTML = '<span class="lbl"></span>';
      const lbl = b.querySelector('.lbl');
      lbl.textContent = cell.label;
      lbl.style.animationDelay = i * 12 + 'ms';
      b.addEventListener('click', () => onCell(i));
      el.board.appendChild(b);
      return b;
    });
    layer = document.createElement('div');
    layer.className = 'actors';
    el.board.appendChild(layer);
    S.pActor = null;
    el.ruleTitle.textContent = S.rule.title;
    el.ruleHint.textContent = S.rule.hint;
    el.levelNo.textContent = 'Level ' + S.level + (S.cur && S.cur.stretch ? ' · Bonus' : '');
  }

  /* ---------- rendering (updates in place so taps are never lost) ---------- */

  function update() {
    const th = theme();
    el.board.dataset.tile = (th.art && th.art.tile) || '';
    const pi = S.player.r * COLS + S.player.c;
    const monsterAt = new Set(S.monsters.map((m) => m.r * COLS + m.c));
    cellEls.forEach((b, i) => {
      const cell = S.cells[i];
      b.classList.toggle('eaten', cell.eaten);
      b.classList.toggle('player', i === pi);
      b.classList.toggle('target', i === S.target);
    });
    syncActors(false);
    el.hearts.textContent = '❤️'.repeat(S.lives) + '🤍'.repeat(Math.max(0, (S.maxLives || 3) - S.lives));
    el.left.textContent = '🎯 ' + remaining() + ' left';
  }

  /* ---------- actors: persistent sprites that glide between cells (see docs/animation-guide.md) ---------- */

  function makeActor(cls, emoji, art) {
    const a = document.createElement('div');
    a.className = 'actor ' + cls + ' snap';
    const bd = document.createElement('span');
    bd.className = 'badge ' + (cls === 'pl' ? 'bp' : 'bm');
    a.appendChild(bd);
    badge(bd, true, emoji, art);
    layer.appendChild(a);
    a.badge = bd;
    return a;
  }

  function place(a, r, c, snap) {
    const cell = cellEls[r * COLS + c];
    if (!cell) return;
    if (snap) a.classList.add('snap');
    const w = cell.offsetWidth + 'px';
    const h = cell.offsetHeight + 'px';
    const t = 'translate(' + cell.offsetLeft + 'px,' + cell.offsetTop + 'px)';
    if (a.style.width !== w) a.style.width = w;
    if (a.style.height !== h) a.style.height = h;
    if (a.style.transform !== t) a.style.transform = t;
    if (snap) {
      void a.offsetWidth; // commit the jump with no transition, then let later moves glide
      a.classList.remove('snap');
    }
  }

  function syncActors(snapAll) {
    if (!layer || !S) return;
    const th = theme();
    if (!S.pActor) S.pActor = makeActor('pl', th.player, th.art && th.art.player);
    place(S.pActor, S.player.r, S.player.c, snapAll || S.snapPlayer);
    S.snapPlayer = false;
    S.monsters.forEach((m) => {
      if (!m.el) {
        m.el = makeActor('mon', th.monster, th.art && th.art.monster);
        place(m.el, m.r, m.c, true);
      } else place(m.el, m.r, m.c, snapAll);
    });
  }

  /** Restart a short CSS animation class; a timer (not animationend) clears it, so reduced motion can never hang the game. */
  function flash(node, cls, ms) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    clearTimeout(node['_t' + cls]);
    node['_t' + cls] = setTimeout(() => node.classList.remove(cls), ms);
  }

  function celebrate() {
    flash(el.board, 'bounce', 340);
    const colors = ['#ffd54f', '#ff8a65', '#4fc3f7', '#81c784', '#ba68c8'];
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span');
      s.className = 'conf';
      const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 70;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist - 30 + 'px');
      s.style.setProperty('--r', Math.round(Math.random() * 540 - 270) + 'deg');
      s.style.setProperty('--c', colors[i % colors.length]);
      layer.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  /** Shows a sprite (or the emoji fallback) in a badge, only touching the DOM when it changes so taps are never lost. */
  function badge(elb, on, emoji, art) {
    const key = on ? (art || emoji) : '';
    if (elb.dataset.k === key) return;
    elb.dataset.k = key;
    elb.textContent = '';
    if (!on) return;
    if (!art) { elb.textContent = emoji; return; }
    const img = new Image();
    img.src = 'assets/kenney/' + art + '.png';
    img.alt = '';
    img.draggable = false;
    img.onerror = () => { elb.textContent = emoji; };
    elb.appendChild(img);
  }

  function pop(i, good) {
    const cellEl = cellEls[i];
    if (!cellEl) return;
    const fx = document.createElement('span');
    fx.className = 'fx ' + (good ? 'fx-good' : 'fx-bad');
    cellEl.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  function remaining() {
    return S.cells.filter((c) => c.correct && !c.eaten).length;
  }

  function toast(msg, good) {
    el.toast.textContent = msg;
    el.toast.className = 'toast show ' + (good ? 'good' : 'info');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.toast.className = 'toast'), 2200);
  }

  function showPanel(o) {
    S.paused = true;
    S.target = null;
    const ic = $('panelIcon');
    ic.hidden = !o.icon;
    if (o.icon) ic.src = 'assets/kenney/' + o.icon + '.png';
    el.panelTitle.textContent = o.title;
    el.panelText.textContent = o.text;
    el.panelBtn.textContent = o.btn;
    el.panelBtn.onclick = o.onBtn;
    if (o.btn2) {
      el.panelBtn2.hidden = false;
      el.panelBtn2.textContent = o.btn2;
      el.panelBtn2.onclick = o.onBtn2;
    } else {
      el.panelBtn2.hidden = true;
    }
    el.panel.hidden = false;
    el.panel.classList.toggle('bad', !!o.bad);
    el.panelBtn.focus();
    update();
  }

  function hidePanel() {
    el.panel.hidden = true;
  }

  /* ---------- input ---------- */

  function onKey(e) {
    if (!S || !timer || $('game').hidden) return;
    if (S.paused) return;
    const k = e.key;
    const dirs = { ArrowUp: [-1, 0], w: [-1, 0], W: [-1, 0], ArrowDown: [1, 0], s: [1, 0], S: [1, 0], ArrowLeft: [0, -1], a: [0, -1], A: [0, -1], ArrowRight: [0, 1], d: [0, 1], D: [0, 1] };
    if (dirs[k]) {
      e.preventDefault();
      S.target = null;
      move(dirs[k][0], dirs[k][1]);
    } else if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      eat();
    }
  }

  function onCell(i) {
    if (!S || S.paused) return;
    const pi = S.player.r * COLS + S.player.c;
    if (i === pi) {
      S.target = null;
      eat();
    } else {
      S.target = i;
      update();
    }
  }

  function move(dr, dc) {
    const r = S.player.r + dr;
    const c = S.player.c + dc;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (Date.now() < S.freezeUntil) return;
    S.player = { r, c };
    if (S.pActor) flash(S.pActor.badge, 'hop', 140);
    Sfx.play('step');
    checkHit();
    if (S && !S.paused) update();
  }

  /* ---------- game loop ---------- */

  function tick() {
    if (!S || S.paused || document.hidden) return;
    const now = Date.now();
    if (now - S.lastTick > 500) S.lastMonster += now - S.lastTick; // time spent in a panel or hidden tab must not eat the glitch warning
    S.lastTick = now;
    if (now < S.freezeUntil) return;
    let changed = false;
    if (S.target != null) {
      const tr = Math.floor(S.target / COLS);
      const tc = S.target % COLS;
      if (S.player.c !== tc) move(0, Math.sign(tc - S.player.c));
      else if (S.player.r !== tr) move(Math.sign(tr - S.player.r), 0);
      if (S && !S.paused && S.player.r === tr && S.player.c === tc) {
        S.target = null;
        eat();
      }
      changed = true;
    }
    if (S && !S.paused && S.monsters.length) {
      const st = S.cur;
      const iv = MONSTER_INTERVAL[st.stars - 1];
      const tell = TELL_MS[st.stars - 1] + (st.band === 'K-1' ? 100 : 0);
      const since = now - S.lastMonster;
      if (!S.plan && since >= iv - tell) {
        S.plan = planMonsters();
        S.tellAt = now;
        S.monsters.forEach((m, k) => {
          if (!m.el) return;
          m.el.badge.style.setProperty('--tell', tell + 'ms');
          m.el.badge.style.setProperty('--lx', S.plan[k][1] * 7 + 'px');
          m.el.badge.style.setProperty('--ly', S.plan[k][0] * 5 + 'px');
          m.el.badge.classList.add('tell');
        });
      }
      if (S.plan && since >= iv && now - S.tellAt >= tell) {
        S.lastMonster = now;
        moveMonsters(S.plan);
        S.plan = null;
        checkHit();
        changed = true;
      }
    }
    if (changed && S && !S.paused) update();
  }

  function planMonsters() {
    return S.monsters.map((m) => {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => {
        const r = m.r + dr;
        const c = m.c + dc;
        return r >= 0 && r < ROWS && c >= 0 && c < COLS;
      });
      return opts[MG.rnd(0, opts.length - 1)];
    });
  }

  function moveMonsters(plan) {
    const p = plan || planMonsters();
    S.monsters.forEach((m, k) => {
      m.r += p[k][0];
      m.c += p[k][1];
      if (m.el) {
        m.el.badge.classList.remove('tell');
        flash(m.el.badge, 'land', 160);
      }
    });
  }

  function checkHit() {
    if (!S || S.paused || Date.now() < S.invuln) return;
    if (!S.monsters.some((m) => m.r === S.player.r && m.c === S.player.c)) return;
    S.lives--;
    Sfx.play(S.lives <= 0 ? 'lose' : 'hurt');
    if (S.lives <= 0) {
      showPanel({
        icon: 'ui/emote_faceSad',
        title: 'A glitch got you!',
        text: "You're out of hearts. Let's try this rule again with a new board.",
        btn: 'Try again',
        onBtn: () => newLevel(true),
        bad: true,
      });
      return;
    }
    S.player = { r: 0, c: 0 };
    S.snapPlayer = true;
    S.invuln = Date.now() + 1500;
    S.freezeUntil = Date.now() + HIT_PAUSE_MS;
    flash(el.board, 'shake', 220);
    if (S.pActor) flash(S.pActor.badge, 'hurt', 900);
    placeMonsters();
    toast('Bump! Watch out for the glitches.', false);
  }

  function eat() {
    const i = S.player.r * COLS + S.player.c;
    const cell = S.cells[i];
    if (cell.eaten) return;
    cell.eaten = true;
    if (S.pActor) flash(S.pActor.badge, 'chomp', 150);
    if (cell.correct) {
      Sfx.play('correct');
      pop(i, true);
      Store.record(ctx.profile, S.rule.id, true);
      ctx.onSave(); // save every right answer: closing the tab mid-level must not lose them
      toast('✓ ' + S.rule.ok(cell), true);
      if (remaining() === 0) levelDone();
      else update();
    } else {
      Sfx.play('wrong');
      pop(i, false);
      Store.record(ctx.profile, S.rule.id, false);
      S.clean = false;
      S.lives--;
      ctx.onSave();
      const out = S.lives <= 0;
      S.paused = true; // block input while the cell wobbles, then explain
      S.target = null;
      flash(cellEls[i], 'wobble', 300);
      const game = S;
      setTimeout(() => S === game && showPanel({
        icon: 'ui/emote_question',
        title: 'Not quite!',
        text: S.rule.why(cell) + (out ? " You're out of hearts. Let's try this rule again with a new board." : ''),
        btn: out ? 'Try again' : 'Keep going',
        onBtn: out ? () => newLevel(true) : () => {
          S.paused = false;
          hidePanel();
          update();
        },
        bad: true,
      }), 260);
    }
  }

  function levelDone() {
    const p = ctx.profile;
    const mg = Store.game(p, 'munchers');
    Store.bump(mg, 'levels');
    S.streak = S.clean ? S.streak + 1 : 0;
    Store.setField(mg, 'streak', S.streak);
    const next = () => newLevel(false);
    let text = S.clean ? 'Perfect: no mistakes!' : 'Nice work! You cleared the board.';
    setTimeout(() => Sfx.play('win'), 450); // after the last coin ding, so the jingle does not cover it
    if (S.clean) setTimeout(() => Sfx.say('correct'), 1200);
    const opts = { icon: S.clean ? 'medals/m3' : 'medals/m1', title: 'Level cleared! 🎉', text, btn: 'Next level', onBtn: next };
    // (the old "Try harder" button is gone: the grade and the occasional bonus level now do that job)
    if (S.streak >= 3) opts.text += ' That is ' + S.streak + ' clean levels in a row!';
    ctx.onSave();
    celebrate();
    showPanel(opts);
  }

  root.Munchers = { start, stop, THEMES };
})(window);
