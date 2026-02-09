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
- [AI Workspace](#ai-workspace)

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
│   └── dopplerSetup.ts     # Doppler secrets setup
├── db/
│   ├── dump.sh             # Export database
│   ├── restore.sh          # Import database
│   ├── clone.sh            # Clone remote → local (with webhook cleanup)
│   ├── pg-init.sh          # Postgres initialization
│   ├── wait-postgres.sh    # Wait for postgres ready
│   └── wait-redis.sh       # Wait for redis ready
└── deployment/
    ├── deploy.sh           # Deploy to environment
    ├── with-env.sh         # Run command with env vars
    ├── doppler-env.sh      # Load from Doppler
    └── wait-for-api.sh     # Health check wait

Database utilities (packages/db/prisma/):
├── seed.ts                       # Seed script with UUID validation
└── truncateWebhookSubscriptions.ts  # Clear webhooks (local/test only)
```

---

## Development

From root `package.json`:

```bash
# Run all local services (api, web, worker, db)
bun run local

# Run specific services with Turborepo filtering
turbo watch local#api
turbo watch local#web
turbo watch local#admin
turbo watch local#superadmin
turbo watch local:worker#api

# Start database containers
bun run local:db        # docker-compose up -d --wait
```

**Development (from root):**
```bash
bun run local                              # All services with Turborepo watching
turbo watch local#api                      # Just API with hot reload
turbo watch local:worker#api               # Just worker with hot reload
bun run with prod api turbo watch local#api # API with prod env
```

**Production (from root):**
```bash
bun run start:api                          # Start API server
bun run start:worker                       # Start background worker
bun run start:web                          # Start web preview
```

**Direct execution (from apps/api):**
```bash
cd apps/api
bun run local           # bun --hot src/index.ts (API with hot reload)
bun run local:worker    # bun --hot src/jobs/worker.ts (worker with hot reload)
bun run start           # Production API
bun run start:worker    # Production worker
bun run build           # Build to dist/
```

**Note:** Direct execution only watches files within that app. For workspace dependency watching, use Turborepo commands from root.

---

## Database

```bash
# Schema operations (proxied to @template/db)
bun run db:generate          # Generate Prisma client
bun run db:push              # Push schema (dev only)
bun run db:migrate           # Create migration
bun run db:deploy            # Run migrations (production)
bun run db:studio            # Open Prisma Studio
bun run db:seed              # Seed database
bun run db:seed --prime      # Include prime dev data

# Database operations (scripts/db/)
bun run db:dump              # Export to file
bun run db:restore           # Import from file
bun run db:clone [env]       # Clone remote → local (auto-truncates webhooks)
bun run db:truncate:webhooks # Clear webhook subscriptions (local/test only)

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
bun run setup:doppler   # → scripts/setup/dopplerSetup.ts
```

---

## Deployment Scripts

```bash
# Deploy to environment
bun run deploy          # → scripts/deployment/deploy.sh

# Run command with specific environment
bun run with <env> <app> <command>

# Examples:
bun run with local api bun run local
bun run with test api bun test
bun run with prod api bun run start
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

---

## AI Workspace

`tmp/AI_WORKSPACE/` is a gitignored staging area for async/overnight AI work.

```
AI_WORKSPACE/
├── {task-name}/
│   ├── TASK.md          # Task description, status, notes
│   ├── files/           # Files mirroring repo structure
│   └── notes/           # Research, drafts, experiments
```

### Workflow

1. Create task folder with TASK.md describing the work
2. AI works on files in `files/` directory (mirrors repo structure)
3. User reviews and copies approved files to repo
4. Delete task folder when done

Use this for larger changes, experiments, or work that needs review before committing.
