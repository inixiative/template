# INFRA-052: Attribute definitions from one fetch (code registry or table)

**Status:** Design approved (Aron, 2026-11-26: "i approve your proposal"), revised after the four-pass plan review the same day. Not started; built after template#338 merges.
**Repos:** `inixiative/template`, then Kingdom. Zealot's custom fields are the table case it must fit.
**Related:** `FEAT-020` (custom fields), `INFRA-051` (attribute filtering through json-rules), template#338 (setting trees).

## Problem

`AttributeModelConfig` (`packages/db/src/lib/attributes/types.ts`) has two ways to get a row's definition:

| Lookup | Can reach | Called by |
|---|---|---|
| `resolveDefinition(locator)`, sync | code only | `encodeAttributeColumns` via `resolveAttributeTarget` (the live Setting write path: `upsertResourceSettings`, then `buildAttributeUpsertData`), the decoders, the `operators/` builders, and the hook's `updateManyAndReturn` before-hook and fallback |
| `fetchDefinitionForRow(row)`, async | anything | the write hook only |

- **Tables can't reach the read paths.** A table-backed definition (Zealot's custom fields) can validate writes, but nothing sync can query it.
- **The Setting write validates twice.** `resolveDefinition` takes the first tree holding the key across every model (`registry.ts`), and the hook checks again against the row's own tree. "One meaning per key" (`settingAt.test.ts`) keeps the two in agreement today, but that is one rule held in two places.

## Design

One async, batched fetch on the config replaces both lookups:

```ts
export type AttributeModelConfig<A extends AccessorName = AccessorName> = {
  readonly model: A;
  readonly locatorField: string;
  readonly fetchDefinitionsByRow: (
    rows: readonly Record<string, unknown>[],
  ) => Promise<(AttributeFieldDefinition | undefined)[]>;
};
```

- **Input order.** Results come back in input order, like `fetchParentRows` (`packages/db/src/utils/fetchParentRows.ts`). Not a `Map` keyed by row, which breaks once the hook merges rows (`applyWriteDataOverPreviousRow`).
- **Rows carry their address.** A row includes the fields that name its definition. For Setting that is `resourceModel`, the resource keys and `key`; for a table it is the owner plus the locator. Callers that only have a locator today build the row-shaped address.
- **Setting:** `fetchSettingDefinitionsByRow` replaces `fetchSettingDefinitionForRow`.
  - It groups rows by resource and reads each resource's kinds once, through `fetchCachedRecordWithTargetEntitlements` (already cleared by `cacheKeysByModel.Integration`), not one `findUniqueOrThrow` per row.
  - A missing integration is a 422, not a 500.
- **Table (custom fields):** `fetchCustomFieldDefinitionsByRow` follows Zealot's `enrichmentValueTypesForMaps` (`apps/api/src/modules/enrichments/services/resolveEnrichmentValueColumns.ts`).
  - One `findMany` over the deduplicated locators, scoped by the row's owner.
  - A definition from another owner counts as missing.
  - Name the locator (`integrationMapUuid`), the join to the definition and the `valueType` mapping when it is built.
- **Through the scoped `db`.** A definition written in the same transaction is visible. Caching, if any, is `fetchThroughCache`, with the definition model in `cacheKeysByModel`.

### Policy the plan review asked to fix

| Case | Rule |
|---|---|
| Deleted definition, write | Refused (`attribute_locator_not_held_by_resource`). |
| Deleted definition, read | Decode still reads it (inside `db.withDeleted`), so stored values don't silently lose their type. |
| A definition's `valueType` changes while rows exist | Refused (or it migrates them). Otherwise the decoder reads the wrong column and returns null. |
| `updateManyAndReturn` with one `data` for many rows | The before-hook fetches definitions for the `previous` rows. It refuses when they disagree on `valueType`; otherwise it normalizes once. |
| `createManyAndReturn` | One batched fetch, not one per row. |

### Delete instead of making async

These have no callers outside `packages/db/src/lib/attributes/` (grep, 2026-11-26). INFRA-051 replaces them with json-rules filtering.

- **The `operators/` where and orderBy builders**, with their tests. The GIN `array_contains` intent moves to INFRA-051.
- **`decodeAttributeValue` and `decodeStoredAttributeValue`.** Setting reads decode in `assemble.ts` with `decodeAttributeColumnValue`.
- **`resolveAttributeTarget`.** `encodeAttributeColumns` and `buildAttributeUpsertData` become one function that takes the fetched definition. The hook stays the one validator.
- **`valueTypeField`.** No model uses it, and every model now has a definition fetch.
- **The `updateManyAndReturn` before-hook's locator guess** from a scalar `where` (`extractScalarWhereValue`).
- **`RegisterAttributeValidationHookOptions.resolveDefinition`, the test override.** Tests register a fetch on the config, so tests and production take one path.

Kept: `locatorField`, which the immutable-fields registry, `attributeFieldsByModel` and the scalar-index check use. Review whether `resourceModelField` and `disabledField` still earn their place once the fetch carries the resource.

## Existing primitives used

| Concern | Primitive |
|---|---|
| Model registry | `ATTRIBUTE_MODELS` (`packages/db/src/lib/attributes/registry.ts`) |
| Batched per-row reads in input order | `fetchParentRows` (`packages/db/src/utils/fetchParentRows.ts`) |
| Cached integration reads | `fetchCachedRecordWithTargetEntitlements`, `cacheKeysByModel` |
| Write validation | the attributes hook (`packages/db/src/lib/attributes/hook.ts`) |
| Value constraints | `validateAttributeValue` (options + json-rules conditions) |

## Deferred: generic attribute helpers on the frontend and in assembly

Aron, 2026-11-27: "For the front end, let's start with just the front-end setting stuff. Once we have more attribute stuff, we can think about duplicating them. We should probably add some sort of note that we're deferring extracting front-end settings."

- `SettingField` and `SettingTreeView` stay settings-only, though they already use the shared attribute helpers (`validateAttributeValue`, parsing, typing). An attribute-generic field component is extracted when custom fields need one, not before.
- The tree walkers (`settingAt`, `settingsIn`, `settingChildrenFor`, `settingNodesAlongKey`) are about the tree shape and stay in settings. `assemble.ts` (stored rows to typed items) may be attribute-generic: decide when this is built.

## Docs to rewrite

`docs/claude/SETTINGS.md`, where it names `resolveDefinition` and `fetchDefinitionForRow`.
