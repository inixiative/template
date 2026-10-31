# Permissions

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [The Model](#the-model)
  - [Vocabulary](#vocabulary)
  - [Tenants and Members](#tenants-and-members)
  - [Delegates](#delegates)
- [Roles](#roles)
  - [PlatformRole](#platformrole)
  - [Role](#role)
  - [Role Hierarchy](#role-hierarchy)
- [Actions](#actions)
  - [Every Action Is an Action on the Record](#every-action-is-an-action-on-the-record)
  - [The Standard Chain](#the-standard-chain)
  - [Actions on Their Own Models](#actions-on-their-own-models)
  - [Person-Only Actions](#person-only-actions)
  - [The Actor](#the-actor)
- [Member Rows](#member-rows)
  - [The Member Self-Grant](#the-member-self-grant)
  - [Role Assignment](#role-assignment)
- [Integrations and Tokens by Owner Kind](#integrations-and-tokens-by-owner-kind)
  - [Integrations](#integrations)
  - [Creating an Integration](#creating-an-integration)
  - [Tokens](#tokens)
  - [Minting a Token](#minting-a-token)
- [Full and delegateFull](#full-and-delegatefull)
  - [What Full Is](#what-full-is)
  - [Who May Set It](#who-may-set-it)
  - [The Backstop Rules](#the-backstop-rules)
- [Resolution at Read Time](#resolution-at-read-time)
  - [installPermissions](#installpermissions)
  - [userGrants](#usergrants)
  - [ownerTable](#ownertable)
  - [delegateTable](#delegatetable)
  - [A Token on a Member Row](#a-token-on-a-member-row)
  - [Worked Example: I1](#worked-example-i1)
  - [A Token Never Exceeds Its Owner](#a-token-never-exceeds-its-owner)
- [Writing Delegates](#writing-delegates)
  - [Integrations Are Delegates](#integrations-are-delegates)
  - [An Integration's Role](#an-integrations-role)
  - [Granting an Entitlement](#granting-an-entitlement)
- [Entitlements](#entitlements)
  - [How Entitlements Are Applied](#how-entitlements-are-applied)
  - [Changing Entitlements](#changing-entitlements)
  - [The Path Names the Anchor and the Axis; the Where Narrows](#the-path-names-the-anchor-and-the-axis-the-where-narrows)
- [Adding a Model](#adding-a-model)
- [Permix](#permix)
- [REBAC](#rebac)
  - [Schema](#schema)
  - [ActionRule Types](#actionrule-types)
  - [How It Works](#how-it-works)
  - [Dot-path vs. Single-hop Delegation](#dot-path-vs-single-hop-delegation)
- [Owner-Polymorphic Models](#owner-polymorphic-models)
- [Row-Level Overrides](#row-level-overrides)
  - [Schema](#schema)
  - [How `check()` merges](#how-check-merges)
  - [Boundary validation](#boundary-validation)
  - [When to use it](#when-to-use-it)
- [Space Permissions](#space-permissions)
- [Validation Middleware](#validation-middleware)
  - [validatePermission](#validatepermission)
  - [validateSubmodelPermission](#validatesubmodelpermission)
  - [The user as a resource](#the-user-as-a-resource)
- [Frontend Checks](#frontend-checks)
- [Future Work](#future-work)
  - [Groups](#groups)

<!-- toc:end -->


---

## Overview

The permission system is the rebac schema (`packages/permissions/src/rebac/schema.ts`) plus the check engine of `@inixiative/permissions`. A request installs what its principal holds into a permix (a table of grants plus entitlements), and every decision is `check(permix, rebacSchema, model, record, action)` on a hydrated record, or on a pseudo record when the row does not exist yet.

| Layer | Where it lives | What it says |
|---|---|---|
| Platform role | `User.platformRole` | `superadmin` passes every check |
| Tenant role | `OrganizationUser.role`, `SpaceUser.role` | what a member holds at its organization or space |
| Delegate permissions | `role`, `full`, `entitlements` on `Token` and `Integration` | how much of its owner a delegate holds |
| Entitlements | `entitlements` JSON on members and delegates | named grants beyond a role, given by hand |

The rest of this doc follows one cast through every section:

| Name | What it is |
|---|---|
| U1 | a user |
| O1 | an organization |
| S1 | a space under O1 |
| M1 | U1's member row in O1 (`OrganizationUser`, role `member`) |
| SM1 | U1's member row in S1 (`SpaceUser`) |
| M2 | another user's member row in O1, role `owner` (the owner of O1) |
| M3 | another user's member row in O1, role `admin` (an admin of O1) |
| I1 | an integration owned by M1 (`ownerModel: OrganizationUser`) |
| IO | an integration owned by O1 (`ownerModel: Organization`) |
| T | a token; which owner it has is said each time |

---

## The Model

### Vocabulary

One word per party, used in code and prose alike. Names in code are composed of these words.

| Word | Means |
|---|---|
| **user** | the `User` row: a person's account. Only a user is ever superadmin. |
| **tenant** | an organization or a space. A space is a sub-tenancy of its organization. |
| **member** | the row joining a user to a tenant (`OrganizationUser`, `SpaceUser`). The only place a person's role at a tenant is stored. |
| **JWT** / **token** | how a request authenticates. A JWT (or a superadmin's spoof) is the user; a token is a `Token` row. |
| **actor** | who is acting this request: `{ model: 'User' \| 'Token', record }` |
| **owner** | the row a token or integration belongs to (its `ownerModel`): a user, a member, a tenant, or (for a token) an integration |
| **delegate** | a token or an integration |
| **permissions** | a delegate's `{ role, full, entitlements }` |
| **entitlement** | a named grant `{ resource, anchor: { resource, id, path? }, where?, actions }` |
| **anchor** | the record an entitlement acts from, reached from the entitled record along `path` |
| **pseudo record** | the would-be row a create, a collection action or a grant is checked on |
| **me** | the user when the actor is a user, or a User-owned token's user (`me(c)`) |

### Tenants and Members

Things belong to a user (U1's own integrations, tokens, contacts) or to a tenant (O1's integrations, S1's tokens). A user reaches a tenant only through a member row: M1 gives U1 the role `member` at O1, SM1 gives U1 a role at S1. The member's role is installed as one grant on the tenant (`getOrgPermissions`, `getSpacePermissions`): `owner` holds `own`, `admin` `manage`, `member` `operate`, `viewer` `read`. A space's `own` comes from its organization's `own`, and nothing else crosses: the owner of O1 owns S1, an admin of O1 holds nothing at S1 unless it has its own member row there.

### Delegates

A delegate acts for its owner and never holds more than its owner. Its permissions are three separate things:

- **`role`** is a narrowing of the tenant. It caps what the owner holds at the tenant: a member-role token on M1 holds O1 at `member` or less, live. It says nothing about the owner itself: a role token on M1 does not act as M1.
- **`entitlements`** are given by hand and only by hand. A delegate never inherits its owner's entitlements; each one it holds was written on it, and holds only while the owner still allows it.
- **`full`** is the owner's permissions, whole and in sync: role, entitlements and the owner's own identity, as they are on every request. It is not a permission in the schema; it is resolved when permissions are installed.

A token that is not `full` has a role, entitlements or both; `full` takes neither.

---

## Roles

### PlatformRole

```prisma
enum PlatformRole {
  user        // Default - normal user
  superadmin  // Bypasses all permission checks
}
```

Superadmins:
- pass every `check` (`permix.setSuperadmin(true)`), on any credential;
- can access admin routes, and only there see soft-deleted rows (the admin router runs inside `db.withDeleted`);
- can spoof other users.

### Role

```prisma
enum Role {
  owner
  admin
  member
  viewer
}
```

The same enum is the role of a member at its tenant and the role of a delegate.

### Role Hierarchy

```typescript
// packages/permissions/src/roles/shared.ts
export const roleHierarchy = ['viewer', 'member', 'admin', 'owner'] as const;
```

`roleToStandardAction(role)` maps a role to the one standard action it names: `owner` is `own`, `admin` is `manage`, `member` is `operate`, `viewer` is `read`. `capAtRole(entry, role)` caps a grant entry at a role: it keeps the standard actions at or below the role that the entry implies through the action chain ([building entitlements](../../packages/permissions/src/rebac/ENTITLEMENTS.md)).

```typescript
// packages/permissions/src/roles/organization.ts
export const organizationRoles = {
  owner: { organization: { own: true } },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true } },
  viewer: { organization: { read: true } },
} as const;
```

---

## Actions

### Every Action Is an Action on the Record

An action in the schema is something you do to the record it is defined on, never something the record does. `operate` on M1 means acting as M1; `manage` on I1 means administering I1; `delete` on a token means revoking it. What a delegate can reach elsewhere is not an action on the delegate: it is the delegate's permissions, installed when it signs in.

### The Standard Chain

`read`, `operate`, `manage` and `own` are the standard actions. On a model that chains them, each one is implied by the one above it on the same record, so holding `own` is holding all four. `chainedStandardActions` builds this, and `ownerActions` uses it. Three kinds of model differ, each declared in `standardActionsChain.test.ts`:

- **Member rows** (`db:organizationUser`, `db:spaceUser`): `manage` and `own` do not imply `operate`. Administering a member row is not being the member.
- **Integrations** have no `own`; `read`, `operate` and `manage` chain.
- **Contacts** (`db:contact`): `manage` also requires the contact's `source` not to be `userCreation`, so it does not chain past `manage`.

Actions outside the four (`create`, `delete`, `leave`, `delegateFull`, `send`, `resolve`, `user.redact`, ...) are not part of the chain; they delegate only where their rule says so.

### Actions on Their Own Models

Every action lives on the model it acts on; a dotted action is named after its model (`packages/permissions/src/rebac/principals.test.ts`):

```typescript
// packages/permissions/src/client.ts
export const OrganizationAction = { ...StandardAction, create: 'create', delete: 'delete' };
export const UserAction = { ...StandardAction, redactUser: 'user.redact', rotateUserJwts: 'user.rotateJwts', changePassword: 'user.changePassword' };
export const TokenAction = { create: 'create', delete: 'delete' };
```

Creating checks `create` on a pseudo record of the model being created (token create in `createToken`, organization create in `organizationCreate`).

### Person-Only Actions

Some actions are for a person, not a token: minting and updating a token (`create` on `db:token`), deleting an organization, `user.redact`, `user.rotateJwts`, `user.changePassword`, and `delegateFull` on every model that has it. Their rules include `actorIsUser` (`__actor.model equals User`). Creating an organization takes a user behind the actor: `actorIsUser` or `actorIsDelegateOfUser` (a token owned by a user). A token holding `own` still cannot take a person-only action, and because the grant check runs with no actor, a person-only action can never be granted as an entitlement.

### The Actor

The table says what a principal holds. The actor says only who is acting: `permix.setActor(actorOf(model, record))` (`packages/permissions/src/actorOf.ts`) gives `{ model, record }`, with `model` `User` for a JWT or spoof and `Token` for any API token, and `record` the row's columns with its redacted fields left out. Rules read it as `__actor` in a json-rules condition. Actor rules only gate person-only actions; who is related to what is decided by walking relations. With nobody acting, an actor rule denies and the table still answers everything else.

---

## Member Rows

`memberRowActions(tenant)` in `packages/permissions/src/rebac/schemaHelpers.ts` gives `db:organizationUser` (tenant `organization`) and `db:spaceUser` (tenant `space`) their actions. The two sides of a member row are separate actions:

| Action on M1 | Who holds it | Rule |
|---|---|---|
| `operate` (being M1) | U1, and whoever holds M1's own permissions whole | `{ rel: 'user', action: 'manage' }`, plus the member self-grant |
| `manage` (administering M1) | an admin or owner of O1 | `own`, or `manage` on O1 |
| `own` | the owner of O1 | `own` on O1 |
| `read` | U1, O1's admins and owner, and anyone who reads O1 | `operate`, `manage`, `read` on U1, or `read` on O1 |
| `leave` | U1 | `{ rel: 'user', action: 'manage' }` |
| `delegateFull` | U1, as a person | `actorIsUser` and `operate` |

So the owner of O1 owns M1 and still does not operate it: removing M1 is the owner's, acting as M1 is U1's (`packages/permissions/src/rebac/memberRow.test.ts`). A member's things (its integrations, its tokens) are administered by `operate` on the member row, so they follow the person, not the tenant.

### The Member Self-Grant

`operate` on M1 comes from U1 by the schema walk. A delegate holding M1's permissions has no U1 in its table, so M1 carries its own `operate` as a stored entitlement, the member self-grant (`packages/permissions/src/roles/memberSelfGrant.ts`):

```typescript
memberSelfGrant('db:organizationUser', { id: M1.id, userId: U1.id })
// {
//   resource: 'db:organizationUser',
//   anchor: { resource: 'db:user', id: U1.id, path: 'user' },
//   where: { field: 'id', operator: 'equals', value: M1.id },
//   actions: { operate: true },
// }
```

- **Anchored on the member's user, along `user`, pinned to the row's id.** The anchor is U1 because U1 is what makes M1 operable; the `where` pins it to M1, so it never reaches U1's other member rows (U1's member row in another organization, or SM1).
- **Backed by the member's user.** A member's stored entitlements are installed with an owner that must still allow each action on each record. Every other entitlement on M1 is backed by O1's owner grant; the self-grant is backed by U1 (`getUserPermissions(U1)`), because O1's owner does not hold `operate` on M1 and would back nothing. At read time U1 still operates M1 through the normal walk, so the self-grant holds exactly as long as M1 is U1's.
- **Only that exact entry is backed by the user.** `userGrants` splits a member's entitlements with `isMemberSelfGrant(resource, member)`: an entry whose resource, anchor and `where` equal the self-grant of that very row goes to U1; everything else, including a wider entry anchored on U1 or M1's self-grant copied onto M2, goes to the tenant. Backing a wider entry by the user would let whoever writes member entitlements spend the user's authority (`apps/api/src/lib/permissions/memberSelfGrant.test.ts`).
- **The `memberSelfGrant` hook writes it and keeps it** (`apps/api/src/hooks/memberSelfGrant/hook.ts`, before `create`, `createManyAndReturn`, `update` and `upsert` on `OrganizationUser` and `SpaceUser`). On create it appends the self-grant to the row's entitlements. On an update that writes `entitlements`, it loads the member by the update's unique `where` and puts the self-grant back beside what was written, so clearing or replacing entitlements never removes it (`apps/api/src/hooks/memberSelfGrant/hook.test.ts`).
- **Its id is generated before insert.** The self-grant names the row's own id, and the database would only assign that id on insert, so the hook sets `row.id ??= Bun.randomUUIDv7()` first and builds the self-grant from it.

Who holds `operate` on M1, then: U1 through the walk; a `full` delegate of M1 (or of U1), through the self-grant installed with M1's permissions; and a role delegate only when it is given `operate` on M1 by hand.

### Role Assignment

Writing a member's role is `memberRoleWrite(tenant)`: `manage` at the tenant, and hold there the role being set (`owner` needs `own`, `admin` `manage`, `member` `operate`, `viewer` `read`). Controllers check it on the row as it is and as it will be:

```typescript
check(permix, rebacSchema, 'organizationUser', before, memberRoleWrite('organization')) &&
  check(permix, rebacSchema, 'organizationUser', after, memberRoleWrite('organization'));
```

| Assigner role | Can assign |
|---|---|
| owner | owner, admin, member, viewer |
| admin | admin, member, viewer |
| member | nothing |
| viewer | nothing |

The last-owner check stays in code. The same rule gates `PATCH /organizationUser/:id/entitlements` and `/spaceUser/:id/entitlements`.

Removing a member checks `memberRemoval(tenant)` at the route: `leave` (U1 leaves) or `memberRoleWrite` on the row. Removing tombstones the member row: `softDeleteCascade` tombstones what it owned (its integrations) and hard-deletes its tokens, and a later invite revives the row with what died with it (`memberRemoval.test.ts`). A tombstoned member is not found by the routes, so its user mints nothing on it.

---

## Integrations and Tokens by Owner Kind

Who administers a delegate depends on its owner's kind. Nobody owns an integration or a token: neither has an `own` action.

### Integrations

`integrationAdministering` and `integrationAccess` (`schemaHelpers.ts`) make up `db:integration`:

| Integration owned by | `read` | `operate` | `manage` | `delete` | `delegateFull` |
|---|---|---|---|---|---|
| a user (U1) | U1 | U1 | U1 (`manage` on U1) | U1 | U1, as a person |
| a tenant (IO, owned by O1) | `read` on O1 | `operate` on O1 | `manage` on O1 | `manage` on O1 | `own` on O1, as a person |
| a member (I1, owned by M1) | `operate` on M1; the owner of O1 (`own` on M1) | `operate` on M1 | `operate` on M1 | `operate` on M1; the owner of O1 | `operate` on M1, as a person |

So for IO a viewer of O1 reads, a member uses it, an admin administers it; for I1 the owner of O1 reads and deletes it (cleanup of something abandoned) and nothing more, and admins hold nothing (`apps/api/src/lib/permissions/integrationsUnderOrganization.test.ts`). A space member's integration works the same with S1 as the tenant; the owner of O1 owns S1's member rows, so they read and delete those too.

Every kind under O1, for the owner and an admin of O1:

| Integration owned by | Owner of O1 | Admin of O1 |
|---|---|---|
| O1 | read, operate, manage, delete | read, operate, manage, delete |
| S1 | read, operate, manage, delete | nothing |
| M1 | read, delete | nothing |
| SM1 | read, delete | nothing |

### Creating an Integration

Each create route checks `create` on a pseudo integration placed under the loaded owner (`validateSubmodelPermission('create')`), then the controller checks the body (`validateIntegrationGrant`).

| Route | `create` passes when |
|---|---|
| `POST /me/integrations` | `operate` on the user |
| `POST /organization/:id/integrations`, `POST /space/:id/integrations` | `manage` on the tenant |
| `POST /organizationUser/:id/integrations`, `POST /spaceUser/:id/integrations` | `operate` on the member row, and `operate` at the member's tenant (O1 for M1, S1 for SM1) |

So U1 adds I1 on M1 as a member of O1; a viewer of O1 adds none, and a role token on M1 adds none (it does not operate M1). A full token of U1 or of M1 adds one when U1 is at least a member.

### Tokens

`db:token` has `leave`, `read`, `create` and `delete`; `read` and `delete` are `leave` or `tokenAdministering`, which follows the token's owner kind:

| Token owned by | `read` and `delete` |
|---|---|
| a user | that user (`manage` on the user) |
| a tenant | `manage` on the tenant (an admin of O1 reads and revokes O1's tokens) |
| a member | `operate` on the member row; the owner of the tenant (`own` on the row) |
| an integration | whoever may `delete` that integration |

`leave` is `operate` on the token's `user`: a token on a member row, or on a user's or member's integration, carries that user's id, so U1 always revokes tokens made for U1. Deleting only removes access, so a token may revoke within its reach; minting and updating stay person-only. On I1's tokens the owner of O1 revokes and an admin does not (`integrationsUnderOrganization.test.ts`).

### Minting a Token

Every create-token route calls `createToken` (`apps/api/src/modules/me/services/createToken.ts`), which checks `create` on a pseudo token. The rule is `actorIsUser` and `tokenAccessIsYours`:

- the owner is a tenant, or a user you manage (a token on M1 carries U1, so only U1 mints on M1);
- for a token on an integration, the same is asked of the integration's owner;
- the role is any role when the chain ends at a user or a member row (it is capped at use), and otherwise a role you hold at the owner (`roleHeldAtOwner`; for an integration's token, at the integration's owner).

Then `validateDelegateRole` refuses a role on a token whose integration has no role and is not `full` (422: the role would narrow nothing), `validateFullGrant` runs when the body sets `full` ([Full and delegateFull](#full-and-delegatefull)), and `validateEntitlementGrants` checks every entry ([Granting an Entitlement](#granting-an-entitlement)).

`PATCH /token/:id` changes `name`, `role` and `full`; `validateTokenWrite` checks `create` on the token as it is and as it will be, plus `validateFullGrant` when it will be `full`. A token never changes itself.

---

## Full and delegateFull

### What Full Is

`full` makes a delegate its owner: the owner's table is installed unchanged, on every request (`delegateTable` returns `owner` as is). Writing `full` clears the delegate's role and entitlements (the `fullDelegate` hook, `apps/api/src/hooks/fullDelegate/hook.ts`). The schema never reads `full`, on the record or on the actor (CI rule `no-full-in-rebac-schema`).

### Who May Set It

Setting `full` is the action `delegateFull` on the delegate's owner. `validateFullGrant` (`apps/api/src/lib/permissions/validateFullGrant.ts`) is one check:

```typescript
check(writer, rebacSchema, model, delegate, {
  rel: toAccessor(delegate.ownerModel as string),
  action: 'delegateFull',
});
```

`delegateFull` is person-only on every model that has it:

| Delegate's owner | `delegateFull` held by |
|---|---|
| a user (U1) | U1 (`own` on U1) |
| a member (M1, SM1) | the member's user (`operate` on the row) |
| a user's integration | that user |
| a member's integration (I1) | the member's user (`operate` on M1) |
| a tenant's integration (IO) | the tenant's owner (`own` on O1) |
| a tenant (O1, S1) | nobody: `db:organization` and `db:space` have no `delegateFull` |

So U1 mints a full token on M1 and makes I1 full; the owner of O1 mints a full token on IO and an admin does not; nobody makes O1's own token or IO itself full; a token never sets `full`, even one holding everything its user holds (`packages/permissions/src/rebac/delegateFull.test.ts`). A refusal is 403.

### The Backstop Rules

`delegatePermissionRules` (`apps/api/src/hooks/rules/delegatePermissionRules.ts`, enforced on every write by the rules hook through `RulesRegistry`) states where `full` may sit, on the row's own columns:

- `full` takes no role and no entitlements;
- an integration is `full` only when owned by a User, OrganizationUser or SpaceUser;
- a token is `full` only when owned by a User, OrganizationUser, SpaceUser or Integration;
- a token that is not `full` has a role, entitlements or both (`delegateHoldsSomething`).

`validateFullGrant` answers first on API writes, so a person is refused with 403. The rules catch what never goes through it: a superadmin (who passes every check, `delegateFull` included) and writes outside the API (seeds, jobs, scripts). They refuse with 422.

---

## Resolution at Read Time

### Hydration

`hydrate(accessor, record)` (`packages/db/src/hydrate/hydrate.ts`) is the library's `createHydrator` over `schemaMap` (`packages/db/src/schemaMap.ts`, the same map the checks walk), loading each parent with `fetchOne` under its own cache key. It follows every to-one relation that owns its foreign key, by every column of a composite key, and on a polymorphic record every relation whose columns are set. A relation tagged `/// @permissions(hydrate: false)` in the Prisma schema is not followed, and an edge back to a record already on the path is cut. Every load runs in `db.withoutDeleted`, so a check run inside a `db.withDeleted` block never sees a tombstoned member, organization or integration.

### installPermissions

One builder fills a permix for whoever acts: `installPermissionsFor(permix, { user, token, organizationUsers, spaceUsers })` (`apps/api/src/lib/permissions/userPermissions.ts`). It resets the permix, sets the actor (the token if there is one, else the user) and the superadmin bypass from the user's platform role, then installs:

- no token (JWT or spoof): `userGrants(user.id, organizationUsers, spaceUsers)`;
- a token: `delegateTable(token, owner)`, where `owner` is that same user table for a User-owned token and `ownerTable(token)` otherwise.

`installPermissions(c)` (`apps/api/src/lib/context/installPermissions.ts`) is the request's call. For a user who is not the requester (a job acting as a user), `userPermissions(userId)` builds the same permix on a fresh instance, or returns `null` when the user does not exist.

### userGrants

`userGrants(userId, members, spaceMembers)` (`packages/permissions/src/roles/userGrants.ts`, shared by the API and the UI) returns the grants to install:

1. one grant with the user's own entry (`own` on the user, when a user id is given) and one role entry per member row;
2. per member row, its well-formed stored entitlements, split in two: the member self-grant, owned by the member's user, and the rest, owned by the tenant's owner grant.

`installGrants` sets each grant up with its owner, so an owned entitlement holds only while that owner allows it on the record.

### ownerTable

`ownerTable(delegated)` (`apps/api/src/lib/permissions/ownerTable.ts`) builds the owner's table from the owner model:

| Owner model | Owner table |
|---|---|
| `User` | `userGrants` for the user: the user entry, every member row and its entitlements |
| `OrganizationUser` / `SpaceUser` | `userGrants` for that one member row: its role at the tenant, its self-grant (owned by its user) and its other entitlements (owned by the tenant) |
| `Organization` / `Space` | `own` on the tenant |
| `Integration` | `delegateTable(integration, ownerTable(integration))`: the integration's own permissions over its owner |

The tables are read from the database on every request, so demote M1 and its tokens lose it on the next request.

### delegateTable

```typescript
export const delegateTable = (delegate, owner) => {
  if (delegate.full) return owner;
  const stored = wellFormedEntitlements(delegate.entitlements);
  return [
    ...(delegate.role ? inheritedAt(delegate.role, owner) : []),
    ...(stored.length ? [{ entries: stored, owner }] : []),
  ];
};
```

- **`full`**: the owner's table, whole: its role entries, its entitlements, the member self-grant.
- **`role`**: `inheritedAt` keeps only the owner's grants that have no owner of their own (role entries, the user entry), each capped at the role (`capAtRole`). Every owned grant (entitlements, the self-grant) is dropped.
- **`entitlements`**: installed with the owner's table as owner: each holds only while the owner allows it on that record.

A token or integration that is not `full`, has no role and has nothing left after pruning is signed out (401) at sign-in (`loadTokenContext`), by the same condition that refuses it on write.

### A Token on a Member Row

A token on M1 acts as M1 only if it holds `operate` on M1:

| Token on M1 | Holds | At O1 | As M1 |
|---|---|---|---|
| `full` | M1's table whole, self-grant included | M1's role | yes |
| role `member`, no entitlements | O1 capped at `member` | `operate` | no: it is U1's personal org token |
| role `viewer`, given `{ resource: 'db:organizationUser', anchor: { resource: 'db:organizationUser', id: M1 }, actions: { operate: true } }` | O1 at `read`, plus `operate` on M1 | `read` | yes |

Acting as M1 is the entitlement, not the role: the viewer-role token given `operate` on M1 manages I1, the owner-role token without it does nothing on I1 (`integrationsUnderOrganization.test.ts`, "a token on your member row acts as you only if it holds operate on the row"). Neither reaches SM1's things or another member's.

A token owned by U1 caps U1's whole table at its role, U1's own entry included. At `member` or above it keeps `operate` on U1, and every one of U1's member rows walks `operate` to U1, so it acts as each of U1's members. A `viewer` User token holds `read` on U1 and acts as none.

### Worked Example: I1

I1 is owned by M1. Each row is one actor; the statuses are what the routes return (`GET` checks `read`, `PATCH` checks `manage`, `DELETE` checks `delete`):

| Actor | `GET /integration/I1` | `PATCH /integration/I1` `{ name }` | `DELETE /integration/I1` |
|---|---|---|---|
| U1 (JWT) | 200 | 200 | 204 |
| T on M1, `full` | 200 | 200 | 204 |
| T on M1, role `member` | 403 | 403 | 403 |
| T on M1, role `member`, given `operate` on M1 | 200 | 200 | 204 |
| T owned by U1, `full` | 200 | 200 | 204 |
| the owner of O1 (JWT) | 200 | 403 | 204 |
| an admin of O1 (JWT) | 403 | 403 | 403 |
| another member of O1 (JWT) | 403 | 403 | 403 |
| a superadmin | 200 | 200 | 204 |

A `PATCH` that sets `role` or `full` also runs the role check below on I1 as it is and as it will be.

### A Token Never Exceeds Its Owner

A viewer member's token naming `manage` on O1 reads it and does not manage it; an admin's owner-role token manages and does not own; a space is reached exactly as far as the member reaches its organization; a member-role token on M1 minted with role `owner` holds `operate` at O1. Situations: `apps/api/src/lib/permissions/tokenNeverExceedsOwner.test.ts`, `delegatePermissions.test.ts`, `memberTokenGrants.test.ts`.

---

## Writing Delegates

### Integrations Are Delegates

An integration has a nullable `role`, `full` and `entitlements`, held over its owner (a user, a member or a tenant), and can own tokens. An integration's token (`ownerModel: Integration`) carries `integrationId` as its owner key plus its integration's own owner keys, copied at create by the `falsePolymorphism:delegatedKeys` hook; the keys are tenancy, for scans, list routes, revocation and rate-limit buckets. An integration acts only through its tokens (`integrationDelegate.test.ts`, `packages/permissions/src/rebac/delegation.test.ts`).

### An Integration's Role

`validateIntegrationRole` (`apps/api/src/modules/integration/validations/validateIntegrationGrant.ts`) checks the body on a hydrated pseudo integration: `validateFullGrant` when it is `full`, else `integrationRoleWrite`: `manage` on the integration, and the role being set held at its owner (`roleHeldAtOwner`: `owner` needs `own` there, `admin` `manage`, `member` `operate`, `viewer` or none `read`). On I1 the owner is M1, so U1 sets any role M1's actions allow U1: `member` through `operate` on M1, `admin` or `owner` only when U1 also administers O1.

Create runs it once; `PATCH /integration/:id` with `role` or `full` runs it on the row as it is and as it will be. Setting `role` to null is refused (422) unless the integration will be `full` or holds well-formed entitlements.

### Granting an Entitlement

A grant is an action: the writer must be able to take every action the delegate would hold, on every record the entitlement reaches. `validateEntitlementGrants` (`apps/api/src/lib/permissions/validateEntitlementGrants.ts`) fetches and hydrates the anchor, `placeEntitlement` (the library's, over `schemaMap`) builds one pseudo record per kind the entry reaches, and `canGrantEntitlement` judges every one in two passes:

1. **The writer's role table.** The writer's table alone (no entitlements, no actor) takes each action on the pseudo record, with fields the record does not carry read as unknown. A rule on `__actor` never passes, so a person-only action is never grantable.
2. **One held entitlement.** Failing that, the entry is one entitlement the writer holds, passed on whole: same resource and anchor, each action held or reached by pure delegation (holding `manage` grants `read`), its `where` copied or narrowed, and its granter still backing each action. Held entitlements never combine: to pass on two, grant two.

Every entry goes through this check, whoever writes it and whatever delegate it lands on. A malformed entry or an anchor that does not exist is 422; a refusal is 403.

Each pseudo record is built from the anchor down the path: the foreign keys the parent knows, one record per kind the step admits, each with its owner placed under the anchor, ids below the anchor unknown, plus the `where`'s exact `equals` values. The `where`'s root leaves (the `where` itself, or each leaf of its top `all`; nothing nested) on the kind field are checked on each kind the first step admits, and a kind a leaf fails is dropped. So, for the owner and an admin of O1:

- `{ integration, anchor O1 via organization, delete }`: every kind of integration under O1. The owner grants it (the owner deletes all four kinds); an admin does not.
- the same with `where ownerModel = Organization`: O1's own integrations. An admin grants it.
- the same with `where ownerModel in [Organization, OrganizationUser]`: only the owner grants it (an admin holds nothing on members' integrations).
- the same with `manage`: nobody grants it unfiltered, since the owner of O1 does not manage members' integrations.
- `{ token, anchor O1 via organization, create }`: refused for everyone. Minting is person-only, and the grant check has no actor.
- a path that does not end at the anchor's model, runs through a list, or is missing on another model: 422.

Situations: `integrationGrantsUnderOrganization.test.ts`, `entitlementGrants.test.ts`, `integrationDelegate.test.ts`, `memberTokenGrants.test.ts`, `packages/permissions/src/rebac/schemaMap.test.ts`.

---

## Entitlements

Grants beyond a role, stored as library entries `{ resource, anchor: { resource, id, path? }, where?, actions }` (`entitlementEntriesSchema`). A flat action map is refused (422). Stored entries are pruned to the well-formed ones wherever they are read (`wellFormedEntitlements`, by the library's `entitlementProblem`, dropping entries another one already covers), so a write starts from what is valid. How to write one: [building entitlements](../../packages/permissions/src/rebac/ENTITLEMENTS.md).

### How Entitlements Are Applied

An entitlement applies to a record when all three hold:

- **its anchor is reached along its path**, each polymorphic step being a kind that carries the step's keys;
- **its `where` holds** on the record (positive json-rules; "no value" is `equals null`);
- **its owner still allows the action** on that record through the normal walk, so a grant never outlives or outreaches whoever backs it.

The action is checked on the record, never asked of the anchor. Who backs it: for a delegate, its owner's table; for a member row, the tenant's owner grant, except the member self-grant, backed by the member's user.

### Changing Entitlements

Entitlements change only through their own endpoint, never through a record update: `PATCH /organizationUser/:id/entitlements`, `/spaceUser/:id/entitlements`, `/integration/:id/entitlements` and `/token/:id/entitlements`, with body `{ add?, remove? }` (`changeEntitlements`, `apps/api/src/lib/permissions/changeEntitlements.ts`).

- The writer must be able to change the holder: `memberRoleWrite` on a member row, `validateIntegrationRole` on an integration, `validateTokenWrite` on a token.
- Every entry in `add`, and every entry in `remove` that matches a stored one, goes through the same grant check: you remove only what you could grant. A removal that matches nothing stored is skipped, unchecked.
- On a member row the self-grant is put back by the hook whatever the body says.

### The Path Names the Anchor and the Axis; the Where Narrows

A polymorphic record carries the ids of everything above it: S1's integration has `organizationId`, I1 has `organizationId` and `userId`. The path names the anchor and the polymorphic axis; the polymorphism registry (`packages/db/src/registries/falsePolymorphism.ts`, passed to the library in `schemaMap`) says which kinds on that axis carry the relation's keys, and an entitlement reaches every one of them. The `where` narrows the kinds.

| Path from an integration | Kinds reached |
|---|---|
| `organization` | the organization's, its spaces', its members', its space members' |
| `space.organization` | its spaces' and space members' |
| `organizationUser.organization` | its members' (including as space members) |
| `user` | the user's, and the user's members' (narrow with `where ownerModel = User`) |

Sides are separate axes: `targetOrganization` reaches what O1 (or its members) received, never what it sent. A self anchor (the entitled record itself) has no path. Only the anchor's id is fixed: a record that moves within the anchor stays reached, one that moves out stops.

---

## Adding a Model

1. **Schema entry.** Add `db:<model>` to `rebacSchema.permissions` with its actions. A model owned through `user`/`organization`/`space` relations uses `ownerActions()` (or `ownerActions(['user'])` for a subset); a child of another model walks to its parent (`db:segmentMember` asks the same action of its `segment`). Build the four standard actions with `chainedStandardActions` so each implies the one below.
2. **Every action is on the record.** Name what a caller does to this model (`create`, `delete`, `send`), never what the model does elsewhere. A create rule goes on the created model and is checked on a pseudo record.
3. **Person-only acts** add `actorIsUser` to their rule. Never use the actor to decide relationships.
4. **Declare deviations.** If the model does not chain all four standard actions, list exactly which links it misses in `notStandard` in `standardActionsChain.test.ts`.
5. **Hydration.** The check walks hydrated to-one relations only. `hydrate` (`packages/db/src/hydrate/hydrate.ts`) loads every foreign-key relation of the model, recursively and live rows only, so a new relation is reachable once the Prisma schema has it.
6. **Routes.** A route on the record names its action with `validatePermission(action)`; a create or collection under an owner uses `validateSubmodelPermission(action)`. Checks that need the body run in the controller with the same `check`.
7. **Tests first**, in the situations' own sentences, including attempts to get around the rule (another member's row, a token actor, a lower role, another tenant). Factories only.

---

## Permix

Permix is the permission checker. Each request gets a fresh instance via `prepareRequest`.

- `permix.setup(entries, { replace?, owner? })` installs entries: a grant `{ resource, id?, actions }` or an entitlement `{ resource, anchor, where?, actions }`. Entries installed with an `owner` permix hold an action only while that owner still allows it on the record.
- `permix.setActor(actor)` / `permix.getActor()` set and read who is acting.
- `permix.setSuperadmin(value)` turns on the bypass; `installPermissions` sets it from `isSuperadmin(me(c))`.

The engine is `@inixiative/permissions`; `createPermissions` in `packages/permissions/src/client.ts` types it with the app's actions and actor. A check is always `check(permix, rebacSchema, model, record, action)` from `@template/permissions/rebac` on a hydrated record.

---

## REBAC

### Schema

The schema is `rebacSchema` in `packages/permissions/src/rebac/schema.ts`, keyed by resource (`db:user`, `db:organization`, `db:token`, ...), each with its `actions`. Rules shared across models are named helpers in `schemaHelpers.ts`:

| Helper | What it says |
|---|---|
| `actionOnOwner(action, at?, owners?)` | the action on whichever owner `ownerModel` names |
| `ownedBy(owners, at?)` | the record's `ownerModel` is one of these |
| `managesItsUser(at?)` | `manage` on the record's `user` |
| `memberRowActions(tenant)` | a member row's actions |
| `memberRoleWrite(tenant)`, `memberRemoval(tenant)` | writing a member's role; removing a member |
| `integrationAdministering`, `integrationAccess` | `db:integration`'s `create`, `manage`, `delete`, `delegateFull`; its `operate` and `read` |
| `integrationRoleWrite`, `roleHeldAtOwner(at?)` | writing an integration's role; the role on the row held at its owner |
| `tokenAccessIsYours`, `tokenAdministering` | `db:token`'s `create`; its `read` and `delete` |
| `chainedStandardActions`, `ownerActions(rels?)` | the standard chain; the owner fan-out over it |

`memberRoleWrite`, `memberRemoval` and `integrationRoleWrite` are rules that routes and controllers check, not named actions, so they cannot be granted as entitlements.

### ActionRule Types

| Rule | Meaning | Example |
|------|---------|---------|
| `string` | another action on the same record | `manage: 'own'` |
| `{ rel, action }` | the action on a related record (dot-paths walk further) | `{ rel: 'organization', action: 'own' }` |
| `{ rule: Condition }` | a json-rules condition over the record and `__actor` | `{ rule: { field: 'role', operator: 'in', value: ['owner'] } }` |
| `{ any: ActionRule[] }` | at least one passes | `{ any: [{ rel: 'user', action: 'read' }, 'read'] }` |
| `{ all: ActionRule[] }` | all pass | `{ all: [actorIsUser, 'own'] }` |
| `null` | only a held grant passes | `own: null` |

Acting on your own record is a walk to your own user: `{ rel: 'user', action: 'operate' }` passes when the record's `user` is a user the credential holds `operate` on. `operate` on a user stays inside that user's own tenancy (the user's own tokens, integrations and records). Reaching into another tenancy through the user needs `manage` on them: being one of their members (`operate` and `leave` on a member row) and resolving an inquiry addressed to them. So a member-role token on U1 handles U1's own things but neither acts as U1's members, leaves an organization nor accepts an invite; an admin- or owner-role token on U1, a full one, and U1 do (`memberRow.test.ts`, `principals.test.ts`, `memberRemoval.test.ts`). The record must arrive with `user` hydrated; a bare foreign key is denied, never guessed (`principals.test.ts`).

### How It Works

1. **Same-resource delegation**: `manage: 'own'` means "to manage, check if you own".
2. **Relation delegation**: `own: { rel: 'organization', action: 'own' }` means "to own a space, own its organization".
3. **Dot-path traversal**: `{ rel: 'sourceSpace.organization', action: 'own' }` walks `inquiry.sourceSpace` and then its `organization`, and asks `own` only there.
4. **Entitlements**: consulted at a record only after the table and the schema rule miss.
5. **Cycle detection** stops a rule that comes back to itself.

### Dot-path vs. Single-hop Delegation

```typescript
// Single-hop: own on the space, which its organization's own also gives.
// A space owner or an organization owner passes.
{ rel: 'sourceSpace', action: 'own' }

// Dot-path: own on the organization itself. Only an organization owner passes.
{ rel: 'sourceSpace.organization', action: 'own' }
```

In the inquiry schema, `updateSpace` uses single-hop and `transferSpace` uses the dot-path.

---

## Owner-Polymorphic Models

Models with nullable foreign keys to several owners (Contact, WebhookSubscription, Segment, Flow) use `ownerActions()`:

```typescript
'db:webhookSubscription': { actions: { ...ownerActions(), create: 'operate' } },
'db:flow': { actions: { ...ownerActions(['user']), create: 'operate' } },
```

For each standard action the helper asks the same action of `user`, `organization` and `space`, chained. Only the populated relation is hydrated, so the others fail and the rule follows the actual owner. Integrations and tokens are owner-polymorphic too but follow their own owner-kind rules ([Integrations and Tokens by Owner Kind](#integrations-and-tokens-by-owner-kind)).

---

## Row-Level Overrides

Some resources need per-row sharing on top of the schema rule, for example one contact readable by anyone without changing the rule for every contact. The pattern is a `permissionRules: Json?` column that `check()` merges additively with the schema rule.

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
  ? { any: [schemaRule, rowRule] }
  : schemaRule;
return check(permix, schema, model, record, merged, visited);
```

**Additive only.** Row rules grant additional paths and never restrict; the schema rule is the floor. `read: { all: [] }` opens the row to any authenticated requester; `read: null` does not take `read` from the owner.

### Boundary validation

Route schemas validate the shape before it lands in the database. Use `buildPermissionRulesSchema(model, pick?)` from `@template/permissions/rebac/permissionRulesSchema`; it derives the valid action keys from `rebacSchema[model].actions`:

```typescript
// apps/api/src/modules/contact/schemas/contactSchemas.ts
export const contactCreateBodySchema = ContactScalarInputSchema.omit({ ... }).extend({
  permissionRules: buildPermissionRulesSchema('contact', ['read']),
});
```

The schema validates the `ActionRule` envelope and passes the inner json-rules `Condition` through; `check()` validates it when the rule fires.

### When to use it

Use it for opt-in sharing of individual records (sharing a contact, publishing an asset), with a narrow set of overridable actions, typically `read` only. If every row needs the same override, it belongs in the schema rule.

---

## Space Permissions

Spaces are sub-tenancies of their organization. A space has its own members (`SpaceUser`, with the same `Role` enum) and its own role grants; its `own` also comes from its organization's `own`.

```prisma
model SpaceUser {
  role            Role
  organizationId  String
  spaceId         String
  userId          String

  @@unique([organizationId, spaceId, userId])
}
```

1. A user is a member of the organization before being a member of one of its spaces.
2. The owner of O1 owns S1, and so owns SM1 and reads and deletes SM1's integrations and tokens.
3. An admin of O1 holds nothing at S1 without a member row there.
4. A token owned by S1 (`ownerModel: Space`) holds `own` on S1 capped at its role.

---

## Validation Middleware

Located in `apps/api/src/middleware/validations/`. There is no "is there a user" gate: every route names its action, and the action's rule decides who may take it.

### validatePermission

Checks an action on the route's loaded record:

```typescript
router.get('/:id', validatePermission('read'), handler);
router.patch('/:id', validatePermission('manage'), handler);
```

1. Gets the loaded `resource` and `resourceType` from context.
2. Hydrates the resource with the relations the check walks.
3. Checks `check(permix, rebacSchema, resourceType, hydrated, action)`.
4. Throws 403 when it fails.

`resourceContextMiddleware` throws 404 (not found) or 409 (multiple matches) before `validatePermission` runs. Resource existence is not secret (ids appear in share links, emails, audit logs); privacy is enforced on field visibility and queries. A resource that must hide its existence needs a middleware that returns 404 when the check fails.

### validateSubmodelPermission

A route on a submodel (a create or a collection under an owner: `/organization/:id/contacts`, `/organizationUser/:id/integrations`, `/me/integrations`) checks its action on a pseudo record of the submodel, placed under the loaded owner, so the rule lives with the child model and entitlements on the child apply:

```typescript
// apps/api/src/middleware/validations/validateSubmodelPermission.ts
const [placed] = placeUnder(schemaMap, `db:${submodel}`, ownerType, `db:${ownerType}`, owner, {
  ownerModel: toModelName(ownerType),
});
const pseudo = await hydrate(submodel, { id: '', ...placed });
check(permix, rebacSchema, submodel, pseudo, action);
```

- `placeUnder` (the library's, re-exported from `@template/permissions/rebac`) builds the pseudo record along the owner's relation: the owner keys, the owner attached, the kind narrowed to the owner's model; `id: ''` never matches a grant keyed by a real row.
- It never reads the request body. Checks that depend on the body (a token's role or `full`, an integration's role, an inquiry's `send`) stay in their services.
- Using it on a route with no submodel throws on each request to that route (`validateSubmodelPermission.test.ts`).

Routes that still check an action on the owner (`validatePermission` on spaces, members, inquiries, customer refs, segments) are not migrated yet.

### The user as a resource

`/me/*` routes check their action like any other route; `meResourceMiddleware` loads `me(c)` as the resource, typed `user`. `me(c)` is the request's user (a JWT session or a spoof), or the user of a User-owned token; anything else has no me and gets 401.

```typescript
middleware: [validateSubmodelPermission('read')]     // meReadManyContacts, -Integrations, -WebhookSubscriptions, -Tokens
middleware: [validateSubmodelPermission('create')]   // meCreateContact, -Flow, -Integration, -WebhookSubscription
middleware: [validatePermission('read')]             // the other meReadMany*
middleware: [validatePermission('operate')]          // meCreateInquiry, meCreateSegment, meReachSegment
```

Person-only situations: `apps/api/src/middleware/validations/userOnlyActions.test.ts`, `apps/api/src/lib/context/userActsDirectly.test.ts`.

---

## Frontend Checks

The frontend runs the same ReBAC engine. `permissions.setup(me)` (`packages/ui/src/store/slices/permissions.ts`) loads the user's own, organization and space permissions from `/me` through `userGrants`, mirroring the backend setup. A superadmin gets `permix.setSuperadmin(true)` and every check passes.

| Layer | Entry point |
|-------|-------------|
| Route | `validatePermission`, naming the action ([Validation Middleware](#validation-middleware)) |
| Page | `_authenticated.tsx`, `useAuthenticatedRouting`, then `checkContextPermission`: the nav item's `access` decides "can view"; on failure it falls back to the org (from a space), then user, then public context, else renders `Unauthorized` |
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
  name            String
  role            Role
  entitlements    Json?
  members         GroupMember[]
}

model GroupMember {
  groupId  String
  userId   String
}
```

Use cases:
- assign a role and entitlements to many users at once;
- an "Engineering" group gets the `member` role plus an entitlement to manage one space.
