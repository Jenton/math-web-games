/* Portal: player picker, game menu, settings, backup. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐲', '🐱', '🐶', '🐸', '🦉', '🐙', '🌟', '🚀'];
  const BAND_LABELS = { 'K-1': 'Kindergarten – 1st', '2-3': '2nd – 3rd', '4-5': '4th – 5th', '6': '6th grade' };
  const BAND_INFO = {
    'K-1': 'Adding to small numbers, even and odd, bigger or smaller.',
    '2-3': 'Skip counting, adding and subtracting, rounding, bigger or smaller.',
    '4-5': 'Multiplication facts, factors, prime numbers, mixed expressions.',
    '6': 'Fractions, exponents, negative numbers, primes, factors.',
  };
  const GAMES = {
    quest: {
      name: 'Creature Quest', ico: 'medals/m3', extras: false, mod: () => Quest,
      how: ['Monsters come in <b>groups</b>, and each has its own <b>weakness</b>, like "multiples of 6". <b>Tap a monster</b> to attack it.', '<b>Pick the card</b> that fits its weakness. A right card does damage. A wrong card does nothing, and <b>every monster hits back</b>!', 'Choose which <b>friend</b> acts: each has a special power. <b>Rescue caged friends</b> to grow your team and win the boss fight.'],
      band: { 'K-1': 'Weaknesses like even and odd, bigger or smaller, and adding to a number. Armor made of halves, thirds and quarters.', '2-3': 'Skip counting, rounding, adding and subtracting. Armor made of simple fractions.', '4-5': 'Multiples, factors, prime numbers. Armor made of fractions with different bottoms.', '6': 'Fractions, exponents, negative numbers, primes. Armor in fractions, decimals and percents.' },
      stars: [['★ Easier', 'Smaller numbers, 2 monsters at most, 5 cards.'], ['★★ Medium', 'Bigger numbers, up to 3 monsters.'], ['★★★ Harder', 'The trickiest numbers, up to 3 monsters, 6 cards.']],
      sample: (s) => RPG.sampleText(s.band, s.stars),
    },
    munchers: {
      name: 'Munchers', ico: 'animals/frog', extras: true, mod: () => Munchers,
      how: ['<b>Read the rule</b> at the top of the board.', '<b>Walk</b> to a number that fits: tap it, or use the arrow keys.', '<b>Munch</b> it! A wrong munch costs a heart and shows you why.'],
      band: BAND_INFO,
      stars: [['★ Easier', 'Smaller numbers, 8 to munch, 1 glitch.'], ['★★ Medium', 'Bigger numbers, 10 to munch, 2 glitches.'], ['★★★ Harder', 'Trickiest numbers, 12 to munch, 3 fast glitches.']],
      sample: (s) => MG.makeLevelRule(s.band, s.stars, null).title,
    },
    balance: {
      name: 'Balance', ico: 'balance/blockBlue', extras: false, mod: () => Balance,
      how: ['Every <b>yellow block</b> is the same mystery weight (<b>?</b>). White blocks show their weight.', '<b>Change the number</b> for ? with − and +. Watch the scale tip.', '<b>Lock it in</b> when you think both sides are equal.'],
      band: { 'K-1': 'One mystery block and a few small blocks. Totals up to 20.', '2-3': 'Two mystery blocks, or bigger totals up to 50.', '4-5': 'Several mystery blocks plus extra weight, like 4 × ? + 7.', '6': 'Mystery blocks on both sides, like 5 × ? + 3 = 2 × ? + 21.' },
      stars: [['★ Easier', 'Smaller numbers.'], ['★★ Medium', 'Bigger numbers and more blocks.'], ['★★★ Harder', 'The trickiest numbers and more blocks.']],
      sample: (s) => MGP.makeBalance(s.band, s.stars).text,
    },
    lemonade: {
      name: 'Lemonade Stand', ico: 'lemonade/pitcher', extras: false, mod: () => Lemonade,
      how: ['Each <b>day</b> has four linked jobs: set the <b>price</b>, buy the right amount for the customers it brings, then make <b>change</b> for two of them.', 'Build change from coins, or pick a number with − and +.', 'Wrong answers show the arithmetic, so you can try again.'],
      band: { 'K-1': 'Change from $1 in coins, and small pitcher counts.', '2-3': 'Change to the cent, and how many pitchers for the crowd.', '4-5': 'Several cups at once, lemons per pitcher, and a sign that costs money.', '6': 'Percent-off sales, recipe ratios, and bigger profits.' },
      stars: [['★ Easier', 'Round numbers and three prices to pick from.'], ['★★ Medium', 'Trickier numbers and four prices.'], ['★★★ Harder', 'Bigger numbers and more prices.']],
      sample: (s) => MGS.makeStock(s.band, s.stars).text,
    },
    runner: {
      name: 'Number Line Runner', ico: 'runner/c0', extras: false, mod: () => Runner,
      how: ['The <b>number line</b> is a rope over the river. The sign tells you where to go: "Land on 3/4" or "Hop 1/2 to the right".', '<b>Tap a tick</b> to aim (use the arrows to nudge it), then press <b>Jump!</b> The spot is never marked, so read the ticks to find it.', 'Land exactly and a stone and flag appear. Miss and you splash, and we count how many ticks you were off.'],
      band: { 'K-1': 'Whole numbers on a line to 10, then to 20 counting by ones.', '2-3': 'A line to 100: counting by tens, then fives, and hopping by tens and fives.', '4-5': 'Fractions on a line from 0 to 2 by fourths, eighths or tenths, and mixed numbers and decimals.', '6': 'Negative numbers, halves, fourths, decimals and percents on a line through zero.' },
      stars: [['★ Easier', 'Fewer ticks and every spot is a plain landing.'], ['★★ Medium', 'A finer line, some labels left out.'], ['★★★ Harder', 'Hops, expressions, and several ways to write the same number.']],
      sample: (s) => { const r = RUN.makeRun(s.band, s.stars); return r.checkpoints[0].text + ' (the line has ' + r.ticks + ' ticks, each worth ' + RUN.writeValue(r.line, r.line.step, r.line.modes[0]) + ')'; },
    },
    escape: {
      name: 'Escape Room', ico: 'escape/t89', extras: false, mod: () => Escape,
      how: ['You are locked in a dungeon room with <b>three chests</b>, each with a lock. Tap a chest and your hero walks over.', 'Crack the <b>pattern, code, scale or machine</b> lock. A wrong try shows you the arithmetic; hints are always there.', 'Open all three and the <b>exit door</b> opens. Fewer wrong tries and hints means more stars.'],
      band: { 'K-1': 'Counting patterns by 1s, 2s, 5s and 10s, and codes made of small sums.', '2-3': 'Skip-counting and doubling patterns, code clues with times and take-away, and bigger scales.', '4-5': 'Growing and times-3 patterns, code clues where order of operations matters, longer machines.', '6': 'Squares, Fibonacci-style and negative patterns, clues with powers and negatives, scales with ? on both sides.' },
      stars: [['★ Easier', 'Shorter patterns, 3-digit codes, simple locks.'], ['★★ Medium', 'Trickier patterns and clues.'], ['★★★ Harder', 'The hardest patterns, 4-digit codes.']],
      sample: (s) => { const q = ESC.makeSequence(s.band, s.stars); return 'Pattern lock: ' + q.terms.map(ESC.fmt).join(', ') + ', ?'; },
    },
    defense: {
      name: 'Number Defense', ico: 'animals/owl', extras: false, mod: () => Defense,
      how: ['Numbers march toward your castle. The <b>incoming wave</b> is shown before it starts.', 'Every tower has a <b>rule</b>, like "multiples of 3". It only stops numbers that fit. Gold is limited, so pick towers that cover the whole wave.', '<b>Send the wave</b> and watch. Numbers that slip through are explained.'],
      band: { 'K-1': 'Even, odd, more than and less than, counting by 5s and 10s.', '2-3': 'Multiples of 2, 3, 4, 5 and 10, odd numbers, more and less than.', '4-5': 'Multiples up to 9, prime numbers, factors of a number.', '6': 'Primes, squares, powers of 2, bigger multiples, negatives, factors.' },
      stars: [['★ Easier', '7 numbers, a little spare gold.'], ['★★ Medium', '9 numbers, less spare gold.'], ['★★★ Harder', '11 numbers and only just enough gold.']],
      sample: (s) => { const w = TDL.makeWave(s.band, s.stars); return 'Stop ' + w.enemies.slice(0, 5).map(TDL.fmt).join(', ') + '… with ' + w.budget + ' gold. Towers: ' + w.shop.map((r) => r.name).join(', '); },
    },
    machine: {
      name: 'Machine Builder', ico: 'balance/pipe01', extras: false, mod: () => Machine,
      how: ['You get a <b>start number</b>, a <b>target</b>, and a few operation cards.', '<b>Tap cards</b> to build a chain. Each one changes the number.', 'Reach the target in as <b>few steps</b> as you can for more stars.'],
      band: { 'K-1': 'Adding and subtracting small numbers.', '2-3': 'Adding, subtracting, and multiplying.', '4-5': 'Multiplying, dividing, adding, subtracting.', '6': 'All four operations plus squaring, and numbers can go negative.' },
      stars: [['★ Easier', '3 cards, short chains.'], ['★★ Medium', '4 cards, medium chains.'], ['★★★ Harder', '4 cards, long chains.']],
      sample: (s) => { const m = MGP.makeMachine(s.band, s.stars); return 'Turn ' + MGP.fmt(m.start) + ' into ' + MGP.fmt(m.target) + ' using ' + m.ops.map((o) => o.label).join(', '); },
    },
    sort: {
      name: 'Sort & Rule', ico: '🚪', extras: false, mod: () => Sort,
      how: ['The gate has a <b>secret rule</b>. Pick a number to send through and see if it passes or is stopped.', 'Test a few numbers and <b>look for the pattern</b>. Testing fewer numbers earns more stars.', 'Then <b>pick the rule</b> from four choices. A wrong pick shows you a number that proves it wrong.'],
      band: { 'K-1': 'Even or odd, bigger or smaller than a number, counting by 5s.', '2-3': 'Multiples of 2, 3, 4, 5 and 10, and numbers in between.', '4-5': 'Multiples up to 9, prime and square numbers, factors.', '6': 'Rules with "and", "or" and "not", like prime or square.' },
      stars: [['★ Easier', 'Simple one-part rules.'], ['★★ Medium', 'Trickier rules.'], ['★★★ Harder', 'The trickiest rules, some with two parts.']],
      sample: (s) => { const p = MGR.makeSort(s.band, s.stars); return 'The gate lets through… ' + p.rule.text; },
    },
    share: {
      name: 'Cut & Share', ico: '🍕', extras: false, mod: () => Share,
      how: ['Some friends want <b>fair shares</b> of pizza.', '<b>Choose how many slices</b> to cut each pizza into, and how many slices <b>each friend</b> gets.', 'Use every slice and keep it fair. <b>Fewer cuts</b> earn more stars. You get <b>3 tries</b>.'],
      band: { 'K-1': 'Halves, thirds and quarters of one or two pizzas.', '2-3': 'A few pizzas shared among up to 8 friends.', '4-5': 'More pizzas and more friends, including more than one pizza each.', '6': 'Share part of a pizza, like 3/4 of a pizza among 3 friends.' },
      stars: [['★ Easier', 'Fewer friends, smaller numbers.'], ['★★ Medium', 'More pizzas and friends.'], ['★★★ Harder', 'The biggest groups and trickiest splits.']],
      sample: (s) => MGC.makeShare(s.band, s.stars).text,
    },
  };
  // the id a game's data is saved under (the portal key differs for two of them)
  const DATA_ID = (key) => ({ quest: 'rpg', defense: 'td' }[key] || key);
  let currentGame = 'munchers';
  let current = null;
  let chosenAvatar = AVATARS[0];

  function show(id) {
    ['home', 'menu', 'setup', 'game', 'balance', 'escape', 'runner', 'td', 'machine', 'lemonade', 'sort', 'share', 'quest'].forEach((s) => ($('#' + s).hidden = s !== id));
    window.scrollTo(0, 0);
  }

  function applyTheme(p) {
    document.body.dataset.theme = p ? p.settings.theme : 'block';
    document.documentElement.dataset.motion = p && p.settings.motion === 'reduced' ? 'reduced' : 'full';
  }

  /* ---------- home ---------- */

  /** Rebuild the player list and save note (safe to call any time; does not switch screens or scroll). */
  function renderPlayers() {
    const list = $('#players');
    list.innerHTML = '';
    Store.profiles.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'player-card';
      b.innerHTML = '<span class="av"></span><span class="nm"></span><span class="sub"></span>';
      b.querySelector('.av').textContent = p.avatar;
      b.querySelector('.nm').textContent = p.name;
      b.querySelector('.sub').textContent = BAND_LABELS[p.settings.band];
      b.addEventListener('click', () => openMenu(p.id));
      list.appendChild(b);
    });
    const add = document.createElement('button');
    add.className = 'player-card add';
    add.innerHTML = '<span class="av">＋</span><span class="nm">New player</span>';
    add.addEventListener('click', openNewPlayer);
    list.appendChild(add);

    const note = $('#saveNote');
    if (!Store.ok) note.textContent = '⚠️ Your browser is blocking saving. Progress will be lost when you close this page.';
    else if (Store.lastSaved) note.textContent = 'Saved on this device · last saved ' + new Date(Store.lastSaved).toLocaleString();
    else note.textContent = 'Everything is saved privately on this device. No accounts, no ads.';
  }

  function renderHome() {
    applyTheme(null);
    renderPlayers();
    show('home');
  }

  function openNewPlayer() {
    const dlg = $('#newPlayer');
    $('#npName').value = '';
    chosenAvatar = AVATARS[0];
    const box = $('#npAvatars');
    box.innerHTML = '';
    AVATARS.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip av-chip' + (a === chosenAvatar ? ' on' : '');
      b.textContent = a;
      b.addEventListener('click', () => {
        chosenAvatar = a;
        [...box.children].forEach((x) => x.classList.toggle('on', x === b));
      });
      box.appendChild(b);
    });
    const sel = $('#npBand');
    sel.innerHTML = '';
    MG.BANDS.forEach((b) => {
      const o = document.createElement('option');
      o.value = b;
      o.textContent = BAND_LABELS[b];
      if (b === '2-3') o.selected = true;
      sel.appendChild(o);
    });
    dlg.showModal();
    $('#npName').focus();
  }

  /* ---------- menu ---------- */

  function chips(container, options, currentValue, onPick) {
    container.innerHTML = '';
    options.forEach(([value, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (value === currentValue ? ' on' : '');
      b.textContent = label;
      b.setAttribute('aria-pressed', value === currentValue);
      b.addEventListener('click', () => {
        onPick(value);
        [...container.children].forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', x === b);
        });
      });
      container.appendChild(b);
    });
  }

  /** Big option cards: a title plus a plain-language line saying what it changes. */
  function optCards(container, options, currentValue, onPick) {
    container.innerHTML = '';
    options.forEach(([value, title, desc]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt-card' + (value === currentValue ? ' on' : '');
      b.setAttribute('aria-pressed', value === currentValue);
      b.innerHTML = '<span class="o-t"></span><span class="o-d"></span>';
      b.querySelector('.o-t').textContent = title;
      b.querySelector('.o-d').textContent = desc;
      b.addEventListener('click', () => {
        onPick(value);
        [...container.children].forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', x === b);
        });
      });
      container.appendChild(b);
    });
  }

  function openMenu(id) {
    current = Store.find(id);
    if (!current) return renderHome();
    applyTheme(current);
    $('#menuAv').textContent = current.avatar;
    $('#menuName').textContent = current.name;
    const nameIn = $('#setName');
    nameIn.value = current.name;
    const paintWho = () => { $('#menuAv').textContent = current.avatar; $('#menuName').textContent = current.name; };
    nameIn.onchange = () => { Store.setMeta(current, { name: nameIn.value }); nameIn.value = current.name; Store.save(); paintWho(); };
    chips($('#setAvatar'), AVATARS.map((a) => [a, a]), current.avatar, (v) => { Store.setMeta(current, { avatar: v }); Store.save(); paintWho(); });
    chips($('#setDefaultBand'), MG.BANDS.map((b) => [b, BAND_LABELS[b]]), current.settings.band, (v) => { Store.setSettings(current, { band: v }); Store.save(); });
    chips($('#setMotion'), [['full', 'Full motion'], ['reduced', 'Reduce motion']], current.settings.motion || 'full', (v) => { Store.setSettings(current, { motion: v }); Store.save(); applyTheme(current); });
    const stats = $('#statsList');
    stats.innerHTML = '';
    const ids = Store.statSkills(current);
    if (!ids.length) stats.innerHTML = '<li>No games played yet.</li>';
    ids.forEach((k) => {
      const li = document.createElement('li');
      const st = Store.stat(current, k);
      li.textContent = (MG.SKILLS[k] || MGP.SKILLS[k] || RPG.SKILLS[k] || MGS.SKILLS[k] || MGR.SKILLS[k] || MGC.SKILLS[k] || ESC.SKILLS[k] || RUN.SKILLS[k] || k) + ': ' + st.right + ' right, ' + st.wrong + ' oops';
      stats.appendChild(li);
    });
    const count = (id, f) => Store.total(Store.game(current, id), f);
    $('#levelsCleared').textContent = count('munchers', 'levels') + ' Munchers levels, ' + count('balance', 'levels') + ' Balance puzzles, ' + count('machine', 'levels') + ' Machine puzzles solved, ' + count('lemonade', 'days') + ' Lemonade days run, ' + count('td', 'waves') + ' Defense waves held, ' + count('escape', 'rooms') + ' Escape Rooms cleared, ' + count('runner', 'runs') + ' Number Line runs, ' + count('rpg', 'wins') + ' Quest battles won, ' + count('sort', 'levels') + ' Sort & Rule and ' + count('share', 'levels') + ' Cut & Share puzzles solved';
    show('menu');
  }

  /* ---------- game setup (one screen: choose, then Play) ---------- */

  function updateSetup() {
    const s = Store.level(current, DATA_ID(currentGame));
    const own = Store.hasOwnLevel(current, DATA_ID(currentGame), 'band');
    $('#bandHelp').textContent = own ? 'Set just for ' + GAMES[currentGame].name + '. Your default grade (' + BAND_LABELS[current.settings.band] + ') is unchanged.' : 'Using your default grade. Pick another here to change only this game.';
    $('#bandReset').hidden = !own;
    const g = GAMES[currentGame];
    const star = g.stars[s.stars - 1][0];
    $('#summary').textContent = BAND_LABELS[s.band] + ' · ' + star + (g.extras ? ' · ' + (s.monsters === 'on' ? 'Glitches on' : 'Calm') + ' · ' + Munchers.THEMES[s.theme].name : '');
    $('#monstersHelp').textContent = s.monsters === 'on'
      ? 'Glitches wander the board. If one touches you, you lose a heart.'
      : 'No glitches: just you and the numbers. Great for learning at your own pace.';
    $('#sampleRule').textContent = g.sample(s);
  }

  function openSetup(gameId) {
    if (typeof gameId === 'string') currentGame = gameId;
    const g = GAMES[currentGame];
    applyTheme(current);
    const id = DATA_ID(currentGame);
    const s = Store.level(current, id);
    const save = () => { Store.save(); updateSetup(); };
    $('#setupIco').innerHTML = g.ico.includes('/') ? '<img class="g-img" src="assets/kenney/' + g.ico + '.png" alt="">' : g.ico;
    $('#setupTitle').textContent = g.name;
    document.querySelectorAll('#setup .crumb.cur').forEach((c) => (c.textContent = g.name));
    $('#setupHow').innerHTML = g.how.map((t) => '<li>' + t + '</li>').join('');
    $('#extras').hidden = !g.extras;
    $('#questArtBox').hidden = currentGame !== 'quest';
    chips($('#setQuestArt'), Object.keys(Art.THEMES).map((k) => [k, (k === 'cute' ? '🐰 ' : '🗡️ ') + Art.THEMES[k].name]), Art.themeId(current), (v) => { Store.setSettings(current, { questArt: v }); $('#questArtHelp').textContent = Art.THEMES[v].blurb + ' Only changes the pictures. The game stays the same.'; save(); });
    $('#questArtHelp').textContent = Art.THEMES[Art.themeId(current)].blurb + ' Only changes the pictures. The game stays the same.';
    optCards($('#setBand'), MG.BANDS.map((b) => [b, BAND_LABELS[b], g.band[b]]), s.band, (v) => { Store.setLevel(current, id, { band: v }); save(); });
    optCards($('#setStars'), [1, 2, 3].map((n) => [n, g.stars[n - 1][0], g.stars[n - 1][1]]), s.stars, (v) => { Store.setLevel(current, id, { stars: v }); save(); });
    chips($('#setTheme'), Object.keys(Munchers.THEMES).map((k) => [k, Munchers.THEMES[k].player + ' ' + Munchers.THEMES[k].name]), s.theme, (v) => { Store.setSettings(current, { theme: v }); applyTheme(current); save(); });
    chips($('#setMonsters'), [['on', 'Glitches on'], ['off', 'Calm (no glitches)']], s.monsters, (v) => { Store.setSettings(current, { monsters: v }); save(); });
    updateSetup();
    show('setup');
  }

  const SCREEN_OF = { munchers: 'game', balance: 'balance', escape: 'escape', runner: 'runner', defense: 'td', machine: 'machine', lemonade: 'lemonade', sort: 'sort', share: 'share', quest: 'quest' };
  function playGame() {
    applyTheme(current);
    show(SCREEN_OF[currentGame]);
    GAMES[currentGame].mod().start(current, { onSave: () => Store.save(), onExit: () => openSetup(currentGame) });
  }

  /* ---------- breadcrumbs ---------- */
  // Every level screen shows "Players > Games > <game>" so a player can jump to the top (Players) or just back to the Games list.
  // The old back-button ids live on the crumb that does the same job, so each game's own exit code (saving, stopping timers) still runs.
  const GAME_NAME = (k) => (GAMES[k] ? GAMES[k].name : k);

  function buildCrumbs() {
    document.querySelectorAll('nav.crumbs').forEach((nav) => {
      const level = nav.dataset.level;
      const back = nav.dataset.back;
      const add = (label, opts) => {
        if (nav.children.length) { const sep = document.createElement('span'); sep.className = 'crumb-sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = '›'; nav.appendChild(sep); }
        const el = document.createElement(opts.cur ? 'span' : 'button');
        el.className = 'crumb' + (opts.cur ? ' cur' : '');
        el.textContent = label;
        if (opts.cur) el.setAttribute('aria-current', 'page');
        else { el.type = 'button'; if (opts.id) el.id = opts.id; if (opts.go) el.dataset.go = opts.go; }
        nav.appendChild(el);
        return el;
      };
      if (level === 'menu') { add('Players', { id: back }); add('Games', { cur: true }); }
      else if (level === 'setup') { add('Players', { go: 'home' }); add('Games', { id: back }); nav.curEl = add('', { cur: true }); }
      else { add('Players', { go: 'home' }); add('Games', { go: 'menu' }); add(GAME_NAME(nav.dataset.game), { id: back }); }
    });
    // a crumb that jumps further than the game's own back button first runs that button (so the game saves and stops), then moves on
    document.addEventListener('click', (e) => {
      const c = e.target.closest && e.target.closest('.crumb[data-go]');
      if (!c) return;
      const nav = c.closest('nav.crumbs');
      if (nav.dataset.level === 'play') { const exitBtn = document.getElementById(nav.dataset.back); if (exitBtn) exitBtn.click(); }
      if (!current) return renderHome();
      if (c.dataset.go === 'menu') openMenu(current.id);
      else renderHome();
    });
  }

  /* ---------- wiring ---------- */

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function boot() {
    Store.load();
    // a background sync changed the data: refresh the player list if it is showing (profile objects are updated in place)
    document.addEventListener('mq:data-changed', () => { if (!$('#home').hidden) renderPlayers(); });
    if (window.SyncUI) SyncUI.init();
    $('#npForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#npName').value.trim();
      if (!name) return;
      const p = Store.newProfile(name, chosenAvatar, $('#npBand').value);
      $('#newPlayer').close();
      openMenu(p.id);
    });
    $('#npCancel').addEventListener('click', () => $('#newPlayer').close());
    buildCrumbs();
    $('#menuBack').addEventListener('click', renderHome);
    document.querySelectorAll('[data-game]').forEach((b) => b.addEventListener('click', () => openSetup(b.dataset.game)));
    $('#playNow').addEventListener('click', playGame);
    $('#bandReset').addEventListener('click', () => { Store.setLevel(current, DATA_ID(currentGame), { band: null }); Store.save(); openSetup(currentGame); });
    // sound: one mute button for every game, and a soft click on any button or card
    const sb = $('#soundBtn');
    const paintSound = () => {
      sb.textContent = Sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}';
      sb.setAttribute('aria-pressed', String(!Sfx.isMuted()));
      sb.setAttribute('aria-label', Sfx.isMuted() ? 'Sound is off. Tap to turn on' : 'Sound is on. Tap to mute');
    };
    sb.addEventListener('click', () => { Sfx.toggle(); if (!Sfx.isMuted()) Sfx.play('click'); });
    Sfx.onChange(paintSound);
    paintSound();
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('.btn, .chip, .game-card, .player-card, .opt-card, .creature, .crumb');
      if (t && t !== sb && t.id !== 'munchBtn' && !t.disabled) Sfx.play('click');
    });
    $('#setupBack').addEventListener('click', () => openMenu(current.id));
    $('#sampleMore').addEventListener('click', updateSetup);
    $('#deletePlayer').addEventListener('click', () => {
      if (confirm('Delete ' + current.name + " and all of their progress? This can't be undone.")) {
        Store.remove(current.id);
        renderHome();
      }
    });
    $('#backupBtn').addEventListener('click', () => download('math-quest-backup.json', Store.exportJSON()));
    $('#restoreInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!confirm('Replace all players on this device with the ones in this backup?')) {
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const err = Store.importJSON(String(reader.result));
        if (err) alert(err);
        e.target.value = '';
        renderHome();
      };
      reader.readAsText(f);
    });
    renderHome();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
