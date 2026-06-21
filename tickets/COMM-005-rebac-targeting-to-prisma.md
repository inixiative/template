# COMM-005: inScope — permission check → Prisma (delivery gate ①)

**Status**: 📋 Proposed — deferred, `@wip` stub in place
**Priority**: Medium
**Created**: 2026-06-20

---

## The model

Recipients resolve in two layers:

- **recipient lens (json-rules)** → the high-level **targets**: which org/space scopes the
  communication goes to.
- **gate ① `inScope`** → decomposes those targets into their **constituent users**, by a
  **permission check** evaluated within the targeted scopes (e.g. "admin or above").

`inScope` is *any permission check over the candidates*. Where the check maps to the DB (role, in-DB
relations) it **serializes to a Prisma `where`** and resolves the set in one query. But predicates are
**lenses (json-rules), which can bridge data sources** — they may reference data outside a single
query, so the general case still needs a **per-candidate evaluation loop**. Push down what serializes,
loop the rest. Role is the trivially-serializable first slice.

Designed in [COMM-003](./COMM-003-sender-and-communication-log.md) §1b as gate ①.

## Today

Pass-through stub: `apps/api/src/lib/messaging/inScope.ts` returns `true` for everyone, marked `@wip`.
Its signature is a placeholder and will **change**: today it's per-recipient
(`inScope(recipientUserId, entity) → bool`); the real thing is set-resolving
(`inScope(targets, check) → where / userIds`) — "resolve the set," not "test one."

## Direction (decided)

`inScope` evaluates a predicate over the candidate users in the targeted scopes, with two strategies
used together:

1. **Serialize to Prisma (push-down).** When the predicate maps to columns/relations in the DB, compile
   it to a `where` and resolve the set in **one query**. The role MVP lives here: a role floor
   ("admin or above") resolves the ladder to a role set at compile time (the permissions package owns
   the ordering via `lesserRole`) → `{ organizationUsers: { some: { organizationId: { in: targets }, role: { in: [...atOrAbove] } } } }`.
   Roles are columns → direct.
2. **Per-candidate predicate loop (general).** Predicates are lenses (json-rules) and **can bridge data
   sources** — they may reference data outside a single query, so they can't always be pushed to SQL.
   For those, resolve the candidate set first, then evaluate the predicate per candidate. This is the
   correct general evaluator, not a fallback to avoid.

So: push down what serializes, loop-evaluate the rest. Start with the role MVP (pure push-down); the
loop comes in the moment a predicate bridges sources. The general rebac → Prisma compiler is the
push-down path's rich end — reusable for every "list what I can access" surface; biggest lift, build
when a consumer needs beyond-role scoping.

Must stay in lockstep with the rebac schema. Do not build interim bypasses before there's a consumer
that needs the filter.

## Rejected

- **Zanzibar-style relation tuples** (materialize `(subject, relation, object)` rows) — its own
  subsystem + sync; not warranted for this.
