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
  - [Transitions](#transitions)
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
  - [Hydration](#hydration)
  - [installPermissions](#installpermissions)
  - [permissionsOfUser](#permissionsofuser)
  - [fetchPermissionsOfDelegateOwner](#fetchpermissionsofdelegateowner)
  - [narrowOwnerPermissionsToDelegate](#narrowownerpermissionstodelegate)
  - [A Token on a Member Row](#a-token-on-a-member-row)
  - [Worked Example: I1](#worked-example-i1)
  - [A Token Never Exceeds Its Owner](#a-token-never-exceeds-its-owner)
- [Writing Delegates](#writing-delegates)
  - [Integrations Are Delegates](#integrations-are-delegates)
  - [An Integration's Role](#an-integrations-role)
  - [Granting an Entitlement](#granting-an-entitlement)
    - [Granting below a held row](#granting-below-a-held-row)
- [Entitlements](#entitlements)
  - [How Entitlements Are Applied](#how-entitlements-are-applied)
  - [Changing Entitlements](#changing-entitlements)
  - [The Path Names the Anchor and the Axis; the Where Narrows](#the-path-names-the-anchor-and-the-axis-the-where-narrows)
  - [Lenses Keep `id`; Paths Merge by `id`](#lenses-keep-id-paths-merge-by-id)
- [Adding a Model](#adding-a-model)
- [Permix](#permix)
- [REBAC](#rebac)
  - [Schema](#schema)
  - [ActionRule Types](#actionrule-types)
  - [How It Works](#how-it-works)
  - [Crossing a List (`down`)](#crossing-a-list-down)
  - [Placing a Field on a Stand-In (`place`)](#placing-a-field-on-a-stand-in-place)
  - [Dot-path vs. Single-hop Delegation](#dot-path-vs-single-hop-delegation)
  - [Inquiry permissions](#inquiry-permissions)
- [Owner-Polymorphic Models](#owner-polymorphic-models)
- [Row-Level Overrides](#row-level-overrides)
  - [Schema](#schema)
  - [How `check()` merges](#how-check-merges)
  - [Boundary validation](#boundary-validation)
  - [When to use it](#when-to-use-it)
- [Tenant Rules](#tenant-rules)
  - [Shape](#shape)
  - [Which tenants a record reads](#which-tenants-a-record-reads)
  - [Writing it](#writing-it)
  - [Limits to know](#limits-to-know)
  - [What a tenant may extend](#what-a-tenant-may-extend)
- [Space Permissions](#space-permissions)
- [Validation Middleware](#validation-middleware)
  - [validatePermission](#validatepermission)
  - [validateSubmodelPermission](#validatesubmodelpermission)
  - [Lists under an owner](#lists-under-an-owner)
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
| Delegate permissions | `role` and `full` on `Token` and `Integration`, plus their entitlement rows | how much of its owner a delegate holds |
| Entitlements | rows of the `Entitlement` table, one per grant, targeted at a member or a delegate | named grants beyond a role, given by hand |

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
| **entitlement** | a named grant `{ resource, anchor: { resource, id, path? }, where?, actions }`, stored as one `Entitlement` row whose **source** is the anchor and whose **target** is the holder ([Entitlements](#entitlements)) |
| **member self-grant** | the entitlement every member row carries to `operate` on itself, backed by its user ([The Member Self-Grant](#the-member-self-grant)) |
| **delegateFull** | the person-only action on an owner that lets you set `full` on its delegate ([Full and delegateFull](#full-and-delegatefull)) |
| **anchor** | the record an entitlement acts from, reached from the entitled record along `path` |
| **pseudo record** | the would-be row a create, a collection action or a grant is checked on |
| **me** | the user when the actor is a user, or a User-owned token's user (`actingUser(c)`) |

### Tenants and Members

Things belong to a user (U1's own integrations, tokens, contacts) or to a tenant (O1's integrations, S1's tokens). A user reaches a tenant only through a member row: M1 gives U1 the role `member` at O1, SM1 gives U1 a role at S1. The member's role is installed as one grant on the tenant (`permissionEntryForOrganizationRole`, `permissionEntryForSpaceRole`): `owner` holds `own`, `admin` `manage`, `member` `operate`, `viewer` `read`. A space's `own` comes from its organization's `own`, and nothing else crosses: the owner of O1 owns S1, an admin of O1 holds nothing at S1 unless it has its own member row there.

### Delegates

A delegate acts for its owner and never holds more than its owner. Its permissions are three separate things:

- **`role`** is a narrowing of the tenant. It caps what the owner holds at the tenant: a member-role token on M1 holds O1 at `member` or less, live. It says nothing about the owner itself: a role token on M1 does not act as M1.
- **`entitlements`** are given by hand and only by hand: `Entitlement` rows targeted at the delegate. A delegate never inherits its owner's entitlements; each one it holds was written on it, and holds only while the owner still allows it.
- **`full`** is the owner's permissions, whole and in sync: role, entitlements and the owner's own identity, as they are on every request. It is not a permission in the schema; it is resolved when permissions are installed.

`full` takes no role and no entitlements. A delegate that is not `full`, with no role and no entitlements, holds nothing; it is not refused (silence never widens: the library's `delegate` installs the role's ceiling and the entitlement rows, and both are empty).

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

`roleToStandardAction(role)` maps a role to the one standard action it names: `owner` is `own`, `admin` is `manage`, `member` is `operate`, `viewer` is `read`. The library's `capAtRole(schema, entry, ceiling)` keeps an entry at a ceiling, the role's standard action: every action on the entry's resource that the ceiling reaches by pure delegation and the entry holds or implies ([building entitlements](../../packages/permissions/src/rebac/ENTITLEMENTS.md)).

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
- **Integrations** and **projects** have no `own`; `read`, `operate` and `manage` chain.
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

Some actions are for a person, not a token: minting and updating a token (`create` on `db:token`), deleting an organization, `user.redact`, `user.rotateJwts`, `user.changePassword`, and `delegateFull` on every model that has it. Their rules include `actorIsUser` (`actor:Acting.model equals User`). Creating an organization takes a user behind the actor: `actorIsUser` or `actorIsDelegateOfUser` (a token owned by a user). A token holding `own` still cannot take a person-only action, and because the grant check runs with no actor, a person-only action can never be granted as an entitlement.

### The Actor

The table says what a principal holds. The actor says only who is acting: `permix.setActor(actorFromRecordOmittingSensitiveFields(model, record))` (`packages/permissions/src/actorFromRecordOmittingSensitiveFields.ts`) gives `{ model, record }`, with `model` `User` for a JWT or spoof and `Token` for any API token, and `record` the row's columns with its sensitive fields omitted. The check hands its rows to every rule as the supplied `actor` map (`packages/db/src/schemaMap.ts`): `actor:Acting.model` says which kind is acting, and `actor:User` or `actor:Token` is that kind's row. A token request gives no `actor:User` row, so a rule on one never passes for a token. Actor rules gate person-only actions and say which kind of party a [transition](#transitions) allows (`actingAsAPerson`, `actingAsTheRecordsIntegration`); who is related to what is decided by walking relations. With nobody acting, an actor rule denies and the table still answers everything else.

---

### Transitions

Some writes are legal only from one state to another, and only for some parties: a member's role, an integration resource's status, registering a resource that was removed. They are `@inixiative/transitions` actions (`packages/permissions/src/transitions/`, keyed by the same `db:<model>` resources as the rebac schema). A transition's `from` side is checked against the row as it is, its `to` side against the row with the change merged; each side has a predicate (is this move legal) and a permission (an `ActionRule`, as anywhere in the schema).

`assertTransition(permix, model, action, record, changes)` (`apps/api/src/lib/permissions/assertTransition.ts`) hydrates the row, runs `checkTransition` and evaluates each permission with template's own `check` (`packages/permissions/src/rebac/check.ts`, which supplies the actor rows). It throws 403 when a path's predicates held and only its permission failed, and 409 when no path's state allows the change. The library's `createAuthorize` is not used: it evaluates with a permix that holds nothing, so a `{ rel }` walk through the caller's grants never passes.

Integration resource status (`changeStatus`; `PATCH /integrationResource/:id`). A person is a user, or a token owned by anything but an integration (`actingAsAPerson`); the resource's own integration is a token owned by an integration whose `integrationId` is the resource's (`actingAsTheRecordsIntegration`). Both need `manage` on the resource as well.

| From → to | A person | The resource's own integration |
|---|---|---|
| unchanged | yes | yes |
| tracked → untracked, untracked → tracked, missing → untracked | yes | no |
| tracked → missing, missing → tracked | no | yes |

Aron, 2026-11-22: "integration resources should be able to move missing to tracked, but should not be able to touch untracked." A token of a different integration fails even when granted `manage` on this one.

Registering (`register`; `POST /integration/:id/integrationResources`) is the same moves crossed with whether the row exists: a new key is created tracked (`create`), a live row may make any move above, and a removed row may make any move above except staying untracked. So a removed untracked resource comes back only when a person registers it with `status: 'tracked'`; otherwise the answer is 409 (Aron, 2026-11-22: "You have to track it to revive it"), and an integration re-registering its resources never undoes a person's untrack.

## Member Rows

`memberRowActions(tenant)` in `packages/permissions/src/rebac/rebacSchemaRules.ts` gives `db:organizationUser` (tenant `organization`) and `db:spaceUser` (tenant `space`) their actions. The two sides of a member row are separate actions:

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
memberSelfGrant('db:organizationUser', { id: M1.id })
// {
//   resource: 'db:organizationUser',
//   anchor: { resource: 'db:organizationUser', id: M1.id },
//   actions: { operate: true },
// }
```

- **Anchored at the member row itself, with no `where`** (Aron, 2026-11-14). A self anchor reaches M1 and nothing else, so it never reaches U1's other member rows (U1's member row in another organization, or SM1). Why this shape: an unconditional entitlement with no lens counts in the grant check's first pass like a role on its record ([Granting below a held row](#granting-below-a-held-row)), so a `full` delegate of M1 can grant over M1's own integrations. The old shape (anchored at U1 along `user`, `where id = M1`) had a `where`, so it never counted there and a member-owned grant over the member's own integration was refused.
- **Backed by the member's user.** A member's stored entitlements are installed with an owner that must still allow each action on each record. Every other entitlement on M1 is backed by O1's owner grant; the self-grant is backed by U1 (`permissionEntryForOwnUser(U1)`), because O1's owner does not hold `operate` on M1 and would back nothing. At read time U1 still operates M1 through the normal walk, so the self-grant holds exactly as long as M1 is U1's.
- **Only that exact entry is backed by the user.** `permissionsOfUser` splits a member's entitlements with `isMemberSelfGrant(resource, member)`: an entry equal to the self-grant of that very row (resource, anchor, no `where`, `operate` alone; a lens is not part of the entry) goes to U1; everything else, including a wider entry anchored on U1 or M1's self-grant copied onto M2, goes to the tenant. Backing a wider entry by the user would let whoever writes member entitlements spend the user's authority (`apps/api/src/lib/permissions/memberSelfGrant.test.ts`).
- **The `memberSelfGrant` hook writes it; a guard keeps it.** The hook (`apps/api/src/hooks/memberSelfGrant/hook.ts`, after `create`, `createManyAndReturn` and an `upsert` that creates, on `OrganizationUser` and `SpaceUser`) writes the self-grant as an `Entitlement` row targeted at the new member, once the member has its id. A member created tombstoned (a transferred space's dropped people, `transferSpace`) gets its self-grant tombstoned with the member's own `deletedAt`, so reviving the member revives the grant. The guard `memberSelfGrant:kept` (same file, after updates on `Entitlement`) refuses with 422 any write that tombstones a live member's self-grant, by id or in bulk; only the cascade from the member's own tombstone takes it. Rows are immutable, so the grant can't be weakened in place either (`apps/api/src/hooks/memberSelfGrant/hook.test.ts`).

Who holds `operate` on M1, then: U1 through the walk; a `full` delegate of M1 (or of U1), through the self-grant installed with M1's permissions; and a role delegate only when it is given `operate` on M1 by hand.

### Role Assignment

Writing a member's role is `memberRoleWrite(tenant)`: `manage` at the tenant, and hold there the role being set (`owner` needs `own`, `admin` `manage`, `member` `operate`, `viewer` `read`). It is the `changeRole` transition (`packages/permissions/src/transitions/memberRoleTransitions.ts`), checked on the row as it is and as it will be ([Transitions](#transitions)):

```typescript
await assertTransition(permix, 'organizationUser', 'changeRole', orgUser, { role: body.role ?? orgUser.role });
```

| Assigner role | Can assign |
|---|---|
| owner | owner, admin, member, viewer |
| admin | admin, member, viewer |
| member | nothing |
| viewer | nothing |

The last-owner check stays in code: `validateNotLastOwner(organizationId)` (`apps/api/src/modules/organization/validations/validateNotLastOwner.ts`) answers 400 "Cannot remove last owner" when an organization's only owner is removed (`organizationUserDelete`) or demoted (`organizationUserUpdate`); both controllers call it only when the row being changed is an owner. `memberRoleWrite` also gates writing a member's entitlements (`validateMemberGrant`, `apps/api/src/lib/permissions/validateMemberGrant.ts`).

Removing a member checks `memberRemoval(tenant)` at the route: `leave` (U1 leaves) or `memberRoleWrite` on the row. Removing tombstones the member row: `softDeleteCascade` tombstones what it owned (its integrations, its tokens, its entitlement rows), and a later invite revives the row with what died with it, except its tokens: a token never revives (`SKIP_REVIVE`), and neither do its entitlement rows (`memberRemoval.test.ts`, `entitlementRows.test.ts`). A tombstoned member is not found by the routes, so its user mints nothing on it.

---

## Integrations and Tokens by Owner Kind

Who administers a delegate depends on its owner's kind. Nobody owns an integration or a token: neither has an `own` action.

### Integrations

`integrationAdministering` and `integrationAccess` (`rebacSchemaRules.ts`) make up `db:integration`:

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

Each create route checks `create` on a pseudo integration placed under the loaded owner (`validateSubmodelPermission('create')`), then `createIntegration` (`apps/api/src/modules/integration/services/createIntegration.ts`) checks the role with `validateIntegrationRole` and writes the row and its entitlements in one transaction.

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

Every create-token route calls `createToken` (`apps/api/src/modules/me/services/createToken.ts`), which checks `create` on a pseudo token. The rule is `actorIsUser` and `actorMayCreateTokenAtOwnerWithRole`:

- the owner is an organization or space you may `manage` (admin and above), or a user you manage (a token on M1 carries U1, so only U1 mints on M1). A member below admin mints on their own user, member row and integrations, and a token on a member row or its integration ends with the membership; a tenant's token is durable, and outlasts the admin who minted it;
- for a token on an integration, the same is asked of the integration's owner;
- the role is any role when the chain ends at a user or a member row (it is capped at use), and otherwise a role you hold at the owner (`roleHeldAtOwner`; for an integration's token, at the integration's owner).

Then `validateDelegateRole` refuses a role on a token whose integration has no role and is not `full` (422: the role would narrow nothing), `validateFullGrant` runs when the body sets `full` ([Full and delegateFull](#full-and-delegatefull)). The token row and its entitlements are written in one transaction: the token first, then the body's entries through the one writer, `changeEntitlements` ([Changing Entitlements](#changing-entitlements)), which checks every entry. A token with no role and no entitlements is minted and holds nothing. Creating an integration does the same (`apps/api/src/modules/integration/services/createIntegration.ts`).

`PATCH /token/:id` changes `name`, `role` and `full`; `validateTokenWrite` checks `create` on the token as it is and as it will be, plus `validateFullGrant` when it will be `full`, so changing a tenant's token takes `manage` on the tenant too. A token never changes itself.

An entitlement on a token is its own row, anchored at the resource: one an admin copied onto a tenant's token stays when the admin's own row is revoked. Revoke it on the token.

---

## Full and delegateFull

### What Full Is

`full` makes a delegate its owner: the owner's permissions are installed unchanged, on every request (`narrowOwnerPermissionsToDelegate` returns `owner` as is). Writing `full` clears the delegate's role before the write and tombstones its live entitlement rows after it (the `fullDelegate` hook, `apps/api/src/hooks/fullDelegate/hook.ts`); the same hook refuses any `Entitlement` row created for a `full` delegate (422), through the writer or not. The schema never reads `full`, on the record or on the actor (CI rule `rebac-schema-never-reads-full`).

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

`fullDelegateRules` (`apps/api/src/hooks/rules/fullDelegateRules.ts`, enforced on every write by the rules hook through `RulesRegistry`) states where `full` may sit, on the row's own columns:

- `full` takes no role;
- an integration is `full` only when owned by a User, OrganizationUser or SpaceUser;
- a token is `full` only when owned by a User, OrganizationUser, SpaceUser or Integration.

A delegate that is not `full` and has no role and no entitlements is not refused, on any write or at sign-in: it holds nothing, because the library treats an empty delegate as the empty permissions (`@inixiative/permissions` README, "Silence never widens"). Taking the role off, or removing the last entitlement row, leaves such a delegate. A member row always has a role.

`validateFullGrant` answers first on API writes, so a person is refused with 403. The rules catch what never goes through it: a superadmin (who passes every check, `delegateFull` included) and writes outside the API (seeds, jobs, scripts). They refuse with 422.

---

## Resolution at Read Time

### Hydration

`hydrate(accessor, record)` (`packages/db/src/hydrate/hydrate.ts`) is the library's `createHydrator` over `schemaMap` (`packages/db/src/schemaMap.ts`, the same map the checks walk), loading each parent with `fetchCachedRecordWithTargetEntitlements` under its own cache key. It follows every to-one relation that owns its foreign key, by every column of a composite key, and on a polymorphic record every relation whose columns are set. It owns those relations: a value the caller put under a to-one relation is dropped unless the hydrator loaded it, so attach a hand-made relation after hydrating. A list is left as given unless it is declared `down` ([Crossing a List](#crossing-a-list-down)). A relation tagged `/// @permissions(hydrate: false)` in the Prisma schema is not followed, and an edge back to a record already on the path is cut. Every load goes through `fetchThroughCache()`, which computes inside `db.withoutDeleted`, so a check run inside a `db.withDeleted` block never sees a tombstoned member, organization or integration. `fetchCachedRecordWithTargetEntitlements` loads a `Token`, `Integration`, `OrganizationUser` or `SpaceUser` with its live entitlement rows (`includeTargetEntitlements(model)`, ordered by `createdAt`, `id`) and caches it with those rows as stored, so a hydrated holder carries `targetEntitlements: Entitlement[]` and the cache holds one shape. `findUserWithRelations` and `fetchTokenContext` read the same way. The rows turn into the library's entries at check time, where a holder is handed to the library (`entitlementEntriesOfHolder` in `@template/permissions`, which also prunes them with `wellFormedEntitlements`). A write to an `Entitlement` row clears its target's cache keys (its parent edge, [HOOKS.md](HOOKS.md#parent-edges)), so a revoked row is gone on the very next request.

### installPermissions

One builder fills a permix for whoever acts: `installPermissionsFor(permix, { user, token, organizationUsers, spaceUsers })` (`apps/api/src/lib/permissions/userPermissions.ts`). It resets the permix, sets the actor (the token if there is one, else the user) and the superadmin bypass from the user's platform role, then installs:

- no token (JWT or spoof): `permissionsOfUser(user.id, organizationUsers, spaceUsers)`;
- a token: `narrowOwnerPermissionsToDelegate(token, owner)`, where `owner` is those same permissions for a User-owned token and `fetchPermissionsOfDelegateOwner(token)` otherwise.

`installPermissionsFromRequestContext(c)` (`apps/api/src/lib/context/installPermissionsFromRequestContext.ts`) is the request's call. For a user who is not the requester (a job acting as a user), `fetchPermixForUser(userId)` builds the same permix on a fresh instance, or returns `null` when the user does not exist.

### permissionsOfUser

`permissionsOfUser(userId, members, spaceMembers)` (`packages/permissions/src/roles/permissionsOfUser.ts`, shared by the API and the UI) returns the permissions to install, as the library's `Permissions` (groups of entries; a group with an `owner` is entitlements backed by that owner):

1. one group with the user's own entry (`own` on the user, when a user id is given) and one role entry per member row;
2. per member row, its well-formed stored entitlements, split in two: the member self-grant, owned by the member's user, and the rest, owned by the tenant's owner.

The library's `installPermissions` sets each group up with its owner, so an owned entitlement holds only while that owner allows it on the record.

### fetchPermissionsOfDelegateOwner

`fetchPermissionsOfDelegateOwner(delegated)` (`apps/api/src/lib/permissions/ownerPermissions.ts`) builds the owner's permissions from the owner model:

| Owner model | Owner's permissions |
|---|---|
| `User` | `permissionsOfUser` for the user: the user entry, every member row and its entitlements |
| `OrganizationUser` / `SpaceUser` | `permissionsOfUser` for that one member row: its role at the tenant, its self-grant (owned by its user) and its other entitlements (owned by the tenant) |
| `Organization` / `Space` | `own` on the tenant: `organizationOwnerPermissions(organizationId)` / `spaceOwnerPermissions(spaceId)` (`packages/permissions/src/roles/permissionsOfUser.ts`) |
| `Integration` | `narrowOwnerPermissionsToDelegate(integration, fetchPermissionsOfDelegateOwner(integration))`: the integration's own permissions over its owner |

The permissions are read from the database on every request, so demote M1 and its tokens lose it on the next request.

### narrowOwnerPermissionsToDelegate

The library's `delegate` resolves a delegate from its owner's permissions; the template maps the row onto it:

```typescript
export const narrowOwnerPermissionsToDelegate = (delegated, owner) =>
  delegate(rebacSchema, owner, {
    full: delegated.full,
    ceiling: delegated.role ? roleToStandardAction(delegated.role) : undefined,
    entitlements: wellFormedEntitlements(delegated.entitlements),
  });
```

- **`full`**: the owner's permissions, whole: its role entries, its entitlements, the member self-grant.
- **`role`**: only the owner's groups that have no owner of their own (role entries, the user entry), each entry capped at the role's standard action (`capAtRole`). Every owned group (entitlements, the self-grant) is dropped.
- **`entitlements`**: installed with the owner's permissions as owner: each holds only while the owner allows it on that record.

A token or integration that is not `full`, has no role and has nothing left after pruning is signed out (401) at sign-in (`fetchTokenContext`), by the same condition that refuses it on write.

### A Token on a Member Row

A token on M1 acts as M1 only if it holds `operate` on M1:

| Token on M1 | Holds | At O1 | As M1 |
|---|---|---|---|
| `full` | M1's permissions whole, self-grant included | M1's role | yes |
| role `member`, no entitlements | O1 capped at `member` | `operate` | no: it is U1's personal org token |
| role `viewer`, given `{ resource: 'db:organizationUser', anchor: { resource: 'db:organizationUser', id: M1 }, actions: { operate: true } }` | O1 at `read`, plus `operate` on M1 | `read` | yes |

Acting as M1 is the entitlement, not the role: the viewer-role token given `operate` on M1 manages I1, the owner-role token without it does nothing on I1 (`integrationsUnderOrganization.test.ts`, "a token on your member row acts as you only if it holds operate on the row"). Neither reaches SM1's things or another member's.

A token owned by U1 caps U1's permissions at its role, U1's own entry included. At `member` or above it keeps `operate` on U1, and every one of U1's member rows walks `operate` to U1, so it acts as each of U1's members. A `viewer` User token holds `read` on U1 and acts as none.

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

An integration has a nullable `role`, `full` and `entitlements`, held over its owner (a user, a member or a tenant), and can own tokens. An integration's token (`ownerModel: Integration`) carries `integrationId` as its owner key plus its integration's own owner keys, copied at create by the `falsePolymorphism:carriedOwnerKeys` hook; the keys are tenancy, for scans, revocation and rate-limit buckets. It is listed only under its integration (`/integration/:id/tokens`), never in its tenant's list. An integration acts only through its tokens (`integrationDelegate.test.ts`, `packages/permissions/src/rebac/delegation.test.ts`).

### An Integration's Role

`validateIntegrationRole` (`apps/api/src/modules/integration/validations/validateIntegrationRole.ts`) checks the body on a hydrated pseudo integration: `validateFullGrant` when it is `full`, else `integrationRoleWrite`: `manage` on the integration, and the role being set held at its owner (`roleHeldAtOwner`: `owner` needs `own` there, `admin` `manage`, `member` `operate`, `viewer` or none `read`). On I1 the owner is M1, so U1 sets any role M1's actions allow U1: `member` through `operate` on M1, `admin` or `owner` only when U1 also administers O1.

Create runs it once; `PATCH /integration/:id` with `role` or `full` runs it on the row as it is and as it will be. Setting `role` to null is allowed; an integration left with no role and no entitlements holds nothing.

### Granting an Entitlement

A grant is an action: the writer must be able to take every action the delegate would hold, on every record the entitlement reaches. `validateEntitlementGrants` (`apps/api/src/lib/permissions/validateEntitlementGrants.ts`) fetches and hydrates the anchor, `placeEntitlement` (the library's, over `schemaMap`) builds one pseudo record per kind the entry reaches, and `canGrantEntitlement` judges every one in two passes:

1. **The writer's role table, and what it holds outright above the record.** The writer's table (no actor) takes each action on the pseudo record, and a field the record does not carry fails every rule on it. The pseudo record never carries its own key, so a rule that rests on an empty column (a null check beside `id exists`) is not grantable over many records. A rule on `actor:` rows never passes, so a person-only action is never grantable. An entitlement the writer holds counts here too, like a role on its record, when it is marked `grantsBelow` and sits on a real row above the pseudo record ([Granting below a held row](#granting-below-a-held-row)).
2. **One held entitlement.** Failing that, the entry is one entitlement the writer holds, passed on whole: same resource and anchor, each action held or reached by pure delegation (holding `manage` grants `read`), its `where` copied or narrowed (an `all` holding every conjunct of the held `where` plus more: held `C`, granted `all: [A, B, C]`), and its granter still backing each action. The lens is never copied: lenses compose down the chain ([the lens](../../packages/permissions/src/rebac/ENTITLEMENTS.md#the-lens)). Held entitlements never combine: to pass on two, grant two.

#### Granting below a held row

An entitlement held with no `where` and no lens grants below its record, as a role there would (Aron, 2026-11-14). `entitlementEntriesOfHolder` marks every such row `grantsBelow: true` as it turns rows into entries for a table; the library counts a marked entry in the first pass only on a hydrated row above the granted record (the entry's anchor row when the entry sits under it by a path, or a row the anchor holds under its own foreign keys), never on the granted record itself or a pseudo record, and asks the same of whoever backs it at every depth. So M1's self-grant lets a `full` delegate of M1 give `manage` on I1, M1's integration, to another of M1's delegates; a holder of `manage` on S1 (no `where`, no lens) grants `manage` on S1's integrations instead of only a copy of itself.

- **Why no `where`.** A held `where` would be read on today's anchor row and left out of the grant, so the new row would outlive the condition. A row with a `where` is handed on only by the second pass, which keeps every held condition.
- **Why no lens.** The library never sees a lens; the mark is the app's statement that nothing narrows the row. A lensed row is handed on by the second pass, where its lens composes down the chain at read. Aron: "we shouldn't pass lensed grants… That way, it's just maximally open."
- **Why derived, not stored.** The mark is a fact about the row's `where` and `lens` columns, so a column would only restate them and could disagree. It is set in `entitlementEntriesOfHolder` alone, not in `toEntitlementEntry`: that one also compares rows (`isSameEntitlement`, the writer's coverage), where the lens is deliberately not part of the grant and a mark would make a lensed row and its unlensed twin unequal.
- **A capped delegate is unchanged.** A role-capped token drops its owner's entitlements (the library's `delegate` keeps only the owner's unowned groups when capping), the self-grant included, so it is still not the member and grants nothing below M1.

Situations: `apps/api/src/lib/permissions/memberGrantsBelowItself.test.ts`.

Every added entry goes through this check, whoever writes it and whatever delegate it lands on. A removal does not: it takes administering the record that holds the row (the check each remove route runs on the holder), not the right to grant it, so an admin who manages a member removes what an owner granted that member. On a token that check is `delete` (administering it), not the `create` check its add route runs. Why: taking away never hands on authority, and whoever administers a holder could already remove it whole (Aron, 2026-11-16: "Removal takes slightly fewer permissions than granting. It just takes ownership over the record, not necessarily over the entitlement"). A malformed entry or an anchor that does not exist is 422; a refusal is 403.

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

Grants beyond a role. Each is one row of the `Entitlement` table (`packages/db/prisma/schema/entitlement.prisma`, [DATABASE.md](DATABASE.md#entitlement)): its **source** is the anchor (`sourceModel`, `sourceId`, `sourcePath`), its **target** the holder (a `Token`, `Integration`, `OrganizationUser` or `SpaceUser`), `resource` the model its `actions` apply to, `where` a positive json-rules condition. The grantor is never a column: it is the target's owner, re-walked live. The API speaks rows: a write takes `EntitlementInput` rows (`entitlementInputSchema`: `resource`, `actions: string[]`, `where?`, `sourceModel`, `sourceId`, `sourcePath?`), and every read of a token, integration or member row (single reads, list reads and `/me`) includes its live rows as stored under `targetEntitlements` (`EntitlementScalarSchema`). The library keeps its own words, and one small transformer in `@template/permissions` (`packages/permissions/src/entitlementRows.ts`) moves between the two only where a holder meets the library: `toEntitlementEntry` turns a row into the entry `{ resource, anchor: { resource, id, path? }, where?, actions }`, with no `path` or `where` when the row has none and `actions` as a map; `toEntitlementInput` turns an entry the library hands back (a self-grant) into a row; `entitlementEntriesOfHolder(holder)` gives the well-formed entries a holder's rows grant (`wellFormedEntitlements`, by the library's `entitlementProblem`, dropping entries another one covers). Its callers are `narrowOwnerPermissionsToDelegate` / `fetchPermissionsOfDelegateOwner`, `permissionsOfUser`, `changeEntitlements` (validation and coverage) and the `memberSelfGrant` hook. Why rows: "who holds what on this record?" is a query, and every grant and revocation is its own audit entry. How to write one: [building entitlements](../../packages/permissions/src/rebac/ENTITLEMENTS.md).

### How Entitlements Are Applied

An entitlement applies to a record when all three hold:

- **its anchor is reached along its path**, each polymorphic step being a kind that carries the step's keys;
- **its `where` holds** on the record (positive json-rules; a null check takes an `exists` on its row's key beside it: `all: [id exists, role equals null]`);
- **its owner still allows the action** on that record through the normal walk, so a grant never outlives or outreaches whoever backs it.

The action is checked on the record, never asked of the anchor. Who backs it: for a delegate, its owner's permissions; for a member row, the tenant's owner, except the member self-grant, backed by the member's user.

### Changing Entitlements

Entitlements are read on their holder (every read of a token, integration or member row includes `targetEntitlements`; there is no list route of their own) and change only through the holder's `entitlements` sub-resource, never through a record update, and every change goes through one writer, `changeEntitlements` (`apps/api/src/lib/permissions/changeEntitlements.ts`), inside `db.txn()` and the holder's `entitlements` owner lock:

| Route | Body | Answer |
|---|---|---|
| `POST /{token,integration,organizationUser,spaceUser}/:id/entitlements` | a JSON array of `EntitlementInput` rows | 201, every live row the holder now holds, as stored |
| `DELETE /{token,integration,organizationUser,spaceUser}/:id/entitlements` | a JSON array of `Entitlement` row ids | 204 |

- The writer must be able to change the holder: `validateMemberGrant` (`memberRoleWrite`) on a member row, `validateIntegrationRole` on an integration (plus `manage` at the route), `validateTokenWrite` on a token.
- Every added entry goes through the grant check; a removed row does not, whatever became of its anchor. A removal names rows the holder holds live; any other id is 404 and nothing changes.
- An added entry already covered (`coversEntitlement`) by a row the holder holds with no lens or the same lens is skipped. A held row equal to an added entry but for its lens (no lens counts as one) is replaced: it is removed, through the same removal check, and the entry is added unless another held row covers it. One grant holds one lens ([the lens](../../packages/permissions/src/rebac/ENTITLEMENTS.md#the-lens)). Of equal entries in one write, the last is written.
- Rows are immutable (`immutableFields` refuses a change to any column but the tombstones): a change is a removal plus a grant. A removal is a soft delete, audited per row, as is every created row.
- A member's self-grant can't be removed ([The Member Self-Grant](#the-member-self-grant)); a `full` holder takes none. A holder left with no rows holds nothing ([The Backstop Rules](#the-backstop-rules)).
- The create body of a token or an integration may carry `entitlements`; they are written by the same writer in the same transaction as the row.
- The `entitlement-writer-only` CI rule holds the one-writer line above: a write outside `changeEntitlements` fails, nested writes and `delegate('Entitlement')` included ([SCRIPTS.md § CI Rule Scripts](./SCRIPTS.md#ci-rule-scripts)). A gap in the check is fixed inside the writer, never beside it.

### The Path Names the Anchor and the Axis; the Where Narrows

A polymorphic record carries the ids of everything above it: S1's integration has `organizationId`, I1 has `organizationId` and `userId`. The path names the anchor and the polymorphic axis; the polymorphism registry (`packages/db/src/registries/falsePolymorphism.ts`, passed to the library in `schemaMap`) says which kinds on that axis carry the relation's keys, and an entitlement reaches every one of them. The `where` narrows the kinds.

| Path from an integration | Kinds reached |
|---|---|
| `organization` | the organization's, its spaces', its members', its space members' |
| `space.organization` | its spaces' and space members' |
| `organizationUser.organization` | its members' (including as space members) |
| `user` | the user's, and the user's members' (narrow with `where ownerModel = User`) |

Sides are separate axes: `targetOrganization` reaches what O1 (or its members) received, never what it sent. A self anchor (the entitled record itself) has no path. Only the anchor's id is fixed: a record that moves within the anchor stays reached, one that moves out stops.

### Lenses Keep `id`; Paths Merge by `id`

A holder can be admitted along several delegation paths, each with its own lens (a `where` on the rows, picks and omits on their shape). The holder gets the union of what every path gives, the chimera (Aron, 2026-11-14): each object comes back through every path whose filter admits it, and the projections are merged object by object. Why: extra access from a second grantor has to reach the holder; taking one path's lens, or the intersection, drops what the second grantor gave.

- **A lens never removes `id`.** The `entitlementLens` hook (`apps/api/src/hooks/entitlementLens/hook.ts`), before every `Entitlement` create, runs `validateEntitlementLens` (`apps/api/src/lib/permissions/validateEntitlementLens.ts`). The lens must be a json-rules narrowing over the resource's base lens (`validateNarrowing`; a malformed one is a 422). The base lens comes from a resolver the validator takes (`baseLensOf`, default `lensFor`); an app whose entitlement resources are not all Prisma models passes its own, and a resource the resolver has no base lens for takes no lens (422). No visit it shows may hide `id` on a model whose field map has one (`lensPathsThatDropId`, `packages/permissions/src/lens`, over `projectLens`), and neither may a `mapDefaults` model narrowing, wherever its model is visited. It refuses rather than adding `id`, so a stored lens always says what it shows. Rows are immutable (`immutableFields` refuses a `lens` change), so create is the only way in, and every writer (`changeEntitlements`, factories, a direct create) passes the hook. The rule is template's (and Kingdom's), not json-rules': the `id` convention is ours. Why: with `id` always present, every projection can be matched object by object, and the guard sits once, on the row.
- **`mergeProjections(sourceRows, projections)`** (`packages/permissions/src/lens/mergeProjections.ts`) takes the source rows and each path's `projectRows` output over them, with the path's lens and key. Objects with one `id` become one object holding every key any path kept; a to-one is merged recursively, and every to-many list is merged by its items' `id`, recursively, never by position. A relation present in one projection beats one missing or `null` in another (`projectRows` turns a to-one its filter hides into `null`). Scalars and Json kept by two paths must be equal, and an object without `id` in a model that has one throws. Every list, the root included, follows the source rows' order, so a database `orderBy` and a cursor survive the merge and nothing depends on the order the paths are given in; the result shares no object with its inputs. Why: a plain deep merge pairs list items by index and invents rows (one item's field glued onto another's `id`), and lets a hidden `null` overwrite a shown to-one depending on order.
- **Attribution, not billing.** `attribution` names every path that admitted at least one object in the result. Each is noted as used and never charged; only the routed path's budget is charged, so there is no superset or subset calculation. A path out of budget does not admit (Aron, 2026-11-14: "It's treated as if it doesn't exist"), so the caller leaves it out before projecting, the same as a revoked one. Why: attribution answers who was involved without one provider call becoming several charges.

---

## Adding a Model

1. **Schema entry.** Add `db:<model>` to `rebacSchema.permissions` with its actions. A model owned through `user`/`organization`/`space` relations uses `ownerActions()` (or `ownerActions(['user'])` for a subset); a child of another model walks to its parent (`db:segmentMember` asks the same action of its `segment`). An action may also hold a condition on the record itself: `db:projectIntegrationResource` `create` is `all` of `manage` on the project, `operate` on the resource, and `{ rule: { field: 'integrationResource.status', operator: 'in', value: ['tracked', 'missing'] } }`, so an untracked resource cannot be linked. Build the four standard actions with `chainedStandardActions` so each implies the one below.
2. **Every action is on the record.** Name what a caller does to this model (`create`, `delete`, `send`), never what the model does elsewhere. A create rule goes on the created model and is checked on a pseudo record.
3. **Person-only acts** add `actorIsUser` to their rule. Never use the actor to decide relationships.
4. **Declare deviations.** If the model does not chain all four standard actions, list exactly which links it misses in `notStandard` in `standardActionsChain.test.ts`.
5. **Hydration.** The check walks hydrated to-one relations, and a list only where it is declared ([Crossing a List](#crossing-a-list-down)). `hydrate` (`packages/db/src/hydrate/hydrate.ts`) loads every foreign-key relation of the model, recursively and live rows only, so a new relation is reachable once the Prisma schema has it.
6. **Routes.** A route on the record names its action with `validatePermission(action)`; a create or collection under an owner uses `validateSubmodelPermission(action)`. Checks that need the body run in the controller with the same `check`.
7. **Tests first**, in the situations' own sentences, including attempts to get around the rule (another member's row, a token actor, a lower role, another tenant). Factories only.

---

## Permix

Permix is the permission checker. Each request gets a fresh instance via `prepareRequestMiddleware`.

- `permix.setup(entries, { replace?, owner? })` installs entries: a grant `{ resource, id?, actions }` or an entitlement `{ resource, anchor, where?, actions }`. Entries installed with an `owner` permix hold an action only while that owner still allows it on the record.
- `permix.setActor(actor)` / `permix.getActor()` set and read who is acting.
- `permix.setSuperadmin(value)` turns on the bypass; `installPermissions` sets it from `isSuperadmin(actingUser(c))`.

The engine is `@inixiative/permissions`; `createPermissions` in `packages/permissions/src/client.ts` types it with the app's actions and actor. A check is always `check(permix, rebacSchema, model, record, action)` from `@template/permissions/rebac` on a hydrated record.

---

## REBAC

### Schema

The schema is `rebacSchema` in `packages/permissions/src/rebac/schema.ts`, keyed by resource (`db:user`, `db:organization`, `db:token`, ...), each with its `actions`. Rules shared across models are named helpers in `rebacSchemaRules.ts`:

| Helper | What it says |
|---|---|
| `actorMayPerformActionOnOwner(action, at?, owners?)` | the action on whichever owner `ownerModel` names |
| `ownerModelIsOneOf(owners, at?)` | the record's `ownerModel` is one of these |
| `actorManagesRecordUser(at?)` | `manage` on the record's `user` |
| `memberRowActions(tenant)` | a member row's actions |
| `memberRoleWrite(tenant)`, `memberRemoval(tenant)` | writing a member's role; removing a member |
| `integrationAdministering`, `integrationAccess` | `db:integration`'s `create`, `manage`, `delete`, `delegateFull`; its `operate` and `read` |
| `actionsForRecordOwnedByAnyOwnerModel` | the same by owner kind without `delegateFull`, for a model owned by any of the five owners (`db:project`) |
| `integrationRoleWrite`, `roleHeldAtOwner(at?)` | writing an integration's role; the role on the row held at its owner |
| `actorMayCreateTokenAtOwnerWithRole`, `tokenAdministering` | `db:token`'s `create`; its `read` and `delete` |
| `chainedStandardActions`, `ownerActions(rels?)` | the standard chain; the owner fan-out over it |

`memberRoleWrite`, `memberRemoval` and `integrationRoleWrite` are rules that routes and controllers check, not named actions, so they cannot be granted as entitlements.

### ActionRule Types

| Rule | Meaning | Example |
|------|---------|---------|
| `string` | another action on the same record | `manage: 'own'` |
| `{ rel, action }` | the action on a related record (dot-paths walk further) | `{ rel: 'organization', action: 'own' }` |
| `{ rule: Condition }` | a json-rules condition over the record and the supplied `actor:` rows | `{ rule: { field: 'role', operator: 'in', value: ['owner'] } }` |
| `{ rel, arrayOperator: 'any', condition }` | some item of a declared list passes `condition`, judged on the item ([Crossing a List](#crossing-a-list-down)) | `{ rel: 'participants', arrayOperator: 'any', condition: { rel: 'user', action: 'operate' } }` |
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

### Crossing a List (`down`)

A `{ rel, action }` walk goes up: from a record to a parent it holds the key of. Some rules turn on a child row instead, and the record holds no key to it:

- **Membership.** You may post in a conversation when you are one of its participants.
- **A junction table.** A resource is attached to many projects, and whoever reads one of those projects reads the resource. The role or entitlement stays on the project.

The list arm says "some item passes": `{ rel: '<list field>', arrayOperator: 'any', condition }`, where `condition` is an ActionRule judged on each item as the item's own resource. `any` is the only operator; the others hold on an empty list or count rows, and the library refuses them.

The list is declared on the Prisma field, and the declaration is the load plan:

```prisma
model Resource {
  /// @permissions(down: [project.organization])
  projects ProjectResource[]
}
```

```ts
'db:resource': {
  actions: {
    read: { rel: 'projects', arrayOperator: 'any', condition: { rel: 'project', action: 'read' } },
  },
},
```

- **`down` is a list of dotted to-one paths from an item**, each leaf by its full path (`[a.b, a.c]`). `down: []` loads the items alone.
- **What loads.** Wherever the model is hydrated, the hydrator makes one `loadMany` read of the items, then loads only the declared paths under each. Nothing else loads from an item, so hydration goes one jump down and never back up into the record it came from. Any other to-one relation on an item ends empty.
- **The declaration carries what the rule walks.** Every relation the `condition` walks, followed through the actions it lands on, must be inside a declared path. Above, `project.read` walks on to the organization, so the path is `project.organization`. A shorter declaration is a `validateSchema` error and the check refuses the schema on first use.
- **One jump.** A list arm under an item denies. A list that is not declared is never crossed.
- **Never on a stand-in.** A record that does not exist yet has no list, so a grant that rests on a list is anchored where a real list is (the record itself, or one below it), not above.
- **Wiring.** `createHydrator` needs `loadMany` once any list is declared and refuses to build without it. Add it beside `load` in `packages/db/src/hydrate/hydrate.ts`, reading live rows through the same cache layer. Template declares no list today.

When the record holds the key itself, use a plain `rel`. The library README (`@inixiative/permissions`, "Crossing a list") has the full rules.

### Placing a Field on a Stand-In (`place`)

A grant is checked on a stand-in record before the real one exists. A rule that reads a type field one level down (`resource.kind`) finds it unknown there. Mark the scalar `/// @permissions(place: true)` and a grant whose `where` states `<path>.<field> equals <literal>` builds the stand-in with that value. The condition stays on the row, so it is still judged on the real record at read. Allowed on String, Int, Boolean and enum fields; never on an id, a relation key, a discriminator or a relation. Use it instead of copying the field onto the root model.

`@permissions(...)` takes three keys (`hydrate: false`, `down`, `place`) and is read strictly: a typo throws on first use of the map.

### Dot-path vs. Single-hop Delegation

```typescript
// Single-hop: own on the space, which its organization's own also gives.
// A space owner or an organization owner passes.
{ rel: 'sourceSpace', action: 'own' }

// Dot-path: own on the organization itself. Only an organization owner passes.
{ rel: 'sourceSpace.organization', action: 'own' }
```

In the inquiry schema, `updateSpace` uses single-hop and `transferSpace` uses the dot-path.

### Inquiry permissions

`db:inquiry` is the `inquiryResourcePermission` object `inquiryResourcePermission.ts` builds from `INQUIRY_TYPES`; the schema imports it like any other resource. Each inquiry type declares, in `INQUIRY_TYPES` (`inquiryTypes.ts`), the party models that may stand on each side and the level each needs: `send` for a source, `resolve` for a target. A level is an action of that party model's own resource; `inquiryResourcePermission.test.ts` walks every send, resolve and read rule and fails when a relation, action or field it names, in a plain action or inside a rule-form level, does not exist. A level can instead be a plain rebac rule in the schema's own vocabulary, used as written, for a case one action cannot say: `transferSpace` is `{ rel: 'sourceSpace.organization', action: 'own' }`, and an invite picks `own` or `manage` with `any`/`all` over its role.

- **`read`** is party-wide, whatever the type, each party on its own ownership channel (`INQUIRY_READ_LEVELS`): a person reads the sides that name them (`read` on that user): what belongs to a member, or chains through one, is the member's and never the organization's; `manage` on an organization reads the sides on the organization alone (the side is the organization, or its space and user keys are empty), which includes its own integrations, tokens and projects; an entitlement over what the organization received is granted on the first form (`targetModel equals 'Organization'`), since a rule resting on empty keys is not grantable over many records; `manage` on a space reads the sides on the space with no user. Why: an inquiry carries its delegates' owner keys, so the organization is on every row beneath it; a member's own integration stays the member's and a space's inquiries the space's (Aron, 2026-11-16). See [INQUIRIES.md](INQUIRIES.md#permissions-rebac).
- **`send`** and **`resolve`** are one branch per type, each gated on the type and on the party model, asking the declared action on the relation named for the side and model (`sourceOrganization`, `targetUser`).
- A platform (`admin`) party has no relation, so only a superadmin acts for it.

The API reads the same declarations to check that a create's parties are ones the type accepts (`validateInquiryTypeAcceptsSourceAndTargetModels`).

---

## Owner-Polymorphic Models

Models with nullable foreign keys to several owners (Contact, WebhookSubscription, Segment, Flow) use `ownerActions()`:

```typescript
'db:webhookSubscription': { actions: { ...ownerActions(), create: 'operate' } },
'db:flow': { actions: { ...ownerActions(['user']), create: 'operate' } },
```

For each standard action the helper asks the same action of `user`, `organization` and `space`, chained. Only the populated relation is hydrated, so the others fail and the rule follows the actual owner. Integrations and tokens are owner-polymorphic too but follow their own owner-kind rules ([Integrations and Tokens by Owner Kind](#integrations-and-tokens-by-owner-kind)).

`ownerActions()` reads the `user`, `organization` and `space` relations, so it can't tell a member's row from its tenant's: an OrganizationUser-owned row carries `organizationId` too, and `manage` on the organization would reach it. A model owned by any of the five owner kinds (User, OrganizationUser, Organization, Space, SpaceUser) uses `actionsForRecordOwnedByAnyOwnerModel` instead. It is the integration rules without `delegateFull`, keyed on `ownerModel` ([Integrations](#integrations)): an organization's admin manages its organization's rows but can't reach a member's own; the organization's owner can read and delete a member's row, not change it; only the member manages it.

```typescript
'db:project': { actions: actionsForRecordOwnedByAnyOwnerModel },
```

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
const schemaRule  = schema[model]?.actions[actionOrRule] ?? null;
const rowRule     = record.permissionRules?.[actionOrRule];
const tenantRules = /* each tenant up the owner chain: tenantPermissionRules[model][actionOrRule] */;
const merged: ActionRule = { any: [schemaRule, rowRule, ...tenantRules] };
return check(permix, schema, model, record, merged, visited);
```

A rule that is absent is left out. [Tenant rules](#tenant-rules) come in through the same merge.

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

Use it for opt-in sharing of individual records (sharing a contact, publishing an asset), with a narrow set of overridable actions, typically `read` only. If every row of one tenant needs the same override, it belongs in that tenant's [`tenantPermissionRules`](#tenant-rules). If every row everywhere needs it, it belongs in the schema rule.

---

## Tenant Rules

The schema is code, and every tenant gets the same one. A tenant can add its own ways to qualify for an action, stored as data: `tenantPermissionRules` on `User`, `Organization` and `Space`. It is the tenant's own extension of the schema for the records under it.

**It only widens.** `check()` ORs a tenant's rule with the schema rule, so a tenant can open an action and can never make one stricter. It cannot add an action either: the keys are the resources and actions the schema already has.

**It is not an entitlement.** An entitlement gives one named holder an action. A tenant rule changes what the schema accepts, for anyone who matches it.

### Shape

```prisma
model Organization {
  // ...
  tenantPermissionRules Json?  // Record<Resource, Record<Action, ActionRule>> | null
}
```

```json
{ "db:contact": { "read": true } }
```

Every contact under this organization is now readable by anyone signed in. A rule can be any `ActionRule`: `true`, a relation walk, a json-rules condition on the record and on who is acting, or `any` / `all` of those. Per resource it is the same shape as a row's `permissionRules`.

### Which tenants a record reads

`tenantRowsAbove(record)` (`@template/db`) names them from the hydrated record: its space, then the organization (its own, or the space's). So an organization's rule reaches the records of its spaces, and a space's rule reaches only that space. The id columns say who holds the record: one with `organizationId` or `spaceId` set whose tenant row did not load (a deleted organization) reads no rules, and never falls to its user's.

**A user's rules reach only what no organization or space holds.** A member row, and a project, token or integration a member row owns, carry `userId` too. They belong to the organization, so they read its rules and never the member's personal ones. Otherwise a member could open what they hold for an organization to people outside it.

`tenantPermissionRulesAbove` (`packages/permissions/src/rebac/tenantPermissionRules.ts`) reads each of those rows' rules for the record's resource and hands them, cut to what that tenant's lens shows, to the library as `additionalRules`. The library ORs them in, in the [one merge](#how-check-merges) a row rule uses, for every record a check reaches. The library knows nothing about tenants.

A stored rule the library would refuse (not positive, a loop back to its own action, a read outside the lens) widens nothing. It never throws.

### Writing it

Only the tenant's owner writes it, through one route per tenant, gated on `own`:

- `POST /organization/{id}/setTenantPermissionRules`
- `POST /space/{id}/setTenantPermissionRules`
- `POST /me/setTenantPermissionRules`

The body is `{ tenantPermissionRules }`; `null` clears it. `tenantPermissionRulesSchema(tenantModel)` refuses what the tenant's lens hides ([What a tenant may extend](#what-a-tenant-may-extend)), then validates each resource's rules with `buildPermissionRulesSchema`, the builder a row's `permissionRules` uses: an unknown resource, an unknown action, a rule that is not positive or one that loops back to its own action is a 422.

### Limits to know

- **Lists are authorised once, on a stand-in record** that carries the owner keys and no other column. A rule with no condition on the record opens the list as well as each record. A rule with a condition on the record (`label equals 'public'`) opens the single records that match and leaves the list at 403: the list is not filtered row by row.
- **A null comparison in a rule would open a whole list**, because it holds on the stand-in. The library refuses one in a stored rule from the release that carries the actor model (`permissions` #38). Tenant rules must not ship on a build without it.
- **The frontend does not see tenant rules.** `canActOnRecordIfPresent` checks the record the API returned, which does not carry its tenant rows. The UI can hide an action the API allows.
- **The rules are part of the tenant row.** Whoever can read an organization, space or user row reads its `tenantPermissionRules`.
- **Two stored rules that delegate to each other are both dropped.**

### What a tenant may extend

`tenantPermissionRulesLens(tenantModel)` (`packages/permissions/src/rebac/tenantPermissionRulesLens.ts`) says it, as a json-rules lens over the schema itself: the schema is read as a field map (a resource is a model, an action a column), and the lens turns on the resources and shows the actions a tenant of that kind may extend. `tenantPermissionRulesSchema(tenantModel)` walks every `resource.action` in a body with `walkLensPath` and refuses one the lens hides (422). Why a lens: an app narrows it with the functions it already has (`picks`, `omits`, a layer on top), and layers only get darker.

The default lens:

- **Product records**, from a short list in that file (`resourcesATenantMayExtend`: contacts and segments; an app adds its own below the template line). Why a list: a resource added later is closed until someone turns it on.
- **An organization's spaces, to `read` or `operate` only.** An organization that wants its spaces open says so once: `{ "db:space": { "read": { "rel": "organization", "action": "read" } } }` lets whoever reads the organization read every space (`true` would mean anyone signed in). `operate` makes them a member of each: they read its members and integrations and use its integrations.
- **Never `manage` on a space, and never the rest of the permission system's own**: a member row, a token, an integration, an inquiry, a sign-in provider. An action there is a gate on handing authority on. `manage` on a space is what minting its tokens, writing its members' roles, creating its integrations and resolving its inquiries ask, and rules are read at every row a check walks through, so a `manage` rule would open all of them through the space; a token minted that way would outlive the rule. `read` and `operate` mint no token, write no role and resolve no inquiry: minting a tenant's token takes `manage` ([Minting a Token](#minting-a-token)).
- **Only what the tenant can hold**, read off the tenant columns (`modelsHeldUnderTenant`, beside `tenantRowsAbove`): a space names what has `spaceId`; an organization that and what has `organizationId`, so its tenancy and everything below it; a user what has `userId` and no organization or space is required to hold.
- **Never `own`**, on any resource.

**What a rule on a space reaches beyond the space row.** Everything that asks the space: `read` reads its member rows, its integrations and its webhook subscriptions (URLs included) as well as its records. `operate` also uses the space's integrations (their stored credentials) and creates or changes its webhook subscriptions, which keep delivering after the rule is cleared. Under `operate`, a member below it also creates integrations and projects on their own member row.

**A rule counts as something its reader holds when they grant.** The grant check reads tenant rules too, so whoever a rule covers can put that access on a holder as an entitlement. On a token or an integration it is live only: it stops when the rule is cleared. On a member row it outlasts the rule, because a member row's entitlements are backed by the tenant's owner.

Still open, on purpose: `manage` on a shown resource goes around a lock the schema sets (`"db:contact": { "manage": true }` opens the login-mirror contact), and whoever a rule covers can hand that access to their own tokens as an entitlement. An app that wants less narrows the lens.

The lens applies twice: when the rules are written (a hidden resource or action is a 422), and when they are read (`tenantPermissionRulesAbove` cuts each tenant's stored rules to the actions its lens shows, so a rule stored before the lens narrowed widens nothing).

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
const { submodel, placed } = placeSubmodel(c);
const pseudo = await hydrate(submodel, { id: '', ...placed });
check(permix, rebacSchema, submodel, pseudo, action);
```

- `placeSubmodel` (`apps/api/src/lib/permissions/placeSubmodel.ts`) calls `placeUnder` (the library's, re-exported from `@template/permissions/rebac`), which builds the pseudo record along the owner's relation: the owner keys, the owner attached, the kind narrowed to the owner's model; `id: ''` never matches a grant keyed by a real row.
- It never reads the request body. Checks that depend on the body (a token's role or `full`, an integration's role, an inquiry's `send`) stay in their services.
- Using it on a route with no submodel throws on each request to that route (`validateSubmodelPermission.test.ts`).

Routes that still check an action on the owner (`validatePermission` on spaces, members, inquiries, customer relationships, segments) are not migrated yet.

### Lists under an owner

A model with a five-way owner (`User`, `OrganizationUser`, `Organization`, `Space`, `SpaceUser`; a token also has `Integration`) gets one list per owner kind: `/me/tokens`, `/organizationUser/:id/tokens`, `/organization/:id/tokens`, `/space/:id/tokens`, `/spaceUser/:id/tokens`, `/integration/:id/tokens`. Each tenant and member list returns exactly that owner's rows: an organization's list holds no member's rows. `/me/tokens` is the user's view across tenants: their own tokens and every membership's, each with its `organization`, `organizationUser`, `space` and `spaceUser`.

The controller filters with `submodelOwnerWhere(c)` (`apps/api/src/lib/prisma/submodelOwnerWhere.ts`): the owner keys and kind of the same placement the route's `validateSubmodelPermission('read')` checked. One check on the owner covers every row the list returns, and the two can't drift apart.

```typescript
const { data, pagination } = await paginate(c, db.token, {
  where: submodelOwnerWhere(c),
  omit: { keyHash: true },
});
```

A member's list is read by the member and by the organization's owner, never by an admin or another member (`memberOwnedLists.test.ts`). In the UI, an organization or space page shows two lists: yours there (the membership's) and the tenant's (`tokenContextQueries` / `integrationContextQueries` with `{ ownedByMyMembership: true }`).

### The user as a resource

`/me/*` routes check their action like any other route; `meResourceMiddleware` loads `actingUser(c)` as the resource, typed `user`. `actingUser(c)` is the request's user (a user JWT or a spoof), or the user of a User-owned token; anything else has no me and gets 401.

```typescript
middleware: [validateSubmodelPermission('read')]     // meReadManyContacts, -Integrations, -WebhookSubscriptions, -Tokens
middleware: [validateSubmodelPermission('create')]   // meCreateContact, -Flow, -Integration, -WebhookSubscription
middleware: [validatePermission('read')]             // the other meReadMany*
middleware: [validatePermission('operate')]          // meCreateInquiry, meCreateSegment, meEstimateReachSegment
```

Person-only situations: `apps/api/src/middleware/validations/userOnlyActions.test.ts`, `apps/api/src/lib/context/userActsDirectly.test.ts`.

---

## Frontend Checks

The frontend runs the same ReBAC engine. `permissions.installPermissionsForUser(me)` (`packages/ui/src/store/slices/permissions.ts`) loads the user's own, organization and space permissions from `/me` through `permissionsOfUser`, mirroring the backend setup. A superadmin gets `permix.setSuperadmin(true)` and every check passes.

| Layer | Entry point |
|-------|-------------|
| Route | `validatePermission`, naming the action ([Validation Middleware](#validation-middleware)) |
| Page | `_authenticated.tsx`, `useSyncTenantContextWithUrlAndAuthorizeRoute`, then `findFirstTenantContextThatCanOpenPath`: the nav item's `access` decides "can view"; on failure it falls back to the org (from a space), then user, then public context, else renders `Unauthorized` |
| Nav item | `access(permissions, context, page?)` on `NavItem`; the Sidebar hides items that fail it |
| Component | `canActOnRecordIfPresent(permissions, model, record, action)` / `permissions.check(model, record, action)` |

**Check:**

```typescript
import { canActOnRecordIfPresent } from '@template/ui/lib/canActOnRecordIfPresent';

const permissions = useAppStore((state) => state.permissions);
const canDelete = canActOnRecordIfPresent(permissions, 'organization', org, 'own');  // false when record is missing
```

**Visibility.** `Button` takes `show?: boolean | (() => boolean)` and `disabledText` (setting it disables the button and replaces its text):

```typescript
<Button show={canActOnRecordIfPresent(permissions, 'organization', org, 'own')}>Delete</Button>
```

**Nav access** (`apps/*/app/config/nav/features/*.ts`):

```typescript
export const settingsItem: NavItem = {
  label: 'Settings',
  path: '/settings',
  access: (permissions, context) => permissions.check(...permissionCheckTargetForTenantContext(context), 'read'),
  items: [
    {
      label: 'Auth Providers',
      path: '/authProviders',
      access: (permissions, context) =>
        !!context.organization && permissions.check(...permissionCheckTargetForTenantContext(context), 'own'),
    },
  ],
};
```

`permissionCheckTargetForTenantContext(context)` returns `[model, record]` for the current tenant context (organization, space, or the user).

**useCanActOnInquiry(inquiry, action, side)** fills the current context into the inquiry's source or target side, then checks `inquiryResourcePermission`.

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
  members         GroupMember[]
}

model GroupMember {
  groupId  String
  userId   String
}
```

Use cases:
- assign a role and entitlements to many users at once (a `Group` would be one more `Entitlement` target);
- an "Engineering" group gets the `member` role plus an entitlement to manage one space.
