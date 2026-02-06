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
Validation middleware (validatePermission, validateNotToken, etc.)
    ↓
Route handler
  - Access context via getters
```

---

## AppEnv Types

Defined in `apps/api/src/types/appEnv.ts`:

```typescript
type AppVars = {
  db: Db;
  txn: Prisma.TransactionClient | undefined;
  app: Hono<AppEnv>;
  user: User | null;
  organizationUsers: OrganizationUser[] | null;
  organizations: Organization[] | null;
  spaceUsers: SpaceUser[] | null;
  spaces: Space[] | null;
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
| `db` | `Db` | Prisma client for database access |
| `txn` | `TransactionClient \| undefined` | Active transaction client (if in txn) |
| `app` | `Hono<AppEnv>` | App instance (for internal routing in batch API) |
| `user` | `User \| null` | Authenticated user (session or token) |
| `organizationUsers` | `OrganizationUser[] \| null` | User's org memberships |
| `organizations` | `Organization[] \| null` | All orgs user belongs to (flattened) |
| `spaceUsers` | `SpaceUser[] \| null` | User's space memberships |
| `spaces` | `Space[] \| null` | All spaces user has access to (membership + org owner) |
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

  // Initialize org/space context to null
  c.set('organizationUsers', null);
  c.set('organizations', null);
  c.set('spaceUsers', null);
  c.set('spaces', null);

  // Initialize resource context to null
  c.set('resource', null);
  c.set('resourceType', null);

  // Wrap in database scope for logging/tracing
  await logScope('api', () => logScope(requestId, () => db.scope(requestId, next)));
};
```

### What It Does

1. **Creates request ID** - UUID for correlating logs and responses
2. **Initializes permix** - Fresh permission instance (no permissions until auth runs)
3. **Nulls all auth vars** - Ensures clean slate for auth middleware (user, session, token, spoofedBy, organizationUsers, organizations, spaceUsers, spaces)
4. **Wraps in scopes** - Enables `db.getScopeId()` and log correlation throughout request

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
  const permix = c.get('permix');
  permix.setUserId(user.id);
  if (isSuperadmin(user)) permix.setSuperadmin(true);
  await setupUserPermissions(c);
  await setupOrgPermissions(c);
};
```

**Note**: Space users are nested within `organizationUsers` (as `OrganizationUserWithSpaceUsers`). The `spaceUsers` context variable is set separately when needed for permission checks.

### What It Does

1. **Splits user from org memberships** - Separates for individual access
2. **Sets user ID on permix** - Links permissions to the authenticated user
3. **Sets superadmin flag** - Bypasses all permission checks
4. **Sets up user permissions** - For user-owned resources
5. **Sets up org permissions** - For each org the user belongs to

### Direct Setters

For simple values, use `c.set()` directly:

```typescript
c.set('token', token);           // tokenAuthMiddleware
c.set('spoofedBy', originalUser); // spoofMiddleware
c.set('resource', loadedRecord);  // resourceContextMiddleware
c.set('resourceType', 'organization'); // resourceContextMiddleware
```

---

## Context Access

### Direct Access for Simple Values

Most context values can be accessed directly via `c.get()`:

```typescript
const user = c.get('user');                    // User | null
const token = c.get('token');                  // TokenWithRelations | null
const session = c.get('session');              // Session | null
const organizationUsers = c.get('organizationUsers');  // OrganizationUser[] | null
const organizations = c.get('organizations');  // Organization[] | null
const spaceUsers = c.get('spaceUsers');        // SpaceUser[] | null
const spaces = c.get('spaces');                // Space[] | null
const requestId = c.get('requestId');          // string
const db = c.get('db');                        // Db
```

**Pattern change:** Previous versions had `getUser()`, `getToken()`, `getRequestId()` helper functions. These were removed in favor of direct `c.get()` access.

### Context Types

Located in `apps/api/src/lib/context/types.ts`.

#### TokenWithRelations

Tokens include all possible relations for permission setup:

```typescript
type TokenWithRelations = Token & {
  user: User | null;
  organization: Organization | null;
  organizationUser: (OrganizationUser & {
    organization: Organization;
    user: User
  }) | null;
  space: Space | null;
  spaceUser: (SpaceUser & {
    organization: Organization;
    organizationUser: OrganizationUser;
    space: Space;
    user: User
  }) | null;
};
```

