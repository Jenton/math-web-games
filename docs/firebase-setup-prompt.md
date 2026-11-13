# Firebase setup prompt (HISTORICAL: already done, do not rerun)

> **Status: completed in Nov 2026.** The Firebase project `math-quest-family` exists and is live (Hosting, Firestore with locked-down rules, Anonymous sign-in),
> `.firebaserc` and `js/firebase-config.js` are committed, and deploys run automatically on merge to `main` (`.github/workflows/firebase-hosting-merge.yml`).
> **Do not paste the prompt below into a new session:** it would try to create a second project, check out an old branch and treat Hosting as manual.
> Current facts and the deploy path are in `docs/sync-design.md` ("Stage 3 (Firebase)"). Kept only as a record of how the project was set up
> and as a template if a second Firebase project is ever needed.

(Original header follows.) For a Claude Code session on the owner's Mac, with browser access.

Paste the prompt below into Claude Code running on the Mac, opened in the `math-web-games` folder. It needs browser access enabled
(for example the Claude in Chrome extension). If the browser is not available, the prompt tells Claude to give step-by-step instructions
for each console action instead, and the owner clicks.

This sets up the **infrastructure only** (project, database rules, hosting). The sync code itself (docs/sync-design.md stages 2 to 4) is
not built yet, so progress will not sync until that is done.

Files this prompt relies on, already in the repo: `firebase.json`, `firestore.rules`, `firestore.indexes.json`.
Rules were written but NOT executed by the author (no Firebase access in the cloud session), so the prompt includes tests for them.

---

```
You are helping me set up Firebase for my family's math game, "Puzzle Lab" (this repo). Read docs/sync-design.md first: it explains why.
We are setting up the infrastructure only: a NEW Firebase project, Firestore with locked-down security rules, and Firebase Hosting for the
static site. The cloud-sync code itself is not built yet, so nothing needs to sync today. Move step by step, tell me what you are doing, and
keep this short and plain: I find the Firebase console confusing.

SETUP
- git fetch, then check out the branch claude/dreamy-pasteur-xues94 (it contains firebase.json, firestore.rules, firestore.indexes.json).
- Check that node and npm are installed. Use the Firebase CLI via `npx firebase-tools` (or install firebase-tools if I agree).
- You will drive my browser for the console steps. If you cannot control the browser, don't guess: give me numbered click-by-click
  instructions for each step, wait for me to report what I see, and continue.

HARD RULES (stop and ask me before doing any of these)
- I already have another Firebase project in this Google account. NEVER modify it. Before EVERY console or CLI change, confirm you are
  in the new project (check the project id in the page title/URL, or `firebase use`). Do not run `firebase init`; it would overwrite
  firebase.json. Use `firebase use --add` instead.
- No billing: stay on the free Spark plan. If any screen asks me to upgrade, add a credit card, or enable Blaze, STOP and ask me.
- Do not turn on Google Analytics, or any service not listed below. No service-account keys, no secrets in chat or in git.
- Never type my password or handle 2FA: if a login or verification appears, pause and ask me to complete it.
- Do not deploy Hosting (this makes the site public) until I say yes.
- Do not delete anything.

STEP 1: Create the project (browser: https://console.firebase.google.com)
- Create a project named "math-quest-family" (the project id may get a suffix; note the final id).
- Turn Google Analytics OFF.
- Confirm the plan shown is Spark / no-cost.

STEP 2: Firestore (browser: Build > Firestore Database)
- Create database, edition Standard if asked. Ask me which location to use before choosing (it cannot be changed later; a US location near
  me is fine, I will confirm).
- Start in PRODUCTION mode (locked), not test mode.

STEP 3: Anonymous sign-in (browser: Build > Authentication)
- Get started > Sign-in method > enable ONLY "Anonymous". Nothing else.

STEP 4: Register a web app (browser: Project settings > Your apps > the </> web icon)
- Nickname "math-quest-web". Do NOT tick "also set up Firebase Hosting" (the CLI does that).
- Copy the firebaseConfig values. These are public identifiers, not secrets (access is controlled by the security rules).
- Create js/firebase-config.js containing exactly: window.FIREBASE_CONFIG = { ...the values... };
  Do NOT add a <script> tag for it anywhere yet.

STEP 5: Connect the CLI and deploy the security rules
- `npx firebase-tools login` (I will approve in the browser), then `npx firebase-tools use --add`, pick the new project, alias "default".
- Deploy only the rules: `npx firebase-tools deploy --only firestore:rules,firestore:indexes`. Fix any rules compile error by showing me
  the exact message first; do not weaken the rules to make it pass.

STEP 6: TEST THE RULES (the rules were written without being run, so these tests matter)
Using the project id, an unguessable fake id like 64 lowercase hex characters, and curl against
https://firestore.googleapis.com/v1/projects/<PROJECT_ID>/databases/(default)/documents/families/<ID>
- Unauthenticated GET must return 403 PERMISSION_DENIED.
- Unauthenticated listing (GET .../documents/families) must return 403.
- Unauthenticated PATCH/creation must return 403.
Then in the console (Firestore > Rules > Rules Playground), simulate AUTHENTICATED requests and confirm:
- get families/<64 hex chars>: allowed.          - get families/short-id: denied.
- list families: denied.                           - delete families/<64 hex>: denied.
- create with fields v=1, rev=1, iv="x", ct="y": allowed.
- create with rev=2: denied.                       - create with an extra field: denied.
- update from rev=1 to rev=3: denied; to rev=2: allowed.
Report any test that does not behave as stated and do NOT continue until it is fixed.

STEP 7: Hosting (ask me for a yes before the deploy command)
- First show me what will be published: `npx firebase-tools deploy --only hosting --dry-run` if available, or list the files that firebase.json
  will serve. It must NOT include docs/, tests/, .git, *.md, assets/Kenney*/ or any .env/secret file.
- After I say yes: `npx firebase-tools deploy --only hosting`.
- Open the live URL (https://<PROJECT_ID>.web.app). Check that the home screen loads, I can create a player and play a game, and
  there are no console errors.

STEP 8: Wrap up
- Commit .firebaserc and js/firebase-config.js (public identifiers only; no keys files), push to claude/dreamy-pasteur-xues94, and do NOT
  open a pull request (my cloud session handles that).
- Report: the project id, the Hosting URL, the Firestore location, that the plan is still Spark, which rule tests passed, and anything you
  skipped or are unsure about.
```
