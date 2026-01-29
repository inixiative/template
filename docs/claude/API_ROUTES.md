# API Routes

## Contents

- [Naming Conventions](#naming-conventions)
- [Route Templates](#route-templates)
- [Controllers](#controllers)
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
| Subresource (plural) | `organizationReadManyUsers` |
| Subresource (singular) | `organizationCreateToken` |
| Action | `userActivate` |
| Admin | `adminOrganizationReadMany` |

- Resources are **singular**: `user`, `organization`, `inquiry`
- Subresources are plural or singular based on operation

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

---

## Error Responses

All routes automatically include error responses (400, 401, 403, 404, 409, 422, 500):

```typescript
{
  "error": "NotFound",
  "message": "User not found",
  "guidance": "Check the ID is correct",  // optional
  "stack": "..."  // included until project stable
}
```

Throw `HTTPException` to return errors:

```typescript
import { HTTPException } from 'hono/http-exception';

throw new HTTPException(404, { message: 'User not found' });
throw new HTTPException(403, { message: 'Not authorized' });
```

---

## Middleware

Add route-level middleware via the `middleware` option:

```typescript
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { validateNotToken } from '#/middleware/validations/validateNotToken';

// Require org permission
readRoute({
  model: 'organizationUser',
  middleware: [validateOrgPermission('read')],
  responseSchema,
});

// Polymorphic resource permission
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
