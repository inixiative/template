# Raw Notes

Unsorted patterns and decisions to organize later.

---

## db client (packages/db/src/client.ts)

Single `db` export with Prisma + our methods:

```typescript
db.user.findMany()      // Prisma - uses txn if active, else raw
db.raw.user.findMany()  // Always raw, bypasses txn check
db.scope(id, fn)        // Create AsyncLocalStorage context
db.txn(fn)              // Start transaction
db.onCommit(fn)         // Queue callback for after commit
db.getScopeId()         // Get current scope ID (request/job)
db.isInTxn()            // Check if in transaction
```

~75 lines. Proxy routes Prisma methods to active txn or raw client.

---

## prepareRequest middleware

Inits Hono context vars AND creates AsyncLocalStorage scope:

```typescript
export const prepareRequest = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('db', db);
  c.set('requestId', requestId);
  // ... other context vars
  await db.scope(requestId, next);
};
```

Jobs do similar: `db.scope(`job:${name}:${id}`, handler)`

---

## Context getters vs db

- `getUser(c)`, `getRequestId(c)` - pull from Hono context (need `c`)
- `db.getScopeId()` - pull from AsyncLocalStorage (works anywhere)

---

## Validation middleware

`validateUser` - throws 401 if no user. Use in route middleware array.

---

## lib/context vs middleware/validations

- `lib/context/` - getters (pure functions, typed access)
- `middleware/validations/` - guards (throw if condition not met)

---

## Module folder structure

constants, controllers, schemas, services, routes, transformers, tests

---

## Naming

- util not helper
- services not handlers
- make* for factories/curry
- validate* for guards
- get* for accessors
- is* for boolean checks
- txn not transaction

---

## Index Files

Minimal index files - only at module level and package level, not nested.

```typescript
// ✅ Good - module level
#/hooks/webhooks/index.ts

// ✅ Good - package level
packages/db/src/index.ts

// ❌ Bad - nested
#/hooks/webhooks/constants/index.ts

// Instead, import directly from files
import { WEBHOOK_SUBSCRIBERS } from '#/hooks/webhooks/constants/subscribers';
```

---

## Apps structure

- web - Main user app
- admin - Org admin dashboard (orgRole check)
- superadmin - Platform admin (platformRole: superadmin)

Same BetterAuth backend for all. Separate login pages for now.
TODO: SSO between apps (shared session cookie?)

---

## UI

shadcn/ui for all apps. Shared via packages/ui.

---

## Logger with scope ID

Logger auto-prefixes with scope ID (first 8 chars):

```typescript
export const log = new Proxy(baseLog, {
  get(target, prop) {
    const scopeId = db.getScopeId();
    const logger = scopeId ? target.withTag(scopeId.slice(0, 8)) : target;
    return Reflect.get(logger, prop);
  },
});
```

---

## Jobs System (apps/api/src/jobs/)

Type-safe job handlers with BullMQ:

```typescript
// handlers/index.ts - single source of truth
export const JobHandlerName = { sendWebhook: 'sendWebhook' } as const;
export type JobPayloads = { sendWebhook: SendWebhookPayload };
export type JobHandlers = { [K in JobHandlerName]: JobHandler<JobPayloads[K]> };
export const jobHandlers: JobHandlers = { sendWebhook };
```

Handler patterns:
- `makeJob(handler)` - basic wrapper
- `makeSingletonJob(handler)` - Redis lock prevents concurrent runs (for crons)
- `makeSupersedingJob(handler, dedupeKeyFn)` - newer job cancels older ones

Each handler file exports its payload type + handler.

---

## Cron Jobs (CronJob model + registerCronJobs.ts)

Cron jobs stored in DB, registered with BullMQ on worker startup:

```typescript
// On worker init
await registerCronJobs(); // reads DB, registers with BullMQ

// CronJob fields
id        - DB primary key
jobId     - BullMQ idempotency key (user-specified, e.g., "daily-cleanup")
name      - Human readable name
pattern   - Cron expression ("0 * * * *" = every hour)
handler   - Job handler name (must be in JobHandlerName)
payload   - JSON data passed to handler
enabled   - Toggle on/off
```

Idempotency: Multiple workers calling `registerCronJobs()` won't duplicate jobs - BullMQ uses `jobId` as key.

JobType values:
- `cron` - scheduled by BullMQ repeater
- `cronTrigger` - manually triggered cron job (admin action)
- `adhoc` - one-off job

---

## Superseding Jobs

For jobs where only latest matters (e.g., sync after changes):

```typescript
export const syncData = makeSupersedingJob(
  async (ctx, payload) => { /* work */ },
  (payload) => `sync:${payload.resourceId}` // dedupeKey
);
```

When new job enqueued with same dedupeKey:
1. `enqueueJob` finds existing jobs with that dedupeKey
2. Sets Redis flag `job:superseded:{jobId}`
3. Running job polls flag, aborts via AbortController
4. New job proceeds

---

## Admin Cron Routes (modules/admin/cronJobs/)

