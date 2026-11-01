# Database

<!-- toc:start -->

## Contents

- [Local Setup](#local-setup)
- [Prisma](#prisma)
  - [Version](#version)
  - [Schema Location](#schema-location)
  - [Generator Output](#generator-output)
- [Scripts](#scripts)
  - [Schema Changes: Push Before Launch, Migrations After](#schema-changes-push-before-launch-migrations-after)
  - [Development Workflow](#development-workflow)
  - [Database Operations](#database-operations)
- [Seeding](#seeding)
  - [Prime Development Data](#prime-development-data)
  - [Seed Architecture](#seed-architecture)
  - [Adding Seed Data](#adding-seed-data)
  - [Seed Order (FK Constraints)](#seed-order-fk-constraints)
  - [Password Seeding](#password-seeding)
- [Schema Conventions](#schema-conventions)
  - [ID Fields (UUIDv7)](#id-fields-uuidv7)
  - [Foreign Keys](#foreign-keys)
  - [DateTime Fields](#datetime-fields)
  - [Enum Naming](#enum-naming)
  - [Reference Data (Code, Not Rows)](#reference-data-code-not-rows)
- [Model Utilities](#model-utilities)
  - [PascalCase (ModelName)](#pascalcase-modelname)
  - [camelCase (AccessorName)](#camelcase-accessorname)
  - [Delegate Access](#delegate-access)
- [Delegate Typing](#delegate-typing)
  - [The Problem](#the-problem)
  - [Pass the Delegate (Type-Safe)](#pass-the-delegate-type-safe)
  - [Mutation Lifecycle Pattern](#mutation-lifecycle-pattern)
- [Client Methods](#client-methods)
- [Transactions](#transactions)
  - [Manual Transaction](#manual-transaction)
  - [After Commit Callbacks](#after-commit-callbacks)
  - [Finally Callbacks](#finally-callbacks)
  - [Redis Locks Held Until the Transaction Ends](#redis-locks-held-until-the-transaction-ends)
  - [Row Locks and Create-If-Missing](#row-locks-and-create-if-missing)
- [Query Building Utilities](#query-building-utilities)
  - [buildWhereClause](#buildwhereclause)
  - [Soft-delete read scoping](#soft-delete-read-scoping)
  - [Path Notation Utilities](#path-notation-utilities)
- [False Polymorphism](#false-polymorphism)
  - [Special Owner Values (No FK)](#special-owner-values-no-fk)
  - [Delegated Keys](#delegated-keys)
- [Registries](#registries)
- [Schema Reference](#schema-reference)

<!-- toc:end -->


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
│   ├── account.prisma
│   ├── authProvider.prisma
│   ├── organization.prisma
│   ├── organizationUser.prisma
│   ├── space.prisma
│   ├── spaceUser.prisma
│   ├── token.prisma
│   ├── webhookSubscription.prisma
│   ├── inquiry.prisma
│   ├── customer.prisma
│   └── ...
├── seed.ts           # Seed script
└── seeds/            # Seed data files
```

**For model definitions and relationships:** See the schema files directly at `packages/db/prisma/schema/`. Each file is self-documenting with Prisma schema syntax.

### Generator Output

```
packages/db/src/generated/
├── client/           # Prisma client
├── prismaMap.gen.ts  # Runtime model map (@inixiative/prisma-map)
└── zod/              # Zod schemas (prisma-zod-generator)
```

---

## Scripts

Run from repo root or `packages/db`:

| Script | Command | Purpose |
|--------|---------|---------|
| Generate | `bun run db:generate` | Generate Prisma client + Zod schemas |
| Push | `bun run db:push` | Push schema to DB, no migration (`db:push:dev` = worktree-aware local + test push) |
| Migrate | `bun run db:migrate` | Create a migration file (`prisma migrate dev`) — after launch |
| Deploy | `bun run db:deploy` | Apply migrations (`prisma migrate deploy`) — after launch |
| Baseline | `bun run db:baseline` | Create `prisma/migrations/0_init` from the schema; the Launch step runs it |
| Studio | `bun run db:studio` | Open Prisma Studio GUI |
| Seed | `bun run db:seed` | Run seed script |

### Schema Changes: Push Before Launch, Migrations After

The cut-over is `launched` in `project.config.ts`, flipped by the init script's Launch step. **Before launch a deployed database is disposable:** schema reaches it by `prisma db push --accept-data-loss`, which drops whatever no longer fits. **After launch nothing may clobber a database:** schema reaches it only through committed migrations, applied by `prisma migrate deploy`, and the push paths close.

| | Pre-launch (`launched: false`, the default) | Launched |
|---|---|---|
| Release step (`scripts/db/release.sh`) | `prisma db push --accept-data-loss`, then the non-prime seed | `prisma migrate deploy`, then the non-prime seed |
| Changing the schema | edit `prisma/schema/`, `bun run db:generate && bun run db:push` (`db:push:dev` in a worktree) | `bun run db:migrate` creates a migration under `packages/db/prisma/migrations/`; review and commit it |
| `setup.sh` | pushes and seeds the local database | skips push and seed |
| Migration files | none | start at `0_init`, created by Launch |

`scripts/checkLaunched.ts` reads the flag for the shell scripts. Guards that hold either way: `db:push:force` refuses outside `test`/`local`, and both it and `push-dev.sh` push through `scripts/db/push-local.sh`, which refuses a non-local `DATABASE_URL`. Those databases are throwaway per-worktree Docker containers, so `push-local.sh` carries the owner's consent for Prisma's AI-agent guard and agents can run the tests; `release.sh` never does.

**What Launch does** (init → Launch, [#197](https://github.com/inixiative/template/pull/197)): `bun run db:baseline` writes `prisma/migrations/0_init` as the diff from an empty database to `prisma/schema` (once); for prod, and staging when enabled, it checks the deployed database matches `prisma/schema` and otherwise blocks launch ("deploy the current schema there, then launch"); it records `0_init` as applied on each (`prisma migrate resolve --applied 0_init`); then it sets `launched = true`. Commit `prisma/migrations` and `project.config.ts` together.

**Not built:** nothing invokes `scripts/db/release.sh`. The Railway services the init creates run only `db:generate` at build and start the API/worker, and `scripts/deployment/deploy.sh` is a stub. Until a deploy hook runs it, the release step is run by hand against the target database.

### Development Workflow

```bash
# After schema changes
bun run db:generate   # Regenerate client
bun run db:push       # Pre-launch: push to the local DB (in a worktree: bun run db:push:dev)
bun run db:migrate    # Launched: create a migration, review it, commit it
```

### Database Operations

```bash
bun run db:dump                 # Export database to file
bun run db:restore              # Import from file
bun run db:clone                # Clone remote DB to local (auto-truncates webhooks)
bun run db:truncate:webhooks    # Clear webhook subscriptions (local/test only)
```

**Note:** `db:clone` automatically truncates webhook subscriptions after restore to prevent production webhooks from firing in local environment.

---

## Seeding

### Prime Development Data

The template includes a **prime seed** - foundational development data with pre-configured users, org, space, and tokens.

**Usage:**

```bash
# Seed without prime data (production-safe data only)
bun run db:seed

# Include prime development data
bun run db:seed --prime

# Seed specific table
bun run db:seed --prime user
```

**Prime includes:**
- 3 Users with hashed passwords (password: `asd123!`)
  - `super@inixiative.com` - Platform superadmin
  - `owner@inixiative.com` - Org/space owner
  - `customer@inixiative.com` - Org/space member
- 1 Organization (Acme Corporation)
- 1 Space (Main Space)
- 3 API Tokens:
  - `local_user_owner_personal` - Personal token (User scope)
  - `local_orgUser_acme_main` - Organization token (Org scope)
  - `local_spaceUser_acme_main` - Space token (Space scope)

**Production behavior:**
- Prime data automatically skipped in `NODE_ENV=production`
- `bun run db:seed` automatically sets `NODE_ENV=development` for local use
- Only production-safe seed data is applied in production

### Seed Architecture

**Location:** `packages/db/prisma/seeds/`

```typescript
// Each seed file exports a SeedFile
export const userSeeds: SeedFile = {
  model: 'user',                                    // Prisma model name
  updateOmitFields: ['createdAt'],                  // Don't overwrite these on update
  createOnly: false,                                // Optional: only create, never update
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000001',  // Required: valid UUIDv7 for upsert
      email: 'user@example.com',
      prime: true,                                  // Prime flag: only seed with --prime
      // ... other fields
    },
  ],
};
```

**Features:**
- **ID-based upsert** - Always upserts by `id` field (create or update)
- **Concurrent processing** - Uses `resolveAll` with concurrency: 10
- **UUIDv7 validation** - Validates all IDs are valid UUIDv7 format
- **UUID uniqueness check** - Ensures no duplicate IDs across all seed files
- **FK-safe ordering** - Tables seeded sequentially, records concurrently
- **Prime flag** - Mark records as prime (dev-only, requires `--prime`)

### Adding Seed Data

1. **Create seed file** in `packages/db/prisma/seeds/`
2. **Define records** with unique UUIDv7 `id` fields
3. **Add to index** in correct FK order
4. **Mark prime data** with `prime: true`

**Important:** All `id` fields must be valid UUIDv7 format. The seed script validates version 7 specifically to ensure time-sortability and consistency.

**Example:**

```typescript
// packages/db/prisma/seeds/product.seed.ts
import type { SeedFile } from '../seed';

export const productSeeds: SeedFile = {
  model: 'product',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000101',
      name: 'Widget',
      price: 9.99,
      // No prime flag = always seed (production-safe)
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000102',
      name: 'Test Product',
      price: 0.01,
      prime: true,  // Only seed with --prime flag
    },
  ],
};

// packages/db/prisma/seeds/index.ts
import { productSeeds } from './product.seed';

const seeds = [
  // ... other seeds
  productSeeds,  // Add in FK-safe order
];
```

### Seed Order (FK Constraints)

Seeds run **sequentially by table** (respects FK constraints), **concurrently by record** (performance):

```typescript
const seeds = [
  userSeeds,              // 1. Users (no dependencies)
  accountSeeds,           // 2. Accounts + passwords (→ users)
  organizationSeeds,      // 3. Organizations (no dependencies)
  organizationUserSeeds,  // 4. Org memberships (→ users, orgs)
  spaceSeeds,             // 5. Spaces (→ orgs)
  spaceUserSeeds,         // 6. Space memberships (→ users, spaces)
  tokenSeeds,             // 7. Tokens (→ users, orgs, spaces)
];
```

### Password Seeding

Prime users include pre-hashed passwords (bcrypt):

```typescript
// packages/db/prisma/seeds/account.seed.ts
import { hashSync } from 'bcryptjs';

const HASHED_PASSWORD = hashSync('asd123!', 10);

export const accountSeeds: SeedFile = {
  model: 'account',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000011',
      userId: '01936d42-8c4a-7000-8000-000000000001',
      accountId: 'user@example.com',
      providerId: 'credential',
      password: HASHED_PASSWORD,
      prime: true,
    },
  ],
};
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

A row keyed to a space or a space member reaches it through a composite key that carries the organization: `Space` by `(organizationId, spaceId)` → `(organizationId, id)`, `SpaceUser` by `(organizationId, spaceId, userId)`, `OrganizationUser` by `(organizationId, userId)`. The organization is part of the row's tenancy, so a space transfer re-keys all of it in one statement by `ON UPDATE CASCADE` (INQUIRIES.md, *Transferring a space*). `packages/db/src/registries/spaceKeys.test.ts` fails when a Space- or SpaceUser-owned model carries the org outside such a key.

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

### Reference Data (Code, Not Rows)

Countries, currencies, languages and time zones are constants in `@template/shared/reference` (`packages/shared/src/reference/`), never tables or seed rows.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A list of countries, currencies, languages or time zones: "a country dropdown", "how many decimals does this currency have", "the dialing code for this country" | **COUNTRIES**, **CURRENCIES**, **LANGUAGES**, **TIMEZONE_IDS** · primitive `packages/shared/src/reference/index.ts` — each has its code type and Zod schema (`CountryCodeSchema`, `CurrencyCodeSchema`, `LanguageCodeSchema`, `TimezoneIdSchema`), a guard (`isCountryCode`, …) and lookups: `countryByCode`, `callingCodeFor`, `countryNameFor`, `currencyByCode`, `decimalsFor`, `symbolFor`, `languageByCode`, `currentOffsetMinutes` | this section | a `Country` or `Currency` model or seed file; a hand-typed list of ISO codes; an npm country/currency package |

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

For type-safe access via a concrete delegate, use the `query` helper:

```typescript
import { db, query } from '@template/db';

const previous = await query.findUnique(db.user, { where: { id } });
// fully typed from the delegate
```

(Inside the lifecycle extension the prior record is fetched by model name via an internal runtime delegate, and hooks receive it as `previous` automatically.)

---

## Client Methods

```typescript
import { db } from '@template/db';

db.user.findMany()      // Uses txn if active, else raw
db.raw.user.findMany()  // Always raw, bypasses txn
db.scope(id, fn)        // Create AsyncLocalStorage context
db.txn(fn)              // Start transaction
db.onCommit(fns)        // Queue callbacks for after commit
db.onFinally(fns)       // Queue callbacks for when the txn ends, commit or rollback
db.findForUpdate(model, where, opts?) // SELECT ... FOR UPDATE; { upserting: true } fences a missing row
db.withLockUntilSettled(lockOptions, fn, acquireOptions?) // Redis lock held until the txn ends
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

### Finally Callbacks

`db.onFinally(fns)` queues callbacks that run when the transaction ends, whether it commits or rolls
back. They drain after the database transaction has settled (never before the commit lands) and
before the `onCommit` callbacks, without waiting for them. Every callback runs even if one throws;
failures are logged and never replace the transaction's own result or error. Like `onCommit`, it
throws outside `db.txn()`, and a nested `db.txn()` registers on the outermost transaction.

### Redis Locks Held Until the Transaction Ends

A lock taken inside a transaction must outlive the code that took it: the writes made under it are
invisible to everyone else until the commit, so releasing when `fn` returns lets the next holder read
the state before them. `db.withLockUntilSettled(lockOptions, fn, acquireOptions?)` takes a `createLock`
lock (same options; `acquireOptions` is `{ waitMs, pollMs, onTimeout }`), runs `fn`, and releases the
lock on the transaction's finally queue (the one `db.onFinally` feeds) once the transaction settles,
commit or rollback. The release is queued before the wait starts, so an acquisition that finishes
after the transaction ended is still released, and that late holder throws instead of running `fn`
outside the transaction. It throws outside `db.txn()`.

- **One acquisition per transaction.** A second take of a key the transaction holds, or is still
  waiting for, joins it instead of waiting on itself: a nested `db.txn()`, later rounds of a
  `transactionAll` batch, parallel sub-requests of one round.
- **Holders inside the transaction still run one at a time**, in call order (a per-key
  `createSerializedQueue` on the transaction), so parallel branches each see what the one before
  wrote. A take from inside a holder's own `fn` runs straight through. The queue wait has no
  deadline (`waitMs` bounds only the Redis wait), so a holder must not await a sibling holder of the
  same key, and a transaction taking several keys takes them in one fixed order everywhere.
- **Timeouts.** A wait past `waitMs` throws `onTimeout()` (or an error naming the key) and the
  transaction rolls back. Keep `waitMs` under the transaction's own timeout. The lease is
  heartbeat-renewed, so a long transaction keeps it.

`withOwnerLock` (`apps/api/src/lib/locks/withOwnerLock.ts`) uses it whenever it is called inside a
transaction; outside one it takes and releases a plain `createLock` lock around `fn`. Upserting
`findForUpdate` holds its keys the same way.

### Row Locks and Create-If-Missing

`db.findForUpdate(model, where)` runs `SELECT * ... FOR UPDATE` inside `db.txn()`. A row that does
not exist yet locks nothing, so find-then-create races: two callers both see nothing and both
insert. Do not answer that with a bare `upsert` or a caught unique violation — fence the key:

```typescript
await db.txn(async () => {
  const [existing] = await db.findForUpdate<User>('User', { email }, { upserting: true });
  return existing ?? db.user.create({ data: { email, name } });
});
```

`upserting: true` takes a Redis lock (`createLock`, service `find-for-update`, keyed on the model
plus the where entries sorted by key, hashed) **before** the `SELECT`, and holds it until the
transaction ends, the same way `db.withLockUntilSettled` does. The where must be scalar
equalities (no arrays, operator objects, `null` or `undefined`), except that one field may list
values as `{ in: [...] }`, fencing each value under the key a single-row fence on it takes. A caller that cannot get the lock waits up to
`waitMs` (default 3000ms, inside Prisma's 5000ms interactive default) and then throws
`FindForUpdateLockTimeoutError`, rolling its transaction back. Fencing the same key twice in one
transaction does not wait on itself. The `no-create-race-machinery` CI rule fails a change that
adds a bare `.upsert(` or a unique-violation catch to a file.

---

## Query Building Utilities

Located in `apps/api/src/lib/prisma/`.

### buildWhereClause

Constructs Prisma `where` clauses with search support:

```typescript
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';

const where = buildWhereClause({
  search: 'john',                        // Simple search string
  searchFields: { email: 'example.com' }, // Field-specific search
  searchableFields: ['name', 'email', 'user.email'],
  filters: { deletedAt: null },          // Additional filters
});

const users = await db.user.findMany({ where });
```

**What it does:**
1. Applies `search` across all `searchableFields` (case-insensitive `contains`, OR logic)
2. Applies `searchFields` to individual fields (case-sensitive; a bare String value is `contains`; pass `mode: 'insensitive'` to opt in), AND logic with search
3. Escapes LIKE metacharacters (`%`, `_`, `\`) in `contains` / `startsWith` / `endsWith`, an insensitive `equals` / `not`, Json `string_*`, and the `search` term, so a value matches only itself
4. Merges with `filters` object
5. Returns combined `where` clause

**Security:** Uses `validatePathNotation()` to prevent injection attacks on nested field paths.

**Example output:**
```typescript
buildWhereClause({
  search: 'test',
  searchableFields: ['name', 'email'],
  filters: { deletedAt: null }
});
// Returns:
// {
//   AND: [
//     { deletedAt: null },
//     { OR: [
//       { name: { contains: 'test', mode: 'insensitive' } },
//       { email: { contains: 'test', mode: 'insensitive' } }
//     ]}
//   ]
// }
```

> The explicit `deletedAt: null` above is no longer required — see Soft-delete read scoping below.

### Soft-delete read scoping

A Prisma client extension (`packages/db/src/extensions/softDeleteScopeExtension.ts`) auto-injects `deletedAt: null` into every read (`findMany`/`findFirst`/`findUnique`/`count`/`aggregate`/`groupBy`) and every write `where` (`update`/`delete`/`upsert`), plus nested `include`/`select` trees, for any model that has a `deletedAt` column. You do **not** hand-write `deletedAt: null` — forgetting it can no longer leak soft-deleted rows.

One bypass, `db.withDeleted(fn)`: it runs `fn` with scoping off (revive, redaction/GDPR, inspecting tombstones). Must be `await`ed inside the callback. Who the caller is never unscopes anything — **the endpoint decides**. `validateSuperadmin`, mounted on `adminRouter`, runs the rest of the request inside `db.withDeleted`, so superadmin endpoints read and write tombstones; every other route is scoped for every caller, superadmin included.

The extension is the only soft-delete scoping layer — no middleware, `paginate` or lens code adds `deletedAt: null` by hand. It covers the root `where` (including relation filters like `some`/`every`/`is`), nested `include`/`select` trees, `_count` relation counts, `count`/`aggregate`/`groupBy` (the lens count plans). Its engine (`liveWhere` / `liveIncludes`, `packages/db/src/extensions/softDeleteScope.ts`) lives beside it in `packages/db`. It is not a mutation-lifecycle hook and needs no registration: the client composes it (`client.ts`, `.$extends(softDeleteScopeExtension())`), so every process and every test sees what production sees. A test that inspects a tombstone wraps the read in `db.withDeleted`.

Write `where`s are scoped too, so a soft-deleted row can't be mutated without a bypass. Cascade revive is exempt automatically: it matches on an explicit `deletedAt` value, and an explicit `deletedAt` mention in a `where` opts that query out of injection.

### Path Notation Utilities

Support for dot-notation field access in queries:

```typescript
import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';

// Build nested query structure
buildNestedPath('user.email', { contains: 'example.com' });
// Returns: { user: { email: { contains: 'example.com' } } }

buildNestedPath('organization.user.email', { contains: 'test' });
// Returns: { organization: { user: { email: { contains: 'test' } } } }

// Validate path safety
validatePathNotation('user.email');        // true
validatePathNotation('user..email');       // false (double dots)
validatePathNotation('user;email');        // false (invalid chars)
validatePathNotation('a.b.c.d.e.f');       // false (exceeds max depth of 5)
validatePathNotation('_private.field');    // false (starts with underscore)
```

**Use cases:**
- Dynamic orderBy from query params
- Dynamic search fields from user input
- Nested filtering without SQL injection risk

**Security limits:**
- Max depth: 5 levels (configurable via `MAX_PATH_DEPTH`)
- Allowed chars: `a-zA-Z0-9.` only
- No consecutive dots
- No leading/trailing dots
- No underscore prefixes (prevents access to internal fields)

**Integration with buildWhereClause:**
```typescript
// Safe nested field search
const where = buildWhereClause({
  searchFields: {
    'user.email': 'example.com',
    'organization.name': 'acme'
  },
  searchableFields: ['name', 'user.email', 'organization.name']
});
// Automatically uses buildNestedPath internally
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

### Delegated Keys

An axis value can name a parent in `delegates`: the row carries the parent's own owner keys beside its own. A Token with `ownerModel: Integration` requires `integrationId` and also carries its integration's `userId` / `organizationId` / `spaceId`, so tenancy scans stay plain column filters. The `falsePolymorphism:delegatedKeys` hook copies them from the parent on create and upsert through `carryDelegatedKeys`, which the test factory also calls, so the two never disagree; the write rule neither requires nor forbids them, and request bodies never carry them.

See [HOOKS.md](HOOKS.md#false-polymorphism) for validation.

---

## Registries

Schema-level configuration in `packages/db/src/registries/`:

| Registry | Purpose | Used By |
|----------|---------|---------|
| `PolymorphismRegistry` | Axis value → required FK columns | Constraints, validation hooks, immutable fields, the helpers below |

| Helper (`@template/db`) | Derives |
|---|---|
| `polymorphicAxis(model, axisField)` | The axis config; throws on an unknown model or axis |
| `delegatedKeys(axis, value)` / `carryDelegatedKeys(model, row)` | The parent keys a delegating value carries; copy them from the parent row (the hook and the test factory both call it) |
| `polymorphicKeyColumn` / `polymorphicTarget` | The key column for a value; the `{ kind, id }` a row points at |
| `polymorphicIs(model, axisField)` | json-rules condition "this row's axis points at the bound row" |
| `polymorphicBindings(ownerModel, ownerId)` | The bind map `polymorphicIs` reads for a `User`, `Organization` or `Space` owner: `{ userId \| organizationId \| spaceId: ownerId }` (`POLYMORPHIC_BINDS`, `isOwnerKind`) |
| `isFalsePolymorphismRef(ref)` / `resolveFalsePolymorphismRef(ref)` | A `FlexibleRef` is a model name or a `FalsePolymorphismRef` `{ model, axis, value }`; the guard tells them apart, and resolve returns that value's FK column (null on an unknown model, axis or value) |
| `polymorphicSchema(model, axisField, { only?, omit?, extend? })` | Request-body Zod schema, one strict arm per value ([HOOKS.md](HOOKS.md#request-validation)) |

```typescript
import { PolymorphismRegistry, getPolymorphismConfig } from '@template/db';

const config = getPolymorphismConfig('Token');
// { axes: [{ field: 'ownerModel', fkMap: { User: ['userId'], ... } }] } | null
```

See [HOOKS.md](HOOKS.md#false-polymorphism) for how hooks use this registry.

---

## Schema Reference

For complete model definitions, relationships, and fields, see the schema files directly:

**Location:** `packages/db/prisma/schema/`

**Core Models:**
- `user.prisma` - User accounts and authentication
- `account.prisma` - BetterAuth account data (passwords, OAuth)
- `authProvider.prisma` - Multi-provider auth configuration (OAuth/SAML)
- `organization.prisma` - Multi-tenant organizations
- `organizationUser.prisma` - Organization memberships and roles
- `space.prisma` - Flexible containers within organizations
- `spaceUser.prisma` - Space memberships (requires organization membership)
- `token.prisma` - API tokens (user/org/space scoped)
- `webhookSubscription.prisma` - Webhook configurations
- `project.prisma` - `Project`: a unit of work an owner organizes things around (name, optional description). False-polymorphic over all five owners (User, OrganizationUser, Organization, Space, SpaceUser); names are unique per owner among live rows, so one repo can be a project in several tenants. Taggable (`TagResource.Project`). Routes: `/me/projects` and `/{organization,organizationUser,space,spaceUser}/:id/projects` to create and list, `/project/:id` to read, update and delete
- `inquiry.prisma` - False polymorphic inquiry system
- `integrationRecord.prisma` - One record's standing in one integration (false-polymorphic over `WebhookModel`); `poisonedAt` makes sendWebhook skip the record
- `customerRef.prisma` - Customer references (false-polymorphic customer User/Organization/Space → provider)
- `segment.prisma` / `segmentMember.prisma` - Segments: a provider-owned (false-polymorphic over `ProviderModel`) named set of its customer references. Every segment has json-rules `conditions` over the segment lens; `static` is computed when created or its conditions change, `dynamic` is recomputed continuously by the reconcile jobs. A hand-picked audience is a static segment whose rule is `id in [...]`. Members are written only by reconcile. See [SEGMENTS.md](SEGMENTS.md) for rules, reconciliation, API routes and the Owned/Memberships pages
- `flow.prisma` - `Flow`: one user's short-lived walk through a registered flow (`flowKey`, resolved `steps`, optional `returnUrl`); deleted after 15 idle minutes. See [FLOWS.md](FLOWS.md)
- `contact.prisma` - Unified contact-info entries (phone/email/social handles), false-polymorphic owner (User/Organization/Space), per-type validation registry, per-owner uniqueness on `(ownerModel, …, type, valueKey)`, optional row-level `permissionRules` for sharing

**Communications:**
- See [COMMUNICATIONS.md](COMMUNICATIONS.md#database-models) for email template models

Each schema file is self-documenting with:
- Model definitions
- Field types and constraints
- Relations and foreign keys
- Unique constraints and indexes
- Enums and their values

**Why schema files over docs?** Schema files are the source of truth and stay in sync automatically. Duplicating schema definitions in documentation creates a maintenance burden.
