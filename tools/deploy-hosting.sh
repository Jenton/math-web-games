#!/usr/bin/env bash
# Publish the site to Firebase Hosting from a CLEAN COPY of just the files the game needs.
# Why: deploying straight from the repo folder also picks up .git (about 3,000 files), because firebase.json's ignore list does not
# keep dot-folders out in practice. This script copies only the site files, applies the same excludes, and deploys from the copy.
# Usage (from anywhere inside the repo, after `npx firebase-tools login`):
#   tools/deploy-hosting.sh --dry-run     # show what would be published, publish nothing
#   tools/deploy-hosting.sh               # publish
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PROJECT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".firebaserc", "utf8")).projects.default)')"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# tracked files + untracked-but-not-ignored files, minus everything that must not be public
(git ls-files; git ls-files --others --exclude-standard) | sort -u \
  | grep -v -E '^(tests|docs|tools)/|\.md$|^firebase\.json$|^firestore\.(rules|indexes\.json)$|^\.firebaserc$|(^|/)\.[^/]*$|^assets/Kenney[^/]*/|^assets/incoming/|node_modules/' \
  > "$STAGE/.files"
while IFS= read -r f; do mkdir -p "$STAGE/site/$(dirname "$f")"; cp "$f" "$STAGE/site/$f"; done < "$STAGE/.files"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ hosting: require("./firebase.json").hosting }, null, 2))' "$STAGE/site/firebase.json"

echo "Project: $PROJECT"
echo "Publishing $(wc -l < "$STAGE/.files" | tr -d ' ') files (no docs, tests, tools, markdown, hidden files or .git):"
sed 's|/[^/]*$||' "$STAGE/.files" | sort | uniq -c | sed 's/^/  /'
cd "$STAGE/site"
npx firebase-tools deploy --only hosting --project "$PROJECT" "$@"
