# FEAT-005: Audit Logs

**Status**: 🚧 In Progress
**Assignee**: Aron
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-03-18

---

## Overview

Implement comprehensive audit logging system to track all mutations with before/after state, actor tracking, and retention policies. Critical for compliance (SOC2, GDPR) and debugging production issues.

## Goals

- ✅ Automatic logging of all database mutations
- ✅ Track who, what, when, and how for every change
- ✅ Sensitive field filtering (passwords, tokens, secrets)
- ✅ Non-blocking async writes (no performance impact)
- ✅ Query/search interface for admins
- ✅ Retention policies with auto-cleanup job
- ✅ Export to CSV/JSON for compliance audits

---

## Implementation Plan

### Phase 1: Database Schema (30min)

**File**: `packages/db/prisma/schema/auditLog.prisma`

```prisma
model AuditLog {
  @@map("audit_logs")

  id          String   @id @default(dbgenerated("uuidv7()"))
  createdAt   DateTime @default(now())

  // Who (actor)
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  spoofUserId String?  // Track when admin acts on behalf of user
  spoofUser   User?    @relation("AuditLogSpoofUser", fields: [spoofUserId], references: [id], onDelete: SetNull)
  tokenId     String?
  token       Token?   @relation(fields: [tokenId], references: [id], onDelete: SetNull)
  ipAddress   String?
  userAgent   String?

  // What (mutation)
  action      String   // 'create' | 'update' | 'delete'
  model       String   // 'User', 'Organization', 'Space', etc.
  recordId    String

  // Changes (state)
  before      Json?    // Previous state (for update/delete)
  after       Json?    // New state (for create/update)
  changes     Json?    // Diff of changed fields only

  // Metadata
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  spaceId        String?
  space          Space?        @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([spoofUserId])
  @@index([tokenId])
  @@index([model, recordId])
  @@index([createdAt])
  @@index([organizationId])
  @@index([spaceId])
}
```

**Tasks:**
- [x] Create `packages/db/prisma/schema/auditLog.prisma`
- [x] Add `AuditLogId` to `packages/db/src/typedModelIds.ts`
- [x] Run `bun run db:generate && bun run db:push`
- [x] Create factory: `packages/db/src/test/factories/auditLogFactory.ts` (with all optional FK dependencies)
- [x] Export factory from `packages/db/src/test/factories/index.ts`

---

### Phase 2: Centralized Hook Utilities (1.5 hours)

**Create shared hook utilities in db package - TWO SEPARATE CONCERNS:**

**Concern 1: No-Op Detection** (used by cache, webhooks, audit)
- Skip actions when only metadata/tracking fields change
- Examples: updatedAt, lastLoginAt

**Concern 2: Security/Privacy** (used by webhooks, audit - NOT cache)
- Redact sensitive fields before sending/storing
- Examples: passwords, tokens, secrets

---

**File**: `packages/db/src/lib/hooks/ignoreFields.ts` (NEW - migrated from webhooks)

**PURPOSE: No-Op Detection** - Metadata/tracking fields that don't represent meaningful changes

```typescript
import { omit } from 'lodash-es';

/**
 * Fields to ignore when determining if a mutation is meaningful
 * Used by: Cache (skip invalidation), Webhooks (skip delivery), Audit (skip logging)
 *
 * These are TRACKING/METADATA fields, not sensitive data
 * Cache DOES care about password/token changes - those are real changes!
 *
 * Migrated from apps/api/src/hooks/webhooks/constants/ignoredFields.ts
 */
export const HOOK_IGNORE_FIELDS: Record<string, string[]> = {
  _global: ['updatedAt'], // Timestamp updates aren't meaningful changes
  User: ['lastLoginAt'],  // Login tracking isn't a user data change
  Token: ['lastUsedAt'],  // Token usage tracking isn't a token change
  // Add more TRACKING fields as needed
};

export const getIgnoredFields = (model: string): string[] => {
  const global = HOOK_IGNORE_FIELDS._global ?? [];
  const modelSpecific = HOOK_IGNORE_FIELDS[model] ?? [];
  return [...global, ...modelSpecific];
};

/**
 * Remove ignored fields - used to determine if update is a no-op
 * Used by cache, webhooks, audit logs
 */
export const filterIgnoredFields = <T extends Record<string, unknown>>(
  model: string,
  data: T
): Partial<T> => {
  return omit(data, getIgnoredFields(model)) as Partial<T>;
};
```

