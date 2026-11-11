# Cross-Device Saving (design)

**Requirement (owner, Nov 2026):** progress must follow the kids across devices (laptop, iPad, phone), for **every** game.
No accounts for the kids. Keep it light and private.

## Today
All progress lives in `localStorage` (key `mathQuest.v1`) in one browser on one device (`js/storage.js`). A backup file
(export/import on the home screen) is the only way to move it. Each game stores progress in its own ad hoc field on the profile
(`munchers`, `balance`, `machine`, `rpg`, plus `stats`).

## Decisions
- **Access: one generated FAMILY CODE, no accounts** (changed from the earlier "code + passphrase" idea: one thing to write down). 16 random
  characters like `K7PQ-3M9X-B2RD-VW4H` (80 bits, Crockford base32 so no I/L/O/U look-alikes; typing is forgiving about case, spaces and dashes).
  Set up once on a device, typed once on each other device.
- **Backend: Firebase, in the owner's existing Google account** (a new *project*, not a new account). The owner already uses Firebase,
  does not want a new account, and does not want to depend on the Mac mini (it restarts).
  - **Firebase Hosting** serves the static site at one stable https address (needed for the iPad anyway; `file://` will not work there).
  - **Firestore** stores one encrypted document per family.
- **Zero-knowledge:** data is encrypted on the device before upload. The server stores opaque blobs and never sees names or progress.
- **Offline-first:** the game always plays from the local copy. Sync is background work and never blocks play.
- **The backup file stays** as the recovery path (a lost passphrase cannot be recovered from the cloud).

## Security model (be honest about limits)
- The family code is stretched with PBKDF2-SHA256 (600,000 iterations, about 0.1 to 0.5 s) and split with HKDF into two independent values: a **lookup id**
  (the Firestore document id) and an **AES-GCM key**. Each upload uses a fresh random IV and the ciphertext is bound to its document id. Knowing the id is the capability to read or write that document, so the passphrase must be long.
  Generate it for the user (for example four random words) instead of letting people choose weak ones.
- Firestore rules: allow `get`, `create`, `update` on `families/{lookupId}` only; **no `list`**, so ids cannot be enumerated;
  limit document size and require the expected fields. Optional: Anonymous Auth and App Check to cut abuse.
- Data is only first names or nicknames, avatars and game progress. No emails, no ages, no analytics, no third-party scripts.
  If the site is ever shared beyond family, re-check children's-privacy rules (not legal advice).

## Save format v2 (versioned, namespaced, mergeable)
```
{ schemaVersion: 2, deviceId, profiles: [ {
    id, name, avatar, createdAt, updatedAt,
    settings: {...},                       // last write wins
    stats:  { skillId: { deviceId: {right, wrong} } },   // per-device counters
    games:  { munchers: {...}, balance: {...}, machine: {...}, rpg: {...}, <future games> }
  } ], deleted: { profileId: timestamp } }
```
Every game keeps its progress under `profile.games.<gameId>` and **must define a merge rule**.

