/* Creature Quest UI (v2): quest home, team picker / pre-battle, and turn-based battles against groups of monsters.
 * All rules live in js/rpg.js; this file draws the screens, animates what happened, and handles taps.
 * Art comes from js/art.js: pixel "classic" or smooth "cute" sprites and backdrops, chosen in Setup. A missing image falls back
 * to the emoji, so the game always works. Sprites are only a layer on the same ids and classes as before. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['qHome', 'qMap', 'qPuzzle', 'qPrep', 'qBattle'];
  const TYPE_ICON = { battle: '⚔️', elite: '🛡️', boss: '👑', rescue: '🗝️', story: '💬', camp: '⛺', puzzle: '🧩' };
  const TYPE_WORD = { battle: 'Battle', elite: 'Armored monster', boss: 'Boss', rescue: 'Rescue', story: 'Story', camp: 'Camp', puzzle: 'Puzzle' };
  let ctx = null;
  let Q = null;
  let bound = false;

  // tests set window.__questFast = true to skip animation delays
  const wait = (ms) => new Promise((r) => setTimeout(r, root.__questFast ? 0 : ms));
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function showView(id) {
    VIEWS.forEach((v) => ($(v).hidden = v !== id));
    window.scrollTo(0, 0);
  }

  const rpg = () => ctx.profile.games.rpg;
  const sel = () => ctx.profile.settings;
  const theme = () => Art.themeId(ctx.profile);
  // every enemy has art by its skill; armored enemies and bosses have their own
  const enemyArt = (e) => (e.kind === 'boss' ? 'boss' : e.kind === 'armor' ? 'armor' : e.rule.id);
  const enemySprite = (e) => Art.sprite(theme(), 'enemy', enemyArt(e), e.emoji, e.name);
  const allySprite = (c) => Art.sprite(theme(), 'ally', c.id, c.emoji, c.name);
  const putSprite = (slot, node) => { slot.textContent = ''; slot.appendChild(node); };
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const alliesOf = (ids) => ids.map((id) => RPG.creatureById(id)).filter(Boolean);

  function init() {
    if (bound) return;
    bound = true;
    $('qBack').addEventListener('click', exit);
    $('qBegin').addEventListener('click', () => beginRun());
    $('qMyTeam').addEventListener('click', () => openPrep('collection'));
    $('qMapBtn').addEventListener('click', () => goMap());
    $('qResume').addEventListener('click', resumeRun);
    $('qPzBack').addEventListener('click', () => { Q.pz = null; goMap(Q.region); });
    $('qMapBack').addEventListener('click', goHome);
    $('qMapPrev').addEventListener('click', () => switchRegion(-1));
    $('qMapNext').addEventListener('click', () => switchRegion(1));
    // a cloud sync can replace the save while the map is showing: draw it again from the fresh data
    document.addEventListener('mq:data-changed', () => { if (Q && ctx && !$('qMap').hidden) renderMap(); });
    $('qPrepBack').addEventListener('click', () => {
      Q.run = null;
      leave();
    });
    $('qFight').addEventListener('click', onPrepDone);
    $('qFlee').addEventListener('click', () => {
      UI.hide();
      Q.battle = null;
      Q.run = null;
      Q.busy = false;
      leave();
    });
    $('qgMinus').addEventListener('click', () => setGuess(Q.guess - 1));
    $('qgPlus').addEventListener('click', () => setGuess(Q.guess + 1));
    $('qgBigMinus').addEventListener('click', () => setGuess(Q.guess - 10));
    $('qgBigPlus').addEventListener('click', () => setGuess(Q.guess + 10));
    $('qgLock').addEventListener('click', lockCharge);
    document.addEventListener('keydown', onKey);
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    RPG.ensureState(profile);
    Q = { mode: 'home', region: 0, node: null, buff: null, pz: null, intro: {}, lastSkill: null, run: null, encounter: null, battle: null, selected: [], guess: 0, puzzle: null, busy: false, log: '' };
    goHome();
  }

  function exit() {
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  /* ---------- quest home ---------- */

  function teamStrip(el, ids) {
    el.innerHTML = '';
    alliesOf(ids).forEach((c) => {
      const d = document.createElement('span');
      d.className = 'q-mate';
      d.appendChild(allySprite(c));
      d.title = c.name + ': ' + c.effectName + '. ' + c.effectText;
      d.setAttribute('aria-label', c.name);
      el.appendChild(d);
    });
  }

  /** Back out of a fight: to the map if it came from the map, otherwise to the quest home. */
  function leave() {
    if (Q.node) {
      Q.node = null;
      goMap();
    } else goHome();
  }

  function goHome() {
    Q.node = null;
    const r = rpg();
    const pr = RPG.progress(r);
    $('qLevel').textContent = 'Level ' + pr.level;
    $('qXp').style.width = Math.round((100 * pr.xp) / pr.need) + '%';
    $('qXpText').textContent = pr.xp + ' / ' + pr.need + ' XP to level ' + (pr.level + 1);
    $('qStats').textContent = 'Team health ' + RPG.maxHp(pr.level) + ' · ' + pr.wins + ' battles won · ' + r.creatures.length + ' of ' + RPG.CREATURES.length + ' friends found';
    teamStrip($('qHomeTeam'), RPG.currentTeam(r));
    const saved = savedRun();
    $('qResume').hidden = !saved;
    if (saved) $('qResume').textContent = '▶️ Continue: battle ' + (saved.i + 1) + ' of ' + RPG.ADVENTURE.length;
    showView('qHome');
  }

  /* ---------- world map ---------- */

  const nodeOf = (ref) => WorldMap.nodeById(WorldMap.regionById(ref.region), ref.id);
  const openRegions = () => {
    const cleared = WorldMap.clearedSet(rpg());
    return WorldMap.REGIONS.map((_, i) => i).filter((i) => WorldMap.regionOpen(i, cleared));
  };

  function switchRegion(d) {
    const open = openRegions();
    const to = open[open.indexOf(Q.region) + d];
    if (to === undefined) return;
    Q.region = to;
    renderMap();
    maybeIntro();
  }

  function goMap(region) {
    const cleared = WorldMap.clearedSet(rpg());
    Q.node = null;
    Q.region = region !== undefined ? region : Math.min(Q.region, WorldMap.currentRegion(cleared));
    if (!WorldMap.regionOpen(Q.region, cleared)) Q.region = WorldMap.currentRegion(cleared);
    renderMap();
    showView('qMap');
    maybeIntro();
  }

  /** The first time you arrive in a region with nothing cleared there yet, its story opens (once per visit to the quest). */
  function maybeIntro() {
    const reg = WorldMap.REGIONS[Q.region];
    if (!reg.intro || Q.intro[reg.id] || reg.nodes.some((n) => WorldMap.clearedSet(rpg()).has(n.id))) return;
    Q.intro[reg.id] = true;
    playScript({ type: 'story', name: reg.name, script: reg.intro }, () => {});
  }

  function renderMap() {
    const r = rpg(); // always read the save fresh: a sync can replace it
    const t = theme();
    const reg = WorldMap.REGIONS[Q.region];
    const cleared = WorldMap.clearedSet(r);
    const gold = new Set(r.gold || []);
    const states = WorldMap.nodeStates(reg, cleared);
    const open = openRegions();
    $('qMapName').textContent = reg.name;
    $('qMapBlurb').textContent = reg.blurb;
    $('qMapPrev').hidden = $('qMapNext').hidden = open.length < 2;
    $('qMapPrev').disabled = open.indexOf(Q.region) <= 0;
    $('qMapNext').disabled = open.indexOf(Q.region) >= open.length - 1;
    const done = reg.nodes.filter((n) => cleared.has(n.id)).length;
    $('qMapStars').textContent = done + ' of ' + reg.nodes.length + ' spots · ' + reg.nodes.filter((n) => gold.has(n.id)).length + ' ⭐';

    const board = $('qMapBoard');
    board.innerHTML = '';
    board.dataset.region = reg.id;
    board.dataset.art = t;
    const a = reg.art[t] || {};
    if (t === 'classic') {
      board.style.backgroundImage = 'url(' + Art.src('classic', 'map', a.map) + ')';
    } else {
      board.style.backgroundImage = '';
      board.appendChild(el('div', 'island ' + (a.island || 'grass')));
      (reg.decor || []).forEach(([k, x, y]) => {
        if (!Art.get('cute', 'map', k)) return;
        const d = Art.sprite('cute', 'map', k, '', '');
        d.classList.add('decor');
        d.setAttribute('alt', '');
        d.style.left = x + '%';
        d.style.top = y + '%';
        board.appendChild(d);
      });
    }
    // a line for every link, drawn under the nodes
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'mappaths');
    svg.setAttribute('aria-hidden', 'true');
    reg.nodes.forEach((n) => n.next.forEach((id) => {
      const m = WorldMap.nodeById(reg, id);
      [['edge', ''], ['line', states[n.id] === 'cleared' ? ' lit' : '']].forEach(([c, extra]) => {
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', n.x); ln.setAttribute('y1', n.y); ln.setAttribute('x2', m.x); ln.setAttribute('y2', m.y);
        ln.setAttribute('class', 'path-' + c + extra);
        if (a.path) ln.style.setProperty('--path', a.path);
        svg.appendChild(ln);
      });
    }));
    board.appendChild(svg);

    reg.nodes.forEach((n) => {
      const st = states[n.id];
      const b = el('button', 'mnode ' + n.type + ' ' + st + (gold.has(n.id) ? ' gold' : ''));
      b.type = 'button';
      b.style.left = n.x + '%';
      b.style.top = n.y + '%';
      b.dataset.id = n.id;
      b.appendChild(el('span', 'ico', st === 'locked' ? '🔒' : TYPE_ICON[n.type]));
      if (st === 'cleared') b.appendChild(el('span', 'mark', gold.has(n.id) ? '⭐' : '✓'));
      const kinds = WorldMap.kindsOf(n);
      const crowd = kinds && kinds.length > 1 ? ', ' + Math.min(kinds.length, RPG.maxGroup(sel().stars)) + ' monsters' : '';
      const extra = n.type === 'puzzle' ? ', ' + (n.puzzle === 'machine' ? 'Machine Builder' : 'Balance') + ' puzzle' : n.type === 'camp' && n.buff ? ', gives a head start' : '';
      b.setAttribute('aria-label', n.name + ': ' + TYPE_WORD[n.type] + crowd + extra + ', ' + (st === 'locked' ? 'locked' : st === 'cleared' ? (gold.has(n.id) ? 'cleared perfectly' : 'cleared') : 'ready'));
      b.appendChild(el('span', 'nlabel', n.name));
      b.addEventListener('click', () => onNode(n.id));
      board.appendChild(b);
    });

    // the token: your lead friend stands on the last cleared spot
    const lead = RPG.creatureById(RPG.currentTeam(r)[0]);
    const tok = el('div', 'token');
    tok.id = 'qToken';
    if (lead) tok.appendChild(allySprite(lead));
    const at = WorldMap.nodeById(reg, WorldMap.tokenAt(reg, cleared));
    tok.style.left = at.x + '%';
    tok.style.top = at.y + '%';
    board.appendChild(tok);
    $('qMapHint').textContent = (Q.buff ? '⛺ Rested: ' + RPG.BUFFS[Q.buff].text + ' ' : '') + (WorldMap.regionDone(reg, cleared)
      ? 'Region complete! Tap any spot to play it again.'
      : reg.nodes.some((n) => states[n.id] === 'open') ? 'Tap a glowing spot to go there.' : '');
  }

  async function onNode(id) {
    if (Q.busy) return;
    const reg = WorldMap.REGIONS[Q.region];
    const n = WorldMap.nodeById(reg, id);
    if (WorldMap.nodeStates(reg, WorldMap.clearedSet(rpg()))[id] === 'locked') {
      UI.toast('Clear the path before it first.', false);
      return;
    }
    const tok = $('qToken');
    if (tok) {
      tok.style.left = n.x + '%';
      tok.style.top = n.y + '%';
      Q.busy = true; // ignore taps while the friend walks over
      if (!motionOff()) sfx('step');
      await wait(520);
      Q.busy = false;
    }
    runNode(reg, n);
  }

  function runNode(reg, n) {
    Q.node = { region: reg.id, id: n.id };
    const kinds = WorldMap.kindsOf(n);
    if (n.type === 'puzzle') {
      const again = WorldMap.clearedSet(rpg()).has(n.id); // a cleared puzzle skips its intro
      return again || !(n.script && n.script.length) ? openPuzzle(n) : playScript(n, () => openPuzzle(n));
    }
    if (!kinds) return playScript(n, () => finishNode(n, true));
    if (n.type === 'rescue' && n.script && n.script.length && !WorldMap.clearedSet(rpg()).has(n.id)) return playScript(n, () => beginNodeFight(n, kinds));
    beginNodeFight(n, kinds);
  }

  function playScript(n, done, i) {
    i = i || 0;
    const last = i >= n.script.length - 1;
    UI.panel({
      title: TYPE_ICON[n.type] + ' ' + n.name,
      text: n.script[i],
      btn: last ? 'Continue' : 'Next',
      onBtn: () => (last ? done() : playScript(n, done, i + 1)),
    });
  }

  /** A map node is a v2 encounter: a group of monsters with their own weaknesses, built by the same rpg.js code as Quick adventure. */
  function beginNodeFight(n, kinds) {
    Q.run = null;
    Q.encounter = RPG.makeEncounter(sel().band, sel().stars, kinds, { prefer: [Q.lastSkill].filter(Boolean), rescue: n.ally || null });
    Q.lastSkill = Q.encounter.skills[Q.encounter.skills.length - 1] || Q.lastSkill;
    openPrep('fight');
  }

  /** Mark a node cleared (it never un-clears). Returns to the map and announces a newly opened region. */
  function finishNode(n, flawless) {
    const r = rpg();
    const reg = WorldMap.regionById(Q.node.region);
    const wasOpen = new Set(openRegions());
    WorldMap.clearNode(r, n.id, !!flawless && (WorldMap.kindsOf(n) !== null || n.type === 'puzzle'));
    ctx.onSave();
    const opened = WorldMap.REGIONS.findIndex((g, i) => !wasOpen.has(i) && WorldMap.regionOpen(i, WorldMap.clearedSet(r)));
    if (n.type === 'camp' && n.buff && RPG.BUFFS[n.buff]) Q.buff = n.buff; // the next fight from the map gets the head start
    goMap(opened >= 0 ? opened : WorldMap.REGIONS.indexOf(reg));
    if (opened >= 0) UI.toast('A new region opens: ' + WorldMap.REGIONS[opened].name + '!', true);
    else if (Q.buff && n.type === 'camp') UI.toast('⛺ ' + RPG.BUFFS[Q.buff].name + ': ' + RPG.BUFFS[Q.buff].text, true);
  }

  /* ---------- puzzle spots: a Balance or Machine Builder puzzle with no monsters (optional helper quests) ---------- */

  const PZ_XP = 10;
  const MAX_STEPS = 8;

  function openPuzzle(n) {
    const g = sel();
    Q.pz = { n, kind: n.puzzle, p: n.puzzle === 'machine' ? MGP.makeMachine(g.band, g.stars) : MGP.makeBalance(g.band, g.stars), guess: 0, path: [], missed: false, done: false };
    const t = theme();
    const T = Art.THEMES[t];
    const bg = Art.src(t, 'bg', regionBackdrop(t) || T.bgFor.weakness || Object.keys(T.bg)[0]);
    const scene = $('qPzScene');
    scene.dataset.art = t;
    scene.style.backgroundImage = bg ? 'url(' + bg + ')' : '';
    const lead = RPG.creatureById(RPG.currentTeam(rpg())[0]);
    putSprite($('qPzHelper'), lead ? allySprite(lead) : document.createTextNode('🙂'));
    $('qPzSay').textContent = (n.script && n.script[0]) || '';
    $('qPzPill').textContent = n.name;
    $('qPzTitle').textContent = Q.pz.kind === 'machine' ? 'Turn ' + MGP.fmt(Q.pz.p.start) + ' into ' + MGP.fmt(Q.pz.p.target) : 'Make the scale level';
    $('qPzMsg').textContent = '';
    drawPuzzle();
    showView('qPuzzle');
  }

  const pzBtn = (cls, text, label, fn) => {
    const b = el('button', cls, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', fn);
    return b;
  };
  const pzMsg = (text, good) => { $('qPzMsg').textContent = text; $('qPzMsg').className = 'sums ' + (good ? 'lem-good' : 'lem-bad'); };

  function drawPuzzle() {
    const z = Q.pz;
    const body = $('qPzBody');
    body.innerHTML = '';
    if (z.kind === 'machine') return drawMachine(body);
    const scale = el('div', 'scale');
    scale.id = 'qPzScale';
    const beam = el('div', 'beam');
    const panL = el('div', 'pan');
    const panR = el('div', 'pan');
    panL.id = 'qPzL';
    panR.id = 'qPzR';
    beam.append(panL, panR);
    scale.append(beam, el('div', 'post'));
    const sums = el('p', 'sums');
    sums.id = 'qPzSums';
    const row = el('div', 'guess');
    const val = el('div', 'gval');
    val.id = 'qPzVal';
    const set = (v) => { if (!z.done) { z.guess = Math.max(0, Math.min(z.p.max, v)); paintBalance(); } };
    row.append(
      ...(z.p.max > 20 ? [pzBtn('btn ghost', '−10', 'minus 10', () => set(z.guess - 10))] : []),
      pzBtn('btn ghost big', '−', 'minus 1', () => set(z.guess - 1)), val, pzBtn('btn ghost big', '+', 'plus 1', () => set(z.guess + 1)),
      ...(z.p.max > 20 ? [pzBtn('btn ghost', '+10', 'plus 10', () => set(z.guess + 10))] : []),
    );
    body.append(scale, sums, row);
    $('qPzGo').hidden = false;
    $('qPzGo').textContent = 'Lock it in';
    $('qPzGo').onclick = lockBalance;
    paintBalance();
  }

  function pzBlocks(side, v) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < side.x; i++) frag.appendChild(el('span', 'blk mystery' + (side.x > 6 ? ' sm' : ''), v));
    if (side.c > 0) frag.appendChild(el('span', 'blk known', side.c));
    return frag;
  }

  function paintBalance() {
    const { p, guess } = Q.pz;
    const l = MGP.sideVal(p.L, guess);
    const r = MGP.sideVal(p.R, guess);
    const diff = l - r;
    const scale = $('qPzScale');
    scale.style.setProperty('--tilt', (diff === 0 ? 0 : -Math.sign(diff) * Math.min(16, 4 + Math.abs(diff) * 1.2)) + 'deg');
    scale.classList.toggle('level', diff === 0);
    [['qPzL', p.L], ['qPzR', p.R]].forEach(([id, side]) => { const pan = $(id); pan.innerHTML = ''; pan.appendChild(pzBlocks(side, guess)); });
    $('qPzVal').textContent = '? = ' + guess;
    $('qPzSums').textContent = 'Left ' + l + '  ·  Right ' + r + '   (' + p.text + ')';
  }

  function lockBalance() {
    const z = Q.pz;
    if (!z || z.done) return;
    const res = MGP.checkBalance(z.p, z.guess);
    Store.record(ctx.profile, 'balance', res.balanced);
    if (!res.balanced) {
      z.missed = true;
      sfx('wrong');
      ctx.onSave();
      return pzMsg(res.msg, false);
    }
    solved('One ? weighs ' + z.guess + '. ' + res.msg, !z.missed);
  }

  /** Machine Builder: tap operation cards to turn the start into the target. Fewest steps earns the gold star. */
  const pzValues = () => {
    const z = Q.pz;
    const vs = [z.p.start];
    z.path.forEach((i) => vs.push(MGP.stepMachine(z.p, i, vs[vs.length - 1])));
    return vs;
  };

  function drawMachine(body) {
    const z = Q.pz;
    const now = el('div', 'mac-now');
    const a = el('div');
    a.append(el('span', 's-label', 'Now'), el('div', 'mac-big', ''));
    a.lastChild.id = 'qPzNow';
    const b = el('div');
    b.append(el('span', 's-label', 'Target'), el('div', 'mac-big tgt', MGP.fmt(z.p.target)));
    now.append(a, el('div', 'mac-arrow', '→'), b);
    const path = el('ol', 'mac-path');
    path.id = 'qPzPath';
    path.setAttribute('aria-label', 'Your chain so far');
    const ops = el('div', 'mac-ops');
    ops.id = 'qPzOps';
    z.p.ops.forEach((op, i) => ops.appendChild(pzBtn('op-card', op.label, null, () => pressOp(i))));
    const row = el('div', 'row center');
    row.append(pzBtn('btn ghost', 'Undo', null, () => { if (!z.done && z.path.length) { z.path.pop(); paintMachine(); } }), pzBtn('btn ghost', 'Start over', null, () => { if (!z.done) { z.path = []; paintMachine(); } }));
    body.append(now, path, ops, row);
    $('qPzGo').hidden = true;
    paintMachine();
  }

  function paintMachine() {
    const z = Q.pz;
    const vs = pzValues();
    const cur = vs[vs.length - 1];
    $('qPzNow').textContent = MGP.fmt(cur);
    const path = $('qPzPath');
    path.innerHTML = '';
    z.path.forEach((i, k) => path.appendChild(el('li', '', MGP.fmt(vs[k]) + '  ' + z.p.ops[i].label + '  =  ' + MGP.fmt(vs[k + 1]))));
    if (!z.path.length) path.appendChild(el('li', 'empty', 'Your steps will show up here. Best possible: ' + z.p.par + (z.p.par === 1 ? ' step.' : ' steps.')));
    [...$('qPzOps').children].forEach((btn, i) => { btn.disabled = z.done || MGP.stepMachine(z.p, i, cur) === null || z.path.length >= MAX_STEPS; });
  }

  function pressOp(i) {
    const z = Q.pz;
    if (!z || z.done) return;
    sfx('card');
    z.path.push(i);
    paintMachine();
    const vs = pzValues();
    if (vs[vs.length - 1] !== z.p.target) {
      if (z.path.length >= MAX_STEPS) pzMsg('That is a lot of steps. Try Undo or Start over.', false);
      return;
    }
    Store.record(ctx.profile, 'machine', true);
    const best = z.path.length <= z.p.par;
    solved('You made ' + MGP.fmt(z.p.target) + ' in ' + z.path.length + (z.path.length === 1 ? ' step.' : ' steps.') + (best ? ' That is the fewest possible!' : ' The fewest possible is ' + z.p.par + '.'), best);
  }

  function solved(text, star) {
    const z = Q.pz;
    z.done = true;
    $('qPzGo').hidden = true;
    const r = rpg();
    const up = RPG.addXp(r, PZ_XP, Store.deviceId);
    ctx.onSave();
    sfx('solved');
    setTimeout(() => sfx('win'), root.__questFast ? 0 : 350);
    UI.panel({
      title: 'Puzzle solved! 🎉',
      text: text + ' +' + PZ_XP + ' XP.' + (star ? ' ⭐' : '') + (up ? " Level up! You're now level " + RPG.progress(r).level + '.' : ''),
      btn: 'Back to the map',
      onBtn: () => { const n = z.n; Q.pz = null; finishNode(n, star); },
    });
  }

  /* ---------- team picker / pre-battle ---------- */

  /** The Quick adventure in progress (saved so it survives leaving, closing the page and switching devices). Only valid for the same grade and stars. */
  function savedRun() {
    const run = rpg().run; // read fresh: a sync can replace the save
    return run && Number.isInteger(run.i) && run.i >= 0 && run.i < RPG.ADVENTURE.length && run.band === sel().band && run.stars === sel().stars ? run : null;
  }
  function saveRun(i) {
    Store.setField(rpg(), 'run', i === null ? null : { i, band: sel().band, stars: sel().stars });
    ctx.onSave();
  }

  function beginRun(at) {
    const i = at || 0;
    Q.node = null;
    Q.run = { i, plan: RPG.planAdventure(sel().band, sel().stars, rpg().creatures) };
    Q.encounter = Q.run.plan[i];
    saveRun(i);
    openPrep('fight');
  }
  function resumeRun() {
    const saved = savedRun();
    if (saved) beginRun(saved.i);
  }

  const runLabel = () => (Q.node ? nodeOf(Q.node).name : Q.run ? 'Battle ' + (Q.run.i + 1) + ' of ' + Q.run.plan.length : '');
  const kindTag = (e) => (e.kind === 'boss' ? ' 👑 Boss' : e.kind === 'armor' ? ' 🛡️ Armored' : '');

  function openPrep(mode) {
    Q.mode = mode;
    Q.selected = RPG.currentTeam(rpg());
    const fight = mode === 'fight';
    $('qPreview').hidden = !fight;
    $('qRun').hidden = !fight;
    $('qPrepTitle').textContent = fight ? 'Choose your team' : 'My friends';
    $('qPrepHelp').textContent = fight
      ? 'Pick up to 3 friends. A ⭐ means that friend is an expert against one of these monsters: they hit harder. Every friend has a special power.'
      : 'Pick up to 3 friends for your team. Rescue caged friends to find more!';
    $('qFight').textContent = fight ? '⚔️ Fight!' : 'Done';
    if (fight) {
      $('qRun').textContent = runLabel();
      const box = $('qPvFoes');
      box.innerHTML = '';
      Q.encounter.enemies.forEach((e) => {
        const d = document.createElement('div');
        d.className = 'pv-foe';
        d.innerHTML = '<span class="e-emoji"></span><div><div class="e-name"></div><div class="pv-weak"></div></div>';
        putSprite(d.querySelector('.e-emoji'), enemySprite(e));
        d.querySelector('.e-name').textContent = e.name + kindTag(e);
        d.querySelector('.pv-weak').textContent = e.weakness;
        box.appendChild(d);
      });
      const rescue = Q.encounter.rescue && !rpg().creatures.includes(Q.encounter.rescue) && RPG.creatureById(Q.encounter.rescue); // a friend you already have is not trapped
      $('qPvRescue').hidden = !rescue;
      if (rescue) $('qPvRescue').textContent = '🔓 ' + rescue.emoji + ' ' + rescue.name + ' is trapped in a cage here! Beat the monsters to set them free.';
    }
    renderRoster();
    showView('qPrep');
  }

  function renderRoster() {
    const box = $('qRoster');
    box.innerHTML = '';
    const owned = rpg().creatures;
    const foes = Q.mode === 'fight' ? Q.encounter.enemies : [];
    const findable = RPG.reachable(sel().band);
    RPG.CREATURES.forEach((c) => {
      const has = owned.includes(c.id);
      if (!has && !findable.includes(c.id)) return; // not findable at this grade level (and story friends only appear once freed: see the note below)
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'creature' + (has ? '' : ' locked') + (Q.selected.includes(c.id) ? ' on' : '');
      b.disabled = !has;
      b.setAttribute('aria-pressed', Q.selected.includes(c.id));
      const match = has && foes.some((e) => e.themes.includes(RPG.themeOf(c)));
      b.innerHTML = '<span class="c-emoji"></span><span class="c-name"></span><span class="c-sub"></span><span class="c-eff"></span>';
      if (has) putSprite(b.querySelector('.c-emoji'), allySprite(c));
      else b.querySelector('.c-emoji').textContent = '❓';
      b.querySelector('.c-name').textContent = has ? c.name : '???';
      b.querySelector('.c-sub').textContent = has ? 'Expert at ' + c.strong + (match ? ' ⭐' : '') : 'Trapped in a cage somewhere. Win battles with a ' + (c.id === 'boss' ? 'boss' : 'cage') + ' to free them.';
      b.querySelector('.c-eff').textContent = has ? c.effectName + ': ' + c.effectText : '';
      if (match) b.classList.add('match');
      b.addEventListener('click', () => {
        const i = Q.selected.indexOf(c.id);
        if (i >= 0) Q.selected.splice(i, 1);
        else if (Q.selected.length < RPG.TEAM_SIZE) Q.selected.push(c.id);
        renderRoster();
      });
      box.appendChild(b);
    });
    const waiting = RPG.STORY_FRIENDS.filter((id) => !owned.includes(id));
    if (waiting.length) box.appendChild(el('p', 'note roster-note', '🗺️ ' + waiting.length + (waiting.length === 1 ? ' more friend is' : ' more friends are') + ' waiting on the world map. Rescue them to meet them!'));
    $('qFight').disabled = !Q.selected.length;
    $('qPrepSummary').textContent = Q.selected.length + ' of ' + RPG.TEAM_SIZE + ' picked';
  }

  function onPrepDone() {
    if (!Q.selected.length) return;
    RPG.setTeam(rpg(), Q.selected);
    ctx.onSave();
    if (Q.mode === 'collection') return goHome();
    startBattle();
  }

  /* ---------- battle ---------- */

  function startBattle() {
    Q.battle = RPG.newBattle({
      band: sel().band, stars: sel().stars, enemies: Q.encounter.enemies, team: RPG.currentTeam(rpg()),
      level: RPG.progress(rpg()).level, rescue: Q.encounter.rescue,
    });
    Q.puzzle = null;
    Q.busy = false;
    Q.log = 'Tap a monster to attack it, pick a friend, then play a card that fits its weakness.';
    if (Q.node && Q.buff && RPG.applyBuff(Q.battle, Q.buff)) Q.log = '⛺ ' + RPG.BUFFS[Q.buff].name + ': ' + RPG.BUFFS[Q.buff].text + ' ' + Q.log;
    showView('qBattle');
    paintScene();
    buildMates();
    renderBattle();
  }

  /** Your team stands in the scene under the monsters, so a hit visibly lands on them. Decorative: the buttons below are the real picker. */
  function buildMates() {
    const b = Q.battle;
    const box = $('qMates');
    box.innerHTML = '';
    b.team.forEach((id, j) => {
      const c = RPG.creatureById(id);
      const m = document.createElement('div');
      m.className = 'mate' + (j === b.ally ? ' on' : '');
      m.dataset.j = j;
      m.appendChild(allySprite(c));
      m.addEventListener('click', () => onAlly(j)); // a tap on the friend works too (the picker buttons stay for keyboards and screen readers)
      box.appendChild(m);
    });
  }
  const mateEls = () => [...$('qMates').children];
  function markActing() {
    mateEls().forEach((m, j) => m.classList.toggle('on', j === Q.battle.ally));
  }
  // anticipation: a younger player gets a longer, clearer warning before a monster strikes (docs/animation-guide.md)
  const motionOff = () => reduced() || document.documentElement.dataset.motion === 'reduced'; // device setting or the Reduce motion profile setting
  const windup = () => (motionOff() ? 0 : sel().stars === 1 ? 400 : sel().stars === 2 ? 300 : 220);
  const sfx = (name) => { if (root.Sfx) Sfx.play(name); };

  /** The backdrop follows the toughest monster in the fight: boss and armored fights happen in the dungeon / castle. */
  function paintScene() {
    const t = theme();
    const T = Art.THEMES[t];
    const kinds = Q.battle.foes.map((f) => f.enemy.kind);
    const kind = kinds.includes('boss') ? 'boss' : kinds.includes('armor') ? 'armor' : 'weakness';
    const scene = $('qScene');
    scene.dataset.art = t;
    const bg = Art.src(t, 'bg', regionBackdrop(t) || T.bgFor[kind] || Object.keys(T.bg)[0]);
    scene.style.backgroundImage = bg ? 'url(' + bg + ')' : '';
  }
  /** A map region can pick its own backdrop (Prime Peaks is snowy, Ember Mountain is hot); a Quick adventure uses the default by monster kind. */
  function regionBackdrop(t) {
    const reg = Q.node && WorldMap.regionById(Q.node.region);
    const a = reg && reg.art && reg.art[t];
    return a && a.bg && Art.get(t, 'bg', a.bg) ? a.bg : null;
  }

  function setGuess(v) {
    const b = Q.battle;
    if (!b || !b.puzzle) return;
    Q.guess = Math.max(0, Math.min(b.puzzle.max, v));
    renderCharge();
  }

  const charging = () => Q.battle.foes.find((f) => f.alive && f.charging);

  function renderCharge() {
    const b = Q.battle;
    const box = $('qCharge');
    box.hidden = !(b && b.puzzle && charging());
    if (box.hidden) return;
    if (Q.puzzle !== b.puzzle) {
      Q.puzzle = b.puzzle;
      Q.guess = 0;
    }
    const p = b.puzzle;
    $('qChargeEq').textContent = p.text;
    $('qgVal').textContent = '? = ' + Q.guess;
    $('qChargeSums').textContent = 'Left ' + MGP.sideVal(p.L, Q.guess) + '  ·  Right ' + MGP.sideVal(p.R, Q.guess);
    $('qgBigMinus').hidden = $('qgBigPlus').hidden = p.max <= 20;
    $('qgMinus').disabled = $('qgBigMinus').disabled = Q.guess <= 0;
    $('qgPlus').disabled = $('qgBigPlus').disabled = Q.guess >= p.max;
  }

  function lockCharge() {
    const b = Q.battle;
    if (!b || Q.busy || !b.puzzle || !charging()) return;
    const res = MGP.checkBalance(b.puzzle, Q.guess);
    if (res.balanced) {
      Store.record(ctx.profile, 'balance', true);
      const boss = charging().enemy.name;
      RPG.cancelCharge(b);
      Q.log = '🌟 Cancelled! The ' + boss + ' is stunned and skips its attack this turn.';
      ctx.onSave();
      renderBattle();
    } else {
      Store.record(ctx.profile, 'balance', false);
      UI.toast(res.msg, false);
    }
  }

  function renderFoes() {
    const b = Q.battle;
    const box = $('qFoes');
    box.innerHTML = '';
    b.foes.forEach((f) => {
      const e = f.enemy;
      const el = document.createElement('button');
      el.type = 'button';
      el.id = 'foe' + f.i;
      el.className = 'foe' + (f.i === b.target && f.alive ? ' target' : '') + (f.alive ? '' : ' dead') + (f.stunned ? ' stunned' : '');
      el.disabled = !f.alive;
      el.setAttribute('aria-label', e.name + ', ' + f.hp + ' of ' + f.max + ' health. ' + e.weakness);
      el.innerHTML = '<span class="e-tags"></span><span class="e-emoji"></span><span class="e-name"></span><div class="bar" aria-hidden="true"><div class="fill hp"></div></div><span class="e-hp"></span><span class="e-weak"></span>';
      putSprite(el.querySelector('.e-emoji'), enemySprite(e));
      el.querySelector('.e-name').textContent = e.name;
      el.querySelector('.fill').style.width = Math.round((100 * f.hp) / f.max) + '%';
      el.querySelector('.e-hp').textContent = 'HP ' + f.hp + '/' + f.max;
      el.querySelector('.e-weak').textContent = e.weakness;
      el.querySelector('.e-tags').textContent = (e.kind === 'boss' ? '👑' : e.kind === 'armor' ? '🛡️' : '') + (f.stunned ? '💤' : '') + (f.alive && f.charging ? '⚡' : '');
      el.addEventListener('click', () => onFoe(f.i));
      box.appendChild(el);
    });
  }

  function renderAllies() {
    const b = Q.battle;
    const box = $('qAllies');
    box.innerHTML = '';
    const foe = b.foes[b.target];
    b.team.forEach((id, j) => {
      const c = RPG.creatureById(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ally' + (j === b.ally ? ' on' : '');
      el.setAttribute('aria-pressed', j === b.ally);
      el.innerHTML = '<span class="a-emoji"></span><span><span class="a-name"></span><span class="a-eff"></span></span>';
      putSprite(el.querySelector('.a-emoji'), allySprite(c));
      el.querySelector('.a-name').textContent = c.name + ' · ' + c.effectName;
      el.querySelector('.a-eff').textContent = c.effectText;
      if (foe && foe.alive && foe.enemy.themes.includes(RPG.themeOf(c))) {
        const s = document.createElement('span');
        s.className = 'star';
        s.textContent = '⭐';
        el.appendChild(s);
      }
      el.addEventListener('click', () => onAlly(j));
      box.appendChild(el);
    });
  }

  function renderHand() {
    const b = Q.battle;
    const hand = $('qHand');
    hand.innerHTML = '';
    const foe = b.foes[b.target];
    $('qHandLabel').textContent = foe ? 'Pick the card that fits the ' + foe.enemy.name + "'s weakness" : '';
    RPG.currentHand(b).forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qcard' + (c.label.length > 6 ? ' long' : '');
      btn.setAttribute('aria-label', c.label);
      btn.innerHTML = '<span class="lbl"></span><span class="k"></span>';
      btn.querySelector('.lbl').textContent = c.label;
      btn.querySelector('.k').textContent = i + 1;
      btn.addEventListener('click', () => onCard(i));
      hand.appendChild(btn);
    });
  }

  function renderTeam(hp) {
    const b = Q.battle;
    const v = hp === undefined ? b.teamHp : hp;
    $('qTeamHp').style.width = Math.round((100 * v) / b.teamMax) + '%';
    $('qTeamHpText').textContent = v + ' / ' + b.teamMax;
    $('qShield').textContent = b.shield ? '🛡️'.repeat(b.shield) : '';
    $('qShield').title = b.shield ? 'Blocks the next ' + b.shield + ' attack' + (b.shield > 1 ? 's' : '') : '';
  }

  function renderBattle() {
    const b = Q.battle;
    const foe = b.foes[b.target];
    $('qTurn').textContent = 'Turn ' + b.turn;
    $('qRunPill').textContent = runLabel();
    renderFoes();
    $('qWeakTitle').textContent = foe ? foe.enemy.weakness : '';
    $('qWeakHint').textContent = foe ? foe.enemy.hint : '';
    renderCharge();
    renderHand();
    renderAllies();
    renderTeam();
    $('qLog').textContent = Q.log || '';
  }

  function onFoe(i) {
    const b = Q && Q.battle;
    if (!b || Q.busy || !$('panel').hidden) return;
    if (RPG.setTarget(b, i)) renderBattle();
  }

  function onAlly(j) {
    const b = Q && Q.battle;
    if (!b || Q.busy || !$('panel').hidden) return;
    if (RPG.setAlly(b, j)) { renderAllies(); markActing(); }
  }

  /* ---------- animation helpers ---------- */

  function floatAt(el, text, cls) {
    if (!el) return;
    const scene = $('qScene').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = text;
    f.style.left = Math.max(4, r.left - scene.left + r.width / 2 - 24) + 'px';
    f.style.top = Math.max(0, r.top - scene.top + r.height / 3) + 'px';
    $('qFloats').appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }
  function pulse(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  function describe(ev, b) {
    const names = (i) => b.foes[i].enemy.name;
    const ally = RPG.creatureById(ev.ally);
    if (!ev.correct) return '✗ No damage this turn.';
    const parts = ['✓ ' + ev.msg];
    const main = ev.hits.find((h) => h.i === ev.target);
    if (main) parts.push(ally.name + ' hits the ' + names(ev.target) + ' for ' + main.amount + (ev.specialist ? ' (⭐ expert bonus!)' : '') + '.');
    const others = ev.hits.filter((h) => h.i !== ev.target);
    if (others.length) parts.push(ally.effectName + ' also hits ' + others.map((h) => 'the ' + names(h.i) + ' for ' + h.amount).join(' and ') + '.');
    if (ev.healed) parts.push('Your team heals ' + ev.healed + '.');
    if (ev.shieldGained) parts.push('A shield will block the next attack.');
    if (ev.stunned !== null) parts.push('The ' + names(ev.stunned) + ' will skip its attack.');
    if (ev.hint) parts.push('Next turn each hand has a wrong card removed.');
    return parts.join(' ');
  }

  function enemyLine(a, b) {
    const n = b.foes[a.i].enemy.name;
    if (a.skipped) return 'The ' + n + ' is stunned and cannot attack.';
    if (a.blocked) return 'The ' + n + '’s attack is blocked by the shield.';
    return 'The ' + n + (a.charged ? '’s big attack hits' : ' hits') + ' your team for ' + a.dmg + '.';
  }

  /* ---------- playing a card ---------- */

  async function onCard(i) {
    const b = Q && Q.battle;
    if (!b || Q.busy || b.over || !$('panel').hidden) return;
    const tgt = b.foes[b.target];
    const hp0 = b.teamHp;
    const ev = RPG.play(b, i);
    if (!ev) return;
    Q.busy = true;
    Store.record(ctx.profile, tgt.enemy.rule.id, ev.correct);
    ctx.onSave();

    // 1) what the player's card did
    const lines = [describe(ev, b)];
    const foeEl = (k) => $('foe' + k);
    const mate = mateEls()[b.team.indexOf(ev.ally)];
    if (ev.correct) {
      pulse(mate, 'act', 420); // the friend who acts steps forward
      sfx('correct');
      ev.hits.forEach((h, n) => {
        const el = foeEl(h.i);
        setTimeout(() => { pulse(el, 'hit', 340); floatAt(el, '−' + h.amount, 'dmg'); sfx('hit'); }, root.__questFast ? 0 : n * 120);
        if (el) {
          const f = b.foes[h.i];
          el.querySelector('.fill').style.width = Math.round((100 * f.hp) / f.max) + '%';
          el.querySelector('.e-hp').textContent = 'HP ' + f.hp + '/' + f.max;
          if (h.killed) setTimeout(() => el.classList.add('dead'), root.__questFast ? 0 : 450);
        }
      });
      if (ev.stunned !== null) floatAt(foeEl(ev.stunned), '💤', 'info');
      if (ev.healed) floatAt($('qTeamHp'), '+' + ev.healed, 'heal');
      if (ev.shieldGained) $('qShield').textContent = '🛡️'.repeat(Math.min(b.shield + ev.attacks.filter((a) => a.blocked).length, 2));
    } else {
      pulse(mate, 'oops', 340);
      sfx('wrong');
      floatAt(foeEl(ev.target), 'Miss!', 'info');
    }
    Q.log = lines.join(' ');
    $('qLog').textContent = Q.log;
    await wait(700);

    if (ev.over === 'win') {
      Q.busy = false;
      sfx('win');
      UI.toast('✓ ' + ev.msg, true);
      await wait(400);
      return showWin();
    }

    // 2) every living enemy hits back, one after another
    let hp = hp0 + ev.healed;
    for (const a of ev.attacks) {
      const el = foeEl(a.i);
      if (!a.skipped) {
        // a clear warning (a squash and a glow) before the strike; younger players get longer
        pulse(el, 'windup', windup() + 60);
        await wait(windup());
      }
      pulse(el, 'lunge', 440);
      await wait(300);
      if (a.skipped) floatAt(el, '💤', 'info');
      else if (a.blocked) {
        floatAt($('qTeamHp'), 'Blocked 🛡️', 'info');
        mateEls().forEach((m) => pulse(m, 'guard', 400));
        sfx('close');
      } else {
        hp = Math.max(0, hp - a.dmg);
        floatAt($('qTeamHp'), '−' + a.dmg, 'dmg');
        pulse($('qTeamHp').closest('.team-bar'), 'ouch', 340);
        mateEls().forEach((m) => pulse(m, 'hurt', 380)); // the whole team takes the hit
        sfx('hurt');
      }
      renderTeam(hp);
      lines.push(enemyLine(a, b));
      $('qLog').textContent = lines.join(' ');
      await wait(450);
    }
    Q.log = lines.join(' ');

    // 3) what happens next
    if (ev.over === 'lose') {
      Q.busy = false;
      renderTeam(0);
      mateEls().forEach((m) => m.classList.add('fainted'));
      sfx('lose');
      return UI.panel({
        title: 'Your team needs a rest',
        text: (ev.correct ? '' : ev.msg + ' ') + "Your team ran out of health. Don't worry: everyone gets full health. Try these monsters again!",
        btn: 'Try again',
        onBtn: () => startBattle(),
        btn2: 'Leave',
        onBtn2: () => { Q.run = null; leave(); },
        bad: true,
      });
    }
    renderBattle();
    Q.busy = false;
    if (!ev.correct) {
      UI.panel({ title: 'Not quite!', text: ev.msg + ' No damage this turn, and the monsters hit back.', btn: 'Keep going', onBtn: () => {}, bad: true });
    }
  }

  function showWin() {
    const b = Q.battle;
    const r = rpg();
    const rw = RPG.rewards(b);
    const out = RPG.applyRewards(r, rw, Store.deviceId);
    ctx.onSave();
    let text = (rw.clean ? 'A perfect fight! ' : '') + '+' + rw.xp + ' XP.';
    if (out.joined) text += ' 🔓 You freed ' + out.joined.emoji + ' ' + out.joined.name + '! ' + out.joined.effectName + ': ' + out.joined.effectText;
    if (out.levelUps) text += " Level up! You're now level " + RPG.progress(r).level + ', so your team has more health.';
    if (Q.node) {
      const n = nodeOf(Q.node);
      const freed = n.ally && RPG.creatureById(n.ally);
      Q.buff = null; // the camp's head start is used up once the fight is won
      let gold = rw.clean;
      if (freed && !out.joined) {
        // already a friend: no new ally, but the captors are beaten, so a thank-you and a gold star
        text += ' ' + freed.emoji + ' ' + freed.name + ' is already your friend, and thanks you for the rescue. ⭐';
        gold = true;
      }
      if (n.type === 'boss' && n.outro) text += '\n\n' + n.outro; // the story beat after a region's boss
      UI.panel({
        title: n.type === 'boss' ? 'Region boss beaten! 🏆' : 'Victory! 🎉',
        text,
        btn: 'Back to the map',
        onBtn: () => finishNode(n, gold),
      });
      return;
    }
    const last = Q.run && Q.run.i >= Q.run.plan.length - 1;
    if (Q.run) saveRun(last ? null : Q.run.i + 1); // saved the moment you win, so leaving here resumes at the next battle
    UI.panel({
      title: last ? 'Adventure complete! 🏆' : 'Victory! 🎉',
      text,
      btn: last ? 'Back to quest' : 'Next battle',
      onBtn: () => {
        if (last || !Q.run) { Q.run = null; goHome(); return; }
        Q.run.i++;
        Q.encounter = Q.run.plan[Q.run.i];
        openPrep('fight');
      },
      btn2: last ? 'Go again' : null,
      onBtn2: () => beginRun(),
    });
  }

  function onKey(e) {
    if (!Q || !Q.battle || $('qBattle').hidden || !$('panel').hidden || Q.busy) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= RPG.currentHand(Q.battle).length) {
      e.preventDefault();
      onCard(n - 1);
    }
  }

  root.Quest = { start, _state: () => Q };
})(window);
