# Work streams: who owns what, and the merge order

Several chats work on this repo at once. This page is the single map. **Update it when a stream starts, finishes, or changes owner.**
Last updated: 11 Nov 2026.

## The streams

| Stream | Branch / PR | Status | Owns | Waits for |
|---|---|---|---|---|
| Save format, cloud sync core and screens, Firebase config, **Creature Quest v2 rules** (groups of monsters, ally effects, rescues) | `claude/dreamy-pasteur-xues94` / PR #11 | Ready: clean against `main`, all tests pass | `js/save.js`, `js/storage.js`, `js/sync*.js`, `js/rpg.js`, `js/quest.js` (v2), `firebase.json`, `firestore.rules`, `docs/sync-design.md` | nothing |
| Firebase adapter (sets `window.MathQuestBackend`) | its own branch (another chat) | In progress | one new file, e.g. `js/firebase-adapter.js`, plus one script tag | PR #11 merged. Contract: "Backend adapter contract" in `docs/sync-design.md` |
| Creature Quest sprite battles, classic/cute art themes, world map | `creature-quest-art` / PR #10 | Built on the OLD Quest battle screen (one monster, card power). Conflicts with v2 in `js/quest.js`, `index.html`, README, docs | `js/art.js`, `js/worldmap.js`, `tools/make_quest_assets.py`, Quest art | PR #11 merged, then it must be ported to groups of monsters, the ally picker and enemy retaliation |
| Sort & Rule, Cut & Share, Balance rework | `feature/sort-share-balance-rework` (no PR yet) | In progress | `js/sort*.js`, `js/cutshare.js`, `js/share.js`, `js/balance.js` | PR #11 merged, then merge `main` (registry-file conflicts) |
| Munch sound reliability | `fix-sfx-reliability` / PR #9 | Ready | `js/sfx.js` | nothing |
| Kenney art shortlist | `art-shortlist` | Docs only (already inside `creature-quest-art`) | `docs/art-shortlist.md` | nothing |
| Animation pass (guide, then each game) | `claude/dreamy-pasteur-xues94` | Munchers done and merged; "Reduce motion" setting in review. Next: Machine Builder, then others. **Balance waits for the rework stream**, so the two do not both edit `js/balance.js` | `docs/animation-guide.md`, the motion blocks at the end of `css/style.css` | Balance rework merged (for Balance only) |
| Done and merged | PR #6 Kenney art and sound, #7 Number Defense, #8 Lemonade Stand | Merged | | |

## Merge order

1. **#9** (sound fix): tiny and independent.
2. **#11** (sync, Firebase config, Quest v2 rules): unblocks the adapter and everyone who touches Quest or saving.
3. **Firebase adapter** PR: once #11 is in `main`.
4. **Quest integration**: port the sprite scene and world map (#10) onto the v2 rules. Exactly one chat does this, and nobody else edits `js/quest.js` meanwhile.
5. **Sort & Rule / Cut & Share**: merge `main` first and resolve the registry files.

## Rules that keep the conflicts small

1. **One owner per area.** Do not edit another stream's files, except the shared registry files below.
2. **Before opening a PR:** `git fetch && git merge origin/main`, then run every test (`node tests/*.test.js` and the Playwright suites in `tests/browser/`). A PR is opened only when it is clean against `main`.
3. **Merge one PR at a time.** After each merge, every other open branch merges `main` again before its own PR.
4. **Registry files are shared hotspots:** `index.html` (script tags and screens), `js/app.js` (the `GAMES` table), `js/save.js` (`registerGame`), `README.md`, `docs/game-ideas.md`, `css/style.css`. Keep your additions in one block with its own comment, and when two sides conflict there, **keep both**.
5. **New games** must save through the `Store` helpers, register a merge rule in `js/save.js`, and add tests (see "How the code works now" in `docs/sync-design.md`).
6. **Never force-push** a shared branch. If the remote has commits you lack, merge them.
