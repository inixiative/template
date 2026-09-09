# FEAT-020: Custom Fields (EAV) — the enrichment substrate, with Zealot's lessons

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (every multi-tenant app with integrations ends up here; Zealot paid for the map)
**Created**: 2026-08-27
**Updated**: 2026-08-31 (performance landmines + Postgres specifics)

---

## Overview

Tenant-definable fields on first-class records ("Industry", "Region", "Salesforce Contact ID"), populated by many sources (a CRM, a CSV import, an AI enrichment run, the user editing in our UI), each source keeping its own contribution, one reconciled value per field, and the whole thing queryable by the rules engine, the paginator, and global search without the schema knowing the fields.

Zealot built this four times over eighteen months — `IntegrationMap` (2024, Alloy/Workato era), `CustomFieldDefinition` + `IntegrationSource` (2026-02, `docs/plans/2026-02-18-custom-fields-api-design.md`), the generic `Enrichment` table + contribution writer (2026-06, `2026-06-27-integration-bridge-and-enrichment-platform.md`), and the typed-value split (2026-08, ZLT-4062). Each layer fixed the previous one's wrong turn and left its columns behind. This ticket is the shape the template ships **once**, and the list of the wrong turns so they are not repeated. INFRA-014 (hydrating an EAV table into a json-rules `FieldMap` for `check()`) and INFRA-024 (the source → field → value option chain) sit on top of this; neither can start without the tables below.

## Objectives

- One schema for definitions, sources, maps, contributions, and vocabulary — uuid-keyed, brand-scoped, typed from day one.
- The rules for **what goes in it** written down: EAV is the opt-in to tenant-definable / integration-writable; app-owned facts stay columns.
- Rules, paginate, and search read it through the lens (one lens per model for every tenant; the tenant rides the bind), never through hand-rolled joins.
- Materialization (one reconciled value per field, its change as the event) designed in, not read-time-only.

---

## The shape (Zealot's, corrected)

```
CustomFieldDefinition ──┐                        IntegrationSource ──┐
 (what a field IS)      │ customFieldDefinitionUuid   (who contributes) │ integrationSourceUuid
                        ▼                                               ▼
                   IntegrationMap  ── one row per (brand, field, source); valueType, aliasKeys
                        │ integrationMapUuid
                        ▼
                    Enrichment  ── one row per (brand, entity, map): the source's contribution
                                   value columns: valueText | valueNumber | valueDate | valueJson
                        │
             EnrichmentVocabulary  ── observed + offered values per (brand, field[, source]), `seen`
```

`profile` (the value set in our own UI / by an admin) is a **system `IntegrationSource`**, not a special case — a user editing in our app is just another contribution.

---

## Lessons learned in Zealot (each: what happened → the ruling → what the template does)

### 1. When to EAV at all — modeling as a custom field IS the opt-in

- Three times someone proposed a flag to protect a field from the generic enrichment seams: `assertNotAdvocateStatusField` in six seams, `isManaged`, `isReadOnly` on `SystemField` (ZLT-4429). All rejected (UE-4176). Ruling: a `CustomFieldDefinition` + `IntegrationMap` is how a field **volunteers** to be written by integrations and generic seams. A fact an app workflow owns (`advocateStatus`, `joinSource`) is a real column with one write service and audit-on-table; being a column means the generic seams can't reach it *by construction*, which replaces every guard.
- Tell: "the enforcement point must live in the enrichment write path" = the field is in the wrong system. A gap in a downstream rail (reporting, CRM push) is never a reason to move a fact into EAV — extend the rail to carry intrinsic columns.
- **Template:** document this rule beside the schema. No `isManaged`/`isReadOnly`/`isLocked` on the definition. System fields that mirror an intrinsic column compose the column into the resolved read; they don't copy it.

### 2. Identity and provenance ride the same tables — never vendor columns

