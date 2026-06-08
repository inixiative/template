# FEAT-018: `@inixiative/transitions` — declarative transition guard + affordance layer

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-08
**Updated**: 2026-06-08

---

## Overview

A small, **stateless** primitive on top of `@inixiative/json-rules` that answers two
questions about an entity's lifecycle, declaratively:

- **"Can this change happen?"** — guard a proposed update.
- **"What changes can happen?"** — list available transitions for a record (and, via
  `toPrisma`, every record currently eligible for a transition).

It is **not** a state machine (no statecharts/actors/hierarchy), does **not** own state,
and does **not** execute the change or run side effects (that stays in the hooks pipeline).
It is a guard + affordance layer. Depends on json-rules; does **not** live inside it
(json-rules = predicates + `toPrisma`; transitions = before/after + merge + registry).

The unlock: a transition is **pure data** → serializable → **tenant-configurable at runtime**
(stored in the DB, edited in a UI, no deploy to change a lifecycle).

## Shape

```ts
type Side = {
  predicate: Condition;   // json-rules
  requires?: Include;     // Prisma-include-shaped; relations the predicate reads (metadata)
};

type Merge =
  | ((record, changes) => next)              // code callers: full power, NOT serializable
  | MergeStrategy;                           // serializable keyword (see below)

type Transition = {
  from: Side;                                // evaluated against the CURRENT record
  to:   Side & { merge?: Merge };            // evaluated against the RESULTING record
};
```

- `from`/`to` share a shape; the asymmetry (current vs resulting record) is load-bearing —
  make it loud in types/docs.
- `merge` lives on `to` (it produces the resulting state). Default `spread`.

### Merge strategies (Mongo-flavored, serializable)
Hybrid: a raw callback is allowed for code callers; serialized/customer configs must use a
keyword strategy. Provide an `isSerializable(transition)` check so callers know whether a
given transition can be persisted/tenant-configured.

- `spread` (≈ `$set`, default) — shallow overwrite
- `deepMerge` (≈ `$merge`)
- `{ kind: 'append', path }` (≈ `$push`) — array concat (field-scoped → needs a path)
- `{ kind: 'appendUnique', path }` (≈ `$addToSet`) — concat + dedupe

> Gotcha: array strategies are **field-scoped** — `{ kind, path }`, not a bare keyword.

## Kernel (pure, ORM-agnostic, ~tiny)

```ts
check(t, record, changes) =>
  t.from.predicate(record) && t.to.predicate(applyMerge(t.to.merge, record, changes))
  → { ok: boolean; reason?: 'no-from' | 'no-to' }
```

Return a **reason**, not a bare bool, so callers can surface "can't reach `connected` from
`disconnected`".

## Duality (why it earns a package)

Every `from.predicate` is also a query:
- **point**: `check(t, record, changes)` — guard one change.
- **set**: `toPrisma(t.from.predicate)` → a `where` for *all* records eligible for `t`,
  e.g. `prisma.inquiry.findMany({ where: toPrisma(resolve.from.predicate) })`.

## Registry (the affordance layer)

`Map<model, Record<name, Transition>>`:
- `available(model, record)` → transition names whose `from.predicate(record)` is true →
  drives action-button enablement, API affordances, permission-filtered "what can I do".
- `eligible(model, name)` → `toPrisma(...)` for bulk "who can take this transition".

## Serializable → tenant-configurable

Because predicates (json-rules), `requires` (include shape), and keyword merge strategies are
all JSON, a transition set can be stored per-tenant and edited without a deploy. This turns a
code primitive into a configuration surface. Requirements that fall out of this:

- **Authoring validation** (mirror json-rules' existing **lens validation** — read its impl,
  don't invent a parallel API): on save, validate predicate fields/types exist, `requires` is
  a valid include, `merge` is a known strategy.
- **Field/relation allowlist per model** — a customer predicate compiles via `toPrisma` to a
  real `where` (customer-controlled DB query) and `requires` to real loads. Without scoping,
  that's a data-exposure / access-control hole. The configurable surface must constrain which
  fields/relations a tenant may reference.
- **Relation loads respect permissions/tenancy** (see relations layer below).

## Lens-awareness / composition (scoped)

Make transitions lens-aware so **composition** can be checked — but scope it:
- **Cheap (do this):** structural / lens alignment — does A's `to` lens line up with B's
  `from` lens; mirror json-rules' lens validation.
- **Expensive (do NOT promise):** reachability / "do these predicates ever co-satisfy" is
  predicate **satisfiability** — SAT-hard for arbitrary conditions. No solver.

## Relations (`requires`) — designed, NOT built yet

Kernel ignores `requires` (it's metadata). A **separate optional loader** later derives the
Prisma `include` from `requires`, auto-loads before eval, fails loud if a predicate reads an
unloaded relation (vs silently `undefined`), and **respects permissions/tenancy**. The kernel
must never import Prisma. Build only when the first relation-referencing transition appears.

## Scope

- **Now:** kernel + merge (cb + keyword strategies + `isSerializable`) + registry +
  `available()` + `toPrisma` set-query + authoring validation + field allowlist.
- **Later (design in README, unbuilt):** `requires`/relation-loader, permission-filtered
  `available()`, lens composition checks beyond structural.
- **Non-goals:** statecharts, side effects / on-transition callbacks, a workflow engine, a
  config UI. Core stays a pure evaluator over data.

## Tasks

- [ ] Package skeleton `@inixiative/transitions`, depends on `@inixiative/json-rules`
- [ ] Kernel `check()` (from/to predicate eval + merge application) returning `{ ok, reason }`
- [ ] Merge: raw cb + keyword strategies (`spread`, `deepMerge`, `append`, `appendUnique`) +
      `isSerializable(transition)`
- [ ] Registry: `Map<model, transitions>`, `available(model, record)`, `eligible(model, name)`
- [ ] `toPrisma` set-query helper off `from.predicate`
- [ ] Authoring validator (mirror json-rules lens validation) + per-model field/relation allowlist
- [ ] Lens-aware structural composition check (no SAT solver)
- [ ] Tests: kernel (from/to asymmetry), merge strategies, serializability check, registry
      `available()`, validator rejections, `toPrisma` round-trip
- [ ] README: the relations/`requires` loader design (unbuilt), non-goals, the Evans line
- [ ] Adopt for first consumers (see below)

## Consumers (template-first)

Ships as the base primitive any status-bearing model adopts. Reference adopter in template:
- **Inquiry status** lifecycle (`available()` powers the inquiry action surface).

Downstream apps adopt it for their own lifecycles (e.g. tribe: Bot status, ChatMessage
`pending → sent → failed`). Pairs with typing status as a discriminated union (compile-time);
this is the runtime half.

## Open questions

- Must `to` require actual change (exclude `from == to` no-ops)?
- First-match vs all-match when several transitions qualify?
- Does `available()` report near-miss reasons (for "why can't I")?
