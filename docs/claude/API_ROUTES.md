# API Routes

## Contents

- [Naming Conventions](#naming-conventions)
- [Route Templates](#route-templates)
- [Controllers](#controllers)
- [Module Examples](#module-examples)
- [Response Format](#response-format)
- [Error Responses](#error-responses)
- [Middleware](#middleware)
- [Schemas](#schemas)
- [Router Exports](#router-exports)
- [File Organization](#file-organization)

---

## Naming Conventions

Pattern: `resourceActionSubresource`

| Type | Example |
|------|---------|
| Create | `userCreate` |
| CreateMany | `userCreateMany` |
| Read | `userRead` |
| ReadMany | `userReadMany` |
| Subresource (plural) | `organizationReadManySpaces` |
| Subresource (singular) | `organizationCreateSpace` |
| Action | `userActivate` |
| Admin | `adminOrganizationReadMany` |

**Naming rules:**
- Resources are **singular**: `user`, `organization`, `inquiry`
- ReadMany subresources use **plural** form: `Spaces`, `Tokens`, `WebhookSubscriptions`
- Single operations use **singular**: `Space`, `Token`

---

## Route Templates

**Always use templates** from `#/lib/routeTemplates` - never raw `createRoute`.

```typescript
import { readRoute, createRoute, updateRoute, deleteRoute, actionRoute } from '#/lib/routeTemplates';
```

### Template Args

| Arg | Type | Description |
|-----|------|-------------|
| `model` | Module | Resource name (singular) - **required** |
| `submodel` | Module | Nested resource (e.g., `token` → `/:id/tokens`) |
| `action` | string | Verb action (e.g., `activate` → `/:id/activate`) |
| `many` | boolean | List endpoint (affects path, operationId) |
| `paginate` | boolean | Add pagination query params (requires `many`) |
| `admin` | boolean | Adds 'Admin' prefix to operationId and tag |
| `skipId` | boolean | Omit `:id` param from path |
| `bodySchema` | ZodSchema | Request body validation |
| `responseSchema` | ZodSchema | Response shape |
| `query` | ZodSchema | Query params (merged with pagination if enabled) |
| `params` | ZodSchema | Path params (merged with id if not skipped) |
| `sanitizeKeys` | string[] | Keys to strip from body before Prisma |
| `searchableFields` | string[] | Fields that can be searched (auto-injects search schemas) |

### Examples

```typescript
// Read single
readRoute({ model: 'user', responseSchema })

// Read many paginated
readRoute({ model: 'user', many: true, paginate: true, responseSchema })

// Create
createRoute({ model: 'user', bodySchema, responseSchema })

// Create many
createRoute({ model: 'user', many: true, bodySchema: z.array(schema), responseSchema })

// Update
updateRoute({ model: 'user', bodySchema, responseSchema })

// Delete
deleteRoute({ model: 'user' })

// Subresource
createRoute({ model: 'organization', submodel: 'token', bodySchema, responseSchema })

// Action
actionRoute({ model: 'user', action: 'activate', bodySchema, responseSchema })

// Admin
readRoute({ model: 'user', many: true, admin: true, responseSchema })
```

---

## Controllers

Use `makeController()` with responders:

```typescript
import { makeController } from '#/lib/utils/makeController';

export const userReadController = makeController(userReadRoute, async (c, respond) => {
  const db = c.get('db');
  const { id } = c.req.valid('param');

  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new HTTPException(404, { message: 'User not found' });

  return respond.ok(user);
});
```

### Respond Types

| Method | Status | Use Case |
|--------|--------|----------|
| `respond.ok(data)` | 200 | Read, Update |
| `respond.created(data)` | 201 | Create |
| `respond.noContent()` | 204 | Delete |

---

## Module Examples

Complete real-world examples showing all patterns together.

### AuthProvider Module

**Location:** `apps/api/src/modules/authProvider/`

Manages authentication providers (OAuth, SAML) at platform and organization level. Demonstrates encryption, permissions, and public/private endpoints.

#### Module Structure

```
authProvider/
├── controllers/
│   ├── authProviderReadMany.ts          # GET /authProviders (public)
│   ├── authProviderUpdate.ts            # PATCH /authProviders/:id
│   ├── authProviderDelete.ts            # DELETE /authProviders/:id
│   └── adminAuthProviderReadMany.ts     # GET /admin/authProviders
├── routes/
│   └── [matching route files]
├── schemas/
│   └── authProviderSchemas.ts
├── tests/
│   └── authProvider.test.ts
└── index.ts                              # Router exports
```

#### Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/authProviders` | Public | List platform providers (Google, GitHub) |
| GET | `/organizations/:id/authProviders` | Public | List platform + org providers |
| POST | `/organizations/:id/authProviders` | `own` | Create org auth provider |
| PATCH | `/authProviders/:id` | `own` | Update auth provider |
| DELETE | `/authProviders/:id` | `own` | Delete auth provider |
| GET | `/admin/authProviders` | Superadmin | List all providers (admin only) |

#### Platform vs Organization Providers

**Platform providers:**
- Created by superadmins
- Available to all users/orgs (Google, GitHub, etc.)
- Immutable by organization owners
- No encrypted secrets (OAuth configured at platform level)

**Organization providers:**
- Created by organization owners
- Only available to that organization (e.g., custom SAML)
- Can be updated/deleted by org owners
- Secrets encrypted using encryption service (see ENCRYPTION.md)

#### Example: Read Platform Providers (Public)

```typescript
// controllers/authProviderReadMany.ts
import { makeController } from '#/lib/utils/makeController';
import { getPlatformProviders } from '#/lib/auth/platformProviders';

export const authProviderReadManyController = makeController(
  authProviderReadManyRoute,
  async (_c, respond) => {
    const platformProviders = getPlatformProviders();
    return respond.ok(platformProviders);
  },
);
```

**No database query** - platform providers are static configuration loaded from env vars.

#### Example: Create Organization Provider (Encrypted)

```typescript
// organization/controllers/organizationCreateAuthProvider.ts
import { db, organizationId, userId } from '@template/db';
import { encryptField } from '@template/db/lib/encryption/helpers';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';

export const organizationCreateAuthProviderController = makeController(
  organizationCreateAuthProviderRoute,
  async (c, respond) => {
    const org = getResource<'organization'>(c);
    const user = c.get('user')!;
    const { secrets, ...body } = c.req.valid('json');

    const data = {
      ...body,
      id: crypto.randomUUID(),
      organizationId: organizationId(org.id),
      createdBy: userId(user.id),
    };

    // Encrypt secrets before storage
    const encryptedData = await encryptField('authProvider', 'secrets', { ...data, secrets });

    const provider = await db.authProvider.create({
      data: { ...data, ...encryptedData },
    });

    // Strip encrypted fields from response
    const { encryptedSecrets, encryptedSecretsMetadata, encryptedSecretsKeyVersion, ...safeProvider } = provider;

    return respond.created(safeProvider);
  },
);
```

**Key patterns:**
- Extract `secrets` from body before creating data object
- Use `encryptField()` helper (see ENCRYPTION.md)
- Strip encrypted fields from response using destructuring
- Return `201 Created` with sanitized provider

#### Example: Read Organization Providers (Permission-Aware)

```typescript
// organization/controllers/organizationReadAuthProvider.ts
import { getResource } from '#/lib/context/getResource';
import { getPlatformProviders } from '#/lib/auth/platformProviders';
import { check, rebacSchema } from '@template/permissions/rebac';

export const organizationReadAuthProviderController = makeController(
  organizationReadAuthProviderRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource(c);
    const user = c.get('user');
    const permix = c.get('permix');

    // Owners see all providers (enabled + disabled), others see only enabled
    const isOwner = user && check(permix, rebacSchema, 'organization', organization, 'own');

    const platformProviders = getPlatformProviders();

    const orgProviders = await db.authProvider.findMany({
      where: {
        organizationId: organization.id,
        ...(isOwner ? {} : { enabled: true }),
      },
      omit: {
        encryptedSecrets: true,
        encryptedSecretsMetadata: true,
        encryptedSecretsKeyVersion: true,
      },
    });

    return respond.ok({
      platform: platformProviders,
      organization: orgProviders,
    });
  },
);
```

**Key patterns:**
- Combine platform + org providers in single response
- Permission-based filtering (owners see all, others see enabled only)
- Use Prisma `omit` to exclude encrypted fields
- Return structured response `{ platform: [], organization: [] }`

#### Request/Response Examples

**Create SAML provider:**
```bash
POST /organizations/org_123/authProviders
Content-Type: application/json

{
  "provider": "SAML",
  "name": "Company SSO",
  "enabled": true,
  "secrets": {
    "entityId": "https://company.com/saml",
    "ssoUrl": "https://company.com/sso",
    "certificate": "-----BEGIN CERTIFICATE-----\n..."
  }
}

# Response (201 Created):
{
  "data": {
    "id": "ap_xyz",
    "organizationId": "org_123",
    "provider": "SAML",
    "name": "Company SSO",
    "enabled": true,
    "createdBy": "usr_456",
    "createdAt": "2026-02-12T10:00:00Z"
    // Note: secrets fields omitted from response
  }
}
```

**Read org providers:**
```bash
GET /organizations/org_123/authProviders

# Response (200 OK):
{
  "data": {
    "platform": [
      { "provider": "GOOGLE", "name": "Google", "enabled": true },
      { "provider": "GITHUB", "name": "GitHub", "enabled": true }
    ],
    "organization": [
      { "id": "ap_xyz", "provider": "SAML", "name": "Company SSO", "enabled": true }
    ]
  }
}
```

#### Integration with Frontend

```typescript
// packages/ui/src/hooks/useAuthProviders.ts
import { useQuery } from '@tanstack/react-query';
import { organizationReadAuthProvider } from '@template/ui/apiClient';
import { apiQuery } from '@template/ui/lib';

export const useAuthProviders = () => {
  const search = useSearch({ strict: false }) as { org?: string };

  const { data, isLoading, error } = useQuery({
    queryKey: search.org ? ['authProviders', 'org', search.org] : ['authProviders', 'platform'],
    queryFn: search.org
      ? apiQuery((opts) => organizationReadAuthProvider({ ...opts, path: { id: search.org! } }))
      : apiQuery((opts) => authProviderReadMany(opts)),
    retry: 2,
  });

  // Flatten platform + organization providers for display
  const providers = search.org && data?.platform && data?.organization
    ? [...data.platform, ...data.organization]
    : data ?? [];

  return { providers, isLoading, error };
};
```

See `docs/claude/AUTHENTICATION.md` for complete frontend integration patterns.

---

## Response Format

All responses are wrapped in `{ data }`:

```typescript
// Single item
{ "data": { "id": "...", "name": "..." } }

// List
{ "data": [{ "id": "..." }, { "id": "..." }] }
```

### Pagination

For paginated endpoints (`paginate: true`), pass metadata as second arg:

```typescript
return respond.ok(data, { pagination });
```

Response includes pagination metadata:

```typescript
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

Query params: `?page=1&pageSize=10` (defaults: page=1, pageSize=10, max=10000)

Other metadata (totals, aggregates, etc.) can be added the same way via the second argument to `respond.ok()`.

### paginate() Utility

Use `paginate()` for list endpoints. It automatically handles search, filters, orderBy, and pagination from context.

**New signature** (context-based):
```typescript
import { paginate } from '#/lib/prisma/paginate';

// Simple - just context and delegate
const { data, pagination } = await paginate(c, db.user);

// With filters
const { data, pagination } = await paginate(c, db.user, {
  where: { isActive: true },
});

// With includes/omits
const { data, pagination } = await paginate(c, db.token, {
  where: { spaceId: space.id },
  omit: { keyHash: true },
});

return respond.ok(data, { pagination });
```

**What paginate() handles automatically:**
- Reads `page`, `pageSize` from query params
- Reads `search`, `searchFields` from bracket notation (parsed in prepareRequest)
- Reads `searchableFields` from route context (set by middleware)
- Reads `orderBy` from query and parses it
- Appends `{ id: desc }` as stable pagination tiebreaker
- Calls `buildWhereClause` to combine search + filters

**Stable pagination**: `paginate()` automatically appends `{ id: desc }` as a tiebreaker if no `id` ordering is specified. This ensures consistent results across pages when sorting by non-unique fields (e.g., `name`). Since IDs are UUIDv7 (time-sortable), this also provides chronological ordering as a fallback.

### Search & Filtering

List endpoints support search via query parameters. Define `searchableFields` in the route, and search schemas are auto-injected.

**Simple search** - searches across all searchable fields:
```
GET /api/v1/organizations?search=acme
```

**Advanced search** - search specific fields using bracket notation:
```
GET /api/v1/organizations?searchFields[name]=acme&searchFields[slug]=corp
```

**Prisma operators** - use nested brackets for advanced filtering:
```
# Text operators
GET /api/v1/users?searchFields[email][contains]=@example.com
GET /api/v1/users?searchFields[name][startsWith]=John

# Comparison operators
GET /api/v1/products?searchFields[price][gte]=100&searchFields[price][lte]=500
GET /api/v1/users?searchFields[age][gt]=18

# Relation filters
GET /api/v1/users?searchFields[posts][some][status]=published
GET /api/v1/orgs?searchFields[members][every][role]=admin
GET /api/v1/items?searchFields[comments][none][flagged]=true
```

**Supported operators:**
- `contains`, `startsWith`, `endsWith` - String matching
- `equals` - Exact match
- `gt`, `gte`, `lt`, `lte` - Comparison
- `in`, `notIn` - Array membership
- `some`, `every`, `none` - Relation filters
- `is`, `isNot` - Relation equality

**Route definition** (new way):
```typescript
readRoute({
  model: Modules.organization,
  many: true,
  paginate: true,
  responseSchema: OrganizationSchema,
  searchableFields: ['name', 'slug', 'description'],  // Auto-injects search & searchFields
});
```

**Controller** (simplified):
```typescript
export const organizationReadManyController = makeController(route, async (c, respond) => {
  const db = c.get('db');

  // paginate() handles search automatically!
  const { data, pagination } = await paginate(c, db.organization);

  return respond.ok(data, { pagination });
});
```

**With additional filters:**
```typescript
const { deleted } = c.req.valid('query');

const { data, pagination } = await paginate(c, db.organization, {
  where: {
    deletedAt: deleted === 'true' ? { not: null } : null,
  },
});
```

**How it works:**
1. `prepareRequest` middleware parses bracket notation (`?searchFields[name]=value`) into objects
2. `searchableFieldsMiddleware` sets searchableFields on context
3. `paginate()` reads searchFields from bracket query + searchableFields from context
4. `buildWhereClause()` combines search + filters with validation

**Bracket notation parsing:**
- **Automatic**: All bracket notation is parsed into nested objects (arbitrary depth)
- **Generic**: Works for any query param, not just searchFields
- **Validated**: `buildWhereClause` only allows fields in the `searchableFields` whitelist
- **Values trimmed**: All values automatically trimmed of whitespace
- **Depth limited**: Maximum 10 levels of nesting to prevent stack overflow

**Security:**
- Only fields in `searchableFields` can be searched (whitelist validation with full paths)
- Path notation is validated to prevent injection (camelCase enforced, rejects snake_case)
- Supports Prisma meta-fields (`_count`, `_max`, `_min`, `_avg`, `_sum`)
- Supports nested relation fields (e.g., `posts.status`, `posts.author.name`)
- Relation fields must be explicitly whitelisted to prevent unauthorized access
- Depth limit (10 levels) prevents stack overflow from deeply nested queries
- Routes without `searchableFields` gracefully ignore search parameters (no crash)

### Bracket Notation Query Parsing

The API automatically parses bracket notation in query strings into nested objects. Supports arbitrary nesting levels for complex Prisma queries. This happens in `prepareRequest` middleware before Zod validation.

**Single level**: `?filters[status]=active&filters[tier]=premium`
```typescript
{ filters: { status: 'active', tier: 'premium' } }
```

**Multiple levels (operators)**: `?searchFields[price][gte]=100&searchFields[price][lte]=500`
```typescript
{ searchFields: { price: { gte: 100, lte: 500 } } }
```

**Deep nesting (relation filters)**: `?searchFields[posts][some][status]=published`
```typescript
{ searchFields: { posts: { some: { status: 'published' } } } }
```

**How it works:**
1. `prepareRequest` calls `parseBracketNotation(url)`
2. Result stored in context as `c.get('bracketQuery')`
3. Controllers read from context (e.g., `paginate` reads `bracketQuery.searchFields`)
4. Zod validates the final query object

**Implementation:**
```typescript
// apps/api/src/lib/utils/parseBracketNotation.ts
export function parseBracketNotation(url: string): Record<string, any> {
  const matches = url.matchAll(/([^?&=]+)\[([^\]]+)\]=([^&]*)/g);
  const result: Record<string, any> = {};

  for (const [, param, key, value] of matches) {
    if (!result[param]) result[param] = {};
    result[param][key] = decodeURIComponent(value.replace(/\+/g, ' '));
  }

  return result;
}
```

**Use cases:**
- `searchFields[name]=value` for field-specific search
- `filters[status]=active` for complex filtering (future)
- Any custom bracket notation your API needs

**Note**: This is a generic utility - it parses ALL bracket notation, not just search-related params. Specific handling (like search validation) happens in downstream utilities like `buildWhereClause`.

### Relation Field Security

When using relation filters, explicitly whitelist nested fields:

```typescript
// Route definition
searchableFields: [
  'name',                    // Direct field
  'slug',                    // Direct field
  'posts.status',            // Relation field (explicit)
  'posts.title',             // Relation field (explicit)
  'posts.author.name',       // Nested relation (explicit)
  'members.role'             // Relation field
]

// Allowed queries:
?searchFields[posts][some][status]=published        // ✓ posts.status whitelisted
?searchFields[posts][some][title]=test              // ✓ posts.title whitelisted
?searchFields[posts][some][author][name]=John       // ✓ posts.author.name whitelisted

// Rejected queries:
?searchFields[posts][some][secretField]=hack        // ✗ posts.secretField not whitelisted
?searchFields[posts][some][author][email]=test      // ✗ posts.author.email not whitelisted
```

**Validation:**
- Full path must be in `searchableFields` array
- Use dot notation: `posts.status`, not hierarchical objects
- Relation operators (`some`, `every`, `none`) are automatically supported
- Error thrown for non-whitelisted fields (not silently ignored)

### OrderBy

List endpoints support dynamic sorting via query parameters.

**Format**: `?orderBy[]=field:direction`

**Examples**:
```
GET /api/v1/users?orderBy[]=name:asc
GET /api/v1/users?orderBy[]=createdAt:desc&orderBy[]=name:asc
GET /api/v1/users?orderBy[]=organization.name:asc  // Nested fields supported
```

**In route definition**:
```typescript
import { orderByRequestSchema } from '#/lib/routeTemplates/orderBySchema';

readRoute({
  model: Modules.user,
  many: true,
  query: z.object({
    orderBy: orderByRequestSchema,
  }),
  responseSchema,
});
```

**In controller**:
```typescript
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';

const { orderBy } = c.req.valid('query');
const parsedOrderBy = orderBy ? parseOrderBy(orderBy) : [{ createdAt: 'desc' }];

const { data, pagination } = await paginate(
  db.user,
  { where, orderBy: parsedOrderBy },
  { page, pageSize }
);
```

**Path notation** - Supports nested fields up to 5 levels deep:
- `name:asc` - Direct field
- `user.email:desc` - Nested relation
- `organization.user.email:asc` - Deep nested

**Security:** Uses `validatePathNotation()` to prevent injection attacks.

---

## Frontend Metadata

Route metadata (searchableFields) is exposed via OpenAPI extensions and can be consumed by frontend DataTables.

### OpenAPI Extensions

Routes with `searchableFields` automatically include OpenAPI extensions:

```typescript
// Route definition
readRoute({
  model: Modules.space,
  many: true,
  paginate: true,
  responseSchema: SpaceScalarSchema,
  searchableFields: ['name', 'slug'],
});

// Generated OpenAPI spec includes:
// "x-searchable-fields": ["name", "slug"]
```

### Extracting Metadata

Use `getQueryMetadata()` or `useQueryMetadata()` to extract metadata from the OpenAPI spec:

```typescript
import { getQueryMetadata, useQueryMetadata } from '@template/shared';

// By path
const meta = getQueryMetadata('/api/admin/space', 'get');
// => { searchableFields: ['name', 'slug'] }

// By operation ID (recommended)
const meta = getQueryMetadataByOperation('adminSpaceReadMany');

// In React component
function SpacesTable() {
  const meta = useQueryMetadata('adminSpaceReadMany');
  // Use meta.searchableFields
}
```

### DataTable Configuration

Use `makeDataTableConfig()` to create table configurations:

```typescript
import { makeDataTableConfig, useDataTableConfig } from '@template/shared';

// Standalone
const config = makeDataTableConfig('adminSpaceReadMany', {
  defaultOrderBy: [{ field: 'createdAt', direction: 'desc' }],
});

// In React component
function SpacesTable() {
  const config = useDataTableConfig('adminSpaceReadMany');

  return (
    <DataTable
      searchableFields={config.searchableFields}
      defaultOrderBy={config.defaultOrderBy}
    />
  );
}
```

**Benefits:**
- Single source of truth for searchable fields
- Frontend automatically stays in sync with API changes
- OrderBy works generically with any response field

---

## Error Responses

All routes return standardized error responses. Use `makeError` to throw structured errors, or let the error handler normalize unexpected errors.

**Contract:**

```typescript
{
  "error": "RESOURCE_NOT_FOUND",    // Stable machine label
  "message": "User not found",      // User-safe message
  "guidance": "fixInput",           // Behavior hint for UI
  "fieldErrors": {                  // Optional (validation only)
    "email": ["Already taken"]
  },
  "requestId": "abc-123"            // Always present (support/tracing)
}
```

**Supported HTTP codes and default guidance:**

| Code | Label | Default Guidance |
|------|-------|------------------|
| 400 | BAD_REQUEST | fixInput |
| 401 | AUTHENTICATION_FAILED | reauthenticate |
| 403 | PERMISSION_DENIED | requestPermission |
| 404 | RESOURCE_NOT_FOUND | fixInput |
| 405 | METHOD_NOT_ALLOWED | contactSupport |
| 409 | CONFLICT | fixInput |
| 410 | RESOURCE_GONE | fixInput |
| 413 | PAYLOAD_TOO_LARGE | fixInput |
| 415 | UNSUPPORTED_MEDIA_TYPE | contactSupport |
| 422 | VALIDATION_ERROR | fixInput |
| 429 | RATE_LIMITED | tryAgain |
| 500 | SERVER_ERROR | contactSupport |
| 502 | BAD_GATEWAY | tryAgain |
| 503 | SERVICE_UNAVAILABLE | refreshAndRetry |
| 504 | GATEWAY_TIMEOUT | tryAgain |

**Usage:**

```typescript
import { makeError } from '#/lib/errors';

// Throw with explicit status and message
throw makeError({
  status: 404,
  message: 'Organization not found',
  requestId: c.get('requestId'),
});

// Status defaults to 500, message defaults to HTTP status name
throw makeError({
  requestId: c.get('requestId'),
});

// Override default guidance
throw makeError({
  status: 404,
  guidance: 'tryAgain',
  requestId: c.get('requestId'),
});

// Include field errors for validation
throw makeError({
  status: 422,
  message: 'Invalid input',
  fieldErrors: { email: ['Must be a valid email'] },
  requestId: c.get('requestId'),
});
```

**How it works:**

- `makeError` returns an `HTTPException` with a pre-built JSON response
- Error handler middleware catches and returns `err.getResponse()` for HTTPException
- Unknown errors are normalized to 500 with standardized body
- Zod validation errors automatically map to 422 with fieldErrors
- Prisma errors (P2002, P2025) map to 409/404 with standardized body

Types are defined in `@template/shared/errors` and derived from `HTTP_ERROR_MAP` to prevent drift.

Default guidance for unknown/internal errors: `contactSupport`.

`type` is optional and not required by default. In most cases, `status + guidance` is enough to drive frontend behavior.

Throw `HTTPException` to return errors:

```typescript
import { HTTPException } from 'hono/http-exception';

throw new HTTPException(404, { message: 'User not found' });
throw new HTTPException(403, { message: 'Not authorized' });
```

---

## Complex Operations & HTTP Status

### Batch Operations

For operations that execute multiple sub-requests (like batch APIs), use consistent HTTP status semantics.

**Pattern:** Always return `200 OK` with detailed status in payload

**Rationale:**
- Complex multi-request operations have mixed outcomes
- Single HTTP status code cannot represent partial success/failure
- Clients must inspect detailed results anyway
- Clear separation: HTTP status (operation succeeded) vs payload status (outcome)

**Example - Batch API:**
```typescript
// Always returns 200 with detailed results
{
  data: {
    batch: [[...]], // Detailed request results
    summary: {
      status: 'success' | 'partialSuccess' | 'failed',
      successfulRequests: 5,
      failedRequests: 2,
      ...
    }
  }
}
```

**When to use 200 for operations:**
- Batch/bulk operations
- Multi-step workflows
- Operations with partial success scenarios
- Any operation where detailed inspection is required

**When to use 4xx/5xx:**
- Request validation failure (400, 422)
- Authentication/authorization failure (401, 403)
- Single-resource operations that fail (404, 500)
- Security violations (400)

See [BATCH.md](./BATCH.md) for comprehensive batch API documentation.

---

## Middleware

Add route-level middleware via the `middleware` option:

```typescript
import { validatePermission } from '#/middleware/validations/validatePermission';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { validateNotToken } from '#/middleware/validations/validateNotToken';

// ReBAC permission check on loaded resource
readRoute({
  model: 'organizationUser',
  middleware: [validatePermission('read')],
  responseSchema,
});

// Polymorphic resource permission (User or Organization owner)
updateRoute({
  model: 'webhookSubscription',
  middleware: [validateOwnerPermission({ action: 'operate' })],
  bodySchema,
  responseSchema,
});

// Forbid token auth (session only)
createRoute({
  model: 'token',
  middleware: [validateNotToken],
  bodySchema,
  responseSchema,
});
```

See [AUTH.md](AUTH.md#validation-middleware) for all available validation middlewares.

---

## Schemas

### Default: Use ScalarSchema

```typescript
import { UserScalarSchema } from '@template/db/zod/models';
```

### Inputs from Generated

```typescript
import { UserCreateInputObjectZodSchema } from '@template/db/zod';
```

### Colocation Rule

- **Colocate in route file** by default
- **Separate file** only when shared across multiple routes

```typescript
// In route file (default)
const bodySchema = z.object({ name: z.string() });
export const userCreateRoute = createRoute({ model: 'user', bodySchema, ... });

// Shared → validations/userBody.ts
export const userBodySchema = z.object({ ... });
```

### Cross-Field Validations

**Don't use `.refine()` on route schemas** - it creates `ZodEffects` types that break hono-zod-openapi.

Instead, create validation files and call `.parse()` manually in controller:

```typescript
// validations/organizationCreateUserBody.ts
const schema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
}).refine((data) => data.userId || data.email, {
  message: 'Either userId or email is required',
});

export const validateOrganizationCreateUserBody = (body: unknown) => schema.parse(body);
```

```typescript
// In controller
const body = c.req.valid('json');
validateOrganizationCreateUserBody(body);  // Throws ZodError if invalid
```

---

## Router Exports

Export both normal and admin routers with `Router` suffix:

```typescript
export const userRouter = new OpenAPIHono<AppEnv>();
export const adminUserRouter = new OpenAPIHono<AppEnv>();
```

Mount in module index:

```typescript
// index.ts
userRouter.openapi(userReadRoute, userReadController);
adminUserRouter.openapi(adminUserReadManyRoute, adminUserReadManyController);

export { userRouter, adminUserRouter };
```

---

## File Organization

### Core (always present)

```
modules/<resource>/
├── controllers/     # One file per endpoint
├── routes/          # One file per endpoint
└── index.ts         # Router registration
```

### Common Folders (as needed)

| Folder | Purpose |
|--------|---------|
| `constants/` | Static values, config |
| `services/` | Complex business logic |
| `schemas/` | Shared Zod schemas (when not colocated) |
| `transformers/` | Data transformation functions |
| `validations/` | Cross-field validation with `.refine()` |
| `utils/` | Module-specific utilities |
| `handlers/` | Job handlers (in jobs module) |
| `tests/` | Test files |

### Also

- `apps/api/src/integrations/` - External service integrations
