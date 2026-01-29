# Hooks

## Contents

- [Mutation Lifecycle](#mutation-lifecycle)
- [Registering Hooks](#registering-hooks)
- [Application Hooks](#application-hooks)
- [Webhooks](#webhooks)
- [Cache Invalidation](#cache-invalidation)
- [False Polymorphism](#false-polymorphism)
- [Rules Registry](#rules-registry)
- [Immutable Fields](#immutable-fields)

---

## Mutation Lifecycle

All Prisma mutations wrapped with before/after hooks via `mutationLifeCycle` extension.

### Hook Options

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Prisma model name |
| `action` | DbAction | create, update, delete, etc. |
| `args` | object | Prisma query args |
| `result` | object/array | Mutation result (after only) |
| `previous` | object/array | Previous state (if fetched) |

### Action Types

| Action | result | previous |
|--------|--------|----------|
| `create`, `update`, `delete`, `upsert` | single | single |
| `createManyAndReturn`, `updateManyAndReturn`, `deleteMany` | array | array |

---

## Registering Hooks

```typescript
import { registerDbHook, DbAction, HookTiming } from '@template/db';

registerDbHook(
  'myHook',                           // Hook name
  'User',                             // Model (or '*' for all)
  HookTiming.after,                   // before or after
  [DbAction.create, DbAction.update], // Actions
  async ({ model, action, args, result, previous }) => {
    // Hook logic
  }
);
```

---

## Application Hooks

Located in `apps/api/src/hooks/`:

| Hook | Purpose |
|------|---------|
| `cache` | Cache invalidation on mutations |
| `webhooks` | Webhook delivery on mutations |
| `immutableFields` | Prevents FK field updates |
| `rules` | Declarative validation |
| `falsePolymorphism` | Type enum + FK validation |

All registered via `registerHooks()` in entry points.

---

## Webhooks

Automatic webhook delivery on database mutations.

### Enabling Webhooks for a Model

```typescript
// hooks/webhooks/constants/enabledModels.ts
export const webhookEnabledModels: WebhookModel[] = [
  WebhookModel.User,
  WebhookModel.Organization,
];
```

### How It Works

1. DB mutation triggers `webhookDelivery` hook (after commit)
2. Hook finds active subscriptions for the model
3. Enqueues `sendWebhook` job for each subscription
4. Job signs payload with RSA-SHA256 and delivers

### Webhook Payload

```typescript
{
  model: 'User',
  action: 'create' | 'update' | 'delete',
  payload: { id, ...fields }
}
```

Headers: `Content-Type: application/json`, `X-Webhook-Signature: <base64>`

### Circuit Breaker

After 5 consecutive failures, subscription auto-disables:

```typescript
const FAILURE_THRESHOLD = 5;
// If last 5 events all failed → isActive = false
```

### Ignored Fields

Fields in this registry are:
1. **Excluded from payload** - never sent to webhook subscribers
2. **Ignored for no-op detection** - changes don't trigger webhooks

```typescript
// hooks/webhooks/constants/ignoredFields.ts
export const webhookIgnoredFields: Record<string, string[]> = {
  _global: ['updatedAt'],      // Always ignored for all models
  Token: ['lastUsedAt'],       // Token usage doesn't trigger webhook
  User: ['lastLoginAt'],       // Login timestamp changes ignored
};
```

Use cases:
- **Timestamps** (`updatedAt`, `lastUsedAt`) - noisy, not meaningful
- **Sensitive data** (`passwordHash`, `apiKey`) - security
- **Transient state** (`cartItems`, `tempData`) - not relevant to subscribers

**No-op detection**: If only ignored fields changed, webhook is skipped entirely.

### Related Models

Child models can trigger parent webhooks:

```typescript
// hooks/webhooks/constants/relatedModels.ts
export const webhookRelatedModels: Record<string, string> = {
  OrganizationUser: 'Organization',  // OrgUser changes → Org webhook
};
```

---

## Cache Invalidation

Automatic cache clearing on mutations via `CACHE_REFERENCE`.

**Note**: Cache invalidation shares the same no-op detection logic as webhooks (`isNoOpUpdate`). If only ignored fields changed (see [Ignored Fields](#ignored-fields)), cache clearing is skipped.

### How It Works

```typescript
// hooks/cache/constants/cacheReference.ts
export const CACHE_REFERENCE: CacheReference = {
  User: (r) => [
    cacheKey('User', r.id),
    cacheKey('User', r.email, 'email'),
  ],
  Token: (r) => [
    cacheKey('Token', r.keyHash, 'keyHash'),
  ],
};
```

On mutation, all matching cache keys are deleted.

### Wildcard Keys

```typescript
// Delete all sessions for a user
cacheKey('Session', userId, 'userId', [], true)  // → cache:Session:userId:abc:*
```

---

## False Polymorphism

"False polymorphism" uses a type enum + separate FK fields instead of a single polymorphic `ownerId`. This enables real FK constraints and type-safe relations. See [DATABASE.md](DATABASE.md#false-polymorphism) for schema conventions.

### Registry

Define which FK fields are required for each type value:

```typescript
// hooks/falsePolymorphism/registry.ts
export const FalsePolymorphismRegistry = {
  Token: [{
    typeField: 'ownerModel',
    fkMap: {
      User: ['userId'],                          // Requires userId only
      Organization: ['organizationId'],          // Requires organizationId only
      OrganizationUser: ['organizationId', 'userId'],  // Requires both
    },
  }],
  WebhookSubscription: [{
    typeField: 'ownerModel',
    fkMap: {
      User: ['userId'],
      Organization: ['organizationId'],
    },
  }],
};
```

### Auto-Generated Validation

The registry auto-generates:

1. **Rules** - Type field must be a valid enum value
2. **FK validation** - Required FK fields must be present and non-null
3. **Immutable fields** - Type field can't change after creation

### Validation Errors

```typescript
// Missing required FK
await db.token.create({
  data: { ownerModel: 'User' }  // Missing userId
});
// → Error: Token with ownerModel 'User' requires: userId

// Invalid type value
await db.token.create({
  data: { ownerModel: 'Invalid', userId: '...' }
});
// → Error: Invalid ownerModel value on Token
```

---

## Rules Registry

Declarative validation using [@inixiative/json-rules](https://github.com/inixiative/json-rules):

```typescript
// hooks/rules/registry.ts
export const RulesRegistry = {
  Token: {
    field: 'ownerModel',
    operator: 'in',
    value: ['User', 'Organization', 'OrganizationUser'],
    error: 'Invalid ownerModel value on Token'
  },
};
```

### shadowMerge for Updates

Updates are validated by merging `previous` record with update `data` using `shadowMerge`. This handles Prisma's atomic operations:

```typescript
// Prisma update with atomic ops
await db.user.update({
  where: { id },
  data: {
    balance: { increment: 100 },  // Can't validate 100 alone
    tags: { push: 'new-tag' },
  },
});

// shadowMerge computes final state for validation
shadowMerge(
  { balance: 500, tags: ['a', 'b'] },           // previous
  { balance: { increment: 100 }, tags: { push: 'new-tag' } }  // update data
);
// Result: { balance: 600, tags: ['a', 'b', 'new-tag'] }
```

Supported Prisma operations: `increment`, `decrement`, `multiply`, `divide`, `set`, `push`

### Recursive Validation

Create operations validate nested creates recursively:

```typescript
// All nested creates are validated
await db.organization.create({
  data: {
    name: 'Acme',
    organizationUsers: {
      create: [
        { userId: '...', role: 'owner' },  // ← validated
        { userId: '...', role: 'member' }, // ← validated
      ],
    },
    tokens: {
      create: { name: 'API Key', ... },    // ← validated
    },
  },
});
```

Nested updates log a warning (can't fetch previous for each nested record without N+1 queries).

---

## Immutable Fields

### **FK fields are automatically immutable**

The hook auto-detects all foreign key fields from the Prisma schema and strips them from update data. You don't need to register FK fields manually.

```typescript
// hooks/immutableFields/registry.ts
export const ImmutableFieldsOverrides = {
  SomeModel: {
    exclude: ['categoryId'],  // Allow this FK to change
    include: ['status'],      // Make this non-FK immutable
  }
};
```

Supports dot notation for JSON paths: `'entitlements.canInvite'`

### Why Strip Instead of Throw?

Immutable fields are **silently stripped** rather than throwing errors because:

1. **Client convenience** - Clients can send full objects without filtering out immutable fields
2. **Partial updates** - Same payload shape works for create and update
3. **API stability** - Adding immutable fields doesn't break existing clients
4. **Idempotency** - Sending the same value back is harmless, not an error

If you need strict validation (throw on attempt to change), use the Rules Registry instead.

---

## Supported Operations

The mutation lifecycle wraps these Prisma operations:

| Operation | Supported | Notes |
|-----------|-----------|-------|
| `create` | ✅ | |
| `createManyAndReturn` | ✅ | |
| `createMany` | ❌ | Throws - use `createManyAndReturn` |
| `update` | ✅ | Fetches `previous` automatically |
| `updateManyAndReturn` | ✅ | Fetches `previous[]` automatically |
| `updateMany` | ❌ | Throws - use `updateManyAndReturn` |
| `upsert` | ✅ | Fetches `previous` if exists |
| `delete` | ✅ | Fetches `previous` automatically |
| `deleteMany` | ✅ | Fetches `previous[]` automatically |

`createMany`/`updateMany` are disabled because they don't return records, breaking hooks that need `result` (webhooks, cache invalidation).

### Slow Mutation Logging

Mutations exceeding 5 seconds log a warning:

```
[db] slow mutation: User.update took 6.23s [scope: abc12345]
```

---

## Limitations

### Rules: Nested Updates Skip Validation

Nested updates in a single operation can't be validated because we'd need to fetch `previous` for each nested record (N+1 queries):

```typescript
// ⚠️ Nested update.data skips rule validation
await db.organization.update({
  where: { id },
  data: {
    name: 'New Name',  // ← validated
    organizationUsers: {
      update: {
        where: { id: ouId },
        data: { role: 'admin' },  // ← NOT validated (logs warning)
      },
    },
  },
});
```

**Workaround**: Use explicit transactions with separate updates:

```typescript
await db.txn(async () => {
  await db.organization.update({ where: { id }, data: { name: 'New Name' } });
  await db.organizationUser.update({ where: { id: ouId }, data: { role: 'admin' } });
});
```

### Rules: updateManyAndReturn Validates After

For `updateManyAndReturn`, rules run **after** the mutation (in the same transaction) because we can't merge `previous` with update data for each record efficiently. If validation fails, the transaction rolls back.

### Immutable Fields: Only Strips, Never Throws

By design, immutable field violations are silently fixed, not rejected. If you need to reject attempts to change a field, use a rule instead.
