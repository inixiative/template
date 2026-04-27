#!/bin/bash
set -euo pipefail

# Railway should skip postinstall (runs explicit build commands after install)
if [ -n "${RAILWAY_ENVIRONMENT:-}" ]; then
  echo "Skipping postinstall generation in Railway"
  exit 0
fi

# Clean macOS / iCloud sync duplicates ("foo 2.ts") before regenerating
# so generators don't read or transform stale copies. Safe no-op elsewhere.
bash scripts/lint/check-finder-duplicates.sh

# Vercel and other CI environments need Prisma client generated
bun run generate:routes
bun --cwd packages/db db:generate
bun run generate:sdk
