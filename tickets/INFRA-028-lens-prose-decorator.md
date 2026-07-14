# INFRA-028: Lens prose decorator — presentation metadata (labels, icons) for FE + AI

**Status**: 🆕 Not Started — placeholder / problem framing only, no shape decided.
**Assignee**: Aron
**Priority**: Medium (polish over the builder surface; not blocking — surfaces render off raw field paths today)
**Created**: 2026-07-13
**Updated**: 2026-07-13

The lens is the single source of truth for what a surface can reason over — `exposedSurface(lens)` drives the builder surface (INFRA-017), `sourceQueries`/`SourceValues` decorate the option sets (INFRA-024), `checkRuleAgainstLens` gates writes. But a lens carries only field **paths + kinds** (+ enum members); it has no human-facing presentation metadata. This ticket is the **static presentation axis** — the sibling of INFRA-024's dynamic option-value axis.

Motivating consumer: Zealot's segment builder cut its AI condition-generation prompt over from a hand-authored static schema to `exposedSurface(segmentLens)` (ZLT-1470). That killed the second source of truth, but the static schema had also been carrying curated labels (`Points Balance` for `pointsAmount`) — so today the FE title-cases raw paths and the AI sees raw field names, and there's nowhere to hang a per-field icon. Zealot tracker: **ZLT-3633**.

---

## The pull

Two consumers want the same thing the lens doesn't carry:

- **FE rule builder** — a display label + icon per field/relation, instead of a title-cased path.
- **AI prompt builder** — human labels in the field-path listing so the model reasons over `Points Balance`, not `pointsAmount`.

Both are **presentation only**. Hard constraint: a decorator entry must never widen or narrow what's segmentable — the lens `picks` stay the sole authority for the security/validation surface. A field the lens doesn't expose has no decorator; a decorator can't expose a field.

## Worked example — a custom-field / integration-map field (sources + prose together)

The field that most needs this decorator is also the one that most needs a **source** (INFRA-024), so the two axes are easiest to see side by side. This is grounded in Zealot's real `segmentLens` (`apps/api/src/modules/groups/lib/segmentLens.ts`) and the json-rules source primitive (`sources?` on a narrowing → `sourceQueries(lens)`; `runSources` in `rules-builder/src/schema/sources.ts`).

**The data chain.** A brand's custom fields aren't dedicated columns — they ride the `enrichments` relation:

```
FanUsers.enrichments → FanUserEnrichment { value, integrationMapUuid, brandUuid }
  → IntegrationMap { uuid, brandUuid, customFieldDefinitionUuid, integrationSourceUuid, source }
    → CustomFieldDefinition { fieldKey, label, valueType, displayType, isSegmentable }
```

So the condition a brand admin actually wants — *"fans whose **[Business Unit]** (from **[Salesforce]**) is **[EMEA]**"* — is `enrichments SOME { integrationMapUuid = <map for (source=SFDC, cfd=BusinessUnit)> AND value = 'EMEA' }`. The `enrichments` node already exists in the lens, brand-bound:

```ts
enrichments: {
  picks: ['value', 'integrationMapUuid', 'sourceUpdatedAt'],
  where: { field: 'brandUuid', operator: 'equals', bind: 'brandUuid' },
},
```

**Setting up the sources.** To make `integrationMapUuid` and `value` constrained pickers instead of free-text UUIDs, add a `sources` entry per field (`fieldName → Condition | SourceSpec`). `sourceQueries` compiles each to `SELECT DISTINCT(field) FROM <model> WHERE <node-narrowing ∧ source-where>`; the app runs it (`toPrisma`/`toSql`, already brand-scoped because the `brandUuid` bind resolved *into* the lens first) and folds the result back as `SourceValues`. Two problems surface immediately, and they are exactly INFRA-024's three open questions:

