# Claude Development Guide

## Project Overview

**Template** - A monorepo foundation for building full-stack applications with Bun, Hono, Prisma 7, React, and Tailwind.

## Tech Stack

- **Monorepo**: Bun workspaces
- **Backend**: Bun + Hono + Prisma 7
- **Frontend**: React + Vite + Tailwind CSS v4 + React Aria
- **Database**: PostgreSQL
- **Structure**: `apps/` + `packages/`

## Path Aliasing

**Two alias patterns:**

- `#/` - Internal imports within the same app or package
- `@` - Cross-package imports from other workspace packages

```typescript
// Internal imports (same app/package) - use #/
import { makeController } from '#/lib/utils/makeController';
import { authMiddleware } from '#/middleware/auth/authMiddleware';

// Cross-package imports (from workspace packages) - use @
import { db } from '@template/db';
import { UserModelSchema } from '@template/db/zod/models';
import { requireAuth } from '@template/permissions';

// NPM packages - use @ as normal
import { z } from '@hono/zod-openapi';
```

---

## API Module Structure

### File Organization

Follow `controllers/`, `routes/`, `tests/` pattern with **one file per endpoint**:

```
apps/api/src/modules/<resource>/
├── controllers/
│   ├── <resource>Create.ts
│   ├── <resource>Read.ts
│   ├── <resource>ReadMany.ts
│   ├── <resource>Update.ts
│   └── <resource>Delete.ts
├── routes/
│   ├── <resource>Create.ts
│   ├── <resource>Read.ts
│   ├── <resource>ReadMany.ts
│   ├── <resource>Update.ts
│   └── <resource>Delete.ts
├── services/           # Optional: for complex business logic
└── index.ts            # Router registration
```

### Naming Conventions

**Pattern**: `resourceActionSubresource`

| Type | Example | Description |
|------|---------|-------------|
| Create | `usersCreate` | Create a user |
| Read | `usersRead` | Read single user |
| ReadMany | `usersReadMany` | Read multiple users |
| Update | `usersUpdate` | Update a user |
| Delete | `usersDelete` | Delete a user |
| Subresource | `organizationsReadManyUsers` | Read org's users |
| Action | `usersActivate` | Custom action on user |

**Resource names are PLURAL** (e.g., `users`, `inquiries`, `organizations`)

### Router Exports

**ALWAYS use named exports with `Router` suffix** - consistency is critical:

```typescript
// ✅ CORRECT - Named export with Router suffix
export const usersRouter = new OpenAPIHono<AppEnv>();
export const adminRouter = new OpenAPIHono<AppEnv>();
export const cronJobsRouter = new OpenAPIHono<AppEnv>();

// ✅ CORRECT - Import
import { usersRouter } from '#/modules/users';
import { adminRouter } from '#/routes/admin';

// ❌ WRONG - Default export
export default usersRoutes;

// ❌ WRONG - Routes suffix
export const usersRoutes = ...;
```

### Route Templates

**ALWAYS use request templates** - NEVER use `createRoute` directly:

```typescript
import { readRoute, createRouteTemplate, updateRoute, deleteRoute } from '#/lib/requestTemplates';

// Read single
export const usersReadRoute = readRoute({
  model: 'users',
  responseSchema: UserResponseSchema,
});

// Read many with pagination
export const usersReadManyRoute = readRoute({
  model: 'users',
  many: true,
  paginate: true,
  responseSchema: UserResponseSchema,
});

// Create
export const usersCreateRoute = createRouteTemplate({
  model: 'users',
  bodySchema: UserCreateInputSchema,
  responseSchema: UserResponseSchema,
});

// Update
export const usersUpdateRoute = updateRoute({
  model: 'users',
  bodySchema: UserUpdateInputSchema,
  responseSchema: UserResponseSchema,
});

// Delete
export const usersDeleteRoute = deleteRoute({
  model: 'users',
});
```

### Controllers

Use `makeController()` with built-in responders:

```typescript
import { makeController } from '#/lib/utils/makeController';
import { usersReadRoute } from '../routes/usersRead';

export const usersReadController = makeController(usersReadRoute, async (c, respond) => {
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const user = await db.user.findUnique({ where: { id } });

  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  return respond.ok(user);
});
```

