/* Keyboard controls for the games, in one place.
 *
 * A game registers a handler for its screen: Keys.on('escape', (e) => { ...; return true; }). The handler runs only when that screen is
 * showing, no result panel or dialog is open, and the player is not typing in a text box. Return true when you used the key (we then
 * stop the browser's own action). Modifier keys (Ctrl, Cmd, Alt) are never ours.
 *
 * Hints: Keys.hint(parent, 'text') adds a small line that shows only when a keyboard is likely in use: a laptop (fine pointer plus hover),
 * or a tablet after its first physical key press. A touch-only iPad never sees them. Games keep working by touch exactly as before. */
(function (root) {
  'use strict';
  const handlers = {}; // screen id -> [fn]
  const KB_CLASS = 'kbd';

  const typing = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  function visible(id) {
    const e = document.getElementById(id);
    return !!e && !e.hidden;
  }

  /** Register a key handler for a screen (the section's id). */
  function on(screenId, fn) {
    (handlers[screenId] = handlers[screenId] || []).push(fn);
  }

  function blocked() {
    const panel = document.getElementById('panel');
    if (panel && !panel.hidden) return true; // a result panel is open: its own buttons take the keys
    return !!document.querySelector('dialog[open]');
  }

  function onKeyDown(e) {
    if (!document.documentElement.classList.contains(KB_CLASS) && e.key && e.key.length <= 10) document.documentElement.classList.add(KB_CLASS); // a physical key was pressed: show hints
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (typing(e.target) || blocked()) return;
    for (const id of Object.keys(handlers)) {
      if (!visible(id)) continue;
      for (const fn of handlers[id]) {
        if (fn(e) === true) { e.preventDefault(); return; }
      }
    }
  }

  /** A hint line that only shows on keyboard devices. */
  function hint(parent, text) {
    const p = document.createElement('p');
    p.className = 'keyhint';
    p.textContent = text;
    parent.appendChild(p);
    return p;
  }

  document.addEventListener('keydown', onKeyDown);
  try {
    if (root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches) document.documentElement.classList.add(KB_CLASS);
  } catch (e) { /* ignore */ }

  /** Digit typed as a number key: '0'-'9' (also the numpad, which reports the same keys). */
  const digit = (e) => (e.key.length === 1 && e.key >= '0' && e.key <= '9' ? e.key : null);

  root.Keys = { on, hint, digit, typing };
})(window);
