# INFRA-051: Attribute `json-rules` Support, Postgres JSONB `array_contains`, and Paginated Lens Filtering

**Status:** Backlog (Follow-up to `FEAT-026` / `inixiative/template#320`, paired with `FEAT-020` and `@inixiative/json-rules`)  
**Repos:** `inixiative/json-rules`, `inixiative/template` (then backport to `kingdom`, `tribe`, and align with `zealot`)  
**Rulings:** `R-2026-11-21-14` (`multiSelect` stored as deduplicated `string[]` in `valueJson` with Postgres `GIN` index + `array_contains`), `R-2026-11-21-20` (`ATTRIBUTE_MODELS` uniform 5-column contract).

---

## Problem

`FEAT-026` (`inixiative/template#320`) shipped direct Prisma `where` / `orderBy` builders in `packages/db/src/lib/attributes/operators/` (`attributeWhereEquals`, `attributeWhereIn`, `attributeWhereRange`, `attributeWhereMultiSelectContains*`, `attributeOrderBy`).

Most real filtering over `ATTRIBUTE_MODELS` tables (`Setting`, and future custom-field / enrichment value tables under `FEAT-020`) will happen inside **paginated list endpoints** (`readRoute({ many: true, paginate, filterLens })` -> `paginate` / `cursorPaginate`), **Segments**, **Entitlement `where` rules**, and **Admin filter UIs** (`rules-builder`). All of those run through **`@inixiative/json-rules` + `filterLens`**, not direct Prisma calls.

### How Zealot does this today (reference)

In `zealot`, paginated routes and segments expose `enrichments` directly through `filterLens` (`zealot/docs/primitives/lens.md` lines 59-75):

- `fanUsersReadManyFilterLens` (`apps/api/src/modules/fanUsers/lib/fanUsersReadManyFilterLens.ts`): picks `enrichments.value` and `enrichments.integrationMap.customFieldDefinitionUuid`.
- `fanUserRuleRoot` (`apps/api/src/modules/rules/lib/lenses/fanUserRuleRoot.ts`): picks `['value', 'valueNumber', 'valueDate', 'sourceUpdatedAt']`, binds `where: { field: 'brandUuid', operator: 'equals', bind: 'brandUuid' }`, and attaches `sources: { value: { from: 'mapDefaults' } }` for dropdown option vocabularies.
- Paginated bracket-query filters and segment rules compile through `json-rules` (`toPrisma`) and evaluate in memory through `check()`.

### Two concrete gaps today

1. **Postgres JSONB `array_contains` (`GIN`) in `@inixiative/json-rules`:**
   - Today `json-rules/src/toPrisma/field.ts` (lines 350-359, 468-484) compiles `contains` on a `FieldKind.Json` column into `OR: [{ string_contains }, { array_contains }]`, which defeats Postgres `GIN` index usage and has wrong semantics for exact JSON array membership, and throws on array operands (`containsAll` / `containsAny`).
   - Because `R-2026-11-21-14` stores `multiSelect` as a deduplicated `string[]` in `valueJson` (`jsonb`) with `@@index([valueJson], type: Gin)`, `json-rules` cannot currently compile `multiSelect` attribute rules to index-backed Prisma `array_contains` queries.

2. **No `json-rules` / Lens bridge for `ATTRIBUTE_MODELS`:**
   - Callers writing rules over an Attribute table (e.g. "find all `Project`s where `settings` has `key = 'chorus.mode'` and `valueText = 'strict'`", or "find all `User`s where `topics` contains `'billing'`") currently have to manually know which of the 5 columns (`valueBoolean`, `valueText`, `valueNumber`, `valueDate`, `valueJson`) holds a given locator key.
   - `packages/db/src/lib/attributes/operators/` translates straight to Prisma `where` / `orderBy`, so backend direct queries and `json-rules` / paginated lens queries would diverge into two separate operator systems unless unified.

---

## Design Decisions to Settle Before Implementing

**Core principle (Aron, 2026-11-22):** Never hide the 5 typed columns behind magic serialization. `valueBoolean`, `valueText`, `valueNumber`, `valueDate`, and `valueJson` are explicit columns right on the model, and `valueType` is explicit in `/api/v1/setting/info` (and any future attribute definition table). Callers and lenses can ALWAYS pass explicit column checks straight through untouched; the goal of this ticket is that if a caller passes a logical `value` check instead, the helper/engine decomposes it onto the matching explicit typed column.

