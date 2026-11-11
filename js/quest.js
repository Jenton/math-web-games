/* Creature Quest UI: quest home, team picker / pre-battle, and turn-based battle.
 * All rules live in js/rpg.js; this file only draws screens and handles taps. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['qHome', 'qPrep', 'qBattle'];
  let ctx = null;
  let Q = null;
  let bound = false;

  function showView(id) {
    VIEWS.forEach((v) => ($(v).hidden = v !== id));
    window.scrollTo(0, 0);
  }

  const rpg = () => ctx.profile.games.rpg;
  const sel = () => ctx.profile.settings;

  function init() {
    if (bound) return;
    bound = true;
    $('qBack').addEventListener('click', exit);
    $('qBegin').addEventListener('click', beginRun);
    $('qMyTeam').addEventListener('click', () => openPrep('collection'));
    $('qPrepBack').addEventListener('click', () => {
      Q.run = null;
      goHome();
    });
    $('qFight').addEventListener('click', onPrepDone);
    $('qFlee').addEventListener('click', () => {
      UI.hide();
      Q.battle = null;
      Q.run = null;
      goHome();
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
    Q = { mode: 'home', run: null, enemy: null, battle: null, lastRuleId: null, selected: [], guess: 0, puzzle: null };
    goHome();
  }

  function exit() {
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  /* ---------- quest home ---------- */

  function teamStrip(el, ids, enemy) {
    el.innerHTML = '';
    ids.forEach((id) => {
      const c = RPG.creatureById(id);
      const d = document.createElement('span');
      d.className = 'q-mate';
      d.textContent = c.emoji;
      d.title = c.name + ' (strong against ' + c.strong + ')';
      d.setAttribute('aria-label', c.name);
      if (enemy && enemy.themes.includes(c.id)) {
        const s = document.createElement('span');
        s.className = 'star';
        s.textContent = '⭐';
        d.appendChild(s);
      }
      el.appendChild(d);
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

  /* ---------- team picker / pre-battle ---------- */

  function beginRun() {
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
      $('qRun').textContent = 'Battle ' + (Q.run.i + 1) + ' of ' + RPG.PLAN.length;
      $('qPvEmoji').textContent = e.emoji;
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
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'creature' + (has ? '' : ' locked') + (Q.selected.includes(c.id) ? ' on' : '');
      b.disabled = !has;
      b.setAttribute('aria-pressed', Q.selected.includes(c.id));
      const match = has && enemy && enemy.themes.includes(c.id);
      const how = c.id === 'boss' ? 'Defeat a boss' : c.id === 'armor' ? 'Defeat an armored monster' : 'Defeat a ' + RPG.ENEMY_ART[c.id].name;
      b.innerHTML = '<span class="c-emoji"></span><span class="c-name"></span><span class="c-sub"></span>';
      b.querySelector('.c-emoji').textContent = has ? c.emoji : '❓';
      b.querySelector('.c-name').textContent = has ? c.name : '???';
      b.querySelector('.c-sub').textContent = has ? 'Strong vs ' + c.strong + (match ? ' ⭐' : '') : how + ' to befriend';
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

  /* ---------- battle ---------- */

  function startBattle() {
    Q.battle = RPG.newBattle({ band: sel().band, stars: sel().stars, enemy: Q.enemy, team: RPG.currentTeam(rpg()), level: RPG.progress(rpg()).level });
    Q.puzzle = null;
    Q.log = Q.battle.bonus > 0
      ? '⭐ Your specialists make every hit stronger! Pick the card that fits the weakness.'
      : 'Pick the card that fits the weakness. The strongest ⚔️ card that fits does the most damage!';
    showView('qBattle');
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
    $('qEnemyEmoji').textContent = e.emoji;
    $('qEnemyName').textContent = e.name + (e.kind === 'boss' ? ' 👑' : e.kind === 'armor' ? ' 🛡️' : '');
    $('qEnemyHp').style.width = Math.round((100 * b.enemyHp) / b.enemyMax) + '%';
    $('qEnemyHpText').textContent = 'HP ' + b.enemyHp + ' / ' + b.enemyMax;
    $('qWeakTitle').textContent = e.weakness;
    $('qWeakHint').textContent = e.hint;
    $('qTurn').textContent = 'Turn ' + b.turn;
    $('qRunPill').textContent = Q.run ? 'Battle ' + (Q.run.i + 1) + ' of ' + RPG.PLAN.length : '';
    teamStrip($('qTeam'), b.team, e);
    $('qTeamHp').style.width = Math.round((100 * b.teamHp) / b.teamMax) + '%';
    $('qTeamHpText').textContent = b.teamHp + ' / ' + b.teamMax;
    $('qLog').textContent = Q.log || '';
    renderCharge();
    const hand = $('qHand');
    hand.innerHTML = '';
    b.hand.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qcard' + (c.label.length > 6 ? ' long' : '');
      btn.setAttribute('aria-label', c.label + ', power ' + c.power);
      btn.innerHTML = '<span class="lbl"></span><span class="pw"></span><span class="k"></span>';
      btn.querySelector('.lbl').textContent = c.label;
      btn.querySelector('.pw').textContent = '⚔️'.repeat(c.power);
      btn.querySelector('.k').textContent = i + 1;
      btn.addEventListener('click', () => onCard(i));
      hand.appendChild(btn);
    });
  }

  function onCard(i) {
    const b = Q && Q.battle;
    if (!b || b.over || !$('panel').hidden) return;
    const e = b.enemy;
    const ev = RPG.play(b, i);
    if (!ev) return;
    Store.record(ctx.profile, e.rule.id, ev.correct);
    ctx.onSave();

    const enemyLine = ev.over === 'win' ? '' : ev.charged
      ? ' ⚡ The ' + e.name + "'s big attack hits your team for " + ev.taken + '!'
      : ev.stunned ? ' The ' + e.name + ' is stunned and can’t attack.'
      : ' The ' + e.name + ' hits your team for ' + ev.taken + '.';

    if (ev.over === 'win') {
      Q.log = '';
      renderBattle();
      UI.toast('✓ ' + ev.msg + ' — ' + ev.dmg + ' damage!', true);
      setTimeout(showWin, 650);
    } else if (ev.over === 'lose') {
      renderBattle();
      UI.panel({
        title: ev.correct ? 'Your team needs a rest' : 'Not quite!',
        text: (ev.correct ? '' : ev.msg + ' ') + "Your team ran out of health. Don't worry: everyone gets full health. Try this monster again!",
        btn: 'Try again',
        onBtn: () => startBattle(),
        btn2: 'Leave',
        onBtn2: () => { Q.run = null; goHome(); },
        bad: true,
      });
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
