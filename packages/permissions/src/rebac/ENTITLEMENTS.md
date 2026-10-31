# Building entitlements

An entitlement is a named grant on a holder: a member row, a token or an integration. It holds the actions it names on a resource, from an anchor, and nothing else. What it lets the holder do beyond those names comes from the schema's action chains, so the chains have to be right for entitlements to work. The system around it (who holds what, full, owner kinds) is in [docs/claude/PERMISSIONS.md](../../../../docs/claude/PERMISSIONS.md).

The examples use one cast: user U1, organization O1, space S1 under O1, M1 U1's member row in O1, I1 an integration owned by M1, T a token.

## The shape

```ts
{
  resource: 'db:integration',                                         // what it acts on
  anchor: { resource: 'db:organization', id: O1, path: 'organization' }, // where it acts from
  where: { field: 'ownerModel', operator: 'equals', value: 'Organization' }, // optional narrowing
  actions: { manage: true },                                          // what it holds
}
```

- **`resource`** is the model the action is checked on. The action is always checked on that record, never asked of the anchor.
- **`anchor`** is the record the entitlement acts from. `path` names the relations from the entitled record up to the anchor, following the Prisma relation names (`'organization'`, `'space.organization'`, `'user'`). A record anchored at itself has no `path`. Only the anchor's id is fixed: a record that moves inside the anchor stays reached, one that moves out stops.
- **`where`** is a positive json-rules condition over the record: no negation, `isEmpty`, `notExists`, `if`/`then`/`else`, array or aggregate rule. "No value" is `equals null`. A single row is `where: { field: 'id', … }`, never an `id` beside the anchor.
- **`actions`** are booleans. Stored entries are pruned to the well-formed ones whenever they are read, and an entry another one already covers is dropped.

## Writing one

Choose, in order:

1. **The resource and the action.** What should the holder do, to what? "Administer O1's own integrations" is `manage` on `db:integration`.
2. **The anchor and the path.** Where does it act from? O1, reached from an integration by `organization`. A polymorphic step reaches every kind that carries its keys: from an integration, `organization` reaches O1's own integrations, its spaces', its members' and its space members'.
3. **The `where`, to narrow.** `ownerModel equals Organization` keeps only O1's own. Only a literal leaf on the kind field, at the root or directly under a root `all`, narrows what the grant check judges; anything else narrows at read time only.

Examples:

```ts
// T on M1 acts as M1: operate on M1 itself (self anchor, no path)
{ resource: 'db:organizationUser', anchor: { resource: 'db:organizationUser', id: M1 }, actions: { operate: true } }

// M1 manages S1
{ resource: 'db:space', anchor: { resource: 'db:space', id: S1 }, actions: { manage: true } }

// O1's own integrations, managed
{
  resource: 'db:integration',
  anchor: { resource: 'db:organization', id: O1, path: 'organization' },
  where: { field: 'ownerModel', operator: 'equals', value: 'Organization' },
  actions: { manage: true },
}

// the member self-grant on M1: written by the memberSelfGrant hook, never by hand
{
  resource: 'db:organizationUser',
  anchor: { resource: 'db:user', id: U1, path: 'user' },
  where: { field: 'id', operator: 'equals', value: M1 },
  actions: { operate: true },
}
```

## Who backs it

Every entitlement is installed with an owner, and holds an action on a record only while that owner, walked through the normal schema from that very record, still allows the action. That is what keeps an entitlement inside its grantor's tenant, live:

- on a token or an integration, the owner is the delegate's owner table;
- on a member row, the owner is the tenant's owner grant (`own` on O1 for M1);
- the member self-grant alone is backed by the member's user, and only the exact entry for that row.

## Granting one

Entitlements change only through their own endpoints (`PATCH …/:id/entitlements`, body `{ add, remove }`), and every added entry, and every removed entry that matches a stored one, is one check: `placeEntitlement` builds a pseudo record per kind the entry reaches, and `canGrantEntitlement` asks, on each, whether the writer's role table takes every action, or else whether the entry is a copy of one entitlement the writer holds, with actions lowered through the chain and its `where` copied or narrowed. Held entitlements never combine. A person-only action (`create` on a token, `delegateFull`) is never grantable: the grant check runs with no actor.

## The standard chain

Roles hand out the four standard actions: `read`, `operate`, `manage`, `own`. On every resource that defines them, each one is implied by the next one up on the same resource, so holding `own` is holding everything below it there, by table or by entitlement. Build them with `chainedStandardActions` (`schemaHelpers.ts`); `ownerActions` already does.

```ts
chainedStandardActions({ own, manage, operate, read })
// own:     own
// manage:  { any: ['own', manage] }
// operate: { any: ['manage', operate] }
// read:    { any: ['operate', read] }
```

A rule that only walks to the owner for the same action (`{ rel: 'organization', action: 'operate' }` alone) is not a chain: an entitlement holding `own` on the record is never asked for `operate`.

## What the chain is used for

- **Reading.** An entitlement answers every action its held action implies through the chain, while whoever backs it can still do that action: a `manage` entitlement whose backer is down to `read` still reads. Every side of a cross-tenant chain is asked the same action.
- **Lowering.** Whoever holds an entitlement can pass on a copy with lower actions: each granted action must reach a held one through the chain.
- **Capping.** A delegate holds its owner's role entries capped at its own role (`capAtRole`), never its owner's entitlements: those it holds only when given them, or when it is `full`.
- **Copying.** A copy, or a copy with a narrower `where`, is checked against what the holder holds through the same chain.

## Models that are not standard

Not every model has all four, and not every model chains all of them. Each is declared in `notStandard` in `standardActionsChain.test.ts` with the exact links it misses; any undeclared gap fails that test.

- **Member rows** (`db:organizationUser`, `db:spaceUser`): `operate` is being the member and `manage`/`own` administer the row, so `manage` and `own` do not imply `operate`. An entitlement holding `manage` on M1 does not act as M1.
- **Integrations** have no `own`. `read`, `operate` and `manage` chain; who holds them depends on the integration's owner kind.
- **Contacts** (`db:contact`): `manage` also requires the contact's `source`, so it does not chain past `manage`.

## Non-standard actions

`create`, `delete`, `leave`, `delegateFull`, `send`, `resolve`, `user.redact` and the like are not part of the chain. They delegate only where their rule says so (`delete: { any: ['manage', …] }`). To give one to a holder, grant it explicitly.
