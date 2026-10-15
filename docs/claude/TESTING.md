# Testing

<!-- toc:start -->

## Contents

- [Running Tests](#running-tests)
  - [Concurrency](#concurrency)
  - [Environment Composition](#environment-composition)
- [Test Structure](#test-structure)
  - [Basic Test](#basic-test)
- [Factories](#factories)
  - [build vs create](#build-vs-create)
  - [Serialization for API/UI-Shaped Assertions](#serialization-for-apiui-shaped-assertions)
  - [Basic Usage](#basic-usage)
  - [Triggering Optional Dependencies](#triggering-optional-dependencies)
  - [Context Keys](#context-keys)
  - [Reusing Entities](#reusing-entities)
  - [Unique Data with getNextSeq](#unique-data-with-getnextseq)
  - [TypedBuildResult (Type Safety)](#typedbuildresult-type-safety)
  - [FK Auto-Inference](#fk-auto-inference)
  - [Composite Foreign Keys](#composite-foreign-keys)
  - [Cleanup](#cleanup)
  - [Test Data Patterns](#test-data-patterns)
- [VCR (external services)](#vcr-external-services)
- [Test App](#test-app)
- [Request Helpers](#request-helpers)
- [Frontend Testing (happy-dom)](#frontend-testing-happy-dom)

<!-- toc:end -->


---

## Running Tests

```bash
bun test                          # Run all (from root)
bun run --cwd apps/api test        # Run API tests only
bun run --cwd packages/db test     # Run DB package tests only
```

### Concurrency

DB-backed tests must run with `--max-concurrency=1` to prevent cross-file interference. Every test process tracks the tables it writes in one shared set (see [Cleanup](#cleanup)); concurrent file execution would let `cleanupTouchedTables` from one file clear tables another file is still using.

```json
"test": "bun run --cwd ../.. with test api bun test --max-concurrency=1"
```

### Environment Composition

Each package's test script uses the `with` script to load environment variables from `.env.test`. When adding a new package with DB-backed tests, follow this pattern and include `--max-concurrency=1`.

---

## Test Structure

Tests live in `tests/` folder within modules:

```
modules/user/
├── controllers/
├── routes/
└── tests/
    ├── userCreate.test.ts
    ├── userRead.test.ts
    └── userReadMany.test.ts
```

**Test the real thing.** A test exercises production code against real rows: create them with
factories in setup (`createUser()` before each test), call the real route or function, assert on
what it did. Module mocks are banned outright (`no-module-mocks` CI rule; external services go
through [VCR](#vcr-external-services)). A fake you wrote (a hand-built store, a stub service) and a
test that asserts on that fake prove nothing about the code: delete both and test the real one
(the real store via `createTestStore`, the real route via the test app). — fb: 2026-01-25, 2026-02-10

Signs you're bypassing it: a test file defining its own implementation of the thing under test;
assertions on a mock's call count as the only check; `if (...) mockReturnValue(...)` chains standing in
for data the factories could create.

### Basic Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createTestApp } from '#tests/createTestApp';
import { createUser } from '@template/db/test';

describe('userRead', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];

  beforeAll(async () => {
    const harness = createTestApp({ ... });
    fetch = harness.fetch;
  });

  it('returns user', async () => {
    const { entity: user } = await createUser();
    const response = await fetch(get(`/api/v1/user/${user.id}`));
    expect(response.status).toBe(200);
  });
});
```

---

## Factories

Located in `packages/db/src/test/factories/`.

Use a factory whenever one exists; never hand-build a DB record a factory covers.

Every factory injects the bookkeeping columns a model has: `id` (`Bun.randomUUIDv7()`, the same v7
format as the schema default), `createdAt`, `updatedAt` and `deletedAt: null` (`packages/db/src/test/factory.ts`).
Don't pass them; override one only when the test is about it (an explicit past `createdAt` for
ordering). — fb: 2026-01-25

### build vs create

```typescript
import { buildUser, createUser } from '@template/db/test';

// build - in-memory only, no database write (fast, for unit tests)
const { entity: user } = await buildUser();

// create - persists to database (for integration tests)
const { entity: user } = await createUser();
```

Both have same signature: `(overrides?, context?) => Promise<{ entity, context }>`

### Serialization for API/UI-Shaped Assertions

Factory entities include a runtime `__serialize()` helper that converts `Date` fields to ISO strings (recursively).

Use it when asserting against API/SDK-shaped types (which use string timestamps):

```typescript
const { entity } = await buildOrganization({ id: 'org-1', name: 'Test Org' });
const organization = entity.__serialize();

store.getState().tenant.setPage({ organization });
```

This keeps cross-system factory usage while matching frontend/API type contracts.

When a factory override provides a non-null Date for a nullable field, inferred serialization reflects that narrowing:

```typescript
const { entity } = await buildOrganization({
  deletedAt: new Date('2024-01-01T00:00:00.000Z'),
});

const organization = entity.__serialize();
// organization.deletedAt is inferred as string here (not string | null)
```

### Basic Usage

```typescript
import { createUser, createOrganization, createOrganizationUser } from '@template/db/test';

// Simple
const { entity: user } = await createUser();

// With overrides
const { entity: user } = await createUser({ name: 'Test' });

// With context (reuse related entities)
const { entity: organization } = await createOrganization();
const { entity: organizationUser } = await createOrganizationUser(
  { role: 'admin' },
  { organization }
);
```

### Triggering Optional Dependencies

Some models have optional FKs. Pass an empty object `{}` to trigger creation:

```typescript
import { createToken } from '@template/db/test';

// Token has optional organizationUser FK
// By default, it won't create one

// Pass {} to trigger creation of the optional dependency
const { entity: token, context } = await createToken({
  organizationUser: {}  // Creates OrganizationUser (and its User + Organization)
});

context.organizationUser  // Now exists
context.user              // Also created
context.organization      // Also created
```

### Context Keys

Context uses **camelCase** accessor names (matching `AccessorNames` from `@template/db`):

```typescript
const { entity, context } = await createOrganizationUser();
context.user          // The user (auto-created dependency)
context.organization  // The organization (auto-created dependency)
```

### Reusing Entities

Pass existing entities or entire context to reuse them:

```typescript
// Pass individual entities
const { entity: organization } = await createOrganization();
const { entity: organizationUser } = await createOrganizationUser({}, { organization });

// Or pass entire context from previous factory
const { context } = await createOrganizationUser();
const { entity: session } = await createSession({}, context);
// Session reuses the user from context
```

### Unique Data with getNextSeq

Use `getNextSeq()` for unique values in tests:

```typescript
import { getNextSeq } from '@template/db/test';

const seq = getNextSeq();  // Returns incrementing number
const email = `user-${seq}@test.com`;  // Guaranteed unique

// Factories use this internally for default values
```

### TypedBuildResult (Type Safety)

When writing custom factories, use `TypedBuildResult` for type-safe context:

```typescript
import type { TypedBuildResult } from '@template/db/test';

// Declares that OrganizationUser factory always creates User and Organization
type Result = TypedBuildResult<'OrganizationUser', ['User', 'Organization']>;

// Now context.user and context.organization are guaranteed non-null
const { entity, context }: Result = await createOrganizationUser();
context.user;         // User (not User | undefined)
context.organization; // Organization (not Organization | undefined)
```

### FK Auto-Inference

Factories auto-infer dependencies from FK field names using `{modelName}Id` pattern:

| FK Field | Inferred Model | Works? |
|----------|----------------|--------|
| `userId` | `User` | ✓ |
| `organizationId` | `Organization` | ✓ |
| `createdById` | `CreatedBy` | ✗ (no model) |
| `subscriptionId` | `Subscription` | ✗ (ambiguous) |

For non-standard FKs, add manual factory logic or use context.

### Composite Foreign Keys

For models with composite FKs (multiple fields pointing to one dependency), use an object format:

```typescript
// In factory definition
dependencies: {
  organizationUser: {
    modelName: 'OrganizationUser',
    foreignKey: { organizationId: 'organizationId', userId: 'userId' },
    required: true,
  },
}
```

Format: `{ targetField: sourceField }` means:
- Read `targetField` FROM the dependency
- Set `sourceField` ON the model being created

Example: SpaceUser requires OrganizationUser via composite FK:

```typescript
// Factory copies organizationId and userId from OrganizationUser to SpaceUser
foreignKey: { organizationId: 'organizationId', userId: 'userId' }
```

Compare to simple FK:
```typescript
// Simple: just sets webhookSubscriptionId from dependency's id
foreignKey: 'webhookSubscriptionId'
```

### Cleanup

Tests are DB-backed: they write real rows through the real client with the factories, and reset with `cleanupTouchedTables`. Mocks stay minimal.

```typescript
import { cleanupTouchedTables } from '@template/db/test';

afterAll(async () => {
  await cleanupTouchedTables(db);
});
```

- **The tracker is always on.** `packages/db/src/client.ts` calls `registerTestTracker()` when the client loads; in a test environment it records every table a create/update/upsert/delete touches (outside test it's a no-op). Never call `registerTestTracker()` in a test file: `scripts/lint/check-test-tracker-registration.sh` fails it.
- **`cleanupTouchedTables(db)` empties those tables** and resets the set (`packages/db/src/test/testTracker.ts`). It bypasses the soft-delete scope, so soft-deleted rows go too.
- **Cleanup is per file.** Most files seed in `beforeAll` and clean in `afterAll`. Clean in `afterEach` only when every test seeds its own rows; a per-test cleanup deletes a `beforeAll` seed.
- **Never delete rows by hand** (`delete`/`deleteMany`/`TRUNCATE`/`DELETE FROM`) in an after hook: `scripts/lint/check-test-hand-cleanup.sh` fails it. A hand delete either duplicates the cleanup or hides a write the tracker missed; fix the blind spot instead. Ruling: [DB-004](../../tickets/DB-004-test-tracker-always-on.md).

### Test Data Patterns

**Always Use Factories:**

```typescript
// ✅ CORRECT - Use factory with minimal overrides
import { createAuthProvider } from '@template/db/test';
await createAuthProvider({ encryptedSecretsKeyVersion: 2 });

// ❌ WRONG - Manual db.create() with data objects
await db.authProvider.create({
  data: {
    organizationId: organizationId(org.id),
    type: 'OAUTH',
    provider: 'test',
    name: 'Test',
    enabled: true,
    config: {},
    encryptedSecrets: '...',
    encryptedSecretsMetadata: { ... },
    encryptedSecretsKeyVersion: 2,
  },
});
```

**Factory Dependencies Are Auto-Inferred:**

```typescript
// ✅ CORRECT - Dependencies inferred from schema
const authProviderFactory = createFactory('AuthProvider', {
  defaults: () => ({
    type: AuthProviderType.OAUTH,
    provider: 'google',
    // ... other defaults
  }),
  // No dependencies object needed - organizationId auto-inferred
});

// ❌ WRONG - Manually specifying inferred dependencies
const authProviderFactory = createFactory('AuthProvider', {
  defaults: () => ({ ... }),
  dependencies: {
    organization: {  // Unnecessary - auto-inferred from organizationId FK
      modelName: 'Organization',
      foreignKey: { id: 'organizationId' },
      required: true,
    },
  },
});
```

**When to Create a New Factory:**

Before writing test data manually:
1. Check if factory exists: `/packages/db/src/test/factories/`
2. If not, create factory following existing patterns
3. Export from `/packages/db/src/test/factories/index.ts`
4. Use in tests with minimal overrides

**Factory Creation Pattern:**

```typescript
// packages/db/src/test/factories/modelFactory.ts
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const modelFactory = createFactory('Model', {
  defaults: () => ({
    name: faker.company.name(),
    enabled: true,
    // Only required fields with sensible defaults
  }),
  // Only add dependencies object for:
  // - Composite FKs (organizationId + userId)
  // - Optional dependencies needing custom behavior
  // - Non-standard FK patterns (createdById, etc.)
});

export const buildModel = modelFactory.build;
export const createModel = modelFactory.create;
```

---

## VCR (external services)

Tests never call a live provider. A client that talks to an external service wraps each call in `VCR` from `@template/shared/vcr`:

```typescript
readonly vcr = new VCR(FIXTURES_DIR, { service: 'resend', version: () => '…', sanitizers });

send(options) {
  return this.vcr.capture('send', () => this.__send(options));
}
```

- Outside tests `capture` calls straight through.
- In tests the test queues a cassette per call (`client.vcr.queue('send', 'accepted')`); `capture` replays it, or records a sanitized one when the file is missing or its `version` differs from the service's current version.
- A recorded `status >= 400` replays as a thrown error.
- Sanitizers redact keys before a cassette is written; commit only sanitized cassettes.

Used by `packages/email` (Resend, Bouncer) and the `init/api/*` clients (all but `cloudflare` and `resend`).

## Test App

```typescript
import { createTestApp } from '#tests/createTestApp';

const harness = createTestApp({
  mockUser: user,                    // Authenticated as this user
  mockOrganizationUsers: [orgUser],  // User's org memberships
  mockSpaceUsers: [spaceUser],       // User's space memberships
  mount: [(app) => app.route('/api/v1/user', userRouter)],
});

const { fetch, db } = harness;
```

If `mockUser.platformRole === 'superadmin'`, the test harness automatically calls `permix.setSuperadmin(true)`, enabling the superadmin bypass on all permission checks. Use this to test `resolve` on admin-targeted inquiries or any route that requires superadmin.

---

## Request Helpers

```typescript
import { get, post, patch, del, json } from '#tests/utils/request';

// GET
const response = await fetch(get('/api/v1/users'));

// POST with body
const response = await fetch(post('/api/v1/users', { name: 'Test' }));

// PATCH
const response = await fetch(patch(`/api/v1/users/${id}`, { name: 'Updated' }));

// DELETE
const response = await fetch(del(`/api/v1/users/${id}`));

// Parse response
const { data } = await json<User>(response);
const { data, pagination } = await json<User[]>(response);
```

---

## Frontend Testing (happy-dom)

Frontend packages use `@happy-dom/global-registrator` for DOM testing. Each package/app has its own preload:

- `packages/ui/bunfig.toml` → `src/test/setup.ts`
- `apps/web/bunfig.toml` → `src/test/setup.ts`
- `apps/admin/bunfig.toml` → `src/test/setup.ts`
- `apps/superadmin/bunfig.toml` → `src/test/setup.ts`

**Important:** Tests must run from the package directory (bun reads `bunfig.toml` from CWD):

```bash
# Correct — preload activates:
cd packages/ui && bun run test

# Also correct — via root scripts:
bun run test:fe

# WRONG — preload not found, DOM tests fail:
bun test packages/ui/src
```

The `setup.ts` file must ONLY call `GlobalRegistrator.register()`. Do not import `@testing-library/react` or other libs — ES module imports are hoisted and those libs evaluate before the DOM exists.
