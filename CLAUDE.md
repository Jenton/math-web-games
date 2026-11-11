# Math Quest: instructions for Claude

Puzzle-first math games for two kids (9 and a reading kindergartener), K-6. Static site, plain HTML/CSS/JS, no build step, no framework.
The math *is* the gameplay. Live at https://math-quest-family.web.app (Firebase project `math-quest-family`).

## Where things are
- **This folder is the only checkout.** Never create another copy or worktree of the repo. Several chats share it, so check `git branch --show-current`
  and `git status` before you edit or commit, and never switch branches under someone else's uncommitted work.
- Map of what is built, who owns which files, and merge rules: `docs/work-streams.md` (update it when a stream starts, finishes or changes owner).
- Backlog, per-game design notes, and the "how a new game plugs in" steps: `docs/game-ideas.md`.
- Save format and cloud sync (read before touching saving): `docs/sync-design.md`, section "How the code works now".

## Read before you build
| Task | Read first |
|---|---|
| New game or big visual change | `docs/new-game-checklist.md` (scene brief before code, review at phone width before the PR), then `docs/game-ideas.md` "The rules every game must follow" and "How a new game plugs into the current code" |
| Anything that moves | `docs/animation-guide.md` |
| Art or sound | `docs/kenney-asset-plan.md`, `docs/art-shortlist.md`; Kenney bundle is outside the repo (`AI Projects/Kenney Game Assets All-in-1 3.8.0`) |
| Saving, profiles, sync | `docs/sync-design.md` |
| Firebase, deploy | `docs/sync-design.md` "Stage 3 (Firebase)" |

## Hard rules (each one has caused a real bug or a rejected design)
1. **Math is the mechanic.** Write down "could a kid play well without the math?" before shipping. Wrong answers explain themselves (show the arithmetic).
2. **Game logic is DOM-free with a Node test** (`js/<game>logic.js` or similar plus `tests/<game>.test.js`); screens are separate files. Every game must work for all four bands (`K-1`, `2-3`, `4-5`, `6`) and 1-3 stars.
3. **Saving goes through the `Store` helpers only**, under `profile.games.<gameId>`. Counters only ever go up. Never save a defaulted value as if the player chose it. Register a merge rule with `Save.registerGame` in `js/save.js` and add a case to `tests/save.test.js`. A game with no rule can lose progress.
4. **Sound only through `js/sfx.js`.** Right and wrong sounds are fixed (never random variants), and a result sound must never be masked by another.
5. **Respect Reduce motion** (`css/motion.css`, `html[data-motion="reduced"]`) and calm mode. New animations are covered automatically if they follow the guide.
6. **Phone first:** design at 375 px wide, thumb-sized targets, no horizontal scroll, every back button has space below it (`tests/browser/spacing.browser.js` checks this).
7. **No timers by default, no accounts, no ads, no tracking, original characters only** (Kenney art is CC0; record packs used in `assets/CREDITS.md`).
8. **Shared "registry" files** are conflict hotspots: `index.html`, `js/app.js` (`GAMES`, `SCREEN_OF`), `js/save.js`, `README.md`, `docs/game-ideas.md`, `css/style.css`. Add your changes in one commented block, and when merging keep both sides.

## Tests
```
for t in tests/*.test.js; do node "$t" || break; done      # what CI runs; must be green
node tests/browser/<name>.browser.js                         # Playwright (not a repo dependency); run the ones your change touches
```
No missing assets: a 404 image silently falls back to emoji and looks like an art revert, so check the network tab.

## Git and deploy
- Never force-push a shared branch. Before a PR: `git fetch && git merge origin/main`, run all tests, merge one PR at a time.
- **Merging to `main` deploys.** `.github/workflows/firebase-hosting-merge.yml` runs the node tests and then publishes to Firebase Hosting `live`.
  So do not merge a PR the owner has not approved, and do not run `firebase deploy` by hand (the CLI would publish `.git`; `tools/deploy-hosting.sh` exists only as a manual fallback, `--dry-run` first).
- Never add billing, Google Analytics, service-account keys or secrets. `js/firebase-config.js` holds public identifiers only.

## When you change something, update the docs in the same PR
README (game list, test list), `docs/game-ideas.md` tracker tick, `docs/work-streams.md` row, `assets/CREDITS.md`. If a doc and the code disagree, fix the doc.
