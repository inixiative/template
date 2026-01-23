#!/bin/bash

set -e

if [ $# -eq 0 ]; then
  echo "Usage: $0 <command> [packages...]"
  exit 1
fi

command=$1
shift

docker-compose up -d base  >/dev/null 2>&1
docker-compose exec base bun "$command" "$@"

CONTAINER_NAME=$(docker-compose ps -q base)

mkdir -p .tmp_node_modules
docker cp ${CONTAINER_NAME}:/app/node_modules .tmp_node_modules/ 2>/dev/null || true
rsync -a --delete .tmp_node_modules/node_modules/ node_modules/
rm -rf .tmp_node_modules

# Generate Prisma client after node_modules sync
bun prisma generate --schema=./src/db/prisma

docker cp ${CONTAINER_NAME}:/app/package.json . 2>/dev/null
docker cp ${CONTAINER_NAME}:/app/bun.lock . 2>/dev/null || true
docker cp ${CONTAINER_NAME}:/app/bun.lockb . 2>/dev/null || true

# Stop container
docker-compose stop base >/dev/null 2>&1

echo "✓ Done"
