# Claude Development Guide

**Template** - Monorepo with Bun, Hono, Prisma 7, React, Tailwind.

## Before Starting Any Task

**Read the relevant doc first.** The docs contain patterns, conventions, and utilities that prevent reinventing the wheel or breaking established patterns.

1. Identify which category your task falls into
2. Read the relevant doc(s) from the table below
3. Then proceed with implementation

## Categories

### Implementation

| Category | Doc | When to Read |
|----------|-----|--------------|
| **API Routes** | [API_ROUTES.md](docs/claude/API_ROUTES.md) | Adding endpoints, controllers, route templates |
| **Auth** | [AUTH.md](docs/claude/AUTH.md) | BetterAuth, tokens, session vs token auth |
| **Communications** | [COMMUNICATIONS.md](docs/claude/COMMUNICATIONS.md) | Email, notifications (stub) |
| **Context** | [CONTEXT.md](docs/claude/CONTEXT.md) | Request context, AppEnv, getters, scopes |
| **Database** | [DATABASE.md](docs/claude/DATABASE.md) | Schema changes, Prisma patterns, model utilities |
| **Hooks** | [HOOKS.md](docs/claude/HOOKS.md) | Mutation lifecycle, validation, webhooks, cache |
| **Jobs** | [JOBS.md](docs/claude/JOBS.md) | Background jobs, crons, BullMQ |
| **Logging** | [LOGGING.md](docs/claude/LOGGING.md) | Consola, scopes, OpenTelemetry, Sentry |
| **Permissions** | [PERMISSIONS.md](docs/claude/PERMISSIONS.md) | Roles, permix, entitlements, validation |
| **Redis** | [REDIS.md](docs/claude/REDIS.md) | Connections, namespaces, caching, testing |
| **Testing** | [TESTING.md](docs/claude/TESTING.md) | Writing tests, factories, test utilities |

### Project Structure

| Category | Doc | When to Read |
|----------|-----|--------------|
| **Monorepo** | [MONOREPO.md](docs/claude/MONOREPO.md) | Workspaces, where to find things |
| **Naming** | [NAMING.md](docs/claude/NAMING.md) | File/function naming, FE/BE conventions |
| **Style** | [STYLE.md](docs/claude/STYLE.md) | Code conventions, imports |
| **Dependencies** | [DEPENDENCIES.md](docs/claude/DEPENDENCIES.md) | Packages, optional integrations |

### Operations

| Category | Doc | When to Read |
|----------|-----|--------------|
| **Setup** | [SETUP.md](docs/claude/SETUP.md) | Initial project setup (stub) |
| **Developer** | [DEVELOPER.md](docs/claude/DEVELOPER.md) | Daily workflow, debugging (stub) |
| **Docker** | [DOCKER.md](docs/claude/DOCKER.md) | Local Postgres/Redis, docker-compose |
| **Scripts** | [SCRIPTS.md](docs/claude/SCRIPTS.md) | Commands, script locations |
| **Environments** | [ENVIRONMENTS.md](docs/claude/ENVIRONMENTS.md) | Env vars, Doppler, with-env composition |
| **CI/CD** | [CICD.md](docs/claude/CICD.md) | Pipelines, deployment (stub) |
| **Documentation** | [DOCUMENTATION.md](docs/claude/DOCUMENTATION.md) | Doc workflow, RAW_NOTES → sorted docs |

### Incomplete Features

| Category | Doc | Status |
|----------|-----|--------|
| **App Events** | [APP_EVENTS.md](docs/claude/APP_EVENTS.md) | Feature incomplete |

## Quick Reference

```bash
cd packages/db && bun run db:generate   # Generate Prisma
cd apps/api && bun run dev              # Run API
cd apps/api && bun test                 # Run tests
```

## Path Aliases

- `#/` - Internal imports (same app/package)
- `@template/*` - Cross-package imports

## Reference Repos

- `~/UserEvidenceZealot/repositories/Zealot-Monorepo`
- `~/Carde.io/organized-play-api`
