#!/bin/bash
set -e

docker-compose up -d --wait

bun run with local api turbo watch local --filter=api &
bun run with local api turbo watch local:worker --filter=api &
bun run with local web turbo watch local --filter=web &
bun run with local admin turbo watch local --filter=admin &
bun run with local superadmin turbo watch local --filter=superadmin &

wait
