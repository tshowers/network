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
