# Hooks

## Contents

- [Mutation Lifecycle](#mutation-lifecycle)
- [Registering Hooks](#registering-hooks)
- [Application Hooks](#application-hooks)
- [Webhooks](#webhooks)
- [Cache Invalidation](#cache-invalidation)
- [False Polymorphism](#false-polymorphism)
- [Contact Rules](#contact-rules)
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

Registered in `apps/api/src/hooks/index.ts` via `registerHooks()` from both API and worker entry points:

| Hook | Purpose |
|------|---------|
| `auditLog` | Immutable audit trail of all mutations on enabled models |
| `cache` | Cache invalidation on mutations (post-commit) |
| `contactRules` | Per-type Contact validation + canonicalization (registry-driven) |
| `immutableFields` | Strips immutable fields (FKs, `id`, `createdAt`) from updates |
| `orderedList` | Dense `[1..N]` position columns + soft-delete sentinels + bulk re-densify (registry-driven) |
| `preventHardDelete` | Blocks `delete` / `deleteMany` on models that should only be soft-deleted |
| `rules` | Declarative validation via `@inixiative/json-rules` (registry-driven) |
| `tagOwnerCategory` | Tag.ownerModel + FK must match its TagCategory's owner |
| `webhooks` | Webhook delivery on mutations (post-commit) |

`apps/api/src/hooks/falsePolymorphism/` lives under `hooks/` but is **not** a runtime hook — it's a pair of transformers (`toRules.ts`, `toImmutableFields.ts`) that inject polymorphism constraints into the rules and immutableFields registries at module load time.

---

## Audit Log

Automatic, tamper-evident record of all database mutations for enabled models.

### Enabling Audit for a Model

```typescript
// packages/db/src/registries/auditEnabledModels.ts
export const AUDIT_ENABLED_MODELS: AuditSubjectModel[] = [
  AuditSubjectModel.User,
  AuditSubjectModel.Organization,
  // ...
];
```

### Data Captured

| Field | Description |
|-------|-------------|
| `action` | `create`, `update`, or `delete` |
| `subjectModel` | Which model was mutated |
| `before` / `after` | Full record state (filtered + redacted) |
| `changes` | Field-level diff for updates only |
| `actorUserId` | Who triggered the mutation |
| `actorSpoofUserId` | Admin acting on behalf of a user |
| `actorTokenId` | API token used |
| `actorJobName` | Background job name (if triggered by a job) |
| `ipAddress` / `userAgent` | Request metadata |
| `sourceInquiryId` | Inquiry that caused the mutation (if applicable) |
| `contextOrganizationId` / `contextSpaceId` | Org/space context of the record |

### Field Processing Pipeline

Before storing, each record goes through:

1. **Ignore fields** — strip noise fields (`updatedAt`, `lastLoginAt`, `lastUsedAt`) that don't represent meaningful changes
2. **Redact fields** — replace sensitive values with `[REDACTED]` (passwords, token hashes, auth secrets)
3. **Diff** — for updates, compute which fields actually changed (after filtering/redacting)

If an update produces an empty diff (only ignored/redacted fields changed), no audit log is written.

### Soft Delete Detection

If a mutation transitions `deletedAt` from `null` to a timestamp, it is recorded as a `delete` action regardless of the underlying `DbAction`.

### Registries

```typescript
// packages/db/src/registries/auditEnabledModels.ts — opt-in models
// packages/db/src/registries/redactFields.ts — sensitive fields per model
// packages/db/src/registries/ignoreFields.ts — noise fields per model (shared with webhooks/cache)
```

### Actor Context

Actor info is set in async-local storage before the mutation:

```typescript
import { auditActorContext } from '#/lib/auditActorContext';

auditActorContext.set({
  actorUserId: user.id,
  actorSpoofUserId: spoofUser?.id,
  actorTokenId: token?.id,
  ipAddress: c.req.header('x-forwarded-for'),
  userAgent: c.req.header('user-agent'),
  sourceInquiryId: inquiry?.id,
});
```

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
  resourceId: '...',
  data: { ...fields },
  previousData: { ...fields },  // For updates only
  timestamp: '2024-01-15T12:00:00.000Z'
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

Single source of truth in `@template/db` - used by both validation hooks and DB constraints:

```typescript
import { FalsePolymorphismRegistry } from '@template/db';

// packages/db/src/registries/falsePolymorphism.ts
FalsePolymorphismRegistry = {
  Token: [{
    typeField: 'ownerModel',
    fkMap: {
      User: ['userId'],                          // Requires userId only
      Organization: ['organizationId'],          // Requires organizationId only
      OrganizationUser: ['organizationId', 'userId'],  // Requires both
    },
  }],
  WebhookSubscription: [{ ... }],
  Inquiry: [{ ... }],  // sourceModel + targetModel
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

## Contact Rules

`contactRules` is a per-type validation + normalization hook for the `Contact` model. Unlike `rules` (one declarative condition per model), Contact has 22 types (phone, email, linkedin, github, telegram, …) each with their own input shape, canonical storage shape, and `valueKey` projection. The hook delegates to a registry instead of growing one giant rule.

```typescript
// packages/shared/src/contact/registry.ts
import { ContactRegistry } from '@template/shared/contact';

// Each entry implements ContactTypeDef<TInput, TStored>:
// - inputSchema:  loose accept (URL paste, structured input)
// - parseInput:   normalize loose → canonical
// - valueSchema:  strict canonical (post-parse safety net)
// - toValueKey:   projection used for indexing + uniqueness
// - subtype:      'forbidden' | 'optional' | 'required'
// - uniqueness:   'global-within-type' | 'per-owner'
// - display:      { label, icon (iconify slug) }
```

The hook fires for `create`, `createManyAndReturn`, `upsert`, `update`, and `updateManyAndReturn`. For each row it:

1. Looks up the def from `ContactRegistry[row.type]` (422 if unknown).
2. Enforces the subtype rule.
3. Parses `value` through `inputSchema` → `parseInput` → `valueSchema`.
4. Sets `valueKey = def.toValueKey(canonical)` so the per-owner unique constraint resolves.

The `position` column is managed by the separate `orderedList` hook (see below) — Contact is registered against it, so position assignment, shifts, soft-delete sentinels, and bulk re-densification all happen automatically.

Update paths shadow-merge the partial update with `previous` so type-aware validation runs against the merged record, then mirror hook-computed fields (`value`, `valueKey`) back into `args.data`.

### Adding a Contact Type

1. Drop a def file in `packages/shared/src/contact/defs/<type>.ts` exporting `<type>Def: ContactTypeDef<...>`.
2. Add the type literal to the `ContactType` enum in `packages/db/prisma/schema/contact.prisma` and regenerate.
3. Register the def in `ContactRegistry` (`packages/shared/src/contact/registry.ts`).

No controller, route, or hook change needed — the hook discovers new types through the registry.

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

## Ordered List

Registry-driven hook that maintains dense `[1..N]` position columns for any model that opts in. Lives at `apps/api/src/hooks/orderedList/`, with the SQL primitives in `apps/api/src/lib/prisma/orderedList.ts`.

### Registry

```typescript
// hooks/orderedList/registry.ts
export const orderedListRegistry: OrderedListRegistry = {
  Contact: {
    position: [...contactOwnerFields, 'type'],   // field → scope keys
  },
};
```

The key is the Prisma model name. The value maps each ordered field to its scope: an array of column names that partition rows into independent lists. For Contact, every `(userId|orgId|spaceId, type)` combination is its own list — `position` resets to 1 for each scope.

### What it covers

| Action | Behavior |
|---|---|
| `create` (single) | If `position` is null → append (MAX+1). If provided → clamp to `[1, MAX+1]` and shift siblings up |
| `createManyAndReturn` | Per scope, one SELECT MAX + one CTE `UPDATE … FROM (VALUES …)` shifts existing rows; new rows are inserted at pre-computed positions |
| `update` | Soft-delete → sets `position` to the next distinct negative, compacts siblings. Restore → appends to live tail. Explicit position change → shifts only siblings using a predicate that excludes the target row, then Prisma writes the new position |
| `updateManyAndReturn` (BEFORE) | **Throws** if `data` writes any ordered field — bulk position arithmetic can't be reconciled with `[1..N]` semantics. Use single `update()` per row or chunk at the app layer |
| `updateManyAndReturn` (AFTER) | If `deletedAt` changed, filters `previousRows` by actual state transition (only rows that were live get new negatives; only rows that were deleted get appended back). One `reDensifyLive` + one `bulkAssignNegatives` per scope on soft-delete; one `bulkAssignAppend` per scope on restore |
| `upsert` | Routes to create or update branch based on `previous` |
| `delete` / `deleteMany` | AFTER-hook re-densifies live survivors per scope via `ROW_NUMBER() OVER (ORDER BY position ASC, id ASC)` — single statement |

### Soft-deleted rows

Soft-deleted items keep a row but get a distinct **negative** position outside the live range, so the live `position > 0 AND deletedAt IS NULL` scope stays dense. Multiple deletes stack as `-1, -2, -3, …`. Restore takes the row back to `MAX(live) + 1`.

### Bulk-friendly by construction

Every bulk hook is O(scopes), not O(rows). Importing a 1000-row CSV of Contacts triggers two queries per (owner, type) scope regardless of batch size. Same for bulk soft-delete, bulk restore, and `deleteMany`.

### Scope strictness

`buildScope` throws if a registered scope key is missing or `undefined` on the row — no silent coalescing of "absent" and "explicitly null." Input rows on the create path are passed through `normalizeInputScope` at the boundary to materialize Prisma's "absent = insert NULL" semantics explicitly.

### Adding a Model

1. Register it in `orderedListRegistry` with `{ <fieldName>: [...scopeKeys] }`.
2. That's it — every relevant action picks it up automatically.

### Limitations

- Concurrent inserts into the same scope from separate transactions can race on `SELECT MAX(position)` and produce duplicate positions. Sort still resolves deterministically via `(position, id)` and a later bulk op will heal it. Mitigation (advisory lock) is documented inline at the bottom of `apps/api/src/lib/prisma/orderedList.ts`.
- `updateManyAndReturn` cannot write ordered fields directly. Use single updates.

---

## Immutable Fields

### **Global fields are always immutable**

`id` and `createdAt` are always stripped from updates across all models, regardless of the registry.

```typescript
// hooks/immutableFields/registry.ts
const GLOBAL_IMMUTABLE_FIELDS = ['id', 'createdAt'] as const;
```

### **FK fields are automatically immutable**

The hook auto-detects all foreign key fields from the Prisma schema and strips them from update data. You don't need to register FK fields manually.

```typescript
// hooks/immutableFields/registry.ts
export const ImmutableFieldsOverrides = {
  // Space.organizationId is normally immutable (it's a FK) but must be
  // updatable for the transferSpace inquiry handler
  Space: { exclude: ['organizationId'] },

  // Other examples:
  // SomeModel: { exclude: ['categoryId'] },  // Allow this FK to change
  // SomeModel: { include: ['status'] },      // Make this non-FK immutable
};
```

**Important:** When a new inquiry handler needs to update a FK field (e.g. moving a resource between owners), add an `exclude` override here. The silent-strip behavior would otherwise make the `handleApprove` update a no-op with a 200 response, with no error.

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
