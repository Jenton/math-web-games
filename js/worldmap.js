/* Creature Quest world map: regions and nodes as DATA, plus the unlock rules. Pure logic, no DOM, unit-tested in Node.
 *
 * A region is a map; each node is an encounter or a story beat. The player walks a token between nodes; a node opens when
 * any node that points at it (via `next`) is cleared, so paths can branch and side nodes are optional. Clearing a region's
 * boss opens the next region. Adding content is adding data here: no new code.
 *
 * Node: { id, type, x, y, next: [ids], name, script?: [lines], kinds?: [enemy kinds], ally? }   x and y are 0 to 100 (percent of the map).
 * `kinds` is the monster group for a fight node ('weakness' | 'armor' | 'boss', up to 3; rpg.js caps a group at 2 at 1 star). It is handed
 * to RPG.makeEncounter, so every monster in a node has its own weakness, exactly like Quick adventure.
 * Region `intro` is a few story lines shown the first time you arrive (while nothing there is cleared); a boss node's `outro` is told after it falls.
 * Region `art[theme].bg` picks the battle backdrop for that region (see js/art.js). Any fight node may carry an `ally` (a rescue or a boss that guards a friend).
 * Region `decor` is [artName, x, y] for the cute theme's map decorations (the classic map has them baked into its image).
 *   type: battle | elite | boss | rescue | story | camp | puzzle
 *   battle / elite / boss / rescue fight a group of monsters (rpg.js decides each weakness); story and camp are dialogue only.
 *   rescue: beating the captors frees `ally` (a creature id from rpg.js). If the player already has that friend, they get a thank-you and a gold star.
 *   camp: optional rest. `buff` ('shield' | 'hint', see RPG.BUFFS) gives the NEXT fight a small head start. Buffs never replace the math.
 *   puzzle: an optional helper spot. `puzzle` is 'balance' or 'machine': solve one Balance / Machine Builder puzzle (no monsters). It clears the
 *     spot, gives a little XP, and a gold star for solving it on the first try (balance) or in the fewest steps (machine).
 * Math rule: story beats never test math. Anything that does is a battle, which follows the same rules as every game.
 * Progress (profile.games.rpg): `cleared` and `gold` are grow-only sets of node ids (see save.js), so merges never lose progress.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const KIND = { battle: 'weakness', rescue: 'weakness', elite: 'armor', boss: 'boss' }; // node type -> the lead monster's kind when a node has no `kinds`
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
        { id: 'm1', type: 'battle', kinds: ['weakness'], x: 8, y: 72, next: ['m2'], name: 'Meadow gate' },
        { id: 'm2', type: 'story', x: 24, y: 58, next: ['m3', 'm2c'], name: 'The talking sign',
          script: ['A wooden sign creaks: "Beware! Monsters ahead. Each one has a weakness."', 'It adds, a little shyly: "Pick the card that fits it, and you will do fine."'] },
        { id: 'm2c', type: 'camp', buff: 'shield', x: 30, y: 84, next: ['m3'], name: 'Picnic spot',
          script: ['You share a snack with your team. Everyone feels ready.', 'Your friends swap stories about the best numbers they know.'] },
        { id: 'm3', type: 'battle', kinds: ['weakness', 'weakness'], x: 42, y: 50, next: ['m4', 'm4p'], name: 'Hollow log' },
        { id: 'm4p', type: 'puzzle', puzzle: 'balance', x: 49, y: 29, next: [], name: 'Wobbly bridge',
          script: ['A rope bridge wobbles over a stream. Someone calls from the far side: "Help! Make the bridge level and I can come across!"'] },
        { id: 'm4', type: 'battle', kinds: ['weakness', 'weakness', 'weakness'], x: 58, y: 64, next: ['m5'], name: 'Stepping stones' },
        { id: 'm5', type: 'elite', kinds: ['armor', 'weakness'], x: 70, y: 40, next: ['m6'], name: 'Armored guard' },
        { id: 'm6', type: 'rescue', kinds: ['weakness', 'weakness'], x: 82, y: 62, next: ['m7'], name: 'The cage', ally: 'compare',
          script: ['A cage sits under a big tree. Inside, something is hooting softly: "Hoo? Is someone there?"'] },
        { id: 'm7', type: 'boss', kinds: ['boss', 'weakness'], x: 92, y: 28, next: [], name: 'Grumble Gate',
          outro: 'The Grumble Golem sits down with a rumble and the gate swings open. Beyond it, an old castle looms on the hill: the Haunted Keep!' },
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
        { id: 'k1', type: 'battle', kinds: ['weakness', 'weakness'], x: 10, y: 30, next: ['k2'], name: 'Drawbridge' },
        { id: 'k2', type: 'story', x: 28, y: 48, next: ['k3'], name: 'The polite ghost',
          script: ['A ghost floats up: "Oooo... oh, sorry! Did I startle you? I just like to count the stairs."', '"There are 12. Or 13? Never mind, good luck in there!"'] },
        { id: 'k3', type: 'battle', kinds: ['weakness', 'weakness', 'weakness'], x: 46, y: 66, next: ['k4', 'k3c', 'k3p'], name: 'Dusty hall' },
        { id: 'k3p', type: 'puzzle', puzzle: 'machine', x: 30, y: 78, next: [], name: 'Gear lock',
          script: ['A rusty machine blocks a small door. A small voice calls from behind it: "The numbers only turn if you use the right gears. Can you work it out?"'] },
        { id: 'k3c', type: 'camp', buff: 'hint', x: 52, y: 88, next: ['k4'], name: 'Warm kitchen',
          script: ['A friendly fire is still burning. Your team warms up and rests.'] },
        { id: 'k4', type: 'elite', kinds: ['armor', 'weakness'], x: 66, y: 46, next: ['k5'], name: 'Armor gallery' },
        { id: 'k5', type: 'rescue', kinds: ['weakness', 'weakness'], x: 80, y: 66, next: ['k6'], name: 'The tower cell', ally: 'rounding',
          script: ['Someone is tapping the tower wall: tap, tap, tap. "Round up or round down? Can anyone hear me?"'] },
        { id: 'k6', type: 'boss', kinds: ['boss', 'weakness'], x: 90, y: 26, next: [], name: 'Throne room',
          outro: 'The Ghost King floats away with a polite "sorry for the fuss!" and the castle lights flicker on. The way to the snowy Prime Peaks is open!' },
      ],
    },
    {
      id: 'peaks',
      name: 'Prime Peaks',
      blurb: 'Snowy mountains where every number is either lonely or in a crowd.',
      intro: ['Cold wind whistles between the peaks. A tiny sign is frozen to a rock: "PRIME PEAKS. Primes are numbers that only divide by 1 and themselves."', 'Somewhere up here, three friends are stuck in the snow. Time to climb!'],
      art: { classic: { map: 'meadow', path: '#6f8fb0', bg: 'dungeon' }, cute: { island: 'snow', bg: 'fall' } },
      decor: [['snowman', 14, 40], ['igloo', 34, 22], ['rock', 18, 86], ['snowman', 62, 18], ['crystal', 84, 84], ['igloo', 74, 82], ['rock', 48, 90]],
      start: 'p1',
      nodes: [
        { id: 'p1', type: 'battle', kinds: ['weakness'], x: 8, y: 72, next: ['p2'], name: 'Trailhead' },
        { id: 'p2', type: 'story', x: 22, y: 56, next: ['p3', 'p2c'], name: 'The frosty hiker',
          script: ['A hiker wrapped in three scarves waves: "Careful! The monsters up here hide in groups. Tap the one you want to deal with first."', '"And if you see a cage, there is probably a friend inside. I would help, but my toes are frozen."'] },
        { id: 'p2c', type: 'camp', buff: 'shield', x: 26, y: 84, next: ['p3'], name: 'Hot cocoa hut',
          script: ['A cozy hut with a crackling fire. Everyone gets a mug of hot cocoa.', 'You feel warm and brave. Nothing will knock you over for a moment!'] },
        { id: 'p3', type: 'battle', kinds: ['weakness', 'weakness'], x: 38, y: 44, next: ['p4', 'p3p'], name: 'Snowdrift pass' },
        { id: 'p3p', type: 'puzzle', puzzle: 'balance', x: 44, y: 20, next: [], name: 'Icy bridge',
          script: ['An ice bridge tips to one side. A tiny voice calls: "The blocks must weigh the same on both sides, or the bridge cracks!"'] },
        { id: 'p4', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'scout', x: 52, y: 62, next: ['p5'], name: 'The ice cave',
          script: ['A cage of icicles blocks a cave. Something is whining softly inside, and its nose keeps twitching: "Sniff, sniff... I can smell the factors from here!"'] },
        { id: 'p5', type: 'battle', kinds: ['weakness', 'weakness', 'weakness'], x: 62, y: 38, next: ['p6'], name: 'Avalanche slope' },
        { id: 'p6', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'oink', x: 72, y: 64, next: ['p7'], name: 'The truffle pit',
          script: ['Something is grunting inside a wooden crate half buried in snow: "Oink! Oink! Is anyone out there? I found a prime and now I am stuck!"'] },
        { id: 'p7', type: 'elite', kinds: ['armor', 'weakness'], x: 80, y: 40, next: ['p8'], name: 'Frozen guard' },
        { id: 'p8', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'bruno', x: 88, y: 66, next: ['p9'], name: 'The bear den',
          script: ['A huge furry shape is tangled in a rope net: "Mmm... hello? I tried to hug the net and now we are both stuck."'] },
        { id: 'p9', type: 'boss', kinds: ['boss', 'weakness'], x: 92, y: 22, next: [], name: 'Summit throne',
          outro: 'The Snow Golem crumbles into a pile of snowballs, and the clouds clear. From the summit you can see a dark green forest far away: the Fraction Forest!' },
      ],
    },
    {
      id: 'forest',
      name: 'Fraction Forest',
      blurb: 'A tall, tangled forest where everything gets cut into equal pieces.',
      intro: ['The trees here are so tall you cannot see the sky. A carved sign says: "FRACTION FOREST. Everything is shared fairly here."', 'Four friends are lost among the trees. Follow the path and find them!'],
      art: { classic: { map: 'meadow', path: '#4f7d3d', bg: 'meadow' }, cute: { island: 'forest', bg: 'forest' } },
      decor: [['tree', 12, 70], ['tree2', 26, 22], ['bush', 44, 88], ['tree', 54, 14], ['tree2', 82, 82], ['bush', 72, 18], ['tree', 94, 52], ['mound', 18, 52]],
      start: 'f1',
      nodes: [
        { id: 'f1', type: 'battle', kinds: ['weakness'], x: 8, y: 30, next: ['f2'], name: 'Forest gate' },
        { id: 'f2', type: 'story', x: 20, y: 48, next: ['f3', 'f3c'], name: 'The sharing squirrel',
          script: ['A squirrel is cutting an acorn into equal pieces with great care: "Half for you, half for me. Or a quarter each if four friends come along!"', '"Fair is fair. Say, if you see anyone lost in the trees, tell them I saved them a piece."'] },
        { id: 'f3', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'peep', x: 32, y: 66, next: ['f4'], name: 'The nest',
          script: ['A tiny cage hangs from a branch. Two small voices peep together: "Peep! Peep! We always come in pairs!"'] },
        { id: 'f3c', type: 'camp', buff: 'hint', x: 36, y: 88, next: ['f4'], name: 'Mushroom clearing',
          script: ['A ring of mushrooms makes a perfect seat. You sit and think about the next fight.', 'Ideas come easily here. You feel clear-headed!'] },
        { id: 'f4', type: 'battle', kinds: ['weakness', 'weakness', 'weakness'], x: 46, y: 44, next: ['f5', 'f4p'], name: 'Tangled roots' },
        { id: 'f4p', type: 'puzzle', puzzle: 'machine', x: 52, y: 18, next: [], name: 'The wood mill',
          script: ['An old wood mill has stopped turning. A small voice calls: "My gears only work in the right order. Can you get the number to the target?"'] },
        { id: 'f5', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'quackers', x: 58, y: 66, next: ['f6'], name: 'The pond',
          script: ['Something is splashing in a pond, tied to a reed: "Quack! Quack! I can round up a whole pond, but I cannot round up this rope!"'] },
        { id: 'f6', type: 'elite', kinds: ['armor', 'weakness'], x: 68, y: 44, next: ['f7'], name: 'Bark guard' },
        { id: 'f7', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'bongo', x: 78, y: 66, next: ['f8'], name: 'The treetop cage',
          script: ['A cage dangles from a vine, swinging back and forth: "Ooh ooh! I know every sum! Please, someone, get me down!"'] },
        { id: 'f8', type: 'rescue', kinds: ['weakness', 'weakness', 'weakness'], ally: 'waddle', x: 86, y: 40, next: ['f9'], name: 'The frozen creek',
          script: ['A cage is frozen in the middle of a creek. A little penguin is inside, sliding on the ice: "I was sharing my fish equally. Then the monsters came."'] },
        { id: 'f9', type: 'boss', kinds: ['boss', 'weakness'], x: 92, y: 18, next: [], name: 'The great oak',
          outro: 'The Root King shrinks into a sapling, and the whole forest sighs with relief. Far to the south, a mountain glows red against the sky: Ember Mountain!' },
      ],
    },
    {
      id: 'ember',
      name: 'Ember Mountain',
      blurb: 'A warm, rumbling mountain where numbers grow bigger and bigger.',
      intro: ['The ground is warm, and now and then it rumbles. A sign scorched at the edges reads: "EMBER MOUNTAIN. Big numbers ahead. Do not panic."', 'Four friends are stuck in cages. The boss at the top guards the very last one.'],
      art: { classic: { map: 'meadow', path: '#b14a2d', bg: 'dungeon' }, cute: { island: 'lava', bg: 'desert' } },
      decor: [['cactus', 14, 36], ['pyramid', 36, 22], ['rock', 24, 88], ['crystal', 60, 16], ['cactus', 70, 86], ['pyramid', 88, 78], ['rock', 92, 44]],
      start: 'e1',
      nodes: [
        { id: 'e1', type: 'battle', kinds: ['weakness', 'weakness'], x: 8, y: 74, next: ['e2'], name: 'Cinder path' },
        { id: 'e2', type: 'story', x: 20, y: 58, next: ['e3', 'e3c'], name: 'The sleepy lava lamp',
          script: ['A lava lamp the size of a house is humming a slow tune: "Mmm... two times two... times two... times two... that is already sixteen..."', '"Oh! Visitors! Tell the monsters to be quiet, would you? I am counting."'] },
        { id: 'e3', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'tusk', x: 30, y: 40, next: ['e4'], name: 'The stone cage',
          script: ['A stone cage with a very large nose poking out of it: "Pffft! Hello! I never forget a power of two. Could you open this?"'] },
        { id: 'e3c', type: 'camp', buff: 'shield', x: 24, y: 88, next: ['e4'], name: 'Warm springs',
          script: ['A pool of warm water bubbles gently. You soak your tired feet.', 'You feel like nothing could knock you down!'] },
        { id: 'e4', type: 'battle', kinds: ['weakness', 'weakness', 'weakness'], x: 42, y: 62, next: ['e5', 'e4p'], name: 'Crumbling bridge' },
        { id: 'e4p', type: 'puzzle', puzzle: 'balance', x: 48, y: 88, next: [], name: 'The lava bridge',
          script: ['A stone bridge crosses a river of lava, and it leans to one side. A voice calls: "Balance the blocks and the bridge will hold!"'] },
        { id: 'e5', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'zeb', x: 54, y: 40, next: ['e6'], name: 'The striped cage',
          script: ['Black and white stripes flash behind the bars: "Hey! I always know which is bigger and which is smaller. Let me out, I will prove it!"'] },
        { id: 'e6', type: 'elite', kinds: ['armor', 'weakness'], x: 64, y: 64, next: ['e7'], name: 'Magma guard' },
        { id: 'e7', type: 'rescue', kinds: ['weakness', 'weakness'], ally: 'mossy', x: 74, y: 40, next: ['e8'], name: 'The mossy cave',
          script: ['A great pair of antlers is tangled in the bars of a cage: "Mmm... good day. I am a little stuck. Could you help me crack my way out?"'] },
        { id: 'e8', type: 'battle', kinds: ['weakness', 'weakness', 'weakness'], x: 84, y: 64, next: ['e9'], name: 'The last climb' },
        { id: 'e9', type: 'boss', kinds: ['boss', 'weakness'], ally: 'bison', x: 92, y: 26, next: [], name: 'Crater throne',
          outro: 'The Magma Titan cools into a harmless pile of warm rocks. You did it: you saved every friend on the map, and the whole mountain cheers. Thank you, hero!' },
      ],
    },
  ];

  /* ---------- lookups ---------- */
  const regionById = (id) => REGIONS.find((r) => r.id === id) || null;
  const nodeById = (region, id) => region.nodes.find((n) => n.id === id) || null;
  const bossOf = (region) => region.nodes.find((n) => n.type === 'boss');
  /** The monster group for a fight node (null for story and camp). */
  const kindsOf = (node) => (KIND[node.type] ? (node.kinds && node.kinds.length ? node.kinds.slice() : [KIND[node.type]]) : null);
  /** The lead monster's kind (kept for callers that only need to know whether a node is a fight). */
  const enemyKind = (node) => (kindsOf(node) || [null])[0];

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
        if (FIGHTS(n) === false && !['story', 'camp', 'puzzle'].includes(n.type)) bad.push(n.id + ': unknown type ' + n.type);
        if (n.type === 'puzzle' && !['balance', 'machine'].includes(n.puzzle)) bad.push(n.id + ': puzzle must be balance or machine');
        if (n.buff !== undefined && n.type !== 'camp') bad.push(n.id + ': only a camp has a buff');
        if (FIGHTS(n) && !kindsOf(n).every((k) => ['weakness', 'armor', 'boss'].includes(k))) bad.push(n.id + ': unknown monster kind');
        if (FIGHTS(n) && kindsOf(n).length > 3) bad.push(n.id + ': at most 3 monsters');
        if ((n.type === 'story' || n.type === 'camp' || n.type === 'rescue' || n.type === 'puzzle') && !(n.script && n.script.length)) bad.push(n.id + ': needs a script');
        if (n.type === 'rescue' && !n.ally) bad.push(n.id + ': rescue needs an ally');
        if (n.ally && !FIGHTS(n)) bad.push(n.id + ': only a fight can free a friend');
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

  const api = { REGIONS, KIND, regionById, nodeById, bossOf, kindsOf, enemyKind, clearedSet, predecessors, regionOpen, nodeStates, tokenAt, regionDone, currentRegion, clearNode, validate };
  if (isNode) module.exports = api;
  else root.WorldMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
