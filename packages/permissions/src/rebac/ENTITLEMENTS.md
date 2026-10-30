# Building entitlements: action chains

An entitlement holds the actions it names on a resource, from an anchor. What it lets the holder do beyond those names comes from the schema's action chains, so the chains have to be right for entitlements to work.

## The standard chain

Roles hand out the four standard actions: `read` ← `operate` ← `manage` ← `own`. On every resource that defines them, each one delegates to the next one up on the same resource, so holding `own` is holding everything below it there — by table or by entitlement. Build them with `chainedStandardActions` (`schemaHelpers.ts`); `ownerActions` already does.

```ts
chainedStandardActions({ own, manage, operate, read })
// own: own
// manage:  { any: ['own', manage] }
// operate: { any: ['manage', operate] }
// read:    { any: ['operate', read] }
```

A rule that only walks to the owner for the same action (`{ rel: 'organization', action: 'operate' }` alone) is not a chain: an entitlement holding `own` on the record is never asked for `operate`.

## What the chain is used for

- **Reading.** An entitlement answers every action its held action implies through the chain, while whoever granted it can still do that action: a `manage` entitlement whose granter is down to `read` still reads. Every side of a cross-tenant chain is asked the same action.
- **Lowering.** Whoever holds an entitlement can pass on a copy with lower actions: each granted action must reach a held one through the chain.
- **Capping.** A delegate (token, integration) holds its owner's role capped at its own role (`capAtRole`), never its owner's entitlements: those it holds only when given them, or when it is `full`.
- **Copying.** A copy, or a copy with a narrower `where`, is checked against what the holder holds through the same chain.

## Models that are not standard

Not every model has all four, and not every model chains all of them. A model that gates a standard action on more than the action above it — `db:contact`'s `manage` also requires the contact's `source` — does not chain past that action. Declare it in `notStandard` in `standardActionsChain.test.ts` with the exact links it misses; any undeclared gap fails that test.

## Non-standard actions

`send`, `resolve`, `delete`, `token.create` and the like are not part of the chain. They delegate only where their rule says so (`delete: { any: ['manage', …] }`). To give one to a delegate, grant it explicitly.
