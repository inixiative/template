# Permissions

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Roles](#roles)
  - [PlatformRole](#platformrole)
  - [Role](#role)
  - [Role Hierarchy](#role-hierarchy)
- [Actions](#actions)
  - [Actions on Their Own Models](#actions-on-their-own-models)
  - [The Actor](#the-actor)
  - [Role → Action Mapping](#role--action-mapping)
  - [roleToStandardAction](#roletostandardaction)
- [Permix](#permix)
  - [API](#api)
  - [How It Works](#how-it-works)
  - [Superadmin Bypass](#superadmin-bypass)
- [Permission Setup](#permission-setup)
  - [installPermissions](#installpermissions)
  - [Vocabulary](#vocabulary)
  - [Delegates and Their Owners](#delegates-and-their-owners)
  - [A Token Never Exceeds Its Owner](#a-token-never-exceeds-its-owner)
  - [Integrations Are Delegates](#integrations-are-delegates)
  - [Granting an Entitlement](#granting-an-entitlement)
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
  - [validateSubmodelPermission](#validatesubmodelpermission)
  - [The user as a resource](#the-user-as-a-resource)
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
| Entitlements | Grants beyond a role | JSON on members and delegates | `{ resource, anchor, actions }` on members and delegates |

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
- Pass every `check` (`permix.setSuperadmin(true)`)
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
- `narrowing(...)` - a token's role claims every action at or below it ([A Token Never Exceeds Its Owner](#a-token-never-exceeds-its-owner))

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

### Actions on Their Own Models

Every action lives on the model it acts on; a dotted action is named after its model (`packages/permissions/src/rebac/principals.test.ts`):

```typescript
// packages/permissions/src/client.ts
export const OrganizationAction = { ...StandardAction, create: 'create', delete: 'delete' };
export const UserAction = { ...StandardAction, redactUser: 'user.redact', rotateUserJwts: 'user.rotateJwts' };
export const TokenAction = { create: 'create', delete: 'delete' };
```

Creating checks `create` on a pseudo record of the model being created (token create in `createToken`, organization create in `organizationCreate`). User-only acts are rules on the actor: `actorIsUser` (`__actor.model == User`) and `actorIsDelegateOfUser` (`__actor.record.ownerModel == User`).

Creating an organization is `create` on a pseudo organization: the actor is a user or a token its user owns. Minting and deleting tokens, redacting and rotating JWTs, and deleting an organization are user-only rules on the record each acts on, so a token holding `own` still cannot do them. A superadmin passes on any credential.

### The Actor

The table says what a principal holds. The actor says only who is acting: `permix.setActor(actorOf(model, record))` (`packages/permissions/src/actorOf.ts`) gives `{ model, record }`, with `model` `User` for a user and `Token` for any API token, and `record` the row's columns (`pickColumns`) with its redacted fields left out. Acting on your own row is `{ rel: 'user', action }`, a walk to your own user entry. Rules read the actor as `__actor` in a json-rules condition (`actorIsUser`, `actorIsDelegateOfUser`). With nobody acting, an actor rule denies and the table still answers everything else.

### Role → Action Mapping

Each role grants the one action it names; the schema's `read → operate → manage → own` chain gives it every action below.

```typescript
// packages/permissions/src/roles/organization.ts
export const organizationRoles = {
  owner: { organization: { own: true } },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true } },
  viewer: { organization: { read: true } },
} as const;
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

The engine is `@inixiative/permissions`; `createPermissions` in `packages/permissions/src/client.ts` types it with the app's actions and actor.

- `permix.setup(entries, { replace?, owner? })` installs entries: a grant `{ resource, id?, actions }` or an entitlement `{ resource, anchor, where?, actions }`. Entries installed with an `owner` permix hold an action only while that owner still allows it on the record.
- `permix.setActor(actor)` / `permix.getActor()` set and read who is acting ([The Actor](#the-actor)).
- `permix.setSuperadmin(value)` turns on the bypass.

### How It Works

`prepareRequest` creates the empty permix, `installPermissions` fills it ([Permission Setup](#permission-setup)), and a check is always `check(permix, rebacSchema, model, record, action)` from `@template/permissions/rebac` on a hydrated record.

### Superadmin Bypass

`permix.setSuperadmin(true)` makes every check pass. `installPermissions` sets it from `isSuperadmin(me(c))`.

---

## Permission Setup

### installPermissions

`installPermissions(c)` (`apps/api/src/lib/context/installPermissions.ts`) resets the permix, sets the actor and the superadmin bypass, then installs one table:

- a user (JWT or spoof): `setupUserPermissions` (`apps/api/src/lib/permissions/setupUserPermissions.ts`) installs `userEntries`: the user grant plus one grant per `OrganizationUser` and `SpaceUser` row.
- a token: `setupTokenPermissions` (`apps/api/src/lib/permissions/setupTokenPermissions.ts`) installs `delegateTable(token, owner)` ([Delegates and Their Owners](#delegates-and-their-owners)), where `owner` is the user's table built from the members already in context for a User-owned token (`contextUserEntries`, shared with `setupUserPermissions`), and `ownerTable(token)` otherwise.

### Vocabulary

One word per party, used in code and prose alike:

| Word | Means |
|---|---|
| **user** | the `User` row |
| **tenant** | a user, organization or space: what things belong to |
| **member** | what connects a user to an organization or space (`OrganizationUser`, `SpaceUser`) |
| **JWT** / **token** | how a request authenticates |
| **actor** | who is acting this request: `{ model: 'User' \| 'Token', record }` |
| **owner** | the row a token or integration belongs to (its `ownerModel`); a chain is owners all the way down |
| **delegate** | a token or an integration |
| **permissions** | a delegate's `{ role, full, entitlements }` |
| **anchor** | where an entitlement acts from |
| **entitlement** | `{ resource, anchor, where?, actions }` |
| **me** | the user when the actor is a user, or a User token's user (`me(c)`) |

### Delegates and Their Owners

A delegate holds its permissions, capped live by its owner. `installPermissions` installs a user's own table (`setupUserPermissions`: the user grant plus one grant per member row) or, for a token, the token's permissions (`setupTokenPermissions`). `ownerTable` (`apps/api/src/lib/permissions/ownerTable.ts`) builds the owner's table from the owner model:

| Owner model | Owner table |
|---|---|
| `User` | the user: the user grant and every member row |
| `OrganizationUser` / `SpaceUser` | that one member row |
| `Organization` / `Space` | `owner` on itself |
| `Integration` | the integration's permissions, capped by its own owner's table |

A role and named entitlements expand through `delegateEntries` (`packages/permissions/src/roles/delegatePermissions.ts`):

- `role` applies at every anchor the owner has (`narrowing(resource, id, role)` per anchor), so a User token's role reaches each of the user's organizations, capped by the member row there; an integration's role reaches whatever its owner reaches.
- `entitlements` are entries `{ resource, anchor, actions }`, held as written. "Only the user's own things" is no role plus one entry anchored on `db:user`.
- `full` is inheritance, not a permission: a `full` delegate skips to its owner — `delegateTable` (`apps/api/src/lib/permissions/ownerTable.ts`) installs the owner's table unchanged, for tokens and for integration owners. The schema never reads `full` (CI rule `no-full-in-rebac-schema`). Setting `full` takes `own` on the delegate's owner. A token that is not `full` has a role, entitlements or both; `full` takes neither. `full` may be set on tokens owned by a User, OrganizationUser, SpaceUser or Integration, and on integrations owned by a User, OrganizationUser or SpaceUser (`delegatePermissionRules.ts`).

Nothing is inherited: a token holds only its own permissions. They are installed with the owner's table as owner, so at check time each action holds only if the owner still allows it on that record through the normal walk. Demote the member and its tokens lose it on the next request.

### A Token Never Exceeds Its Owner

So a viewer member's token naming `manage` on the organization reads it and does not manage it, an admin's owner-role token manages and does not own, and a space is reached exactly as far as the member reaches its organization. Situations: `apps/api/src/lib/permissions/tokenNeverExceedsOwner.test.ts`, `delegatePermissions.test.ts`.

### Integrations Are Delegates

An integration has a nullable `role`, `full` and `entitlements`, capped live by its owner (a user, a member, an organization or a space), and can own tokens. An integration's token (`ownerModel: Integration`) carries `integrationId` as its owner key plus its integration's own owner keys, copied at create by the `falsePolymorphism:delegatedKeys` hook: the keys are tenancy, for scans, list routes, revocation and rate-limit buckets. An integration acts only through its token. Situations: `integrationDelegate.test.ts` and `packages/permissions/src/rebac/delegation.test.ts`.

### Granting an Entitlement

A grant is an action: the writer must be able to take every action the delegate would hold, from its anchor. `canGrantEntitlement(permix, entry, anchor)` (`packages/permissions/src/rebac/canGrantEntitlement.ts`, over the library's `createCanGrantEntitlement`) judges each action through the ordinary check on a pseudo record of the entry's resource placed under the hydrated anchor. The entitled delegate's read runs the action through the writer's walk on the real record, so the rule's conditions (on the record and on `__actor`) hold there.

- `PATCH /organizationUser/:id` with `entitlements` checks each action as an entry anchored on the organization: an admin grants `operate` and `manage`, not `own` or `assign`.
- A delegate's named entitlements go through `validateEntitlementGrants` (`apps/api/src/lib/permissions/validateEntitlementGrants.ts`: fetch the anchor, then `canGrantEntitlement`). A token's role is checked by `create` on `db:token`; an integration's role by `assign` on `db:integration` (`validateIntegrationGrant`), on the row before and after a change.

Situations: `organizationUserUpdate.test.ts`, `integrationDelegate.test.ts`, `delegatePermissions.test.ts`.

---

## Permission Checks

### In Controllers

A check that depends on the body runs in the controller or its service with the same `check`, on a hydrated record, or on a pseudo record (`ownerColumns`) when the row does not exist yet. `validateFullGrant` (`apps/api/src/lib/permissions/validateFullGrant.ts`):

```typescript
import { check, rebacSchema } from '@template/permissions/rebac';

if (
  !check(writer, rebacSchema, model, delegate, {
    rel: toAccessor(delegate.ownerModel as string),
    action: 'own',
  })
)
  throw makeError({ status: 403, message: 'Access denied' });
```

### Via Validation Middleware

There is no "is there a user" gate: every route names its action, and the action's rule decides who may take it. Only a JWT or a spoof makes the request a user (`c.get('user')`); a token is a Token actor `{ model, record }` and acts within its permissions. `/me` routes act on the user as their resource ([The user as a resource](#the-user-as-a-resource)).

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

Grants beyond a role, stored as library entries `{ resource, anchor, actions }` (`entitlementEntriesSchema`). Delegates (tokens, integrations) install theirs with their owner's table as owner ([Delegates and Their Owners](#delegates-and-their-owners)). Member rows (`OrganizationUser`, `SpaceUser`) install theirs with their tenant as owner: the organization's or the space's owner table. A flat action map is refused (422).

### How Entitlements Are Applied

`userGrants` (`packages/permissions/src/roles/userGrants.ts`, shared by the API and the UI) returns the grants to install: one with the user's and every member row's role entries, and one per member row with entitlements, owned by its tenant. `installGrants` sets each up with its owner. An entitlement holds on a record under its anchor only while the tenant's owner table still allows the action there, so a grant never reaches outside its organization or space. The role is not a ceiling on the member itself, which is why writing an entitlement is checked ([Granting an Entitlement](#granting-an-entitlement)): `validateEntitlementGrants` asks `canGrantEntitlement` whether the writer could take each action from the anchor.

---

## REBAC

Relationship-Based Access Control allows permissions to delegate through relationships.

Located in `packages/permissions/src/rebac/`.

### Schema

The schema is `rebacSchema` in `packages/permissions/src/rebac/schema.ts`; read the rules there. It is keyed by resource (`db:user`, `db:organization`, `db:token`, ...), each with its `actions`. Rules shared across models are named helpers at the top of the file: `actionOnOwner` (the action on whichever owner `ownerModel` names), `actorIsItsUser`, `assignRole` (high roles need one rule, member and viewer another), `roleHeldAtOwner` (the delegate's role held at its owner), and the integration blocks `integrationAdministering` (`create`, `own`, `manage`) and `integrationAccess` (`operate`, `read`, `assign`). `db:token` has `leave`, `own`, `read`, `create` and `delete`.

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
// packages/permissions/src/rebac/schemaHelpers.ts
import { ownerActions } from '@template/permissions/rebac/schemaHelpers';

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

Inside the library's rebac check (`createRebacCheck` in `@inixiative/permissions`, bound by `packages/permissions/src/rebac/check.ts`), when resolving an action by name:

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

### validateSubmodelPermission

A route on a submodel (a collection or a create under an owner: `/organization/:id/contacts`, `/me/integrations`) checks its action on a pseudo record of the **submodel**, placed under the loaded owner, so the rule lives with the child model and entitlements on the child apply:

```typescript
// apps/api/src/middleware/validations/validateSubmodelPermission.ts
const pseudo = await hydrate(submodel, ownerColumns(submodel, ownerType, owner));
check(permix, rebacSchema, submodel, pseudo, action);
```

- `ownerColumns(child, ownerAccessor, owner)` (`packages/db/src/registries/ownerColumns.ts`) builds the pseudo record: `id: ''`, the polymorphism registry's discriminator for that owner, and the owner keys from the child's single relation to it. An empty id never matches a grant keyed by a real row.
- The route templates set `routeConfig` (with `model` / `submodel`) before route middleware runs, so the middleware reads the submodel there; the owner is `c.get('resource')` (`meResourceMiddleware` loads the user on `/me`).
- It never reads the request body (route middleware runs before validation). Checks that depend on the body (a token's role / full, an integration's `assign`, an inquiry's `send`) stay in their services.
- Using it on a route with no submodel throws on each request to that route, not when the route is built (`validateSubmodelPermission.test.ts`).

```typescript
middleware: [validateSubmodelPermission('create')]   // organizationCreateContact, meCreateIntegration, ...
middleware: [validateSubmodelPermission('read')]     // organizationReadManyContacts, spaceReadManyTokens, ...
```

Routes that still check an action on the owner (`validatePermission` on spaces, members, inquiries, customer refs, segments) are not migrated yet.

### The user as a resource

`/me/*` routes check their action like any other route; `meResourceMiddleware` loads `me(c)` as the resource, typed `user`. The route templates add it first on routes whose model is `me` (`prepareMiddleware`), like `resourceContextMiddleware` on routes with an id. `me(c)` is the request's user (a JWT session or a spoof), or the user of a User-owned token; anything else has no me and gets 401.

```typescript
[meResourceMiddleware, ...routeMiddleware]                                // routes whose model is me
middleware: [validateSubmodelPermission('read')]                          // meReadManyContacts, -Integrations, -WebhookSubscriptions, -Tokens
middleware: [validateSubmodelPermission('create')]                        // meCreateContact, -Flow, -Integration, -WebhookSubscription
middleware: [validatePermission('read')]                                  // the other meReadMany*
middleware: [validatePermission('operate')]                               // meCreateInquiry, meCreateSegment, meReachSegment
```

User-only is `actorIsUser` in the rule of the record each action is on: `create` and `delete` on the token (create on a pseudo record of the token), `delete` on the organization, `user.redact` and `user.rotateJwts` on the user. A superadmin passes on any credential. Situations: `apps/api/src/middleware/validations/userOnlyActions.test.ts`, `apps/api/src/lib/context/userActsDirectly.test.ts`.

---

## Role Assignment

Role assignment uses the `assign` action defined in the ReBAC schema. The schema checks:
- Assigning owner/admin (high roles) requires `own` permission
- Assigning member/viewer requires `manage` permission

```typescript
const before = await hydrate('organizationUser', organizationUser);
const after = await hydrate('organizationUser', { ...organizationUser, role: body.role ?? organizationUser.role });
check(permix, rebacSchema, 'organizationUser', before, 'assign') &&
  check(permix, rebacSchema, 'organizationUser', after, 'assign');
```

`assign` lives on the member row (`db:organizationUser`, `db:spaceUser`) and is checked twice: on the row as it is and on the row as it will be. Its lower arm reads the role positively (`member` or `viewer`), so a record with no role passes neither arm. Removing a member is `assign` on the row as it is, or `leave`. A stored `assign` on the organization or space assigns any role (until member entitlements stop being stored flat).

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

Every create-token route calls `createToken`, which checks `create` on a pseudo record of the token: the actor is a user (`actorIsUser`), holds the role at the token's direct owner (for an integration-owned token, at the integration's owner — its access, never its administering), and the owner is theirs (`userId == __actor.record.id`) or an organization or space they are on. Setting `full` takes `own` on the token's direct owner (`validateFullGrant`). Named entitlements go through `validateEntitlementGrants`. The permissions' shape is a write rule in `RulesRegistry` (`apps/api/src/hooks/rules/delegatePermissionRules.ts`).

### Token Deletion

`delete` on `db:token` is user-only (`actorIsUser`) and passes on `leave` or on `manage` at the token's owner (at the integration's owner for an integration-owned token). The user deletes their own tokens and their integrations' tokens (`leave`, through the copied `userId`); organization and space admins delete tokens owned in their scope.

---

## Frontend Checks

The frontend runs the same ReBAC engine. `permissions.setup(me)` (`packages/ui/src/store/slices/permissions.ts`) loads the user's own, organization and space permissions from `/me`, mirroring the backend setup. A superadmin gets `permix.setSuperadmin(true)` and every check passes.

| Layer | Entry point |
|-------|-------------|
| Route | `validatePermission`, naming the action ([Validation Middleware](#validation-middleware)) |
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
