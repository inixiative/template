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

Located in `packages/db/src/test/factories/`:

```typescript
import { createUser, createOrganization, createOrganizationUser } from '@template/db/test';

// Simple
const { entity: user } = await createUser();

// With overrides
const { entity: user } = await createUser({ name: 'Test' });

// With context (reuse related entities)
const { entity: org } = await createOrganization();
const { entity: orgUser } = await createOrganizationUser(
  { role: 'admin' },
  { organization: org }
);
```

### Context Keys

Context uses **camelCase** accessor names (matching `AccessorNames` from `@template/db`):

```typescript
const { entity, context } = await createOrganizationUser();
context.user          // The user (auto-created dependency)
context.organization  // The organization (auto-created dependency)
```

Factories auto-infer required dependencies from the schema. Pass existing entities via context to reuse them:

```typescript
import { AccessorNames } from '@template/db';

// AccessorNames = { user: 'user', organization: 'organization', ... }

// Create org first, reuse in orgUser
const { entity: org } = await createOrganization();
const { entity: orgUser } = await createOrganizationUser(
  { role: 'admin' },                    // Overrides
  { [AccessorNames.organization]: org } // Context - reuse existing org
);

// Or use string keys directly
const { entity: orgUser2 } = await createOrganizationUser(
  {},
  { organization: org, user: existingUser }
);
```

### Cleanup

```typescript
import { cleanupTouchedTables } from '@template/db/test';

afterAll(async () => {
  await cleanupTouchedTables(db);
});
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