Before writing code, decide where each piece belongs so `json-rules` stays pure and `template` avoids parallel machinery:

1. **In `@inixiative/json-rules` (engine primitive vs. engine option):**
   - Add first-class Postgres JSONB array-containment support for `FieldKind.Json` (either explicit JSON array operators or a clean engine option / target dialect setting so Postgres `toPrisma` emits pure `{ array_contains: [item] }` without the `string_contains` `OR`, plus `AND` / `OR` over `{ array_contains: [item] }` for `containsAll` / `containsAny`, matched identically in `check()` and `toSql()`).
   - Keep `json-rules` agnostic of `ATTRIBUTE_MODELS` / `Setting` (pure JSONB array semantics that benefit every Postgres `Json` array column across `template`, `kingdom`, and `zealot`).

2. **In `template` (`packages/db/src/lib/attributes/` helper util vs. dual compilation):**
   - **Option A (recommended: single `json-rules` condition helper + thin Prisma wrappers):**
     - Add `attributeCondition(model, locator, operator, value, options?)` returning a standard `json-rules` `Condition`:
       ```ts
       // Compiles locator -> typed column via resolveAttributeTarget()
       {
         and: [
           { field: locatorField, operator: Operator.equals, value: locator },
           { field: typedColumn, operator, value },
         ],
       }
       ```
     - Add `attributeRelationCondition(relation, model, locator, operator, value, options?)` wrapping it in `{ relation, operator: 'some', rule: ... }` for parent-model filtering (e.g., filtering `Project`s, `Organization`s, or `User`s by their `settings` in paginated endpoints and Segments).
     - Re-express `packages/db/src/lib/attributes/operators/*` (`attributeWhereEquals`, `attributeWhereIn`, `attributeWhereRange`, `attributeWhereMultiSelectContains*`) as thin wrappers over `toPrisma(attributeCondition(...))` so direct Prisma callers AND `json-rules` / paginated lens / `check()` callers share one single implementation (dual support with zero duplicated operator logic).
   - **Option B (engine-level attribute metadata plugin/setting):**
     - Register an `attributeModels` adapter/config on the `json-rules` engine or `field-map` so rules can reference virtual attribute paths directly (e.g. `settings['general.defaultTimezone']`) and the compiler desugars them into relation + locator + typed column automatically. Higher leverage for `rules-builder` and AI rule generation, but larger surface area in `json-rules` and `field-map`.

3. **Paginated `filterLens` helper (`attributeLensRelation`):**
   - Mirror Zealot's `fanUserRuleRoot` narrowing (`picks` on locator + all 5 typed columns `valueBoolean`, `valueText`, `valueNumber`, `valueDate`, `valueJson`, plus optional `where` binding and `sources` for option vocabularies).
   - Wire into paginated `readRoute({ filterLens })` endpoints (`GET /api/admin/setting`, `GET /api/v1/organization/{id}/projects`, etc.) so bracket queries can filter and sort parent rows by their `Setting`s (and future `FEAT-020` custom attributes) safely through the lens allowlist.
   - Ensure ReBAC visibility is preserved: a paginated parent query filtering by `settings` must never leak admin-only or owner-only settings (`readPermission: 'manage' | 'own'`) via filter-oracle side channels (tie into `INFRA-026` / `AUTH-013`).

---

## Acceptance Criteria

1. `@inixiative/json-rules` compiles JSONB array-contains (`contains`, `containsAny`, `containsAll`) to pure Prisma `array_contains` (no `string_contains` `OR` branch) verified against Postgres `GIN` index (`EXPLAIN` / real DB test), with matching in-memory `check()` and `toSql()` behavior.
2. `packages/db/src/lib/attributes/` supports building `json-rules` `Condition`s (both row-level and relation-level) for any registered `ATTRIBUTE_MODELS` entry across all 6 `AttributeValueType`s (`boolean`, `text`, `number`, `date`, `json`, `multiSelect`).
3. Direct Prisma helpers (`attributeWhere*`) and `json-rules` compilation share one code path (no parallel operator divergence).
4. A reusable `filterLens` narrowing helper exposes `Setting` (and any `ATTRIBUTE_MODELS` relation) cleanly to paginated `readRoute({ many: true, paginate, filterLens })` endpoints without leaking restricted `readPermission` keys.
5. `packages/db` and `apps/api` integration tests verify paginated filtering over `Project` / `Organization` / `Admin Setting` using bracket queries + `json-rules` across scalar, range, and `GIN` `multiSelect` settings.