**File**: `packages/db/src/lib/hooks/redactFields.ts` (NEW - shared utility)

**PURPOSE: Security/Privacy** - Sensitive fields that should be hidden in logs/webhooks

```typescript
/**
 * Sensitive fields to redact in webhook payloads and audit logs
 * Used by: Webhooks (sanitize external payloads), Audit logs (security)
 * NOT used by: Cache (needs real values to function correctly)
 *
 * These are SENSITIVE DATA fields that shouldn't be exposed
 * Cache MUST see password/token changes to invalidate correctly!
 */
export const HOOK_REDACT_FIELDS: Record<string, string[]> = {
  Account: ['password'], // Better Auth pattern: password on Account, not User
  Token: ['value', 'hashedValue'],
  AuthProvider: [
    'secrets',
    'secretsVersion',
    'secretsEncryptedBy',
    'secretsEncryptedAt',
    'secretsAuthTag',
  ],
  // Add more SENSITIVE fields as needed
};

export const getRedactFields = (model: string): string[] => {
  return HOOK_REDACT_FIELDS[model] ?? [];
};

/**
 * Redact sensitive fields - used to sanitize webhook payloads and audit logs
 * Used by webhooks and audit logs ONLY (NOT cache)
 */
export const redactSensitiveFields = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  redactValue: string = '[REDACTED]'
): T => {
  const redacted = { ...data };
  const sensitiveFields = getRedactFields(model);
  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = redactValue;
    }
  }
  return redacted as T;
};
```

**File**: `packages/db/src/lib/hooks/index.ts` (NEW)

```typescript
export * from './ignoreFields';
export * from './redactFields';
```

**File**: `apps/api/src/hooks/auditLog/constants/enabledModels.ts`

Registry for audit-enabled models:

```typescript
export const AUDIT_ENABLED_MODELS = [
  'User',
  'Organization',
  'OrganizationUser',
  'Space',
  'SpaceUser',
  'Token',
  'AuthProvider',
  // Add more as needed
] as const;

export const isAuditEnabled = (model: string): boolean => {
  return AUDIT_ENABLED_MODELS.includes(model as any);
};
```

**Tasks:**
- [x] `packages/db/src/registries/ignoreFields.ts` (shared — used by webhooks, cache, audit)
- [x] `packages/db/src/registries/redactFields.ts` (shared — Token field corrected to `keyHash` only)
- [x] Exported from `packages/db/src/index.ts`
- [x] `packages/db/src/registries/auditEnabledModels.ts` — includes User, Organization, OrganizationUser, Space, SpaceUser, Token, AuthProvider, Account, EmailTemplate, EmailComponent
- [ ] Update webhooks to use shared utilities (still using own copy)
- [ ] Write tests for utilities: `packages/db/src/registries/ignoreFields.test.ts`
- [x] Write tests for utilities: `packages/db/src/registries/redactFields.test.ts`

---

### Phase 3: Audit Log Hook (2-3 hours)

**Pattern**: Follow existing `webhooks/hook.ts` pattern

**File**: `apps/api/src/hooks/auditLog/hook.ts`

