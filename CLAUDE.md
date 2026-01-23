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

Use `#/` (not `@/`) for internal imports to distinguish from npm packages:

```typescript
// Correct
import { Button } from '#/components/ui';

// Incorrect - don't use @ for internal imports
import { Button } from '@/components/ui';
```

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

## Dependency Management

- NEVER install dependencies at the root level
- Install dependencies in the specific app where they're needed:
  - API dependencies → `apps/api/package.json`
  - Web dependencies → `apps/web/package.json`
  - DB package → `packages/db/package.json`
- Root `package.json` should only contain workspace configuration

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

## Forking This Template

When creating a new project from this template:

1. Update package names from `@template/*` to `@yourproject/*`
2. Add your app-specific models to `packages/db/prisma/schema/`
3. Update typed model IDs in `packages/db/src/typedModelIds.ts`
4. Update this CLAUDE.md with project-specific context
