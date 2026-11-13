#!/usr/bin/env bash
# Build the folder that gets PUBLISHED to Firebase Hosting: only the files the game needs, nothing else.
# Usage: tools/build-site.sh OUT_DIR      (OUT_DIR is deleted and recreated)
#
# Why a separate folder: deploying straight from a repo checkout also publishes .git (about 3,000 files, and in CI the job's
# checkout credential header), .github, tools and anything else that is not explicitly excluded. firebase.json's ignore list does
# not reliably keep dot-folders out, and a pattern like "assets/Kenney*/**" also matched assets/kenney/ because Firebase compares
# case-insensitively and hid every Kenney asset. Here the excludes are exact (case-sensitive) and the result is tested
# (tests/site-build.test.js). Used by tools/deploy-hosting.sh (manual) and .github/workflows/firebase-hosting-merge.yml (automatic).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
OUT="${1:?usage: tools/build-site.sh OUT_DIR}"
rm -rf "$OUT"
mkdir -p "$OUT"
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT

# ALLOW-LIST first: only index.html and the css/, js/ and assets/ folders can be published. Anything else at the repo root (a lock file, notes,
# a config someone adds later) stays private by default instead of going public by accident (skills-lock.json did). If the game ever needs
# another top-level file (a manifest, a service worker), add it to the pattern below; tests/site-build.test.js fails with the missing file's
# name if index.html references something that is not published.
# Then, within those, minus everything that must not be public:
#   tests/ docs/ tools/ and the build output itself (_site/), markdown, Firebase config and rules, any dotfile or dot-folder at any depth
#   (.git, .github, .firebase, ...), the raw Kenney download bundle (assets/Kenney Game ... , NOT assets/kenney/), assets/incoming, node_modules
(git ls-files; git ls-files --others --exclude-standard) | sort -u \
  | grep -E '^(index\.html$|manifest\.webmanifest$|css/|js/|assets/)' \
  | grep -v -E '^(tests|docs|tools|_site)/|\.md$|^firebase\.json$|^firestore\.(rules|indexes\.json)$|^\.firebaserc$|(^|/)\.[^/]*$|(^|/)\.[^/]+/|^assets/Kenney Game[^/]*/|^assets/incoming/|node_modules/' \
  > "$LIST"

while IFS= read -r f; do
  [ -f "$f" ] || continue   # a tracked file that was deleted in a dirty working tree
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$f" "$OUT/$f"
done < "$LIST"

# the published firebase.json: hosting only (never the Firestore rules). It does NOT use the repo's "ignore" list (a broad pattern there once
# hid every Kenney asset, because Firebase compares case-insensitively); the folder is already clean. It states Firebase's three standard
# exclusions EXPLICITLY, because leaving "ignore" out is not enough: without it firebase.json itself was published (found by the live check).
node -e '
  const h = Object.assign({}, require("./firebase.json").hosting);
  h.ignore = ["firebase.json", "**/.*", "**/node_modules/**"];
  require("fs").writeFileSync(process.argv[1], JSON.stringify({ hosting: h }, null, 2));
' "$OUT/firebase.json"

echo "Built $OUT with $(wc -l < "$LIST" | tr -d ' ') files:"
sed 's|/[^/]*$||' "$LIST" | sort | uniq -c | sed 's/^/  /'
