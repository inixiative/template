# Setup

## Contents

- [Prerequisites](#prerequisites)
- [Init vs Setup](#init-vs-setup)
- [Quick Start](#quick-start)
- [What Setup Does](#what-setup-does)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Forking This Template](#forking-this-template)

---

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

# fswatch (for HMR watch scripts)
brew install fswatch
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

---

## Init vs Setup

| Command | When | Who |
|---------|------|-----|
| `bun run init` | Once per project lifecycle | Person forking the template |
| `bun run setup` | Each new developer + periodically | Everyone |

**Init** (TODO): Renames packages, updates configs, prepares the template for a new project. Run once when forking.

**Setup**: Installs deps, starts Docker, generates Prisma, seeds DB. Run by each developer and whenever the repo needs to be brought up to date.

---

## Quick Start

```bash
# Clone and setup
git clone <repo>
cd template
bun run setup

# Start everything
bun run local
```

---

## What Setup Does

`bun run setup` runs:

1. Check prerequisites
2. Sync environment files
3. Install dependencies
4. Start Docker (Postgres, Redis)
5. Generate Prisma client
6. Push database schema
7. Seed database

---

## Environment Variables

Local files (not committed):
- `.env.local` - local development
- `.env.test` - test runner

Create from examples:
```bash
bun run sync-env
```

See [ENVIRONMENTS.md](ENVIRONMENTS.md) for full environment configuration.

---

## Database Setup

```bash
# Start Postgres + Redis
bun run local:db

# Push schema
bun run db:push

# Seed data
bun run db:seed
```

---

## Forking This Template

When creating a new project from this template:

1. Update package names from `@template/*` to `@yourproject/*`
2. Add your app-specific models to `packages/db/prisma/schema/`
3. Update typed model IDs in `packages/db/src/typedModelIds.ts`
4. Update CLAUDE.md with project-specific context
5. Update reference repos if you have similar production codebases
