# Template

TypeScript monorepo with Bun, Hono, Prisma 7, React, and Tailwind.

## Read This First

**[Developer Guide](./docs/claude/DEVELOPER.md)** - Prerequisites, tools, and setup instructions

## Quick Start

```bash
bun run setup
bun run local
```

## Documentation

- [Developer Guide](docs/claude/DEVELOPER.md) - Setup and tools
- [Environments](docs/claude/ENVIRONMENTS.md) - Environment configuration
- [Architecture](docs/claude/ARCHITECTURE.md) - Project structure
- [Database](docs/claude/DATABASE.md) - Prisma and migrations
- [API Patterns](docs/claude/API_ROUTES.md) - Routes, controllers, schemas
- [Auth](docs/claude/AUTH.md) - Authentication
- [Testing](docs/claude/TESTING.md) - Test setup
- [Deployment](docs/claude/CICD.md) - CI/CD

## Script Maturity

- Stable scripts live in `scripts/setup`, `scripts/deployment`, and `scripts/db`.
- Experimental scripts live in `scripts/scratch` and must not be wired into CI or root package scripts.
- Development watch mode is handled by Turborepo (see [TURBOREPO.md](docs/claude/TURBOREPO.md)).
