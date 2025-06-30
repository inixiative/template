#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define your project name
PROJECT_NAME=$(basename "$(pwd)")

echo "Stopping and removing containers for $PROJECT_NAME..."
docker-compose down

echo "Removing project-specific volumes..."
docker volume ls -q -f name=$PROJECT_NAME | xargs -r docker volume rm

echo "Running the setup script..."
bun run setup

echo "Reset completed successfully!"
