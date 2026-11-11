/* Number Line Runner screen. A side-view river valley: the number line is a rope over the water, the hero stands on a stone at the
 * current value. Tap a tick to aim (a dashed arc previews the jump), press Jump, and the hero leaps and lands exactly there.
 * Right spot: a stone and a flag pop up and the hero is there. Wrong spot: splash, and the message counts the ticks you were off.
 * The goal spot is never drawn: you find it by reading the ticks. Logic lives in js/runlogic.js. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const IMG = 'assets/kenney/runner/';
  const X0 = 7; // the line runs from 7% to 93% of the scene width
  const X1 = 93;
  const ROPE_Y = 63; // % down the scene
  let ctx = null;
  let S = null;
  let bound = false;
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(() => { if (S) fn(); }, ms); timers.push(t); return t; };
  const clearTimers = () => timers.splice(0).forEach(clearTimeout);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const img = (src, cls) => { const i = el('img', cls); i.src = IMG + src + '.png'; i.alt = ''; i.draggable = false; return i; };
  const reduced = () => document.documentElement.dataset.motion === 'reduced' || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const xOf = (k) => X0 + (k / (S.run.ticks - 1)) * (X1 - X0); // % of scene width

  function init() {
    if (bound) return;
    bound = true;
    $('runBack').addEventListener('click', exit);
    $('runJump').addEventListener('click', () => jump());
    $('runLeft').addEventListener('click', () => nudge(-1));
    $('runRight').addEventListener('click', () => nudge(1));
    $('runHint').addEventListener('click', () => giveHint(false));
    document.addEventListener('keydown', (e) => {
      if (!S || $('runner').hidden || !$('panel').hidden) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
      else if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); jump(); }
    });
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { n: 0, stars: 0 };
    newRun();
  }

  function exit() {
    clearTimers();
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  /* ---------- a run ---------- */

  function newRun() {
    clearTimers();
    const st = ctx.profile.settings;
    S.n++;
    S.run = RUN.makeRun(st.band, st.stars);
    S.cp = 0;
    S.slips = 0;
    S.busy = false;
    S.counted = false;
    $('runNo').textContent = 'Run ' + S.n;
    buildScene();
    startCheckpoint();
  }

  function buildScene() {
    const run = S.run;
    const sc = $('runScene');
    sc.innerHTML = '';
    const hills = el('div', 'run-hills');
    sc.appendChild(hills);
    ['run-bat b1', 'run-bat b2'].forEach((c, i) => { const b = img(i ? 'c25' : 'c24', c); sc.appendChild(b); });
    [['t125', 4], ['t126', 90], ['t124', 14], ['t127', 80]].forEach(([t, x]) => { const p = img(t, 'run-plant'); p.style.left = x + '%'; sc.appendChild(p); });
    const water = el('div', 'run-water');
    sc.appendChild(water);
    const rope = el('div', 'run-rope');
    rope.style.left = X0 + '%';
    rope.style.width = X1 - X0 + '%';
    sc.appendChild(rope);
    // ticks: a tall invisible tap area, a mark, and a label every few ticks
    S.tickEls = [];
    for (let k = 0; k < run.ticks; k++) {
      const major = !!RUN.labelOf(run.line, k);
      const b = el('button', 'run-tick' + (major ? ' major' : ''));
      b.type = 'button';
      b.style.left = xOf(k) + '%';
      b.style.width = (100 / run.ticks) * 0.86 + '%';
      b.setAttribute('aria-label', 'Tick ' + (k + 1) + (major ? ': ' + RUN.labelOf(run.line, k) : ''));
      b.appendChild(el('span', 'mark'));
      if (major) b.appendChild(el('span', 'lbl', RUN.labelOf(run.line, k)));
      b.addEventListener('click', () => { if (!S.busy) aim(k); });
      sc.appendChild(b);
      S.tickEls.push(b);
    }
    // arc preview, ghost, stones, hero
    S.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    S.svg.setAttribute('class', 'run-arc');
    S.svg.setAttribute('viewBox', '0 0 100 100');
    S.svg.setAttribute('preserveAspectRatio', 'none');
    S.arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    S.svg.appendChild(S.arc);
    sc.appendChild(S.svg);
    S.ghost = img('c1', 'run-ghost');
    S.ghost.hidden = true;
    sc.appendChild(S.ghost);
    S.hero = el('div', 'run-hero');
    S.hero.append(img('c0', 'f0'), img('c1', 'f1'));
    sc.appendChild(S.hero);
    const gap = (sc.clientWidth || 340) * ((X1 - X0) / 100) / (run.ticks - 1);
    sc.style.setProperty('--hs', Math.max(30, Math.min(56, gap * 1.9)) + 'px');
    S.stones = [];
    S.at = run.checkpoints[0].from;
    addStone(S.at, false);
    placeHero(S.at);
  }

  function addStone(k, withFlag) {
    const st = el('div', 'run-stone');
    st.style.left = xOf(k) + '%';
    st.appendChild(img('t1', 'top'));
    st.appendChild(img('t5', 'base'));
    if (withFlag) {
      const f = el('div', 'run-flag');
      f.append(img('t111', 'a'), img('t112', 'b'));
      st.appendChild(f);
    }
    $('runScene').appendChild(st);
    S.stones.push(st);
    return st;
  }

  function placeHero(k) {
    S.at = k;
    S.hero.style.left = xOf(k) + '%';
    S.hero.style.transform = '';
    S.hero.style.opacity = '';
  }

  function startCheckpoint() {
    const cp = S.run.checkpoints[S.cp];
    S.aimAt = null;
    S.misses = 0;
    S.hints = 0;
    S.busy = false;
    $('runSign').innerHTML = '';
    $('runSign').append(el('span', 'run-sign-k', 'Flag ' + (S.cp + 1) + ' of ' + S.run.checkpoints.length), el('strong', 'run-sign-t', cp.text));
    $('runMsg').className = 'run-msg';
    $('runMsg').textContent = cp.kind === 'hop' ? 'A hop is a distance. Count it off from where you stand.' : 'Find the spot on the line. Tap a tick to aim.';
    S.tickEls.forEach((b) => b.classList.remove('aimed', 'miss'));
    S.ghost.hidden = true;
    S.arc.setAttribute('d', '');
    paintButtons();
  }

  /* ---------- aiming ---------- */

  function aim(k) {
    if (k < 0 || k >= S.run.ticks || S.busy) return;
    S.aimAt = k;
    Sfx.play('card');
    S.tickEls.forEach((b, i) => b.classList.toggle('aimed', i === k));
    S.ghost.hidden = false;
    S.ghost.style.left = xOf(k) + '%';
    const x1 = xOf(S.at);
    const x2 = xOf(k);
    const mid = (x1 + x2) / 2;
    const h = Math.min(30, 12 + Math.abs(x2 - x1) * 0.35);
    S.arc.setAttribute('d', 'M' + x1 + ' ' + (ROPE_Y - 4) + ' Q' + mid + ' ' + (ROPE_Y - 4 - h * 2) + ' ' + x2 + ' ' + (ROPE_Y - 4));
    paintButtons();
  }

  function nudge(d) {
    if (S.busy) return;
    const from = S.aimAt == null ? S.at : S.aimAt;
    aim(Math.max(0, Math.min(S.run.ticks - 1, from + d)));
  }

  function paintButtons() {
    $('runJump').disabled = S.busy || S.aimAt == null || S.aimAt === S.at;
    $('runLeft').disabled = $('runRight').disabled = $('runHint').disabled = S.busy;
  }

  /* ---------- jumping ---------- */

  function arcTo(fromK, toK, ms, then) {
    const sc = $('runScene');
    const w = sc.clientWidth || 340;
    const dx = ((xOf(toK) - xOf(fromK)) / 100) * w;
    const h = Math.min(sc.clientHeight * 0.4, 34 + Math.abs(dx) * 0.3);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push({ transform: 'translate(' + dx * t + 'px,' + -4 * h * t * (1 - t) + 'px) scale(' + (1 + 0.12 * Math.sin(t * Math.PI)) + ')' }); }
    if (reduced() || !S.hero.animate) { placeHero(toK); then(); return; }
    S.hero.classList.add('air');
    const a = S.hero.animate(pts, { duration: ms, easing: 'linear' });
    let done = false;
    const fin = () => { if (done || !S) return; done = true; S.hero.classList.remove('air'); placeHero(toK); then(); };
    a.onfinish = fin;
    later(fin, ms + 120); // the game never waits on an animation event (a hidden tab can pause animations)
  }

  function jump() {
    if (S.busy || S.aimAt == null || S.aimAt === S.at) return;
    const k = S.aimAt;
    const cpIndex = S.cp;
    const res = RUN.check(S.run, cpIndex, k);
    S.busy = true;
    paintButtons();
    S.arc.setAttribute('d', '');
    S.ghost.hidden = true;
    Sfx.play('place');
    S.hero.classList.add('crouch');
    later(() => S.hero.classList.remove('crouch'), 140);
    const from = S.at;
    later(() => arcTo(from, k, 380 + Math.abs(xOf(k) - xOf(from)) * 6, () => (res.ok ? landed(k, res) : splash(k, res, from))), reduced() ? 0 : 140);
  }

  function landed(k, res) {
    const cp = S.run.checkpoints[S.cp];
    Store.record(ctx.profile, cp.kind === 'hop' ? 'numberline-hop' : 'numberline', true);
    Sfx.play('solved');
    const st = addStone(k, true);
    st.classList.add('rise');
    coins(k);
    S.hero.classList.add('cheer');
    later(() => S.hero.classList.remove('cheer'), 600);
    $('runMsg').className = 'run-msg good';
    $('runMsg').textContent = res.msg;
    S.tickEls.forEach((b) => b.classList.remove('aimed', 'miss'));
    S.cp++;
    if (S.cp >= S.run.checkpoints.length) later(finishRun, 1000);
    else later(startCheckpoint, 1500);
  }

  function coins(k) {
    const sc = $('runScene');
    for (let i = 0; i < 4; i++) {
      const c = img('t151', 'run-coin');
      c.style.left = xOf(k) + (i - 1.5) * 2.2 + '%';
      c.style.setProperty('--d', i * 60 + 'ms');
      sc.appendChild(c);
      later(() => c.remove(), 1100);
    }
  }

  function splash(k, res, from) {
    const cp = S.run.checkpoints[S.cp];
    Store.record(ctx.profile, cp.kind === 'hop' ? 'numberline-hop' : 'numberline', false);
    S.slips++;
    S.misses++;
    Sfx.play('wrong');
    S.tickEls[k].classList.add('miss');
    const sc = $('runScene');
    const sp = el('div', 'run-splash');
    sp.style.left = xOf(k) + '%';
    sp.append(el('i'), el('i'), el('i'));
    sc.appendChild(sp);
    later(() => sp.remove(), 800);
    S.hero.classList.add('sink');
    $('runMsg').className = 'run-msg bad';
    $('runMsg').textContent = res.msg;
    later(() => {
      S.hero.classList.remove('sink');
      placeHero(from);
      S.hero.classList.add('pop');
      later(() => S.hero.classList.remove('pop'), 400);
      S.busy = false;
      S.aimAt = null;
      paintButtons();
      if (S.misses === 2) giveHint(true);
    }, reduced() ? 100 : 750);
  }

  function giveHint(auto) {
    if (S.busy && !auto) return;
    const text = RUN.hint(S.run, S.cp, S.hints > 0 ? 1 : 0);
    S.hints++;
    S.slips++;
    Sfx.play('flip');
    $('runMsg').className = 'run-msg hint';
    $('runMsg').textContent = '';
    const im = el('img', 'run-bulb');
    im.src = 'assets/kenney/ui/emote_idea.png';
    im.alt = '';
    $('runMsg').append(im, document.createTextNode(' ' + (auto ? 'Stuck? ' : '') + text));
  }

  function finishRun() {
    S.busy = true;
    const stars = RUN.runStars(S.slips);
    const prof = ctx.profile;
    if (!S.counted) {
      S.counted = true;
      Store.bump(Store.game(prof, 'runner'), 'runs');
      if (stars === 3) Store.bump(Store.game(prof, 'runner'), 'perfect');
    }
    S.stars += stars;
    ctx.onSave();
    Sfx.play('win');
    S.hero.classList.add('cheer');
    if (stars === 3) later(() => Sfx.say('correct'), 800);
    later(() => UI.panel({
      icon: 'medals/m' + stars,
      title: stars === 3 ? (S.slips === 0 ? 'Perfect run! ⭐⭐⭐' : 'Great run! ⭐⭐⭐') : stars === 2 ? 'You made it! ⭐⭐' : 'You made it across! ⭐',
      text: S.slips === 0 ? 'Every landing exact, and no hints.' : S.slips + (S.slips === 1 ? ' slip' : ' slips') + ' (splashes and hints count). Fewer slips means more stars.',
      btn: 'Next run',
      onBtn: newRun,
      btn2: 'Back to setup',
      onBtn2: exit,
    }), 1100);
  }

  root.Runner = { start };
})(window);
