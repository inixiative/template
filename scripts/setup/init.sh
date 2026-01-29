#!/usr/bin/env bash
# Initialize a new project from template
# Usage: ./scripts/setup/init.sh <project-name>

set -e

PROJECT_NAME="${1:-}"

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: ./scripts/setup/init.sh <project-name>"
  exit 1
fi

echo "Initializing project: $PROJECT_NAME"

# TODO: Rename packages @template/* → @${PROJECT_NAME}/*
# - package.json files
# - imports throughout codebase

# TODO: Generate secrets
# - BETTER_AUTH_SECRET (openssl rand -base64 32)
# - WEBHOOK_SIGNING_KEYS (RSA keypair)

# TODO: Create .env files from examples
# - .env.local from .env.local.example
# - apps/api/.env.local from apps/api/.env.local.example
# - etc.

# TODO: Database setup
# - Create database
# - Run prisma db push
# - Run prisma generate

# TODO: Update CLAUDE.md
# - Replace "Template" with project name
# - Update any project-specific context

echo "TODO: Implementation pending"
echo "See scripts/setup/init.sh for planned steps"
