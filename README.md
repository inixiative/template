# Template

TypeScript monorepo with Bun, Hono, Prisma 7, React, and Tailwind.

## Read This First

**[Developer Guide](./docs/claude/DEVELOPER.md)** - Prerequisites, tools, and setup instructions

## Quick Start

```bash
bun run setup
bun run local
```

## Features

See [FEATURES.md](./FEATURES.md) for the complete feature catalog — what's built, what's in progress, and what's planned.

If you're evaluating the template or wondering how it stacks up against managed services and open-source alternatives, [COMPARISONS.md](./COMPARISONS.md) breaks down each system side-by-side and explains what gaps it fills that nothing off-the-shelf covers.

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
