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

  // Themes are skins only: same game, different look. Original characters (no licensed IP).
  const THEMES = {
    block: { name: 'Block World', player: '🐸', monster: '🧟' },
    creature: { name: 'Creatures', player: '🐣', monster: '🦇' },
    fantasy: { name: 'Fantasy', player: '🧙', monster: '🐉' },
    cute: { name: 'Cute', player: '🐱', monster: '🐛' },
  };

  let S = null;
  let ctx = null;
  let timer = null;
  let toastTimer = null;
  let cellEls = [];
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
  }

  function theme() {
    return THEMES[ctx.profile.settings.theme] || THEMES.block;
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { level: 0, rule: null, streak: profile.munchers.streak || 0 };
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
    const st = ctx.profile.settings;
    if (!sameRule || !S.rule) {
      S.rule = MG.makeLevelRule(st.band, st.stars, S.rule && S.rule.id);
      S.level++;
    }
    S.cells = MG.buildBoard(S.rule, ROWS * COLS, TARGET_CORRECT[st.stars - 1]);
    S.lives = 3;
    S.clean = true;
    S.player = { r: 0, c: 0 };
    S.target = null;
    S.paused = false;
    S.invuln = Date.now() + 1500;
    S.lastMonster = Date.now();
    placeMonsters();
    hidePanel();
    buildBoardDom();
    update();
  }

  function monsterCount() {
    const st = ctx.profile.settings;
    return st.monsters === 'off' ? 0 : MONSTER_COUNT[st.stars - 1];
  }

  function placeMonsters() {
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
      b.className = 'cell' + (cell.label.length > 5 ? ' long' : '');
      b.setAttribute('aria-label', cell.label);
      b.dataset.i = i;
      b.innerHTML = '<span class="lbl"></span><span class="badge bp"></span><span class="badge bm"></span>';
      b.querySelector('.lbl').textContent = cell.label;
      b.addEventListener('click', () => onCell(i));
      el.board.appendChild(b);
      return b;
    });
    el.ruleTitle.textContent = S.rule.title;
    el.ruleHint.textContent = S.rule.hint;
    el.levelNo.textContent = 'Level ' + S.level;
  }

  /* ---------- rendering (updates in place so taps are never lost) ---------- */

  function update() {
    const th = theme();
    const pi = S.player.r * COLS + S.player.c;
    const monsterAt = new Set(S.monsters.map((m) => m.r * COLS + m.c));
    cellEls.forEach((b, i) => {
      const cell = S.cells[i];
      b.classList.toggle('eaten', cell.eaten);
      b.classList.toggle('player', i === pi);
      b.classList.toggle('target', i === S.target);
      b.querySelector('.bp').textContent = i === pi ? th.player : '';
      b.querySelector('.bm').textContent = monsterAt.has(i) ? th.monster : '';
    });
    el.hearts.textContent = '❤️'.repeat(S.lives) + '🤍'.repeat(Math.max(0, 3 - S.lives));
    el.left.textContent = '🎯 ' + remaining() + ' left';
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
    S.player = { r, c };
    checkHit();
    if (S && !S.paused) update();
  }

  /* ---------- game loop ---------- */

  function tick() {
    if (!S || S.paused || document.hidden) return;
    const now = Date.now();
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
    if (S && !S.paused && S.monsters.length && now - S.lastMonster >= MONSTER_INTERVAL[ctx.profile.settings.stars - 1]) {
      S.lastMonster = now;
      moveMonsters();
      checkHit();
      changed = true;
    }
    if (changed && S && !S.paused) update();
  }

  function moveMonsters() {
    S.monsters.forEach((m) => {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => {
        const r = m.r + dr;
        const c = m.c + dc;
        return r >= 0 && r < ROWS && c >= 0 && c < COLS;
      });
      const [dr, dc] = opts[MG.rnd(0, opts.length - 1)];
      m.r += dr;
      m.c += dc;
    });
  }

  function checkHit() {
    if (!S || S.paused || Date.now() < S.invuln) return;
    if (!S.monsters.some((m) => m.r === S.player.r && m.c === S.player.c)) return;
    S.lives--;
    if (S.lives <= 0) {
      showPanel({
        title: 'A glitch got you!',
        text: "You're out of hearts. Let's try this rule again with a new board.",
        btn: 'Try again',
        onBtn: () => newLevel(true),
        bad: true,
      });
      return;
    }
    S.player = { r: 0, c: 0 };
    S.invuln = Date.now() + 1500;
    placeMonsters();
    toast('Bump! Watch out for the glitches.', false);
  }

  function eat() {
    const i = S.player.r * COLS + S.player.c;
    const cell = S.cells[i];
    if (cell.eaten) return;
    cell.eaten = true;
    if (cell.correct) {
      Store.record(ctx.profile, S.rule.id, true);
      toast('✓ ' + S.rule.ok(cell), true);
      if (remaining() === 0) levelDone();
      else update();
    } else {
      Store.record(ctx.profile, S.rule.id, false);
      S.clean = false;
      S.lives--;
      ctx.onSave();
      const out = S.lives <= 0;
      showPanel({
        title: 'Not quite!',
        text: S.rule.why(cell) + (out ? " You're out of hearts. Let's try this rule again with a new board." : ''),
        btn: out ? 'Try again' : 'Keep going',
        onBtn: out ? () => newLevel(true) : () => {
          S.paused = false;
          hidePanel();
          update();
        },
        bad: true,
      });
    }
  }

  function levelDone() {
    const p = ctx.profile;
    p.munchers.levels++;
    S.streak = S.clean ? S.streak + 1 : 0;
    p.munchers.streak = S.streak;
    const next = () => newLevel(false);
    let text = S.clean ? 'Perfect: no mistakes!' : 'Nice work! You cleared the board.';
    const opts = { title: 'Level cleared! 🎉', text, btn: 'Next level', onBtn: next };
    if (S.streak >= 3 && p.settings.stars < 3) {
      opts.text += ' That is ' + S.streak + ' clean levels in a row. Ready for a bigger challenge?';
      opts.btn2 = 'Try harder (★'.concat('★'.repeat(p.settings.stars), ')');
      opts.onBtn2 = () => {
        p.settings.stars++;
        S.streak = 0;
        p.munchers.streak = 0;
        ctx.onSave();
        newLevel(false);
      };
    }
    ctx.onSave();
    showPanel(opts);
  }

  root.Munchers = { start, stop, THEMES };
})(window);
