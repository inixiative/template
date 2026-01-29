# Context

## Contents

- [Request Lifecycle](#request-lifecycle)
- [AppEnv Types](#appenv-types)
- [prepareRequest](#preparerequest)
- [Context Setters](#context-setters)
- [Context Getters](#context-getters)
- [Resource Context](#resource-context)
- [Database Scope](#database-scope)
- [Job Context](#job-context)

---

## Request Lifecycle

Middleware order defined in `apps/api/src/routes/api.ts`:

```
Request arrives
    ↓
corsMiddleware
  - Handles CORS headers and preflight
    ↓
prepareRequest
  - Sets db, requestId, permix (fresh instance)
  - Initializes all context vars to null
  - Wraps request in db.scope(requestId)
    ↓
authMiddleware (session)
  - Checks BetterAuth session cookie
  - Loads user + organizationUsers
  - Calls setUserContext → sets up permix
    ↓
spoofMiddleware (superadmin only)
  - Checks spoof-user-email header
  - Replaces user context with spoofed user
  - Sets spoofedBy to original admin
    ↓
tokenAuthMiddleware (Bearer)
  - Skips if user already set (session takes precedence)
  - Parses Authorization header
  - Validates token hash, expiry, isActive
  - Sets token, optionally user
  - Calls setupOrgPermissions/setupUserPermissions
    ↓
resourceContextMiddleware (per-route)
  - Extracts :id param and model from path
  - Loads resource with custom inclusions
  - Enforces 404 (0 results) or 409 (>1 results)
  - Sets resource, resourceType
    ↓
Validation middleware (validateUser, validateOrgPermission, etc.)
    ↓
Route handler
  - Access context via getters
```

---

## AppEnv Types

Defined in `apps/api/src/types/appEnv.ts`:

```typescript
type AppVars = {
  db: ExtendedPrismaClient;
  txn: Prisma.TransactionClient | undefined;
  user: User | null;
  organizationUsers: OrganizationUser[] | null;
  session: Session | null;
  token: TokenWithRelations | null;
  spoofedBy: User | null;
  permix: Permix;
  requestId: string;
  resource: unknown;
  resourceType: string | null;
};

type AppEnv = { Variables: AppVars };
```

| Variable | Type | Description |
|----------|------|-------------|
| `db` | `ExtendedPrismaClient` | Prisma client for database access |
| `txn` | `TransactionClient \| undefined` | Active transaction client (if in txn) |
| `user` | `User \| null` | Authenticated user (session or token) |
| `organizationUsers` | `OrganizationUser[] \| null` | User's org memberships |
| `session` | `Session \| null` | BetterAuth session |
| `token` | `TokenWithRelations \| null` | API token with relations |
| `spoofedBy` | `User \| null` | Original admin when spoofing |
| `permix` | `Permix` | Permission checker instance |
| `requestId` | `string` | UUID for request tracing |
| `resource` | `unknown` | Loaded resource from `:id` param |
| `resourceType` | `string \| null` | Model name of loaded resource |

---

## prepareRequest

Located in `apps/api/src/middleware/prepareRequest.ts`. Runs first on every request.

```typescript
export const prepareRequest = async (c: Context<AppEnv>, next: Next) => {
  const requestId = crypto.randomUUID();

  // Database client
  c.set('db', db);

  // Request tracing
  c.set('requestId', requestId);
  c.header('request-id', requestId);

  // Fresh permission instance per request
  c.set('permix', createPermissions());

  // Initialize auth context to null
  c.set('user', null);
  c.set('session', null);
  c.set('token', null);
  c.set('spoofedBy', null);

  // Initialize resource context to null
  c.set('resource', null);
  c.set('resourceType', null);

  // Wrap in database scope for logging/tracing
  await db.scope(requestId, next);
};
```

### What It Does

1. **Creates request ID** - UUID for correlating logs and responses
2. **Initializes permix** - Fresh permission instance (no permissions until auth runs)
3. **Nulls all auth vars** - Ensures clean slate for auth middleware
4. **Wraps in db.scope** - Enables `db.getScopeId()` throughout request

---

## Context Setters

### setUserContext

Located in `apps/api/src/lib/context/setUserContext.ts`. Called by auth middleware after successful authentication.

```typescript
export const setUserContext = async (c: Context<AppEnv>, userWithOrgs: UserWithOrganizationUsers) => {
  const { organizationUsers, ...user } = userWithOrgs;

  // Set user data
  c.set('user', user);
  c.set('organizationUsers', organizationUsers);

  // Set up permissions
  if (isSuperadmin(user)) c.get('permix').setSuperadmin(true);
  await setupUserPermissions(c);
  await setupOrgPermissions(c);
};
```

### What It Does

1. **Splits user from org memberships** - Separates for individual access
2. **Sets superadmin flag** - Bypasses all permission checks
3. **Sets up user permissions** - For user-owned resources
4. **Sets up org permissions** - For each org the user belongs to

### Direct Setters

For simple values, use `c.set()` directly:

```typescript
c.set('token', token);           // tokenAuthMiddleware
c.set('spoofedBy', originalUser); // spoofMiddleware
c.set('resource', loadedRecord);  // resourceContextMiddleware
c.set('resourceType', 'organization'); // resourceContextMiddleware
```

---

## Context Getters

Located in `apps/api/src/lib/context/`. Use these instead of raw `c.get()` for type safety.

### getUser

```typescript
import { getUser } from '#/lib/context/getUser';

const user = getUser(c);  // User | null
```

### getToken

```typescript
import { getToken } from '#/lib/context/getToken';

const token = getToken(c);  // TokenWithRelations | null
```

Includes relations:

```typescript
type TokenWithRelations = Prisma.TokenGetPayload<{
  include: {
    user: true;
    organization: true;
    organizationUser: {
      include: { user: true; organization: true };
    };
  };
}>;
```

### getActor

```typescript
import { getActor } from '#/lib/context/getActor';

const { user, organization, organizationUser, token } = getActor(c);
```

Unified accessor that resolves the current actor from any auth method:
- **Session auth**: user only
- **User token**: user from token
- **OrgUser token**: user + org from token's organizationUser
- **Org token**: org only (no user)

### getOrgUser

```typescript
import { getOrgUser } from '#/lib/context/getOrgUser';

const orgUser = getOrgUser(c, orgId);  // OrganizationUser | null
```

Finds the user's membership for a specific organization.

### getResource / getResourceType

```typescript
import { getResource, getResourceType } from '#/lib/context/getResource';

const org = getResource<'organization'>(c);  // Typed based on generic
const modelName = getResourceType(c);        // ModelDelegate | null
```

### getRequestId

```typescript
import { getRequestId } from '#/lib/context/getRequestId';

const requestId = getRequestId(c);  // string (UUID)
```

### isSuperadmin

```typescript
import { isSuperadmin } from '#/lib/context/isSuperadmin';

if (isSuperadmin(c)) {
  // Platform admin access
}
```

---

## Resource Context

### resourceContextMiddleware

Located in `apps/api/src/middleware/resources/resourceContextMiddleware.ts`. Automatically loads resources from `:id` params.

```typescript
// Extracts model from path: /api/v1/organization/:id → 'organization'
const delegate = pathParts[3] as ModelDelegate;

// Supports alternate lookups: ?lookup=slug
const lookup = c.req.query('lookup') || 'id';

// Finds resources
const resources = await model.findMany({
  where: { [lookup]: id },
  ...resourceContextArgs[delegate],  // Custom inclusions
});

// Enforces exactly one result
if (!resources.length) throw new HTTPException(404, { message: 'Resource not found' });
if (resources.length > 1) throw new HTTPException(409, { message: 'Multiple resources found' });

c.set('resource', resources[0]);
c.set('resourceType', delegate);
```

### Enforcement Rules

| Condition | Result |
|-----------|--------|
| 0 results | 404 Resource not found |
| 1 result | Sets resource context |
| >1 results | 409 Multiple resources found |

### Lookup Parameter

By default, resources are looked up by `id`. Use `?lookup=` to query by other unique fields:

```bash
# Default - lookup by id
GET /api/v1/organization/org_abc123

# Lookup by slug
GET /api/v1/organization/acme-corp?lookup=slug

# Lookup by email (for users)
GET /api/v1/user/user@example.com?lookup=email
```

The field must be unique or the request returns 409 if multiple matches found.

### Custom Inclusions

Define in `apps/api/src/middleware/resources/resourceContextArgs.ts`:

```typescript
export const resourceContextArgs: Partial<Record<ModelDelegate, object>> = {
  webhookSubscription: {
    include: {
      webhookEvents: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  },
};

// Type the payload for getResource<T>
export type ResourcePayloadMap = {
  webhookSubscription: Prisma.WebhookSubscriptionGetPayload<{
    include: { webhookEvents: { take: 10; orderBy: { createdAt: 'desc' } } };
  }>;
};
```

When you need related data on a resource, add it here rather than re-fetching in the controller.

---

## Database Scope

The database uses AsyncLocalStorage for request-scoped context.

### Scope Methods

```typescript
import { db } from '@template/db';

// Get current scope ID (request UUID or job ID)
const scopeId = db.getScopeId();

// Get context type
const context = db.getScopeContext();  // 'api' | 'worker' | undefined

// Check if inside a transaction
const inTxn = db.isInTxn();
```

### Why Scoping Matters

1. **Logging** - All logs within a scope share the same correlation ID
2. **Transactions** - Hooks can detect whether they're inside a transaction
3. **Debugging** - Trace any database call back to its originating request/job

---

## Job Context

Jobs have their own context, separate from HTTP request context.

### WorkerContext

```typescript
// apps/api/src/jobs/types.ts
type WorkerContext = {
  db: ExtendedPrismaClient;
  queue: JobsQueue;
  job: Job;
  signal?: AbortSignal;  // For superseding jobs
};
```

### Job Scope

```typescript
// worker.ts
await db.scope(`job:${job.name}:${job.id}`, async () => {
  const ctx: WorkerContext = { db, queue, job };
  await handler(ctx, job.data.payload);
});
```

### Handler Usage

```typescript
import { makeJob } from '#/jobs/makeJob';

export const myJob = makeJob<MyPayload>(async (ctx, payload) => {
  // ctx.db - database client (scoped to this job)
  // ctx.queue - for enqueueing follow-up jobs
  // ctx.job - BullMQ job instance (id, attemptsMade, etc.)
  // ctx.signal - abort signal (if using makeSupersedingJob)
});
```

### Key Differences from Request Context

| Aspect | Request Context | Job Context |
|--------|-----------------|-------------|
| Auth | User/token/permissions | None (system-level) |
| Scope ID | `{requestId}` | `job:{name}:{id}` |
| Context type | `'api'` | `'worker'` |
| Available in | Controllers/middleware | Job handlers |
