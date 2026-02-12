# Environments

## Contents

- [Overview](#overview)
- [Environment Detection](#environment-detection)
- [File-Based Environments](#file-based-environments)
- [Infisical (Cloud Environments)](#infisical-cloud-environments)
- [with-env Composition](#with-env-composition)
- [Adding Environment Variables](#adding-environment-variables)

---

## Environment Names

Canonical environment names used across all scripts, Doppler configs, and code:

```typescript
import { Environment } from '@template/shared/utils';

type Environment = 'local' | 'test' | 'dev' | 'staging' | 'sandbox' | 'prod';
```

| Env | Purpose | Secrets Source |
|-----|---------|----------------|
| `local` | Local development | `.env.local` files |
| `test` | Automated tests | `.env.test` files |
| `dev` | Shared development | Infisical `dev` environment |
| `staging` | Pre-production | Infisical `staging` environment |
| `sandbox` | Isolated testing | Infisical `sandbox` environment |
| `prod` | Production | Infisical `prod` environment |

**Always use these abbreviations** in scripts, commands, and config names. Never use `production`, `development`, or other variations.

### NODE_ENV Mapping

| Environment | NODE_ENV | Notes |
|-------------|----------|-------|
| `local` | development | Uses .env files |
| `test` | test | Uses .env files |
| `dev` | development | Uses Infisical |
| `staging` | development | Uses Infisical |
| `sandbox` | production | Prod-like, safe to test |
| `prod` | production | Uses Infisical |

### Branch Deployments

| Branch | Auto-deploys to |
|--------|-----------------|
| `develop` | dev |
| `main` | prod |

Staging and sandbox are manually triggered or PR-based.

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

## Infisical (Cloud Environments)

For `dev`, `staging`, `sandbox`, `prod` - secrets managed in Infisical.

### Environment Structure

Infisical uses a flat environment structure per project:

```
Project: your-app-name
├── dev (development environment)
├── staging (pre-production)
├── sandbox (isolated testing)
└── prod (production)
```

Each environment contains all secrets needed for that environment.

### Setup

Infisical is configured during project initialization:

```bash
bun run init  # Interactive setup (includes Infisical)
```

**Options:**
- **Infisical Cloud** (free tier: unlimited users, 5 projects)
- **Infisical Self-Hosted** (Docker, ~$5-10/mo VPS)
- **Manual .env** (opt-out, manage secrets yourself)

### Configuration File

After setup, `.infisical.json` is created:

```json
{
  "workspaceId": "project-id-here",
  "domain": "https://app.infisical.com"  // or http://localhost:8080 for self-hosted
}
```

### Manual Usage

```bash
# Run command with Infisical secrets
infisical run --env=dev -- bun run start

# Export secrets to file
infisical export --env=dev > .env.dev

# Set individual secret
infisical secrets set DATABASE_URL "postgres://..." --env=prod

# List secrets
infisical secrets list --env=dev
```

### CLI Authentication

Team members authenticate once:

```bash
infisical login  # Opens browser for OAuth
# or for self-hosted:
infisical login --domain=http://localhost:8080
```

Token is stored in `~/.config/infisical/config.json`

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
1. If cloud env (dev/staging/sandbox/prod):
   - Check if Infisical is configured (.infisical.json exists)
   - If yes: Run via infisical CLI (loads secrets from Infisical)
   - If no: Fallback to .env files
2. If local/test env:
   - Source root .env.$ENV (if exists)
   - Source app .env.$ENV (if exists, overrides root)
3. Execute command
```

### Loading Order

For `bun run with local api bun run local`:

```
1. Load /.env.local
2. Load /apps/api/.env.local (overrides)
3. Run: bun run local
```

For `bun run with prod api bun run start`:

```
1. If .infisical.json exists:
   → infisical run --env=prod -- bun run start
   (Infisical injects secrets, then runs command)
2. Else fallback to .env files:
   → Load /.env.prod (if exists)
   → Load /apps/api/.env.prod (if exists)
   → Run: bun run start
```

### Package.json Scripts

```json
{
  "with": "./scripts/deployment/with-env.sh",
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

1. Add to Infisical for each environment:
   ```bash
   # Add to specific environment
   infisical secrets set NEW_VAR "value" --env=dev
   infisical secrets set NEW_VAR "value" --env=staging
   infisical secrets set NEW_VAR "value" --env=prod

   # Or via web UI: https://app.infisical.com
   ```

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
