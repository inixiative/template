# Setup

> Stub - to be expanded

## Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [IDE Configuration](#ide-configuration)

---

## Prerequisites

- Bun (latest)
- Docker & Docker Compose
- Node.js 20+ (for some tooling)

```bash
# Check prerequisites
./scripts/setup/check-prereqs.sh
```

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

## Environment Variables

TODO: Document env var setup
- `.env.local`, `.env.test`, `.env.example`
- Doppler integration
- Required vs optional vars

See also: [ENVIRONMENTS.md](ENVIRONMENTS.md)

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

## IDE Configuration

TODO: Document IDE setup
- VS Code extensions
- Biome config
- TypeScript settings
