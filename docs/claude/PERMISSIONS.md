# Permissions

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Roles](#roles)
  - [PlatformRole](#platformrole)
  - [Role](#role)
  - [Role Hierarchy](#role-hierarchy)
- [Actions](#actions)
  - [The Action Catalog](#the-action-catalog)
  - [Role → Action Mapping](#role--action-mapping)
  - [roleToStandardAction](#roletostandardaction)
- [Permix](#permix)
  - [API](#api)
  - [How It Works](#how-it-works)
  - [Superadmin Bypass](#superadmin-bypass)
- [Permission Setup](#permission-setup)
  - [Who Gets Which Entries](#who-gets-which-entries)
  - [Role Validation](#role-validation)
- [Permission Checks](#permission-checks)
  - [In Controllers](#in-controllers)
  - [Via Validation Middleware](#via-validation-middleware)
    - [Resource Lookup Runs Before Authorization](#resource-lookup-runs-before-authorization)
- [Entitlements](#entitlements)
  - [How Entitlements Are Applied](#how-entitlements-are-applied)
- [Grants](#grants)
  - [Full or Narrowed](#full-or-narrowed)
  - [capGrant](#capgrant)
  - [Issuing Is Capped by the Issuer](#issuing-is-capped-by-the-issuer)
  - [Granting User Entitlements](#granting-user-entitlements)
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
  - [Token Editing](#token-editing)
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
| Entitlements | Custom ABAC | JSON on OrganizationUser / SpaceUser / Token, or a JWT grant | `{ "artifact.create": true }` |

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
- `lesserRole(a, b)` - Returns the lower of two roles
- `greaterRole(a, b)` - Returns the higher of two roles
- Token permission restriction (token can't exceed user's role)

---

## Actions

Every route checks an action: on the resource it loads, or on the user itself (`validateSelfPermission`) when it loads none. A route that only checks authentication is a gap.

### The Action Catalog

```typescript
// packages/permissions/src/client.ts
export const StandardAction = { read, operate, manage, own };

// Held by the login (session, or a JWT with no grant). A role never implies one;
// a token or grant holds one only when its entitlements name it.
export const SessionAction = {
  createToken: 'token.create',        // every token create and token edit route
  deleteToken: 'token.delete',        // tokenDelete
  redactUser: 'user.redact',          // meRedact
  deleteOrganization: 'organization.delete', // organizationDelete (plus `own` on the org)
};

export const UserAction = { ...StandardAction, ...SessionAction, createOrganization: 'organization.create' };
export const InquiryAction = { read, send, resolve, revoke };

export type CustomAction = `${string}.${string}`; // e.g. 'artifact.create'
export type Action = UserAction | OrganizationAction | SpaceAction | InquiryAction | CustomAction;
```

An action maps to a role through the rebac schema: `'organization.create': 'operate'` on `db:user` means every principal holding `operate` on itself holds it. A custom key is a real action only once the schema maps it (`'artifact.create': 'operate'` on `db:organization`); an unmapped key is held only by a principal whose entitlements grant it, so a session never holds it and a grant cannot be capped to it. Any action can also be granted directly through entitlements.

Which routes check what:

| Routes | Action | On |
|---|---|---|
| `meRead`, every `meReadMany*` | `read` | the user |
| `meCreate*` (contact, flow, inquiry, integration, segment, webhookSubscription), `meReachSegment` | `operate` | the user |
| `meCreateToken`, `organizationCreateToken`, `spaceCreateToken`, `organizationUserCreateToken`, `spaceUserCreateToken` | `token.create` | the user (plus the route's own check on the owner) |
| `tokenDelete` | `token.delete` | the user (plus `leave` / `assign` on the token) |
| `meRedact` | `user.redact` | the user |
| `organizationCreate` | `organization.create` | the user |
| `organizationDelete` | `organization.delete` on the user, `own` on the org | both |
| `integrationCreateInquiry` | `manage` | the integration |
| `inquiryRevoke` | `revoke` | the inquiry |

### Role → Action Mapping

A role grants its single highest action; the rebac chain (`read → operate → manage → own`) fills in the rest:

```typescript
// packages/permissions/src/roles/organization.ts (space.ts and user.ts have the same shape)
export const organizationRoles = {
  owner: { organization: { own: true } },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true } },
  viewer: { organization: { read: true } },
} as const;
```

An admin checking `read` passes because `read` delegates to `operate`, `operate` to `manage`, and `manage` is granted.

### roleToStandardAction

Maps role to the highest action it permits:

```typescript
const roleActionMap: Record<Role, Action> = {
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

// 2. Populated by setUserContext → setupUserPermissions / setupOrgPermissions / setupSpacePermissions
await permix.setup(getOrgPermissions('member', orgId));
// { resource: 'db:organization', id: orgId, actions: { operate: true } }

// 3. Checked through the rebac engine, which walks the action chain
check(permix, rebacSchema, 'organization', { id: orgId }, 'read');    // true: read → operate
check(permix, rebacSchema, 'organization', { id: orgId }, 'manage');  // false
```

### Superadmin Bypass

```typescript
permix.setSuperadmin(true);
permix.check('organization', 'own', 'any_org');  // Always true
```

---

## Permission Setup

`setUserContext` (`apps/api/src/lib/context/setUserContext.ts`) sets the user, then runs `setupUserPermissions`, `setupOrgPermissions` and `setupSpacePermissions` (`apps/api/src/lib/permissions/`). Each writes one entry per resource: `db:user:<id>`, `db:organization:<id>`, `db:space:<id>`. A principal that narrows the user (a user-bound token or a JWT grant, read by `getPrincipalGrant`) goes through [`capGrant`](#capgrant) against the owner's grant for that entry.

### Who Gets Which Entries

| Principal | `db:user:<self>` | `db:organization:*` | `db:space:*` |
|---|---|---|---|
| Session, or JWT with no grant | the login grant: `own` + every `SessionAction` | each membership's role + entitlements | each membership's role + entitlements |
| User token, or JWT with a grant | the grant, capped by the login grant | the grant, capped by each membership | the grant, capped by each membership |
| OrganizationUser token | none | its organization only, capped by that membership | none |
| SpaceUser token | none | none | its space only, capped by that membership |
| Organization token | none (no user) | its organization: token role + entitlements | none |
| Space token | none (no user) | none | its space: token role + entitlements |

A superadmin is superadmin through every principal (session, token, JWT), spoofing included: `setUserContext` sets the bypass from the user's platform role.

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

Authentication gates run first: `validateUser` (needs `c.get('user')`) or `validateActor` (needs `getActor(c).user`; Organization and Space tokens carry no user and fail both). Which to pick: [AUTH.md](./AUTH.md#choosing-between-validateuser-and-validateactor).

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

Custom grants beyond the role, stored as JSON on OrganizationUser, SpaceUser and Token, and carried by a JWT grant.

```typescript
type Entitlements = Record<string, boolean> | null;

{ "artifact.create": true, "manage": true }
```

### How Entitlements Are Applied

On a membership they **add**: a viewer membership with `{ manage: true }` can manage. That is how an organization grants one person more than their role.

```typescript
// packages/permissions/src/roles/shared.ts
export const grantActions = (baseActions, entitlements, entitlementsOnly = false) =>
  entitlementsOnly ? { ...entitlements } : { ...baseActions, ...entitlements };
```

On a token or a JWT grant they never add past the owner: see [Grants](#grants).

---

## Grants

A grant is what a credential carries: a User token, an OrganizationUser or SpaceUser token, or a JWT whose `grant` claim names an approved `grantUserEntitlements` inquiry. It has the shape of a membership plus one flag:

```typescript
// packages/permissions/src/grant.ts
type Grant = { role: Role; entitlements: Entitlements };
type EntitlementGrant = Grant & { entitlementsOnly: boolean };
```

**A grant never exceeds its owner.** For the `db:user` entry the owner is the login grant (`userLoginGrant`); for an organization or space entry it is the user's membership there. A User token's entitlements apply to the user itself; on an organization or space they can only keep what the membership already reaches.

### Full or Narrowed

Every token and grant is one of two kinds, and either can be changed later (see [Token Permissions](#token-permissions)):

| Kind | Stored as | On each entry |
|---|---|---|
| **full** | `entitlements: null`, `entitlementsOnly: false` | `lesserRole(owner.role, grant.role)` + **everything the owner holds there**, read live (a membership's custom entitlements included). Never the login-only `SessionAction`s. |
| **narrowed** | an explicit `entitlements` list | default mode: `lesserRole(owner.role, grant.role)` + the named entitlements the owner reaches; entitlement-only (`entitlementsOnly: true`): the named entitlements the owner reaches and nothing else |

An entitlement-only grant with no entitlements can do nothing except `user.identify` (`GET /me`), which every user-bound principal holds.

### capGrant

```typescript
capGrant(resource: 'db:user' | 'db:organization' | 'db:space', owner: Grant, grant: EntitlementGrant): EntitlementGrant
```

- A named entitlement survives only when `grantReaches(resource, owner, action)`: the owner holds it directly, or reaches it through a string delegation in the rebac schema (`read → operate → manage → own`, `'organization.create' → 'operate'`). Rule-gated actions (`assign`) are never reached this way.
- A full grant inherits `owner.entitlements` minus the session actions.

Before `capGrant`, the token cap intersected entitlements and treated a `null` membership value as "no limit", returning the token's entitlements whole: a viewer member holding a User token with `{ manage: true }` could update the organization and its spaces. `apps/api/src/lib/permissions/grantCap.test.ts` keeps that case.

### Issuing Is Capped by the Issuer

The request-time cap stops a grant exceeding the *user*; it does not stop a narrow credential minting a wider one. So whoever mints or self-approves a user grant must hold all of it: `validateHeldGrant` (`findUnheldGrant`) requires the issuing principal to hold the role on every entry the new grant reaches (`lesserRole(membership, role)`, as `capGrant` gives it) and every named entitlement, and refuses a **full** grant from a narrowed issuer (a full grant inherits what the issuer may not hold). It runs on `/me/tokens`, on `PATCH /token/:id` when the editor is the token's own user, and on the handshake approval of a `grantUserEntitlements` inquiry targeting a user. The full-from-narrowed refusal (`validateFullGrantIssuer`) also runs on the OrganizationUser and SpaceUser token create routes and on every `PATCH /token/:id`, since a full membership token inherits the membership's entitlements.

Organization and space tokens are different: there the editor needs **authority to assign**, not to hold. `assignLevel(role, entitlements, resource)` turns the request into a role: each named action takes the lowest role that reaches it through the schema (`read` → viewer, `operate` → member, `manage` → admin, `own` → owner, `'organization.create'` → member); an action with a non-chain rule (`assign`) counts as **owner**, because a direct grant short-circuits its role-aware rule; an unmapped custom key counts as member. The `assign` rule then decides: owner/admin levels need `own` on the org or space, the rest `manage`. The same check guards `PATCH /organizationUser/:id` when it writes entitlements.

### Granting User Entitlements

An Inquiry of type `grantUserEntitlements` (handler: `apps/api/src/modules/inquiry/handlers/grantUserEntitlements`). **The requester does not need to hold what it asks for; the approver must have authority to assign it.** Three shapes, by target:

| Target | Who asks | Who approves | Approval writes |
|---|---|---|---|
| `Organization` | a member (`POST /me/inquiries`) | someone with `assign` on the org at `assignLevel(entitlements)` (an admin for member-level, the owner for `own`/`manage`) | the entitlements onto the requester's `OrganizationUser` |
| `Space` | a space member | `assign` on the space at that level | onto the requester's `SpaceUser` |
| `User` | the user (handshake) or an integration (`POST /integration/:id/inquiries`, needs `manage` on it) | the user, holding `token.create` and the whole grant | `resolution.grant` (`role`, `entitlements`, `entitlementsOnly`) for a JWT `grant` claim |

```typescript
{ type: 'grantUserEntitlements', targetModel: 'Organization', targetOrganizationId, status: 'sent',
  content: { purpose: 'export reports', entitlements: { 'report.export': true }, entitlementsOnly: true } }
```

- **Auto-approval is off** except for the handshake: the user asks for their own grant and could approve it themselves (`autoApproveOwnRequest`, `apps/api/src/modules/inquiry/handlers/autoApproveOwnRequest.ts`; still gated by the handler's `canApprove`). To turn it on for another type, give that handler `autoApprove: autoApproveOwnRequest` or its own rule.
- **Revoke:** `POST /inquiry/:id/revoke` (either party, or a manager of the target) sets `revoked`; a membership grant takes back the entitlements it added (`resolution.addedEntitlements`; ones the member already held stay), a JWT grant stops on its next request (the JWT step reads the live inquiry every time).
- Whatever is granted is still capped at request time by what the user's memberships reach.

---

## REBAC

Relationship-Based Access Control allows permissions to delegate through relationships.

Located in `packages/permissions/src/rebac/`.

### Schema

Defines how actions can delegate to other actions or related resources:

```typescript
// packages/permissions/src/rebac/schema.ts (excerpt; resources are keyed `db:<accessor>`)
export const rebacSchema: RebacSchema = {
  bridges: [],
  permissions: {
    'db:user': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        'organization.create': 'operate',
        // SessionAction keys have no rule: only a direct grant holds them
      },
    },
    'db:organization': {
      actions: { own: null, manage: 'own', operate: 'manage', read: 'operate', assign: { /* role-aware */ } },
    },
    'db:space': {
      actions: { own: { rel: 'organization', action: 'own' }, manage: 'own', operate: 'manage', read: 'operate' },
    },
    'db:inquiry': {
      actions: {
        read: { any: [/* source or target */] },
        send: { any: [/* one arm per type; grantUserEntitlements: self + sourceUser token.create, or manage on sourceIntegration */] },
        resolve: { any: [/* grantUserEntitlements also needs targetUser token.create */] },
        revoke: { all: [/* grantUserEntitlements */, { any: [{ self: 'sourceUserId' }, { self: 'targetUserId' }, { rel: 'sourceIntegration', action: 'manage' }] }] },
      },
    },
    // plus contact, webhookSubscription, segment, integration, flow (ownerActions),
    // organizationUser, spaceUser, token, authProvider
  },
};
```

### ActionRule Types

| Rule | Meaning | Example |
|------|---------|---------|
| `string` | Inherit action from same resource | `manage: 'own'` → check `own` on same resource |
| `{ rel, action }` | Delegate to related resource (supports dot-path) | `{ rel: 'organization', action: 'own' }` |
| `{ self: field, action }` | Current user owns the record **and** holds `action` on its own `db:user` entry | `{ self: 'userId', action: 'operate' }` → user.id === record.userId and the principal may `operate` as itself |
| `{ rule: Condition }` | JSON rule condition | `{ rule: { field: 'role', operator: 'in', value: ['owner'] } }` |
| `{ any: ActionRule[] }` | At least one must pass | `{ any: [{ self: 'userId', action: 'read' }, 'read'] }` |
| `{ all: ActionRule[] }` | All must pass | `{ all: [{ rule: ... }, 'own'] }` |
| `null` | Always false (terminal) | `own: null` |

**A self arm names an action.** `self` used to pass on identity alone, so a narrowed grant could still leave an org, delete a token or accept an invite. Now `{ self: 'userId', action: 'operate' }` also requires the principal to hold `operate` on `db:user:<its id>` (`createRebacCheck(resolveRelation, { selfResource: 'db:user' })` in `rebac/check.ts`). Full principals hold `own` on themselves, so nothing changes for them. Read arms use `read`; leave, resolve, send and token self-delete use `operate`; any user action, custom ones included, may be named. A bare `{ self }` throws.

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

The schema validates the recursive `ActionRule` envelope (delegations, `{ rel, action }`, `{ self }`, `{ rule }`, `{ any }`, `{ all }`) but passes the inner json-rules `Condition` through as `unknown` — runtime `check()` validates it when the rule fires.

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

Checks an action on the current user's own `db:user` entry. It is the rail for routes that load no resource (`/me/*`, `organizationCreate`) and for session actions:

```typescript
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';

middleware: [validateSelfPermission('read')]                          // meRead
middleware: [validateSelfPermission(SessionAction.createToken)]       // meCreateToken
middleware: [validateSelfPermission(SessionAction.deleteOrganization), validatePermission('own')] // organizationDelete
```

401 without a user, 403 when the user entry lacks the action. It replaces the old session-only guard: "a token can't do this" is now "this principal doesn't hold the action". A session holds every `SessionAction`; a token or grant holds one only when its entitlements name it; Organization, OrganizationUser, SpaceUser and Space tokens hold no user entry, so they never do. A superadmin passes, through any principal.

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

Tokens use the `leave` action for self-deletion and the `assign` action (via parent) for creation.

### Token Creation

Token creation needs `token.create` on the minter (`validateSelfPermission`), then the route's check on the owner:
- Organization and Space tokens: `assign` on the owner at `assignLevel(role, entitlements)` (owner/admin levels need `own`, others `manage`)
- OrganizationUser and SpaceUser tokens: `leave` on the membership, the role's standard action on the org or space, and `validateHeldActions` for the named entitlements
- User tokens (`/me/tokens`): `validateHeldGrant`, see [Issuing Is Capped by the Issuer](#issuing-is-capped-by-the-issuer)

`entitlements` and `entitlementsOnly` are accepted: `entitlements: null` mints a **full** token, a list mints a **narrowed** one.

```typescript
check(permix, rebacSchema, 'organization', { id: orgId, role: assignLevel(role, entitlements) }, 'assign');
```

### Token Editing

`PATCH /api/v1/token/:id` (`tokenUpdate`) changes `name`, `role`, `entitlements` and `entitlementsOnly`, so a token can move between full and narrowed. It needs `token.create` on the editor, and a token can never change itself. Then either:
- `assign` on the token at the new `assignLevel` (an org or space manager; organization, space and membership tokens), or
- `leave` on it (its own user), plus `validateHeldGrant` for the new grant.

### Token Deletion

The ReBAC schema allows users to delete their own tokens via `leave`:

```typescript
token: {
  actions: {
    leave: { self: 'userId', action: 'operate' },  // token.userId === user.id, and the principal may operate as itself
  },
},
```

Additionally, org/space admins can delete tokens within their scope via delegation:
- Org admins can delete OrgUser tokens (via `manage` on organization)
- Space admins can delete SpaceUser tokens (via `manage` on space)

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
