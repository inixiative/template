# Style

<!-- toc:start -->

## Contents

- [Code Formatting](#code-formatting)
  - [Single-Line Early Exits](#single-line-early-exits)
  - [No Nested Ternaries](#no-nested-ternaries)
  - [Two States Are a Boolean](#two-states-are-a-boolean)
  - [Module-Scope Constants](#module-scope-constants)
  - [Derive, Don't Store](#derive-dont-store)
  - [Keyed, Not Positional](#keyed-not-positional)
  - [Atomic Files](#atomic-files)
  - [Minimal Index Files](#minimal-index-files)
- [Naming Conventions](#naming-conventions)
  - [Variable Prefixes](#variable-prefixes)
- [Imports](#imports)
  - [Path Aliases](#path-aliases)
  - [Never](#never)
- [TypeScript](#typescript)
  - [Prefer `type` Over `interface`](#prefer-type-over-interface)
  - [No TypeScript `enum`](#no-typescript-enum)
  - [Infer Types](#infer-types)
  - [Use the Type That Exists](#use-the-type-that-exists)
- [Comments & Logging](#comments--logging)
  - [No Comments](#no-comments)
  - [Minimal Logging](#minimal-logging)
- [Dependencies](#dependencies)

<!-- toc:end -->


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
if (!user) throw makeError({ status: 404, message: 'Not found' });
if (!valid) return null;
```

### No Nested Ternaries

One ternary per expression. A choice among three or more values is a lookup object (or an early-return chain), never `a ? x : b ? y : z`. — fb: 2026-01-25, 2026-02-14, 2026-10-15

```typescript
// Good
const deletedWhere = { true: { deletedAt: { not: null } }, false: { deletedAt: null }, all: {} }[deleted];

// Bad
const deletedWhere = deleted === 'true' ? { deletedAt: { not: null } } : deleted === 'false' ? { deletedAt: null } : {};
```

Signs you're bypassing it: two `?` in one expression; several temporary variables fed into stacked conditionals where one helper (`URLSearchParams`, a lookup) would do.

### Two States Are a Boolean

An option with two states that won't grow a third is a `boolean` (`preserveSearch?: boolean`, `dark: boolean`), not a string union, mode or config object. Anything that might grow a third value is an enum from the start (as the polymorphic party enums are). — fb: 2026-02-07, 2026-02-14

### Module-Scope Constants

Lookup tables, strategy maps and fixed config are declared once at module scope, not rebuilt inside the function that uses them. Values shared across a module (status lists, enum objects) live in the module's `constants.ts` (`apps/api/src/modules/batch/constants.ts`), not inline in a route. — fb: 2026-02-06

### Derive, Don't Store

A value computable from data you already have is computed, not stored or configured: a count is `array.length`, the next instance number is the length after the existence check, a previous key version is derived from the current one, not an env var. Signs you're bypassing it: a `count` field next to the array it counts; an env var or config key whose value follows from another. — fb: 2026-01-25, 2026-01-31, 2026-02-11

### Keyed, Not Positional

Select configuration by key from a record (`ENCRYPTED_MODELS.authProvider.keys.secrets`), never by array position (`keys[0]`): a position silently changes meaning when an entry is added. Numeric versions are numbers (`2`), not prefixed strings (`'v2'`), so they compare and increment. — fb: 2026-02-11, 2026-02-12

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
| `_` | Unused binding (parameter, destructured field) |
| `__` | Private / internal: class privates, module-private state, type brands, object-literal internals ([NAMING.md → Underscore Prefix](NAMING.md#underscore-prefix)) |

```typescript
// Unused parameter
app.get('/', (_req, res) => res.send('ok'));

// Module-private state
let __cache: Map<string, unknown> | null = null;
export const getCache = () => __cache ??= new Map();

// Type brand
type UserId = string & { readonly __model: 'User' };
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

### No TypeScript `enum`

The rule is about the TS `enum` keyword. Use Prisma enums for domain values (see [DATABASE.md](DATABASE.md#enum-naming)) or a const object:

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

### Use the Type That Exists

Before declaring a type, find the one that already describes the thing and use it directly: Prisma model types and `ModelTypeMap` (`@template/db`, every model's scalars by `ModelName`), the generated Zod schemas (`@template/db/zod`), `PageContext` / `TenantContext` (`@template/ui/store/types/tenant`). No local alias (`type Org = Organization`), no hand-written copy of a model, no `any` (see [API_ROUTES.md](API_ROUTES.md#schemas)). — fb: 2026-01-25, 2026-02-09, 2026-02-10

Rows keep their shape. Don't rebuild a Prisma row field by field and cast it (`{ id: orgUser.id, role: orgUser.role, … } as OrganizationUser`); select or `include` the shape you need, or `omit` what you don't.

Signs you're bypassing it: `type Models = { User: User; Organization: Organization; … }`; `as` on an object literal you just assembled; a parameter typed `any` because the real type was "hard to find".

---

## Comments & Logging

### No Comments

Unless specifically requested or truly non-obvious.

### Minimal Logging

- One line per action
- No fancy ASCII art or emojis
- Scripts should be quiet (errors or final result only)
- No `console.log` in code you hand back: debug output added while working is removed, and the init TUI prints nothing outside its views ([INIT_SCRIPT_PATTERNS.md](INIT_SCRIPT_PATTERNS.md#7-suppress-console-logs-in-tasks)). Use `log` from `@template/shared/logger` where output is the point. — fb: 2026-02-15, 2026-03-01

---

## Dependencies

**Never install at root level.**

| Package | Install Location |
|---------|------------------|
| API deps | `apps/api/package.json` |
| Web deps | `apps/web/package.json` |
| DB deps | `packages/db/package.json` |