- `Opportunity.sfdcOpportunityId` + `origin { native, salesforce }` was rejected on sight (ZLT-2827: "we have custom fields for foreign keys in other systems like this… this should be the same in all these models"). The fix: a single nullable `originUuid → IntegrationSource` on every model that tracks where a record came from (null = native), and the external id as an `Enrichment` against a seeded, non-colliding, `isIdentity` system field.
- `isIdentity` + `resolveIdentityCoordinate`: the dedupe coordinate for an inbound batch is the acting source's identity field + the value sent. Scope follows the collision policy — a source-scoped id (a Salesforce opportunity id) dedupes per map; a global natural key (email) dedupes per definition. `(brand, identityScope, identityValue)` unique on the contribution table makes concurrent first-ever creates collide on the DB instead of racing.
- Outbound writeback keys on **our** uuid; the external id is for inbound dedupe only. Internal identity never coalesces with an external id (`sfdcOpportunityId ?? uuid` was the smell).
- Per-integration configuration (sync direction, credentials, echo suppression) lives on `IntegrationSource`, never on a brand-global config ("which integration?").
- **Template:** `originUuid` on any bridged model; `isIdentity` + identity columns on `Enrichment`; `IntegrationSource.syncDirection` etc. No vendor enums, no `<vendor>Id` columns, ever.

### 3. One `IntegrationSource` per platform; raw vs elevated is the map's `customFieldDefinitionUuid`

- The `IntegrationMap` dual-shape bug (ZLT-3076): the same logical mapping existed twice — an auto-pulled "read map" (cfd null, values written against it) and a UI-wired map (cfd set, zero values) — so mapped CRM fields showed "Not set". `resolveDefinitionIntegrationMaps` (a read-time bridge between the two shapes) is a stopgap awaiting deletion.
- A second attempt — hidden "`<Platform> (raw)`" sources + a relink tool — was built and rolled back the same week (`6a4d98a6e`): it re-created the dual axis as raw-source vs curated-source.
- Canonical model: ONE source per platform; a raw dump is a map with `customFieldDefinitionUuid = null` **on that source**; elevation = setting the cfd on the map (`ensureMap` stitches `(source, cfd)` → map, idempotently). The sync writes against the canonical map.
- **Template:** `@@unique([brandUuid, customFieldDefinitionUuid, integrationSourceUuid])` and nothing else creates maps — one `ensureMap`. No `syncType`, `source`/`target`/`object` string columns, no per-vendor integration ids on the map.

### 4. Values are typed at the row, declared once — a single text `value` was the original sin

