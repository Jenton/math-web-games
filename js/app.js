/* Portal: player picker, game menu, settings, backup. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐲', '🐱', '🐶', '🐸', '🦉', '🐙', '🌟', '🚀'];
  const BAND_LABELS = { 'K-1': 'Kindergarten – 1st', '2-3': '2nd – 3rd', '4-5': '4th – 5th', '6': '6th grade' };
  const STAR_LABELS = ['★ Easier', '★★ Medium', '★★★ Harder'];
  let current = null;
  let chosenAvatar = AVATARS[0];

  function show(id) {
    ['home', 'menu', 'game'].forEach((s) => ($('#' + s).hidden = s !== id));
    window.scrollTo(0, 0);
  }

  function applyTheme(p) {
    document.body.dataset.theme = p ? p.settings.theme : 'block';
  }

  /* ---------- home ---------- */

  function renderHome() {
    applyTheme(null);
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
      b.addEventListener('click', () => {
        onPick(value);
        [...container.children].forEach((x) => x.classList.toggle('on', x === b));
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
    const s = current.settings;
    const save = () => Store.save();
    chips($('#setBand'), MG.BANDS.map((b) => [b, BAND_LABELS[b]]), s.band, (v) => { s.band = v; save(); });
    chips($('#setStars'), [1, 2, 3].map((n) => [n, STAR_LABELS[n - 1]]), s.stars, (v) => { s.stars = v; save(); });
    chips($('#setTheme'), Object.keys(Munchers.THEMES).map((k) => [k, Munchers.THEMES[k].name]), s.theme, (v) => { s.theme = v; save(); applyTheme(current); });
    chips($('#setMonsters'), [['on', 'Glitches on'], ['off', 'Calm (no glitches)']], s.monsters, (v) => { s.monsters = v; save(); });

    const stats = $('#statsList');
    stats.innerHTML = '';
    const ids = Object.keys(current.stats);
    if (!ids.length) stats.innerHTML = '<li>No games played yet.</li>';
    ids.forEach((k) => {
      const li = document.createElement('li');
      const st = current.stats[k];
      li.textContent = (MG.SKILLS[k] || k) + ': ' + st.right + ' right, ' + st.wrong + ' oops';
      stats.appendChild(li);
    });
    $('#levelsCleared').textContent = current.munchers.levels + ' Munchers levels cleared';
    show('menu');
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
    $('#npForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#npName').value.trim();
      if (!name) return;
      const p = Store.newProfile(name, chosenAvatar, $('#npBand').value);
      $('#newPlayer').close();
      openMenu(p.id);
    });
    $('#npCancel').addEventListener('click', () => $('#newPlayer').close());
    $('#menuBack').addEventListener('click', renderHome);
    $('#playMunchers').addEventListener('click', () => {
      applyTheme(current);
      show('game');
      Munchers.start(current, { onSave: () => Store.save(), onExit: () => openMenu(current.id) });
    });
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
