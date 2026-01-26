# Environments

## Overview

| Environment | Code | NODE_ENV | Purpose |
|-------------|------|----------|---------|
| Local | `local` | development | Local development |
| Test | `test` | test | Automated tests |
| Dev | `dev` | development | Deployed development |
| Staging | `staging` | development | Pre-release testing |
| Sandbox | `sandbox` | production | Production-like testing |
| Production | `prod` | production | Live |

## Usage

```bash
# Run command with environment
bun run with <env> <app> <command>

# Examples
bun run with local api bun run dev
bun run with prod api bun run start

# Database operations
bun run db:dump prod
bun run db:clone dev
```

## Environment Files

Local files (not committed):
- `.env.local` - local development
- `.env.test` - test runner

Create from examples:
```bash
bun run sync-env
```

## Doppler

Doppler manages secrets for deployed environments.

### Config Structure

**Root configs:** `dev`, `staging`, `sandbox`, `prod`

**App configs:** `{env}_{app}`
```
dev_api, dev_web, dev_admin, dev_superadmin
staging_api, staging_web, staging_admin, staging_superadmin
sandbox_api, sandbox_web, sandbox_admin, sandbox_superadmin
prod_api, prod_web, prod_admin, prod_superadmin
```

### Setup

1. Install Doppler CLI: https://docs.doppler.com/docs/install-cli
2. Login: `doppler login`
3. Setup project: `doppler setup`
4. Create configs for each env/app combination

### How it works

`with-env.sh` loads environment in this order:
1. Doppler config `{env}_{app}` (if available)
2. Root `.env.<env>` file (if exists)
3. App `.env.<env>` file (if exists)

For `local` and `test`, Doppler is skipped - only local files are used.

## NODE_ENV Mapping

| Code | NODE_ENV | Doppler | Notes |
|------|----------|---------|-------|
| `local` | development | - | No Doppler, uses .env.local |
| `test` | test | - | No Doppler, uses .env.test |
| `dev` | development | dev | |
| `staging` | development | staging | |
| `sandbox` | production | sandbox | Prod-like, but safe to test |
| `prod` | production | prod | |

## Branch → Environment

| Branch | Auto-deploys to |
|--------|-----------------|
| `develop` | dev |
| `main` | prod |

Staging and sandbox are manually triggered or PR-based.
