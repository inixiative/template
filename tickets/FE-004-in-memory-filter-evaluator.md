# FE-004: In-Memory Filter Evaluator

**Status**: 🚧 In Progress — core shipped (endpoint-derived lens in `@template/sdk`; row-materialized sources in json-rules 2.14; the headless hook standardized into `@inixiative/rules-builder@0.15.0` as `useFilteredCollection`); builder-UI wiring remains (INFRA-002/INFRA-017 territory)
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-06-30
**Updated**: 2026-07-02

---

## Overview

A client-side filter that evaluates the **same rule language** the server uses, in memory, over already-fetched data. One predicate language, two executors — and json-rules already *is* that duality: rules compile `toPrisma` for the DB and evaluate via `check()` in memory. So the client needs no evaluator of its own; it needs a **lens over the data it holds**.

The lens is **endpoint-derived, not model-derived**: the same Prisma model has different views per endpoint (`InquiryItem` vs `InquiryReceivedItem` vs `InquirySentItem`), so "the Reward lens" is not a real thing on the client — the response component is. `lensFromOperation(operationId)` walks the OpenAPI spec (`operationId → 200 → data envelope → $ref`), so the lens covers every endpoint (only 3 of 61 have importable `schemas.gen` components; the rest exist only inline in the spec) and names itself after the response component. Two endpoints share a filter vocabulary exactly when they share a response shape.

> Superseded sketches: (1) the original `applyFilters`/`matchesOperator` design — a second predicate evaluator with an operator-parity table kept in lockstep with `buildWhereClause`; exactly the drift this ticket exists to kill. (2) `lensFromSchema(schema, { model: 'Reward' })` — caller-named model identity; misrepresents an endpoint-shaped projection as the Prisma model and can't reach the 58 endpoints with no named component.

## Motivation

Surfaces that have already loaded a full result set sometimes need a display-only narrowing the server can't make for them — e.g. a single endpoint feeding two surfaces with different display needs (a carousel showing only earned/featured rows vs. a full tab), or a sort/segment toggle that's purely presentational. Today each surface hand-rolls a bespoke `filterX` util that re-encodes row predicates in a different shape than the server's, so the two drift.