- `FanUserEnrichment.value LONGTEXT` meant every ordered comparison (`> 100`, `after 2025-01-01`) compared lexicographically — silently wrong. ZLT-4062 split it into `valueText | valueNumber (DECIMAL 38,10) | valueDate | valueJson`, declared by `IntegrationMap.valueType`, with indexes `(integrationMapUuid, valueNumber)` / `(…, valueDate)`. The legacy `value` column survives as a fallback arm until backfilled.
- Retargeting a comparison to the right column is done by **`differentiateEnrichmentValueTypeArgs(model, args)`** — a registry-driven util in `packages/db` (`registries/enrichmentValueColumns.ts`: `{ pinField, valueField, columns }` per participating model), a DMMF walker over root wheres, relation filters, nested include/select wheres, and orderBy, with a fast no-op for unregistered trees so the **two compilers** that produce every ordered comparison (`paginate`, `conditionsToWhere`) call it unconditionally. Ordered ops only; equality/`in`/`contains`/aggregates untouched (DECIMAL would round 18-digit identifiers).
- Rejected, argued through, don't re-propose: a rule-AST rewrite that pattern-matched pin vocabularies (silently reverted to lexicographic on unknown shapes); lens-level typed bindings (the type is per-row-group — depends on the sibling FK's row); an always-on Prisma client extension (fights scripts, changes aggregate shapes, "sometimes you want the raw controls"); a throwing guard (the primitive's own fallback arm is an ordered op on `value`).
- FE parity is a **hydration** question, not a query one: `readEnrichmentValue`/`hydrateUserContext` hand the in-memory evaluator typed JS values (a number, not a numeric string).
- **Template:** typed columns from day one, no legacy `value`, so no fallback arm; the registry + `differentiate…` util ported as-is. **Decision needed (below):** where the declaration lives — Zealot has both `CustomFieldDefinition.valueType` (string, display) and `IntegrationMap.valueType` (enum, storage) and they can disagree.

### 5. Value sets: options and vocabulary are the same thing — one table, never a blob, never capped

- `fieldConfig.options` (prescriptive, seeded once from the CRM's picklist describe, appended by CSV import, never re-synced, never validated on write) and `BrandEnrichmentVocabulary` (descriptive: observed values with coverage stats and exclusion gates) converged from opposite directions — "the same fucking thing" (ZLT-4324). ADP's `products` field carried a **309 KB options array** (3,083 entries) inside `fieldConfig`: the table became unsortable DB-side (MySQL errno 1038, 256 KB sort buffer — even sorting on another column), and the blob shipped on every definition read. Capping was proposed and rejected: truncation is a syntactic proxy for "what are the valid options".
- Decided shape: one vocabulary table + a `seen` flag — CRM-offered values written as rows at seed time with `seen: false`, flipped when observed in the data. No prescriptive store.
- **Template:** `EnrichmentVocabulary` rows from day one; `fieldConfig` never carries an option list; definitions are small rows and may be DB-sorted. Every picker (segments, forms, filters) reads the vocabulary through the lens `sources` axis (INFRA-024), which is the only place a value set is enumerated.

### 6. System fields, ordering, and the seed

- System (default) fields are per-brand rows seeded **upsert-only** with a drift-validation job (ZLT-4030); a second seed path (legacy SQL in the brand-create route) had to be kept in lockstep by hand — one seed path only.
- The unbranded `/system` read serves the generic set **by design**; brand edits to a system row's label/required live on the brand's own row. Divergence is not a bug.
- Ordering is a `position` column + one atomic reorder endpoint (UE-4162); system and custom rows are **one mixed sequence** (ZLT-4242 reversed the interim "system first, then custom" two-block scheme); the CRM form order follows the persisted positions with no package update.
- `valueType` (storage) and `displayType` (control) are independent; a system field's `displayType` is immutable; currency is cents + meta; creating a custom field that collides with a live/system field is rejected (ZLT-3871). `SystemField.required`/`showIf` are contract-only — never persisted.
- **Template:** ship `position`, the reorder endpoint, the upsert-only seed + validation job, and the mixed-sequence rule together, in the first cut.

### 7. Materialization: read-time resolution cannot bridge

- Zealot resolves a field at read time (`resolveFieldValue`: intrinsic column → `profile` → `orderPreference` precedence, first non-null wins). It works for display and it **cannot bridge** A → us → B: a resolved-on-read value has no row, so it emits no change event, so nothing propagates and nothing drives a transition.
- The design that survived two adversarial passes (`2026-06-27-integration-bridge-and-enrichment-platform.md` §3): per-source **contributions** (the `Enrichment` rows, `profile` included as a source) + one **materialized value** per field, derived by a **materialization policy** — a spectrum (non-colliding / partial / fully colliding) generalizing `orderPreference`, **not** the `isColliding` boolean Zealot carries. The materialized value's change is the bridge trigger and the transition driver; a lower-precedence echo that doesn't move it is a no-op, which is what terminates an N-way loop (single-origin echo suppression alone does not).
- **Template:** contributions table + a materialized store (intrinsic fields = the model column; configured fields = a materialized row) designed in from the start, even if v1 only ships the read-time resolver. `isColliding` as a boolean is not the shape — the policy is.

### 8. The rules engine reads it through the lens, by name

- **One `FanUsers` lens for every brand** — the field set is never brand-dependent; the per-brand difference is the bind + the hydrated `sources`. Custom-field rules traverse `enrichments any ( integrationMap.customFieldDefinition.label = "Industry" AND value = … )`, source-scoped by `integrationMap.integrationSource.label = "Salesforce"` — **name → name, no uuid indirection**, so a saved rule survives re-seeding and reads as prose.
- Tenancy and soft-delete are relation-level `where`s on the narrowing (`enrichments.where`, `integrationMap.where` re-asserting the brand bind and `deletedAt notExists`), consumed by `paginate`/search only when a query traverses the relation (`project_lens_visit_wheres_traversal`). A retired map's enrichment rows survive the soft delete; without the guard they keep feeding vocabularies and matching segments. Soft-delete is intrinsic data state → a static clause; `{ bind }` is only for request-scoped values.
- The 3-level vocabulary (source → field → value) is one composite `groupBy` DISTINCT on `enrichments.value` per brand, gated on `isSegmentable`, `targetModel`, enumerable `valueType`. Facets over it: `path: 'enrichments.value'`, `where: [source label =, field label =]`, one card per real linked field (ZLT-3876), selectors for the field pick, presets with variables for the tunable cards (INFRA-029).
- Latent bug found in the RFC: `CustomFieldDefinition.targetModel` written as `'fanUser'` everywhere, one query keyed `'FanUsers'` → matched zero rows. **Template:** `targetModel` is the Prisma model name, validated against the DMMF.
- Legacy rows with NULL uuid FKs are a non-issue by ruling: the new API always writes uuids; a 5-minute backfill cron fills legacy rows. Never design around NULL uuid FKs, never hand-roll a backfill.

### 9. Table layout: one contribution table with an exclusive arc — not one per entity

- Zealot has `FanUserEnrichment` (int PK `userEnrichmentID`, `brandID` string, `userEmail`, `mapID` int, `alloyIntegrationID`, `workatoIntegrationID`, `created_at` — every generation's columns) **and** the clean generic `Enrichment` (uuid PK, exclusive-arc `opportunityUuid | brandReferenceRequestUuid`, unique per `(brand, entity, map)`). Same semantics, two homes, one contribution writer switching on `targetModel`. The split is "deliberate" only in that migrating 7,352+ live rows wasn't worth it mid-flight.
- `mapID` (int) is banned in new work; uuid FKs only. Merging two records must transfer contributions (`transferFanUserEnrichments`); orphaned contributions (map/definition gone) were a remediation project (ZLT-3747).
- **Template:** ONE `Enrichment` table, uuid PK, one nullable FK per bridged model (exclusive arc, one non-null enforced in the writer), `@@unique([brandUuid, <entityUuid>, integrationMapUuid])` per arc, `@@unique([brandUuid, identityScopeUuid, identityValue])`. Definitions carry `targetModel`; the writer maps it to the arc column in one switch.

### 10. Everything else that cost a review round

- **Canonical shapes, no projections**: enrichment payloads on webhooks/app events/API responses are the model's canonical JSON; reshaping happens only at an integration boundary (the per-source adapter). AI is either a rule author or an enrichment writer — never an opaque judge (UE-4168).
- Brand-token auth must reach definition and source reads (ZLT-3686) — an integration mapping its own fields needs them.
- Never `orderBy` a table that can carry a large Json column (the errno-1038 lesson) — which is another reason `fieldConfig` stays small.
- Audit rides the generic AuditLog rail on the table (ZLT-3316); no bespoke history tables for enrichment values.

---

## Performance landmines — design for these, don't discover them

Zealot hasn't hit most of these yet only because it doesn't offer the features that trigger them. The template will. Each landmine below names the mitigation that must exist in the design **before** the feature that steps on it ships.

1. **Sorting / paginating a list BY a custom field.** `ORDER BY` an enrichment value is a join + filesort with no covering index, and the cursor paginator has nothing stable to cursor on. Mitigation: sorts and cursors run against the **materialized read table** (`(entityUuid, definitionUuid)` → typed value columns, indexed `(brandUuid, definitionUuid, valueNumber|valueDate|valueText, entityUuid)`), never against contributions. Cursor = `(sortValue, entityUuid)` composite. If the materialized store isn't built yet, custom-field sort is simply **not offered** — a slow unindexed sort is a feature regression wearing a feature's clothes.
2. **Aggregates across fields** ("advocates per Industry × Region") — EAV's classic weak spot: one self-join per axis on contributions. Mitigation: dashboards and counts read the materialized table (one join per axis on an indexed key), and axis vocabularies come from `EnrichmentVocabulary`, never a `DISTINCT` scan. Anything needing more than two axes gets a reporting query on the materialized table, not a clever contributions join.
3. **Reconcile fan-out.** A nightly all-dynamic-segments sweep is `segments × users`, and Zealot's per-user rail hydrates **every** enrichment per user for `check()` — the cost compounds as brands add fields. Mitigations, all three: (a) the **set-based rail is primary** — a segment compiles via `toPrisma` to one query per segment (the DB does the fan-out); per-user `check()` is only for event-driven single-user reconcile; (b) hydration is **batch-first** — one `findMany` + pivot for a page of users, never per-user queries (INFRA-014's runtime contract must say this); (c) reconcile is **incremental** — a materialized-value change event reconciles the affected user against the segments whose conditions reference that field (the lens knows which), with the nightly sweep as backstop, not workhorse.
4. **Materialization write amplification.** Once the bridge exists, every contribution write → recompute → event → webhook fan-out. Mitigations: recompute is per-(entity, field) and reads only that field's contributions; a recompute that doesn't move the materialized value emits **nothing** (the no-op drop is what terminates N-way echo loops — it is a correctness feature that happens to be the perf feature); events coalesce per (entity, field) via `onCommit` + superseding jobs; fan-out is always queued, never inline in the write path.

**Postgres specifics** (the template is already on Postgres — be deliberate about what Zealot inherited implicitly from MySQL):
- Blobs: `jsonb` for `fieldConfig` / `valueJson` / `valueMeta` — TOASTed out-of-line, so sorting the definitions table never drags a blob through the sort (the errno-1038 class doesn't exist here); GIN-index `valueJson` only if a consumer queries into it.
- Soft-delete + uniqueness: **partial unique indexes** (`WHERE "deletedAt" IS NULL`) on the map's `(brandUuid, customFieldDefinitionUuid, integrationSourceUuid)` and the identity coordinate — the deleted+live-pair problem the Zealot RFC left open is one line here.
- Collation: Postgres equality is case- and accent-**sensitive** by default; Zealot's `0900_ai_ci` made label joins and email identity insensitive implicitly. Decide explicitly per column: `citext` (or an ICU nondeterministic collation) for `label`, `fieldKey`, `identityValue`, vocabulary `value`; leave everything else sensitive. json-rules already gates `mode: 'insensitive'` on the provider.

---

## Proposed template schema (sketch — settle the open decisions first)

```prisma
model CustomFieldDefinition {
  uuid          String   @id @default(uuid()) @db.VarChar(36)
  brandUuid     String   @db.VarChar(36)
  targetModel   String   @db.VarChar(50)          // Prisma model name, DMMF-validated
  fieldKey      String   @db.VarChar(100)
  label         String   @db.VarChar(200)
  valueType     EnrichmentValueType               // text | number | date | json  (storage)
  displayType   String?  @db.VarChar(30)          // control; independent of valueType
  fieldConfig   Json?                             // small; NEVER an option list
  position      Int
  isSystem      Boolean  @default(false)
  isIdentity    Boolean  @default(false)
  isSegmentable Boolean  @default(true)
  materialization Json?                           // the policy (precedence + conditions), not a boolean
  createdAt / updatedAt / deletedAt
  @@unique([brandUuid, targetModel, fieldKey])
  @@index([brandUuid, targetModel, position])
}

model IntegrationSource {   // one per platform per brand; `profile` and `system` seeded
  uuid, brandUuid, label, isSystem, isActive, syncDirection, sourceMeta Json?, deletedAt …
  @@unique([brandUuid, label])
}

model IntegrationMap {      // one per (brand, field, source); cfd null = raw dump on that source
  uuid, brandUuid, customFieldDefinitionUuid?, integrationSourceUuid, aliasKeys Json?, deletedAt …
  @@unique([brandUuid, customFieldDefinitionUuid, integrationSourceUuid])
}

model Enrichment {          // one contribution per (brand, entity, map)
  uuid, brandUuid, integrationMapUuid
  valueText String? @db.LongText
  valueNumber Decimal? @db.Decimal(38, 10)
  valueDate DateTime? @db.DateTime(3)
  valueJson Json?
  valueMeta Json?, sourceUpdatedAt?, ingestedAt?
  identityValue String? @db.VarChar(255), identityScopeUuid String? @db.VarChar(36)
  <model>Uuid String? … one nullable FK per bridged model (exclusive arc)
  @@unique([brandUuid, <model>Uuid, integrationMapUuid]) per arc
  @@unique([brandUuid, identityScopeUuid, identityValue])
  @@index([integrationMapUuid, valueNumber]) @@index([integrationMapUuid, valueDate])
}

model EnrichmentVocabulary { // observed + offered values; `seen` flips on first observation
  uuid, brandUuid, customFieldDefinitionUuid, integrationSourceUuid?, value, seen Boolean, coverage Int, excluded Boolean …
  @@unique([brandUuid, customFieldDefinitionUuid, integrationSourceUuid, value])
}
```

Plus: `originUuid → IntegrationSource` on every bridged model; `packages/db/src/registries/enrichmentValueColumns.ts` + `differentiateEnrichmentValueTypeArgs`; `ensureMap` / contribution writer / `resolveIdentityCoordinate`; the lens narrowing for `enrichments` with the relation-level wheres and the 3-level `sources`; system-field seed (upsert-only) + validation job; `position` + reorder endpoint.

---

## Tasks

### Schema + primitives
- [ ] The five models above, uuid-keyed, brand-scoped, typed columns only (no `value` text fallback)
- [ ] `originUuid` on the first bridged model (FanUser/Contact equivalent) — the pattern every later model copies
- [ ] `enrichmentValueColumns` registry + `differentiateEnrichmentValueTypeArgs`, called unconditionally from `paginate` and the rules compiler
- [ ] `ensureMap` (the only map creator) + contribution writer (typed column by declared type; exclusive-arc switch on `targetModel`) + `resolveIdentityCoordinate`
- [ ] Vocabulary writer (`seen` flip on observation; seed-time `seen: false` rows from an integration's describe)

### Definitions
- [ ] System-field registry, per-brand upsert-only seed, drift-validation job — one seed path
- [ ] `position` + atomic reorder endpoint, one mixed sequence, JS-side never needed because `fieldConfig` stays small
- [ ] Create/update validation: collision with live/system field, immutable system `displayType`, `targetModel` ∈ DMMF

### Reads
- [ ] `resolveFieldValue` (intrinsic → profile → precedence) as the v1 read; materialized store designed (schema reserved), materialization policy on the definition
- [ ] Typed hydration for the in-memory evaluator (`readEnrichmentValue` → JS number/Date, never strings)

### Lens / rules / search
- [ ] `enrichments` narrowing on the anchor lens: brand bind + soft-delete wheres on the relation, `picks`, 3-level `sources` groupBy
- [ ] Facets: per-source container, per-field cards, field selectors, presets with variables (INFRA-029) — the Zealot `segmentDecoration.ts` shape, minus its side-channel
- [ ] Global search / paginate traverse `enrichments` with the relation wheres (visit-wheres fold)

### Performance (the landmines, as work items)
- [ ] Materialized read table = the ONLY surface for sort-by-field, cursor pagination, and aggregates; custom-field sort is not offered until it exists
- [ ] Batch-first hydration helper (page of entities → one fetch → pivot) — the contract INFRA-014 documents; no per-entity enrichment queries anywhere
- [ ] Set-based reconcile (toPrisma, one query per segment) primary; event-driven incremental reconcile keyed off materialized-value changes + which segments reference the field; nightly sweep as backstop
- [ ] No-op materialization drop + per-(entity, field) event coalescing (`onCommit` + superseding job); queued fan-out only
- [ ] Partial unique indexes on soft-deleted uniques; `jsonb` blobs; explicit `citext`/ICU collation on label/key/identity/vocabulary columns
- [ ] A seeded perf fixture (1 brand × 50 fields × 100k entities × 3 sources) with EXPLAIN assertions on: segment compile, sort-by-field, two-axis aggregate — so regressions fail a test, not production

### Docs
- [ ] "When to EAV" rule + the anti-patterns list (guard flags, vendor columns, option blobs, dual maps, read-time-as-bridge) in `docs/`

---

## Open Questions

- **Where does `valueType` live?** Zealot declares storage type on the map (`IntegrationMap.valueType`, per source) and a display type on the definition; they can disagree. One declaration on the definition, with the pin traversing `integrationMap.customFieldDefinition` (two hops from the row), vs. keeping it on the map (one hop, per-source override possible). Lean: definition — a field has one type; a source that sends something else is a coercion at the boundary, not a second type.
- **Materialized store in v1?** Contributions + read-time resolution ships first; the materialized row is what bridging and transitions need (FEAT-018) — **and** what landmines 1–3 above hang on (sort, aggregates, incremental reconcile). Reserve the schema now or add later with a backfill?
- **Vocabulary per source or per field?** Zealot's is keyed `(brand, gate, sourceLabel, fieldLabel)`; the lens groupBy is `(source label, field label)`. Keep the source axis (the picker needs it) — confirm.
- **Name**: `CustomFieldDefinition` / `Enrichment` are Zealot's words; `FieldDefinition` / `Contribution` are the RFC's. Pick once; the lens paths (`enrichments.value`) become rule text that outlives the rename.

---

## Related

- **INFRA-014** — Source Primitive: hydrating this table into a json-rules `FieldMap` for `check()` (the EAV pivot). Builds on these tables.
- **INFRA-024** — source → field → value option chain (`sources` axis); the picker this feeds.
- **INFRA-023** — serializable dynamic where + `{ bind }` (brand bind on the enrichment narrowing).
- **INFRA-028** / **INFRA-029** — prose + preset variables over the enrichment facets.
- **FEAT-017** — audit lineage (enrichment values ride the generic rail); **FEAT-018** — transitions (materialized-value change as the driver); **FEAT-019** — actor attribution (`IntegrationSource` as actor).
- **DB-001** — mutation lifecycle transaction identity (the contribution writer runs inside it).
- Zealot: `docs/plans/2026-02-18-custom-fields-api-design.md`, `2026-06-27-integration-bridge-and-enrichment-platform.md`; ZLT-2827, ZLT-3076, ZLT-3214, ZLT-3876, ZLT-4030, ZLT-4062, UE-4162, ZLT-4242, ZLT-4306, ZLT-4324, UE-4176, ZLT-4429; `packages/db/src/registries/enrichmentValueColumns.ts`, `apps/api/src/modules/enrichments/services/contributionWriter.ts`, `apps/api/src/modules/groups/lib/segmentLens.ts`.