Loaded by `tokenAuthMiddleware` based on token's `ownerModel`.

### Complex Getters

Some getters have logic and remain as functions in `apps/api/src/lib/context/`.

#### getActor

```typescript
import { getActor } from '#/lib/context/getActor';

const { user, organization, organizationUser, space, spaceUser, token } = getActor(c);
```

Unified accessor that resolves the current actor from any auth method:
- **Session auth**: user only
- **User token**: user from token
- **OrgUser token**: user + org from token's organizationUser
- **SpaceUser token**: user + org + space from token's spaceUser
- **Org token**: org only (no user)
- **Space token**: space + org (no user)

**Returns stripped objects** (relations removed to prevent circular refs):
```typescript
type OrgUserWithoutRelations = Omit<OrgUserFromToken, 'user' | 'organization'>;
type SpaceUserWithoutRelations = Omit<SpaceUserFromToken, 'user' | 'organization' | 'organizationUser' | 'space'>;
```

#### getResource / getResourceType

```typescript
import { getResource, getResourceType } from '#/lib/context/getResource';

const org = getResource<'organization'>(c);  // Typed based on generic
const modelName = getResourceType(c);        // ModelDelegate | null
```

Accesses resources loaded by middleware for routes with `:id` parameter.

#### isSuperadmin

Two versions exist:

```typescript
// Context getter - extracts user from context, checks platformRole
import { isSuperadmin } from '#/lib/context/isSuperadmin';
if (isSuperadmin(c)) { /* ... */ }

// Permissions check - use when you have a User object directly
import { isSuperadmin } from '@template/permissions';
if (isSuperadmin(user)) { /* ... */ }
```

---

## Refreshing Context

### refreshUserContext

Located in `apps/api/src/lib/context/refreshUserContext.ts`. Reloads user's memberships and permissions mid-request.

```typescript
import { refreshUserContext } from '#/lib/context/refreshUserContext';

await refreshUserContext(c, db);
```

**What it does:**
1. Clears existing permissions (prevents stale permission data)
2. Reloads user with all relations via cached `findUserWithRelations`
3. Updates context using `setUserContext` (user, orgs, spaces, permissions)

**When to use:**
- After adding/removing user from org or space
- After changing user's role in org or space
- When you need fresh membership data mid-request
- In batch operations between rounds (data may have changed)

**Implementation:**
```typescript
export const refreshUserContext = async (c: Context<AppEnv>, db: Db): Promise<void> => {
  const user = c.get('user');
  if (!user) return;

  // Clear stale permissions
  const permix = c.get('permix');
  await permix.setup([], { replace: true });

  // Reload user with all relations (uses cache, optimized queries)
  const userWithRelations = await findUserWithRelations(db, user.id);
  if (!userWithRelations) return;

  // Set up fresh context and permissions
  await setUserContext(c, userWithRelations);
};
```

**Performance:**
- Uses cached `findUserWithRelations` (10-minute TTL)
- Optimized queries: 1 query with include + 3 parallel queries
- Much faster than sequential queries

**Note:** Refreshes ALL permissions (user, org, space) to ensure consistency after membership changes.

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
  db: Db;
  queue: JobsQueue;
  job: Job;
  signal?: AbortSignal;  // For superseding jobs
  /** Logs to both stdout AND BullBoard job logs */
  log: (message: string) => void;
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
  // ctx.log - dual-write to stdout AND BullBoard

  ctx.log('Starting processing');  // Visible in console AND BullBoard UI
  // ... job logic ...
  ctx.log('Completed');
});
```

### Key Differences from Request Context

| Aspect | Request Context | Job Context |
|--------|-----------------|-------------|
| Auth | User/token/permissions | None (system-level) |
| Scope ID | `{requestId}` | `job:{name}:{id}` |
| Context type | `'api'` | `'worker'` |
| Logging | Use `log` from `@template/shared` | Use `ctx.log()` for BullBoard visibility |
| Available in | Controllers/middleware | Job handlers |