> **Motivating case (Zealot):** `filterRewardsForCarousel` + a client sort on the rewards list (PR userevidence/Zealot-Monorepo#1546). The endpoint is paginated and server-owns visibility/scope/sold-out/order; the carousel still needs a display-only "earned level rewards only" narrowing for tier-status programs. That narrowing should be a json-rules rule the client runs in memory, not a parallel util.

## Scope decision: rules-builder surface, not a facet bar

These primitives feed a **rules builder** over an in-memory collection: options are the distinct values in the full fetched set and stay stable while a rule is authored. An Amazon-style **facet bar** is a different product — per-facet counts with leave-one-out rescoping ("eu (0)" greys out as other filters tighten) — and `SourceOption` carries no count slot. If a surface needs facets, that's a separate ~20-line `countBy` helper over `data`, not a change to this shape.

---

## Shipped design (`packages/sdk/src/lenses/` + rules-builder hook, json-rules ^2.14.0)

### `@template/sdk/lenses` — `lensFromOperation.ts`

`lensFromOperation(operationId)` — the primary entry. Resolves the endpoint's 200 response from `openapi.gen.json` (already in the bundle via `getQueryMetadata`), unwraps the `data` envelope (array → items), and builds the lens named by the response component (`meReceivedManyInquiries` → `InquiryReceivedItem`) or the operationId when inline. Hard-throws on unknown operationId or a response with no data envelope.

### `@template/sdk/lenses` — `lensFromSchema.ts`

`lensFromSchema(schema, name)` — the schema walk under it (also usable directly with hand-written or `schemas.gen` schemas; `name` is the view identity, never a Prisma model). Scalars keep their kind (`date-time` → `DateTime`), enums carry values (non-string enums degrade to scalars), Json columns (opaque `{}` in the spec — the generator renders `z.unknown()` that way, so the shape split is deterministic) become `scalar Json`, and inline relation objects become traversable child models (`InquiryItem.sourceUser`). Throws on a fieldless schema instead of building an empty lens.

### `sourceValuesFromRows` (json-rules 2.14)

Hoisted into `@inixiative/json-rules@2.14.0` — the in-memory executor of `sources` declarations, alongside `sourceQueries` (DB DISTINCT) and rules-builder's table-shaped `runSources`: for every field declared in the narrowing's `sources`, materialize its option set from the rows instead of a DISTINCT query. **Rows are lens-scoped by contract** (the fetch already applied the lens's `where`), so eligibility is the field's source `where` only — evaluated via `check()` with `CheckOptions` passthrough for `{bind}` clauses. Scalar-list fields (tags) contribute one option per element, labels take the first non-null sibling, and sorting is numeric-aware in a fixed locale. This is how a plain string column becomes a **pseudo-enum**: declare it in `sources`, and the picker gets the values that actually occur in the fetched collection.

Relation to INFRA-024: that ticket is the *server* option-set axis (all-configured sets, records/labels, cascading). The client materializer is used-only **by design** — for filtering rows in hand, an option matching zero fetched rows is noise.

### `@inixiative/rules-builder@0.15.0` — `useFilteredCollection`

```ts
const source = useMemo(() => {
  const { maps, mapName, model } = lensFromOperation('rewardsReadMany');
  return { maps, mapName, model, narrowing: { root: { picks: [...], sources: { rewardType: true } } } };
}, []);
const { data, root, value, setCondition } = useFilteredCollection({ source, rows, checkOptions? });
```

The hook lives in rules-builder, not `@template/ui`, because it knows only json-rules things (a lens, rows, `check()`) — nothing template-shaped; its one template input (the lens) comes from `@template/sdk/lenses` at the call site. Composed **on** `useRuleBuilder` so there is exactly one `Condition` owner, one option-folding seam (`sourceValuesFromRows` through the builder's `resolve`), and stamp-once (the emitted `value` is already coercion-stamped; `data` is `rows.filter(check(value))`). `source`/`rows`/`checkOptions` must be referentially stable (memoize); `CheckOptions.bindings` feeds `{bind}` clauses.

> Superseded sketch (3): `@template/ui`'s `useFilteredData(rows, lens)` — a second `Condition` owner beside `useRuleBuilder`, double-folding `sourceValues` (once into `surface`, again in the builder's `resolve`) and double-stamping. Wiring the two hooks per surface was the drift this ticket exists to kill, one level up.

The template takes `@inixiative/rules-builder@^0.15.0` with its first consumer (INFRA-002/INFRA-017 wiring); no template package depends on it yet.

## Non-goals

- **Replacing server-side filtering.** Visibility, tenancy/scope, sold-out, and ordering stay in the paginate `where` — they are server-enforced and must not move client-side. This is display-only narrowing on data the client already legitimately holds.
- Facet counts / leave-one-out rescoping (see scope decision above).
- A filter-builder UI (INFRA-002 / INFRA-017 territory) — `useFilteredCollection`'s `root` descriptor tree is its input.
- FE-003's server-query construction (`useDataFilters`/`buildFilterQuery`) — unchanged, separate axis.

## Dependencies

- `@inixiative/json-rules` ^2.14.0 (`check` + `coerceType`, `stampCoercions`, `sourceValuesFromRows`, `createLens`, `projectByPath`, `exposedSurface`); 2.14.1 hardens `sources` typing (`{}` rejected — `SourceSpec` requires `where` or `label`)
- `@inixiative/rules-builder` ^0.15.0 (`useFilteredCollection`) — taken by the first consuming surface, not by the template packages yet
- `openapi.gen.json` (generated; already bundled via `getQueryMetadata`)
