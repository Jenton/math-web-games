# Work streams: who owns what, and the merge order

Several chats work on this repo at once. This page is the single map. **Update it when a stream starts, finishes, or changes owner.**
Last updated: 11 Nov 2026 (refreshed against GitHub PR state; re-check with `gh pr list --state open` before trusting it).

**One checkout:** `AI Projects/math-web-games-kenney` is the only working folder for this repo. Do not create copies or worktrees; chats
share this folder, so check `git branch --show-current` and `git status` before editing, and do not switch branches under someone's uncommitted work.

## Open work

| Stream | Branch / PR | Status | Owns | Waits for |
|---|---|---|---|---|
| Instruction docs refresh | `docs/refresh-instructions` / PR #29 | Open: `CLAUDE.md`, README, tracker, this page, trimmed Firebase skills | `CLAUDE.md`, `README.md`, `docs/*.md` | owner review |
| Sort & Rule / Cut & Share polish | `claude/dreamy-pasteur-xues94` | Review fixes, static scene (gate scene, friends at a table) and tests built, PR open. Motion waits for the owner's playtest notes (plan in `docs/animation-guide.md`) | `js/sort.js`, `js/share.js`, the Sort and Share blocks in `css/style.css`, `docs/scene-briefs.md`, `tests/browser/newgames.browser.js` | owner's "ship it" |
| Animation pass | `claude/dreamy-pasteur-xues94` | Munchers, Machine Builder, Lemonade Stand, Number Defense are merged. Left: Balance, Sort & Rule and Cut & Share (the rework is merged, so the Balance plan in the guide can be applied; waiting on the owner's playtest notes), Escape Room, and Creature Quest | `docs/animation-guide.md`, `css/motion.css`, motion blocks in `css/style.css` | nothing |
| Keyboard controls | `keyboard-controls` | PR open for review | `js/keys.js`, keyboard bindings in `js/escape.js` and `js/share.js`, `tests/browser/keyboard.browser.js` | nothing |
| Number Line Runner (new game) | `number-line-runner` | PR open for review | `js/runlogic.js`, `js/runner.js`, `css/runner.css`, `tests/runner.test.js`, `tests/browser/runner.browser.js`, `assets/kenney/runner/` | nothing |
| Arrow Range (new game, archery) | `claude/determined-rubin-beq9c1` | Playable: logic, tests, screen, art and save rule are built; waiting for the owner's review, then a playtest with the kids | `js/archerylogic.js`, `js/archery.js`, `css/archery.css`, `tests/archery.test.js`, `tests/browser/archery.browser.js`, `assets/kenney/archery/`, `tools/kenney-browser/` | owner's review |

No other PRs are open. New work starts from a fresh branch off `main`. `feature/sort-share-balance-rework` was deleted (superseded by #27). Sort & Rule is exported as `MGR` (not `MGS`, which is Lemonade Stand).

## Done and merged

Escape Room (#25), deploy-a-clean-folder fix (#26), Sort & Rule, Cut & Share and the Balance rework (#27), Kenney art and sound (#6), Number Defense (#7), Lemonade Stand (#8), sound reliability fix (#9, #16), save format, cloud sync and Quest v2 rules (#11),
Firebase adapter and live project `math-quest-family` (#12), `RPG.makeEncounter` and Munchers animation / "Reduce motion" (#13), Quest art stages 1 to 3
including the world map (#14, #18, #21), Firebase ignore fix (#17), automatic deploy on merge (#20), Machine Builder / Lemonade / Number Defense animation
(#19, #22, #24), back-button spacing test (#23). `js/quest.js` is no longer reserved by the Quest art stream; anyone may edit it.

## Merge order

Nothing is queued. Next up: #29 (docs), then the animation pass for Balance, Escape Room and Creature Quest. Each new PR merges `main` first.

**Merging to `main` deploys to the live site** (after the node tests pass), so merge only what the owner has approved.

New games and big visual changes also follow `docs/new-game-checklist.md` (scene brief first, look at every state at phone width before the PR).

## Rules that keep the conflicts small

1. **One owner per area.** Do not edit another stream's files, except the shared registry files below.
2. **Before opening a PR:** `git fetch && git merge origin/main`, then run every test (`for t in tests/*.test.js; do node "$t" || break; done` and the Playwright suites in `tests/browser/`). A PR is opened only when it is clean against `main`.
3. **Merge one PR at a time.** After each merge, every other open branch merges `main` again before its own PR.
4. **Registry files are shared hotspots:** `index.html` (script tags and screens), `js/app.js` (the `GAMES` and `SCREEN_OF` tables), `js/save.js` (`registerGame`), `README.md`, `docs/game-ideas.md`, `css/style.css`. Keep your additions in one block with its own comment, and when two sides conflict there, **keep both**.
5. **New games** must save through the `Store` helpers, register a merge rule in `js/save.js`, and add tests (see "How the code works now" in `docs/sync-design.md`).
6. **Never force-push** a shared branch. If the remote has commits you lack, merge them.
7. **Deploys are automatic.** Merging to `main` runs `.github/workflows/firebase-hosting-merge.yml`, which publishes only the folder built by `tools/build-site.sh`. Do not deploy from the repo folder (it publishes `.git`), and do not add files the site needs under `docs/`, `tests/`, `tools/` or a dot-folder: they are never published. `tests/site-build.test.js` checks that everything the game references is in the published folder.
