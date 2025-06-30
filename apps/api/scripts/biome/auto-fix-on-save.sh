#!/bin/bash

# Get the relative path of the file
RELATIVE_PATH=$(realpath --relative-to="$(pwd)" "$1")

# Run Biome in Docker
docker-compose exec scripts bun run biome check "/app/$RELATIVE_PATH"
