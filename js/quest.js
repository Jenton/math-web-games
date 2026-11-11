/* Creature Quest UI: quest home, world map, team picker / pre-battle, and the turn-based battle scene.
 * All rules live in js/rpg.js (combat) and js/worldmap.js (map data and unlocks); art comes from js/art.js.
 * This file only draws screens and handles taps. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['qHome', 'qMap', 'qPrep', 'qBattle'];
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TYPE_ICON = { battle: '⚔️', elite: '🛡️', boss: '👑', rescue: '🗝️', story: '💬', camp: '⛺' };
  const TYPE_WORD = { battle: 'Battle', elite: 'Armored monster', boss: 'Boss', rescue: 'Rescue', story: 'Story', camp: 'Camp' };
  let ctx = null;
  let Q = null;
  let bound = false;

  function showView(id) {
    VIEWS.forEach((v) => ($(v).hidden = v !== id));
    window.scrollTo(0, 0);
  }

  const rpg = () => ctx.profile.games.rpg;
  const sel = () => ctx.profile.settings;
  const theme = () => Art.themeId(ctx.profile);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function init() {
    if (bound) return;
    bound = true;
    $('qBack').addEventListener('click', exit);
    $('qBegin').addEventListener('click', beginRun);
    $('qMapBtn').addEventListener('click', () => goMap());
    $('qMapBack').addEventListener('click', goHome);
    $('qMapPrev').addEventListener('click', () => switchRegion(-1));
    $('qMapNext').addEventListener('click', () => switchRegion(1));
    $('qMyTeam').addEventListener('click', () => openPrep('collection'));
    $('qPrepBack').addEventListener('click', () => {
      Q.run = null;
      if (Q.node) { Q.node = null; goMap(); } else goHome();
    });
    $('qFight').addEventListener('click', onPrepDone);
    $('qFlee').addEventListener('click', () => {
      UI.hide();
      Q.battle = null;
      Q.run = null;
      if (Q.node) { Q.node = null; goMap(); } else goHome();
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
    Q = { mode: 'home', run: null, node: null, region: 0, enemy: null, battle: null, lastRuleId: null, selected: [], guess: 0, puzzle: null };
    $('quest').dataset.art = theme();
    goHome();
  }

  function exit() {
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  /* ---------- sprites ---------- */

  const enemySprite = (e) => Art.sprite(theme(), 'enemy', enemyArtId(e), e.emoji, e.name);
  // enemy art is keyed by the rule id (or armor / boss), which is how rpg.js picks its ENEMY_ART entry
  const enemyArtId = (e) => (e.kind === 'armor' ? 'armor' : e.kind === 'boss' ? 'boss' : e.rule.id);
  const allySprite = (c) => Art.sprite(theme(), 'ally', c.id, c.emoji, c.name);

  /* ---------- quest home ---------- */

  function teamStrip(el0, ids, enemy) {
    el0.innerHTML = '';
    ids.forEach((id) => {
      const c = RPG.creatureById(id);
      const d = el('span', 'q-mate');
      d.appendChild(allySprite(c));
      d.title = c.name + ' (strong against ' + c.strong + ')';
      if (enemy && enemy.themes.includes(c.id)) {
        const s = el('span', 'star', '⭐');
        d.appendChild(s);
      }
      el0.appendChild(d);
    });
  }

  function goHome() {
    const r = rpg();
    const pr = RPG.progress(r);
    $('qLevel').textContent = 'Level ' + pr.level;
    $('qXp').style.width = Math.round((100 * pr.xp) / pr.need) + '%';
    $('qXpText').textContent = pr.xp + ' / ' + pr.need + ' XP to level ' + (pr.level + 1);
    $('qStats').textContent = 'Team health ' + RPG.maxHp(pr.level) + ' · ' + pr.wins + ' battles won · ' + r.creatures.length + ' of ' + RPG.CREATURES.length + ' creatures found';
    teamStrip($('qHomeTeam'), RPG.currentTeam(r), null);
    showView('qHome');
  }

  /* ---------- world map ---------- */

  function openRegions() {
    const cleared = WorldMap.clearedSet(rpg());
    return WorldMap.REGIONS.map((_, i) => i).filter((i) => WorldMap.regionOpen(i, cleared));
  }

  function switchRegion(d) {
    const open = openRegions();
    const at = open.indexOf(Q.region);
    const to = open[at + d];
    if (to === undefined) return;
    Q.region = to;
    renderMap();
  }

  function goMap(region) {
    const cleared = WorldMap.clearedSet(rpg());
    Q.region = region !== undefined ? region : Math.min(Q.region, WorldMap.currentRegion(cleared));
    if (!WorldMap.regionOpen(Q.region, cleared)) Q.region = WorldMap.currentRegion(cleared);
    renderMap();
    showView('qMap');
  }

  function renderMap() {
    const r = rpg();
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
    const total = reg.nodes.length;
    const done = reg.nodes.filter((n) => cleared.has(n.id)).length;
    $('qMapStars').textContent = done + ' of ' + total + ' spots · ' + reg.nodes.filter((n) => gold.has(n.id)).length + ' ⭐';

    const board = $('qMapBoard');
    board.innerHTML = '';
    board.dataset.region = reg.id;
    board.dataset.art = t;
    const a = reg.art[t] || {};
    if (t === 'classic') {
      board.style.backgroundImage = 'url(' + Art.src('classic', 'map', a.map) + ')';
    } else {
      board.style.backgroundImage = '';
      const isl = el('div', 'island ' + (a.island || 'grass'));
      board.appendChild(isl);
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
    // paths: a line for every link, drawn under the nodes
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'mappaths');
    svg.setAttribute('aria-hidden', 'true');
    reg.nodes.forEach((n) => n.next.forEach((id) => {
      const m = WorldMap.nodeById(reg, id);
      const lit = states[n.id] === 'cleared';
      [['edge', ''], ['line', lit ? ' lit' : '']].forEach(([c, extra]) => {
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', n.x); ln.setAttribute('y1', n.y); ln.setAttribute('x2', m.x); ln.setAttribute('y2', m.y);
        ln.setAttribute('class', 'path-' + c + extra);
        if (reg.art[t] && reg.art[t].path) ln.style.setProperty('--path', reg.art[t].path);
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
      b.setAttribute('aria-label', n.name + ': ' + TYPE_WORD[n.type] + ', ' + (st === 'locked' ? 'locked' : st === 'cleared' ? (gold.has(n.id) ? 'cleared perfectly' : 'cleared') : 'ready'));
      b.appendChild(el('span', 'nlabel', n.name));
      b.addEventListener('click', () => onNode(n.id));
      board.appendChild(b);
    });

    // the token: your lead friend stands on the last cleared spot
    const lead = RPG.creatureById(RPG.currentTeam(r)[0]);
    const tok = el('div', 'token');
    tok.id = 'qToken';
    tok.appendChild(allySprite(lead));
    const at = WorldMap.nodeById(reg, WorldMap.tokenAt(reg, cleared));
    tok.style.left = at.x + '%';
    tok.style.top = at.y + '%';
    board.appendChild(tok);
    const next = reg.nodes.filter((n) => states[n.id] === 'open');
    $('qMapHint').textContent = WorldMap.regionDone(reg, cleared)
      ? 'Region complete! Tap any spot to play it again.'
      : next.length ? 'Tap a glowing spot to go there.' : '';
  }

  function onNode(id) {
    const reg = WorldMap.REGIONS[Q.region];
    const n = WorldMap.nodeById(reg, id);
    const st = WorldMap.nodeStates(reg, WorldMap.clearedSet(rpg()))[id];
    if (st === 'locked') {
      UI.toast('Clear the path before it first.', false);
      return;
    }
    const tok = $('qToken');
    const go = () => runNode(reg, n);
    if (tok) {
      tok.style.left = n.x + '%';
      tok.style.top = n.y + '%';
    }
    if (reduceMotion() || !tok) go();
    else setTimeout(go, 520);
  }

  function runNode(reg, n) {
    Q.node = { region: reg.id, id: n.id };
    const kind = WorldMap.enemyKind(n);
    const withScript = n.script && n.script.length;
    if (!kind) return playScript(n, () => finishNode(n, true));
    if (n.type === 'rescue' && withScript && !WorldMap.clearedSet(rpg()).has(n.id)) return playScript(n, () => beginNodeFight(n, kind));
    beginNodeFight(n, kind);
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

  function beginNodeFight(n, kind) {
    Q.run = null;
    Q.enemy = RPG.makeEnemy(sel().band, sel().stars, kind, Q.lastRuleId);
    if (kind !== 'armor') Q.lastRuleId = Q.enemy.rule.id;
    openPrep('fight');
  }

  /** Mark a node cleared (never un-clears). Returns the story text about what this unlocked. */
  function finishNode(n, flawless) {
    const r = rpg();
    const reg = WorldMap.regionById(Q.node.region);
    const before = WorldMap.clearedSet(r);
    const wasOpen = new Set(WorldMap.REGIONS.map((_, i) => i).filter((i) => WorldMap.regionOpen(i, before)));
    WorldMap.clearNode(r, n.id, flawless && WorldMap.enemyKind(n) !== null);
    ctx.onSave();
    let note = '';
    WorldMap.REGIONS.forEach((g, i) => {
      if (WorldMap.regionOpen(i, WorldMap.clearedSet(r)) && !wasOpen.has(i)) {
        note = ' A new region opens: ' + g.name + '!';
        Q.region = i;
      }
    });
    Q.node = null;
    goMap(note ? Q.region : WorldMap.REGIONS.indexOf(reg));
    if (note) UI.toast(note.trim(), true);
    return note;
  }

  /* ---------- team picker / pre-battle ---------- */

  function beginRun() {
    Q.node = null;
    Q.run = { i: 0 };
    nextEnemy();
    openPrep('fight');
  }

  function nextEnemy() {
    const kind = RPG.PLAN[Q.run.i];
    Q.enemy = RPG.makeEnemy(sel().band, sel().stars, kind, Q.lastRuleId);
    if (kind !== 'armor') Q.lastRuleId = Q.enemy.rule.id;
  }

  function openPrep(mode) {
    Q.mode = mode;
    Q.selected = RPG.currentTeam(rpg());
    const fight = mode === 'fight';
    $('qPreview').hidden = !fight;
    $('qRun').hidden = !fight;
    $('qPrepTitle').textContent = fight ? 'Choose your team' : 'My creatures';
    $('qPrepHelp').textContent = fight
      ? 'Pick up to 3 friends. A ⭐ means that friend is strong against this monster: their attacks hit harder.'
      : 'Pick up to 3 friends for your team. Find more by defeating monsters!';
    $('qFight').textContent = fight ? '⚔️ Fight!' : 'Done';
    if (fight) {
      const e = Q.enemy;
      const nm = Q.node ? WorldMap.nodeById(WorldMap.regionById(Q.node.region), Q.node.id).name : null;
      $('qRun').textContent = nm || 'Battle ' + (Q.run.i + 1) + ' of ' + RPG.PLAN.length;
      const slot = $('qPvSprite');
      slot.innerHTML = '';
      slot.appendChild(enemySprite(e));
      $('qPvName').textContent = e.name + (e.kind === 'boss' ? ' 👑 Boss' : e.kind === 'armor' ? ' 🛡️ Armored' : '');
      $('qPvWeak').textContent = e.weakness;
    }
    renderRoster();
    showView('qPrep');
  }

  function renderRoster() {
    const box = $('qRoster');
    box.innerHTML = '';
    const owned = rpg().creatures;
    const enemy = Q.mode === 'fight' ? Q.enemy : null;
    const findable = RPG.reachable(sel().band);
    RPG.CREATURES.forEach((c) => {
      const has = owned.includes(c.id);
      if (!has && !findable.includes(c.id)) return; // not findable at this grade level
      const b = el('button', 'creature' + (has ? '' : ' locked') + (Q.selected.includes(c.id) ? ' on' : ''));
      b.type = 'button';
      b.disabled = !has;
      b.setAttribute('aria-pressed', Q.selected.includes(c.id));
      const match = has && enemy && enemy.themes.includes(c.id);
      const how = c.id === 'boss' ? 'Defeat a boss' : c.id === 'armor' ? 'Defeat an armored monster' : 'Defeat a ' + RPG.ENEMY_ART[c.id].name;
      const pic = el('span', 'c-emoji');
      if (has) pic.appendChild(allySprite(c));
      else pic.textContent = '❓';
      b.appendChild(pic);
      b.appendChild(el('span', 'c-name', has ? c.name : '???'));
      b.appendChild(el('span', 'c-sub', has ? 'Strong vs ' + c.strong + (match ? ' ⭐' : '') : how + ' to befriend'));
      if (match) b.classList.add('match');
      b.addEventListener('click', () => {
        const i = Q.selected.indexOf(c.id);
        if (i >= 0) Q.selected.splice(i, 1);
        else if (Q.selected.length < RPG.TEAM_SIZE) Q.selected.push(c.id);
        renderRoster();
      });
      box.appendChild(b);
    });
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

  /* ---------- battle scene ---------- */

  function bgKey(t, kind) {
    const T = Art.THEMES[t];
    const regionId = Q.node && Q.node.region;
    if (regionId === 'keep') return t === 'classic' ? 'dungeon' : 'castle';
    return T.bgFor[kind] || Object.keys(T.bg)[0];
  }

  /** Build the scene once per battle (so animations are not reset by re-rendering). */
  function buildStage() {
    const t = theme();
    const b = Q.battle;
    const stage = $('qStage');
    stage.dataset.art = t;
    $('qStageBg').style.backgroundImage = 'url(' + Art.src(t, 'bg', bgKey(t, b.enemy.kind)) + ')';
    const slot = $('qEnemySprite');
    slot.innerHTML = '';
    slot.className = 'stage-enemy' + (b.enemy.kind === 'boss' ? ' boss' : '');
    slot.appendChild(enemySprite(b.enemy));
    const team = $('qStageTeam');
    team.innerHTML = '';
    b.team.forEach((id) => {
      const w = el('div', 'mate');
      w.appendChild(allySprite(RPG.creatureById(id)));
      team.appendChild(w);
    });
    $('qFloat').innerHTML = '';
  }

  function startBattle() {
    Q.battle = RPG.newBattle({ band: sel().band, stars: sel().stars, enemy: Q.enemy, team: RPG.currentTeam(rpg()), level: RPG.progress(rpg()).level });
    Q.puzzle = null;
    Q.busy = false;
    Q.log = Q.battle.bonus > 0
      ? '⭐ Your specialists make every hit stronger! Pick the card that fits the weakness.'
      : 'Pick the card that fits the weakness. The strongest ⚔️ card that fits does the most damage!';
    showView('qBattle');
    buildStage();
    renderBattle();
  }

  function setGuess(v) {
    const b = Q.battle;
    if (!b || !b.puzzle) return;
    Q.guess = Math.max(0, Math.min(b.puzzle.max, v));
    renderCharge();
  }

  function renderCharge() {
    const b = Q.battle;
    const box = $('qCharge');
    box.hidden = !(b && b.charging && b.puzzle);
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
    if (!b || !b.charging || !b.puzzle) return;
    const res = MGP.checkBalance(b.puzzle, Q.guess);
    if (res.balanced) {
      Store.record(ctx.profile, 'balance', true);
      RPG.cancelCharge(b);
      Q.log = '🌟 Cancelled! The ' + b.enemy.name + ' is stunned and skips its attack this turn.';
      ctx.onSave();
      renderBattle();
    } else {
      Store.record(ctx.profile, 'balance', false);
      UI.toast(res.msg, false);
    }
  }

  function renderBattle() {
    const b = Q.battle;
    const e = b.enemy;
    $('qEnemyName').textContent = e.name + (e.kind === 'boss' ? ' 👑' : e.kind === 'armor' ? ' 🛡️' : '');
    $('qEnemyHp').style.width = Math.round((100 * b.enemyHp) / b.enemyMax) + '%';
    $('qEnemyHpText').textContent = 'HP ' + b.enemyHp + ' / ' + b.enemyMax;
    $('qWeakTitle').textContent = e.weakness;
    $('qWeakHint').textContent = e.hint;
    $('qTurn').textContent = 'Turn ' + b.turn;
    $('qRunPill').textContent = Q.node ? WorldMap.nodeById(WorldMap.regionById(Q.node.region), Q.node.id).name : Q.run ? 'Battle ' + (Q.run.i + 1) + ' of ' + RPG.PLAN.length : '';
    teamStrip($('qTeam'), b.team, e);
    $('qTeamHp').style.width = Math.round((100 * b.teamHp) / b.teamMax) + '%';
    $('qTeamHpText').textContent = b.teamHp + ' / ' + b.teamMax;
    $('qLog').textContent = Q.log || '';
    renderCharge();
    const hand = $('qHand');
    hand.innerHTML = '';
    b.hand.forEach((c, i) => {
      const btn = el('button', 'qcard' + (c.label.length > 6 ? ' long' : ''));
      btn.type = 'button';
      btn.setAttribute('aria-label', c.label + ', power ' + c.power);
      btn.appendChild(el('span', 'lbl', c.label));
      btn.appendChild(el('span', 'pw', '⚔️'.repeat(c.power)));
      btn.appendChild(el('span', 'k', i + 1));
      btn.addEventListener('click', () => onCard(i));
      hand.appendChild(btn);
    });
  }

  /* ---------- battle animations (CSS classes; skipped when the player prefers reduced motion) ---------- */

  function pulse(node, cls, ms) {
    if (!node || reduceMotion()) return;
    node.classList.remove(cls);
    void node.offsetWidth; // restart the animation
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms || 600);
  }

  function floater(over, text, kind) {
    const f = el('div', 'floater ' + kind, text);
    const box = over.getBoundingClientRect();
    const host = $('qFloat').getBoundingClientRect();
    f.style.left = box.left - host.left + box.width / 2 + 'px';
    f.style.top = box.top - host.top + box.height * 0.2 + 'px';
    $('qFloat').appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }

  /** The player's hit lands now; the enemy answers a moment later so each side is seen (no waiting at all with reduced motion). */
  function animateTurn(ev) {
    const enemy = $('qEnemySprite');
    const team = $('qStageTeam');
    const lead = team.firstElementChild;
    if (ev.correct) {
      pulse(lead, 'lunge', 450);
      setTimeout(() => { pulse(enemy, 'hurt', 500); floater(enemy, '-' + ev.dmg, 'dmg'); }, reduceMotion() ? 0 : 220);
    } else {
      pulse(enemy, 'heal', 600);
      if (ev.heal) floater(enemy, '+' + ev.heal, 'heal');
    }
    if (ev.taken && ev.over !== 'win') {
      setTimeout(() => {
        pulse(enemy, 'lunge-enemy', 450);
        setTimeout(() => { pulse(team, 'hurt', 500); floater(team, '-' + ev.taken, 'hit'); }, reduceMotion() ? 0 : 200);
      }, reduceMotion() ? 0 : 650);
    }
    if (ev.over === 'win') pulse(enemy, 'faint', 900);
  }

  function onCard(i) {
    const b = Q && Q.battle;
    if (!b || b.over || !$('panel').hidden) return;
    const e = b.enemy;
    const ev = RPG.play(b, i);
    if (!ev) return;
    Store.record(ctx.profile, e.rule.id, ev.correct);
    ctx.onSave();
    animateTurn(ev);

    const enemyLine = ev.over === 'win' ? '' : ev.charged
      ? ' ⚡ The ' + e.name + "'s big attack hits your team for " + ev.taken + '!'
      : ev.stunned ? ' The ' + e.name + ' is stunned and can’t attack.'
      : ' The ' + e.name + ' hits your team for ' + ev.taken + '.';

    if (ev.over === 'win') {
      Q.log = '';
      renderBattle();
      UI.toast('✓ ' + ev.msg + ' — ' + ev.dmg + ' damage!', true);
      setTimeout(showWin, reduceMotion() ? 650 : 1000);
    } else if (ev.over === 'lose') {
      renderBattle();
      setTimeout(() => UI.panel({
        title: ev.correct ? 'Your team needs a rest' : 'Not quite!',
        text: (ev.correct ? '' : ev.msg + ' ') + "Your team ran out of health. Don't worry: everyone gets full health. Try this monster again!",
        btn: 'Try again',
        onBtn: () => startBattle(),
        btn2: 'Leave',
        onBtn2: () => { Q.run = null; if (Q.node) { Q.node = null; goMap(); } else goHome(); },
        bad: true,
      }), reduceMotion() ? 0 : 900);
    } else if (ev.correct) {
      Q.log = '✓ ' + ev.msg + ' — ' + ev.dmg + ' damage!' + enemyLine;
      renderBattle();
      UI.toast('✓ ' + ev.dmg + ' damage!', true);
    } else {
      Q.log = '';
      renderBattle();
      UI.panel({
        title: 'Not quite!',
        text: ev.msg + (ev.heal ? ' The ' + e.name + ' healed ' + ev.heal + ' HP.' : '') + enemyLine,
        btn: 'Keep going',
        onBtn: () => {},
        bad: true,
      });
    }
  }

  function showWin() {
    const b = Q.battle;
    const r = rpg();
    const rw = RPG.rewards(b);
    const out = RPG.applyRewards(r, rw, Store.deviceId);
    ctx.onSave();
    let text = (rw.clean ? 'A perfect fight! ' : '') + '+' + rw.xp + ' XP.';
    if (out.levelUps) text += " Level up! You're now level " + RPG.progress(r).level + ', so your team has more health.';
    if (out.joined) text += ' ' + out.joined.emoji + ' ' + out.joined.name + ' joined your creatures!';

    if (Q.node) {
      const reg = WorldMap.regionById(Q.node.region);
      const n = WorldMap.nodeById(reg, Q.node.id);
      if (n.type === 'rescue' && n.ally && RPG.creatureById(n.ally) && !r.creatures.includes(n.ally)) {
        r.creatures.push(n.ally);
        const f = RPG.creatureById(n.ally);
        text += ' The cage opens! ' + f.emoji + ' ' + f.name + ' is free and joins you!';
      }
      UI.panel({
        title: n.type === 'boss' ? 'Region boss beaten! 🏆' : 'Victory! 🎉',
        text,
        btn: 'Back to the map',
        onBtn: () => finishNode(n, rw.clean),
      });
      return;
    }
    const last = Q.run && Q.run.i >= RPG.PLAN.length - 1;
    UI.panel({
      title: last ? 'Adventure complete! 🏆' : 'Victory! 🎉',
      text,
      btn: last ? 'Back to quest' : 'Next battle',
      onBtn: () => {
        if (last || !Q.run) { Q.run = null; goHome(); return; }
        Q.run.i++;
        nextEnemy();
        openPrep('fight');
      },
      btn2: last ? 'Go again' : null,
      onBtn2: () => beginRun(),
    });
  }

  function onKey(e) {
    if (!Q || !Q.battle || $('qBattle').hidden || !$('panel').hidden) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= Q.battle.hand.length) {
      e.preventDefault();
      onCard(n - 1);
    }
  }

  root.Quest = { start, _state: () => Q };
})(window);
