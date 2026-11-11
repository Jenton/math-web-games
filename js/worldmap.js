/* Creature Quest world map: regions and nodes as DATA, plus the unlock rules. Pure logic, no DOM, unit-tested in Node.
 *
 * A region is a map; each node is an encounter or a story beat. The player walks a token between nodes; a node opens when
 * any node that points at it (via `next`) is cleared, so paths can branch and side nodes are optional. Clearing a region's
 * boss opens the next region. Adding content is adding data here: no new code.
 *
 * Node: { id, type, x, y, next: [ids], name, script?: [lines], ally? }   x and y are 0 to 100 (percent of the map).
 * Region `decor` is [artName, x, y] for the cute theme's map decorations (the classic map has them baked into its image).
 *   type: battle | elite | boss | rescue | story | camp
 *   battle / elite / boss / rescue fight an enemy (rpg.js decides the weakness); story and camp are dialogue only.
 *   rescue: beating the captor frees `ally` (a creature id from rpg.js).
 * Math rule: story beats never test math. Anything that does is a battle, which follows the same rules as every game.
 * Progress (profile.games.rpg): `cleared` and `gold` are grow-only sets of node ids (see save.js), so merges never lose progress.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const KIND = { battle: 'weakness', rescue: 'weakness', elite: 'armor', boss: 'boss' }; // node type -> rpg enemy kind
  const FIGHTS = (n) => Object.prototype.hasOwnProperty.call(KIND, n.type);

  const REGIONS = [
    {
      id: 'meadow',
      name: 'Multiples Meadow',
      blurb: 'A sunny meadow where the monsters have started to skip-count.',
      art: { classic: { map: 'meadow', path: '#a5702f' }, cute: { island: 'grass' } },
      decor: [['tree', 14, 38], ['tree2', 36, 26], ['bush', 47, 80], ['rock', 66, 84], ['tree', 60, 18], ['bush', 18, 88], ['tree2', 88, 84], ['mound', 76, 12], ['tree', 4, 44]],
      start: 'm1',
      nodes: [
        { id: 'm1', type: 'battle', x: 8, y: 72, next: ['m2'], name: 'Meadow gate' },
        { id: 'm2', type: 'story', x: 24, y: 58, next: ['m3', 'm2c'], name: 'The talking sign',
          script: ['A wooden sign creaks: "Beware! Monsters ahead. Each one has a weakness."', 'It adds, a little shyly: "Pick the card that fits it, and you will do fine."'] },
        { id: 'm2c', type: 'camp', x: 30, y: 84, next: ['m3'], name: 'Picnic spot',
          script: ['You share a snack with your team. Everyone feels ready.', 'Your friends swap stories about the best numbers they know.'] },
        { id: 'm3', type: 'battle', x: 42, y: 50, next: ['m4'], name: 'Hollow log' },
        { id: 'm4', type: 'battle', x: 58, y: 64, next: ['m5'], name: 'Stepping stones' },
        { id: 'm5', type: 'elite', x: 70, y: 40, next: ['m6'], name: 'Armored guard' },
        { id: 'm6', type: 'rescue', x: 82, y: 62, next: ['m7'], name: 'The cage', ally: 'compare',
          script: ['A cage sits under a big tree. Inside, something is hooting softly: "Hoo? Is someone there?"'] },
        { id: 'm7', type: 'boss', x: 92, y: 28, next: [], name: 'Grumble Gate' },
      ],
    },
    {
      id: 'keep',
      name: 'Haunted Keep',
      blurb: 'An old castle full of echoes, ghosts and tricky armor.',
      art: { classic: { map: 'meadow', path: '#7a6a8a' }, cute: { island: 'castle' } },
      decor: [['rock', 18, 72], ['crystal', 36, 20], ['mound', 60, 16], ['rock', 72, 88], ['crystal', 93, 48], ['bush', 38, 86]],
      start: 'k1',
      nodes: [
        { id: 'k1', type: 'battle', x: 10, y: 30, next: ['k2'], name: 'Drawbridge' },
        { id: 'k2', type: 'story', x: 28, y: 48, next: ['k3'], name: 'The polite ghost',
          script: ['A ghost floats up: "Oooo... oh, sorry! Did I startle you? I just like to count the stairs."', '"There are 12. Or 13? Never mind, good luck in there!"'] },
        { id: 'k3', type: 'battle', x: 46, y: 66, next: ['k4', 'k3c'], name: 'Dusty hall' },
        { id: 'k3c', type: 'camp', x: 52, y: 88, next: ['k4'], name: 'Warm kitchen',
          script: ['A friendly fire is still burning. Your team warms up and rests.'] },
        { id: 'k4', type: 'elite', x: 66, y: 46, next: ['k5'], name: 'Armor gallery' },
        { id: 'k5', type: 'rescue', x: 80, y: 66, next: ['k6'], name: 'The tower cell', ally: 'rounding',
          script: ['Someone is tapping the tower wall: tap, tap, tap. "Round up or round down? Can anyone hear me?"'] },
        { id: 'k6', type: 'boss', x: 90, y: 26, next: [], name: 'Throne room' },
      ],
    },
  ];

  /* ---------- lookups ---------- */
  const regionById = (id) => REGIONS.find((r) => r.id === id) || null;
  const nodeById = (region, id) => region.nodes.find((n) => n.id === id) || null;
  const bossOf = (region) => region.nodes.find((n) => n.type === 'boss');
  const enemyKind = (node) => KIND[node.type] || null;

  const asSet = (v) => new Set(Array.isArray(v) ? v : []);
  const clearedSet = (r) => asSet(r && r.cleared);

  /* ---------- unlock rules ---------- */

  function predecessors(region, id) {
    return region.nodes.filter((n) => n.next.includes(id)).map((n) => n.id);
  }

  /** A region is open when it is the first, or the previous region's boss is cleared. */
  function regionOpen(index, cleared) {
    if (index <= 0) return true;
    const prev = REGIONS[index - 1];
    return !!prev && cleared.has(bossOf(prev).id) && regionOpen(index - 1, cleared);
  }

  /** 'cleared' | 'open' | 'locked' for every node of a region. */
  function nodeStates(region, cleared) {
    const out = {};
    region.nodes.forEach((n) => {
      if (cleared.has(n.id)) out[n.id] = 'cleared';
      else if (n.id === region.start || predecessors(region, n.id).some((p) => cleared.has(p))) out[n.id] = 'open';
      else out[n.id] = 'locked';
    });
    return out;
  }

  /** Where the token stands: the open node furthest along the path (the last cleared, or the start). */
  function tokenAt(region, cleared) {
    const done = region.nodes.filter((n) => cleared.has(n.id));
    return done.length ? done[done.length - 1].id : region.start;
  }

  const regionDone = (region, cleared) => cleared.has(bossOf(region).id);

  /** Index of the region the player should be looking at: the last open one. */
  function currentRegion(cleared) {
    let i = 0;
    while (i + 1 < REGIONS.length && regionOpen(i + 1, cleared)) i++;
    return i;
  }

  /* ---------- progress ---------- */

  /** Record a cleared node (idempotent). `flawless` earns a gold star, like the exit markers in Mario World. */
  function clearNode(r, id, flawless) {
    if (!Array.isArray(r.cleared)) r.cleared = [];
    if (!Array.isArray(r.gold)) r.gold = [];
    if (!r.cleared.includes(id)) r.cleared.push(id);
    if (flawless && !r.gold.includes(id)) r.gold.push(id);
    return r;
  }

  /** Check the data: unique ids, valid links, one boss, every node reachable from the start, no cycles. Returns problems. */
  function validate(regions) {
    const bad = [];
    const seen = new Set();
    regions.forEach((reg) => {
      const ids = new Set(reg.nodes.map((n) => n.id));
      reg.nodes.forEach((n) => {
        if (seen.has(n.id)) bad.push('duplicate id ' + n.id);
        seen.add(n.id);
        if (n.x < 0 || n.x > 100 || n.y < 0 || n.y > 100) bad.push(n.id + ': position off the map');
        n.next.forEach((t) => ids.has(t) || bad.push(n.id + ' points at missing ' + t));
        if (FIGHTS(n) === false && n.type !== 'story' && n.type !== 'camp') bad.push(n.id + ': unknown type ' + n.type);
        if ((n.type === 'story' || n.type === 'camp' || n.type === 'rescue') && !(n.script && n.script.length)) bad.push(n.id + ': needs a script');
        if (n.type === 'rescue' && !n.ally) bad.push(n.id + ': rescue needs an ally');
      });
      if (!ids.has(reg.start)) bad.push(reg.id + ': missing start');
      if (reg.nodes.filter((n) => n.type === 'boss').length !== 1) bad.push(reg.id + ': needs exactly one boss');
      const reach = new Set([reg.start]);
      for (let k = 0; k < reg.nodes.length; k++) reg.nodes.forEach((n) => reach.has(n.id) && n.next.forEach((t) => reach.add(t)));
      reg.nodes.forEach((n) => reach.has(n.id) || bad.push(n.id + ' is not reachable'));
      const boss = reg.nodes.find((n) => n.type === 'boss');
      if (boss && boss.next.length) bad.push(boss.id + ': the boss ends the region');
    });
    return bad;
  }

  const api = { REGIONS, KIND, regionById, nodeById, bossOf, enemyKind, clearedSet, predecessors, regionOpen, nodeStates, tokenAt, regionDone, currentRegion, clearNode, validate };
  if (isNode) module.exports = api;
  else root.WorldMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
