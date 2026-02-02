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
- [Additional Models](#additional-models)

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
| `SpaceId` | `spaceId(id)` |
| `SpaceUserId` | `spaceUserId(id)` |
| `CustomerRefId` | `customerRefId(id)` |
| `EmailTemplateId` | `emailTemplateId(id)` |
| `EmailComponentId` | `emailComponentId(id)` |

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

See [Delegate Typing](#delegate-typing) for comprehensive type-safe patterns.

---

## Delegate Typing

Dynamic delegate access in Prisma has TypeScript limitations. This section documents the patterns and when to use each.

### The Problem

When accessing delegates dynamically, TypeScript sees a union of ALL delegate types:

```typescript
function find(model: ModelName) {
  // db[toAccessor(model)] → union of ALL delegates
  // Each has different arg types → "signatures not compatible" error
  db[toAccessor(model)].findMany({ where: { email: 'x' } }); // ❌ TS error
}
```

**Root cause**: Even with generics like `<M extends ModelName>`, TypeScript can't narrow `db[accessor]` because the accessor is computed at runtime.

**References**:
- [prisma/prisma#6980](https://github.com/prisma/prisma/issues/6980) - Generic model access
- [prisma/prisma#18322](https://github.com/prisma/prisma/discussions/18322) - TypeMap limitations
- [bursteways.tech](https://bursteways.tech/posts/fixing-prisma-createmany-typescript-error/) - Infer pattern

### Pass the Delegate (Type-Safe)

Pass the delegate directly and TypeScript infers the exact type:

```typescript
import { Prisma } from '@template/db';

// Generic function - T is inferred from the delegate passed
function findMany<T extends { findMany: Function }>(
  delegate: T,
  args: Prisma.Args<T, 'findMany'>
): Promise<Prisma.Result<T, typeof args, 'findMany'>> {
  return delegate.findMany(args);
}

// Usage - full type safety!
const users = await findMany(db.user, { where: { email: 'test@example.com' } });
//    ^? User[]

const orgs = await findMany(db.organization, { where: { name: 'Acme' } });
//    ^? Organization[]
```

**Why it works**: When you pass `db.user` directly, TypeScript knows its exact type. No union, no ambiguity.

**Use when**:
- Caller knows which model at the call site
- You want full autocomplete on args and result
- Extensions that wrap Prisma operations

### Mutation Lifecycle Pattern

The `mutationLifeCycle` extension receives `{ model, args, query }` from Prisma. The `query` function is already typed correctly - just call it:

```typescript
async create({ model, operation, args, query }) {
  // query is typed - Prisma handles this internally
  const result = await query(args);  // ✓ Type-safe
  return result;
}
```

For fetching existing records (before hooks), use `delegateFor`:

```typescript
const previous = await delegateFor(db, model).findUnique({ where });
// previous: Record<string, unknown> | null
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
import { PolymorphismRegistry, getPolymorphismConfig } from '@template/db';

// Get config for a model
const config = getPolymorphismConfig('Token');
// { typeField: 'ownerModel', fkMap: { User: ['userId'], ... } } | null
```

See [HOOKS.md](HOOKS.md#false-polymorphism) for how hooks use this registry.

---

## Additional Models

### Space

Flexible container within organizations (e.g., initiatives, projects, storefronts).

```prisma
model Space {
  id              String   @id
  createdAt       DateTime
  updatedAt       DateTime
  deletedAt       DateTime?

  name            String
  slug            String

  organizationId  String
  organization    Organization @relation(...)

  // Relations
  spaceUsers      SpaceUser[]
  tokens          Token[]
  webhookSubscriptions WebhookSubscription[]
  emailComponents EmailComponent[]
  emailTemplates  EmailTemplate[]
  customerRefs    CustomerRef[]   // As provider
  providerRefs    CustomerRef[]   // As customer
  inquiriesSent   Inquiry[]
  inquiriesReceived Inquiry[]

  @@unique([organizationId, slug])
}
```

### SpaceUser

Staff with role-based access to a Space. Requires user to be an OrganizationUser first.

```prisma
model SpaceUser {
  id              String   @id
  createdAt       DateTime
  updatedAt       DateTime

  role            SpaceRole   // owner, admin, member, viewer
  entitlements    Json?       // Fine-grained permission overrides at space level

  organizationId  String
  spaceId         String
  userId          String

  // Composite FK ensures user is OrganizationUser first
  organizationUser OrganizationUser @relation(fields: [organizationId, userId], ...)
  organization    Organization
  space           Space
  user            User
  tokens          Token[]

  @@unique([organizationId, spaceId, userId])
}

enum SpaceRole {
  owner
  admin
  member
  viewer
}
```

### CustomerRef

Polymorphic customer relationship using false polymorphism. Links customers (User, Org, or Space) to providers (Space).

```prisma
model CustomerRef {
  id              String   @id
  createdAt       DateTime
  updatedAt       DateTime

  // Customer side (who is the customer)
  customerModel   CustomerModel   // User, Organization, Space
  customerUserId          String?
  customerOrganizationId  String?
  customerSpaceId         String?

  // Provider side (who is the provider)
  providerModel   ProviderModel   // Space
  providerSpaceId String?

  // Relations
  customerUser         User?
  customerOrganization Organization?
  customerSpace        Space?
  providerSpace        Space?
}

enum CustomerModel {
  User
  Organization
  Space
}

enum ProviderModel {
  Space
}
```

### EmailTemplate & EmailComponent

See [COMMUNICATIONS.md](COMMUNICATIONS.md#database-models) for full documentation.

Key enums:

```prisma
enum CommunicationCategory {
  system        // OTP, password reset - cannot unsubscribe
  promotional   // Marketing - can unsubscribe
}

enum EmailOwnerModel {
  default       // Base templates - read: all, write: super admin
  admin         // Platform internal - super admin only
  Organization  // Tenant-branded
  Space         // Space-specific overrides
}
```
