# Cross-Device Saving (design)

**Requirement (owner, Nov 2026):** progress must follow the kids across devices (laptop, iPad, phone), for **every** game.
No accounts for the kids. Keep it light and private.

## Today
All progress lives in `localStorage` (key `mathQuest.v1`) in one browser on one device (`js/storage.js`). A backup file
(export/import on the home screen) is the only way to move it. Each game stores progress in its own ad hoc field on the profile
(`munchers`, `balance`, `machine`, `rpg`, plus `stats`).

## Decisions
- **Access: family code + passphrase, no accounts.** Set up once on a device, typed once on each other device.
- **Backend: Firebase, in the owner's existing Google account** (a new *project*, not a new account). The owner already uses Firebase,
  does not want a new account, and does not want to depend on the Mac mini (it restarts).
  - **Firebase Hosting** serves the static site at one stable https address (needed for the iPad anyway; `file://` will not work there).
  - **Firestore** stores one encrypted document per family.
- **Zero-knowledge:** data is encrypted on the device before upload. The server stores opaque blobs and never sees names or progress.
- **Offline-first:** the game always plays from the local copy. Sync is background work and never blocks play.
- **The backup file stays** as the recovery path (a lost passphrase cannot be recovered from the cloud).

## Security model (be honest about limits)
- The passphrase is stretched with PBKDF2 (WebCrypto, high iteration count) into two separate values: a **lookup id** (the Firestore
  document id) and an **AES-GCM key**. Knowing the id is the capability to read or write that document, so the passphrase must be long.
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

## Stages
1. **Storage restructure (no backend):** v2 format, migration from v1, per-device counters, merge functions, tests, update every existing
   game to the new layout. Valuable on its own and best done before Quest v2 and the map add more progress data.
2. **Crypto + sync adapter against a local fake** (so it is testable without Firebase), including conflict and offline cases.
3. **Firebase setup:** project, Hosting for the site, Firestore rules, deploy instructions.
4. **Sync UI:** set up, add device, status indicator, manual sync, plus the existing backup file as recovery.

## Open questions
- Firebase project name, and whether to use a custom domain.
- Passphrase UX (generated words, how to display and store the written copy).
- Whether to also keep GitHub Pages as a mirror.
- Quota monitoring: the free Spark plan is plenty for a family today, but plans can change.
