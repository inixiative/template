# Database

## Contents

- [Local Setup](#local-setup)
- [Prisma](#prisma)
- [Scripts](#scripts)
- [Schema Conventions](#schema-conventions)
- [Typed Model IDs](#typed-model-ids)
- [Model Utilities](#model-utilities)
- [Client Methods](#client-methods)
- [Transactions](#transactions)
- [False Polymorphism](#false-polymorphism)

---

## Local Setup

```bash
bun run local:db   # Start Postgres (and Redis) via Docker
bun run reset:db   # Full reset: down → up → db:push → db:seed
```

Default: `postgres://postgres:postgres@localhost:5432/template`

See [DOCKER.md](DOCKER.md) for full Docker setup details.

---

## Prisma

### Version

Prisma 7 with native pg adapter (not the default libpq).

### Schema Location

Split schema in `packages/db/prisma/schema/`:

```
packages/db/prisma/
├── schema/           # One file per model
│   ├── user.prisma
│   ├── organization.prisma
│   └── ...
├── seed.ts           # Seed script
└── seeds/            # Seed data files
```

### Generator Output

```
packages/db/src/generated/
├── client/           # Prisma client
└── zod/              # Zod schemas (prisma-zod-generator)
```

---

## Scripts

Run from repo root or `packages/db`:

| Script | Command | Purpose |
|--------|---------|---------|
| Generate | `bun run db:generate` | Generate Prisma client + Zod schemas |
| Push | `bun run db:push` | Push schema to DB (dev only, no migration) |
| Migrate | `bun run db:migrate` | Create migration file |
| Deploy | `bun run db:deploy` | Run migrations (CI/production) |
| Studio | `bun run db:studio` | Open Prisma Studio GUI |
| Seed | `bun run db:seed` | Run seed script |

### Development Workflow

```bash
# After schema changes
bun run db:generate   # Regenerate client
bun run db:push       # Push to local DB (fast, no migration)

# When ready to commit
bun run db:migrate    # Create migration file
# Review migration, commit
```

### Production Workflow

```bash
bun run db:deploy     # Run pending migrations
```

### Database Operations

```bash
bun run db:dump       # Export database to file
bun run db:restore    # Import from file
bun run db:clone      # Clone remote DB to local
```

---

## Schema Conventions

### ID Fields (UUIDv7)

```prisma
id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
```

UUIDv7 provides time-sortable IDs.

### Foreign Keys

```prisma
userId String @db.VarChar(36)
```

Always `@db.VarChar(36)` on FK fields.

### DateTime Fields

```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

### Enum Naming

| Suffix | Values | Example |
|--------|--------|---------|
| `FooModel` | Model names (PascalCase) | `User`, `Organization` |
| `FooType` | Types (camelCase) | `memberInvitation` |
| `FooStatus/Role/Action` | Other (camelCase) | `draft`, `admin` |

```prisma
enum WebhookOwnerModel {
  User
  Organization
}

enum InquiryType {
  memberInvitation
  memberApplication
}
```

---

## Typed Model IDs

Phantom types provide compile-time safety for model IDs. Prevents accidentally passing a `UserId` where a `SessionId` is expected.

```typescript
import { UserId, userId, OrganizationId, organizationId } from '@template/db';

// Type aliases
type UserId = string & { readonly __model: 'User' };
type OrganizationId = string & { readonly __model: 'Organization' };

// Constructor functions (cast raw string to typed ID)
const id: UserId = userId('abc-123');
const orgId: OrganizationId = organizationId('org-456');
```

### Usage

```typescript
// Function signatures enforce correct ID types
async function getUser(id: UserId): Promise<User> { ... }
async function getOrg(id: OrganizationId): Promise<Organization> { ... }

// Compile-time error: can't pass UserId where OrganizationId expected
getOrg(userId('abc'));  // ❌ Type error

// Correct usage
getOrg(organizationId('abc'));  // ✓
```

### Available Types

| Type | Constructor |
|------|-------------|
| `UserId` | `userId(id)` |
| `OrganizationId` | `organizationId(id)` |
| `OrganizationUserId` | `organizationUserId(id)` |
| `AccountId` | `accountId(id)` |
| `SessionId` | `sessionId(id)` |
| `VerificationId` | `verificationId(id)` |
| `TokenId` | `tokenId(id)` |
| `InquiryId` | `inquiryId(id)` |
| `WebhookSubscriptionId` | `webhookSubscriptionId(id)` |
| `WebhookEventId` | `webhookEventId(id)` |
| `CronJobId` | `cronJobId(id)` |

Located in `packages/db/src/typedModelIds.ts`.

---

## Model Utilities

Two parallel utility sets from `@template/db`:

### PascalCase (ModelName)

```typescript
ModelNames       // { User: 'User', Organization: 'Organization', ... }
modelNames       // ['User', 'Organization', ...]
isModelName      // Type guard
toModelName      // 'user' → 'User'
```

### camelCase (AccessorName)

```typescript
AccessorNames    // { user: 'user', organization: 'organization', ... }
accessorNames    // ['user', 'organization', ...]
isAccessorName   // Type guard
toAccessor       // 'User' → 'user'
```

### Delegate Access

```typescript
toDelegate(db, 'User')  // → db.user
```

---

## Client Methods

```typescript
import { db } from '@template/db';

db.user.findMany()      // Uses txn if active, else raw
db.raw.user.findMany()  // Always raw, bypasses txn
db.scope(id, fn)        // Create AsyncLocalStorage context
db.txn(fn)              // Start transaction
db.onCommit(fns)        // Queue callbacks for after commit
db.getScopeId()         // Get current scope ID
db.isInTxn()            // Check if in transaction
```

---

## Transactions

All mutations auto-wrapped in transactions via `mutationLifeCycle` extension.

### Manual Transaction

```typescript
await db.txn(async () => {
  await db.user.create({ ... });
  await db.token.create({ ... });
});
```

### After Commit Callbacks

```typescript
db.onCommit(async () => {
  // Runs after transaction commits
  await sendEmail();
});
```

---

## False Polymorphism

Instead of true polymorphism (type + id), use type enum + optional FKs:

```prisma
ownerModel         WebhookOwnerModel
userId             String?       @db.VarChar(36)
organizationId     String?       @db.VarChar(36)

user         User?         @relation(...)
organization Organization? @relation(...)
```

Benefits: FK constraints, type-safe includes, proper cascading.

### Special Owner Values (No FK)

Some owner enums include special values that don't map to FKs:

| Owner | FK | Purpose | Permissions |
|-------|-----|---------|-------------|
| `default` | none | Base resources available to all tenants | Read: all, Write: super admin |
| `admin` | none | Platform internal resources | Super admin only |
| `User` | `userId` | User-owned resources | User managed |
| `Organization` | `organizationId` | Tenant-branded resources | Org admin managed |

```prisma
enum EmailOwnerModel {
  default       // Base resources - no FK
  admin         // Platform internal - no FK
  Organization  // Has organizationId FK
}
```

**When to use:**
- `default` - Base templates/resources available to all tenants. Super admins can edit. Everyone can read. Typically seeded with initial data.
- `admin` - Platform's internal resources (e.g., system communications). Only visible/editable by super admins.
- `Organization` - Tenant customizations. Org admins can create/edit their own versions.

**Optional: Immutable defaults** - If you want `default` resources to be seed-only (never edited via UI), enforce this at the API layer by rejecting writes to `default` owner resources. This is a stricter pattern for resources that should never change after deployment.

**Resolution priority example** (email templates):
1. Org-specific component (if sending on behalf of org)
2. Admin override (if super admin has customized)
3. Default (seeded baseline)

See [HOOKS.md](HOOKS.md#false-polymorphism) for validation.

---

## Constraint Helpers

DB-level constraints for protection when connecting directly (psql, migrations). App-level validation is handled by the [rules hook](HOOKS.md#rules-registry).

Located in `packages/db/src/constraints/`.

| Helper | Use Case |
|--------|----------|
| `addCheckConstraint` | CHECK constraints |
| `addUniqueWhereNotNull` | Partial unique indexes |
| `addGistIndex` | GIST indexes (range queries, exclusion) |
| `addPolymorphicConstraint` | Ensures exactly one FK is set (uses `FalsePolymorphismRegistry`) |

**Note**: If using these, wire them into db lifecycle (local setup + CI/CD). See TODO.md.

---

## Registries

Schema-level configuration in `packages/db/src/registries/`:

| Registry | Purpose | Used By |
|----------|---------|---------|
| `FalsePolymorphismRegistry` | Type field → FK mappings | Constraints, validation hooks, immutable fields |

```typescript
import { FalsePolymorphismRegistry, getPolymorphismConfigs } from '@template/db';

// Get configs for a model
const configs = getPolymorphismConfigs('Token');
// [{ typeField: 'ownerModel', fkMap: { User: ['userId'], ... } }]
```

See [HOOKS.md](HOOKS.md#false-polymorphism) for how hooks use this registry.
