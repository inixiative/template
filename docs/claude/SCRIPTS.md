# Scripts & Commands

## Contents

- [Script Locations](#script-locations)
- [Development](#development)
- [Database](#database)
- [Testing](#testing)
- [Linting](#linting)
- [Setup Scripts](#setup-scripts)
- [Deployment Scripts](#deployment-scripts)
- [Docker](#docker)

---

## Script Locations

| Directory | Purpose | Committed |
|-----------|---------|-----------|
| `scripts/` | Shared shell scripts, deployment, db ops | Yes |
| `scripts/setup/` | Project initialization, env sync | Yes |
| `scripts/db/` | Postgres/Redis operations | Yes |
| `scripts/deployment/` | Deploy, env injection | Yes |
| `tmp/` | Temporary files, AI workspace, local experiments | No (.gitignore) |

### scripts/ Structure

```
scripts/
├── setup/
│   ├── check-prereqs.sh    # Verify bun, docker, etc.
│   ├── setup.sh            # Full project setup
│   ├── sync-env.sh         # Sync .env from examples
│   ├── init.sh             # Initialize from template
│   └── doppler-setup.ts    # Doppler secrets setup
├── db/
│   ├── dump.sh             # Export database
│   ├── restore.sh          # Import database
│   ├── clone.sh            # Clone remote → local
│   ├── pg-init.sh          # Postgres initialization
│   ├── wait-postgres.sh    # Wait for postgres ready
│   └── wait-redis.sh       # Wait for redis ready
└── deployment/
    ├── deploy.sh           # Deploy to environment
    ├── with-env.sh         # Run command with env vars
    ├── doppler-env.sh      # Load from Doppler
    └── wait-for-api.sh     # Health check wait
```

---

## Development

From root `package.json`:

```bash
# Run all local services (api, web, worker, db)
bun run local

# Run individual services
bun run local:api       # API server with hot reload
bun run local:web       # Web app dev server
bun run local:worker    # Background job worker
bun run local:admin     # Admin dashboard
bun run local:superadmin

# Just the API (shorthand)
bun run dev             # → bun run --filter=api dev

# Start database containers
bun run local:db        # docker-compose up -d --wait
```

From `apps/api/package.json`:

```bash
cd apps/api
bun run dev             # --watch src/index.ts
bun run start           # Production start
bun run build           # Build to dist/
```

---

## Database

```bash
# Schema operations (proxied to @template/db)
bun run db:generate     # Generate Prisma client
bun run db:push         # Push schema (dev only)
bun run db:migrate      # Create migration
bun run db:deploy       # Run migrations (production)
bun run db:studio       # Open Prisma Studio
bun run db:seed         # Seed database

# Database operations (scripts/db/)
bun run db:dump         # Export to file
bun run db:restore      # Import from file
bun run db:clone        # Clone remote → local

# Reset (down + up + push + seed)
bun run reset:db
```

---

## Testing

```bash
# Run all workspace tests
bun test                # → bun run '--filter=*' test

# Run specific workspace
bun run --filter=api test
bun run --filter=@template/db test
```

From `apps/api`:

```bash
cd apps/api
bun test                # Uses with-env.sh to inject .env.test
bun test src/modules/user  # Run specific tests
```

---

## Linting

```bash
# Check all (biome)
bun run lint

# Fix all
bun run lint:fix

# Format only
bun run format
```

From `apps/api`:

```bash
cd apps/api
bun run lint            # Check src/ only
bun run lint:fix
```

---

## Setup Scripts

```bash
# Full project setup
bun run setup           # → scripts/setup/setup.sh

# Sync env files from examples
bun run sync-env        # → scripts/setup/sync-env.sh

# Setup Doppler secrets
bun run setup:doppler   # → scripts/setup/doppler-setup.ts
```

---

## Deployment Scripts

```bash
# Deploy to environment
bun run deploy          # → scripts/deployment/deploy.sh

# Run command with specific environment
bun run with <env> <app> <command>

# Examples:
bun run with local api bun run dev
bun run with test api bun test
bun run with production api bun run start
```

The `with-env.sh` script:
1. Loads environment-specific `.env` file
2. Optionally loads from Doppler
3. Executes the command with those vars

---

## Docker

```bash
# Start Postgres + Redis
bun run local:db        # docker-compose up -d --wait
bun run start:db        # Same as local:db

# Stop containers
bun run stop:db         # docker-compose down

# Full reset
bun run reset:db        # down + up + push + seed
```

---

## Writing New Scripts

**Shell scripts**: Place in `scripts/<category>/`, make executable (`chmod +x`).

**TypeScript scripts**: Can use `bun run scripts/path/to/script.ts` directly.

**Temporary/experimental**: Use `tmp/` directory (gitignored).
