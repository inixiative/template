# Docker

<!-- toc:start -->

## Contents

- [Quick Start](#quick-start)
- [Services](#services)
  - [docker-compose.yml](#docker-composeyml)
  - [Connection Strings](#connection-strings)
- [Commands](#commands)
  - [Manual Docker Commands](#manual-docker-commands)
- [Configuration](#configuration)
  - [Postgres Initialization](#postgres-initialization)
  - [Volume Persistence](#volume-persistence)
- [Database Operations](#database-operations)
  - [Clone Remote to Local](#clone-remote-to-local)
  - [Dump Database](#dump-database)
  - [Restore from Dump](#restore-from-dump)
  - [Wait Scripts](#wait-scripts)
- [Troubleshooting](#troubleshooting)
  - [Port Already in Use](#port-already-in-use)
  - [Container Won't Start](#container-wont-start)
  - [Reset Everything](#reset-everything)

<!-- toc:end -->

Local development services via Docker Compose.


---

## Quick Start

```bash
# Start Postgres + Redis
bun run local:db

# Verify running
docker ps

# Stop
bun run stop:db
```

---

## Services

### docker-compose.yml

```yaml
# Pinned project name — every worktree's `docker-compose up` reuses the SAME
# shared containers + network instead of forking its own under a dir-derived
# project name (which would collide on `container_name:` and leak resources).
name: ${PROJECT_NAME:-template}

services:
  postgres:
    image: postgres:18-alpine
    container_name: ${PROJECT_NAME:-template}_postgres
    volumes:
      - ./scripts/db/pg-init.sh:/docker-entrypoint-initdb.d/pg-init.sh:ro
    # ... ports, env, healthcheck

  redis:
    image: redis:7-alpine
    container_name: ${PROJECT_NAME:-template}_redis
    # ... ports, healthcheck

  minio:
    image: minio/minio:latest
    container_name: ${PROJECT_NAME:-template}_minio
    environment:
      PROJECT: ${PROJECT_NAME:-template}
    volumes:
      - ./scripts/db/minio-init.sh:/usr/local/bin/minio-init.sh:ro
    entrypoint: ["/bin/sh", "/usr/local/bin/minio-init.sh"]
    # ... ports, env, healthcheck
```

Bucket bootstrap mirrors the pg-init pattern: `scripts/db/minio-init.sh` lives beside the postgres init script and is mounted into the minio container. Minio doesn't have a built-in init dir (unlike postgres's `/docker-entrypoint-initdb.d/`), so we override the entrypoint to call our script, which `mkdir`s the four bucket subdirs and then `exec`s `minio server`. In MinIO filesystem mode, subdirs of `/data` ARE buckets — so `mkdir -p` is idempotent and the equivalent of `CREATE DATABASE IF NOT EXISTS`.

> **Why pin the compose project name?** Without `name: …` at the top of docker-compose.yml, Compose derives the project from the working directory. A worktree at `.worktrees/feature-x/` would try to bring up its own `feature-x_default` network and collide with the main checkout's `container_name:`-pinned containers. Pinning lets `docker-compose up` from any worktree connect to the shared stack; isolation comes from per-slot DB names + bucket prefixes, not separate containers.

### Connection Strings

| Service | URL |
|---------|-----|
| Postgres | `postgres://postgres:postgres@localhost:5432/template` |
| Redis | `redis://localhost:6379` |
| MinIO S3 | `http://localhost:9000` (login: minioadmin / minioadmin) |
| MinIO console | `http://localhost:9001` |

### Storage buckets (slot 0 / main checkout)

`scripts/db/minio-init.sh` (run inside the minio container as the entrypoint) creates 4 buckets on every boot:

| Bucket | Purpose |
|---|---|
| `template-system` | Platform assets (default avatars, email templates, branding) |
| `template-user` | Tenant-uploaded content |
| `template-system-test` | Test isolation — system bucket |
| `template-user-test` | Test isolation — user bucket |

Worktree slots add their own buckets (`template-system-wt-<slot>`, etc.) via `scripts/worktree/create.sh`, which `mc mb`s them against the shared minio container after the worktree is provisioned.

Storage is **ephemeral** (no persistent volume on MinIO). `docker compose down && up` wipes all uploads and the entrypoint re-creates empty buckets on next boot. By design — file persistence in dev is rarely useful, and the reset story matters more than carrying state across restarts.

See `tickets/INFRA-011-railway-buckets.md` for the full adapter design and `docs/claude/ADAPTERS.md` for the adapter pattern.

---

## Commands

| Command | Action |
|---------|--------|
| `bun run local:db` | Start services (docker-compose up -d --wait) |
| `bun run stop:db` | Stop services (docker-compose down) |
| `bun run reset:db` | Full reset: down → up → db:push → db:seed |

### Manual Docker Commands

```bash
# View logs (container names are ${PROJECT_NAME:-template}_<service>)
docker logs -f ${PROJECT_NAME:-template}_postgres
docker logs -f ${PROJECT_NAME:-template}_redis

# Shell into container
docker exec -it ${PROJECT_NAME:-template}_postgres psql -U postgres -d template
docker exec -it ${PROJECT_NAME:-template}_redis redis-cli

# Restart single service
docker-compose restart postgres
```

---

## Configuration

### Postgres Initialization

`scripts/db/pg-init.sh` runs on first container creation:

```bash
#!/bin/bash
# Create test database for running tests
psql -U postgres -d template -c 'CREATE DATABASE "template_test";'
```

### Volume Persistence

By default, data is **not persisted** between `docker-compose down` runs. To persist:

```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Database Operations

### Clone Remote to Local

```bash
bun run db:clone
```

Dumps remote database and restores to local Docker Postgres.

### Dump Database

```bash
bun run db:dump         # Dumps prod (default)
bun run db:dump dev     # Dumps dev environment
```

Creates `./tmp/db_dump/{env}.dump`.

### Restore from Dump

```bash
bun run db:restore      # Restores from prod dump
bun run db:restore dev  # Restores from dev dump
```

Restores to local Docker Postgres using `.env.local` credentials.

### Wait Scripts

For CI/startup sequencing:

```bash
./scripts/db/wait-postgres.sh  # Wait for Postgres ready
./scripts/db/wait-redis.sh     # Wait for Redis ready
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :5432
lsof -i :6379

# Kill existing process or change port in docker-compose.yml
```

### Container Won't Start

```bash
# Remove existing container and volume
docker-compose down -v
docker-compose up -d
```

### Reset Everything

```bash
bun run reset:db  # Recommended

# Or manually
docker-compose down -v
docker-compose up -d --wait
bun run db:push
bun run db:seed
```
