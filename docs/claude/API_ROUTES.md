# API Routes

## Contents

- [Naming Conventions](#naming-conventions)
- [Route Templates](#route-templates)
- [Controllers](#controllers)
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