**Key Features:**
- Hook into `HookTiming.after` for all actions
- Only log models in `AUDIT_ENABLED_MODELS` registry
- Filter ignored fields using `filterIgnoredFields()` from shared hooks utils
- Redact sensitive fields using `redactSensitiveFields()` from shared hooks utils
- Compute diff for updates (only changed fields, after filtering/redacting)
- Extract actor info from context (userId, spoofUserId, tokenId, IP, userAgent)
- Write async using `db.onCommit()` for non-blocking
- Skip logging for AuditLog model itself (no recursion)

**Implementation Checklist:**
- [x] `apps/api/src/hooks/auditLog/hook.ts` — `registerAuditLogHook()`
- [x] `isAuditEnabled(model)` guard
- [x] Field processing pipeline: filterIgnoredFields → redactSensitiveFields → computeDiff
- [x] processAuditData called once per record; computeDiff receives pre-processed data (no double-processing)
- [x] Actor extracted from `auditActorContext` ALS
- [x] AuditLog model excluded from hook (no recursion)
- [x] Both single and many actions handled
- [x] Soft delete detection: `deletedAt: null → timestamp` recorded as `delete` action
- [x] Empty diff guard: update with no meaningful changes produces no audit row
- [x] `sourceInquiryId` threaded through actor context for inquiry-driven mutations
- [ ] Move audit writes into transaction (currently writes after commit — see FEAT-017)

**File**: `apps/api/src/hooks/auditLog/utils.ts`

Helper functions:
```typescript
import { filterIgnoredFields, redactSensitiveFields } from '@template/db/lib/hooks';

/**
 * Process data through filtering and redaction pipeline
 */
export const processAuditData = (
  model: string,
  data: Record<string, unknown>
): Record<string, unknown> => {
  // Step 1: Filter ignored fields (updatedAt, lastLoginAt, etc.)
  const filtered = filterIgnoredFields(model, data);
  // Step 2: Redact sensitive fields (passwords, tokens, etc.)
  const redacted = redactSensitiveFields(model, filtered);
  return redacted;
};

/**
 * Compute diff after processing both before/after through pipeline
 */
export const computeDiff = (
  model: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> => {
  const processedBefore = processAuditData(model, before);
  const processedAfter = processAuditData(model, after);

  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(processedAfter)) {
    if (processedBefore[key] !== processedAfter[key]) {
      diff[key] = { before: processedBefore[key], after: processedAfter[key] };
    }
  }
  return diff;
};
```

**Tasks:**
- [x] `apps/api/src/hooks/auditLog/utils.ts` — `processAuditData()`, `computeDiff()`, `buildContextFkFields()`, `buildSubjectFkFields()`
- [x] `computeDiff()` takes pre-processed data (pure diff, no internal processAuditData call)
- [ ] Write tests: `apps/api/src/hooks/auditLog/utils.test.ts`

**File**: `apps/api/src/hooks/index.ts`

```typescript
import { registerAuditLogHook } from '#/hooks/auditLog/hook';

export const registerHooks = () => {
  registerClearCacheHook();
  registerImmutableFieldsHook();
  registerRulesHook();
  registerWebhookHook();
  registerAuditLogHook(); // ADD THIS
};
```

**Tasks:**
- [x] Register audit log hook in `apps/api/src/hooks/index.ts`
- [ ] Integration test: hook fires on mutations

---

### Phase 4: Retention Policy Job (1 hour)

**File**: `apps/api/src/jobs/handlers/cleanStaleAuditLogs.ts`

Similar to `cleanStaleWebhooks`:

```typescript
export const cleanStaleAuditLogs: JobHandler<void> = makeSingletonJob(async (ctx) => {
  const { db, log } = ctx;

  const retentionDays = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '90', 10);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  log(`Deleted ${result.count} audit logs older than ${retentionDays} days`, LogScope.job);
});
```

