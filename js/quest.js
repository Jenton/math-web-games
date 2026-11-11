/* Creature Quest UI (v2): quest home, team picker / pre-battle, and turn-based battles against groups of monsters.
 * All rules live in js/rpg.js; this file draws the screens, animates what happened, and handles taps.
 * Art is placeholder emoji and CSS for now (see docs/game-ideas.md, "Art plan"). */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['qHome', 'qPrep', 'qBattle'];
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
  const alliesOf = (ids) => ids.map((id) => RPG.creatureById(id)).filter(Boolean);

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
      Q.busy = false;
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
    Q = { mode: 'home', run: null, encounter: null, battle: null, selected: [], guess: 0, puzzle: null, busy: false, log: '' };
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
      d.textContent = c.emoji;
      d.title = c.name + ': ' + c.effectName + '. ' + c.effectText;
      d.setAttribute('aria-label', c.name);
      el.appendChild(d);
    });
  }

  function goHome() {
    const r = rpg();
    const pr = RPG.progress(r);
    $('qLevel').textContent = 'Level ' + pr.level;
    $('qXp').style.width = Math.round((100 * pr.xp) / pr.need) + '%';
    $('qXpText').textContent = pr.xp + ' / ' + pr.need + ' XP to level ' + (pr.level + 1);
    $('qStats').textContent = 'Team health ' + RPG.maxHp(pr.level) + ' · ' + pr.wins + ' battles won · ' + r.creatures.length + ' of ' + RPG.CREATURES.length + ' friends found';
    teamStrip($('qHomeTeam'), RPG.currentTeam(r));
    showView('qHome');
  }

  /* ---------- team picker / pre-battle ---------- */

  function beginRun() {
    Q.run = { i: 0, plan: RPG.planAdventure(sel().band, sel().stars, rpg().creatures) };
    Q.encounter = Q.run.plan[0];
    openPrep('fight');
  }

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
      $('qRun').textContent = 'Battle ' + (Q.run.i + 1) + ' of ' + Q.run.plan.length;
      const box = $('qPvFoes');
      box.innerHTML = '';
      Q.encounter.enemies.forEach((e) => {
        const d = document.createElement('div');
        d.className = 'pv-foe';
        d.innerHTML = '<span class="e-emoji"></span><div><div class="e-name"></div><div class="pv-weak"></div></div>';
        d.querySelector('.e-emoji').textContent = e.emoji;
        d.querySelector('.e-name').textContent = e.name + kindTag(e);
        d.querySelector('.pv-weak').textContent = e.weakness;
        box.appendChild(d);
      });
      const rescue = Q.encounter.rescue && RPG.creatureById(Q.encounter.rescue);
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
      if (!has && !findable.includes(c.id)) return; // not findable at this grade level
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'creature' + (has ? '' : ' locked') + (Q.selected.includes(c.id) ? ' on' : '');
      b.disabled = !has;
      b.setAttribute('aria-pressed', Q.selected.includes(c.id));
      const match = has && foes.some((e) => e.themes.includes(c.id));
      b.innerHTML = '<span class="c-emoji"></span><span class="c-name"></span><span class="c-sub"></span><span class="c-eff"></span>';
      b.querySelector('.c-emoji').textContent = has ? c.emoji : '❓';
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
    showView('qBattle');
    renderBattle();
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
      el.querySelector('.e-emoji').textContent = e.emoji;
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
      el.querySelector('.a-emoji').textContent = c.emoji;
      el.querySelector('.a-name').textContent = c.name + ' · ' + c.effectName;
      el.querySelector('.a-eff').textContent = c.effectText;
      if (foe && foe.alive && foe.enemy.themes.includes(c.id)) {
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
    $('qRunPill').textContent = Q.run ? 'Battle ' + (Q.run.i + 1) + ' of ' + Q.run.plan.length : '';
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
    if (RPG.setAlly(b, j)) renderAllies();
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
    if (ev.correct) {
      ev.hits.forEach((h, n) => {
        const el = foeEl(h.i);
        setTimeout(() => { pulse(el, 'hit', 340); floatAt(el, '−' + h.amount, 'dmg'); }, root.__questFast ? 0 : n * 120);
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
      floatAt(foeEl(ev.target), 'Miss!', 'info');
    }
    Q.log = lines.join(' ');
    $('qLog').textContent = Q.log;
    await wait(700);

    if (ev.over === 'win') {
      Q.busy = false;
      UI.toast('✓ ' + ev.msg, true);
      await wait(400);
      return showWin();
    }

    // 2) every living enemy hits back, one after another
    let hp = hp0 + ev.healed;
    for (const a of ev.attacks) {
      const el = foeEl(a.i);
      pulse(el, 'lunge', 440);
      await wait(300);
      if (a.skipped) floatAt(el, '💤', 'info');
      else if (a.blocked) floatAt($('qTeamHp'), 'Blocked 🛡️', 'info');
      else {
        hp = Math.max(0, hp - a.dmg);
        floatAt($('qTeamHp'), '−' + a.dmg, 'dmg');
        pulse($('qTeamHp').closest('.team-bar'), 'ouch', 340);
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
      return UI.panel({
        title: 'Your team needs a rest',
        text: (ev.correct ? '' : ev.msg + ' ') + "Your team ran out of health. Don't worry: everyone gets full health. Try these monsters again!",
        btn: 'Try again',
        onBtn: () => startBattle(),
        btn2: 'Leave',
        onBtn2: () => { Q.run = null; goHome(); },
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
    const last = Q.run && Q.run.i >= Q.run.plan.length - 1;
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
