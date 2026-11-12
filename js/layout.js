/* Wide-screen layouts: on screens 720 px and wider (iPad, laptop) a game puts its picture in a left column and its controls in a right
 * column, so the whole game fits without scrolling. On a phone nothing changes: the columns are plain stacked blocks in the original order.
 *
 * Each entry names the elements that go left (a) and right (b). They must already appear in that order in the section, a before b, with
 * nothing else in between (the title and the top row stay full width above). New game screens add one entry here. */
(function (root) {
  'use strict';
  const SPLITS = {
    game: { a: ['#board'], b: ['.controls'] },
    balance: { a: ['#scale', '#balSums'], b: ['.guess', '.controls'] },
    escape: { a: ['#escScene', '#escStory'], b: ['#escPlaque'] },
    runner: { a: ['#runSign', '#runScene'], b: ['#runMsg', '.run-controls', '.row.center'] },
    machine: { a: ['.mac-now', '#macPath'], b: ['#macOps', '.row.center'] },
    lemonade: { a: ['.lem-scene'], b: ['#lemBody', '#lemMsg', '.controls'] },
    sort: { a: ['.sort-lanes'], b: ['#sortMsg', '#sortTray', '#sortChoices', '.controls'] },
    share: { a: ['#shPizzas', '#shFriends'], b: ['.share-set', '.controls'] },
  };

  function build(id, cfg) {
    const section = document.getElementById(id);
    if (!section) return;
    const pick = (sels) => sels.map((s) => section.querySelector(':scope > ' + s)).filter(Boolean);
    const a = pick(cfg.a);
    const b = pick(cfg.b);
    if (!a.length || !b.length) return;
    const split = document.createElement('div');
    split.className = 'split';
    const colA = document.createElement('div');
    colA.className = 'col-a';
    const colB = document.createElement('div');
    colB.className = 'col-b';
    a[0].before(split);
    split.append(colA, colB);
    a.forEach((e) => colA.appendChild(e));
    b.forEach((e) => colB.appendChild(e));
    section.classList.add('has-split');
  }

  Object.keys(SPLITS).forEach((id) => build(id, SPLITS[id]));
  root.Layout = { SPLITS };
})(window);
