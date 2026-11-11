# Work streams: who owns what, and the merge order

Several chats work on this repo at once. This page is the single map. **Update it when a stream starts, finishes, or changes owner.**
Last updated: 11 Nov 2026 (refreshed against GitHub PR state; re-check with `gh pr list --state open` before trusting it).

**One checkout:** `AI Projects/math-web-games-kenney` is the only working folder for this repo. Do not create copies or worktrees; chats
share this folder, so check `git branch --show-current` and `git status` before editing, and do not switch branches under someone's uncommitted work.

## Open work

| Stream | Branch / PR | Status | Owns | Waits for |
|---|---|---|---|---|
| Escape Room (new game) | `escape-room` / PR #25 | Open for review, fully committed and pushed (tests green) | `js/elogic.js`, `js/escape.js`, `css/escape.css`, `tests/escape.test.js`, `assets/kenney/escape/` | owner review |
| Deploy-clean-folder fix | `claude/dreamy-pasteur-xues94` / PR #26 | Open. Makes `tools/deploy-hosting.sh` publish a clean copy (the live site was publishing `.git`) | `tools/deploy-hosting.sh`, `firebase.json` | owner review |
| Sort & Rule, Cut & Share, Balance rework | `rework-on-main` / PR #27 (older branch `feature/sort-share-balance-rework`) | Open, already merged with current `main` | `js/sort*.js`, `js/cutshare.js`, `js/share.js`, `js/balance.js` | owner review. **Animation for Balance waits for this** |
| Instruction docs refresh | `docs/refresh-instructions` | In progress: `CLAUDE.md`, README, tracker, this page | `CLAUDE.md`, `README.md`, `docs/*.md` | nothing |
| Animation pass | `claude/dreamy-pasteur-xues94` | Munchers, Machine Builder, Lemonade Stand, Number Defense are merged. Left: Creature Quest, Escape Room, Balance (after the rework) | `docs/animation-guide.md`, `css/motion.css`, motion blocks in `css/style.css` | Balance rework merged (Balance only) |

## Done and merged

Kenney art and sound (#6), Number Defense (#7), Lemonade Stand (#8), sound reliability fix (#9, #16), save format, cloud sync and Quest v2 rules (#11),
Firebase adapter and live project `math-quest-family` (#12), `RPG.makeEncounter` and Munchers animation / "Reduce motion" (#13), Quest art stages 1 to 3
including the world map (#14, #18, #21), Firebase ignore fix (#17), automatic deploy on merge (#20), Machine Builder / Lemonade / Number Defense animation
(#19, #22, #24), back-button spacing test (#23). `js/quest.js` is no longer reserved by the Quest art stream; anyone may edit it.

## Merge order

1. **#25 Escape Room** and **#26 deploy fix**: small and independent.
2. **#27 Sort & Rule / Cut & Share / Balance rework**: merge `main` again first if anything landed since.
3. **Animation for Balance** only after #27.

**Merging to `main` deploys to the live site** (after the node tests pass), so merge only what the owner has approved.

New games and big visual changes also follow `docs/new-game-checklist.md` (scene brief first, look at every state at phone width before the PR).

## Rules that keep the conflicts small

1. **One owner per area.** Do not edit another stream's files, except the shared registry files below.
2. **Before opening a PR:** `git fetch && git merge origin/main`, then run every test (`for t in tests/*.test.js; do node "$t" || break; done` and the Playwright suites in `tests/browser/`). A PR is opened only when it is clean against `main`.
3. **Merge one PR at a time.** After each merge, every other open branch merges `main` again before its own PR.
4. **Registry files are shared hotspots:** `index.html` (script tags and screens), `js/app.js` (the `GAMES` and `SCREEN_OF` tables), `js/save.js` (`registerGame`), `README.md`, `docs/game-ideas.md`, `css/style.css`. Keep your additions in one block with its own comment, and when two sides conflict there, **keep both**.
5. **New games** must save through the `Store` helpers, register a merge rule in `js/save.js`, and add tests (see "How the code works now" in `docs/sync-design.md`).
6. **Never force-push** a shared branch. If the remote has commits you lack, merge them.
