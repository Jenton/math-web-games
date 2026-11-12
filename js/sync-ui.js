/* Sync screens: set up, add a device, status, and background sync. Uses the sync core in js/sync.js.
 * The cloud backend is a small adapter published by the site as window.MathQuestBackend ({ get, put }, see docs/sync-design.md).
 * If the site has none, the screen says sync is not connected yet and everything else keeps working. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let syncer = null;
  let ticker = null;

  const MSG = {
    offline: "Can't reach the cloud right now. Check the internet connection and try again.",
    notFound: 'No family matches that password or code. Check it for typos, and make sure sync was set up on your other device first.',
    badCode: "That doesn't look like a family code or password. A password has at least 10 characters. A family code has 16 letters and numbers, like K7PQ-3M9X-B2RD-VW4H.",
    tooShort: 'A family password needs at least 10 characters.',
    weakPassword: 'That password is too easy to guess (for example, repeated characters, a very common password, or digits only). Try a short sentence only your family would think of.',
    denied: 'The cloud service refused the request. Sync may not be set up on this website yet.',
    tooBig: 'The save is too large to upload.',
    badKey: 'That password or code does not unlock the cloud copy.',
    corrupt: 'The cloud copy could not be read, so nothing was changed.',
    conflict: 'Other devices are changing the save at the same time. Please try again in a moment.',
    exists: 'A family with that password already exists. If it is yours, close this and use "Add this device to my family" instead. If not, choose a different password.',
    error: 'Something went wrong. Please try again.',
  };
  const say = (e) => MSG[e && e.code] || MSG.error;

  // localStorage can throw (private windows, blocked storage): sync then simply stays off
  const storage = {
    getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    removeItem(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  function ago(ts) {
    if (!ts) return '';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    return 'at ' + new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function show(which) {
    ['syncUnavailable', 'syncOff', 'syncOn'].forEach((id) => ($(id).hidden = id !== which));
  }

  function render() {
    if (!syncer) return show('syncUnavailable');
    const st = syncer.status;
    const pill = $('syncPill');
    if (!syncer.enabled) {
      show('syncOff');
      pill.hidden = true;
      return;
    }
    show('syncOn');
    const short = { synced: 'Synced', syncing: 'Syncing…', idle: 'Sync on', offline: 'Offline' }[st.state] || 'Problem';
    pill.hidden = false;
    pill.textContent = '☁️ ' + short;
    const when = st.lastSynced ? ' Last synced ' + ago(st.lastSynced) + '.' : '';
    $('syncStatus').textContent = st.state === 'synced' ? '✅ In sync.' + when : (st.state === 'syncing' ? 'Syncing…' : (st.state === 'idle' ? 'Sync is on.' + when : '⚠️ ' + st.message + when));
  }

  function showCode(mode) {
    $('ssIntro').hidden = true;
    $('ssCode').hidden = false;
    $('ssCodeText').textContent = syncer.getCode() || '';
    const isPw = syncer.getKind() === 'password';
    const noun = isPw ? 'password' : 'code';
    $('ssCodeText').classList.toggle('password', isPw);
    $('ssCodeText').setAttribute('aria-label', 'Your family ' + noun);
    const first = mode === 'new';
    $('ssCodeTitle').textContent = 'Your family ' + noun;
    $('ssWarn').textContent = 'Write this down or save it somewhere safe. You will need it to add other devices. You can also see it again on this device under "Show family password".' + (isPw ? ' Capital letters do not matter when you type it.' : '');
    $('ssSavedLabel').hidden = !first;
    $('ssSaved').checked = false;
    $('ssDone').textContent = first ? 'Done' : 'Close';
    $('ssDone').disabled = first;
    $('ssWarn').hidden = !first;
    const dlg = $('syncSetup');
    if (!dlg.open) dlg.showModal();
  }

  function openSetup() {
    $('ssIntro').hidden = false;
    $('ssCode').hidden = true;
    $('ssError').hidden = true;
    $('ssPassword').value = '';
    $('ssCreate').disabled = false;
    $('ssCreatePw').textContent = 'Use this password';
    updateHint();
    $('syncSetup').showModal();
  }

  // live feedback while typing a new family password; the button stays off until it passes the same check the core applies
  function updateHint() {
    const v = $('ssPassword').value;
    const hint = $('ssHint');
    const c = root.Sync.checkPassword(v);
    $('ssCreatePw').disabled = !c.ok;
    hint.classList.toggle('bad', !!v && !c.ok);
    if (!v) hint.textContent = 'At least ' + root.Sync.MIN_PASSWORD + ' characters. Capital letters do not matter.';
    else if (c.problem === 'short') hint.textContent = (root.Sync.MIN_PASSWORD - c.length) + ' more character' + (root.Sync.MIN_PASSWORD - c.length === 1 ? '' : 's') + ' needed.';
    else if (!c.ok) hint.textContent = MSG.weakPassword;
    else hint.textContent = { okay: 'Okay. Longer is safer.', good: 'Good.', great: 'Great.' }[c.strength];
  }

  // choice: { password } for a password the owner typed, or nothing for a random family code
  async function doSetup(choice) {
    const btn = choice ? $('ssCreatePw') : $('ssCreate');
    $('ssCreatePw').disabled = true;
    $('ssCreate').disabled = true;
    btn.textContent = 'Creating…';
    $('ssError').hidden = true;
    try {
      await syncer.setup(choice);
      showCode('new');
    } catch (e) {
      $('ssError').textContent = say(e);
      $('ssError').hidden = false;
      $('ssCreate').textContent = 'Make a random family code for me instead';
      $('ssCreate').disabled = false;
      $('ssCreatePw').textContent = 'Try again';
      updateHint();
    }
    render();
  }

  async function doJoin() {
    const err = $('sjError');
    err.hidden = true;
    $('sjGo').disabled = true;
    $('sjGo').textContent = 'Adding…';
    try {
      await syncer.join($('sjCode').value);
      $('syncJoin').close();
      document.dispatchEvent(new CustomEvent('mq:data-changed'));
    } catch (e) {
      err.textContent = say(e);
      err.hidden = false;
    }
    $('sjGo').disabled = false;
    $('sjGo').textContent = 'Add this device';
    render();
  }

  function copyCode() {
    const text = syncer.getCode() || '';
    const done = () => { $('ssCopy').textContent = 'Copied!'; setTimeout(() => ($('ssCopy').textContent = 'Copy'), 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => selectCode());
    else selectCode();
  }
  function selectCode() {
    const r = document.createRange();
    r.selectNodeContents($('ssCodeText'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function downloadCode() {
    const noun = syncer.getKind() === 'password' ? 'password' : 'code';
    const text = 'Puzzle Lab family ' + noun + '\n\n' + (syncer.getCode() || '') + '\n\nType this ' + noun + ' on each device to share the same players and progress (Home screen > Sync between devices > Add this device).\nAnyone with this ' + noun + ' can see and change your kids\' progress. Keep it private.\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'math-quest-family-' + noun + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function init() {
    const backend = root.MathQuestBackend || null;
    if (!backend || !root.Sync) return show('syncUnavailable');
    syncer = root.Sync.createSyncer({
      backend,
      storage,
      debounceMs: root.MathQuestSyncDebounceMs, // undefined in production (4 s); tests set it low
      getData: () => root.Store.snapshot(),
      applyRemote: (d) => {
        root.Store.mergeIn(d);
        document.dispatchEvent(new CustomEvent('mq:data-changed'));
      },
    });
    root.Store.onSave(() => syncer.notifyChanged());
    syncer.onStatus(render);
    $('syncSetupBtn').addEventListener('click', openSetup);
    $('ssCreate').addEventListener('click', () => doSetup());
    $('ssCreatePw').addEventListener('click', () => doSetup({ password: $('ssPassword').value }));
    $('ssPassword').addEventListener('input', updateHint);
    $('ssPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!$('ssCreatePw').disabled) doSetup({ password: $('ssPassword').value }); } });
    $('ssCancel').addEventListener('click', () => $('syncSetup').close());
    $('ssSaved').addEventListener('change', () => ($('ssDone').disabled = !$('ssSaved').checked));
    $('ssDone').addEventListener('click', () => $('syncSetup').close());
    $('ssCopy').addEventListener('click', copyCode);
    $('ssSave').addEventListener('click', downloadCode);
    $('syncJoinBtn').addEventListener('click', () => {
      $('sjCode').value = '';
      $('sjError').hidden = true;
      $('syncJoin').showModal();
      $('sjCode').focus();
    });
    $('sjGo').addEventListener('click', doJoin);
    $('sjCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } });
    $('sjCancel').addEventListener('click', () => $('syncJoin').close());
    $('syncNowBtn').addEventListener('click', () => syncer.syncNow());
    $('syncShowBtn').addEventListener('click', () => showCode('view'));
    $('syncStopBtn').addEventListener('click', () => {
      if (confirm('Stop syncing on this device? Players and progress stay on this device and in the cloud. You can add this device again later with the family password or code.')) syncer.disconnect();
      render();
    });
    syncer.attach(root);
    render();
    syncer.init().then(() => { render(); if (syncer.enabled) syncer.syncNow(); });
    ticker = setInterval(render, 30000); // keeps "last synced 2 min ago" fresh
  }

  root.SyncUI = { init, _syncer: () => syncer };
})(window);