CRUD + manual trigger for cron jobs:
- `GET /api/admin/cronJobs` - list all
- `POST /api/admin/cronJobs` - create
- `GET /api/admin/cronJobs/:id` - read one
- `PATCH /api/admin/cronJobs/:id` - update
- `DELETE /api/admin/cronJobs/:id` - delete
- `POST /api/admin/cronJobs/:id/trigger` - run immediately

---

## Route Structure (apps/api/src/)

Hierarchical routing following Zealot pattern:

```
app.ts                    # Creates app, error handlers, mounts routes, OpenAPI
routes/
├── index.ts              # Top-level: health, /auth, /api, bullBoard
├── api.ts                # /api: middleware stack, mounts v1 + admin
├── admin.ts              # /api/admin: cronJobs, organizations (superadmin)
├── health.ts             # /health
└── bullBoard.ts          # /bullBoard (basic auth)
```

URL structure:
- `GET /health` - public
- `ALL /auth/*` - better-auth (cors only, outside /api)
- `* /api/v1/me` - current user
- `* /api/v1/organizations` - org routes
- `* /api/v1/inquiries` - inquiry routes
- `* /api/admin/*` - superadmin routes (cronJobs, organizations)
- `GET /bullBoard` - basic auth

---

## Route Conventions

**Named exports with Router suffix:**
```typescript
export const usersRouter = new OpenAPIHono<AppEnv>();
export const adminRouter = new OpenAPIHono<AppEnv>();
```

**camelCase for URL paths** (matches Prisma model names):
```typescript
adminRouter.route('/cronJobs', cronJobsRouter);  // ✅
adminRouter.route('/cron-jobs', cronJobsRouter); // ❌ no kebab
```

**Modules export both user and admin routers:**
```typescript
// modules/inquiries/index.ts
export const inquiriesRouter = ...      // user routes (/sent, /received, etc.)
export const adminInquiriesRouter = ... // admin routes (readMany ALL, update, delete)

// modules/organizations/index.ts
export const organizationsRouter = ...
export const adminOrganizationsRouter = ...
```

Then `routes/admin.ts` imports admin routers from each module:
```typescript
import { adminInquiriesRouter } from '#/modules/inquiries';
import { adminOrganizationsRouter } from '#/modules/organizations';

adminRouter.route('/inquiries', adminInquiriesRouter);
adminRouter.route('/organizations', adminOrganizationsRouter);
```

This keeps admin logic co-located with its module while cleanly separating user vs admin routes.

---

## Redis Clients (apps/api/src/lib/clients/redis.ts)

Unified Redis with ioredis + ioredis-mock for tests:

```typescript
createRedisConnection(name)  // New connection (queue, worker)
getRedisClient()             // Shared singleton (cache, rate limit)
getRedisPub()                // Alias for getRedisClient
getRedisSub()                // Separate singleton (pub/sub needs own conn)
```

All route through `createRedisConnection()` which uses `ioredis-mock` when `env.isTest`.

Used by:
- Queue (`jobs/queue.ts`) - `createRedisConnection('Queue')`
- Cache (`lib/cache/`) - `getRedisClient()`
- PubSub (`ws/pubsub.ts`) - `getRedisPub()` + `getRedisSub()`

---

## Pagination Utility (lib/prisma/paginate.ts)

Type-safe pagination wrapper for Prisma:

```typescript
const { data, pagination } = await paginate(
  db.organization,
  { where, orderBy: { createdAt: 'desc' } },
  { page, pageSize },
);

return respond.ok(data, { pagination });
```

Signature: `paginate(model, prismaArgs, { page?, pageSize? })`
- Returns `{ data: T[], pagination: { page, pageSize, total, totalPages } }`
- Handles `take`/`skip` and parallel count query

---

## Request Templates (lib/requestTemplates/)

**ALWAYS use templates** - never use `createRoute` directly:

```typescript
import { readRoute, createRouteTemplate, updateRoute, deleteRoute, actionRoute } from '#/lib/requestTemplates';

// Templates handle: operationId, path, method, request/response building
readRoute({ model: 'organizations', many: true, paginate: true, admin: true, responseSchema })
createRouteTemplate({ model: 'organizations', admin: true, bodySchema, responseSchema })
updateRoute({ model: 'organizations', admin: true, bodySchema, responseSchema })
deleteRoute({ model: 'organizations', admin: true })
actionRoute({ model: 'organizations', action: 'activate', admin: true })
```

`admin: true` flag:
- Adds 'Admin' prefix to operationId: `AdminOrganizationsReadMany`
- Adds 'Admin' tag for OpenAPI grouping

`paginate: true` flag:
- Auto-merges `paginateRequestSchema` with custom query schema
- Don't manually extend with `paginateRequestSchema.extend(...)` - the template handles it

---

## Admin Route File Naming

Pattern: `admin<Model><Action>` (e.g., `adminOrganizationsReadMany`, `adminOrganizationsCreate`)