**Tasks:**
- [ ] Create `apps/api/src/jobs/handlers/cleanStaleAuditLogs.ts`
- [ ] Add to `apps/api/src/jobs/handlers/index.ts`
- [ ] Write tests: `apps/api/src/jobs/handlers/tests/cleanStaleAuditLogs.test.ts`
- [ ] Add `AUDIT_LOG_RETENTION_DAYS=90` to `.env.example`
- [ ] Create CronJob in seed: run nightly at 3am

---

### Phase 5: API Endpoints (1-2 hours)

**Module**: `apps/api/src/modules/admin/auditLog/`

**Endpoints (Superadmin Only):**
1. `GET /api/admin/auditLog` - List all audit logs (superadmin only)

**Query Params:**
- `userId` - Filter by actor
- `spoofUserId` - Filter by spoofed user
- `model` - Filter by model
- `recordId` - Filter by record
- `action` - Filter by action (create/update/delete)
- `startDate` / `endDate` - Date range
- `limit` / `offset` - Pagination

**Tasks:**
- [ ] Create `apps/api/src/modules/admin/auditLog/routes/adminAuditLogReadMany.ts`
- [ ] Create controller using `paginate()`
- [ ] Add to admin routes in `apps/api/src/routes/admin.ts`
- [ ] Write API tests
- [ ] Update OpenAPI docs

**Note**: Only superadmin access for now. Org/space-level access will come later when we have better data retention strategy.

---

### Phase 6: Superadmin UI (2-3 hours)

**Superadmin Page**: `apps/superadmin/app/routes/_authenticated/auditLog.tsx`

**Component**: `packages/ui/src/components/tables/AuditLogDataTable.tsx` (NEW)

**Features:**
- DataTable with server-side pagination
- Filters (userId, spoofUserId, model, action, date range)
- Expandable rows showing before/after/changes JSON
- Highlight spoofed actions (admin acting as user)
- Show actor info (user, spoof user, IP, user agent)
- Color coding by action (create=green, update=blue, delete=red)

**DataTable Columns:**
- Timestamp
- Actor (userId + spoofUserId if present)
- Model
- Action
- Record ID
- Changes count
- Expand/collapse

**Tasks:**
- [ ] Create `packages/ui/src/components/tables/AuditLogDataTable.tsx`
- [ ] Create superadmin audit log page
- [ ] Add to navigation config (`features/auditLog.ts`)
- [ ] Add permission checks (superadmin only)
- [ ] Test filters and pagination
- [ ] Test expandable rows

---

### Phase 7: Testing (2 hours)

**Backend Tests:**
- [ ] Shared hook utils work correctly:
  - [ ] `filterIgnoredFields()` removes noise fields
  - [ ] `redactSensitiveFields()` redacts passwords/tokens
- [ ] Hook fires on create/update/delete for enabled models
- [ ] Hook does NOT fire for disabled models
- [ ] Ignored fields are filtered before storing
- [ ] Sensitive fields are redacted before storing
- [ ] Diff computation is correct (after filtering/redacting)
- [ ] Actor info is captured (userId, spoofUserId, tokenId, IP)
- [ ] Spoofing is tracked correctly
- [ ] Retention job deletes old logs
- [ ] API endpoint returns correct data
- [ ] Superadmin permission check works

**Frontend Tests:**
- [ ] DataTable renders audit logs
- [ ] Filters work correctly (userId, spoofUserId, model, action, date)
- [ ] Expandable rows show diffs
- [ ] Spoofed actions are highlighted

---

## Files to Create/Modify

### Database
- `packages/db/prisma/schema/auditLog.prisma` (NEW)
- `packages/db/src/typedModelIds.ts` (MODIFY)
- `packages/db/src/lib/hooks/ignoreFields.ts` (NEW - shared utility)
- `packages/db/src/lib/hooks/redactFields.ts` (NEW - shared utility)
- `packages/db/src/lib/hooks/ignoreFields.test.ts` (NEW)
- `packages/db/src/lib/hooks/redactFields.test.ts` (NEW)
- `packages/db/src/lib/hooks/index.ts` (NEW)
- `packages/db/src/index.ts` (MODIFY - export hooks utils)
- `packages/db/src/test/factories/auditLogFactory.ts` (NEW)
- `packages/db/src/test/factories/index.ts` (MODIFY)

