# Work streams: who owns what, and the merge order

Several chats work on this repo at once. This page is the single map. **Update it when a stream starts, finishes, or changes owner.**
Last updated: 11 Nov 2026 (evening).

## The streams

| Stream | Branch / PR | Status | Owns | Waits for |
|---|---|---|---|---|
| Save format, cloud sync core and screens, Firebase config, **Creature Quest v2 rules** (groups of monsters, ally effects, rescues) | `claude/dreamy-pasteur-xues94` / PR #11 | **Merged.** Follow-ups on the same branch (`RPG.makeEncounter`, fewer right cards at 2-3 stars, the animation chat's Munchers fixes and "Reduce motion" setting) are in the next PR from this branch | `js/save.js`, `js/storage.js`, `js/sync*.js`, `js/rpg.js`, `js/quest.js` (v2), `firebase.json`, `firestore.rules`, `docs/sync-design.md` | nothing |
| Firebase adapter (sets `window.MathQuestBackend`) and Hosting deploy script | `claude/firebase-adapter` | **Merged (PR #12).** Firebase project `math-quest-family` is live | `js/firebase-backend.js`, `tests/firebase-backend*.js`, `tests/helpers/fake-firebase.js`, `tools/deploy-hosting.sh`, two script tags in `index.html` | nothing (PR #11 is merged). Publish with `tools/deploy-hosting.sh`, never by deploying from the repo folder |
| Creature Quest sprite battles, classic/cute art themes, world map | `quest-art-stage3` (Stage 3) | **Stages 1 and 2 merged (#14, #18).** Stage 3 (world map launching `RPG.makeEncounter` fights) is in its own PR. After it merges, `js/quest.js` is free for anyone | `js/art.js`, `js/worldmap.js`, `tools/make_quest_assets.py`, `assets/quest/`, **`js/quest.js` until the port is merged (nobody else edits it)** | Stage 3 waits for PR #13 (`RPG.makeEncounter`) |
| Sort & Rule, Cut & Share, Balance rework | **Merged** (PR #27, from `rework-on-main`). `feature/sort-share-balance-rework` is **superseded: do not push to it**; start new work from `main` | Done and merged; Sort & Rule is exported as `MGR` (not `MGS`, which is Lemonade Stand) | `js/sort*.js`, `js/cutshare.js`, `js/share.js`, `js/balance.js` | nothing |
| Escape Room (new game) | `escape-room` | PR open for review | `js/elogic.js`, `js/escape.js`, `css/escape.css`, `tests/escape.test.js`, `assets/kenney/escape/` | nothing |
| Munch sound reliability | `fix-sfx-reliability` / PR #9 | Ready | `js/sfx.js` | nothing |
| Kenney art shortlist | `art-shortlist` | Docs only (already inside `creature-quest-art`) | `docs/art-shortlist.md` | nothing |
| Animation pass (guide, then each game) | `claude/dreamy-pasteur-xues94` | Munchers and "Reduce motion" are merged. Machine Builder is merged. Lemonade Stand is merged. Number Defense is merged. Remaining: Balance, Sort & Rule and Cut & Share (the rework is now merged, so the Balance plan in the guide can be applied; waiting on the owner's playtest notes), Escape Room, and Creature Quest (art stream). **Balance waits for the rework stream**, so the two do not both edit `js/balance.js` | `docs/animation-guide.md`, `css/motion.css` (new, per-game motion), the Munchers motion block at the end of `css/style.css`, `js/machine.js`, `js/lemonade.js`, `js/td.js` (motion hooks only) | Balance rework merged (for Balance only) |
| Done and merged | PR #6 Kenney art and sound, #7 Number Defense, #8 Lemonade Stand | Merged | | |

## Merge order

Done: #6, #7, #8, **#11** (sync, Quest v2 rules), **#12** (Firebase adapter).
Next:
1. **#9** (sound fix) and the next PR from `claude/dreamy-pasteur-xues94` (`RPG.makeEncounter`, Munchers animation fixes, "Reduce motion"): both small and independent.
2. **Quest art port** (the `creature-quest-art` stream): staged PRs, each green before the next.
3. **Sort & Rule / Cut & Share / Balance rework**: merge `main` first and resolve the registry files.
4. **Animation pass for Balance** only after the Balance rework is merged.

New games and big visual changes also follow `docs/new-game-checklist.md` (scene brief first, look at every state at phone width before the PR).

## Rules that keep the conflicts small

1. **One owner per area.** Do not edit another stream's files, except the shared registry files below.
2. **Before opening a PR:** `git fetch && git merge origin/main`, then run every test (`node tests/*.test.js` and the Playwright suites in `tests/browser/`). A PR is opened only when it is clean against `main`.
3. **Merge one PR at a time.** After each merge, every other open branch merges `main` again before its own PR.
4. **Registry files are shared hotspots:** `index.html` (script tags and screens), `js/app.js` (the `GAMES` table), `js/save.js` (`registerGame`), `README.md`, `docs/game-ideas.md`, `css/style.css`. Keep your additions in one block with its own comment, and when two sides conflict there, **keep both**.
5. **New games** must save through the `Store` helpers, register a merge rule in `js/save.js`, and add tests (see "How the code works now" in `docs/sync-design.md`).
6. **Never force-push** a shared branch. If the remote has commits you lack, merge them.
7. **Deploys are automatic.** Merging to `main` runs `.github/workflows/firebase-hosting-merge.yml`, which publishes only the folder built by `tools/build-site.sh`. Do not deploy from the repo folder (it publishes `.git`), and do not add files the site needs under `docs/`, `tests/`, `tools/` or a dot-folder: they are never published. `tests/site-build.test.js` checks that everything the game references is in the published folder.