Structure for admin routes within a module:
```
modules/organizations/
├── routes/
│   ├── organizationsRead.ts           # user route
│   ├── adminOrganizationsReadMany.ts  # admin route
│   └── adminOrganizationsCreate.ts    # admin route
├── controllers/
│   ├── organizationsRead.ts
│   ├── adminOrganizationsReadMany.ts
│   └── adminOrganizationsCreate.ts
└── index.ts                           # exports organizationsRouter + adminOrganizationsRouter
```

---

## Prisma Schema Conventions

**Database:** PostgreSQL 18 (docker-compose.yml)

**One model per file** in `packages/db/prisma/schema/`

**ID fields (UUIDv7):**
```prisma
id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
```

**Foreign keys:** Always `@db.VarChar(36)` on UUID FK fields

**String fields:** No `@db.VarChar(n)` or `@db.Text` - defaults to text

**DateTime:** Use `DateTime` (maps to timestamptz)

**Enum naming:**
- `FooModel` = enum values are model names (PascalCase values)
- `FooType` = types of the thing itself (camelCase values)
- `FooStatus`, `FooRole`, `FooAction` = other descriptive suffixes (camelCase values)

```prisma
// Values are model names → FooModel suffix, PascalCase values
enum WebhookOwnerModel {
  User
  Organization
}

// Values are types of the thing → FooType suffix, camelCase values
enum InquiryType {
  memberInvitation
  memberApplication
}

// Other descriptive suffixes, camelCase values
enum InquiryStatus {
  draft
  sent
  resolved
}
```

**Fake polymorphism pattern:**
Instead of true polymorphism (type + id), use type enum + optional FKs:

```prisma
// Type field for filtering
ownerModel WebhookOwnerModel

// Optional FKs with real relations
userId         String?       @db.VarChar(36)
organizationId String?       @db.VarChar(36)

user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
```

Benefits: FK constraints, type-safe includes, proper cascading.

---

## Hooks Structure (apps/api/src/hooks/)

Application hooks that use db primitives:

```
hooks/
├── webhooks/
│   ├── constants/
│   │   ├── enabledModels.ts      # WEBHOOK_ENABLED_MODELS
│   │   ├── ignoredFields.ts      # WEBHOOK_IGNORED_FIELDS
│   │   ├── relatedModels.ts      # WEBHOOK_RELATED_MODELS
│   │   └── subscribers.ts        # WEBHOOK_SUBSCRIBERS (who to notify)
│   ├── hook.ts                   # registerWebhookHook
│   └── utils.ts                  # isWebhookEnabled, selectRelevantFields, etc.
├── cache/
│   ├── constants/
│   │   └── cacheReference.ts     # CACHE_REFERENCE, fetchCacheKeys
│   └── hook.ts                   # registerClearCacheHook
```

The db package provides primitives:
- `registerDbHook` - register before/after hooks on mutations
- `db.isInTxn()` - check if in transaction
- `db.onCommit(fn)` - defer callback until after commit

Hooks use these to implement application logic (webhooks, cache invalidation).

---

## WEBHOOK_SUBSCRIBERS Pattern

Maps: `WebhookModel → WebhookOwnerModel → (extract owner ID from record)`

```typescript
import { WebhookModel, WebhookOwnerModel } from '@template/db';

export const WEBHOOK_SUBSCRIBERS: Partial<Record<
  WebhookModel,
  Partial<Record<WebhookOwnerModel, (data: Record<string, unknown>) => string | null>>
>> = {
  [WebhookModel.Organization]: {
    [WebhookOwnerModel.Organization]: (data) => data.id as string,
  },
};
```

When a model changes, we look up subscribers and match against WebhookSubscription records.

---

## Context Resource Pattern

For routes that operate on a single resource (read, update, delete), use `getResource(c)` instead of refetching:

```typescript
// Middleware loads the resource
const loadOrganization = async (c, next) => {
  const { id } = c.req.valid('param');
  const organization = await db.organization.findUnique({ where: { id } });
  if (!organization) throw new HTTPException(404, { message: 'Organization not found' });
  c.set('resource', organization);
  return next();
};

// Controller gets from context
export const adminOrganizationsReadController = makeController(
  adminOrganizationsReadRoute,
  async (c, respond) => {
    const organization = getResource<Organization>(c);
    return respond.ok(organization);
  },
);
```

---

## FK Naming Convention (Test Factories)

The FK naming convention `{modelName}Id` (e.g., `webhookSubscriptionId`) is what makes automatic dependency inference possible in test factories. When you deviate from this convention (e.g., `subscriptionId` for `WebhookSubscription`), you need manual config.

**Design constraint worth enforcing:**
- `userId` → `User` ✓
- `organizationId` → `Organization` ✓
- `webhookSubscriptionId` → `WebhookSubscription` ✓
- `subscriptionId` → ??? ✗ (ambiguous, needs manual config)

The factory system uses `Prisma.${ModelName}ScalarFieldEnum` to get field names, then matches `fooId` to model `Foo`.

---
