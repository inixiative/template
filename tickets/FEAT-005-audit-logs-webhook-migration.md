# Webhook + Cache Migration to Shared Hook Utilities

**Part of**: FEAT-005 Audit Logs
**Phase**: 2.5 - Hooks Refactor
**Time**: 1 hour

---

## Current State

Webhooks have their own field filtering implementation **used by both webhook AND cache hooks**:

**Location**: `apps/api/src/hooks/webhooks/constants/ignoredFields.ts`

```typescript
export const webhookIgnoredFields: Record<string, string[]> = {
  _global: ['updatedAt'],
  Token: ['lastUsedAt'],
  User: ['lastLoginAt'],
};
```

**Usage**: `apps/api/src/hooks/webhooks/utils.ts`

```typescript
export const getIgnoredFields = (model: string): string[] => {
  const global = webhookIgnoredFields._global ?? [];
  const modelSpecific = webhookIgnoredFields[model] ?? [];
  return [...global, ...modelSpecific];
};

export const selectRelevantFields = <T>(model: string, data: T): Partial<T> => {
  return omit(data, getIgnoredFields(model)) as Partial<T>;
};

export const isNoOpUpdate = <T>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean => {
  if (!previousData) return false;
  const current = selectRelevantFields(model, currentData);
  const previous = selectRelevantFields(model, previousData);
  return isEqual(current, previous);
};
```

---

## Migration Steps

### 1. Move Registry to Shared Location

**Action**: Delete `apps/api/src/hooks/webhooks/constants/ignoredFields.ts`

**Content moves to**: `packages/db/src/lib/hooks/ignoreFields.ts`

No changes to structure - keep `_global` key (used by existing code).

### 2. Update Webhook Utils

**File**: `apps/api/src/hooks/webhooks/utils.ts`

**Changes**:

```typescript
// BEFORE:
import { webhookIgnoredFields } from '#/hooks/webhooks/constants/ignoredFields';

export const getIgnoredFields = (model: string): string[] => {
  const global = webhookIgnoredFields._global ?? [];
  const modelSpecific = webhookIgnoredFields[model] ?? [];
  return [...global, ...modelSpecific];
};

export const selectRelevantFields = <T>(model: string, data: T): Partial<T> => {
  return omit(data, getIgnoredFields(model)) as Partial<T>;
};

// AFTER:
import { filterIgnoredFields } from '@template/db/lib/hooks';

// Remove getIgnoredFields - now in shared utils
// Remove selectRelevantFields - now filterIgnoredFields

export const isNoOpUpdate = <T>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean => {
  if (!previousData) return false;
  const current = filterIgnoredFields(model, currentData);
  const previous = filterIgnoredFields(model, previousData);
  return isEqual(current, previous);
};
```

### 3. Update Webhook Hook

**File**: `apps/api/src/hooks/webhooks/hook.ts`

**Find all calls to** `selectRelevantFields()` and replace with `filterIgnoredFields()`:

```typescript
// BEFORE:
import { selectRelevantFields } from '#/hooks/webhooks/utils';

const payload = {
  data: selectRelevantFields(model, resultData),
  previousData: previousData ? selectRelevantFields(model, previousData) : undefined,
};

// AFTER:
import { filterIgnoredFields } from '@template/db/lib/hooks';

const payload = {
  data: filterIgnoredFields(model, resultData),
  previousData: previousData ? filterIgnoredFields(model, previousData) : undefined,
};
```

### 3.5 Update Cache Hook

**File**: `apps/api/src/hooks/cache/hook.ts`

**Update import** - cache hook uses `isNoOpUpdate()` from webhook utils:

```typescript
// BEFORE (line 5):
import { isNoOpUpdate } from '#/hooks/webhooks/utils';

// AFTER:
import { isNoOpUpdate } from '#/hooks/webhooks/utils'; // Still works - isNoOpUpdate stays in webhooks
```

**Note**: `isNoOpUpdate()` stays in `webhooks/utils.ts` but now uses shared `filterIgnoredFields()` internally. Cache hook import doesn't need to change.

### 4. Optional: Add Redaction to Webhooks

**Decision**: Do webhooks need redaction?

- ✅ **Yes** - Webhook payloads shouldn't contain passwords/tokens
- ❌ **No** - Webhooks only send to trusted endpoints

**If yes**, update webhook payload processing:

```typescript
import { filterIgnoredFields, redactSensitiveFields } from '@template/db/lib/hooks';

const processWebhookData = <T>(model: string, data: T): T => {
  const filtered = filterIgnoredFields(model, data);
  const redacted = redactSensitiveFields(model, filtered);
  return redacted;
};
```

### 5. Update Tests

**File**: `apps/api/src/hooks/webhooks/utils.test.ts`

- Update imports to use shared utilities
- Remove tests for `getIgnoredFields()` (now tested in db package)
- Update tests for `isNoOpUpdate()` to use new shared utils

---

## Verification

- [ ] Webhooks still fire correctly
- [ ] Cache invalidation still works correctly
- [ ] `isNoOpUpdate()` still skips no-op updates (used by both webhooks and cache)
- [ ] Ignored fields are still filtered (updatedAt, lastLoginAt, lastUsedAt)
- [ ] All webhook tests pass
- [ ] All cache hook tests pass
- [ ] No breaking changes to webhook or cache behavior

---

## Files Modified

### Deleted
- `apps/api/src/hooks/webhooks/constants/ignoredFields.ts`

### Modified
- `apps/api/src/hooks/webhooks/utils.ts` - use shared utilities
- `apps/api/src/hooks/webhooks/hook.ts` - use filterIgnoredFields
- `apps/api/src/hooks/webhooks/utils.test.ts` - update tests
- `apps/api/src/hooks/cache/hook.ts` - no changes needed (uses isNoOpUpdate which internally uses shared utils)

### Created (in main ticket)
- `packages/db/src/lib/hooks/ignoreFields.ts`
- `packages/db/src/lib/hooks/redactFields.ts`

---

_This migration ensures audit logs, webhooks, AND cache invalidation all use the same field filtering logic._

---

## Impact Summary

**Before**: `webhookIgnoredFields` used by:
- Webhooks (skip no-op webhook deliveries)
- Cache invalidation (skip no-op cache clears)

**After**: `HOOK_IGNORE_FIELDS` (shared) used by:
- Webhooks (via `filterIgnoredFields`)
- Cache invalidation (via `isNoOpUpdate` → `filterIgnoredFields`)
- Audit logs (via `filterIgnoredFields`)
- Any future hooks that need field filtering
