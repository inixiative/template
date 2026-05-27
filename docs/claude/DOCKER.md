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
services:
  postgres:
    image: postgres:18-alpine
    container_name: template-postgres
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: template
    volumes:
      - ./scripts/db/pg-init.sh:/docker-entrypoint-initdb.d/pg-init.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]

  redis:
    image: redis:7-alpine
    container_name: template-redis
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  minio:
    image: minio/minio:latest
    container_name: template-minio
    ports: ["9000:9000", "9001:9001"]   # 9000=S3 API, 9001=console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9000/minio/health/live"]

  mc-init:
    image: minio/mc:latest
    depends_on:
      minio: { condition: service_healthy }
    # Creates the 4 slot-0 buckets on every `docker compose up` (idempotent via --ignore-existing)
```

### Connection Strings

| Service | URL |
|---------|-----|
| Postgres | `postgres://postgres:postgres@localhost:5432/template` |
| Redis | `redis://localhost:6379` |
| MinIO S3 | `http://localhost:9000` (login: minioadmin / minioadmin) |
| MinIO console | `http://localhost:9001` |

### Storage buckets (slot 0 / main checkout)

The `mc-init` service auto-creates 4 buckets on every `docker compose up`:

| Bucket | Purpose |
|---|---|
| `template-system` | Platform assets (default avatars, email templates, branding) |
| `template-user` | Tenant-uploaded content |
| `template-system-test` | Test isolation — system bucket |
| `template-user-test` | Test isolation — user bucket |

Storage is **ephemeral** (no persistent volume on MinIO). `docker compose down && up` wipes all uploads and re-creates empty buckets. By design — file persistence in dev is rarely useful, and the reset story matters more than carrying state across restarts.

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
# View logs
docker logs -f template-postgres
docker logs -f template-redis

# Shell into container
docker exec -it template-postgres psql -U postgres -d template
docker exec -it template-redis redis-cli

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
