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

### Package Descriptions

#### @template/db

**Location:** `packages/db/`

Database layer with Prisma client, hooks, extensions, and encryption.

- **Schema:** `prisma/schema/` - Modular schema files
- **Hooks:** Mutation lifecycle, validation, audit logging
- **Extensions:** Redis cache, false polymorphism
- **Encryption:** Field-level AES-256-GCM encryption with key rotation
- **Test utilities:** Factories, test database management

#### @template/shared

**Location:** `packages/shared/`

**Isomorphic utilities** shared between frontend and backend. Originally contained frontend code, now focused only on true cross-platform utilities.

**Current contents:**
- `logger/` - Consola-based logging (works in Node + browser)
- `errors/` - Error types and utilities

**Historical note:** Previously contained frontend components, hooks, and state management. All frontend code migrated to `@template/ui` for better organization (see below).

#### @template/ui

**Location:** `packages/ui/`

**All frontend code** - components, hooks, state, pages, and API client.

**Why separate from @template/shared?**

Originally, `@template/shared` was meant for code shared between frontend and backend. As the codebase grew, it became clear that:
- Frontend code is never used by backend
- OpenAPI client generation is frontend-specific
- UI components need different testing strategies
- Package grew too large and unfocused

**Migration (2026-02-12):** Moved all frontend code from `@template/shared` to `@template/ui`:
- Components, hooks, pages
- Zustand store slices
- Auth utilities
- Test utilities

**Component organization** (by domain, not technical type):

```
ui/src/components/
├── auth/              # LoginForm, SignupForm
├── layout/            # AppShell, Sidebar, Header
├── organizations/     # CreateOrganizationModal
├── primitives/        # Button, Input, Card (shadcn/ui)
├── settings/          # Profile/Tokens/Webhooks tabs
├── users/             # InviteUserModal
└── utility/           # ErrorBoundary, NotFound
```

**OpenAPI client:**
- Auto-generated from API spec (`openapi.json`)
- Type-safe API calls
- Located in `apiClient/`

See `docs/claude/FRONTEND.md` for detailed frontend patterns.

#### @template/permissions

**Location:** `packages/permissions/`

RBAC (Role-Based Access Control) system using Permix and ReBAC.

- Role definitions (organization, space, user)
- Permission checks
- Entitlement system
- Context setup utilities

See `docs/claude/PERMISSIONS.md` for details.

#### @template/email

**Location:** `packages/email/`

Email template system with MJML rendering and composition.

- Template storage and versioning
- Component library
- Variable interpolation
- Conditional rendering
- Client abstractions (Resend, console)

See `docs/claude/COMMUNICATIONS.md` for details.

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

### TypeScript Configuration

Each package's `tsconfig.json` must map **all packages** to ensure consistent import resolution across the monorepo.

**Standard mappings for each package:**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@template/<package>/*": ["./src/*"],          // Self-reference
      "@template/db/*": ["../db/src/*"],             // Database package
      "@template/shared/*": ["../shared/src/*"],     // Shared utilities
      "@template/ui/*": ["../ui/src/*"],             // UI components
      "@template/permissions/*": ["../permissions/src/*"] // Permissions
    }
  }
}
```

**Special cases:**

- `packages/db` includes `@template/db-test/*` → `./test/*` for test utilities
- `packages/shared` includes `@template/shared/openapi.json` → `./openapi.json` for API spec
- Apps use `#/*` → `./src/*` for internal imports instead of `@template/`

**Why this matters:**

- Missing mappings cause "Cannot find module" errors
- Inconsistent mappings prevent cross-package imports
- TypeScript can't resolve deep imports without proper configuration
- Each package must map ALL other packages, even if not currently imported

**Example: Adding a new cross-package import**

If `packages/permissions` needs to import from `packages/ui`:

```typescript
// This will fail without tsconfig mapping
import { Button } from '@template/ui/components/Button';
```

The `permissions/tsconfig.json` must include:

```json
"@template/ui/*": ["../ui/src/*"]
```

**Verification:**

```bash
# Check all package tsconfigs have consistent mappings
bun run typecheck
```

If you see "Cannot find module '@template/x'" errors, check that the importing package's tsconfig.json includes the path mapping for package x.

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
