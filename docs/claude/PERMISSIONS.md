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
  - [The Actor](#the-actor)
  - [Grant Keys](#grant-keys)
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
  - [Principals](#principals)
  - [Widen vs. Narrow](#widen-vs-narrow)
  - [Issuing](#issuing)
  - [Granting User Entitlements](#granting-user-entitlements)
  - [Write-Time Binding](#write-time-binding)
- [REBAC](#rebac)
  - [Schema](#schema)
  - [ActionRule Types](#actionrule-types)
  - [How It Works](#how-it-works)
  - [Dot-path vs. Single-hop Delegation](#dot-path-vs-single-hop-delegation)
  - [Example: Space Permission Check](#example-space-permission-check)
- [Owner-Polymorphic Models](#owner-polymorphic-models)
  - [Member-Owned Models](#member-owned-models)
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
  createToken: 'token.create',          // every token/integration-token create and token edit route
  deleteToken: 'token.delete',          // tokenDelete
  redactUser: 'user.redact',            // meRedact
  rotateUserJwts: 'user.rotateJwts',    // meRotateJwts
  deleteOrganization: 'organization.delete', // organizationDelete (plus `own` on the org)
};

export const UserAction = { ...StandardAction, ...SessionAction, identify: 'user.identify', createOrganization: 'organization.create' };
export const InquiryAction = { read, send, resolve, revoke };
export const MembershipAction = { own: 'membership.own', manage: 'membership.manage', operate: 'membership.operate', read: 'membership.read' };

export type CustomAction = `${string}.${string}`; // e.g. 'artifact.create'
export type Action = UserAction | OrganizationAction | SpaceAction | InquiryAction | MembershipAction | CustomAction;
```

An action maps to a role through the rebac schema: `'organization.create': 'operate'` on `db:user` means every principal holding `operate` on itself holds it. A custom key is a real action only once the schema maps it (`'artifact.create': 'operate'` on `db:organization`); an unmapped key is held only by a principal whose entitlements grant it, so a session never holds it and a grant cannot be capped to it. Any action can also be granted directly through entitlements.

Three `db:user` actions also carry an **in-person** arm: `token.create`, `user.redact` and `organization.delete` are `{ all: [inPerson, 'own'] }` (`packages/permissions/src/rebac/schema.ts`), where `inPerson` is the json-rules predicate `{ actor: { field: 'model', operator: equals, value: 'User' } }` (`packages/permissions/src/actor.ts`). Only a session's actor has `model: 'User'`, so no token or JWT grant holds these even when its entitlements name them — `isInPersonAction(action)` (`packages/permissions/src/rebac/inPersonActions.ts`) reads the arm back out of the schema for `securityForRoute` ([Choosing Between validateUser and validateActor](./AUTH.md#choosing-between-validateuser-and-validateactor)). `token.delete` and `user.rotateJwts` are plain `'own'` delegations — any full-strength credential holds them, person or not.

Which routes check what:

| Routes | Action | On |
|---|---|---|
| `meRead`, every `meReadMany*` | `read` | the user |
| `meCreate*` (contact, flow, inquiry, integration, segment, webhookSubscription), `meReachSegment` | `operate` | the user |
| `meCreateToken`, `organizationCreateToken`, `spaceCreateToken`, `organizationUserCreateToken`, `spaceUserCreateToken`, `integrationCreateToken` | `token.create` | the user (plus the route's own check on the owner — `integrationCreateToken` also needs `manage` on the integration) |
| `tokenDelete` | `token.delete` | the user (plus `leave` / `assign` on the token) |
| `meRedact` | `user.redact` | the user |
| `meRotateJwts` | `user.rotateJwts` | the user |
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
  isSuperadmin: () => boolean;
  setActor: (actor: TemplateActor) => void;
  getActor: () => TemplateActor | null;
  setNarrowing: (narrowing: Entitlements) => void;
  getNarrowing: () => Entitlements;
  rules: (resource: string, action: string) => RuleEntry[];
  getJSON: () => Record<string, Record<string, boolean>> | null;
};
```

It is `@inixiative/permissions`' wrapper (`createPermissions<Action, TemplateActor>()`), typed with the template's actions and actor in `packages/permissions/src/client.ts`; the template keeps no copy of its own.

### The Actor

The actor is plain data about who is acting, set once per request beside the grants. `{ self, action }` reads its `id`, `{ actor: Condition }` is a json-rules predicate over it, and a `{ rule }` may compare the record against `{ bind: 'actor.<field>' }` ([ActionRule Types](#actionrule-types)). With nobody acting, `{ actor }` and actor-binding rules deny.

```typescript
// packages/permissions/src/actor.ts
export const ActorModel = { User: 'User', Token: 'Token', Integration: 'Integration', Grant: 'Grant' } as const;

type TemplateActor = {
  id: string;                                        // the acting row's own id
  model: 'User' | 'Token' | 'Integration' | 'Grant';  // the kind of credential carrying its authority
  integrationId: string | null;                       // the integration the credential is bound to
};
```

| Credential | `model` | `id` |
|---|---|---|
| Person JWT (self-issued or the configured issuer), spoofing included | `User` | the user |
| Any API token (User/Organization/Space/OrganizationUser/SpaceUser/Integration-owned) | `Token` | its user, or the token's own id when it has none |
| JWT with a `grant` claim, the grant not raised by an integration | `Grant` | the user |
| JWT with a `grant` claim, the grant raised by an integration's inquiry | `Integration` | the user |

`buildActor(id, model, integrationId)` builds it; `buildPermix`'s `actorOf` (`apps/api/src/lib/permissions/buildPermix.ts`) is its only server caller — it checks the token first (every token, Integration-owned included, is actor model `Token`), then a grant (model `Integration` only when the approved `grantUserEntitlements` inquiry's `sourceIntegrationId` is set, else `Grant`), else a plain session (`User`). The frontend store is the only client caller (a person, so the `/me` it already loads is enough). The audit layer reads the same actor: `auditActorMiddleware` takes `permix.getActor().integrationId` as the audit `integrationId`, so the bound integration is resolved in one place. Why: the audit middleware used to read the bound integration off the token and the JWT grant by itself; now the permission check needs it too, so it is read once, into the actor, and both consume it.

**Every actor carries every field.** A `{ rule }` binding a field the actor lacks throws, so new actor fields go on `TemplateActor` and into `buildActor` for every model. Row rules (`permissionRules`) may bind only the fields `buildActor` produces (`actorBindNames`); the schema refuses any other `actor.` bind. Fields stay flat: scalars, dates, lists of ids.

**In person.** `inPerson: ActorCheck = { actor: { field: 'model', operator: equals, value: 'User' } }` (`packages/permissions/src/actor.ts`) is the one actor predicate the schema uses today — only a session's actor has `model: 'User'`. `isInPersonAction(action)` (`packages/permissions/src/rebac/inPersonActions.ts`) walks a `db:user` action's rule looking for `inPerson` inside an `all` arm, so `securityForRoute` can publish those actions' routes as `userJwt`-only in OpenAPI without a second list to maintain ([Action Catalog](#the-action-catalog)).

### Grant Keys

An entitlement is keyed by resource, not stored as a flat `{ action: true }` bag: `Entitlements = Record<key, Record<action, true | ActionRule>> | null`. A key is `map:model` or `map:model:id` (`parseGrantKey`, `@inixiative/permissions`):

| Key shape | Reaches |
|---|---|
| `db:integration` | every integration the holder's role reaches |
| `db:integration:i7` | that one row |
| `db:integration:self` | the holder's own integration — resolved once, per request, by `resolveSelfKeys(entitlements, selfIds)` (`packages/permissions/src/holder.ts`), which rewrites every `:self` segment to the real id from a `SelfIds` map (`selfIdsOf`, `apps/api/src/lib/permissions/selfIdsOf.ts`): an integration's own `db:integration:self` is itself, a membership's `db:organization:self` is its organization |

`entitlementEntries(entitlements)` turns resolved keys into permix entries (`{ resource, id?, actions }`); a rule-valued action (not just `true`) is OR'd with the schema rule at the merge point ([How `check()` merges](#how-check-merges)), so an entitlement like `{ 'db:contact': { read: { rule: { field: 'type', operator: equals, value: 'phone' } } } }` widens reads to only the matching rows. A membership (`OrganizationUser.entitlements`, `SpaceUser.entitlements`) may still store the flat legacy shape, `{ action: true }`; `normalizeEntitlements(value, ownerKey)` treats it as shorthand for `{ [ownerKey]: { action: true } }` (`ownerKey` is the membership's own `db:organization:<id>` / `db:space:<id>` entry).

Whether a resolved key widens a holder or narrows it depends on who carries it — [Widen vs. Narrow](#widen-vs-narrow).

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

`setUserContext` (`apps/api/src/lib/context/setUserContext.ts`) sets the user, then runs `setupUserPermissions`, `setupOrgPermissions`, `setupSpacePermissions` and, for an integration-owned token, `setupIntegrationPermissions` (`apps/api/src/lib/permissions/`). Each writes one entry per resource: `db:user:<id>`, `db:organization:<id>`, `db:space:<id>`, `db:integration:<id>`. A principal carrying a `grant` (any token, or a JWT with a `grant` claim) caps the anchor's role with `lesserRole(anchor.role, grant.role)`; the grant's own `entitlements` apply once, afterward, as the permix [narrowing](#grant-keys) ([Who Gets Which Entries](#who-gets-which-entries)).

**One builder.** `buildPermix(principal)` (`apps/api/src/lib/permissions/buildPermix.ts`) builds the permix for an actor: it sets the [actor](#the-actor), the superadmin bypass, runs the matching setup step(s), then `permix.setNarrowing(resolveSelfKeys(grant.entitlements, selfIdsOf(principal)))` when there is a grant. A `PermissionPrincipal` is `{ user, token, grant }` (`apps/api/src/lib/permissions/permissionPrincipal.ts`): `user` carries its memberships (`UserWithRelations`); `grant` is `{ role, entitlements, integrationId }` — a token's own role/entitlements/`integrationId` whenever a token is present (any owner), else the live `entitlementGrant` a JWT's `grant` claim resolved (`findLiveEntitlementGrant`). Each setup step exists once, `setupUserPermissions` / `setupOrgPermissions` / `setupSpacePermissions` / `setupIntegrationPermissions(permix, …)`, called only by `buildPermix`. The middleware does `c.set('permix', await buildPermix(principalFromContext(c)))`. For an actor who isn't the requester (a stored issuer re-check, a job), use the user loader `setUserContext` already uses: `buildPermix({ user: await findUserWithRelations(userId), token: null, grant: null })`, then check the action. `buildPermix.test.ts` pins the direct call to the request path.

### Who Gets Which Entries

| Principal | `db:user:<self>` | `db:organization:*` | `db:space:*` | `db:integration:self` |
|---|---|---|---|---|
| Session, or JWT with no grant | `own` + every `SessionAction` | each membership's role + entitlements | each membership's role + entitlements | — |
| User token, or JWT with a grant | `own` capped by `lesserRole('owner', grant.role)` | each membership's role capped by the grant, + entitlements | each membership's role capped by the grant, + entitlements | — |
| OrganizationUser token | `user.identify` only | its organization only, role capped by the grant | none | — |
| SpaceUser token | `user.identify` only | none | its space only, role capped by the grant | — |
| Organization token | none (no user) | its organization: token role + entitlements | none | — |
| Space token | none (no user) | none | its space: token role + entitlements | — |
| Integration token (`Token.ownerModel = 'Integration'`) | the owner's `db:user:<id>` entry, capped by the grant, only when the integration's `ownerModel` is `User` | its owner's `db:organization:<id>` entry when Organization-owned ([Member-Owned Models](#member-owned-models)) | its owner's `db:space:<id>` entry when Space-owned | its own role on itself: `operate` (or `read` at `viewer`), capped by the grant, + the integration's own entitlements |

A superadmin is superadmin through every principal (JWT, token), spoofing included: `setUserContext` sets the bypass from the user's platform role.

**A membership token manages its membership's own things.** An OrganizationUser or SpaceUser token also gets a `db:organizationUser:<id>` / `db:spaceUser:<id>` entry on its own membership row: its role's `membership.*` action (`getMembershipPermissions`, `packages/permissions/src/roles/membership.ts`). `membershipOwnerActions` (below) reads it, so the token reaches the integrations its membership owns and nothing else of the user's. The `membership.*` chain (`read → operate → manage → own`) has no fallback to the organization or space, and the token gains nothing on the membership row's own `read`/`manage`/`own` or on `assign`.

**The integration principal.** `setupIntegrationPermissions` (`apps/api/src/lib/permissions/setupIntegrationPermissions.ts`) runs instead of the user/org/space steps when the token's owner is an Integration: it looks up the owner entry by `integration.ownerModel` (`getUserPermissions` / `getOrgPermissions` / `getSpacePermissions` / `getMembershipPermissions`, each at the capped role), then sets `db:integration:<its id>` to `{ operate: true }` (`{ read: true }` at `viewer`), and finally the integration's own `entitlements`, normalized and self-resolved against `integrationSelfIds(integration)` (`apps/api/src/lib/permissions/selfIdsOf.ts`). A token minted on behalf of an integration (`POST /integration/:id/tokens`) narrows this same setup, same as any other token.

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

Custom grants beyond the role, keyed by [grant key](#grant-keys) and stored as JSON on OrganizationUser, SpaceUser, Token and Integration, or carried by a JWT grant's `resolution.grant`.

```typescript
// @inixiative/permissions
type Entitlements = Record<string, Record<string, true | ActionRule>> | null;

{
  'db:organization:self': { 'billing.view': true },
  'db:contact': { read: { rule: { field: 'type', operator: 'equals', value: 'phone' } } },
}
```

`entitlementsSchema` (`packages/permissions/src/entitlementsSchema.ts`) validates the shape at every write boundary (token create/update, integration create, `grantUserEntitlements` content and resolution): each key matches `map:model` or `map:model:id`, each action is `true` or an `ActionRule`.

### How Entitlements Are Applied

**Widening holders** (a membership, an integration) get their entitlements added to the permix as entries — `entitlementEntries(resolveSelfKeys(normalizeEntitlements(value, ownerKey), selfIds))` — in every setup function ([Who Gets Which Entries](#who-gets-which-entries)): a viewer membership with `{ 'db:organization:self': { manage: true } }` manages its own organization. That is how an organization grants one person more than their role. A membership may still store the flat legacy shape, `{ action: true }`; `normalizeEntitlements` treats it as shorthand for that one key on the membership's own organization/space entry.

**Narrowing holders** (a token, a JWT grant) never add past what their anchor already reaches — their entitlements become the permix's [narrowing](#grant-keys) instead of new entries: see [Grants](#grants).

---

## Grants

A grant is `{ role, entitlements, integrationId }` (`CredentialGrant`, `apps/api/src/lib/context/types.ts`) — what a token or a JWT's `grant` claim carries, built by `principalFromContext` (`apps/api/src/lib/permissions/permissionPrincipal.ts`): straight off the row for any token; for a JWT with a `grant` claim, from the live, approved `grantUserEntitlements` inquiry's `resolution.grant` (`findLiveEntitlementGrant`, read on every request, so a revoke locks the JWT out at once).

### Principals

| Credential | Acts as | Its entitlements |
|---|---|---|
| Session, or issuer JWT with no grant | the user | — (the full login grant) |
| User token | the user, narrowed | the token's (narrow) |
| OrganizationUser / SpaceUser token | that membership, narrowed (+ `user.identify`) | the token's (narrow) |
| Organization / Space token | the organization / space, narrowed | the token's (narrow) |
| Integration token | the integration: its role on its owner, `operate` on itself (`read` when its role is `viewer`) | the integration's own (widen) + the token's (narrow) |
| JWT with a `grant` claim | the user, narrowed | `resolution.grant.entitlements` (narrow) — the integration that raised the grant, if any, contributes none of its own (`holders.test.ts` #18) |

### Widen vs. Narrow

Acting as the principal, entitlements widen ([Grant Keys](#grant-keys)). Narrowing a principal, they narrow: `permix.setNarrowing(entitlements)` fences every resource the check walks through, and the credential's role caps every anchor with `lesserRole(anchor.role, credential.role)`.

**No mint-time comparison.** A token or grant can never widen past its holder no matter what it asks for, because the fence only lets through what the holder reaches at check time — so minting does not need to compare the request against the issuer. `holders.test.ts` #20: a viewer mints a token asking `own` on an organization it doesn't own; the token stores it, but every check against that organization still denies.

### Issuing

Minting is **in person**: `token.create` carries the [in-person arm](#the-actor), so only a session — never a token, never a JWT grant — mints or edits a token, mints an integration, or sends/approves a `grantUserEntitlements` handshake. Each owner then has its own authority check at mint time:

- **User tokens** (`POST /me/tokens`): `token.create` on the session is enough; the token can only ever narrow its own holder.
- **Organization / Space tokens**: `canAssign(permix, owner, owner, role, entitlements)` ([Role Assignment](#role-assignment)).
- **OrganizationUser / SpaceUser tokens**: `leave` on the membership, plus the role's standard action on the organization/space.
- **Integration tokens** (`POST /integration/:id/tokens`): `manage` on the integration, in addition to `token.create` — mints a token that narrows that integration (`holders.test.ts` #25).

`PATCH /token/:id` is the same `canAssign` / `leave` choice (`tokenUpdate.ts`), and a token can never edit itself.

### Granting User Entitlements

An Inquiry of type `grantUserEntitlements` (handler: `apps/api/src/modules/inquiry/handlers/grantUserEntitlements`). **The requester does not need to hold what it asks for; the approver must have authority to assign it.** Three shapes, by target:

| Target | Who asks | Who approves | Approval writes |
|---|---|---|---|
| `Organization` | a member (`POST /me/inquiries`) | someone who can assign it there (`canAssign`: an admin for member-level keys it holds, the owner for `own`/`manage`) | the entitlements onto the requester's `OrganizationUser` |
| `Space` | a space member | `assign` on the space at that level | onto the requester's `SpaceUser` |
| `User` | the user (handshake, auto-approved) or an integration (`POST /integration/:id/inquiries`, needs `manage` on it) | the user, holding `token.create` | `resolution.grant`: `{ role, entitlements }`, bound to real ids ([Write-Time Binding](#write-time-binding)) |

```typescript
{ type: 'grantUserEntitlements', targetModel: 'User', targetUserId, status: 'sent',
  content: { purpose: 'read my phone contacts', role: 'viewer',
    entitlements: { 'db:contact': { read: { rule: { field: 'type', operator: 'equals', value: 'phone' } } } } } }
```

A grant to a `User` keys its `content.entitlements` by resource, never the flat shape (`isFlatEntitlements` is refused); `null` asks for everything the target reaches, `{}` is refused (name at least one key, or send `null`). A membership target (`Organization`/`Space`) keeps the flat `{ action: true }` shape and is checked with `canAssign`, not write-time binding.

- **Auto-approval** is on only for the handshake — the user asking for their own grant (`autoApproveOwnRequest`, `apps/api/src/modules/inquiry/handlers/autoApproveOwnRequest.ts`; still gated by `canApprove`, which for a `User` target requires `token.create`).
- **Tightening.** The approver may resolve with its own `{ entitlements }`: `validateEntitlementsWithin(resolution, asked)` only lets it drop keys/actions the request named, never add or change one (422 otherwise); dropping everything to `{}` is refused the same as the original ask.
- **Revoke:** `POST /inquiry/:id/revoke` (either party, or a manager of the target) sets `revoked`; a membership grant takes back the entitlements it added (`resolution.addedEntitlements`; ones the member already held stay); a JWT grant stops on its next request (`findLiveEntitlementGrant` reads the live inquiry every time).
- Whatever is granted to a `User` target is still capped at request time by what the user's memberships reach, through the normal narrowing fence.

### Write-Time Binding

An entitlement never carries a literal id. A key's id segment is a placeholder — `$source` / `$target` (an inquiry's own source/target row) or `self` (an integration's own id at creation) — and a rule's `value` on an `id`/`*Id` field is `{ bind: '<root>.<path>' }` with roots `source`, `target`, `content` (inquiries, `bindRoots` in `grantUserEntitlements/index.ts`) or `self` (an integration's draft row, `bindIntegrationEntitlements.ts`). `bindEntitlements(entitlements, roots)` (`apps/api/src/lib/permissions/bindEntitlements.ts`) resolves every placeholder and bind against the live rows and writes the literal result into `resolution.grant` / `Integration.entitlements`; a literal id anywhere else, or a bind naming an unknown root, is a 422 (`holders.test.ts` #26–28).

```typescript
// asked
{ 'db:integration:$source': { manage: true }, 'db:user:$target': { read: true } }
// stored in resolution.grant, after bindEntitlements
{ [`db:integration:${sourceIntegration.id}`]: { manage: true }, [`db:user:${target.id}`]: { read: true } }
```

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
        'user.identify': 'read',
        'organization.create': 'operate',
        'token.delete': 'own',
        'user.rotateJwts': 'own',
        'token.create': { all: [inPerson, 'own'] },
        'user.redact': { all: [inPerson, 'own'] },
        'organization.delete': { all: [inPerson, 'own'] },
      },
    },
    'db:organization': {
      actions: { own: null, manage: 'own', operate: 'manage', read: 'operate', assign: { /* role-aware */ } },
    },
    'db:space': {
      actions: { own: { rel: 'organization', action: 'own' }, manage: 'own', operate: 'manage', read: 'operate' },
    },
    'db:integration': { actions: membershipOwnerActions() },
    'db:inquiry': {
      actions: {
        read: { any: [/* source or target */] },
        send: { any: [/* one arm per type; grantUserEntitlements: self + sourceUser operate, or manage on sourceIntegration */] },
        resolve: { any: [/* grantUserEntitlements also needs targetUser token.create */] },
        revoke: { all: [/* grantUserEntitlements */, { any: [{ self: 'sourceUserId', action: 'operate' }, { self: 'targetUserId', action: 'operate' }, { rel: 'sourceIntegration', action: 'operate' }, { rel: 'targetOrganization', action: 'manage' }, { rel: 'targetSpace', action: 'manage' }] }] },
      },
    },
    // plus contact, webhookSubscription, segment, segmentMember, flow (ownerActions),
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
| `{ rule: Condition }` | JSON rule condition over the record; `{ bind: 'actor.<field>' }` compares it against the actor | `{ rule: { field: 'valueKey', operator: 'notEquals', path: 'user.email' } }` |
| `{ actor: Condition }` | JSON rule condition over the [actor](#the-actor) | `inPerson = { actor: { field: 'model', operator: 'equals', value: 'User' } }` |
| `{ any: ActionRule[] }` | At least one must pass | `{ any: [{ self: 'userId', action: 'read' }, 'read'] }` |
| `{ all: ActionRule[] }` | All must pass | `{ all: [{ rule: ... }, 'own'] }` |
| `null` / `false` | Always false (terminal) | `own: null` |
| `true` | Always true (terminal) | `read: true` |

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

### Member-Owned Models

A model a membership can own (OrganizationUser or SpaceUser: `userId` and `organizationId` both set; Integration today) uses `membershipOwnerActions()` instead. A member's row is reached by the member (`rel: 'user'`), by an **owner** of the organization or space, or by a token of that membership (`membership.<action>` on its own OrganizationUser/SpaceUser row), never by an org or space admin. Rows with no `userId` (Organization- or Space-owned) take the normal organization/space chain. `db:integration` is `membershipOwnerActions()` directly (`packages/permissions/src/rebac/schema.ts`) — there is no extra fence; an integration's own reach is just the [grant keys](#grant-keys) its `entitlements` name. Why: owners are not admins (Aron, 2026-10-18). An admin is the average manager; an owner is the org's IT person, so work content stays private from managers but is never locked away from the org that owns it.

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

The value schema is `@inixiative/permissions`' own `actionRuleSchema` (named `ActionRule` for OpenAPI): every arm the engine evaluates, `{ self, action }` and `{ actor }` included, with each `rule` / `actor` condition checked by json-rules' `validateRule`. A row rule may use the actor too; it still only widens that row's access.

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

401 without a user, 403 when the user entry lacks the action. It replaces the old session-only guard: "a token can't do this" is now "this principal doesn't hold the action". A person's JWT with no grant holds every `SessionAction`; a token or grant holds one only when its entitlements name it and the action's schema rule doesn't refuse it first; Organization, OrganizationUser, SpaceUser and Space tokens hold no user entry, so they never do. `token.create`, `user.redact` and `organization.delete` carry the [in-person arm](#the-actor) (`{ all: [inPerson, 'own'] }`): no token or JWT grant holds them even when it names them, because only a session's actor is `model: 'User'`, and their operations publish only `userJwt` in OpenAPI (`securityForRoute` reads `isInPersonAction` off the action passed to `validateSelfPermission`). A superadmin still passes on any credential (Aron, 2026-10-18: "put the same user check that we have in place on that one… we can revisit if things need to be more agentic"; 2026-10-19: "super admin is super admin").

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

Every token route needs `token.create` on the minter (`validateSelfPermission`), in person ([Issuing](#issuing)), then the route's own check on the owner:
- Organization and Space tokens: `canAssign` on the owner (the `assign` rule at `assignLevel(role, entitlements)`, and the minter holds the level and every named action)
- OrganizationUser and SpaceUser tokens: `leave` on the membership, plus the role's standard action on the organization/space (`roleToStandardAction`)
- Integration tokens (`POST /integration/:id/tokens`): `manage` on the integration (`validatePermission('manage')`)
- User tokens (`/me/tokens`): no further check — `token.create` is enough, since the token can only ever narrow its own holder

`entitlements` is accepted on every create/update body: `null` means not narrowed anywhere, a keyed object narrows. There is no mint-time comparison against the issuer ([Widen vs. Narrow](#widen-vs-narrow)) — whatever the request asks for is stored, and the fence decides what it can actually reach at check time.

```typescript
canAssign(permix, owner, owner, role, entitlements); // owner = { model: 'organization', record: { id: orgId } }
```

### Token Editing

`PATCH /api/v1/token/:id` (`tokenUpdate`) changes `name`, `role` and `entitlements`, so a token can move between full and narrowed. It needs `token.create` on the editor, and a token can never change itself. Then either:
- `assign` on the token at the new `assignLevel` (an org or space manager; organization, space and membership tokens), or
- `leave` on it (its own user) — no further grant check, for the same reason minting needs none.

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

The frontend runs the same ReBAC engine. `permissions.setup(me)` (`packages/ui/src/store/slices/permissions.ts`) sets the person's actor (`buildActor(me.id, 'User', null)`, the same builder the API uses) and loads the user's own, organization and space permissions from `/me`, mirroring the backend setup. A superadmin gets `permix.setSuperadmin(true)` and every check passes.

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