1. **All-configured, not used-only (Q1).** A bare `sources: { integrationMapUuid: true }` on the `enrichments` node compiles `DISTINCT(integrationMapUuid)` over **FanUserEnrichment** — only maps some fan already has a value for. The builder wants every **configured** map for the brand (the `IntegrationMap` set, which also carries the clean `brandUuid` column and the `customFieldDefinitionUuid`/`integrationSourceUuid` pairing). Per json-rules, a referenced-model option set is declared at a **relation-traversed narrowing node** so it compiles over whatever model the path resolves to — i.e. traverse `enrichments.integrationMap` and source `uuid` there, not on the enrichment column.

2. **The label lives one hop past the source (Q2).** `SourceSpec.label` is a **sibling column on the same model** — but the human label for a map is `CustomFieldDefinition.label` ("Business Unit"), one relation beyond `IntegrationMap`. Same for `integrationSource.source` ("Salesforce"). Today the source can only self-label from a column on `IntegrationMap`; the curated cross-model label is the records/labels gap. This is also where the **prose decorator earns its keep**: the CFD row already carries curated `label` + `displayType` (→ icon), so the decorator is the natural static carrier for a custom field's presentation, keyed off the resolved `customFieldDefinitionUuid` — the raw builder path (`enrichments.integrationMapUuid`) is an opaque UUID with nothing human on it.

3. **`value` is scoped by the map you picked (Q3).** The option set for `value` is `DISTINCT(value)` over FanUserEnrichment **for the chosen `integrationMapUuid`** — a dependent/cascading source. `sourceQueries` materializes each sourced field independently; it has no notion of coordinate B narrowed by coordinate A. This is the hard one.

**Takeaway for this ticket.** The decorator (labels/icons) and the source (values) are separate axes but meet on exactly this field: for a custom field the decorator's `label`/`icon` should resolve from the bridged `CustomFieldDefinition` (`label`, `displayType`), while the selectable values come from the source. Whatever keying INFRA-024 settles for cross-model source labels, the decorator should mirror it (see Q2 below) so a CFD is described once, not twice. The value-set mechanics themselves are **INFRA-024's** to define — this ticket only owns the static label/icon.

## Open questions (shape TBD)

1. **Where does it live?** A parallel `prose?: Record<path, { label?; icon?; help? }>` on the narrowing? A separate decorator map resolved alongside `exposedSurface`? Or ride the projection the way `sourceValues` does (INFRA-017 already folds `{ lens, sourceValues }`) → `{ lens, sourceValues, prose }`?
2. **Keying.** By full path (`fanMissions.brandMissionUuid`) vs by `(mapName, model, field)`? Path is surface-specific; `(model, field)` is reusable across surfaces — mirror whatever `SourceValues` settles on (INFRA-024 Q2).
3. **Localization.** Labels are user-facing copy → single string or a locale key (FEAT-006)? Placeholder assumes plain strings for MVP.
4. **Icons.** Icon identifier (name in a shared set) vs asset ref — a presentation-registry concern, probably not the lens's to own.

## Not in scope

Choosing the mechanism; json-rules / rules-builder implementation planning (a `FEAT-*` once a direction is picked). Dynamic per-brand option **values** — that's INFRA-024. This ticket names the static presentation axis and keeps it distinct from both the security surface (`picks`) and the option-value surface (`sources`).

## Related

- **INFRA-017** — Builder Surface (`exposedSurface`); the consumer + likely carrier of the decorator.
- **INFRA-024** — `sourceQueries` richer option sets; the *dynamic* sibling axis (values) where this is the *static* one (labels/icons). Owns the value-set mechanics in the worked example above.
- **INFRA-014** — Source Primitive (EAV/custom-field *table hydration*); the custom-field chain in the worked example is the surface it hydrates.
- **FEAT-006** — Localization (labels are user-facing copy).
- **ZLT-3633** — Zealot-side tracker (segment builder lost curated labels/icons on the AI cutover).
- **ZLT-1470** — the cutover that surfaced this (AI prompt now derives from `exposedSurface(segmentLens)`).
