/* Shared toast + result panel used by every game. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let toastTimer = null;

  function toast(msg, good) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (good ? 'good' : 'info');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2200);
  }

  function panel(o) {
    $('panelTitle').textContent = o.title;
    $('panelText').textContent = o.text;
    const b = $('panelBtn');
    const b2 = $('panelBtn2');
    b.textContent = o.btn;
    b.onclick = () => { hide(); o.onBtn(); };
    b2.hidden = !o.btn2;
    if (o.btn2) {
      b2.textContent = o.btn2;
      b2.onclick = () => { hide(); o.onBtn2(); };
    }
    $('panel').classList.toggle('bad', !!o.bad);
    $('panel').hidden = false;
    b.focus();
  }

  function hide() {
    $('panel').hidden = true;
  }

  root.UI = { toast, panel, hide };
})(window);
