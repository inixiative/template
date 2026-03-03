#!/bin/bash
set -e

# Suppress Turbo update notifications
export TURBO_TELEMETRY_DISABLED=1

echo "🚀 Starting local development environment..."

docker-compose up -d --wait

bun run with local api turbo watch local --filter=api --ui=stream &
bun run with local api turbo watch local:worker --filter=api --ui=stream &
bun run with local web turbo watch local --filter=web --ui=stream &
bun run with local admin turbo watch local --filter=admin --ui=stream &
bun run with local superadmin turbo watch local --filter=superadmin --ui=stream &

wait
