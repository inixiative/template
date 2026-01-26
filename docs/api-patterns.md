# API Patterns

## Structure

- **Modules** (`modules/`) - Internal resources (users, organizations)
- **Integrations** (`integrations/`) - External services (S3, Stripe)
- **Namespaces** - `/api/v1/*` (users), `/api/admin/*` (superadmin)

## Route Templates

```typescript
import { readRoute, createRouteTemplate, updateRoute, deleteRoute, actionRoute } from '#/lib/requestTemplates';
```

| Template | Method | Status | Path |
|----------|--------|--------|------|
| `readRoute` | GET | 200 | `/:id` or `/` |
| `createRouteTemplate` | POST | 201 | `/` |
| `updateRoute` | PATCH | 200 | `/:id` |
| `deleteRoute` | DELETE | 204 | `/:id` |
| `actionRoute` | POST | 200 | `/:id/{action}` or `/{action}` |

## Examples

```typescript
// CRUD
export const usersReadRoute = readRoute({ model: 'users', responseSchema: UserSchema });
export const usersReadManyRoute = readRoute({ model: 'users', many: true, paginate: true, responseSchema: UserSchema });
export const usersCreateRoute = createRouteTemplate({ model: 'users', bodySchema: UserCreateSchema, responseSchema: UserSchema });
export const usersCreateManyRoute = createRouteTemplate({ model: 'users', many: true, bodySchema: UserCreateSchema, responseSchema: UserSchema });
export const usersUpdateRoute = updateRoute({ model: 'users', bodySchema: UserUpdateSchema, responseSchema: UserSchema });
export const usersDeleteRoute = deleteRoute({ model: 'users' });

// Actions
export const inquiriesResolveRoute = actionRoute({ model: 'inquiries', action: 'resolve', bodySchema: ResolveSchema, responseSchema: InquirySchema });

// Subresources
export const orgsReadManyUsersRoute = readRoute({ model: 'organizations', submodel: 'users', many: true, responseSchema: OrgUserSchema });
```

## Controllers

```typescript
export const usersReadController = makeController(usersReadRoute, async (c, respond) => {
  const { id } = c.req.valid('param');
  const user = await c.get('db').user.findUnique({ where: { id } });
  if (!user) throw new HTTPException(404, { message: 'Not found' });
  return respond.ok(user);
});
```

## Module Layout

```
modules/<resource>/
├── controllers/<resource>Create.ts
├── routes/<resource>Create.ts
├── services/           # optional
└── index.ts
```

## Naming

`{resource}{Action}{Subresource}` - e.g., `usersCreate`, `inquiriesResolve`, `organizationsReadManyUsers`

Resources are **plural**: users, inquiries, organizations
