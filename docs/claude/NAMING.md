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
| Route handler | `<model><Action><Submodel?>`.ts | `userCreate.ts`, `organizationReadManySpaces.ts` |
| Hook | `<model><Timing><Purpose>.ts` | `userAfterCreate.ts` |
| Job | `<verb><Noun>.ts` | `sendWebhook.ts`, `processInquiry.ts` |
| Middleware | `<purpose>Middleware.ts` | `authMiddleware.ts` |
| Utility | `<verb><Noun>.ts` or `<noun>.ts` | `makeController.ts`, `cache.ts` |

**ReadMany subresources use plural form:**
- `meReadManyOrganizations.ts` (not `meReadManyOrganization.ts`)
- `organizationReadManySpaces.ts` (not `organizationReadManySpace.ts`)
- Single operations remain singular: `organizationCreateSpace.ts`

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
| Primitive constants | SCREAMING_SNAKE | `DEFAULT_PAGE_SIZE`, `MAX_RETRIES` |
| Object constants (enums/registries) | PascalCase | `Modules`, `JobType`, `BatchStatus` |
| Derived helpers (Zod enums, etc) | camelCase | `batchStatusEnum`, `moduleKeys` |

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

### Constants Pattern: `keyof typeof`

Use `keyof typeof` to derive types from const objects for single source of truth.

```typescript
// ✅ Good - Type derived from object
export const BatchStatus = {
  success: 'success',
  partialSuccess: 'partialSuccess',
  failed: 'failed',
} as const;

export type BatchStatus = keyof typeof BatchStatus;
// Type: 'success' | 'partialSuccess' | 'failed'

// ❌ Bad - Manual duplication
type BatchStatus = 'success' | 'partialSuccess' | 'failed';
const BatchStatus = { success: 'success', ... };
```

**Benefits:**
- Add new value in one place
- Types automatically update
- Impossible to desync
- Works with Zod schemas

### Zod Enum from Const Object

Convert const object to Zod enum tuple format:

```typescript
const BatchStatus = { success: 'success', failed: 'failed' } as const;

// Create Zod enum helper
export const batchStatusEnum = Object.keys(BatchStatus) as [
  keyof typeof BatchStatus,
  ...Array<keyof typeof BatchStatus>
];

// Use in schema
const schema = z.object({
  status: z.enum(batchStatusEnum) // Type-safe, synced with BatchStatus
});
```

**Why needed:** Zod's `z.enum()` requires tuple type `[string, ...string[]]`, not plain array.

**Real example:** See `apps/api/src/modules/batch/constants.ts`

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
| Enum | PascalCase | `Role`, `PlatformRole` |
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
