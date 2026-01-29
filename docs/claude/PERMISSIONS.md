# Permissions

## Contents

- [Overview](#overview)
- [Roles](#roles)
- [Actions](#actions)
- [Permix](#permix)
- [Permission Setup](#permission-setup)
- [Permission Checks](#permission-checks)
- [Entitlements](#entitlements)
- [Validation Middleware](#validation-middleware)
- [Role Assignment](#role-assignment)
- [Future Work](#future-work)

---

## Overview

Three-layer permission system:

| Layer | Scope | Storage | Example |
|-------|-------|---------|---------|
| PlatformRole | System-wide | `User.platformRole` | superadmin bypasses all |
| OrganizationRole | Per-org RBAC | `OrganizationUser.role` | owner, admin, member, viewer |
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

### OrganizationRole

Per-organization role on OrganizationUser:

```prisma
enum OrganizationRole {
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

### roleToOrgAction

Maps role to the highest action it permits:

```typescript
const roleActionMap: Record<OrganizationRole, OrganizationAction> = {
  owner: 'own',
  admin: 'manage',
  member: 'operate',
  viewer: 'read',
};

roleToOrgAction('admin');  // 'manage'
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
  role: OrganizationRole;
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
  role?: OrganizationRole;  // Defaults to 'owner'
  entitlements?: Entitlements;
}): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(getUserPermissions(params.user.id, params.role ?? 'owner', params.entitlements));
}
```

**Note**: User context uses the same `OrganizationRole` enum - a user is effectively "owner" of themselves by default, but tokens can restrict this.

### Token Permission Restriction

Tokens have their own `role` field that restricts permissions below the user's actual role. This applies to both org and user contexts.

```typescript
// Token schema (simplified)
{
  role: OrganizationRole,    // 'owner' | 'admin' | 'member' | 'viewer'
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

```typescript
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';

router.patch('/:id',
  resourceContextMiddleware(),
  validateOrgPermission('manage'),  // Checks org permission
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

## Validation Middleware

Located in `apps/api/src/middleware/validations/`.

### validateOrgPermission

Checks org-level permission on loaded resource:

```typescript
export const validateOrgPermission = makeMiddleware<Action>((action) => async (c, next) => {
  const resource = c.get('resource');
  const resourceType = c.get('resourceType');

  // Get orgId from resource.organizationId or resource.id if it's an org
  const orgId = resourceType === 'organization'
    ? resource?.id
    : resource?.organizationId;

  if (!orgId) return next();  // No org → skip check

  if (!c.get('permix').check('organization', action, orgId)) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  await next();
});
```

Usage:

```typescript
router.patch('/:id', validateOrgPermission('manage'), handler);
router.delete('/:id', validateOrgPermission('own'), handler);
```

### validateUserPermission

Checks user-level permission (for user-owned resources):

```typescript
export const validateUserPermission = makeMiddleware<{ action: Action; field?: string }>(
  ({ action, field = 'userId' }) => async (c, next) => {
    const resource = c.get('resource');
    const resourceType = c.get('resourceType');

    const userId = resourceType === 'user' ? resource?.id : resource?.[field];
    if (!userId) return next();

    if (!c.get('permix').check('user', action, userId)) {
      throw new HTTPException(403, { message: 'Access denied' });
    }

    await next();
  }
);
```

Usage:

```typescript
router.patch('/:id', validateUserPermission({ action: 'manage' }), handler);
router.patch('/:id', validateUserPermission({ action: 'manage', field: 'ownerId' }), handler);
```

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
  if (!getUser(c)) throw new HTTPException(401, { message: 'Authentication required' });
  if (getToken(c)) throw new HTTPException(403, { message: 'Tokens cannot perform this action' });
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
middleware: [validateNotToken, validateOrgPermission('own')]
```

---

## Role Assignment

### canAssignRole

Validates that the current user can assign a role to another user:

```typescript
// apps/api/src/lib/permissions/canAssignRole.ts
export const canAssignRole = (permix: Permix, orgId: OrganizationId, targetRole: OrganizationRole) => {
  // Assigning owner/admin requires 'own' permission
  // Assigning member/viewer requires 'manage' permission
  const action = [OrganizationRole.owner, OrganizationRole.admin].includes(targetRole)
    ? 'own'
    : 'manage';

  if (!permix.check('organization', action, orgId)) {
    throw new HTTPException(403, { message: `Cannot assign ${targetRole} role` });
  }
};
```

### Role Assignment Rules

| Assigner Role | Can Assign |
|---------------|------------|
| owner | owner, admin, member, viewer |
| admin | member, viewer |
| member | - |
| viewer | - |

Usage:

```typescript
canAssignRole(c.get('permix'), orgId, input.role);  // Throws 403 if not allowed
```

---

## Future Work

### Groups

Permission groups for bulk assignment:

```prisma
model Group {
  id              String           @id
  organizationId  String
  name            String           // "Engineering", "Sales"
  role            OrganizationRole // Base role for group members
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
