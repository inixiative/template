# Permissions

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Roles](#roles)
  - [PlatformRole](#platformrole)
  - [Role](#role)
  - [Role Hierarchy](#role-hierarchy)
- [Actions](#actions)
  - [Session Actions](#session-actions)
  - [The Actor](#the-actor)
  - [Role → Action Mapping](#role--action-mapping)
  - [roleToStandardAction](#roletostandardaction)
- [Permix](#permix)
  - [API](#api)
  - [How It Works](#how-it-works)
  - [Superadmin Bypass](#superadmin-bypass)
- [Permission Setup](#permission-setup)
  - [setupOrgContext](#setuporgcontext)
  - [setupUserContext](#setupusercontext)
  - [Delegates and Their Holders](#delegates-and-their-holders)
  - [A Credential Never Exceeds Its Holder](#a-credential-never-exceeds-its-holder)
  - [Integrations Are Holders](#integrations-are-holders)
  - [Granting an Entitlement](#granting-an-entitlement)
  - [Role Validation](#role-validation)
- [Permission Checks](#permission-checks)
  - [In Controllers](#in-controllers)
  - [Via Validation Middleware](#via-validation-middleware)
    - [Resource Lookup Runs Before Authorization](#resource-lookup-runs-before-authorization)
- [Entitlements](#entitlements)
  - [How Entitlements Are Applied](#how-entitlements-are-applied)
- [REBAC](#rebac)
  - [Schema](#schema)
  - [ActionRule Types](#actionrule-types)
  - [How It Works](#how-it-works)
  - [Dot-path vs. Single-hop Delegation](#dot-path-vs-single-hop-delegation)
  - [Example: Space Permission Check](#example-space-permission-check)
- [Owner-Polymorphic Models](#owner-polymorphic-models)
- [Row-Level Overrides](#row-level-overrides)
  - [Schema](#schema)
  - [How `check()` merges](#how-check-merges)
  - [Boundary validation](#boundary-validation)
  - [When to use it](#when-to-use-it)
- [Space Permissions](#space-permissions)
  - [Space Roles](#space-roles)
  - [SpaceUser Model](#spaceuser-model)
  - [Permission Flow](#permission-flow)
  - [Key Points](#key-points)
- [Validation Middleware](#validation-middleware)
  - [validatePermission](#validatepermission)
  - [validateOwnerPermission](#validateownerpermission)
  - [validateSelfPermission](#validateselfpermission)
- [Role Assignment](#role-assignment)
  - [Role Assignment Rules](#role-assignment-rules)
- [Token Permissions](#token-permissions)
  - [Token Creation](#token-creation)
  - [Token Deletion](#token-deletion)
- [Frontend Checks](#frontend-checks)
- [Future Work](#future-work)
  - [Groups](#groups)

<!-- toc:end -->


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
- Can access admin routes — and only there see soft-deleted rows (the admin router runs inside `db.withDeleted`); on ordinary routes tombstones stay invisible to them too
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
- `greaterRole(a, b)` - Returns the higher of two roles
- `narrowing(...)` - a token's role claims every action at or below it ([A Credential Never Exceeds Its Holder](#a-credential-never-exceeds-its-holder))

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

### Session Actions

Actions on the person's own account sit on `db:user` beside the standard four, and every route that acts as the person names one (`validateSelfPermission`, below):

```typescript
// packages/permissions/src/client.ts
export const SessionAction = {
  createToken: 'token.create',              // every token create route
  deleteToken: 'token.delete',              // tokenDelete
  redactUser: 'user.redact',                // meRedact
  rotateUserJwts: 'user.rotateJwts',        // meRotateJwts
  deleteOrganization: 'organization.delete', // organizationDelete, with `own` on the organization
} as const;

export const UserAction = {
  ...StandardAction,
  ...SessionAction,
  identify: 'user.identify',               // meRead: who am I
  createOrganization: 'organization.create', // organizationCreate
};
```

The schema maps each to a standard action: `'user.identify': 'read'`, `'organization.create': 'operate'`. The five session actions are person-only, written as `{ all: [{ actor: model equals User }, 'operate' | 'own'] }`, so a token holding `own` on its user still cannot mint, delete tokens, redact, rotate or delete an organization. A superadmin passes on any credential. `personOnlyActions` lists them for OpenAPI, where their operations publish `userJwt` alone.

### The Actor

The table says what a principal holds. The actor says only who is acting: `permix.setActor({ id, model })`, with `model` `User` for a person and `Token` for any API token. Identity never comes from the actor; acting on your own row is `{ rel: 'user', action }`, a walk to your own user entry. The actor exists for the `{ actor }` arm, which reads it as a json-rules condition. With nobody acting, an actor arm denies and the table still answers everything else.

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

### Delegates and Their Holders

A token or an integration is a delegate: it holds a claim, capped live by its holder. `installPermissions` installs a person's own table (`setupPersonPermissions`: the user grant plus one grant per organization and space seat) or, for a token, the token's claim (`setupTokenPermissions`). `delegateHolder` (`apps/api/src/lib/permissions/delegateHolder.ts`) builds the holder's table from the owner model:

| Owner model | Holder table |
|---|---|
| `User` | the person: the user grant and every seat |
| `OrganizationUser` / `SpaceUser` | that one seat |
| `Organization` / `Space` | `owner` on itself |
| `Integration` | the integration's claim, capped by its own owner's table |

A claim is `{ role, full, entitlements }`, expanded by `delegateClaimEntries` (`packages/permissions/src/roles/delegateClaim.ts`):

- `role` applies at every position the holder has (`narrowing(resource, id, role)` per position), so a User token's role reaches each of the person's organizations, capped by the seat there; an integration's role reaches whatever its owner reaches.
- `entitlements` are entries `{ resource, from, actions }`, held as written. "Only this user's own things" is no role plus one entry from `db:user`.
- `full` passes the holder's table through whole, resolved on every request. A token that is not `full` claims a role, entitlements or both. `full` takes no role and no entitlements beside it, and only exists on a delegation chain: an `Organization` or `Space` token or integration cannot be `full` (it holds itself; give it a role).

Nothing is inherited: a token holds only what it claims, never its holder's entitlements by default. The claim is installed with the holder's table as owner, so at check time each action holds only if the holder still allows it on that record through the normal walk. Demote the seat and its tokens lose it on the next request. A spoofed request (`spoofedBy` set) is capped by the spoofed person.

### A Credential Never Exceeds Its Holder

So a viewer member's token naming `manage` on the organization reads it and does not manage it, an admin's owner-role token manages and does not own, and a space is reached exactly as far as the seat reaches its organization. Situations: `apps/api/src/lib/permissions/tokenNeverExceedsHolder.test.ts`, `delegateClaims.test.ts`.

### Integrations Are Holders

An integration has a nullable `role`, `full` and `entitlements`, capped live by its direct owner (a person, a seat, an organization or a space), and can own tokens. An integration's token (`ownerModel: Integration`) carries `integrationId` as its owner key plus its integration's own owner keys, copied at create by the `falsePolymorphism:delegatedKeys` hook (the registry's `delegates` entry): the keys are tenancy, for scans, list routes, revocation and rate-limit buckets, never identity. An integration's token is never a person, so routes that require one refuse it. If you need an integration as the actor, use its token; a person's token tagged with an integration does not exist. Situations: `integrationHolder.test.ts` and `packages/permissions/src/rebac/delegation.test.ts`.

### Granting an Entitlement

A grant is an action: the writer must be able to take every action the holder would hold, from where it would act. `canGrantEntitlement(permix, entry, position)` (`packages/permissions/src/rebac/canGrantEntitlement.ts`, over the library's `createCanGrantEntitlement`) judges each action through the ordinary check on a stand-in record of the entry's resource placed under the hydrated position. The writer's own claims and owner chain apply, so a token grants no more than its holder could. A granted action skips its rule, so an action whose rule reads the record or the actor (`assign`, person-only actions) is granted at its strongest: the writer must also hold the resource's terminal actions (`own`). A custom action is granted only by a writer who holds it.

- `PATCH /organizationUser/:id` with `entitlements` checks each action as an entry from the organization: an admin grants `operate` and `manage`, not `own` or `assign`.
- A delegate's claim is the writer's permissions or less: `validateDelegateGrant` (`apps/api/src/lib/permissions/validateDelegateGrant.ts`) is the one check, run after the claim shape passes the write rule (422 before 403), for every token mint (inside `createToken`) and for `PATCH /integration/:id`. A role or `full` is a ceiling over the holder's positions, so only what the holder would really pass on is checked (a person with an owner seat and a viewer seat mints a member token); named entries are checked as written. An admin cannot mint an owner token, or set an owner role, on an owner's integration.

Situations: `organizationUserUpdate.test.ts`, `integrationHolder.test.ts`, `delegateClaims.test.ts`.

### Role Validation

All permission setup functions validate role values before use to prevent permission bypass from corrupted database data.

**validateRole helper** (`apps/api/src/lib/permissions/validateRole.ts`):

```typescript
import { Role } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';

export const validateRole = (value: unknown): Role => {
  if (typeof value === 'string' && Object.values(Role).includes(value as Role)) {
    return value as Role;
  }
  throw makeError({
    status: 500,
    message: `Invalid role value: ${JSON.stringify(value)}. Expected one of: ${Object.values(Role).join(', ')}`,
  });
};
```

**Security principles:**
- **Fail loud**: an invalid role is a 500 that names the bad value, not a silent downgrade to `viewer`; a corrupted row stops the request instead of running with a guessed role
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
  throw makeError({ status: 403, message: 'Access denied' });
}
```

### Via Validation Middleware

Authentication gates run first: `validateUser` (needs `c.get('user')`) or `validateActor` (needs `getActor(c).user`; Organization and Space tokens carry no user and fail both). Which to pick: [AUTH.md](./AUTH.md#choosing-between-validateuser-and-validateactor). A route that loads no resource and acts as the person checks its action on the user with `validateSelfPermission` ([below](#validateselfpermission)).

The template uses a unified `validatePermission` middleware that leverages ReBAC for permission checks:

```typescript
import { validatePermission } from '#/middleware/validations/validatePermission';

router.patch('/:id',
  resourceContextMiddleware(),
  validatePermission('manage'),  // Checks permission via ReBAC
  handler
);
```

#### Resource Lookup Runs Before Authorization

`resourceContextMiddleware` throws **404** (not found) or **409** (multiple matches)
*before* `validatePermission` runs. This is intentional. An unauthenticated or
unauthorized caller probing a URL cannot distinguish "this resource doesn't exist"
from "this resource exists but you can't see it" — both surface as 404.

The template treats resource existence as non-secret (IDs frequently appear in
share links, emails, audit logs, and references from peers). Privacy is enforced
on **field visibility and queries**, not on the discoverability of a resource ID.
If a future resource type genuinely needs to hide its existence from non-members,
write a custom middleware that returns 404 when the permission check fails.

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

**Override behavior**: Allow override means a viewer with `{ manage: true }` entitlement CAN manage, which is why writing one is itself checked ([Granting an Entitlement](#granting-an-entitlement)). The role is not a ceiling on the seat itself; the ceiling is the holder, above ([A Credential Never Exceeds Its Holder](#a-credential-never-exceeds-its-holder)): a token naming `{ manage: true }` on a viewer's seat holds nothing the viewer does not.

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
  user: {
    actions: {
      own: null,
      manage: 'own',
      operate: 'manage',
      read: 'operate',
    },
  },

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
      read: { any: [{ rel: 'user', action: 'read' }, { rel: 'organization', action: 'read' }] },
      leave: { rel: 'user', action: 'operate' },  // the person, holding operate on their own user
      manage: { rel: 'organization', action: 'manage' },
      own: { rel: 'organization', action: 'own' },
    },
  },

  spaceUser: {
    actions: {
      read: { any: [{ rel: 'user', action: 'read' }, { rel: 'space', action: 'read' }] },
      leave: { rel: 'user', action: 'operate' },
      manage: { rel: 'space', action: 'manage' },
      own: { rel: 'space', action: 'own' },
    },
  },

  token: {
    actions: {
      leave: { rel: 'user', action: 'operate' },  // the person deletes their own tokens
    },
  },

  authProvider: {
    actions: {
      own: { rel: 'organization', action: 'own' },  // Only org owners manage auth providers
    },
  },

  inquiry: {
    actions: {
      // Source or target can read their own inquiry
      read: {
        any: [
          { rel: 'sourceUser', action: 'read' },
          { rel: 'sourceOrganization', action: 'manage' },
          { rel: 'sourceSpace', action: 'manage' },
          { rel: 'targetUser', action: 'read' },
          { rel: 'targetOrganization', action: 'manage' },
          { rel: 'targetSpace', action: 'manage' },
        ],
      },

      // Send: who may create/initiate each inquiry type
      send: {
        any: [
          // Source user can act on their own inquiry (cancel, edit, re-send)
          // Add type strings here when user-sourced inquiry types exist
          { all: [{ rule: { field: 'type', operator: 'in', value: [] } }, { rel: 'sourceUser', action: 'operate' }] },
          // inviteOrganizationUser: high roles require own
          { all: [{ rule: { field: 'type', operator: 'in', value: ['inviteOrganizationUser'] } }, { rule: { field: 'content.role', operator: 'in', value: highRoles } }, { rel: 'sourceOrganization', action: 'own' }] },
          // inviteOrganizationUser: normal roles require manage
          { all: [{ rule: { field: 'type', operator: 'in', value: ['inviteOrganizationUser'] } }, { rule: { field: 'content.role', operator: 'notIn', value: highRoles } }, { rel: 'sourceOrganization', action: 'manage' }] },
          // createSpace — org owner only
          { all: [{ rule: { field: 'type', operator: 'in', value: ['createSpace'] } }, { rel: 'sourceOrganization', action: 'own' }] },
          // updateSpace — space owner or org owner (sourceSpace.own delegates to org.own)
          { all: [{ rule: { field: 'type', operator: 'in', value: ['updateSpace'] } }, { rel: 'sourceSpace', action: 'own' }] },
          // transferSpace — org owner only (explicit 2-hop bypasses direct space.own)
          { all: [{ rule: { field: 'type', operator: 'in', value: ['transferSpace'] } }, { rel: 'sourceSpace.organization', action: 'own' }] },
        ],
      },

      // Resolve: target decides (approve/deny/requestChanges)
      resolve: {
        any: [
          { rel: 'targetUser', action: 'operate' },
          // transferSpace — target org owner only
          { all: [{ rule: { field: 'type', operator: 'in', value: ['transferSpace'] } }, { rel: 'targetOrganization', action: 'own' }] },
          // all other types — target org manager
          { all: [{ rule: { field: 'type', operator: 'notIn', value: ['transferSpace'] } }, { rel: 'targetOrganization', action: 'manage' }] },
          { rel: 'targetSpace', action: 'manage' },
        ],
      },
    },
  },
};
```

### ActionRule Types

| Rule | Meaning | Example |
|------|---------|---------|
| `string` | Inherit action from same resource | `manage: 'own'` → check `own` on same resource |
| `{ rel, action }` | Delegate to related resource (supports dot-path) | `{ rel: 'organization', action: 'own' }` |
| `{ rule: Condition }` | JSON rule condition | `{ rule: { field: 'role', operator: 'in', value: ['owner'] } }` |
| `{ any: ActionRule[] }` | At least one must pass | `{ any: [{ rel: 'user', action: 'read' }, 'read'] }` |
| `{ all: ActionRule[] }` | All must pass | `{ all: [{ rule: ... }, 'own'] }` |
| `null` | Always false (terminal) | `own: null` |

There is no `self` arm. Acting on your own record is a walk to your own user: `{ rel: 'user', action: 'operate' }` passes when the record's `user` is the acting user **and** the credential holds `operate` on that user row. Identity lives in the permix table (a principal holds grants only on its own user row), so the walk carries both who you are and what you hold; a credential narrowed to `read` on its user cannot leave, delete a sibling token or accept an invite on identity alone. The record must arrive with `user` hydrated; a bare foreign key is denied, never guessed (`principals.test.ts`).

### How It Works

1. **Same-resource inheritance**: `manage: 'own'` means "to manage, check if user can own"
2. **Relation delegation**: `own: { rel: 'organization', action: 'own' }` means "to own a Space, check if user owns its Organization"
3. **Dot-path traversal**: `rel` supports dot-notation for multi-hop chains. `{ rel: 'sourceSpace.organization', action: 'own' }` traverses `inquiry.sourceSpace` then `.organization`, resolving the final model type at each step. Useful when you want to explicitly bypass intermediate delegation and assert on a specific ancestor.
4. **Chain resolution**: Rules can chain (read → operate → manage → own)
5. **Cycle detection**: Prevents infinite loops

### Dot-path vs. Single-hop Delegation

These two rules look similar but behave differently:

```typescript
// Single-hop on space: checks space.own, which delegates to organization.own
// → space owner OR org owner passes (delegation chain runs)
{ rel: 'sourceSpace', action: 'own' }

// Dot-path to organization: jumps directly to the organization record, checks own there
// → only org owner passes (the space record is never checked, only traversed)
{ rel: 'sourceSpace.organization', action: 'own' }
```

Use dot-path when you want a stricter check that bypasses intermediate delegation. In the inquiry schema, `updateSpace` uses single-hop (space owner or org owner can update), while `transferSpace` uses dot-path (org owner only can transfer).

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

## Owner-Polymorphic Models

Models with nullable FKs to multiple owners (Contact, WebhookSubscription, etc.) use the `ownerActions()` helper instead of writing the same fan-out for every action:

```typescript
// packages/permissions/src/rebac/ownerActions.ts
import { ownerActions } from '@template/permissions/rebac/ownerActions';

// Default: fan out across user/organization/space
contact: { actions: ownerActions() },

// Pick a subset
emailTemplate: { actions: ownerActions(['organization', 'space']) },

// Compose with custom actions
contact: { actions: { ...ownerActions(), share: { ... } } },
```

For each of `own`/`manage`/`operate`/`read`, the helper expands to `{ any: [{ rel: 'user', action }, { rel: 'organization', action }, { rel: 'space', action }] }`. Only the populated FK resolves — `rel` returns false for the other relations because the record isn't loaded — so the `any` collapses to the actual owner's chain.

This is what makes the `read → operate → manage → own` chain on User/Org/Space reusable as-is for every owner-polymorphic resource.

---

## Row-Level Overrides

Some resources need per-row sharing on top of the schema-default permissions — e.g. a user wants to make one specific contact readable by anyone, without changing the rule for all their contacts. The pattern is a `permissionRules: Json?` column on the resource that `check()` merges additively with the schema rule.

### Schema

```prisma
model Contact {
  // ...
  permissionRules Json?  // Record<Action, ActionRule> | null
}
```

### How `check()` merges

Inside `packages/permissions/src/rebac/check.ts`, when resolving an action by name:

```typescript
const schemaRule = schema[model]?.actions[actionOrRule] ?? null;
const rowRule    = record.permissionRules?.[actionOrRule];
const merged: ActionRule = rowRule !== undefined
  ? { any: [schemaRule, rowRule] }   // OR — additive only
  : schemaRule;
return check(permix, schema, model, record, merged, visited);
```

**Additive only.** Row rules can grant additional paths but never restrict — the schema rule is the floor. A row rule like `read: { all: [] }` (vacuously true) opens the row to any authenticated requester; setting `read: null` doesn't take read away from the owner.

### Boundary validation

Rows arrive over the API, so route schemas validate the shape before it lands in the DB. Use `buildPermissionRulesSchema(model, pick?)` from `@template/permissions/rebac/permissionRulesSchema` — it derives the valid action keys from `rebacSchema[model].actions` so there's no second source of truth:

```typescript
// apps/api/src/modules/contact/schemas/contactSchemas.ts
import { buildPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';

export const contactCreateBodySchema = ContactScalarInputSchema.omit({ ... }).extend({
  // Only `read` is row-overridable — granting manage/delete via row rules
  // would effectively transfer ownership, so those stay owner-gated.
  permissionRules: buildPermissionRulesSchema('contact', ['read']),
});
```

The schema validates the recursive `ActionRule` envelope (delegations, `{ rel, action }`, `{ rule }`, `{ any }`, `{ all }`) but passes the inner json-rules `Condition` through as `unknown` — runtime `check()` validates it when the rule fires.

### When to use it

Row-level overrides solve a specific need: opt-in sharing of individual records without changing the schema rule for everyone. Use it when:

- The resource has natural per-row access decisions (sharing a contact, publishing an asset).
- The set of overridable actions is narrow — typically `read` only. Exposing `manage`/`delete` row rules effectively lets owners delegate ownership, which usually shouldn't be a row decision.

Don't use it as a substitute for proper rebac modeling. If every row needs the same override, that belongs in the schema rule.

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

  throw makeError({ status: 403, message: 'Access denied' });
});
```

Usage (Token/WebhookSubscription can be owned by user or org):

```typescript
// tokenDelete.ts - user deleting their own token
middleware: [validateOwnerPermission({ action: 'manage' })]

// webhookSubscriptionRead.ts - anyone with read access
middleware: [validateOwnerPermission({ action: 'read' })]
```

### validateSelfPermission

Checks an action on the current user's own `db:user` entry. It is the rail for every route that acts as the person: `/me/*`, `organizationCreate`, and the session actions.

```typescript
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';

middleware: [validateSelfPermission(UserAction.identify)]                 // meRead
middleware: [validateSelfPermission('read')]                              // every meReadMany*
middleware: [validateSelfPermission('operate')]                           // every meCreate*, meReachSegment
middleware: [validateSelfPermission(SessionAction.createToken)]           // meCreateToken and the four owner token routes
middleware: [validateSelfPermission(SessionAction.deleteOrganization), validatePermission('own')] // organizationDelete
```

401 without a user, 403 when the user entry lacks the action. "A token can't do this" is not a middleware any more: it is the action's rule. A viewer User token reads the person and creates nothing; a member token creates; no token holds a person-only action; an OrganizationUser or SpaceUser token holds only `user.identify` on its user, so it answers `GET /me` and nothing else there; Organization and Space tokens have no user and stop at `validateUser`. `securityForRoute` reads the action off the middleware (`selfAction`) and publishes `userJwt` alone when it is person-only. Situations: `apps/api/src/middleware/validations/validateSelfPermission.test.ts`.

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
  throw makeError({ status: 403, message: `Cannot assign ${targetRole} role` });
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

### Token Creation

Every create-token route calls `createToken`, which runs `validateDelegateGrant` against the token's holder; the claim's shape (`full` blocks a role and entitlements, otherwise a role, entitlements or both; no `full` for Organization or Space) is a write rule in `RulesRegistry` (`apps/api/src/hooks/rules/delegateClaimRules.ts`): a token is your permissions or less. Seat token routes also require the seat's own person (`leave` on the seat). Minting is person-only (`SessionAction.createToken`).

### Token Deletion

```typescript
token: {
  actions: {
    leave: { rel: 'user', action: 'operate' },
    assign: /* owner/admin role or full → own on the organization or space; otherwise manage */,
  },
},
```

The person deletes their own tokens and their integrations' tokens (`leave`, through the copied `userId`); organization and space admins delete tokens in their scope, but a `full` or high-role token needs `own`.

---

## Frontend Checks

The frontend runs the same ReBAC engine. `permissions.setup(me)` (`packages/ui/src/store/slices/permissions.ts`) loads the user's own, organization and space permissions from `/me`, mirroring the backend setup. A superadmin gets `permix.setSuperadmin(true)` and every check passes.

| Layer | Entry point |
|-------|-------------|
| Route | `validateUser` / `validateActor`, then `validatePermission` ([Validation Middleware](#validation-middleware)) |
| Page | `_authenticated.tsx` → `useAuthenticatedRouting` → `checkContextPermission`: the nav item's `access` decides "can view"; on failure it falls back to the org (from a space), then user, then public context, else renders `Unauthorized` |
| Nav item | `access(permissions, context, page?)` on `NavItem`; the Sidebar hides items that fail it |
| Component | `checkPermission(permissions, model, record, action)` / `permissions.check(model, record, action)` |

**Check:**

```typescript
import { checkPermission } from '@template/ui/hooks/usePermission';

const permissions = useAppStore((state) => state.permissions);
const canDelete = checkPermission(permissions, 'organization', org, 'own');  // false when record is missing
```

**Visibility.** `Button` takes `show?: boolean | (() => boolean)` and `disabledText` (setting it disables the button and replaces its text):

```typescript
<Button show={checkPermission(permissions, 'organization', org, 'own')}>Delete</Button>
```

**Nav access** (`apps/*/app/config/nav/features/*.ts`):

```typescript
export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
  items: [
    {
      label: 'Auth Providers',
      path: '/authProviders',
      access: (permissions, context) =>
        !!context.organization && permissions.check(...getContextParams(context), 'own'),
    },
  ],
};
```

`getContextParams(context)` returns `[model, record]` for the current tenant context (organization, space, or the user).

**usePermission** (`packages/ui/src/hooks/usePermission.ts`) wraps the check into `{ show, disable, disabledText? }`:

```typescript
const deleteAction = usePermission({ permissions, model: 'organization', record: org, action: 'own' });
// params: disabledText? (default "You do not have permission to perform this action"), requireRecord? (default true)
```

**useInquiryPermission(inquiry, action, side)** fills the current context into the inquiry's source or target side, then checks `inquiry`.

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
