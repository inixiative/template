# INFRA-026: compile the permission algebra to a query (row-level authorization)

**Status**: 🆕 Not Started — problem framing + direction; big lift, mechanism not chosen.
**Assignee**: Aron
**Priority**: Medium (ambitious; the payoff is query-level authz that scales)
**Created**: 2026-07-02
**Updated**: 2026-07-02

`@inixiative/permissions` today only **evaluates** — `check(permix, schema, subject, action)` walks a hydrated object graph for one record and returns allow/deny. To answer *"which records can this actor `<action>`?"* you must fetch candidates and `check()` each. This ticket is to **compile** the permission algebra to a query predicate — a Prisma/SQL `WHERE` that selects exactly the authorized rows — so authorization becomes indexable, paginatable, and one round-trip, the same way json-rules compiles a rule to `toPrisma`/`toSql`. This is the authorization analogue of "author once, run three ways," and it's what makes authz scale (no fetch-all-then-filter).

## What already compiles vs. what's hard

The abac half is largely done — the `{ rule }` arm is json-rules, and the lens already compiles a scoping `where`. The rebac arms are eval-only. Compilability, arm by arm:

- **`{ self: field }`** → `field = :actorId`. Trivial.
- **`{ rule }` (abac)** → json-rules `toPrisma`/`toSql` (already exists via the lens). Reuse it.
- **`any` / `all`** → `OR` / `AND` of compiled arms. Clean — the algebra is monotone (no negation), so the compiled predicate is a straight union/intersection.
- **`true` / `false` / `null`** → `TRUE` / `FALSE`. Trivial.
- **string delegation** → recurse into the schema's rule for that action and compile it. Fine, but needs a **compile-time cycle guard** (distinct from the eval's WeakMap-on-records — here it's a visited set on `resource:action`).
- **`{ rel, action }` (intra-map relation walk)** → a **nested relation filter**: `related: { <compiled action> }` (Prisma `is`/`some`). This is the crux — a to-one hop is `is`, a to-many is `some`, and `{ self }` at the leaf resolves to `field = :actorId` inside the nesting. Compilable, but this is where the real work is.
- **bridges (cross-map hops)** → the hard boundary. A bridge crosses maps/data sources, so the far side may live in a different DB and can't be a single nested filter. This is the natural **degradation point**: resolve the far ids first (a small prefetch) and filter on them, or fall back to `check()` for that hop — mirroring INFRA-025's relative-ops degradation. Bridged authz can't be one query anyway.

## Payoff

Query-level authorization / row-level security: *"list the documents this user can edit, page 2, ordered by updatedAt"* becomes one indexable query instead of fetch-all-then-`check()`-each. It composes with the lens's tenant `where`, and it's the piece that makes authorization scale past small candidate sets.

## Open questions

1. **Boundary with json-rules** — permissions stays ORM-free (it *describes*, an executor runs). Does it emit a compile IR that json-rules' `toPrisma` consumes, or grow its own compiler reusing json-rules' primitives? The abac arm should not be re-implemented.
2. **rel-walk → nested filter** — depth, and how `{ self }` at a leaf threads the actor id through the nesting cleanly.
3. **Bridges** — accept the cross-map degradation (prefetch far ids / `check()`-fallback), since a bridged grant can't be one query. Where exactly does the compiler signal "this hop is not compilable" (like `toSql`'s `sql: null` + `error`)?
4. **Per-record `permissionRules` overrides** — the row-level additive grants: do they compile (an `OR` with the row's stored rule) or stay eval-only? They're the one part that's data-dependent per row.
5. **Cycle handling at compile time** vs. the eval's object-identity WeakMap.

## Not in scope

- Replacing the eval — `check()` stays for per-record decisions and the hydrated-graph path; this *adds* a compile path.
- Bridge cross-map exactness — accept degradation there.
- Choosing the mechanism — becomes a `FEAT-*` in permissions (+ maybe json-rules) once a direction is picked.

## Related

- **json-rules** — `toPrisma`/`toSql` + the lens `where` compilation (the abac arm this reuses).
- **INFRA-025** — compile json-rules' relative operators to the query layer; same "compile more, degrade at the bridge" theme and the same degradation boundary.
- **`@inixiative/permissions`** — the algebra being compiled.
