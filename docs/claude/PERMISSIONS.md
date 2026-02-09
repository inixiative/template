# Permissions

## Contents

- [Overview](#overview)
- [Roles](#roles)
- [Actions](#actions)
- [Permix](#permix)
- [Permission Setup](#permission-setup)
- [Permission Checks](#permission-checks)
- [Entitlements](#entitlements)
- [REBAC](#rebac)
- [Space Permissions](#space-permissions)
- [Validation Middleware](#validation-middleware)
- [Role Assignment](#role-assignment)
- [Future Work](#future-work)

---

## Overview

Three-layer permission system:

| Layer | Scope | Storage | Example |
|-------|-------|---------|---------|
| PlatformRole | System-wide | `User.platformRole` | superadmin bypasses all |
| Role | Per-org RBAC | `OrganizationUser.role` | owner, admin, member, viewer |
| Entitlements | Custom ABAC | JSON on OrganizationUser/Token | `{ "canExport": true }` |

---

## Roles

### PlatformRole

System-wide role on User model:

```prisma
enum PlatformRole {
  user        // Default - normal user
  superadmin  // Bypasses all permission checks
}
```

Superadmins:
- Skip all `permix.check()` calls (always return true)
- Can access admin routes
- Can spoof other users

### Role

Per-organization role on OrganizationUser:

```prisma
enum Role {
  owner   // Full control, can delete org, assign any role
  admin   // Can manage settings and users (except owners)
  member  // Can operate (create, edit own resources)
  viewer  // Read-only access
}
```

### Role Hierarchy

```typescript
// packages/permissions/src/roles/shared.ts
export const roleHierarchy = ['viewer', 'member', 'admin', 'owner'] as const;
```

Higher index = more permissions. Used for:
- `lesserRole(a, b)` - Returns the lower of two roles
- `greaterRole(a, b)` - Returns the higher of two roles
- Token permission restriction (token can't exceed user's role)

---

## Actions

Actions define what operations are allowed:

```typescript
// packages/permissions/src/client.ts
export const StandardAction = {
  read: 'read',       // View resources
  operate: 'operate', // Create, edit own resources
  manage: 'manage',   // Edit any resource, manage settings
  own: 'own',         // Full control, delete, transfer ownership
} as const;
```

### Role → Action Mapping

```typescript
// packages/permissions/src/roles/organization.ts
export const organizationRoles = {
  owner:  { organization: { read: true, operate: true, manage: true, own: true } },
  admin:  { organization: { read: true, operate: true, manage: true, own: false } },
  member: { organization: { read: true, operate: true, manage: false, own: false } },
  viewer: { organization: { read: true, operate: false, manage: false, own: false } },
};
```

### roleToStandardAction

Maps role to the highest action it permits:

```typescript
const roleActionMap: Record<Role, OrganizationAction> = {
  owner: 'own',
  admin: 'manage',
  member: 'operate',
  viewer: 'read',
};

roleToStandardAction('admin');  // 'manage'
```

---

## Permix

Permix is the permission checker. Each request gets a fresh instance via `prepareRequest`.

### API

```typescript
type Permix = {
  check: (resource: ResourceType, action: Action, id?: string, data?: unknown) => boolean;
  setup: (perms: PermissionEntry | PermissionEntry[], options?: { replace?: boolean }) => Promise<void>;
  setSuperadmin: (value: boolean) => void;
  getJSON: () => Record<string, Record<string, boolean>> | null;
};
```

### How It Works

```typescript
// 1. Created in prepareRequest (empty, no permissions)
c.set('permix', createPermissions());

// 2. Populated by auth middleware via setupOrgContext/setupUserContext
await permix.setup({
  resource: 'organization',
  id: 'org_abc123',
  actions: { read: true, operate: true, manage: false, own: false },
});

// 3. Checked by validation middleware or controllers
permix.check('organization', 'manage', 'org_abc123');  // false
```

### Superadmin Bypass

```typescript
permix.setSuperadmin(true);
permix.check('organization', 'own', 'any_org');  // Always true
```

---

## Permission Setup

Both organization and user contexts follow the same pattern: role → actions, with optional entitlements and token restrictions.

### setupOrgContext

Called by auth middleware to set org permissions.

```typescript
// packages/permissions/src/roles/organization.ts
export async function setupOrgContext(permix: Permix, params: {
  user?: { platformRole: string } | null;
  role: Role;
  orgId: OrganizationId;
  entitlements?: Entitlements;
}): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(getOrgPermissions(params.role, params.orgId, params.entitlements));
}
```

### setupUserContext

Called by auth middleware to set user permissions. Mirrors org pattern exactly.

```typescript
// packages/permissions/src/roles/user.ts
export async function setupUserContext(permix: Permix, params: {
  user: { id: string; platformRole: string };
  role?: Role;  // Defaults to 'owner'
  entitlements?: Entitlements;
}): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(getUserPermissions(params.user.id, params.role ?? 'owner', params.entitlements));
}
```

**Note**: User context uses the same `Role` enum - a user is effectively "owner" of themselves by default, but tokens can restrict this.

### setupSpacePermissions

Called by auth middleware to set space permissions. Located in `apps/api/src/lib/permissions/setupSpacePermissions.ts`.

```typescript
export const setupSpacePermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  const spaceUsers = c.get('spaceUsers');

  // Space token → single space, token permissions only
  if (token?.ownerModel === 'Space' && token.spaceId) {
    await setupSpaceContext(permix, { role, spaceId, entitlements });
    return;
  }

  // SpaceUser token → single space, lesser of spaceUser + token
  if (token?.ownerModel === 'SpaceUser' && token.spaceId) {
    const spaceUser = spaceUsers?.find((su) => su.spaceId === token.spaceId);
    if (spaceUser) {
      await setupSpaceContext(permix, {
        role: lesserRole(spaceUser.role, token.role),
        spaceId,
        entitlements: intersectEntitlements(spaceUser.entitlements, token.entitlements),
      });
    }
    return;
  }

  // Session or User token → all spaces the user belongs to
  for (const spaceUser of spaceUsers ?? []) {
    const role = token ? lesserRole(spaceUser.role, token.role) : spaceUser.role;
    await setupSpaceContext(permix, { role, spaceId: spaceUser.spaceId, entitlements });
  }
};
```

### Token Permission Restriction

Tokens have their own `role` field that restricts permissions below the user's actual role. This applies to both org and user contexts.

```typescript
// Token schema (simplified)
{
  role: Role,    // 'owner' | 'admin' | 'member' | 'viewer'
  entitlements: Entitlements // Optional custom grants
}
```

**Organization context** - token restricts per-org role:

```typescript
// apps/api/src/lib/permissions/setupOrgPermissions.ts
for (const orgUser of orgUsers) {
  const role = token
    ? lesserRole(orgUser.role, token.role)  // Token can't exceed user's role
    : orgUser.role;
  const entitlements = token
    ? intersectEntitlements(orgUser.entitlements, token.entitlements)
    : orgUser.entitlements;

  await setupOrgContext(permix, { role, orgId, entitlements });
}
```

**User context** - token restricts what user can do to themselves:

```typescript
// apps/api/src/lib/permissions/setupUserPermissions.ts
const role = token?.role ?? 'owner';  // Default: full control
const entitlements = token
  ? intersectEntitlements(user.entitlements, token.entitlements)
  : user.entitlements;

await setupUserContext(permix, { user, role, entitlements });
```

A read-only token (`role: 'viewer'`) can't modify user profile even though the user owns it.

### Role Validation

All permission setup functions validate role values before use to prevent permission bypass from corrupted database data.

**validateRole helper** (`apps/api/src/lib/permissions/validateRole.ts`):

```typescript
import { Role } from '@template/db/generated/client/enums';

export const validateRole = (value: unknown): Role => {
  if (typeof value === 'string' && Object.values(Role).includes(value as Role)) {
    return value as Role;
  }
  return Role.viewer; // Fail closed (most restrictive)
};
```

**Security principles:**
- **Fail closed**: Invalid roles default to `viewer` (most restrictive), not `owner`
- **Runtime validation**: Type assertions alone don't protect against corrupted DB values
- **Defense in depth**: Extra safety layer even though API validation should prevent invalid data

**Usage in permission setup:**
```typescript
// Before: Trust type assertion
role: token.role as Role

// After: Validate before using
role: validateRole(token.role)
```

This prevents scenarios where database corruption or bugs could result in invalid role values bypassing security checks.

---

## Permission Checks

### In Controllers

```typescript
const permix = c.get('permix');

if (!permix.check('organization', 'manage', orgId)) {
  throw new HTTPException(403, { message: 'Access denied' });
}
```

### Via Validation Middleware

The template uses a unified `validatePermission` middleware that leverages ReBAC for permission checks:

```typescript
import { validatePermission } from '#/middleware/validations/validatePermission';

router.patch('/:id',
  resourceContextMiddleware(),
  validatePermission('manage'),  // Checks permission via ReBAC
  handler
);
```

---

## Entitlements

Custom permission grants beyond roles. Stored as JSON on OrganizationUser or Token.

```typescript
type Entitlements = Record<string, boolean> | null;

// Example
{
  "canExport": true,
  "canInvite": true,
  "maxProjects": false  // Can be used for feature flags too
}
```

### How Entitlements Are Applied

Merged into role permissions during setup using **allow override** (entitlements can grant permissions the role doesn't have):

```typescript
// packages/permissions/src/roles/organization.ts
export function getOrgPermissions(role, orgId, entitlements): PermissionEntry {
  const baseActions = organizationRoles[role].organization;
  return {
    resource: 'organization',
    id: orgId,
    actions: { ...baseActions, ...entitlements },  // Entitlements override role
  };
}
```

**Override behavior**: Allow override means a viewer with `{ manage: true }` entitlement CAN manage. Alternative would be deny override where role caps permissions.

| Strategy | Viewer + `{ manage: true }` | Use Case |
|----------|----------------------------|----------|
| Allow override (current) | Can manage | Grant specific powers to limited roles |
| Deny override | Cannot manage | Role is hard ceiling |

### Intersecting Entitlements

When a token has entitlements, they're intersected with user's entitlements:

```typescript
// Only keys true in BOTH are kept
intersectEntitlements(
  { canExport: true, canInvite: true },
  { canExport: true, canInvite: false }
);
// Result: { canExport: true }
```

---

## REBAC

Relationship-Based Access Control allows permissions to delegate through relationships.

Located in `packages/permissions/src/rebac/`.

### Schema

Defines how actions can delegate to other actions or related resources:

```typescript
// packages/permissions/src/rebac/schema.ts
const highRoles = ['owner', 'admin'];

export const rebacSchema: RebacSchema = {
  organization: {
    actions: {
      own: null,           // Terminal - no delegation
      manage: 'own',       // manage → check own on same resource
      operate: 'manage',   // operate → check manage
      read: 'operate',     // read → check operate
      // Role assignment: high roles need own, others need manage
      assign: {
        any: [
          { all: [{ rule: { field: 'role', operator: 'in', value: highRoles } }, 'own'] },
          { all: [{ rule: { field: 'role', operator: 'notIn', value: highRoles } }, 'manage'] },
        ],
      },
    },
  },
  space: {
    actions: {
      own: { rel: 'organization', action: 'own' },  // Delegate to org
      manage: 'own',
      operate: 'manage',
      read: 'operate',
      assign: { /* same as organization */ },
    },
  },
  organizationUser: {
    actions: {
      read: { any: [{ self: 'userId' }, { rel: 'organization', action: 'read' }] },
      leave: { self: 'userId' },  // Users can leave orgs themselves
      manage: { rel: 'organization', action: 'manage' },
      own: { rel: 'organization', action: 'own' },
    },
  },
  spaceUser: {
    actions: {
      read: { any: [{ self: 'userId' }, { rel: 'space', action: 'read' }] },
      leave: { self: 'userId' },  // Users can leave spaces themselves
      manage: { rel: 'space', action: 'manage' },
      own: { rel: 'space', action: 'own' },
    },
  },
  token: {
    actions: {
      leave: { self: 'userId' },  // Users can delete their own tokens
    },
  },
};
```

### ActionRule Types

| Rule | Meaning | Example |
|------|---------|---------|
| `string` | Inherit action from same resource | `manage: 'own'` → check `own` on same resource |
| `{ rel, action }` | Delegate to related resource | `{ rel: 'organization', action: 'own' }` |
| `{ self: field }` | Current user owns the record | `{ self: 'userId' }` → user.id === record.userId |
| `{ rule: Condition }` | JSON rule condition | `{ rule: { field: 'role', operator: 'in', value: ['owner'] } }` |
| `{ any: ActionRule[] }` | At least one must pass | `{ any: [{ self: 'userId' }, 'read'] }` |
| `{ all: ActionRule[] }` | All must pass | `{ all: [{ rule: ... }, 'own'] }` |
| `null` | Always false (terminal) | `own: null` |

### How It Works

1. **Same-resource inheritance**: `manage: 'own'` means "to manage, check if user can own"
2. **Relation delegation**: `own: { rel: 'organization', action: 'own' }` means "to own a Space, check if user owns its Organization"
3. **Chain resolution**: Rules can chain (read → operate → manage → own)
4. **Cycle detection**: Prevents infinite loops

### Example: Space Permission Check

```typescript
// To check space.read:
// 1. read → operate (same resource)
// 2. operate → manage (same resource)
// 3. manage → own (same resource)
// 4. own → { rel: 'organization', action: 'own' } (delegate to org)
// 5. Check organization.own
```

---

## Space Permissions

Spaces are containers within organizations. Space permissions delegate to the parent organization via REBAC.

### Space Roles

Spaces use the same `Role` enum as organizations:

```prisma
enum Role {
  owner   // Full control
  admin   // Manage settings and members
  member  // Operate within resource
  viewer  // Read-only access
}
```

### SpaceUser Model

```prisma
model SpaceUser {
  role            Role
  organizationId  String
  spaceId         String
  userId          String

  // Must be OrganizationUser first
  @@unique([organizationId, spaceId, userId])
}
```

### Permission Flow

```
Space Permission Request
    ↓
Check SpaceUser.role for direct permission
    ↓
If not found, delegate via REBAC to Organization
    ↓
Organization permission grants Space permission
```

### Key Points

1. **Prerequisite**: User must be OrganizationUser before SpaceUser
2. **Delegation**: Space `own` delegates to Organization `own`
3. **Inheritance**: Org owners automatically have Space permissions
4. **Tokens**: Can be scoped to Space via `spaceId` field

---

## Validation Middleware

Located in `apps/api/src/middleware/validations/`.

### validatePermission

Unified permission middleware using ReBAC. Hydrates the resource with relations needed for permission traversal, then checks via ReBAC schema (handles superadmin, direct perms, delegation):

```typescript
import { validatePermission } from '#/middleware/validations/validatePermission';

// Check 'read' on loaded resource
router.get('/:id', validatePermission('read'), handler);

// Check 'manage' on loaded resource
router.patch('/:id', validatePermission('manage'), handler);
```

How it works:
1. Gets the loaded `resource` and `resourceType` from context
2. Hydrates the resource with relations for ReBAC traversal (org -> space, etc.)
3. Checks permission via `check(permix, rebacSchema, resourceType, hydrated, action)`
4. Throws 403 if check fails

### validateOwnerPermission

For polymorphic resources owned by either User or Organization. Checks the `ownerModel` field to determine which permission to validate.

```typescript
// apps/api/src/middleware/validations/validateOwnerPermission.ts
export const validateOwnerPermission = makeMiddleware<Options>((options) => async (c, next) => {
  const resource = c.get('resource');
  const permix = c.get('permix');
  const ownerModel = resource?.ownerModel;  // 'User' | 'Organization' | 'OrganizationUser'

  if (ownerModel === 'User' || ownerModel === 'OrganizationUser') {
    const userId = resource?.userId;
    if (userId && permix.check('user', action, userId)) return next();
  }

  if (ownerModel === 'Organization') {
    const orgId = resource?.organizationId;
    if (orgId && permix.check('organization', action, orgId)) return next();
  }

  throw new HTTPException(403, { message: 'Access denied' });
});
```

Usage (Token/WebhookSubscription can be owned by user or org):

```typescript
// tokenDelete.ts - user deleting their own token
middleware: [validateOwnerPermission({ action: 'manage' })]

// webhookSubscriptionRead.ts - anyone with read access
middleware: [validateOwnerPermission({ action: 'read' })]
```

### validateNotToken

Blocks token-based auth for sensitive operations. Session-only.

```typescript
// Tokens cannot: create other tokens, delete orgs, delete themselves
export const validateNotToken = async (c, next) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'Authentication required' });
  if (c.get('token')) throw new HTTPException(403, { message: 'Tokens cannot perform this action' });
  await next();
};
```

Usage:

```typescript
// tokenDelete.ts - prevent token from deleting itself
middleware: [validateNotToken, validateOwnerPermission({ action: 'manage' })]

// meCreateToken.ts - only sessions can create tokens
middleware: [validateNotToken]

// organizationDelete.ts - destructive action requires session
middleware: [validateNotToken, validatePermission('own')]
```

---

## Role Assignment

Role assignment uses the `assign` action defined in the ReBAC schema. The schema checks:
- Assigning owner/admin (high roles) requires `own` permission
- Assigning member/viewer requires `manage` permission

```typescript
// ReBAC handles this automatically via the assign action
check(permix, rebacSchema, 'organization', { id: orgId, role: targetRole }, 'assign');

// Or inline in controller:
const action = ['owner', 'admin'].includes(targetRole) ? 'own' : 'manage';
if (!permix.check('organization', action, orgId)) {
  throw new HTTPException(403, { message: `Cannot assign ${targetRole} role` });
}
```

### Role Assignment Rules

| Assigner Role | Can Assign |
|---------------|------------|
| owner | owner, admin, member, viewer |
| admin | member, viewer |
| member | - |
| viewer | - |

---

## Token Permissions

Tokens use the `leave` action for self-deletion and the `assign` action (via parent) for creation.

### Token Creation

Token creation checks if the user can assign the token's role:
- Creating an owner-role token requires `own` permission
- Creating a member-role token requires `manage` permission

```typescript
// Check via parent resource (orgUser, spaceUser, etc.)
check(permix, rebacSchema, 'organization', { id: orgId, role: tokenRole }, 'assign');
```

### Token Deletion

The ReBAC schema allows users to delete their own tokens via `leave`:

```typescript
token: {
  actions: {
    leave: { self: 'userId' },  // User can delete if token.userId === user.id
  },
},
```

Additionally, org/space admins can delete tokens within their scope via delegation:
- Org admins can delete OrgUser tokens (via `manage` on organization)
- Space admins can delete SpaceUser tokens (via `manage` on space)

---

## Future Work

### Groups

Permission groups for bulk assignment:

```prisma
model Group {
  id              String           @id
  organizationId  String
  name            String           // "Engineering", "Sales"
  role            Role // Base role for group members
  entitlements    Json?            // Additional grants for group
  members         GroupMember[]
}

model GroupMember {
  groupId  String
  userId   String
}
```

Use cases:
- Assign role + entitlements to many users at once
- "Engineering" group gets `member` role + `{ canDeploy: true }`
- User inherits highest role from all their groups
