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
    const ic = $('panelIcon');
    ic.hidden = !o.icon;
    if (o.icon) ic.src = 'assets/kenney/' + o.icon + '.png';
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

  /** Restart a short CSS animation class on a node. A timer (never animationend) removes it, so "Reduce motion" can never hang a game. */
  function flash(node, cls, ms) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth; // restart the animation if it is already running
    node.classList.add(cls);
    clearTimeout(node['_t' + cls]);
    node['_t' + cls] = setTimeout(() => node.classList.remove(cls), ms);
  }

  /** A small burst of confetti inside `host` (position: relative). Self-cleaning, capped at `n` nodes. */
  function burst(host, n) {
    const colors = ['#ffd54f', '#ff8a65', '#4fc3f7', '#81c784', '#ba68c8'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'conf';
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 60;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist - 24 + 'px');
      s.style.setProperty('--r', Math.round(Math.random() * 540 - 270) + 'deg');
      s.style.setProperty('--c', colors[i % colors.length]);
      host.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  /** True when motion is off (the player's "Reduce motion" setting or the device's own). Skip waits and effects the player turned off. */
  function reduced() {
    return document.documentElement.dataset.motion === 'reduced' || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  root.UI = { toast, panel, hide, flash, burst, reduced };
})(window);
