/* Number Defense screen: plan towers with a rule each, then watch the wave play out. Logic lives in js/tdlogic.js. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ROUND = 3;
  const TICK = 700;
  const TOWER_ART = ['owl', 'penguin', 'panda', 'pig', 'cow', 'chick']; // by shop slot, so each rule keeps a face during a wave
  const ENEMY_ART = ['Green', 'Blue', 'Pink', 'Yellow', 'Beige'];
  let ctx = null;
  let S = null;
  let bound = false;
  let timer = null;

  const art = (kind, name) => 'assets/kenney/' + kind + '/' + name + '.png';

  function init() {
    if (bound) return;
    bound = true;
    $('tdBack').addEventListener('click', exit);
    $('tdGo').addEventListener('click', go);
    $('tdClear').addEventListener('click', () => { if (S && !S.running) { S.place = S.place.map(() => null); S.sel = null; Sfx.play('close'); render(); } });
    $('tdSpeed').addEventListener('click', () => { if (S) { S.fast = !S.fast; $('tdSpeed').textContent = S.fast ? '⏩ Fast' : '▶ Normal'; } });
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { n: 0, stars: 0, fast: false };
    nextWave(true);
  }

  function stopTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function exit() {
    stopTimer();
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  function nextWave(fresh) {
    stopTimer();
    const st = ctx.profile.settings;
    if (fresh) {
      S.n++;
      S.wave = TDL.makeWave(st.band, st.stars);
      S.tries = 0;
    }
    S.place = TDL.SLOT_COLS.map(() => null);
    S.sel = null;
    S.running = false;
    $('tdNo').textContent = 'Wave ' + S.n + ' of ' + ROUND;
    $('tdSpeed').textContent = S.fast ? '⏩ Fast' : '▶ Normal';
    buildLane();
    buildShop();
    render();
  }

  /* ---------- building the scene ---------- */

  function buildLane() {
    const w = S.wave;
    const lane = $('tdLane');
    lane.innerHTML = '';
    lane.style.setProperty('--cols', TDL.LANE);
    const road = document.createElement('div');
    road.className = 'td-road';
    lane.appendChild(road);
    // tower slots sit above the road at their columns
    const slots = document.createElement('div');
    slots.className = 'td-slots';
    TDL.SLOT_COLS.forEach((col, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'td-slot';
      b.style.left = ((col + 0.5) / TDL.LANE) * 100 + '%';
      b.setAttribute('aria-label', 'Tower spot ' + (i + 1));
      b.addEventListener('click', () => onSlot(i));
      slots.appendChild(b);
    });
    lane.appendChild(slots);
    const gate = document.createElement('div');
    gate.className = 'td-gate';
    gate.textContent = '🏰';
    lane.appendChild(gate);
    // the wave preview and the marching enemies
    const prev = $('tdPreview');
    prev.innerHTML = '';
    S.enemyEls = w.enemies.map((v, i) => {
      const chip = document.createElement('span');
      chip.className = 'td-chip';
      chip.textContent = TDL.fmt(v);
      prev.appendChild(chip);
      const e = document.createElement('div');
      e.className = 'td-enemy';
      e.hidden = true;
      e.innerHTML = '<img alt="" draggable="false"><span class="n"></span>';
      e.querySelector('img').src = art('aliens', ENEMY_ART[i % ENEMY_ART.length]);
      e.querySelector('.n').textContent = TDL.fmt(v);
      lane.appendChild(e);
      return { e, chip };
    });
    $('tdGate').textContent = '❤️'.repeat(TDL.MAX_LEAKS + 1);
  }

  function buildShop() {
    const shop = $('tdShop');
    shop.innerHTML = '';
    S.wave.shop.forEach((r, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'td-card';
      b.dataset.k = k;
      b.innerHTML = '<img alt="" draggable="false"><span class="t"></span><span class="d"></span><span class="c"></span>';
      b.querySelector('img').src = art('animals', TOWER_ART[k % TOWER_ART.length]);
      b.querySelector('.t').textContent = r.name;
      b.querySelector('.d').textContent = 'hits ' + r.desc.replace(/ \(.*/, '');
      b.querySelector('.c').textContent = '🪙 ' + r.cost;
      b.addEventListener('click', () => onCard(k));
      shop.appendChild(b);
    });
  }

  function gold() {
    return S.wave.budget - TDL.spent(S.wave, S.place);
  }

  function render() {
    const w = S.wave;
    $('tdGold').textContent = '🪙 ' + gold() + ' of ' + w.budget;
    [...$('tdShop').children].forEach((b) => {
      const k = +b.dataset.k;
      b.classList.toggle('on', S.sel === k);
      b.disabled = S.running;
      b.classList.toggle('poor', w.shop[k].cost > gold());
    });
    [...$('tdLane').querySelectorAll('.td-slot')].forEach((b, i) => {
      const k = S.place[i];
      b.disabled = S.running;
      b.classList.toggle('filled', k != null);
      b.innerHTML = k == null ? '<span class="plus">+</span>' : '<img alt="" draggable="false">';
      if (k != null) b.querySelector('img').src = art('animals', TOWER_ART[k % TOWER_ART.length]);
      if (k != null) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = w.shop[k].name;
        b.appendChild(tag);
      }
    });
    $('tdGo').disabled = S.running || S.place.every((x) => x == null);
    $('tdClear').disabled = S.running || S.place.every((x) => x == null);
    $('tdHelp').textContent = S.running
      ? 'The wave is marching. Watch which towers fire!'
      : S.sel != null
        ? 'Now tap a spot to put the "' + w.shop[S.sel].name + '" tower there.'
        : 'Read the incoming numbers. Pick a tower, then tap a spot. Tap a placed tower to take it back.';
  }

  /* ---------- planning ---------- */

  function onCard(k) {
    if (S.running) return;
    S.sel = S.sel === k ? null : k;
    Sfx.play('flip');
    render();
  }

  function onSlot(i) {
    if (S.running) return;
    if (S.sel == null) {
      if (S.place[i] != null) { S.place[i] = null; Sfx.play('close'); render(); }
      return;
    }
    const old = S.place[i];
    S.place[i] = null;
    if (S.wave.shop[S.sel].cost > gold()) {
      S.place[i] = old;
      UI.toast('Not enough gold for that tower. Take one back, or pick a cheaper one.', false);
      Sfx.play('wrong');
      render();
      return;
    }
    S.place[i] = S.sel;
    Sfx.play('place');
    render();
  }

  /* ---------- running the wave ---------- */

  function go() {
    if (S.running) return;
    S.running = true;
    S.res = TDL.simulate(S.wave, S.place);
    S.t = 0;
    S.enemyEls.forEach(({ e, chip }) => { e.hidden = true; e.className = 'td-enemy'; chip.className = 'td-chip'; });
    render();
    step();
  }

  function colPct(pos) {
    return ((pos + 0.5) / TDL.LANE) * 100 + '%';
  }

  function step() {
    const tk = S.res.ticks[S.t];
    if (!tk) return finish();
    const slots = [...$('tdLane').querySelectorAll('.td-slot')];
    tk.pos.forEach((p, i) => {
      const { e } = S.enemyEls[i];
      const st = tk.state[i];
      const live = p >= 0 && p < TDL.LANE && (st === 'march' || tk.shots.some((s) => s.enemy === i) || tk.leaks.includes(i));
      if (live) { e.hidden = false; e.style.left = colPct(p); }
    });
    if (S.t > 0) Sfx.play('step');
    tk.shots.forEach((s) => {
      const { e, chip } = S.enemyEls[s.enemy];
      e.classList.add('dead');
      chip.classList.add('dead');
      slots[s.slot].classList.add('fire');
      setTimeout(() => slots[s.slot].classList.remove('fire'), 300);
      Sfx.play('correct');
    });
    tk.leaks.forEach((i) => {
      const { e, chip } = S.enemyEls[i];
      e.classList.add('leak');
      chip.classList.add('leak');
      $('tdLane').classList.add('hit');
      setTimeout(() => $('tdLane').classList.remove('hit'), 400);
      Sfx.play('hurt');
      const left = TDL.MAX_LEAKS + 1 - S.res.ticks.slice(0, S.t + 1).reduce((a, x) => a + x.leaks.length, 0);
      $('tdGate').textContent = '❤️'.repeat(Math.max(0, left)) + '🤍'.repeat(TDL.MAX_LEAKS + 1 - Math.max(0, left));
    });
    S.t++;
    timer = setTimeout(step, S.fast ? TICK / 3 : TICK);
  }

  function finish() {
    const w = S.wave;
    const r = S.res;
    const prof = ctx.profile;
    // per-skill record: each enemy is a right (a tower caught it) or an oops (it leaked), filed under the skill that would catch it
    w.enemies.forEach((v, i) => {
      const rule = w.shop[w.solution.find((k) => w.shop[k].test(v))];
      Store.record(prof, rule.skill, r.killedBy[i] >= 0);
    });
    const notes = TDL.explain(w, S.place, r);
    if (r.won) {
      if (!w.counted) { // counted once per wave so retries cannot inflate the saved counters
        w.counted = true;
        Store.bump(Store.game(prof, 'td'), 'waves');
        if (r.stars === 3) Store.bump(Store.game(prof, 'td'), 'perfect');
      }
      S.stars += r.stars;
      ctx.onSave();
      Sfx.play('win');
      if (r.stars === 3) setTimeout(() => Sfx.say('correct'), 700);
      const last = S.n >= ROUND;
      UI.panel({
        icon: 'medals/m' + r.stars,
        title: r.stars === 3 ? 'Perfect defense! ⭐⭐⭐' : r.stars === 2 ? 'Wave held! ⭐⭐' : 'Wave held, just barely! ⭐',
        text: (notes.length ? notes.join('\n') + ' ' : 'Every number was stopped, with ' + gold() + ' gold to spare. ') + (last ? 'Round done: ' + S.stars + ' of ' + ROUND * 3 + ' stars.' : ''),
        btn: last ? 'Play another round' : 'Next wave',
        onBtn: last ? () => { S.n = 0; S.stars = 0; nextWave(true); } : () => nextWave(true),
        btn2: r.stars < 3 ? 'Try this wave again' : null,
        onBtn2: () => { S.stars -= r.stars; nextWave(false); },
      });
    } else {
      ctx.onSave();
      Sfx.play('lose');
      S.tries++;
      UI.panel({
        icon: 'ui/emote_faceSad',
        title: 'The gate fell!',
        text: notes.slice(0, 4).join('\n') + '\nChange your towers and try again: the same wave is waiting.',
        btn: 'Try again',
        onBtn: () => nextWave(false),
        btn2: 'Back to setup',
        onBtn2: exit,
        bad: true,
      });
    }
    S.running = false;
  }

  root.Defense = { start };
})(window);
