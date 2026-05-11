#!/bin/bash
# ============================================================================
# STUB / SCAFFOLD — NOT WIRED UP YET
# ============================================================================
# Skeleton for a future per-env build+migrate+deploy entrypoint. Real deploys
# go through the platforms' own CI (Vercel for web apps, Railway/Fly/etc for
# api workers), not this script. Treat the body below as a template for what
# a unified deploy command might do, not as the real path.
#
# Fork-side: fill in actual deployment commands at the bottom marked `TODO:`
# before relying on this for anything.
# ============================================================================
set -e

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <env>"
    echo "Envs: dev, staging, sandbox, prod"
    exit 1
fi
ENV="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
cd "$ROOT_DIR"

echo "Building..."
bun install
bun run db:generate
bun run --filter=api build
bun run --filter=web build

echo "Migrating..."
"$SCRIPT_DIR/with-env.sh" "$ENV" api bun run db:deploy

echo "Deploying $ENV..."
# Add your deployment commands here:
# - Render: render deploy
# - Railway: railway up
# - Fly.io: fly deploy
# - Vercel: vercel --prod
echo "TODO: Add deployment commands"
