# FE-004: In-Memory Filter Evaluator

**Status**: 🚧 In Progress — core shipped (lens-from-schema + row-materialized sources + hook); builder-UI wiring remains (INFRA-002/INFRA-017 territory)
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-06-30
**Updated**: 2026-07-02

---

## Overview

A client-side filter that evaluates the **same rule language** the server uses, in memory, over already-fetched data. One predicate language, two executors — and json-rules already *is* that duality: rules compile `toPrisma` for the DB and evaluate via `check()` in memory. So the client needs no evaluator of its own; it needs a **lens over the data it holds**.

For a collection fetched through the SDK, the response schema is exactly the filter vocabulary: every field it lists is in memory by construction, including computed/mapped fields the server could never filter (they don't exist as columns). Deriving the lens from the SDK response schema — rather than from the server's filter-capability query params — is deliberate: the client filters what it *has*, not what the server can `WHERE`.

> Superseded sketch: the original design here proposed `applyFilters`/`matchesOperator` — an in-memory evaluator over the `bracketQuery` `FilterState` shape with an operator-parity table kept in lockstep with `buildWhereClause`. Dropped: that's a second predicate evaluator running parallel to `check()`, and the lockstep table is exactly the drift this ticket exists to kill.

## Motivation

Surfaces that have already loaded a full result set sometimes need a display-only narrowing the server can't make for them — e.g. a single endpoint feeding two surfaces with different display needs (a carousel showing only earned/featured rows vs. a full tab), or a sort/segment toggle that's purely presentational. Today each surface hand-rolls a bespoke `filterX` util that re-encodes row predicates in a different shape than the server's, so the two drift.

> **Motivating case (Zealot):** `filterRewardsForCarousel` + a client sort on the rewards list (PR userevidence/Zealot-Monorepo#1546). The endpoint is paginated and server-owns visibility/scope/sold-out/order; the carousel still needs a display-only "earned level rewards only" narrowing for tier-status programs. That narrowing should be a json-rules rule the client runs in memory, not a parallel util.

---

## Shipped design (`packages/ui`, json-rules ^2.12.1)

### `lib/lensFromSchema.ts`

`lensFromSchema(schema, { model? })` — builds a `Lens` from an SDK `schemas.gen.ts` response schema object (the client twin of the backend's Prisma-derived field maps). Scalars keep their type (`date-time` → `DateTime`, so date/number comparisons coerce), enums carry `values`, nested objects/arrays become traversable relation models (`Reward.brand`, `Reward.redemptions`). Narrowing is the standard `LensNarrowing` — pick a couple things off the lens (or omit), done.

### `lib/sourceValuesFromRows.ts`

`sourceValuesFromRows(lensOrNarrowing, rows)` — the client-side dual of `sourceQueries`: for every field declared in the narrowing's `sources`, materialize its option set from the rows instead of a DISTINCT query. Same composition (visit `where` ∧ source eligibility `where`, here via `check()`), same `SourceValues` output, `SourceSpec.label` honored as the sibling display column. This is how a plain string column becomes a **pseudo-enum**: declare it in `sources`, and the picker gets the values that actually occur in the fetched collection.

Relation to INFRA-024: that ticket is the *server* option-set axis (all-configured sets, records/labels, cascading). The client materializer is used-only **by design** — for filtering rows in hand, an option matching zero fetched rows is noise.

### `hooks/useFilteredData.ts`

```ts
const lens = useMemo(() => lensFromSchema(RewardItemSchema, { model: 'Reward' }), []);
const narrowed = { parent: lens, root: { picks: [...], sources: { rewardType: true } } };
const { data, rule, setRule, surface } = useFilteredData(rows, narrowed);
```

Holds the rule, filters rows via `check()`, and exposes `surface` — `exposedSurface(narrowing, { sourceValues: sourceValuesFromRows(...) })` — for a rules-builder to render fields, operators, and row-materialized options.

## Non-goals

- **Replacing server-side filtering.** Visibility, tenancy/scope, sold-out, and ordering stay in the paginate `where` — they are server-enforced and must not move client-side. This is display-only narrowing on data the client already legitimately holds.
- A filter-builder UI (INFRA-002 / INFRA-017 territory) — `surface` is its input.
- FE-003's server-query construction (`useDataFilters`/`buildFilterQuery`) — unchanged, separate axis.

## Dependencies

- `@inixiative/json-rules` ^2.12.1 (`check`, `createLens`, `projectByPath`, `exposedSurface`, labeled source options)
- SDK `schemas.gen.ts` (runtime response schema objects; already generated)
