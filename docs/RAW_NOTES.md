# Raw Notes

Temporary notes and decisions not yet organized into `docs/claude/`.

---

## Redis Namespaces

Located in `lib/clients/redisNamespaces.ts`:

| Prefix | Purpose |
|--------|---------|
| `bull:*` | BullMQ queues |
| `cache:*` | Application cache |
| `job:*` | Job coordination (supersede flags, singleton locks) |
| `ws:*` | WebSocket pub/sub |
| `otp:*` | One-time passwords |
| `session:*` | User sessions |
| `limit:*` | Rate limiting |

---

## Apps Structure

- `web` - Main user app
- `admin` - Org admin dashboard (orgRole check)
- `superadmin` - Platform admin (platformRole: superadmin)

Same BetterAuth backend for all.

---

## Cross-Field Validations

Don't use `.refine()` on route schemas (causes ZodEffects type issues).

Create validation file and call `.parse()` manually:

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

---

## FK Naming Convention

The FK naming convention `{modelName}Id` enables automatic dependency inference in factories:

- `userId` → `User` ✓
- `organizationId` → `Organization` ✓
- `subscriptionId` → ??? ✗ (ambiguous)

---

## Database Migration Strategy

**Current:** Using `prisma db push` for development speed.

**Before production:** Switch to `prisma migrate` for:
- Data migration scripts
- Rollbacks
- Production safety

---

## Permissions Model

Organizations have four actions: `read`, `operate`, `manage`, `own`

Map to roles: viewer → read, member → operate, admin → manage, owner → own

Route permission mapping:
- `GET` → `validateOrgPermission('read')`
- `POST/PATCH` → `validateOrgPermission('operate')`
- `DELETE` → ownership check OR `validateOrgPermission('manage')`
