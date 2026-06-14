# INFRA-014: Source Primitive in json-rules (Hydrated Tables)

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (multi-source vision — NOT blocking COMM-001/FEAT-008/FEAT-003)
**Created**: 2026-06-13
**Updated**: 2026-06-13

---

## Overview

A "source" already exists implicitly in json-rules: it's a named entry in
`maps: Record<string, FieldMap>` (e.g. `prisma`, `salesforce`, `crm`) on the
schema side, and at runtime it's **just a hydrated table** — `rawData:
Record<string, Row[]>` keyed by `source:Model`, indexed by
`buildBridgeDictionary`, read by `check()` via plain path access.

This ticket formalizes that concept into a first-class primitive: name the two
halves (schema + hydrated rows), document the runtime contract, and cover
**custom-field tables** (EAV-style / dynamic columns) which don't have a static
schema and need a description→FieldMap path plus a row-shaping path.

## Objectives

- A documented `Source` concept: `{ name, fieldMap }` (schema) + a runtime
  hydration contract (rows in, keyed dictionary out)
- Custom-field/EAV table handling — dynamic fields described into a `FieldMap`
  and rows reshaped for `check()`
- No data persisted as config — sources are live snapshots

## How a hydrated source table reaches a lens/map (the concrete flow)

A "source" is a named `FieldMap` in `lens.maps`; its runtime data is a **hydrated
table** — an array of plain row objects. To provide one (e.g. a custom-fields
table) and use it in a rule:

1. **Schema side** — describe the source as a `FieldMap` (custom fields become
   model fields with `{ kind, type, values? }`); add it to `maps` under a source
   name and **bridge** it to the anchor (e.g. `customFields:UserFields` ↔
   `prisma:User` on `userId`). Importer/INFRA-013 generates this.
2. **Hydrate** — at eval time the host fetches the rows and shapes them as objects
   keyed by field name. For an **EAV / custom-field table** (rows of
   `{entityId, key, value}`) the host **pivots** to `{ userId, fieldA, fieldB }`.
3. **Index + embed** — pass `rawData: Record<"source:Model", Row[]>` to
   `buildBridgeDictionary(lens, rawData)` (indexes by the bridge `on` field), then
   embed the matched rows under the bridge key on each anchor row.
4. **Evaluate** — `check()` reads them via path (`customFields:UserFields.fieldA`).
   json-rules is schema-aware but **data-agnostic**: the FieldMap + bridge `on`
   tell the host what to fetch and how to join; the host does fetch/pivot/embed.

This primitive's job is to **standardize steps 2–3** for custom-field tables (the
EAV pivot + a typed contract), so hosts don't hand-roll it. (Zealot PR 1022's
`hydrateUserContext` + `integrationFieldConfig` are the prior, host-specific
version of this.)

## Tasks

- [ ] Decide whether `Source` is a thin named type or stays the `maps` key + docs
- [ ] Document the hydrated-table runtime contract (rawData shape, `on` keys,
      embedding under `source:Model` bridge keys)
- [ ] Custom-field-table adapter: EAV/dynamic rows → pivoted object shape +
      dynamic schema → `FieldMap`
- [ ] Clarify missing-field / null semantics for sparse custom-field rows
- [ ] Tests covering hydration + a custom-field table end-to-end with `check()`

## Open Questions

- Is `Source` worth a type, or does the `maps` dimension + clear docs suffice?
  (Aron: "its really just a hydrated table" — lean minimal.)
- Where do live snapshots get cached, if at all? (Probably caller's concern.)

## Implementation Notes

- `buildBridgeDictionary` is the existing hydration indexer — build on it, don't
  replace it.
- Sources serialize their **schema** (FieldMap) but not their **data**.

## Definition of Done

- [ ] Source concept documented (schema half + runtime hydrated-table half)
- [ ] Custom-field table path working + tested
- [ ] README/LENS docs updated

## Related Tickets

- **Consumes**: INFRA-013 (importer output)
- **Related**: INFRA-015 (bridges), INFRA-016 (serialization)
