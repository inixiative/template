#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# Run the config through the actual TS module loader (see scripts/checkLaunched.ts).
# Stdout = 'true' / 'false'; non-zero exit = config failed to load (abort
# rather than silently fall through to a destructive db:push).
LAUNCHED="$(bun run "$ROOT_DIR/scripts/checkLaunched.ts")" || {
  echo "[release] failed to evaluate project.config.ts; aborting" >&2
  exit 1
}
if [ "$LAUNCHED" = "true" ]; then
  echo "[release] Project launched — applying migrations (prisma migrate deploy)"
  bun run --cwd packages/db prisma migrate deploy
else
  echo "[release] Project pre-launch — pushing schema (prisma db push --accept-data-loss)"
  bun run --cwd packages/db prisma db push --accept-data-loss
fi

# Idempotent seed: upserts non-prime entries (e.g. the platform admin user
# defined in user.seed.ts). NODE_ENV is supplied by the runtime — Railway
# sets NODE_ENV=production, which the seed runner uses to filter out any
# `prime: true` entries (dev fixtures stay out of prod). createOnly records
# (Account) skip on re-run so passwords aren't overwritten.
#
# Tolerant of seed errors: the runner looks up by id, then creates. If a
# row with the same unique key (e.g. User.email) already exists under a
# different id (signup created it before seed could), create() throws on
# the unique constraint. We don't want that to brick the entire deploy.
# Failures log; a follow-up pass needs to reconcile manually.
echo "[release] Seeding non-prime data"
bun run --cwd packages/db db:seed || echo "[release] WARN: seed had errors; deploy continues"
