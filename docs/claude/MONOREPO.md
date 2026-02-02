# Monorepo Structure

## Contents

- [Overview](#overview)
- [Workspaces](#workspaces)
- [Path Aliases](#path-aliases)
- [Dependencies](#dependencies)
- [Where to Find Things](#where-to-find-things)

---

## Overview

Bun workspaces monorepo with apps and shared packages.

```
template/
├── apps/
│   ├── api/           # Hono API server
│   ├── web/           # React frontend
│   ├── admin/         # Admin dashboard
│   └── superadmin/    # Superadmin tools
├── packages/
│   ├── db/            # Prisma client, hooks, extensions, Redis
│   ├── shared/        # Shared utilities, logger
│   ├── permissions/   # RBAC system
│   ├── email/         # Email templates, MJML rendering
│   └── ui/            # Shared UI components
├── tests/             # Cross-app testing (E2E, load)
│   ├── e2e/           # Playwright tests
│   └── load/          # Artillery load tests
├── scripts/           # Shell scripts
├── docs/              # Documentation
└── tmp/               # Temporary files (gitignored)
```

---

## Workspaces

Defined in root `package.json`:

```json
{
  "workspaces": ["packages/*", "apps/*"]
}
```

### Package Names

| Workspace | Package Name |
|-----------|--------------|
| `packages/db` | `@template/db` |
| `packages/shared` | `@template/shared` |
| `packages/permissions` | `@template/permissions` |
| `packages/email` | `@template/email` |
| `packages/ui` | `@template/ui` |
| `apps/api` | `api` |
| `apps/web` | `web` |
| `apps/admin` | `admin` |
| `apps/superadmin` | `superadmin` |

---

## Path Aliases

| Context | Alias | Example |
|---------|-------|---------|
| Within an app | `#/` | `import { getUser } from '#/lib/context/getUser'` |
| Shared packages | `@template/` | `import { db } from '@template/db'` |
| Within a shared package | `@template/` | `import { log } from '@template/shared/logger'` |
| Top-level barrel exports | Relative | `export { foo } from './foo'` |

### App Imports (`#/`)

```typescript
// In apps/api - use #/ for internal imports
import { getUser } from '#/lib/context/getUser';
import { authMiddleware } from '#/middleware/auth/authMiddleware';
```

### Package Imports (`@template/`)

```typescript
// Cross-package (from anywhere)
import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { setupOrgContext } from '@template/permissions';

// Within a shared package - ALSO use @template/
// packages/db/src/extensions/mutationLifeCycle.ts
import { log } from '@template/shared/logger';  // Not '../../../shared/...'
```

### Barrel Files (Relative)

Top-level `index.ts` files are the public API - they make exports accessible outside the package. These use relative imports:

```typescript
// packages/shared/src/logger/index.ts - public API for @template/shared/logger
export { log } from './logger';
export { logScope } from './scope';
```

Actual code files always use aliases.

---

## Dependencies

### Dependency Direction

```
apps/api
  └── @template/db
  └── @template/shared
  └── @template/permissions
  │     └── @template/db
  │     └── @template/shared
  └── @template/email
        └── @template/db
        └── @template/shared

apps/web
  └── @template/shared
  └── @template/ui
```

### Adding Dependencies

```bash
# Add to specific workspace
cd packages/shared && bun add <package>

# Add to root (dev tooling)
bun add -d <package>
```

---

## Where to Find Things

| Looking For | Location |
|-------------|----------|
| API routes | `apps/api/src/modules/<model>/routes/` |
| Database hooks | `apps/api/src/modules/<model>/hooks/` |
| Background jobs | `apps/api/src/modules/<model>/jobs/` or `apps/api/src/jobs/` |
| Prisma schema | `packages/db/prisma/schema.prisma` |
| Database client | `packages/db/src/client.ts` |
| Logger | `packages/shared/src/logger/` |
| Permissions | `packages/permissions/src/` |
| Email templates | `packages/email/src/` |
| Redis/cache | `packages/db/src/redis/` |
| Request context | `apps/api/src/lib/context/` |
| Middleware | `apps/api/src/middleware/` |
| Type definitions | `apps/api/src/types/` |
| Test factories | `packages/db/src/test/factories/` |
| Test utilities | `apps/api/tests/utils/` |
| E2E tests | `tests/e2e/` |
| Load tests | `tests/load/` |

### Avoid Barrel Files

**Only use barrel files for top-level package exports** (the public API). Otherwise, import directly from the source file:

```typescript
// Good - direct imports
import { getUser } from '#/lib/context/getUser';
import { cache } from '#/lib/cache/cache';

// Bad - intermediate barrel
import { getUser, cache } from '#/lib';
```

Direct imports:
- Better tree-shaking
- Clearer dependency graph
- Easier to find source
- Better IDE navigation
