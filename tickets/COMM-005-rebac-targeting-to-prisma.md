# COMM-005: Rebac Targeting → Prisma (delivery gate ①)

**Status**: 📋 Proposed — deferred, stub in place
**Priority**: Medium
**Created**: 2026-06-20

---

## The gap

Delivery **gate ①** (scope) answers: *which users are in scope for a communication about
entity X?* — the read-access filter that drops recipients who can't see the entity. Today this is a
pass-through stub: `apps/api/src/lib/messaging/inScope.ts` returns `true` for everyone. The real
check is the inverse of `check(permix, …)` (one actor, one resource) — we need the **set** of
eligible users, ideally as a query, not N per-recipient permix builds inside a large fan-out.

Designed in [COMM-003](./COMM-003-sender-and-communication-log.md) §1b as gate ①.

## Why it's postponed

A general **permissions → Prisma** translation (compile rebac rules into a `where` clause) is genuinely
complex and must stay in lockstep with the rebac schema. Not worth building speculatively. The stub is
honest (the socket exists; `inScope` is where it plugs in).

## Options (when we build it)

- **MVP — role-based.** Filter recipients by role on the relevant org/space (no full rebac
  compilation). Covers the common "notify members with role ≥ X" case. Smallest lift; likely where we
  start.
- **(A) Per-actor check loop.** Build a permix per recipient, run `check(...)`. Correct but N
  builds/queries per send; needs `setup{User,Org,Space}Permissions` made context-free for the worker.
- **(B) Permissions → Prisma `where` compiler.** Translate rebac relations into a Prisma filter — one
  query, scales to the fan-out, and reusable for every "list what I can access" surface. The real
  primitive; biggest lift.
- **(C) Zanzibar-style relation tuples.** Materialize `(subject, relation, object)` rows and query
  them. Scales hardest; its own subsystem + sync.

## Direction

Leave the `inScope` stub. When recipient scoping becomes a real requirement, start with **role-based (MVP)**
and only graduate to (B) if the fan-out scale or "list-what-I-can-access" reuse justifies the compiler.
Do not build interim bypasses before there's a consumer that needs the filter.
