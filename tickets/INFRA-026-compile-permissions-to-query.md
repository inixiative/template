# INFRA-026: compile the permission algebra to a query (row-level authorization)

**Status**: 🆕 Not Started — direction set, mechanism not chosen. Target: `@inixiative/permissions` 1.0.
**Assignee**: Aron
**Priority**: Medium (ambitious; the payoff is query-level authz that scales)
**Created**: 2026-07-02
**Updated**: 2026-11-20

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

## Another reflection to consider: hydrate only what the checked action reads

Added 2026-11-19 (Aron: "this is another type of reflection that we might want to consider"). A note, not a commitment. Full text and open questions: `inixiative/permissions` issue #39.

`createHydrator` takes a resource and a record, with neither the actor nor the action. It loads every to-one of every row it reaches and every list declared `/// @permissions(down: [...])`, wherever that model is hydrated. That is deliberate (the README: "hydration does not know which check comes next"), and it has a cost, seen in Zealot's move to permissions 0.23 (`Conversation.participants` on the list arm):

- A check whose rule never reads the list still loads it. A `manage` check to rename a conversation loads every participant and the rows under each.
- A list arm that asks "is the actor one of the items" loads the whole list to find one item. Measured locally on 2026-11-19: one query plus two cache reads per participant on every check (102 reads at 50 participants).

The rules are data, so the library can read from an action's rule what the check needs loaded:

- **Hydrate what the action reads.** Given the resource and the action, load only the relations and lists its rule reaches, through the actions it delegates to.
- **Narrow a list arm by its own condition.** With the actor bound, the arm's `condition` compiles to a filter on the items: the same mapping as "relation walk → nested relation filter" above, applied to one list of one record. Nothing is declared twice. An annotation naming the membership key was rejected: it restates the rule, and it silently changes what the hydrated list means to any other rule.
- **A generated type for a hydrated record**, from the schema map and its `down` declarations, so a consumer that reads the hydrated record after the check does not hand-write its shape. The generated map holds `down` as literal types; `SchemaMap` widens them before the library sees them.

Why it matters: the cost of every check on that resource, and on records below it, grows with the length of the list. For large lists a consumer has a route that needs nothing from the library: a grant installed from the membership row, for an action only a grant gives (Zealot's `forumGroup.member`).

**Landed since (permissions #40, 2026-11-20):** `load` is given `down` (the resource's declared lists and the paths under each) and returns the row with them, so a list is part of its parent's row and is read once with it; `loadMany` is gone, and `prismaIncludeOfDown` turns `down` into a Prisma `include`. The per-row reads above no longer happen; a check still loads the list whether or not its rule reads it.

### More than one jump down

A note, not a plan (Aron, 2026-11-20: "I'm not saying we need to build it now, but I think there's nothing really preventing this... it's usually not probably the right way of approaching it, but we should leave the note"). A declared list may cross one list today: each segment of a `down` path is a to-one. What a second list under an item would take:

- **Already there:** the `down` value nests (`{ participants: { forumUser: { memberships: { group: {} } } } }`), and `prismaIncludeOfDown` gives a nested include Prisma accepts. It fans out: items times nested items, counted against the row budget.
- **Needs the map to say which segment is a list and which a to-one** (Aron: "a little bit of schema map awareness"): the declaration reader refuses a list segment today.
- **Needs the engine:** a list arm met under an item denies by design, so the rule form for "some item of some item", the lens at a list item and schema validation all change with it.
- **Open:** which item a grant held on a nested item is judged on, and how paths are reported; whether "a list never passes on a stand-in record" still holds at both levels; cache clears that reach back through two lists.

Why it has not been needed: permissions walk up, so "some member of some team of this project" is usually one jump when asked at the team; and a large fan-out wants a grant installed from the membership row, which loads no list.

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

## Tenant permission rules make the predicate differ per tenant

Added 2026-11-21 (Aron, reviewing template #315: "This is going to be very hard to reflect, isn't it? We should make a note to the reflection tool that this is going to be a complication that's actually really challenging."). A note, not a plan.

Everything above compiles rules that are known when the query is built: the schema's rules and the actor. Tenant permission rules (`docs/claude/PERMISSIONS.md` § Tenant Rules) are stored on the User, Organization and Space rows, and `check()` ORs them in at every row a walk passes through. So the rule for `contact.read` is not one rule; it is the schema's rule OR whatever the record's own organization and space have stored, and those are only known once you know which tenant the row is under.

What that does to each part:

- **One list inside one tenant** (the common case: an organization's contacts) is fine. Load that tenant's rows first, cut their rules by the lens (`actionsTenantMayExtend`), and compile them as extra `OR` branches.
- **A list across tenants** (a user's records over all their organizations, a superadmin list) needs one branch per tenant: `organizationId = X AND (X's rules)`. The predicate grows with the number of tenants that have stored rules, and the tenants have to be found before the query is built.
- **Relation walks.** A `{ rel, action }` walk consults the tenant rules of the row it lands on, not only of the starting record. A nested relation filter cannot read a JSON column of the far row and compile it mid-query, so every tenant the walk could land in has to be loaded and compiled ahead.
- **The reverse question** ("who can read this record?") has to include whoever the record's tenants' rules admit, on top of roles and entitlements.
- **Caching the compiled predicate** now depends on the tenant rows: a write to `tenantPermissionRules` has to clear it.

Possible routes, none chosen: compile per tenant and `OR` the branches where the tenant set is small and known; fall back to `check()` per row for a tenant that has stored rules (as bridges do); or materialise a tenant's rules into rows the query can join.
