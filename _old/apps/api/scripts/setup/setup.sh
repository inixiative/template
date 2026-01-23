#!/bin/bash
set -e

# Build the Docker image
echo "Building Docker image..."
bun run docker:build

# Create and start database and scripts containers
echo "Starting database and scripts containers..."
docker-compose up -d postgres scripts

# Generate Prisma client
echo "Generating Prisma client..."
bun run db:generate

# Apply migrations
echo "Applying database migrations..."
bun run db:deploy

echo "Setup completed successfully!"