### Backend - Hooks
- `apps/api/src/hooks/auditLog/hook.ts` (NEW)
- `apps/api/src/hooks/auditLog/utils.ts` (NEW - uses shared hook utils)
- `apps/api/src/hooks/auditLog/utils.test.ts` (NEW)
- `apps/api/src/hooks/auditLog/constants/enabledModels.ts` (NEW)
- `apps/api/src/hooks/index.ts` (MODIFY - register audit hook)
- `apps/api/src/hooks/webhooks/*` (MODIFY - migrate to shared hook utils)

### Backend - Jobs
- `apps/api/src/jobs/handlers/cleanStaleAuditLogs.ts` (NEW)
- `apps/api/src/jobs/handlers/tests/cleanStaleAuditLogs.test.ts` (NEW)
- `apps/api/src/jobs/handlers/index.ts` (MODIFY)

### Backend - API
- `apps/api/src/modules/admin/auditLog/routes/adminAuditLogReadMany.ts` (NEW)
- `apps/api/src/modules/admin/auditLog/controllers/adminAuditLogReadMany.ts` (NEW)
- `apps/api/src/routes/admin.ts` (MODIFY - register route)

### Frontend
- `packages/ui/src/components/tables/AuditLogDataTable.tsx` (NEW)
- `apps/superadmin/app/routes/_authenticated/auditLog.tsx` (NEW)
- `apps/superadmin/app/config/nav/features/auditLog.ts` (NEW)

---

## Success Criteria

- ✅ Database mutations for enabled models are logged automatically
- ✅ Ignored fields (updatedAt, lastLoginAt) are filtered via shared hook utils
- ✅ Sensitive fields (passwords, tokens) are redacted via shared hook utils
- ✅ Audit logs include before/after state and computed diff (after filtering/redacting)
- ✅ Actor information (user, spoofUser, token, IP) is captured
- ✅ Spoofing actions are tracked separately (spoofUserId field)
- ✅ Non-blocking async writes (no performance impact)
- ✅ Retention job runs nightly and cleans old logs
- ✅ Superadmin can view all audit logs via DataTable
- ✅ Filters work (userId, spoofUserId, model, action, date range)
- ✅ Expandable rows show before/after/changes
- ✅ Spoofed actions are visually highlighted
- ✅ Comprehensive test coverage
- ✅ Shared hook utilities (`ignoreFields`, `redactFields`) can be reused by webhooks and other hooks

**Future (not in scope):**
- ❌ Org/space-level access (wait for data lake/retention strategy)
- ❌ CSV export (wait for data lake)

---

## Estimated Time

**Total: 12-14 hours** (1.5-2 days at AI-accelerated pace)

- Phase 1: 30min (schema with spoofUserId)
- Phase 2: 1.5 hours (shared hook utils: ignore + redact + tests)
- Phase 3: 2-3 hours (hook implementation using shared utils)
- Phase 4: 1 hour (retention job)
- Phase 5: 1-2 hours (single superadmin API endpoint)
- Phase 6: 2-3 hours (DataTable + superadmin page)
- Phase 7: 2-3 hours (testing + webhook migration to shared utils)

---

## References

- **Pattern**: `apps/api/src/hooks/webhooks/hook.ts`
- **Job Pattern**: `apps/api/src/jobs/handlers/cleanStaleWebhooks.ts`
- **TODO.md**: Lines 26-65 (original design)
- **HOOKS.md**: Mutation lifecycle documentation

---

## Related Tickets

- **Blocked by**: None
- **Blocks**: None
- **Related**: OTEL-001 (Observability - audit logs feed into monitoring)

---

_Ready for implementation. All patterns established in codebase._
