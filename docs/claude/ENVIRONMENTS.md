# Environments

## Contents

- [Overview](#overview)
- [Environment Detection](#environment-detection)
- [File-Based Environments](#file-based-environments)
- [Doppler (Cloud Environments)](#doppler-cloud-environments)
- [with-env Composition](#with-env-composition)
- [Adding Environment Variables](#adding-environment-variables)

---

## Overview

| Environment | Purpose | Secrets Source |
|-------------|---------|----------------|
| `local` | Development | `.env.local` files |
| `test` | Automated tests | `.env.test` files |
| `dev` | Shared development | Doppler `dev_*` |
| `staging` | Pre-production | Doppler `staging_*` |
| `sandbox` | Isolated testing | Doppler `sandbox_*` |
| `prod` | Production | Doppler `prod_*` |

---

## Environment Detection

```typescript
import { isTest, isLocal, isDev, isProd } from '@template/shared/utils';

// Set via ENVIRONMENT env var
export const isTest = process.env.ENVIRONMENT === 'test';
export const isLocal = process.env.ENVIRONMENT === 'local';
export const isDev = process.env.ENVIRONMENT === 'develop';
export const isProd = process.env.ENVIRONMENT === 'production';
```

---

## File-Based Environments

For `local` and `test` environments, secrets come from `.env` files.

### File Structure

```
/                           # Root (shared across apps)
├── .env.local              # Local dev secrets
├── .env.local.example      # Template
├── .env.test               # Test secrets
├── .env.test.example       # Template
└── apps/api/               # App-specific overrides
    ├── .env.local          # API-specific local overrides
    └── .env.test           # API-specific test overrides
```

### Inheritance Order

When running `bun run with local api <command>`:

1. Root `.env.local` loaded first
2. App `apps/api/.env.local` loaded second (overrides root)

```bash
# Root .env.local
DATABASE_URL=postgres://localhost:5432/template
LOG_LEVEL=info

# apps/api/.env.local
LOG_LEVEL=debug  # Overrides root
API_SECRET=xxx   # App-specific
```

### Sync from Examples

```bash
bun run sync-env  # Copies .env.*.example → .env.* (won't overwrite)
```

---

## Doppler (Cloud Environments)

For `dev`, `staging`, `sandbox`, `prod` - secrets managed in Doppler.

### Config Naming

Doppler configs follow pattern: `{env}_{app}`

| Environment | API Config | Web Config |
|-------------|------------|------------|
| dev | `dev_api` | `dev_web` |
| staging | `staging_api` | `staging_web` |
| prod | `prod_api` | `prod_web` |

### Inheritance in Doppler

Doppler supports config inheritance:

```
root (base secrets)
├── dev (inherits root, overrides for dev)
│   ├── dev_api (inherits dev, API-specific)
│   └── dev_web (inherits dev, web-specific)
├── staging (inherits root)
│   ├── staging_api
│   └── staging_web
└── prod (inherits root)
    ├── prod_api
    └── prod_web
```

Secrets cascade: `root` → `{env}` → `{env}_{app}`

### Setup

```bash
bun run setup:doppler  # Interactive Doppler setup
```

### Manual Usage

```bash
# Run command with Doppler secrets
doppler run --config dev_api -- bun run start

# Download secrets to file
doppler secrets download --config dev_api --no-file --format env
```

---

## with-env Composition

The `with-env.sh` script handles environment composition for all commands.

### Usage

```bash
bun run with <env> <app> <command>

# Examples
bun run with local api bun run dev
bun run with test api bun test
bun run with prod api bun run start
```

### How It Works

```bash
# scripts/deployment/with-env.sh
1. If cloud env (dev/staging/prod): Load from Doppler
2. Source root .env.$ENV (if exists)
3. Source app .env.$ENV (if exists, overrides root)
4. Execute command
```

### Loading Order

For `bun run with local api bun run dev`:

```
1. [Skip Doppler - local env]
2. Load /.env.local
3. Load /apps/api/.env.local (overrides)
4. Run: bun run dev
```

For `bun run with prod api bun run start`:

```
1. Load Doppler config: prod_api
2. Load /.env.prod (if exists, overrides Doppler)
3. Load /apps/api/.env.prod (if exists, overrides)
4. Run: bun run start
```

### Package.json Scripts

```json
{
  "local:api": "bun run with local api bun --cwd apps/api dev",
  "test": "bun run with test api bun test"
}
```

---

## Adding Environment Variables

### Local Development

1. Add to `.env.local.example` (for others to see)
2. Add to your `.env.local`
3. Run `bun run sync-env` on other machines

### Cloud Environments

1. Add to Doppler at appropriate inheritance level:
   - All envs: Add to `root`
   - Env-specific: Add to `dev`, `staging`, or `prod`
   - App-specific: Add to `dev_api`, `prod_web`, etc.

### In Code

```typescript
// Access via process.env
const apiKey = process.env.API_KEY;

// Type-safe with validation (recommended)
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  API_KEY: z.string(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);
```

---

## Common Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ENVIRONMENT` | Environment name | Yes |
| `DATABASE_URL` | Postgres connection | Yes |
| `REDIS_URL` | Redis connection | Yes |
| `PORT` | API port | Default: 8000 |
| `LOG_LEVEL` | Logging verbosity | Default: info |
| `SENTRY_DSN` | Sentry error tracking | Optional |
| `SENTRY_ENABLED` | Enable Sentry | Optional |
| `OTEL_ENABLED` | Enable OpenTelemetry | Optional |
