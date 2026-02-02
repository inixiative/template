# Naming Conventions

## Contents

- [Backend](#backend)
- [Frontend](#frontend)
- [Database](#database)
- [Files & Directories](#files--directories)

---

## Terminology

| Use | Avoid | Context |
|-----|-------|---------|
| `util` | helper | |
| `services` | handlers | Backend business logic |
| `handlers` | | Jobs, frontend event handlers |
| `make` | create | Factories/currying |
| `validate` | require | Middleware guards |
| `aToB` | | Integration transformers (e.g., `stripeToUser`) |

---

## Backend

### Files

| Type | Convention | Example |
|------|------------|---------|
| Route handler | `<model><Action>.ts` | `userCreate.ts`, `organizationReadMany.ts` |
| Hook | `<model><Timing><Purpose>.ts` | `userAfterCreate.ts` |
| Job | `<verb><Noun>.ts` | `sendWebhook.ts`, `processInquiry.ts` |
| Middleware | `<purpose>Middleware.ts` | `authMiddleware.ts` |
| Utility | `<verb><Noun>.ts` or `<noun>.ts` | `makeController.ts`, `cache.ts` |

### Functions

| Type | Convention | Example |
|------|------------|---------|
| Route handler | `<model><Action>` | `userCreate`, `organizationReadMany` |
| Getter | `get<Thing>` | `getUser`, `getOrganization` |
| Boolean getter | `is<Condition>` | `isAuthenticated`, `isSuperadmin` |
| Factory | `create<Thing>` | `createUser`, `createOrganization` |

### Variables

| Type | Convention | Example |
|------|------------|---------|
| ID types | `<Model>Id` | `UserId`, `OrganizationId` |
| Context values | camelCase | `user`, `organization`, `permix` |
| Constants | SCREAMING_SNAKE | `DEFAULT_PAGE_SIZE`, `MAX_RETRIES` |

### Imports

| Context | Alias | Example |
|---------|-------|---------|
| Within an app | `#/` | `import { getUser } from '#/lib/context/getUser'` |
| Shared packages | `@template/` | `import { db } from '@template/db'` |
| Within a shared package | `@template/` | `import { log } from '@template/shared/logger'` |
| Top-level barrel exports | Relative | `export { foo } from './foo'` |

```typescript
// apps/api/src/modules/user/routes/userCreate.ts
import { db } from '@template/db';                    // Shared package
import { log } from '@template/shared/logger';        // Shared package
import { getUser } from '#/lib/context/getUser';      // Internal to app

// packages/shared/src/logger/index.ts (top-level barrel)
export { log } from './logger';                       // Relative OK here
export { logScope } from './scope';

// packages/shared/src/logger/logger.ts (NOT a barrel)
import { getLogScopes } from '@template/shared/logger/scope';  // Use alias, not relative
```

**Why `@template/` inside shared packages?** Ensures imports work the same whether you're inside or outside the package. Avoids confusing mixed conventions.

**Why relative only for top-level barrels?** Top-level `index.ts` files are the public API that makes exports accessible outside the package. They just re-export from siblings. Actual code files use aliases for consistency.

**Avoid barrel files otherwise.** Import directly from the source file, not through intermediate barrels. Direct imports are clearer and tree-shake better.

---

## Frontend

TODO: Document frontend conventions

### Components

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `UserProfile.tsx` |
| Hook | `use<Name>` | `useAuth.ts` |
| Context | `<Name>Context` | `AuthContext.tsx` |

### Styles

TODO: Tailwind conventions

---

## Database

### Prisma Schema

| Type | Convention | Example |
|------|------------|---------|
| Model | PascalCase singular | `User`, `Organization` |
| Field | camelCase | `firstName`, `organizationId` |
| Enum | PascalCase | `Role`, `PlatformRole`, `SpaceRole` |
| Relation | camelCase, descriptive | `organization`, `members`, `createdBy` |

### IDs

TODO: Document ID format
- UUIDv7 for sortability
- Type-safe branded IDs

---

## Files & Directories

### Backend Structure

```
apps/api/src/
├── config/          # App configuration
├── jobs/            # Background job definitions
├── lib/             # Shared utilities (avoid barrel files)
│   ├── cache/       # Cache utilities
│   ├── context/     # Request context getters
│   ├── permissions/ # Permission helpers
│   └── utils/       # General utilities
├── middleware/      # Hono middleware
├── modules/         # Domain modules
│   └── <model>/
│       ├── routes/  # Route handlers
│       ├── hooks/   # Model hooks
│       └── jobs/    # Model-specific jobs
└── routes/          # Route registration
```

### Frontend Structure

TODO: Document frontend structure
