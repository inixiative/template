# INFRA-024: `sourceQueries` — richer option sets (all-configured, records/labels, cascading)

**Status**: 🆕 Not Started — problem framing only, no design decided. The three pulls below interplay; resolve them together, don't settle one in isolation.
**Assignee**: Aron
**Priority**: High (gates the first real per-surface builders — segment + email)
**Created**: 2026-07-01
**Updated**: 2026-07-01

This is the **option-eligibility source axis** — the `sources?: Record<field, Condition>` narrowing entry + `sourceQueries(lens)` (DISTINCT option-fetch compiler) + `SourceValues` folding that shipped in json-rules 2.9–2.10. INFRA-014 explicitly carved this out as *adjacent* to its EAV-table hydration ("decorating a field's selectable values, not hydrating a table into a map"); this ticket is that carved-out axis. Builds on INFRA-023 (binds resolve *into* the lens before `sourceQueries` runs, so every option query is already tenant-scoped). Related surface: INFRA-017 (builder surface).

Motivating consumers — the first real users of `sourceQueries`: Zealot's segment builder (ZLT-1470, FanUsers) and email-rule builder (ZLT-3171). Zealot tracker: **ZLT-3214**.

---

## The shape today

`sourceQueries(lens)` emits one `SourcePrismaQuery { model, distinct, select, where }` per sourced field —
`SELECT DISTINCT(field) FROM <model> WHERE <narrowing-at-path AND source-where>` — and `runSources` flattens each result to `SourceValues { path, mapName, model, field, values: string[] }`. Three assumptions are baked in: the option set comes from **the field's own path model**, it is a **bare list of value strings**, and each sourced field is **independent** of every other.

The first real builder surfaces push on all three. This ticket is the problem statement; it deliberately does **not** pick a mechanism.

## Driving example

On a FanUsers surface, a brand admin wants: *"fans who have an enrichment from **[this source]** mapped to **[this custom field]** whose value is **[this value]**."* That single logical condition is a predicate over a chain — `enrichments SOME { integrationSource = X AND customFieldDefinition = Y AND value = Z }` — where the option set for each coordinate depends on the pick before it (which maps exist depends on the source; which values exist depends on the map). This is the same custom-field/EAV surface INFRA-014 hydrates — the two axes meet here. Separately, a "mission" condition wants **all** of a brand's configured missions, not only the ones some fan has already completed.

## Open questions

1. **Option-set model vs the field's path model.** A relation field (`fanMissions.brandMissionUuid`) sources `DISTINCT` over the *relation* model (FanMissions) → only values already on a row ("used-only"). The builder often wants the *referenced* model's full set ("all-configured" — every `BrandMissions.uuid` for the brand), which also carries the clean tenant column to bind on. How should a sourced field declare "my options come from the referenced/bridged model," and does `sourceQueries` follow a bridge to get there?

2. **Values vs records (labels).** `SourceValues.values` is a bare `string[]` — a UUID list with no human label, so every consumer re-resolves UUID→name out of band. The *query* half can already carry it (`distinct: ['uuid'] + select: { uuid, name }` returns the whole row), so this may be only a projection change — **but** it lands differently depending on how (1) and (3) resolve, so hold it open here rather than solving it alone.

3. **Independent vs cascading sources.** Each sourced field is materialized on its own; `sourceQueries` has no notion of one source parameterizing another. The driving example needs **dependent** option sets — a chain where coordinate B is scoped by the choice in coordinate A (source → map → custom field → value), the three interplaying as one condition. This is the hard one and the reason not to settle (1) or (2) in isolation.

## Not in scope of this ticket

Choosing the mechanism, and json-rules implementation planning (that becomes a `FEAT-*` in json-rules once a direction is picked). The point here is to name the three pulls and keep them together. Downstream (Zealot ZLT-1470) builds MVP against the surface as it stands with a **placeholder** for sources, on the understanding that the real source contract is defined here.

## Related

- **INFRA-014** — Source Primitive (EAV/custom-field *table hydration*); the adjacent axis. The custom-field chain in the driving example is where the two meet.
- **INFRA-023** / json-rules FEAT-004 — context binds; resolve-before-hydrate is the security floor this assumes.
- **INFRA-017** — builder surface (the consumer of what these sources produce).
- **ZLT-3214** — Zealot-side tracker + first consumers (ZLT-1470 segment, ZLT-3171 email).
