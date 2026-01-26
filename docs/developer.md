# Developer Guide

## Prerequisites

### Required

- **Bun** - [Install](https://bun.sh)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)

### CLI Tools

```bash
# Homebrew (macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# GitHub CLI
brew install gh

# Doppler CLI (secrets management)
brew install dopplerhq/cli/doppler
```

### Authentication

```bash
gh auth login
doppler login
```

### Verification

```bash
bun --version
docker --version
gh --version
doppler --version
```

## Setup

```bash
bun run setup
```

This runs:
1. Check prerequisites
2. Sync environment files
3. Install dependencies
4. Start Docker (Postgres, Redis)
5. Generate Prisma client
6. Push database schema
7. Seed database

## Development

```bash
# Start everything
bun run local

# Individual services
bun run local:api     # API on :8000
bun run local:web     # Web on :3000
bun run local:worker  # Background jobs
```

## Common Commands

```bash
# Database
bun run db:studio     # Prisma Studio
bun run db:generate   # Generate client
bun run db:push       # Push schema
bun run db:migrate    # Create migration
bun run reset:db      # Reset and reseed

# Code quality
bun run lint          # Check
bun run lint:fix      # Fix
bun run format        # Format
bun run test          # Run tests

# Environment
bun run sync-env      # Sync .env files
```

## Project Structure

```
├── apps/
│   ├── api/          # Hono API server
│   └── web/          # React frontend
├── packages/
│   └── db/           # Prisma schema and client
├── scripts/
│   ├── setup/        # Setup scripts
│   ├── db/           # Database scripts
│   └── deployment/   # Deploy scripts
└── docs/             # Documentation
```

## Next Steps

- [Environments](environments.md) - Configure environments and Doppler
- [Architecture](architecture.md) - Understand the codebase
- [API Patterns](api-patterns.md) - Build API endpoints