## Merge rules (pure functions, heavily tested)
Devices can play offline and reconnect, so merging must never lose progress.
- **Counters (right/wrong, wins, levels cleared, XP earned):** stored **per device** and summed. Merge = per-device max. (Plain max()
  would lose one device's increments.) Level is derived from total XP.
- **Sets (creatures/allies owned, cleared map nodes, unlocked items):** union.
- **Bests (node stars, high scores):** max.
- **Team, settings, current selections:** last write wins by `updatedAt`.
- **Deleted profiles:** tombstones with a timestamp, so a deletion on one device is not undone by another.
- Merge is commutative, associative and idempotent. Tests must check that (property-style) and that no merge decreases any value.

## Sync protocol
1. On load, after each save (debounced), on coming back online, and on a manual "Sync now": **pull** the encrypted doc, decrypt,
   **merge** with local, write local, then **push** (Firestore transaction on a `rev` field; on conflict, re-pull and merge again).
2. Show status in the UI: "Synced just now", "Offline, will sync later", or "Sync problem". Never block the game.
3. Setup screen: "Set up sync" (generates the family code and passphrase and shows them to write down) and "Add this device"
   (enter the code and passphrase).

## Rules for every game (add to the "plug in a game" checklist)
1. Save only through the shared storage layer, under `profile.games.<gameId>`.
2. Define a merge rule for each field using the types above.
3. Ship tests for the merge rule and for loading older saves.

## Migration
Old v1 saves (single device) are migrated to v2 on first load. `Store.importJSON` accepts both. Keep a copy of the v1 data until the
v2 save succeeds.

## Work split
- **Claude writes:** the v2 storage layer and migration, merge functions and tests, the crypto helpers, the sync adapter, `firebase.json`,
  Firestore rules, the sync UI, and step-by-step setup instructions.
- **Owner (or a Claude Code session on the owner's laptop) does:** create the Firebase project in the existing Google account, enable
  Hosting and Firestore, run `firebase login` and `firebase deploy`. Claude cannot log in to the owner's Google account from the cloud session.
  Firebase web config values are not secret (access is controlled by the Firestore rules); the config can live in the repo.

## Status
**Stage 1 is BUILT** (storage restructure, no backend): `js/save.js` (v2 format, v1 migration, merge, per-game schemas),
`js/storage.js` (the `Store` API games use), every game moved onto it, and `tests/save.test.js` (random multi-device histories prove
merge is commutative, associative and idempotent, never loses progress, and that devices converge). Browser-checked: a v1 save migrates with
nothing lost (the v1 data is left untouched as a backup), all four games play and save, a v1 backup file still imports, and two
devices merged by `Store.mergeIn` add up correctly. **Stages 2 to 4 (crypto, Firebase, sync UI) are not built.**

**Stage 2 is BUILT** (cloud sync core, no Firebase): `js/sync.js` and `tests/sync.test.js`. It contains the family code generator and parser, key
derivation, encryption, `syncOnce` (pull, decrypt, merge, apply locally, push with a revision check, retry on collision), and `createSyncer`
(setup, join, background sync with debounce, retries with backoff, online/visibility triggers, status for the UI, disconnect). Tested against a fake
backend that enforces the same rules as `firestore.rules`, with mutation checks (nine deliberate breakages are each caught). `Store` gained
`snapshot()` and `onSave(fn)` for it. `js/sync.js` is deliberately **not loaded by `index.html` yet** (that is Stage 4).

### Behavior worth knowing (all tested)
- **Merge, never overwrite:** every sync merges the cloud copy with this device before writing anything. Nothing is uploaded if nothing changed.
- **Create vs join:** only "set up" may create a family. "Add this device" requires the family to exist, so a mistyped code can never silently start
  a new empty family (it reports `notFound` and saves no credentials).
- **Never overwrites what it cannot read:** a wrong code, damaged data, or a newer unknown format leaves the cloud copy and the local save untouched and
  reports `badKey` or `corrupt`.
- **Offline-first:** failures never touch local data; they show in the status and retry with backoff (15 s doubling up to 5 min).
- **Credentials** (lookup id and key, not the code) are saved on the device in `localStorage` key `mathQuest.sync`, so people do not retype the code.
- Size guard: a save that would exceed the document limit is refused (`tooBig`) rather than uploaded.

### Backend adapter contract (what the Firebase adapter must implement, Stage 3)
```
backend.get(id)  -> null | { v, rev, iv, ct }       // Firestore getDoc(families/<id>); missing doc -> null
backend.put(id, envelope, expectedRev) -> { ok: true } | { conflict: true }
     // expectedRev 0 = create (envelope.rev must be 1); otherwise update with envelope.rev == expectedRev + 1.
     // Firestore: setDoc(families/<id>, envelope). The security rules reject a stale revision with permission-denied.
     // On permission-denied: re-get; if the doc is missing or its rev != expectedRev, return { conflict: true }; otherwise throw SyncError('denied').
Errors: connectivity problems -> throw new Sync.SyncError('offline'); permission problems -> SyncError('denied'); anything else -> a normal Error.
Anonymous sign-in must have completed before the first call (signInAnonymously once, then reuse the session).
```
Wiring (Stage 4): load the Firebase web SDK, create the adapter, `Sync.createSyncer({ backend, getData: Store.snapshot, applyRemote: Store.mergeIn,
storage: localStorage })`, call `Store.onSave(syncer.notifyChanged)`, `syncer.init()` on boot and `syncer.attach(window)`.

### How the code works now (read before adding a game)
- Progress lives under `profile.games.<gameId>`. Use the `Store` helpers: `Store.game(profile, id)`, `Store.bump(game, field)` and `Store.total(game, field)`
  for counters, `Store.setField(game, field, value)` for last-write-wins values, `Store.record(profile, skillId, right)` for per-skill stats, and
  `Store.setSettings(profile, patch)` for settings. **Never write a counter backwards** (no `--`, no resetting to a lower number); counters only go up.
  If a screen needs "undo", count once per puzzle instead (see Machine Builder).
- Sets (things you own) only grow. Never save a defaulted value as if the player chose it (Creature Quest computes its default team when reading:
  `RPG.currentTeam`), because that makes the merge order matter.
- Register the game's merge rule in `js/save.js` with `Save.registerGame(id, { field: 'counter' | 'set' | 'max' | 'lww' })` and add cases to
  `tests/save.test.js`. A game with no rule falls back to "the newer whole object wins", which can lose progress.
- Level in Creature Quest is **derived** from total XP (`RPG.progress`), never stored.
- Migration filed v1 counters under the migrating device. If the same v1 backup is restored on two devices before they sync, those starting counts
  are summed once per device (cosmetic inflation). We chose that over the alternative, which could silently drop real progress.
- `Store.importJSON` (restore) REPLACES everything on this device. `Store.mergeIn` combines and is what sync will use.

### Firebase files in the repo (written, not yet deployed or run)
`firebase.json` (Hosting config that excludes docs, tests, markdown and the Kenney bundle; Firestore rules pointer), `firestore.rules`
(one document per family at `families/{64 hex chars}`; anonymous sign-in required; get/create/update only; no list, no delete; the
document shape is fixed to `v`, `rev`, `iv`, `ct`; each update must bump `rev` by exactly 1) and `firestore.indexes.json`.
**The rules were not executed by their author**, so `docs/firebase-setup-prompt.md` includes tests that must pass before relying on them.
`docs/firebase-setup-prompt.md` is the prompt for a Claude Code session on the owner's Mac that drives the browser for the console steps.

## Stages
1. **(DONE) Storage restructure (no backend):** v2 format, migration from v1, per-device counters, merge functions, tests, update every existing
   game to the new layout. Valuable on its own and best done before Quest v2 and the map add more progress data.
2. **(DONE) Crypto + sync core against a local fake** (so it is testable without Firebase), including conflict and offline cases.
3. **Firebase setup:** project, Hosting for the site, Firestore rules, deploy instructions.
4. **Sync UI:** set up, add device, status indicator, manual sync, plus the existing backup file as recovery.

## Open questions
- Firebase project name, and whether to use a custom domain.
- Family-code UX: how to display it once after setup (copy button, print/share, "I wrote it down" confirmation) and what to do if it is lost
  (the backup file is the recovery path; a new family can be started from any device that still has the data).
- Whether to also keep GitHub Pages as a mirror.
- Quota monitoring: the free Spark plan is plenty for a family today, but plans can change.