### Schemas - Use Generated Zod

**Use generated Zod schemas from Prisma** - avoid redefining what's already generated:

```typescript
// ✅ CORRECT - Import from generated schemas
import { InquiryCreateInputObjectZodSchema } from '@template/db/zod';
import { InquiryModelSchema } from '@template/db/zod/models';

// ❌ WRONG - Don't redefine what's generated
const inquiryTypeEnum = z.enum(['memberInvitation', 'memberApplication']);
```

Generated schemas in `packages/db/src/generated/zod/`:
- `schemas/objects/` - Input schemas (e.g., `InquiryCreateInput.schema.ts`)
- `schemas/enums/` - Enum schemas (e.g., `InquiryType.schema.ts`)
- `schemas/variants/pure/` - Model schemas (e.g., `InquiryModelSchema`)

Imports:
- `@template/db/zod` - Input schemas and enums
- `@template/db/zod/models` - Model schemas for responses

### Types - Use Inferred Types

**NEVER define explicit types** - let TypeScript infer from Prisma:

```typescript
// ✅ CORRECT - Infer types from db queries
const user = await db.user.findUnique({ where: { id } });
// TypeScript infers user type from Prisma

// ✅ CORRECT - Import Prisma types when needed
import type { User, Inquiry } from '@template/db';

// ❌ WRONG - Don't define explicit types
type User = { id: string; email: string; ... };
```

---

## Prisma 7 Configuration

### Split Schema
Schema is split across multiple files in `packages/db/prisma/schema/`:
- `_base.prisma` - Generators and datasource
- `user.prisma` - User, Session, Wallet
- `webhook.prisma` - WebhookSubscription, WebhookEvent
- Add your app-specific models in separate files

### Driver Adapters
Prisma 7 uses driver adapters instead of the Rust query engine:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

### Config File
Connection URLs are in `prisma.config.ts`, not the schema:
```typescript
export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema'),
  migrate: {
    async url() { return process.env.DATABASE_URL!; },
  },
});
```

### Schema Conventions

**One model per file** - each model gets its own `.prisma` file in `packages/db/prisma/schema/`

**ID fields (UUIDv7):**
```prisma
id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
```
- Use `uuidv7()` for time-ordered UUIDs (better index performance)
- Always `@db.VarChar(36)` on UUID fields for consistency

**Foreign keys:**
```prisma
userId String @db.VarChar(36)
```
- Always `@db.VarChar(36)` on FK fields that reference UUIDs

**String fields:**
```prisma
name  String   // No annotation - defaults to text
email String   // No @db.VarChar or @db.Text needed
```
- Don't use `@db.VarChar(n)` or `@db.Text` on non-UUID strings
- PostgreSQL treats `text` and `varchar` identically

**DateTime fields:**
```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```
- Use `DateTime` (maps to `timestamptz` in PostgreSQL)
- No `@db.Timestamp` annotation needed

**Enum naming conventions:**
- `FooModel` suffix = values are model names (PascalCase values)
- `FooType` suffix = types of the thing itself (camelCase values)
- Other suffixes like `Status`, `Role`, `Action` (camelCase values)

```prisma
// Values are model names → use Model suffix, PascalCase values
enum WebhookOwnerModel {
  User
  Organization
}

// Values are types of the thing → use Type suffix, camelCase values
enum InquiryType {
  memberInvitation
  memberApplication
}

// Other descriptive suffixes, camelCase values
enum InquiryStatus {
  draft
  sent
  resolved
}
```

**Fake polymorphism pattern:**
Instead of true polymorphism (just type + id), use type enum + optional FKs:
```prisma
// Model field for filtering
ownerModel WebhookOwnerModel

// Optional FKs with real relations
userId         String?       @db.VarChar(36)
organizationId String?       @db.VarChar(36)

user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
```
Benefits: FK constraints, type-safe includes, proper cascading

---

## Development Practice

### Raw Notes

Document all important decisions, patterns, and conventions in `docs/RAW_NOTES.md` concisely as you go. This avoids doc bloat while capturing knowledge. Organize into proper docs later.

### Architectural Reviews

