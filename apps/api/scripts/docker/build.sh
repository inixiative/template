#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

docker-compose build --pull --build-arg BUILDKIT_INLINE_CACHE=1 base
docker-compose up -d base >/dev/null 2>&1

CONTAINER_NAME=$(docker-compose ps -q base)

mkdir -p .tmp_node_modules
docker cp ${CONTAINER_NAME}:/app/node_modules .tmp_node_modules/ 2>/dev/null || true
rsync -a --delete .tmp_node_modules/node_modules/ node_modules/
rm -rf .tmp_node_modules

docker cp ${CONTAINER_NAME}:/app/bun.lock . 2>/dev/null || true
docker cp ${CONTAINER_NAME}:/app/bun.lockb . 2>/dev/null || true

docker-compose stop base >/dev/null 2>&1

echo "Build process completed successfully!"
