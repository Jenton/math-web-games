# New game checklist: the polish bar

Why this exists: the first pass of Number Defense had enemies sliding along a straight line, and Lemonade Stand felt static.
Both worked, passed their tests, and used the Kenney art as a thin coat of paint. The pattern: **logic first, scene last.**
The owner's bar is a game that feels like a game on the first playtest. Do the scene thinking *before* the code, and look at the
result *before* the PR. Read this together with `docs/animation-guide.md` and `docs/kenney-asset-plan.md`.

## 1. Scene brief (write it before any UI code, put it at the top of the PR)
Five lines, no more:
1. **The place.** What is on screen the whole time (a board, a room, a stand), and which Kenney packs build it.
   A game is a *place with things in it*, not a form with buttons. If the screen is a column of cards and a button, stop and redesign.
2. **The things that move.** Characters, props, or pieces that travel, react, or idle. At least one thing must be moving or reacting
   in every state, including the waiting state (a blink, a bob, a flickering torch).
3. **The path of the action.** Where things start, where they go, and why they go there. Anything that moves follows a route that
   means something (a winding road, a conveyor, a queue), never a straight slide across the screen.
4. **The feedback moments.** For right, wrong, and win: what you see, what you hear, and what the math shows.
5. **The Kenney assets.** List the packs and tiles you will use. Look at the bundle first (`docs/art-shortlist.md`, the contact
   sheets, `tools/make_kenney_assets.sh`); do not default to emoji or plain CSS boxes when a pack has the piece.

## 2. Build rules
- **Logic is DOM-free with tests** (as today), but the scene is designed up front and built in the same PR, not "later".
- **Reuse the world.** Backdrops, ground, props and characters come from Kenney tiles and sprites; emoji only as a fallback.
- **Every state has life:** idle, active, right, wrong, win, lose. Check each one.
- **Math is the mechanic, never hidden by motion** (animation guide, section 1).
- **Success sounds must rise and end high; error sounds fall.** Check candidates with `tools/sound_pitch.py` and by ear (see "Sound choices" in `docs/kenney-asset-plan.md`).
- **Sound on every action**, through `js/sfx.js` only. Right and wrong sounds are fixed (never random between variants), and a
  result sound must never be masked by another one.
- **Phone first:** design at 375 px wide, thumb-sized targets, no horizontal scroll, key buttons visible without hunting.
- **Respect Reduce motion** (`css/motion.css`).

## 3. Review before the PR
- Play every state at **phone width** and take a screenshot of each: idle, mid-action, right, wrong, win, lose. Look at them.
  Ask: "would a 9-year-old call this a game, or a worksheet?" If it feels like a worksheet, add scene before opening the PR.
- Run `node tests/*.test.js` and the Playwright suites in `tests/browser/`.
- Check the asset requests: no 404s (a missing image silently falls back to emoji, which looks like an art revert).
- In the PR text, list: what moves, what the Kenney art is, and what is still placeholder.

## 4. Wiring (unchanged)
Breadcrumbs: the screen's top row is `<nav class="crumbs" data-level="play" data-back="<yourBackId>" data-game="<gameKey>"></nav>` (inside the `.hud`), built by `buildCrumbs()` in `js/app.js` as Players > Games > your game. Your module's own exit code runs on the crumb that carries `data-back`, and the other crumbs run it first. No separate back button.
Card + `GAMES` entry in `js/app.js`, one `<section>` in `index.html`, `Save.registerGame` rule and a `tests/save.test.js` case,
README and `docs/game-ideas.md` updates, credits, `docs/work-streams.md` row.
