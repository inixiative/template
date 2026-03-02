#!/bin/bash
set -euo pipefail

# Railpack/CI install should not run template generation during dependency install.
# API deploys run explicit build commands after install.
if [ "${CI:-}" = "true" ] || [ -n "${RAILWAY_ENVIRONMENT:-}" ]; then
  echo "Skipping postinstall generation in CI/Railway"
  exit 0
fi

bun run generate:routes
bun run generate:sdk
