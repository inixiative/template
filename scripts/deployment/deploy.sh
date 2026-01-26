#!/bin/bash
set -e

ENV=${1:-dev}

if [ -z "$1" ]; then
    echo "Usage: $0 <env>"
    echo "Envs: dev, staging, sandbox, prod"
    exit 1
fi

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
