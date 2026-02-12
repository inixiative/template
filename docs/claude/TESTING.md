# Testing

## Contents

- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Factories](#factories)
- [Test App](#test-app)
- [Request Helpers](#request-helpers)

---

## Running Tests

```bash
bun test                          # Run all (from root)
bun run '--filter=api' test         # Run API tests
bun run '--filter=@template/db' test # Run DB package tests
```

### Environment Composition

Each package's test script uses the `with` script to load environment variables:

```json
"test": "bun run --cwd ../.. with test api bun test"
```

This ensures tests run with `.env.test` files loaded. When adding a new package with tests, follow this pattern.

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

### build vs create

```typescript
import { buildUser, createUser } from '@template/db/test';

// build - in-memory only, no database write (fast, for unit tests)
const { entity: user } = await buildUser();

// create - persists to database (for integration tests)
const { entity: user } = await createUser();
```

Both have same signature: `(overrides?, context?) => Promise<{ entity, context }>`

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

```typescript
import { cleanupTouchedTables } from '@template/db/test';

afterAll(async () => {
  await cleanupTouchedTables(db);
});
```

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

## Test App

```typescript
import { createTestApp } from '#tests/createTestApp';

const harness = createTestApp({
  mockUser: user,                    // Authenticated as this user
  mockOrganizationUsers: [orgUser],  // User's org memberships
  mount: [(app) => app.route('/api/v1/user', userRouter)],
});

const { fetch, db } = harness;
```

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
