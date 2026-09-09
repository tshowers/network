#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "Running Network production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Network bundle..."
npm run build

echo "Deploying Network to Firebase Hosting site todd-network..."
firebase deploy --project taliferrotech --only hosting:todd-network

echo "Network hosting deploy complete."
firebase projects:list