Periodically stop and review architectural decisions before moving forward. Ask:
- Does this pattern match the rest of the codebase?
- Are we over-engineering or under-engineering?
- Will this be maintainable in 6 months?
- Are there simpler alternatives?

When in doubt, pause and discuss with the user before implementing.

---

## Code Style

**CONSISTENCY IS CRITICAL** - When in doubt, match existing patterns in the codebase. Before introducing any new pattern, check how similar things are done elsewhere. Inconsistency creates confusion and maintenance burden.

- Semicolons, single quotes, trailing commas, 2-space indent
- Arrow functions with explicit return types
- Named exports over default exports
- camelCase for variables/functions, PascalCase for types/components
- **Single-line early exits** - use `if (!x) throw ...` or `if (!x) return ...` on one line
- **Atomic files** - one file, one named export (unless helper functions are internal to that file)
- **Minimal index files** - only at module level (`#/hooks/webhooks`) and package level, not nested (`constants/index.ts`). Import directly from files.

### Logging & Comments

- **Minimal output** - one line per action, no fancy ASCII art or emojis
- **No comments** unless specifically requested or truly non-obvious
- **Scripts should be quiet** - only output errors or final result
- Avoid over-logging in application code

### TypeScript Rules

- Prefer `type` over `interface`
- No enums - use const assertions or Prisma enums
- Infer types from Zod schemas (`z.infer<typeof Schema>`)

---

## Dependency Management

- NEVER install dependencies at the root level
- Install dependencies in the specific app where they're needed:
  - API dependencies → `apps/api/package.json`
  - Web dependencies → `apps/web/package.json`
  - DB package → `packages/db/package.json`
- Root `package.json` should only contain workspace configuration

---

## Quick Commands

```bash
# Generate Prisma client
cd packages/db && bun run db:generate

# Run API
cd apps/api && bun run dev

# Run Web
cd apps/web && bun run dev

# Lint
bun run lint

# Format
bun run format
```

---

## Key Patterns

### Typed Model IDs
Phantom types for compile-time safety:
```typescript
import { userId, UserId } from '@template/db';

const id: UserId = userId('abc-123');
// Can't pass UserId where SessionId is expected - compile error
```

### Mutation Lifecycle Hooks
Register before/after hooks on Prisma mutations:
```typescript
registerDbHook(
  'myHook',
  'User',
  HookTiming.after,
  [DbAction.create, DbAction.update],
  async ({ model, result }) => { ... }
);
```

### Cache Invalidation
Declarative cache key mapping per model in `cacheReference.ts`:
```typescript
User: (record) => [`users:${record.id}`, `users:email:${record.email}`]
```

### Webhook System
Automatic webhook delivery on model mutations via `webhookHook.ts`.

### Context Helpers
Typed accessors for Hono context variables in `apps/api/src/middleware/context/`:
- `getUser(c)` - Get authenticated user from context. Throws if not authenticated.
- `getResource<T>(c)` - Get loaded resource with type inference. Throws if not found.

---

## Reference Repositories

When implementing patterns or looking for examples, reference these production codebases:

- **Zealot Monorepo**: `~/UserEvidenceZealot/repositories/Zealot-Monorepo` - Full-featured implementation
- **Organized Play API**: `~/Carde.io/organized-play-api` - API patterns and conventions

These repos follow the same architectural patterns and can be used as references for:
- Module structure and naming conventions
- Complex query patterns
- Permission system usage
- Testing strategies

---

## AI Workspace

`tmp/AI_WORKSPACE/` is a gitignored staging area for async/overnight work.

```
AI_WORKSPACE/
├── {task-name}/
│   ├── TASK.md          # Task description, status, notes
│   ├── files/           # Files mirroring repo structure
│   └── notes/           # Research, drafts, experiments
```

Workflow:
1. Create task folder with TASK.md
2. Work on files in `files/` directory
3. User reviews and copies approved files to repo
4. Delete task folder when done

Use this for larger changes, experiments, or work that needs review.

---

## Forking This Template

When creating a new project from this template:

1. Update package names from `@template/*` to `@yourproject/*`
2. Add your app-specific models to `packages/db/prisma/schema/`
3. Update typed model IDs in `packages/db/src/typedModelIds.ts`
4. Update this CLAUDE.md with project-specific context
