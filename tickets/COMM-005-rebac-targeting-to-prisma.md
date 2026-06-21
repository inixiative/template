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

`inScope` resolves constituents as a **narrow-then-evaluate** pipeline. The serializable part of the
check (role, in-DB relations) compiles to a Prisma `where` that **narrows** the candidate set; the rest
of the predicate — lenses (json-rules) **can bridge data sources** and won't all push to SQL — is then
**evaluated over the narrowed set**, where small N keeps it performant. The Prisma narrow is what makes
the predicate loop cheap. Role is the trivially-serializable first slice (narrow only, no loop).

Designed in [COMM-003](./COMM-003-sender-and-communication-log.md) §1b as gate ①.

## Today

Pass-through stub: `apps/api/src/lib/messaging/inScope.ts` returns `true` for everyone, marked `@wip`.
Its signature is a placeholder and will **change**: today it's per-recipient
(`inScope(recipientUserId, entity) → bool`); the real thing is set-resolving
(`inScope(targets, check) → where / userIds`) — "resolve the set," not "test one."

## Direction (decided)

`inScope` resolves the constituents as a **narrow-then-evaluate** pipeline:

1. **Narrow with a Prisma `where`.** Push down everything serializable — role, in-DB relations — into
   one query to cut the candidate set down. The role MVP is the degenerate case: the narrow *is* the
   whole answer, no step 2. ("admin or above" → role set → `{ organizationUsers: { some: { organizationId: { in: targets }, role: { in: [...atOrAbove] } } } }`;
   the permissions package owns the ladder ordering via `lesserRole`.)
2. **Evaluate the predicate on the narrowed set.** Predicates are lenses (json-rules) and can bridge
   data sources, so the cross-source parts can't be pushed to SQL — but run against the small,
   pre-narrowed candidate set they stay **performant** (small N, not the whole org). The narrow is
   exactly what makes the loop cheap.

The general rebac → Prisma compiler is the rich end of the narrow step — reusable for every
"list what I can access" surface; biggest lift, build when a consumer needs beyond-role scoping.

Must stay in lockstep with the rebac schema. Do not build interim bypasses before there's a consumer
that needs the filter.

## Rejected

- **Zanzibar-style relation tuples** (materialize `(subject, relation, object)` rows) — its own
  subsystem + sync; not warranted for this.
