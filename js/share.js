/* Cut & Share UI: cut the pizza, hand out slices, make it fair. Totals only show after "Share it". */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ROUND = 5;
  const SVG = 'http://www.w3.org/2000/svg';
  let ctx = null;
  let S = null;
  let bound = false;

  function init() {
    if (bound) return;
    bound = true;
    $('shBack').addEventListener('click', exit);
    $('cutMinus').addEventListener('click', () => setCuts(S.c - 1));
    $('cutPlus').addEventListener('click', () => setCuts(S.c + 1));
    $('eachMinus').addEventListener('click', () => setEach(S.s - 1));
    $('eachPlus').addEventListener('click', () => setEach(S.s + 1));
    $('shGo').addEventListener('click', share);
  }

  function start(profile, hooks) {
    init();
    ctx = { profile, onSave: hooks.onSave, onExit: hooks.onExit };
    S = { n: 0, stars: 0 };
    nextPuzzle();
  }

  function exit() {
    S = null;
    UI.hide();
    ctx.onSave();
    ctx.onExit();
  }

  function nextPuzzle() {
    const st = ctx.profile.settings;
    S.n++;
    S.p = MGC.makeShare(st.band, st.stars);
    S.c = 1;
    S.s = 1;
    S.misses = 0;
    $('shNo').textContent = 'Puzzle ' + S.n + ' of ' + ROUND;
    $('shTitle').textContent = S.p.text;
    buildFriends();
    render();
  }

  /* The friends sit at a wooden table, each with a plate. The plate shows the fraction of a pizza that ONE friend would get with the
     current choice ("each friend gets S slices", each slice being 1 of c): a picture of the player's own answer, never the totals. */
  const FRIEND_ART = ['chick', 'cow', 'frog', 'owl', 'panda', 'penguin', 'pig', 'rabbit'];
  function buildFriends() {
    const box = $('shFriends');
    box.innerHTML = '';
    const pool = FRIEND_ART.slice().sort(() => Math.random() - 0.5);
    S.plates = [];
    for (let i = 0; i < S.p.F; i++) {
      const f = document.createElement('div');
      f.className = 'friend';
      const im = new Image();
      im.alt = '';
      im.draggable = false;
      im.src = 'assets/kenney/animals/' + pool[i % pool.length] + '.png';
      const plate = document.createElement('div');
      plate.className = 'plate';
      f.append(im, plate);
      box.appendChild(f);
      S.plates.push(plate);
    }
  }

  function setCuts(v) {
    S.c = Math.max(1, Math.min(MGC.MAX_CUTS, v));
    Sfx.play('click');
    render();
  }

  function setEach(v) {
    S.s = Math.max(1, Math.min(MGC.MAX_CUTS, v));
    Sfx.play('click');
    render();
  }

  function pie(slices, filled, size) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '-52 -52 104 104');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    const slicePath = (i) => {
      const a0 = (i / slices) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((i + 1) / slices) * 2 * Math.PI - Math.PI / 2;
      const [x0, y0, x1, y1] = [Math.cos(a0) * 48, Math.sin(a0) * 48, Math.cos(a1) * 48, Math.sin(a1) * 48];
      return 'M0 0 L' + x0 + ' ' + y0 + ' A48 48 0 0 1 ' + x1 + ' ' + y1 + ' Z';
    };
    for (let i = 0; i < slices; i++) {
      const el = document.createElementNS(SVG, slices === 1 ? 'circle' : 'path');
      if (slices === 1) { el.setAttribute('r', 48); } else { el.setAttribute('d', slicePath(i)); }
      el.setAttribute('class', 'slice' + (i < filled ? '' : ' empty'));
      svg.appendChild(el);
    }
    return svg;
  }

  function render() {
    const { p } = S;
    const box = $('shPizzas');
    box.innerHTML = '';
    if (p.Q === 1) {
      for (let i = 0; i < p.P; i++) box.appendChild(pie(S.c, S.c, p.P > 5 ? 70 : 96));
    } else {
      // Only part of one pizza is available. Draw the whole pizza cut into c slices; the title says how
      // much of it there is. (Not shading it exactly keeps the picture from giving the answer away.)
      box.appendChild(pie(S.c, S.c, 120));
    }
    (S.plates || []).forEach((pl) => {
      pl.innerHTML = '';
      pl.appendChild(pie(S.c, Math.min(S.s, S.c), 36));
      if (S.s > S.c) pl.appendChild(Object.assign(document.createElement('span'), { className: 'plus', textContent: '+' }));
    });
    $('cutVal').textContent = S.c + (S.c === 1 ? ' slice' : ' slices');
    $('eachVal').textContent = S.s + (S.s === 1 ? ' slice' : ' slices');
    $('cutMinus').disabled = S.c <= 1;
    $('cutPlus').disabled = S.c >= MGC.MAX_CUTS;
    $('eachMinus').disabled = S.s <= 1;
    $('eachPlus').disabled = S.s >= MGC.MAX_CUTS;
    $('shTries').textContent = MGC.MAX_TRIES - S.misses + (MGC.MAX_TRIES - S.misses === 1 ? ' try left' : ' tries left');
  }

  function share() {
    if (!S) return;
    const res = MGC.checkShare(S.p, S.c, S.s);
    const prof = ctx.profile;
    const last = S.n >= ROUND;
    const again = () => { S.n = 0; S.stars = 0; nextPuzzle(); };
    if (res.ok) {
      const stars = MGC.starsFor(S.p, S.c, S.misses);
      const e = MGC.eachGets(S.p);
      S.stars += stars;
      Store.record(prof, 'share', true);
      Store.bump(Store.game(prof, 'share'), 'levels');
      ctx.onSave();
      Sfx.play(stars === 3 ? 'solved' : 'win');
      UI.panel({
        icon: 'medals/m' + stars,
        title: 'Fair shares! ' + '⭐'.repeat(stars),
        text: res.msg + ' Each friend gets ' + e.n + '/' + e.d + ' of a pizza.' + (stars === 3 ? ' And that is the fewest cuts possible!' : S.c === S.p.par ? ' That is the fewest cuts possible; the earlier try cost a star.' : ' Can you do it with fewer cuts? The best is ' + S.p.par + ' slices per pizza.') + (last ? ' Round done: ' + S.stars + ' of ' + ROUND * 3 + ' stars.' : ''),
        btn: last ? 'Play another round' : 'Next puzzle',
        onBtn: last ? again : nextPuzzle,
        btn2: last ? 'Back to setup' : null,
        onBtn2: exit,
      });
      return;
    }
    S.misses++;
    Store.record(prof, 'share', false);
    ctx.onSave();
    if (S.misses >= MGC.MAX_TRIES) {
      Sfx.play('lose');
      UI.panel({
        icon: 'ui/emote_faceSad',
        title: 'Out of tries',
        text: MGC.solution(S.p),
        btn: last ? 'Play another round' : 'Next puzzle',
        onBtn: last ? again : nextPuzzle,
        btn2: last ? 'Back to setup' : null,
        onBtn2: exit,
        bad: true,
      });
      return;
    }
    Sfx.play('wrong');
    UI.panel({ icon: 'ui/emote_question', title: 'Not fair yet', text: res.msg, btn: 'Try again', onBtn: render, bad: true });
    render();
  }

  root.Share = { start };
})(window);
