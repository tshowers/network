#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# The Firestore emulator (used by `npm run e2e` below) needs a JRE. Homebrew's
# openjdk isn't symlinked onto PATH by default, so pick it up here rather than
# requiring that to be done manually on every machine that runs this script.
if command -v brew >/dev/null 2>&1; then
  JAVA_PREFIX="$(brew --prefix openjdk 2>/dev/null || true)"
  if [ -n "${JAVA_PREFIX}" ] && [ -d "${JAVA_PREFIX}/bin" ]; then
    export PATH="${JAVA_PREFIX}/bin:${PATH}"
  fi
fi

trap 'echo "Deploy aborted - a previous step failed, nothing was deployed." >&2' ERR

echo "Running Network production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Running unit tests..."
npm run test:ci

echo "Running end-to-end tests (Firebase emulators + Cypress)..."
npm run e2e

echo "Building the production Network bundle..."
npm run build

echo "Deploying Network to Firebase Hosting site todd-network..."
firebase deploy --project taliferrotech --only hosting:todd-network

echo "Network hosting deploy complete."
firebase projects:list

# The build bumps the version (package.json, src/assets/version.json) and
# Firebase updates its hosting cache - commit just those and push, so GitHub
# matches what's live. Other uncommitted work is left alone. The site is
# already deployed at this point, so a git failure only warns.
trap - ERR
VERSION="$(node -p "require('./package.json').version")"
DEPLOY_FILES=(package.json src/assets/version.json .firebase/hosting.ZGlzdC9uZXR3b3JrL2Jyb3dzZXI.cache)
if git diff --quiet HEAD -- "${DEPLOY_FILES[@]}"; then
  echo "No version files changed; nothing to commit."
elif git commit --quiet -m "Deploy ${VERSION}" -- "${DEPLOY_FILES[@]}"; then
  echo "Committed Deploy ${VERSION}."
else
  echo "WARNING: could not commit the version files - commit them by hand." >&2
fi
if git push --quiet; then
  echo "Pushed to $(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')."
else
  echo "WARNING: push failed (remote ahead or offline?) - run git pull --rebase && git push." >&2
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Note: you still have uncommitted changes - the deploy included them, GitHub doesn't have them yet."
fi
