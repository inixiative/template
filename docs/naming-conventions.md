# Naming Conventions

## Terminology

| Use | Avoid |
|-----|-------|
| `util` | helper |
| `services` | handlers |
| `make` | create (for factories/currying) |
| `validate` | require (for middleware guards) |

## Module Folder Structure

```
modules/<resource>/
├── constants/
├── controllers/
├── schemas/
├── services/
├── routes/
├── transformers/
└── tests/
```

## Middleware Organization

```
middleware/
├── auth/           # Authentication
├── error/          # Error handling
├── validations/    # Guards (validateUser, validateOrgMembership)
├── resources/      # Resource loading
└── *.ts            # Single-file middleware (cors, prepareRequest, txScope, rateLimit)
```

## Context Helpers

```
lib/context/        # Getters for typed Hono context access
├── getUser.ts
├── getResource.ts
├── getRequestId.ts
└── isSuperadmin.ts
```

For universal scope ID access (works in routes AND jobs):
```typescript
import { tx } from '@template/db';
tx.getScopeId()  // returns scope ID from AsyncLocalStorage
```

## File Naming

- **Atomic files** - one file, one named export
- **camelCase** for files matching their export name
- **Plural resource names** in routes (`users`, `organizations`)

## Function Patterns

- `make*` - Factory/currying pattern (e.g., `makeController`)
- `get*` - Context accessor (e.g., `getUser`)
- `validate*` - Guard middleware (e.g., `validateUser`)
- `is*` - Boolean check (e.g., `isSuperadmin`)
