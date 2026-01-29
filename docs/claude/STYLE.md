# Style

## Contents

- [Code Formatting](#code-formatting)
- [Naming Conventions](#naming-conventions)
- [Imports](#imports)
- [TypeScript](#typescript)
- [Comments & Logging](#comments--logging)
- [Dependencies](#dependencies)

---

## Code Formatting

- Semicolons
- Single quotes
- Trailing commas
- 2-space indent
- Arrow functions with explicit return types
- Named exports over default exports

### Single-Line Early Exits

```typescript
if (!user) throw new HTTPException(404, { message: 'Not found' });
if (!valid) return null;
```

### Atomic Files

One file, one named export (unless helpers are internal).

### Minimal Index Files

Only at module level and package level - not nested.

```typescript
// Good
#/hooks/webhooks/index.ts
packages/db/src/index.ts

// Bad - import directly instead
#/hooks/webhooks/constants/index.ts
```

---

## Naming Conventions

| Pattern | Use For |
|---------|---------|
| `util` | Not `helper` |
| `services` | Not `handlers` |
| `make*` | Factories/curry |
| `validate*` | Guards |
| `get*` | Accessors |
| `is*` | Boolean checks |
| `txn` | Not `transaction` |

### Variable Prefixes

| Prefix | Meaning |
|--------|---------|
| `_` | Unused parameter |
| `__` | Module-private state (not exported) |

```typescript
// Unused parameter
app.get('/', (_req, res) => res.send('ok'));

// Module-private state
let __cache: Map<string, unknown> | null = null;
export const getCache = () => __cache ??= new Map();
```

---

## Imports

### Path Aliases

| Alias | Use |
|-------|-----|
| `#/` | Internal imports (same app/package) |
| `@template/*` | Cross-package imports |

```typescript
// Internal
import { makeController } from '#/lib/utils/makeController';

// Cross-package
import { db } from '@template/db';
import { UserScalarSchema } from '@template/db/zod/models';

// NPM
import { z } from '@hono/zod-openapi';
```

### Never

- Relative imports (`../`)
- Deep imports into other packages

---

## TypeScript

### Prefer `type` Over `interface`

```typescript
type User = { id: string; name: string };
```

### No Enums

Use const assertions or Prisma enums:

```typescript
const Status = { active: 'active', inactive: 'inactive' } as const;
```

### Infer Types

```typescript
// From Zod
type User = z.infer<typeof UserSchema>;

// From Prisma
import type { User } from '@template/db';
```

---

## Comments & Logging

### No Comments

Unless specifically requested or truly non-obvious.

### Minimal Logging

- One line per action
- No fancy ASCII art or emojis
- Scripts should be quiet (errors or final result only)

---

## Dependencies

**Never install at root level.**

| Package | Install Location |
|---------|------------------|
| API deps | `apps/api/package.json` |
| Web deps | `apps/web/package.json` |
| DB deps | `packages/db/package.json` |
