/* Arrow Range screen. A side-view archery field in the mist. A scout's note says where the target is; the target is hidden, so you work out the
 * number, aim on the distance ruler (and the height ruler when the shot has height), and loose. The arrow flies in a visual arc that always ends on
 * the spot you aimed at (wind pushes it: see ARCH.check). A hit parts the mist and reveals the target; a miss sticks the arrow where it landed and the
 * message counts the ticks you were off. After four aimed shots comes the scoring board (choose rings that add to an exact total).
 * Logic and all the wording of results live in js/archerylogic.js. Scene brief: docs/scene-briefs.md. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const IMG = 'assets/kenney/archery/';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const ARROW_W = 46;
  const ARROW_SVG = '<svg viewBox="0 0 46 8" width="46" height="8" aria-hidden="true"><path d="M2 4h36" stroke="#6b4a2b" stroke-width="2" stroke-linecap="round"/><path d="M37 .6 46 4 37 7.4z" fill="#8a97a6"/><path d="M0 .6h3.2L6 4 3.2 7.4H0L2.8 4z" fill="#e5532d"/><path d="M5 .6h3.2L11 4 8.2 7.4H5L7.8 4z" fill="#e5532d"/></svg>';
  const BOW_SVG = '<svg viewBox="0 0 26 60" width="26" height="60" aria-hidden="true"><path d="M5 2Q26 30 5 58" fill="none" stroke="#7a4a1d" stroke-width="4" stroke-linecap="round"/><path d="M5 2V58" stroke="#fff6dd" stroke-width="1.2"/></svg>';
  const RING_COLORS = ['#e9edf1', '#3a4656', '#2f8fd8', '#e5532d', '#ffd23f'];
  const X1 = 94;
  let ctx = null;
  let S = null;
  let bound = false;
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(() => { if (S) fn(); }, ms); timers.push(t); return t; };
  const clearTimers = () => timers.splice(0).forEach(clearTimeout);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const img = (src, cls) => { const i = el('img', cls); i.src = IMG + src + '.png'; i.alt = ''; i.draggable = false; return i; };
  const reduced = () => UI.reduced();
  const shot = () => S.round.shots[S.i];
  const needsX = (s) => ARCH.X_KINDS.includes(s.kind);
  const needsY = (s) => ARCH.Y_KINDS.includes(s.kind);

  function init() {
    if (bound) return;
    bound = true;
    $('arBack').addEventListener('click', exit);
    $('arLoose').addEventListener('click', () => (S && S.phase === 'board' ? looseBoard() : loose()));
    $('arLeft').addEventListener('click', () => nudge(-1, 0));
    $('arRight').addEventListener('click', () => nudge(1, 0));
    $('arUp').addEventListener('click', () => nudge(0, 1));
    $('arDown').addEventListener('click', () => nudge(0, -1));
    $('arHint').addEventListener('click', () => giveHint(false));
    Keys.hint($('arKeys'), 'Keys: ◀ ▶ aim across · ▲ ▼ aim up and down · Enter shoots · H hint. On the board: 1-4 pick a ring, Backspace takes one back.');
    Keys.on('archery', (e) => {
      if (!S || S.busy) return false;
      if (S.phase === 'board') {
        if (e.key === 'Enter') { looseBoard(); return true; }
        if (e.key === 'h' || e.key === 'H') { giveHint(false); return true; }
        if (e.key >= '1' && e.key <= '9') { addRing(S.ringOrder.slice().reverse()[parseInt(e.key, 10) - 1]); return true; } // number keys pick the Nth ring as shown (biggest first)
        if (e.key === 'Backspace') { S.picks.pop(); paintBoard(); return true; }
        return false;
      }
      if (e.key === 'ArrowLeft') { nudge(-1, 0); return true; }
      if (e.key === 'ArrowRight') { nudge(1, 0); return true; }
      if (e.key === 'ArrowUp') { nudge(0, 1); return true; }
      if (e.key === 'ArrowDown') { nudge(0, -1); return true; }
      if (e.key === 'Enter') { loose(); return true; }
      if (e.key === 'h' || e.key === 'H') { giveHint(false); return true; }
      return false;
    });
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { n: 0, stars: 0 };
    newRound();
  }

  function exit() {
    clearTimers();
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  /* ---------- geometry: everything is a % of the scene ---------- */
  function geometry(round) {
    const hasY = !!round.yLine;
    const g = { hasY, X0: hasY ? 22 : 12 };
    g.xOf = (k) => g.X0 + (k / (round.ticksX - 1)) * (X1 - g.X0);
    if (!hasY) { g.GY = 70; return g; }
    const yl = round.yLine;
    const NY = round.ticksY;
    g.YTOP = 10;
    g.YBOT = yl.lo >= 0 ? 74 : 90;
    g.yOf = (k) => g.YTOP + (1 - k / (NY - 1)) * (g.YBOT - g.YTOP);
    g.ground = yl.lo >= 0 ? 0 : (0 - yl.lo) / yl.step; // the tick that is ground level (height 0)
    g.GY = g.yOf(g.ground);
    return g;
  }
  const xl = () => S.round.xLine;
  const yl = () => S.round.yLine;
  const wrX = (k) => RUN.writeValue(xl(), RUN.valueAt(xl(), k), xl().modes[0]);
  const wrY = (k) => RUN.writeValue(yl(), RUN.valueAt(yl(), k), yl().modes[0]);

  /* ---------- a round ---------- */
  function newRound() {
    clearTimers();
    const st = Store.level(ctx.profile, 'archery');
    S.n++;
    S.round = ARCH.makeRound(st.band, st.stars);
    S.G = geometry(S.round);
    S.i = 0;
    S.slips = 0;
    S.counted = false;
    S.busy = false;
    S.phase = 'shots';
    $('arNo').textContent = 'Round ' + S.n;
    $('arLoose').textContent = 'Loose!';
    $('arScene').hidden = false;
    $('arBoard').hidden = true;
    buildScene();
    startShot();
  }

  function buildScene() {
    const G = S.G;
    const round = S.round;
    const sc = $('arScene');
    sc.innerHTML = '';
    sc.classList.toggle('tall', G.hasY);
    sc.classList.toggle('dig', G.hasY && round.yLine.lo < 0);
    sc.style.setProperty('--gy', G.GY + '%');
    S.E = {};
    sc.append(el('div', 'ar-hills h2'), el('div', 'ar-hills h1'));
    const ground = el('div', 'ar-ground');
    ground.style.top = G.GY + '%';
    sc.appendChild(ground);
    const bush = img('bush1', 'ar-deco');
    bush.style.cssText = 'left:' + (G.hasY ? 17 : 4) + '%;bottom:' + (100 - G.GY - 1) + '%;width:12%';
    const tree = img('treeSmall_green1', 'ar-deco');
    tree.style.cssText = 'left:96%;bottom:' + (100 - G.GY - 1) + '%;width:7%';
    sc.append(bush, tree);
    // the wall for height shots: a stack of castle-wall blocks from the top tick down to the lowest tick
    const wall = el('div', 'ar-wall');
    wall.style.top = (G.hasY ? G.YTOP - 3 : 0) + '%';
    wall.style.bottom = G.hasY ? (round.yLine.lo >= 0 ? 100 - G.GY - 0 : 100 - G.YBOT - 4) + '%' : '0';
    wall.hidden = true;
    sc.appendChild(wall);
    S.E.wall = wall;
    // the distance ruler lies along the ground
    const rail = el('div', 'ar-rail');
    rail.style.cssText = 'left:' + G.X0 + '%;width:' + (X1 - G.X0) + '%;top:' + G.GY + '%';
    sc.appendChild(rail);
    S.E.xt = [];
    for (let k = 0; k < round.ticksX; k++) {
      const major = !!RUN.labelOf(round.xLine, k);
      const t = el('span', 'ar-xt' + (major ? ' major' : ''));
      t.style.left = G.xOf(k) + '%';
      t.style.top = G.GY + '%';
      t.setAttribute('aria-hidden', 'true');
      sc.appendChild(t);
      S.E.xt.push(t);
      if (major) { const l = el('span', 'ar-xl', RUN.labelOf(round.xLine, k)); l.style.left = G.xOf(k) + '%'; l.style.top = G.GY + '%'; sc.appendChild(l); }
    }
    // the height ruler stands on the left edge
    S.E.yt = [];
    if (G.hasY) {
      const axis = el('div', 'ar-axis');
      axis.style.cssText = 'left:' + (G.X0 - 8) + '%;top:' + G.yOf(round.ticksY - 1) + '%;height:' + (G.yOf(0) - G.yOf(round.ticksY - 1)) + '%';
      sc.appendChild(axis);
      for (let k = 0; k < round.ticksY; k++) {
        const major = !!RUN.labelOf(round.yLine, k);
        const t = el('span', 'ar-yt' + (major ? ' major' : '') + (k === G.ground ? ' ground' : ''));
        t.style.left = G.X0 - 8 + '%';
        t.style.top = G.yOf(k) + '%';
        t.setAttribute('aria-hidden', 'true');
        sc.appendChild(t);
        S.E.yt.push(t);
        if (major) { const l = el('span', 'ar-yl', RUN.labelOf(round.yLine, k)); l.style.left = G.X0 - 9 + '%'; l.style.top = G.yOf(k) + '%'; sc.appendChild(l); }
      }
    }
    // wind flag, archer, platform, bow
    const flag = el('div', 'ar-flag');
    flag.style.cssText = 'left:' + (G.X0 + 9) + '%;bottom:' + (100 - G.GY) + '%';
    flag.append(img('flagRed1', 'a'), img('flagRed2', 'b'), img('flagRed_down', 'c'));
    const wlab = el('span', 'ar-wind');
    flag.appendChild(wlab);
    sc.appendChild(flag);
    S.E.flag = flag;
    S.E.wlab = wlab;
    const plat = el('div', 'ar-platform');
    plat.hidden = true;
    sc.appendChild(plat);
    S.E.plat = plat;
    const who = 'male';
    S.who = who;
    const archer = img(who + '_idle', 'ar-archer');
    sc.appendChild(archer);
    S.E.archer = archer;
    ['idle', 'hold', 'attack0', 'attack1', 'cheer0', 'hurt'].forEach((p) => { const pre = new Image(); pre.src = IMG + who + '_' + p + '.png'; });
    const bow = el('div', 'ar-bow');
    bow.innerHTML = BOW_SVG;
    sc.appendChild(bow);
    S.E.bow = bow;
    // mist hides the target; the aim marker and the dashed preview arc sit on top
    const mist = el('div', 'ar-mist');
    mist.style.cssText = 'left:' + (G.X0 + 13) + '%;top:' + (G.hasY ? G.YTOP - 4 : 22) + '%;bottom:' + (100 - G.GY - 2) + '%';
    mist.append(img('cloudLayer1', 'm1'), img('cloud2', 'm2'), img('cloud1', 'm3'));
    sc.appendChild(mist);
    S.E.mist = mist;
    S.E.svg = document.createElementNS(SVGNS, 'svg');
    S.E.svg.setAttribute('class', 'ar-arc');
    S.E.svg.setAttribute('viewBox', '0 0 100 100');
    S.E.svg.setAttribute('preserveAspectRatio', 'none');
    S.E.arc = document.createElementNS(SVGNS, 'path');
    S.E.svg.appendChild(S.E.arc);
    sc.appendChild(S.E.svg);
    const mark = el('div', 'ar-mark');
    mark.hidden = true;
    sc.appendChild(mark);
    S.E.mark = mark;
    // press anywhere on the field and slide: the aim snaps to the nearest ticks, so even a 21-tick ruler has thumb-sized targets
    let dragging = false;
    const nearest = (ev) => {
      const r = sc.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * 100;
      const py = ((ev.clientY - r.top) / r.height) * 100;
      return {
        x: Math.max(0, Math.min(round.ticksX - 1, Math.round(((px - G.X0) / (X1 - G.X0)) * (round.ticksX - 1)))),
        y: G.hasY ? Math.max(0, Math.min(round.ticksY - 1, Math.round((1 - (py - G.YTOP) / (G.YBOT - G.YTOP)) * (round.ticksY - 1)))) : null,
      };
    };
    const apply = (ev) => {
      if (S.busy || S.phase !== 'shots') return;
      const s = shot();
      const n = nearest(ev);
      aim(needsX(s) ? n.x : S.aimX, needsY(s) ? n.y : S.aimY, true);
    };
    sc.addEventListener('pointerdown', (ev) => { if (S.busy) return; dragging = true; try { sc.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } apply(ev); });
    sc.addEventListener('pointermove', (ev) => { if (dragging) apply(ev); });
    const stop = () => { dragging = false; };
    sc.addEventListener('pointerup', stop);
    sc.addEventListener('pointercancel', stop);
    sizeArcher();
  }

  function sizeArcher() {
    const sc = $('arScene');
    const W = sc.clientWidth || 340;
    S.asz = Math.max(40, Math.min(70, W * 0.14));
    sc.style.setProperty('--as', S.asz + 'px');
  }

  const px = (pctX, pctY) => { const sc = $('arScene'); return { x: (pctX / 100) * (sc.clientWidth || 340), y: (pctY / 100) * (sc.clientHeight || 272) }; };

  /** Where the archer's feet are (a platform raises them for height-difference shots). */
  function feetY(s) { return s.kind === 'lift' ? S.G.yOf(s.platform) : S.G.GY; }
  function bowPoint(s) {
    const p = px(S.G.xOf(0), feetY(s));
    return { x: p.x + S.asz * 0.38, y: p.y - S.asz * (128 / 96) * 0.52 };
  }

  /* ---------- a shot ---------- */
  function startShot() {
    const s = shot();
    const G = S.G;
    S.aimX = null;
    S.aimY = null;
    S.misses = 0;
    S.hints = 0;
    S.busy = false;
    S.phase = 'shots';
    const E = S.E;
    $('arSign').innerHTML = '';
    $('arSign').append(el('span', 'ar-sign-k', 'Shot ' + (S.i + 1) + ' of ' + S.round.shots.length), el('strong', 'ar-sign-t', s.text));
    $('arMsg').className = 'ar-msg';
    $('arMsg').textContent = msgFor(s);
    pose('idle');
    const bp = bowPoint(s);
    E.bow.style.left = bp.x + 'px';
    E.bow.style.top = bp.y + 'px';
    E.bow.style.transform = 'translate(-30%,-50%)';
    // the archer, and a platform when the shot is measured from where you stand
    const fy = feetY(s);
    E.archer.style.left = G.xOf(0) + '%';
    E.archer.style.bottom = 100 - fy + '%';
    E.plat.hidden = s.kind !== 'lift';
    if (s.kind === 'lift') {
      E.plat.style.cssText = 'left:' + G.xOf(0) + '%;top:' + fy + '%;height:' + Math.max(0, G.GY - fy) + '%';
    }
    // the wall for height shots stands at its tower tick
    const hasWall = s.kind === 'height' || s.kind === 'lift';
    E.wall.hidden = !hasWall;
    if (hasWall) E.wall.style.left = G.xOf(s.tower) + '%';
    // the wind flag: calm unless this shot has wind; it points the way the wind blows
    const w = s.kind === 'wind' ? s.wind : 0;
    E.flag.className = 'ar-flag' + (w === 0 ? ' calm' : '') + (Math.abs(w) >= 3 ? ' strong' : '') + (w < 0 ? ' left' : '');
    E.wlab.textContent = w === 0 ? '' : (w > 0 ? '→ ' : '← ') + RUN.writeValue(xl(), Math.abs(w) * xl().step, xl().modes[0]);
    // mist covers the target area again; arrows from a miss are cleared, a hop keeps the last arrow stuck in the ground
    E.mist.classList.remove('lift');
    if (S.target) { S.target.remove(); S.target = null; }
    clearArrows(s.kind === 'hop');
    E.mark.hidden = true;
    E.arc.setAttribute('d', '');
    E.xt.forEach((t) => t.classList.remove('aimed'));
    E.yt.forEach((t) => t.classList.remove('aimed'));
    $('arLeft').hidden = $('arRight').hidden = !needsX(s);
    $('arUp').hidden = $('arDown').hidden = !needsY(s);
    paint();
  }

  const msgFor = (s) => ({
    dist: 'The target is hidden in the mist. Work out the number, then tap that spot on the ruler along the ground and press Loose!',
    hop: 'A hop is a distance. Count it off from your last arrow, tap that spot on the ruler along the ground, then press Loose!',
    wind: 'The wind will push your arrow. Tap the spot on the ground ruler where you must aim so the wind carries it onto the target, then press Loose!',
    height: 'The target is somewhere up the wall. Work out its height, tap that number on the height ruler (the strip on the left), then press Loose!',
    lift: 'Work out the target\'s height from where you stand, tap that number on the height ruler (the strip on the left), then press Loose!',
    coord: 'Two numbers: across and up. Tap the spot on the field where they meet (or tap each ruler), then press Loose!',
  }[s.kind]);

  function pose(name) { if (S && S.E) S.E.archer.src = IMG + S.who + '_' + name + '.png'; }

  /* ---------- aiming ---------- */
  function aim(x, y, fromPointer) {
    const s = shot();
    if (S.busy) return;
    const same = x === S.aimX && y === S.aimY;
    S.aimX = needsX(s) ? x : null;
    S.aimY = needsY(s) ? y : null;
    if (same && fromPointer) return;
    Sfx.play('card');
    const G = S.G;
    const E = S.E;
    E.xt.forEach((t, k) => t.classList.toggle('aimed', S.aimX === k));
    E.yt.forEach((t, k) => t.classList.toggle('aimed', S.aimY === k));
    const ready = (!needsX(s) || S.aimX != null) && (!needsY(s) || S.aimY != null);
    if (ready) {
      const m = markPos(s);
      E.mark.hidden = false;
      E.mark.style.left = m.x + '%';
      E.mark.style.top = m.y + '%';
      const b = bowPoint(s);
      const target = px(m.x, m.y);
      const sc = $('arScene');
      const W = sc.clientWidth || 340;
      const H = sc.clientHeight || 272;
      const sx = (b.x / W) * 100;
      const sy = (b.y / H) * 100;
      const lift = Math.min(28, 8 + Math.abs(m.x - sx) * 0.25);
      E.arc.setAttribute('d', 'M' + sx + ' ' + sy + ' Q' + (sx + m.x) / 2 + ' ' + (Math.min(sy, m.y) - lift) + ' ' + m.x + ' ' + m.y);
      const ang = Math.atan2(b.y - target.y, target.x - b.x) * (180 / Math.PI);
      E.bow.style.transform = 'translate(-30%,-50%) rotate(' + -Math.max(-55, Math.min(55, ang * 0.7)) + 'deg)';
      pose('hold');
    }
    paint();
  }

  /** Where the aim marker sits (% of the scene): at the aimed distance and height, on the ground when the shot has no height. */
  function markPos(s) {
    const G = S.G;
    const x = needsX(s) ? G.xOf(S.aimX) : G.xOf(s.tower);
    const y = needsY(s) ? G.yOf(S.aimY) : G.GY - 2;
    return { x, y };
  }

  function nudge(dx, dy) {
    const s = shot();
    if (S.busy || S.phase !== 'shots') return;
    let x = S.aimX;
    let y = S.aimY;
    if (dx && needsX(s)) x = Math.max(0, Math.min(S.round.ticksX - 1, (x == null ? 0 : x) + dx));
    if (dy && needsY(s)) {
      const base = s.kind === 'lift' ? s.platform : S.G.ground || 0;
      y = Math.max(0, Math.min(S.round.ticksY - 1, (y == null ? base : y) + dy));
    }
    // a shot with both rulers needs both numbers; start the other one at its zero so one nudge is enough to see the marker
    if (needsX(s) && x == null) x = 0;
    if (needsY(s) && y == null) y = s.kind === 'lift' ? s.platform : S.G.ground || 0;
    aim(x, y, false);
  }

  function paint() {
    const s = S.phase === 'shots' ? shot() : null;
    const ready = !!s && (!needsX(s) || S.aimX != null) && (!needsY(s) || S.aimY != null);
    $('arLoose').disabled = S.busy || !ready;
    ['arLeft', 'arRight', 'arUp', 'arDown', 'arHint'].forEach((id) => { $(id).disabled = S.busy; });
    const aimEl = $('arAim');
    if (!s) { aimEl.textContent = ''; return; }
    if (S.aimX == null && S.aimY == null) {
      aimEl.textContent = needsX(s) && needsY(s) ? 'Tap the field to aim' : needsY(s) ? 'Tap the height ruler on the left to aim' : 'Tap the ruler along the ground to aim';
      return;
    }
    const parts = [];
    if (needsX(s)) parts.push('across ' + (S.aimX == null ? '?' : wrX(S.aimX)));
    if (needsY(s)) parts.push('height ' + (S.aimY == null ? '?' : wrY(S.aimY)));
    aimEl.textContent = 'You are aiming at: ' + parts.join(', ');
  }

  /* ---------- arrows ---------- */
  function clearArrows(keepHit) {
    (S.arrows || []).forEach((a) => { if (!keepHit || a.classList.contains('miss')) a.remove(); });
    S.arrows = (S.arrows || []).filter((a) => a.isConnected);
  }

  /** Fly an arrow along the visual arc and leave it stuck at `to` (px in `host`). Always ends exactly on `to`. */
  function flyArrow(host, from, to, ms, cls, then) {
    const a = el('div', 'ar-arrow ' + (cls || ''));
    a.innerHTML = ARROW_SVG;
    host.appendChild(a);
    (S.arrows = S.arrows || []).push(a);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const pts = ARCH.arcPoints(from, to, 18, -Math.min(host.clientHeight * 0.45, 26 + dist * 0.28));
    const tf = (p, ang) => 'translate(' + (p.x - ARROW_W) + 'px,' + (p.y - 4) + 'px) rotate(' + ang + 'deg)';
    const angs = pts.map((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)]; const r = pts[Math.max(i - 1, 0)]; return Math.atan2(q.y - r.y, q.x - r.x) * (180 / Math.PI); });
    const last = tf(pts[pts.length - 1], angs[angs.length - 1]);
    let done = false;
    const fin = () => { if (done || !S) return; done = true; a.style.transform = last; a.classList.add('stuck'); then(); };
    if (reduced() || !a.animate) { a.style.transform = last; fin(); return a; }
    a.style.transform = tf(pts[0], angs[0]);
    const anim = a.animate(pts.map((p, i) => ({ transform: tf(p, angs[i]) })), { duration: ms, easing: 'linear', fill: 'forwards' });
    anim.onfinish = fin;
    later(fin, ms + 150); // the game never waits on an animation event (a hidden tab can pause animations)
    return a;
  }

  /* ---------- loosing ---------- */
  function loose() {
    if (S.busy || S.phase !== 'shots') return;
    const s = shot();
    if ((needsX(s) && S.aimX == null) || (needsY(s) && S.aimY == null)) return;
    const res = ARCH.check(S.round, S.i, { x: S.aimX, y: S.aimY });
    const G = S.G;
    S.busy = true;
    paint();
    S.E.arc.setAttribute('d', '');
    S.E.mark.hidden = true;
    clearArrows(true);
    Sfx.play('twang');
    pose('attack0');
    const from = bowPoint(s);
    // where the arrow comes down: the landing spot. A hit ends at the heart of the (hidden) target; a miss on the flat ground ends in the grass.
    const lx = needsX(s) ? res.landX : s.tower;
    const sc = $('arScene');
    const tsz = Math.max(30, Math.min(54, (sc.clientWidth || 340) * 0.12));
    let to;
    if (needsY(s)) to = px(G.xOf(lx), G.yOf(res.landY));
    else { const g = px(G.xOf(lx), G.GY); to = { x: g.x, y: res.ok ? g.y - tsz / 2 : g.y - 3 }; }
    const dx = Math.abs(to.x - from.x);
    const ms = reduced() ? 0 : 480 + Math.min(520, dx * 1.6);
    later(() => {
      pose('attack1');
      Sfx.play('fly');
      flyArrow(sc, from, to, ms, res.ok ? 'hit' : 'miss', () => landed(res, s, to, tsz));
    }, reduced() ? 0 : 200);
  }

  function landed(res, s, to, tsz) {
    const G = S.G;
    ARCH.skillsOf(s.kind).forEach((id) => Store.record(ctx.profile, id, res.ok));
    Sfx.play('thunk');
    $('arMsg').className = 'ar-msg ' + (res.ok ? 'good' : 'bad');
    $('arMsg').textContent = res.msg;
    if (res.ok) {
      later(() => Sfx.play('solved'), 150);
      pose('cheer0');
      revealTarget(s, tsz);
      S.E.mist.classList.add('lift');
      UI.burst($('arScene'), reduced() ? 0 : 10);
      S.i++;
      if (S.i >= S.round.shots.length) later(startBoard, 1700);
      else later(startShot, 2000);
    } else {
      later(() => Sfx.play('wrong'), 150);
      S.slips++;
      S.misses++;
      pose('hurt');
      if (needsX(s) && res.landX >= 0 && res.landX < S.round.ticksX) S.E.xt[res.landX].classList.add('miss');
      later(() => {
        S.E.xt.forEach((t) => t.classList.remove('miss'));
        pose(S.aimX != null || S.aimY != null ? 'hold' : 'idle');
        S.busy = false;
        S.aimX = S.aimY = null;
        S.E.xt.forEach((t) => t.classList.remove('aimed'));
        S.E.yt.forEach((t) => t.classList.remove('aimed'));
        pose('idle');
        paint();
        if (S.misses === 2) giveHint(true);
      }, reduced() ? 100 : 800);
    }
  }

  /** The mist parts and the real target stands where the scout said. Only a hit shows it, so a miss never gives the spot away. */
  function revealTarget(s, tsz) {
    const G = S.G;
    const t = el('div', 'ar-target');
    const x = G.xOf(needsX(s) ? s.tx : s.tower);
    const cy = needsY(s) ? G.yOf(s.ty) : G.GY;
    t.style.left = x + '%';
    t.style.width = tsz + 'px';
    if (needsY(s)) {
      t.style.top = cy + '%';
      t.style.marginTop = -tsz / 2 + 'px';
      if (s.kind === 'coord') { const post = img('post', 'pole'); post.style.height = Math.max(0, G.GY - cy) + '%'; t.appendChild(post); }
    } else {
      t.style.top = G.GY + '%';
      t.style.marginTop = -tsz + 'px';
    }
    t.insertBefore(img('target_colored', 'face'), t.firstChild);
    $('arScene').appendChild(t);
    S.target = t;
  }

  /* ---------- hints ---------- */
  function giveHint(auto) {
    if (S.busy && !auto) return;
    const text = S.phase === 'board' ? ARCH.hintBoard(S.board, S.hints > 0 ? 1 : 0) : ARCH.hint(S.round, S.i, S.hints > 0 ? 1 : 0);
    S.hints++;
    if (!auto) S.slips++; // a hint you ask for costs a slip; the one that appears after two misses does not (the misses already counted)
    Sfx.play('flip');
    $('arMsg').className = 'ar-msg hint';
    $('arMsg').textContent = '';
    const im = el('img', 'ar-bulb');
    im.src = 'assets/kenney/ui/emote_idea.png';
    im.alt = '';
    $('arMsg').append(im, document.createTextNode(' ' + (auto ? 'Stuck? ' : '') + text));
  }

  /* ---------- the scoring board ---------- */
  function startBoard() {
    S.phase = 'board';
    S.board = S.round.board;
    S.picks = [];
    S.busy = false;
    S.hints = 0;
    S.misses = 0;
    clearArrows(false);
    const b = S.board;
    $('arSign').innerHTML = '';
    $('arSign').append(el('span', 'ar-sign-k', 'Scoring board'), el('strong', 'ar-sign-t', b.text));
    $('arMsg').className = 'ar-msg';
    $('arMsg').textContent = 'Tap a ring to send an arrow into it. Tap an arrow in a slot to take it back.';
    $('arScene').hidden = true;
    const host = $('arBoard');
    host.hidden = false;
    host.innerHTML = '';
    // the target: outer ring is the smallest value, the bullseye the biggest
    const order = b.rings.map((v, i) => i).sort((p, q) => b.rings[p] - b.rings[q]);
    S.ringOrder = order;
    const wrap = el('div', 'ar-bt');
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '-110 -110 220 220');
    svg.setAttribute('class', 'ar-bt-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'A target with rings worth ' + b.rings.map((v) => ARCH.ringText(b, v)).join(', '));
    const n = order.length;
    S.ringColor = {};
    order.forEach((ri, j) => {
      const r = 104 - j * (74 / (n - 1));
      const c = document.createElementNS(SVGNS, 'circle');
      const color = b.rings[ri] < 0 ? '#8d2f3a' : RING_COLORS[Math.min(RING_COLORS.length - 1, j + (b.rings.some((v) => v < 0) ? 0 : 1))];
      S.ringColor[ri] = color;
      c.setAttribute('r', r);
      c.setAttribute('fill', color);
      c.setAttribute('stroke', '#fff');
      c.setAttribute('stroke-width', '2');
      c.setAttribute('class', 'ring r' + ri);
      svg.appendChild(c);
    });
    order.forEach((ri, j) => {
      const r = 104 - j * (74 / (n - 1));
      const rNext = j < n - 1 ? 104 - (j + 1) * (74 / (n - 1)) : 0;
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('y', -((r + rNext) / 2) + 5);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'rtxt');
      t.textContent = ARCH.ringText(b, b.rings[ri]);
      svg.appendChild(t);
    });
    wrap.appendChild(svg);
    host.appendChild(wrap);
    S.E.bt = wrap;
    const slots = el('div', 'ar-slots');
    slots.setAttribute('aria-label', 'Your arrows');
    host.appendChild(slots);
    S.E.slots = slots;
    const chips = el('div', 'ar-rings');
    order.slice().reverse().forEach((ri) => {
      const c = el('button', 'ar-ring', ARCH.ringText(b, b.rings[ri]));
      c.type = 'button';
      c.style.background = S.ringColor[ri];
      c.style.color = ['#e9edf1', '#ffd23f'].includes(S.ringColor[ri]) ? '#222' : '#fff';
      c.setAttribute('aria-label', 'Ring worth ' + ARCH.ringText(b, b.rings[ri]));
      c.addEventListener('click', () => addRing(ri));
      chips.appendChild(c);
    });
    host.appendChild(chips);
    S.E.chips = chips;
    ['arLeft', 'arRight', 'arUp', 'arDown'].forEach((id) => { $(id).hidden = true; });
    paintBoard();
  }

  function addRing(ri) {
    if (S.busy || S.phase !== 'board' || ri == null || ri < 0 || ri >= S.board.rings.length || S.picks.length >= S.board.arrows) return;
    Sfx.play('card');
    S.picks.push(ri);
    paintBoard();
  }

  function paintBoard() {
    const b = S.board;
    const slots = S.E.slots;
    slots.innerHTML = '';
    for (let k = 0; k < b.arrows; k++) {
      const filled = k < S.picks.length;
      const s = el('button', 'ar-slot' + (filled ? ' on' : ''), filled ? ARCH.ringText(b, b.rings[S.picks[k]]) : '?');
      s.type = 'button';
      s.disabled = S.busy || !filled;
      if (filled) { s.style.borderColor = S.ringColor[S.picks[k]]; s.setAttribute('aria-label', 'Arrow ' + (k + 1) + ' in the ' + s.textContent + ' ring. Tap to take it back.'); s.addEventListener('click', () => { if (!S.busy) { S.picks.splice(k, 1); paintBoard(); } }); }
      slots.appendChild(s);
    }
    const sum = S.picks.reduce((t, i) => t + b.rings[i], 0);
    $('arAim').textContent = S.picks.length ? 'So far: ' + ARCH.sumText(b, S.picks).replace(/ = .*/, '') + ' = ' + ARCH.ringText(b, sum) : 'Goal: ' + ARCH.ringText(b, b.total);
    $('arLoose').disabled = S.busy || S.picks.length !== b.arrows;
    $('arLoose').textContent = 'Shoot all!';
    S.E.chips.querySelectorAll('button').forEach((c) => { c.disabled = S.busy || S.picks.length >= b.arrows; });
    $('arHint').disabled = S.busy;
  }

  function looseBoard() {
    if (S.busy || S.picks.length !== S.board.arrows) return;
    const b = S.board;
    const res = ARCH.checkBoard(b, S.picks);
    S.busy = true;
    paintBoard();
    clearArrows(false);
    Sfx.play('twang');
    const host = S.E.bt;
    const W = host.clientWidth || 220;
    const H = host.clientHeight || 220;
    const cx = W / 2;
    const cy = H / 2;
    const order = S.ringOrder;
    const unit = (Math.min(W, H) / 220);
    let k = 0;
    const next = () => {
      if (!S) return;
      if (k >= S.picks.length) { later(() => boardDone(res), 250); return; }
      const ri = S.picks[k];
      const j = order.indexOf(ri);
      const n = order.length;
      const r = 104 - j * (74 / (n - 1));
      const rNext = j < n - 1 ? 104 - (j + 1) * (74 / (n - 1)) : 0;
      const rad = ((r + rNext) / 2) * unit;
      const ang = (-Math.PI / 2) + (k - (S.picks.length - 1) / 2) * 0.9 + 0.5;
      const to = { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad };
      k++;
      flyArrow(host, { x: 6, y: H - 8 }, to, reduced() ? 0 : 520, 'board', () => { Sfx.play('thunk'); later(next, reduced() ? 0 : 140); });
    };
    next();
  }

  function boardDone(res) {
    ARCH.skillsOf('board').forEach((id) => Store.record(ctx.profile, id, res.ok));
    $('arMsg').className = 'ar-msg ' + (res.ok ? 'good' : 'bad');
    $('arMsg').textContent = res.msg;
    if (res.ok) {
      later(() => Sfx.play('solved'), 150);
      UI.burst($('arBoard'), reduced() ? 0 : 12);
      later(finishRound, 1500);
    } else {
      later(() => Sfx.play('wrong'), 150);
      S.slips++;
      S.misses++;
      later(() => {
        clearArrows(false);
        S.busy = false;
        paintBoard();
        if (S.misses === 2) giveHint(true);
      }, reduced() ? 100 : 1100);
    }
  }

  /* ---------- the end of a round ---------- */
  function finishRound() {
    S.busy = true;
    const stars = ARCH.roundStars(S.slips);
    const prof = ctx.profile;
    if (!S.counted) {
      S.counted = true;
      Store.bump(Store.game(prof, 'archery'), 'rounds');
      if (stars === 3) Store.bump(Store.game(prof, 'archery'), 'perfect');
    }
    S.stars += stars;
    ctx.onSave();
    Sfx.play('win');
    if (stars === 3) later(() => Sfx.say('correct'), 800);
    later(() => UI.panel({
      icon: 'medals/m' + stars,
      title: stars === 3 ? (S.slips === 0 ? 'Perfect round! ⭐⭐⭐' : 'Great round! ⭐⭐⭐') : stars === 2 ? 'Nice shooting! ⭐⭐' : 'You finished the round! ⭐',
      text: S.slips === 0 ? 'Every arrow hit, and no hints.' : S.slips + (S.slips === 1 ? ' slip' : ' slips') + ' (misses and hints count). Fewer slips means more stars.',
      btn: 'Next round',
      onBtn: newRound,
      btn2: 'Back to setup',
      onBtn2: exit,
    }), 900);
  }

  root.Archery = { start };
})(window);
