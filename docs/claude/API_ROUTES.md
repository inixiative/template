# API Routes

<!-- toc:start -->

## Contents

- [Naming Conventions](#naming-conventions)
- [Route Templates](#route-templates)
  - [Template Args](#template-args)
  - [Examples](#examples)
- [Controllers](#controllers)
  - [Respond Types](#respond-types)
- [Module Examples](#module-examples)
  - [AuthProvider Module](#authprovider-module)
    - [Module Structure](#module-structure)
    - [Endpoints](#endpoints)
    - [Platform vs Organization Providers](#platform-vs-organization-providers)
    - [Example: Read Platform Providers (Public)](#example-read-platform-providers-public)
    - [Example: Create Organization Provider (Encrypted)](#example-create-organization-provider-encrypted)
    - [Example: Read Organization Providers (Permission-Aware)](#example-read-organization-providers-permission-aware)
    - [Request/Response Examples](#requestresponse-examples)
    - [Integration with Frontend](#integration-with-frontend)
- [Response Format](#response-format)
  - [Pagination](#pagination)
  - [paginate() Utility](#paginate-utility)
  - [Search & Filtering](#search--filtering)
  - [Bracket Notation Query Parsing](#bracket-notation-query-parsing)
  - [Relation Field Security](#relation-field-security)
  - [OrderBy](#orderby)
- [Frontend Metadata](#frontend-metadata)
  - [OpenAPI Extensions](#openapi-extensions)
  - [Extracting Metadata](#extracting-metadata)
  - [DataTable Configuration](#datatable-configuration)
- [Error Responses](#error-responses)
- [Complex Operations & HTTP Status](#complex-operations--http-status)
  - [Batch Operations](#batch-operations)
- [Middleware](#middleware)
- [Schemas](#schemas)
  - [Default: Use ScalarSchema](#default-use-scalarschema)
  - [Inputs from Generated](#inputs-from-generated)
  - [Colocation Rule](#colocation-rule)
  - [Cross-Field Validations](#cross-field-validations)
- [Router Exports](#router-exports)
- [File Organization](#file-organization)
  - [Core (always present)](#core-always-present)
  - [Common Folders (as needed)](#common-folders-as-needed)
  - [Also](#also)

<!-- toc:end -->


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
| `filterLens` | LensNarrowing | Lens narrowing — controls **filter surface** (which fields are searchable, enum value subsets, server-enforced where). NOT response shape — that's `responseSchema`. |

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

See `docs/claude/AUTH.md` for complete frontend integration patterns.

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

**Canonical pattern**:
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

If you need relation data, pass `include` in the options first. In many cases that is enough. For more complex relation payloads, an explicit `paginate<Delegate, Item>` item type is still acceptable.

`paginate()` expects a route-typed controller context from `makeController()`, so validated query params stay typed all the way through the helper.

**What paginate() handles automatically:**
- Reads `page`, `pageSize` from query params
- Reads `search`, `searchFields` from bracket notation (parsed in prepareRequest)
- Reads `filterLens` from route context (set by middleware) — used for picks-based whitelist + server-side where
- Reads `orderBy` from query and parses it
- Appends `{ id: desc }` as stable pagination tiebreaker
- Calls `buildWhereClause` to combine search + filters

**Stable pagination**: `paginate()` automatically appends `{ id: desc }` as a tiebreaker if no `id` ordering is specified. This ensures consistent results across pages when sorting by non-unique fields (e.g., `name`). Since IDs are UUIDv7 (time-sortable), this also provides chronological ordering as a fallback.

### Search & Filtering

> **Critical distinction — `filterLens` controls FILTER SHAPE, not response shape.**
> `filterLens.root.picks` is the list of fields the consumer can pass in `searchFields[...]`. It does NOT determine what fields the API returns — that's `responseSchema`. The two are independent. A field can be in the response but not searchable, or vice versa.

List endpoints support search via query parameters. Define a `filterLens` on the route and search schemas are auto-injected for the SDK / OpenAPI surface.

**Simple search** — searches across all searchable String fields:
```
GET /api/v1/organizations?search=acme
```

**Advanced search** — bracket notation per field:
```
GET /api/v1/organizations?searchFields[name]=acme&searchFields[slug]=corp
```

**Prisma operators** — nested brackets:
```
# Text operators
GET /api/v1/users?searchFields[email][contains]=@example.com
GET /api/v1/users?searchFields[name][startsWith]=John

# Comparison
GET /api/v1/products?searchFields[price][gte]=100&searchFields[price][lte]=500

# Relation filters
GET /api/v1/users?searchFields[posts][some][status]=published
GET /api/v1/orgs?searchFields[members][every][role]=admin
GET /api/v1/items?searchFields[comments][none][flagged]=true
```

**Supported operators:** `contains`, `startsWith`, `endsWith`, `equals`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `some`, `every`, `none`, `is`, `isNot`.

### Route declaration (lens narrowing)

The `filterLens` field on `readRoute` is a `LensNarrowing` from `@inixiative/json-rules` (2.2.0+). Shape:

```typescript
import { lensFor } from '@template/db/lens';

readRoute({
  model: Modules.organization,
  many: true,
  paginate: true,
  responseSchema: OrganizationSchema,
  filterLens: {
    parent: lensFor('Organization'),         // anchors the lens
    root: {
      picks: ['name', 'slug', 'description'],  // filterable fields (dot-paths for relations)
      // omits: [...],                       // alternatively: exclude specific fields
      // enumOmits: { Status: ['draft'] },   // hide enum values from the SDK type surface
      // where: { ... },                     // server-enforced row filter (Condition AST)
      // relations: { author: { picks: [...], where: ... } },  // descent scoping
    },
  },
});
```

**Picks dot-paths** for relations:
```typescript
root: {
  picks: ['name', 'slug', 'organizationUsers.role', 'organizationUsers.user.name'],
}
```

**Server-enforced filtering — `root.where`:**

For static (route-wide) filters use `root.where`. For per-request / context-dependent filters use the `scopeNarrowing` middleware (see below). Both go through `toPrisma` and AND-merge into the final Prisma where.

```typescript
filterLens: {
  parent: lensFor('Inquiry'),
  root: {
    picks: inquiryPicks,
    enumOmits: { InquiryStatus: ['draft', 'canceled'] },  // SDK type surface
    where: {
      all: [
        { field: 'targetModel', operator: 'equals', value: 'Organization' },
        { field: 'status', operator: 'notIn', value: ['draft', 'canceled'] },  // server enforcement
      ],
    },
  },
},
```

**Defense in depth — `enumOmits` + `where`:** `enumOmits` hides values from the SDK type surface (consumer types can't even express the omitted enum value). `where` enforces the same filter server-side. **Both are needed**: type narrowing prevents accidental misuse, server `where` enforces under raw API calls.

### Dynamic per-request scope — `scopeNarrowing` middleware

For ctx-aware where conditions (tenant scope, user ownership, etc.), use the `scopeNarrowing` middleware. It merges into the narrowing already on context. Supports both sync and async callbacks:

```typescript
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';

readRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  filterLens: inquiryReceivedNarrowing,  // static part
  responseSchema,
  middleware: [
    validatePermission('manage'),
    scopeNarrowing((c) => ({
      root: {
        where: { field: 'targetOrganizationId', operator: 'equals', value: getResource<'organization'>(c).id },
      },
    })),
  ],
});
```

Async (e.g., integration-source lookup):
```typescript
scopeNarrowing(async (c) => {
  const tenantId = await resolveTenant(c);
  return { root: { where: { field: 'tenantId', operator: 'equals', value: tenantId } } };
}),
```

`WhereScope` mirrors the narrowing shape:
```typescript
type WhereScope = {
  root?: { where?: Condition; relations?: Record<string, /* recursive */> };
  mapDefaults?: Record<string, { models?: Record<string, { where?: Condition }> }>;
};
```

### Admin routes

Admin routes typically don't restrict picks — superadmin's `skipFieldValidation` bypasses the whitelist at runtime. But `paginate()` still needs a narrowing on context to enter `buildWhereClause`. Declare a bare lens:

```typescript
readRoute({
  model: Modules.organization,
  many: true,
  paginate: true,
  admin: true,
  filterLens: { parent: lensFor('Organization') },  // bare lens, no narrowing applied
  responseSchema,
});
```

No `picks` / `omits` / `where` — the lens just anchors the model so `paginate()` knows what kind it's filtering. With `skipFieldValidation: true` (superadmin), all bracket-query fields pass through.

### Controller — `paginate()` integration

```typescript
export const organizationReadManyController = makeController(route, async (c, respond) => {
  const db = c.get('db');
  const { data, pagination } = await paginate(c, db.organization);
  return respond.ok(data, { pagination });
});
```

With additional ad-hoc filters (raw Prisma escape hatch — not type-safe against the lens):
```typescript
const { deleted } = c.req.valid('query');
const { data, pagination } = await paginate(c, db.organization, {
  where: { deletedAt: deleted === 'true' ? { not: null } : null },  // AND-merged with narrowing
});
```

### How it works

1. `prepareRequest` middleware parses bracket notation (`?searchFields[name]=value`) into nested objects
2. `prepareMiddleware` injects an inline middleware that sets `filterLens` on context from the route's static `filterLens`
3. `scopeNarrowing` middleware(s) merge ctx-aware wheres into the narrowing
4. `paginate()` reads the final narrowing + bracket-query searchFields, calls `buildWhereClause`
5. `buildWhereClause` validates fields against `filterLens.root.picks`, translates `filterLens.root.where` via `toPrisma`, AND-merges everything

### Security

- Only fields in `filterLens.root.picks` can be searched (whitelist with full dot-paths)
- **Superadmin bypass:** users with `platformRole: 'superadmin'` skip the whitelist (`skipFieldValidation: true`). Path notation validation still applies.
- Path notation: camelCase enforced, rejects snake_case, prevents injection
- Supports Prisma meta-fields (`_count`, `_max`, `_min`, `_avg`, `_sum`)
- Relation fields must be explicitly whitelisted (non-superadmin)
- Max 10 levels of nesting in the bracket query
- Routes without a `filterLens` skip search entirely (`paginate` no-ops the search path)
- `root.where` is AND-merged into the prisma where — server enforces even when the SDK type would allow a value through

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

When using relation filters, explicitly whitelist nested fields in `filterLens.root.picks` as dot-paths:

```typescript
filterLens: {
  parent: lensFor('Organization'),
  root: {
    picks: [
      'name',
      'slug',
      'organizationUsers.role',
      'organizationUsers.user.name',
    ],
  },
}

// Allowed queries:
?searchFields[organizationUsers][some][role]=admin              // ✓ organizationUsers.role whitelisted
?searchFields[organizationUsers][some][user][name]=John         // ✓ organizationUsers.user.name whitelisted

// Rejected queries (non-superadmin):
?searchFields[organizationUsers][some][secretField]=hack        // ✗ not in picks
?searchFields[organizationUsers][some][user][email]=test        // ✗ not in picks

// Superadmin: all valid fields allowed regardless of picks (skipFieldValidation bypass)
```

For deeper structural narrowing of related models, use `root.relations`:

```typescript
filterLens: {
  parent: lensFor('Organization'),
  root: {
    picks: ['name'],
    relations: {
      organizationUsers: {
        picks: ['role'],
        where: { field: 'role', operator: 'notEquals', value: 'pending' },  // descent scope
        relations: {
          user: { picks: ['name', 'email'] },
        },
      },
    },
  },
}
```

**Validation:**
- Full dot-path must be in `picks` (non-superadmin users)
- Superadmin (`platformRole: 'superadmin'`) bypasses picks validation entirely
- Relation operators (`some`, `every`, `none`) automatically supported
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
const { deleted } = c.req.valid('query');

const { data, pagination } = await paginate(c, db.organization, {
  where: {
    deletedAt: deleted === 'true' ? { not: null } : deleted === 'false' ? null : undefined,
  },
});
```

**Path notation** - Supports nested fields up to 5 levels deep:
- `name:asc` - Direct field
- `user.email:desc` - Nested relation
- `organization.user.email:asc` - Deep nested

**Security:** Uses `validatePathNotation()` to prevent injection attacks.

---

## Frontend Metadata

Filter surface metadata (picks, enum subsets, server-side scope) is encoded in the route's `filterLens` and flows into the OpenAPI spec via the per-route `searchFields` query schema. The SDK and frontend `useQueryMetadata` extract it from there.

> **Filter shape vs response shape (recap):** narrowing controls what consumers can **filter** on. The response payload shape comes from `responseSchema`, totally separate. A field can be in the response but not searchable, or searchable but stripped from the response.

### OpenAPI surface (Phase 4 work-in-progress)

Routes with a `filterLens` automatically expose a typed `searchFields` query parameter in the OpenAPI spec. SDK consumers get autocomplete on field names and (where declared) enum-narrowed values:

```typescript
// Route declaration
readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  responseSchema: inquirySentResponseSchema,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: { picks: inquiryPicks },
  },
});

// SDK-generated typed call:
// client.meReadManyInquiriesSent({ searchFields: { type: { equals: 'intro' } } })
```

### Extracting Metadata

Use `getQueryMetadata()` or `useQueryMetadata()` to extract metadata from the OpenAPI spec:

```typescript
import { getQueryMetadata, useQueryMetadata } from '@template/ui/lib';

// By operation ID (recommended)
const meta = getQueryMetadataByOperation('meReadManyOrganizations');

// In React component
function OrganizationsTable() {
  const meta = useQueryMetadata('meReadManyOrganizations');
  // Use meta.searchableFields, meta.orderableFields, meta.enumFilters
}
```

### DataTable Configuration

Use `makeDataTableConfig()` to create table configurations:

```typescript
import { makeDataTableConfig, useDataTableConfig } from '@template/ui/lib';

// Standalone
const config = makeDataTableConfig('meReadManyOrganizations', {
  defaultOrderBy: [{ field: 'createdAt', direction: 'desc' }],
});

// In React component
function OrganizationsTable() {
  const config = useDataTableConfig('meReadManyOrganizations');

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
