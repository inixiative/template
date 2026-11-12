# INFRA-026: compile the permission algebra to a query (row-level authorization)

**Status**: 🆕 Not Started — direction set, mechanism not chosen. Target: `@inixiative/permissions` 1.0.
**Assignee**: Aron
**Priority**: Medium (ambitious; the payoff is query-level authz that scales)
**Created**: 2026-07-02
**Updated**: 2026-10-31

`@inixiative/permissions` today only **evaluates** — `check(permix, schema, subject, action)` walks a hydrated object graph for one record and returns allow/deny. To answer *"which records can this actor `<action>`?"* you must fetch candidates and `check()` each. This ticket is to **compile** the permission algebra to a query predicate — a Prisma/SQL `WHERE` that selects exactly the authorized rows — so authorization becomes indexable, paginatable, and one round-trip, the same way json-rules compiles a rule to `toPrisma`/`toSql`. This is the authorization analogue of "author once, run three ways," and it's what makes authz scale (no fetch-all-then-filter).

## Why it compiles

The permission algebra is positive: a rule can only widen, and the things Prisma and SQL can't express cleanly are already refused in permission rules. A permission `{ rule }` and an entitlement `where` must be positive json-rules (`validateRule(..., { positive: true })`): no negation, no `isEmpty` or `notExists`, no `if`/`then`/`else`, no array or aggregate rules. So most of the algebra maps straight onto a query. It won't be perfect (bridges and per-row rules below), but for the most part a rule compiles to Prisma and to SQL, the two targets json-rules already has.

## Compilability, part by part

- **`{ rule }` (a condition)** → json-rules `toPrisma` / `toSql`. Reuse it; don't re-implement it.
- **`__actor` inside a condition** → the actor is known when the query is built, so its fields become constants before compiling.
- **`any` / `all`** → `OR` / `AND` of the compiled parts. Clean, because the algebra has no negation.
- **`true` / `false` / `null`** → `TRUE` / `FALSE`.
- **string delegation** → recurse into the schema's rule for that action. Needs a compile-time cycle guard: a visited set on `resource:action`.
- **role grants (the permix table)** → a grant on the whole resource is `TRUE`; grants on records are `id IN (...)`.
- **`{ rel, action }` (relation walk)** → a nested relation filter: to-one is `is`, to-many is `some`, with the target action compiled inside. This is where the real work is.
- **entitlements** → per entitlement, the record's `path` to its anchor equals the anchor id, `AND` its `where`, `AND` the owner still allows the action on the record (the owner's own permissions compiled the same way, recursively). `OR` across entitlements.
- **bridges (cross-map hops)** → the hard boundary. The far side may live in another database, so it can't be one nested filter. Degrade there: prefetch the far ids and filter on them, or fall back to `check()` for that hop, mirroring INFRA-025.

## Payoff

Query-level authorization / row-level security: *"list the documents this user can edit, page 2, ordered by updatedAt"* becomes one indexable query instead of fetch-all-then-`check()`-each. It composes with the lens's tenant `where`, and it's the piece that makes authorization scale past small candidate sets.

The same compiled rules answer the reverse question too, *"who can read this record?"*, which recipient targeting (COMM-005) and audits need. And because tenants' rules are stored data, every rule a tenant has already written gains both answers without new code. Unlocks: AUTH-008 (collections filtered by what you can read), COMM-005 (recipients), FEAT-008 (permissions builder previews at scale).

## Open questions

1. **Boundary with json-rules** — permissions stays ORM-free (it *describes*, an executor runs). Does it emit a compile IR that json-rules' `toPrisma` consumes, or grow its own compiler reusing json-rules' primitives? The abac arm should not be re-implemented.
2. **rel-walk → nested filter** — depth, and how the actor's constants and the grants' ids thread through the nesting cleanly.
3. **Bridges** — accept the cross-map degradation (prefetch far ids / `check()`-fallback), since a bridged grant can't be one query. Where exactly does the compiler signal "this hop is not compilable" (like `toSql`'s `sql: null` + `error`)?
4. **Per-record `permissionRules` overrides** — the row-level additive grants: do they compile (an `OR` with the row's stored rule) or stay eval-only? They're the one part that's data-dependent per row.
5. **Cycle handling at compile time** vs. the eval's object-identity WeakMap.
6. **Negation in schema rules.** Tentative ruling (Aron, 2026-10-31): schema rules may negate (e.g. "not your own login contact"); stored rules must be positive. "If we end up needing to make this a harder rule for the condition to Prisma chain, maybe we'll do it there." Decide when compiling: does a negated schema condition compile cleanly, or must schemas go positive too?

## Not in scope

- Replacing the eval — `check()` stays for per-record decisions and the hydrated-graph path; this *adds* a compile path.
- Bridge cross-map exactness — accept degradation there.
- Choosing the mechanism — becomes a `FEAT-*` in permissions (+ maybe json-rules) once a direction is picked.

## Related

- **json-rules** — `toPrisma`/`toSql` + the lens `where` compilation (the abac arm this reuses).
- **AUTH-008**, **COMM-005**, **FEAT-008** — the consumers.
- **INFRA-025** — compile json-rules' relative operators to the query layer; same "compile more, degrade at the bridge" theme and the same degradation boundary.
- **`@inixiative/permissions`** — the algebra being compiled.
