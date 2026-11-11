#!/usr/bin/env bash
# Publish the site to Firebase Hosting by hand, from a CLEAN folder of just the files the game needs (tools/build-site.sh).
# NOTE: merging to main already deploys automatically (.github/workflows/firebase-hosting-merge.yml). Use this only to publish
# something that is not on main yet. Never deploy from the repo folder itself: that publishes .git and more.
# Usage (from anywhere inside the repo, after `npx firebase-tools login`):
#   tools/deploy-hosting.sh --dry-run     # show what would be published, publish nothing
#   tools/deploy-hosting.sh               # publish
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PROJECT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".firebaserc", "utf8")).projects.default)')"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
tools/build-site.sh "$STAGE/site"
echo "Project: $PROJECT"
cd "$STAGE/site"
npx firebase-tools deploy --only hosting --project "$PROJECT" "$@"
