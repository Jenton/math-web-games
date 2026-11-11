/* Creature Quest art: a manifest that maps enemy / ally / background ids to image files, per theme.
 * Art is swappable data: a missing id or a failed image load falls back to the plain emoji, so the game always works.
 *   theme -> enemy | ally | bg | map -> id -> image
 * Themes: 'classic' (16px pixel art, Kenney Tiny Dungeon / Tiny Town) and 'cute' (smooth flat art, Kenney Animal Pack,
 * Monster Builder, Background Elements, Map Pack). All CC0; see assets/CREDITS.md. Pure data plus tiny DOM helpers. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const ids = ['multiples', 'factors', 'primes', 'even-odd', 'compare', 'rounding', 'expressions', 'fractions', 'exponents', 'armor', 'boss'];
  const set = (dir) => Object.fromEntries(ids.map((k) => [k, { src: 'assets/quest/' + dir + '/' + k + '.png' }]));

  const THEMES = {
    classic: {
      name: 'Classic fantasy',
      blurb: 'Pixel-art heroes and monsters.',
      pixel: true,
      enemy: set('classic/enemy'),
      // two allies reuse a hero sprite in another color, so every friend still looks different
      ally: Object.assign(set('classic/ally'), { armor: { src: 'assets/quest/classic/ally/armor.png', filter: 'hue-rotate(170deg)' }, boss: { src: 'assets/quest/classic/ally/boss.png', filter: 'hue-rotate(90deg) saturate(1.3)' } }),
      bg: { meadow: { src: 'assets/quest/classic/bg/meadow.png' }, dungeon: { src: 'assets/quest/classic/bg/dungeon.png' } },
      // which backdrop a battle uses, by kind (a boss and armored enemies fight in the dungeon)
      bgFor: { weakness: 'meadow', armor: 'dungeon', boss: 'dungeon' },
      map: { meadow: { src: 'assets/quest/classic/map/meadow.png' } },
    },
    cute: {
      name: 'Cute',
      blurb: 'Round, friendly animals and silly monsters.',
      pixel: false,
      enemy: set('cute/enemy'),
      ally: set('cute/ally'),
      bg: ['grass', 'forest', 'fall', 'desert', 'castle'].reduce((o, k) => ((o[k] = { src: 'assets/quest/cute/bg/' + k + '.png' }), o), {}),
      bgFor: { weakness: 'grass', armor: 'castle', boss: 'fall' },
      map: ['tree', 'tree2', 'bush', 'rock', 'cactus', 'snowman', 'igloo', 'pyramid', 'crystal', 'mound'].reduce((o, k) => ((o[k] = { src: 'assets/quest/cute/map/' + k + '.png' }), o), {}),
    },
  };
  const DEFAULT = 'classic';

  const themeId = (profile) => {
    const t = profile && profile.settings && profile.settings.questArt;
    return THEMES[t] ? t : DEFAULT;
  };
  const get = (theme, kind, id) => (THEMES[theme] && THEMES[theme][kind] && THEMES[theme][kind][id]) || null;
  const src = (theme, kind, id) => (get(theme, kind, id) || {}).src || null;

  /** A sprite element: an <img> for the theme, or the emoji when there is no art (or the file fails to load). */
  function sprite(theme, kind, id, emoji, alt) {
    const a = get(theme, kind, id);
    const fallback = () => {
      const s = document.createElement('span');
      s.className = 'sprite emoji';
      s.textContent = emoji || '❓';
      s.setAttribute('role', 'img');
      s.setAttribute('aria-label', alt || id);
      return s;
    };
    if (!a) return fallback();
    const img = document.createElement('img');
    img.className = 'sprite ' + (THEMES[theme].pixel ? 'pixel' : 'smooth');
    img.src = a.src;
    img.alt = alt || id;
    img.draggable = false;
    if (a.filter) img.style.filter = a.filter;
    img.addEventListener('error', () => img.replaceWith(fallback()));
    return img;
  }

  const api = { THEMES, DEFAULT, themeId, get, src, sprite };
  if (isNode) module.exports = api;
  else root.Art = api;
})(typeof window !== 'undefined' ? window : globalThis);
