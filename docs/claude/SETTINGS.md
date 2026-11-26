# Settings & Attribute Model Capability

Template provides a reusable, Narrow Layer 1 (values-table) **Attribute** model capability (`packages/db/src/lib/attributes/`) modeled directly on the encrypted-fields capability (`packages/db/src/lib/encryption/`), with `Setting` (`packages/db/prisma/schema/setting.prisma`) as its first registered model.

---

## Attribute Model Capability (`packages/db/src/lib/attributes/`)

Every Prisma model registered in `ATTRIBUTE_MODELS` (`packages/db/src/lib/attributes/registry.ts`) carries the uniform 5-column typed value contract:

- `valueBoolean Boolean?`
- `valueText String?`
- `valueNumber Float?`
- `valueDate DateTime?`
- `valueJson Json?` (with `@@index([valueJson], type: Gin)` for `multiSelect` `array_contains` queries)

No `valueType` discriminator column is required on the row: the type, options and conditions live in the definition layer above (the setting trees for `Setting`, or a future DB definition table via `locatorField`). Both `locatorField` and `valueTypeField` are optional on `AttributeModelConfig` so `Setting` (`locatorField: 'key'`) and future custom attribute value tables share the exact same capability.

- **Model registry (`packages/db/src/lib/attributes/registry.ts`)**: `ATTRIBUTE_MODELS` declares each model's optional `locatorField`, `valueTypeField`, `resourceModelField`, `disabledField`, and definition lookups: `resolveDefinition(locator)` (what a locator means, for reading and encoding) and optional `fetchDefinitionForRow(row)` (the definition the row's own resource holds, for the write check). Exposes `isAttributeModel()`, `attributeModelConfig()`, and `attributeFieldsByModel()` (mirroring `encryptedFieldsByModel()`).
- **Shared resolver (`packages/db/src/lib/attributes/resolveAttributeTarget.ts`)**: `resolveAttributeTarget()` is the single shared lookup used by both writers and query operators, resolving `{ config, definition, locatorFilter, valueType, column }` (supporting both code-defined registries and caller-supplied definitions).
- **Schema & index validator (`packages/db/src/lib/attributes/validation/`)**: atomic checks (`checkAttributeColumns`, `checkAttributeScalarIndexes`, `checkAttributeGinIndex`) composed into `attributeModelViolations()` and throwing `validateAttributeModels()`, verifying against `prismaMap` (`packages/db/src/generated/prismaMap.gen.ts`) and the Prisma schema (stripping comments) that every registered model has all 5 optional non-list typed columns with exact scalar types, leading scalar value indexes (`[column]` or `[locatorField, column]`), and a Postgres `GIN` index on `valueJson`.
- **Parsing (`packages/db/src/lib/attributes/parsing/`)**: `unpackAttributeValue(row, valueType?)`, `decodeStoredAttributeValue(model, row)`, and `decodeAttributeValue(model, row)` read the active typed value (falling back to `defaultValue` when disabled or unset).
- **Writing (`packages/db/src/lib/attributes/writing/`)**:
  - `packAttributeValue(valueType, value)`, `encodeAttributeColumns(model, locator, value)`, and `buildAttributeUpsertData(model, locator, value)` validate against `valueType` (`boolean`, `text`, `number`, `date`, `json`, `multiSelect`), optional `options` and optional json-rules `conditions`, deduplicate & canonically sort `string[]` for `multiSelect` (while leaving plain `json` arrays untouched), populate the matching typed column, and clear sibling columns to `null` (`Prisma.DbNull` for `valueJson`; `Prisma.JsonNull` is rejected).
  - `validateAttributeWrite(model, row)` throws `AttributeValidationError` on invalid writes (mapped to HTTP 422 in `errorHandlerMiddleware`).
- **Typed Prisma operators (`packages/db/src/lib/attributes/operators/`)**: atomic operator modules (`whereEquals.ts`, `whereIn.ts`, `whereRange.ts`, `whereMultiSelect.ts`, `orderBy.ts`) reusing `resolveAttributeTarget()` + `parseAttributeValue()`:
  - `attributeWhereEquals(model, locator, value)` (canonical sorted set equality on `multiSelect`)
  - `attributeWhereIn(model, locator, values)`
  - `attributeWhereRange(model, locator, range)` (`gt`, `gte`, `lt`, `lte` for `number` and `date`)
  - `attributeWhereMultiSelectContains`, `attributeWhereMultiSelectContainsAll`, `attributeWhereMultiSelectContainsAny` (`valueJson: { array_contains: ... }`, utilizing Postgres `GIN`)
  - `attributeOrderBy(model, locator, direction)` (scalar `valueType`s: `boolean`, `text`, `number`, `date`)
- **Write-time invariant hook (`packages/db/src/lib/attributes/hook.ts`)**: `registerAttributeValidationHook()` uses shared `applyWriteDataOverPreviousRow` (`packages/db/src/utils/applyWriteDataOverPreviousRow.ts`) and generic `isTombstoneOnlyUpdate` (`packages/db/src/utils/isTombstoneOnlyUpdate.ts`, covering soft-deletes and revives `{ deletedAt: null }`) to refuse a locator the row's resource doesn't hold (`fetchDefinitionForRow`), enforce `validateAttributeWrite()`, canonicalize `multiSelect` arrays (including scoped `updateManyAndReturn`), and normalize `date` values on `create`, `createManyAndReturn`, `update`, `updateManyAndReturn`, and `upsert`. Each model's `locatorField` is refused on update via `ImmutableFieldsOverrides` (`apps/api/src/hooks/immutableFields/registry.ts`).
- **Browser-safe shared protocol (`packages/shared/src/attributes/`)**: split into atomic `typing/` (`ATTRIBUTE_VALUE_TYPES`, `ATTRIBUTE_FIELD_KIND_BY_VALUE_TYPE`, `AttributeFieldDefinition` with optional `options` and `conditions`, `AttributeValidationError`), `parsing/` (`parseAttributeValue`, `parseAttributeDate`, `deduplicateMultiSelect`, `isStringArray`, `attributeColumnForValueType`, `decodeAttributeColumnValue`, `populatedAttributeColumns`), and `writing/` (`encodeAttributeValue`, `validateAttributeValue`, `validateAttributeTypedColumns`) with zero Prisma dependencies.

---

## `Setting` & `ProjectIntegration` Primitives

- **Dual polymorphism on `resourceModel` (`packages/db/prisma/schema/setting.prisma`)**: Attaches to all 8 resource models — `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`, `Project`, `Integration`, and `ProjectIntegration` — via `SettingResourceModel`, non-nullable `resourceId`, and typed FKs, registered in `PolymorphismRegistry` (`packages/db/src/registries/falsePolymorphism.ts`) and `ParentEdgeRegistry` (`packages/db/src/registries/parentEdges.ts`).
- **`ProjectIntegration` (`packages/db/prisma/schema/projectIntegration.prisma`)**: Links a `Project` to an `Integration` within the same tenant boundary (enforced by `projectIntegrationOwner` in `apps/api/src/hooks/projectIntegrationOwner/hook.ts` and tombstoned on cross-org space transfer in `apps/api/src/modules/inquiry/services/transferSpace/index.ts`). Registered in `ParentEdgeRegistry` (`ProjectIntegration → Project`), `AUDIT_ENABLED_MODELS`, and `db:ProjectIntegration` ReBAC (`create` requires `project:manage` + `integration:operate`; `delete` allows `project:manage` OR `integration:manage`). Linking is an upsert on a plain `(projectId, integrationId)` unique: linking twice returns the link, and linking a removed one revives it with what was deleted with it.
- **Partial unique indexes**: One active row per `(resource, key)` (`WHERE "resourceModel" = '...' AND "deletedAt" IS NULL`), isolating every arm and freeing keys immediately on soft-delete.
- **Definitions** are the setting trees below.

---

## Setting trees: how settings are defined and namespaced

Decided with Aron 2026-11-25 (R-2026-11-25-04), template #338.

### What it is for

A setting is a value a resource holds: a user's timezone, a Chorus integration's L1 box limits. This layer says which settings exist on which resource, under what key, with what values allowed, and who may read and change them. It does not cascade: a reader that wants "the link's value, else the integration's, else the default" builds that itself. Rules across settings (min ≤ max) belong to the feature that owns them.

### The shape

`SETTING_TREES` (`packages/shared/src/settings/trees.ts`) holds one tree per resource model. Every key in a tree is one of three shapes:

| Key | Example | Is |
|---|---|---|
| `__name` | `__read`, `__manage`, `__label` | metadata of that branch or leaf |
| `field:value` | `provider:chorus`, `family:google` | a kind branch: applies only when the resource's `field` is `value`; adds nothing to the key |
| anything else | `general`, `l1`, `boxesMax` | a branch, or a leaf when it has `valueType` |

A leaf is `valueType` (`boolean`, `text`, `number`, `date`, `multiSelect`; no `json` settings), `defaultValue`, `label`, `description`, and optionally `options` (`{ value, label }[]`) and `conditions` (a json-rules condition on `{ value }`). A value must be of its type, AND one of `options` when there are options, AND pass `conditions` when there are conditions (`validateAttributeValue`, the same function on server and client). Trees are plain data: `/setting/info` serves them as written.

```ts
Project: {
  __read: 'read',
  __manage: 'manage',
  general: { __label: 'General', defaultTimezone },  // a plain const, reused across trees
},
ProjectIntegration: {
  __read: 'read',
  __manage: 'manage',
  'provider:chorus': {
    chorus: {
      l1: { boxesMax: { valueType: 'number', defaultValue: 1, label: 'Maximum boxes', description: '…',
        conditions: { field: 'value', operator: Operator.lessThanEquals, value: 20, error: 'At most 20' } } },
      enabled: { valueType: 'boolean', defaultValue: true, label: 'Enabled', description: '…', __manage: 'operate' },
    },
  },
},
```

### The rules

- **A key is the leaf's full path** from the top of the tree (`general.defaultTimezone`, `chorus.l1.boxesMax`), skipping `__` and `field:value` keys. It is stored as is in `Setting.key`.
- **`settingAt(tree, key, kinds)`** reads the path down to the leaf, then walks back up: the nearest `__read` / `__manage` wins (`read ??= node.__read`). Every root sets both, so every leaf has both. A kind branch's own `__read` / `__manage` count for the settings under it.
- **`settingsIn(tree, kinds)`** lists every setting a resource holds, in declaration order. `'every'` as kinds includes every kind branch: what a tree can ever hold.
- **`settingChildrenFor(branch, kinds)`** is the one place kinds are handled: a branch's own children plus those of its matching kind branches, branches of one name merged.
- **Kinds of an integration or link** are `settingKindsOfProvider(provider)`: `provider`, and `family` from `providerFamily` in `@inixiative/integrations` (`google` for `drive`, the provider itself otherwise). The server reads them with `fetchSettingResourceKinds`.
- **Order is declaration order.** JavaScript keeps string keys in insertion order through JSON; integer-like names are refused.
- **One meaning per key:** wherever a key is placed it has the same type, options, conditions and default; permissions may differ by model, but not across one model's kinds.
- **Shared pieces are plain consts** placed with spread or by reference.
- **Typed keys:** `SettingKeyOf<'Project'>` is the union of a model's keys, derived from its tree.

### Where it is used

- **Write check, once, in the attributes layer:** `ATTRIBUTE_MODELS.setting.fetchDefinitionForRow` (`fetchSettingDefinitionForRow`) reads the row's resource kinds and asks `settingAt`; nothing there refuses the write (`AttributeValidationError`, 422), otherwise the value is checked against it. Every writer meets it. A revive (`{ deletedAt: null }` only) skips it; a revived row whose key a tree has since dropped stays out of sight, since readers list only what the tree holds.
- **`db:setting`** (`settingResourcePermissionFromTrees`): per key, per model holding it, the leaf's `manage` (and `read`, or `manage`) on `resource<Model>`. A batch `PATCH` key the tree doesn't hold has no rule; the service answers that denial with 422 after asking `fetchSettingDefinitionForRow`, and 403 otherwise.
- **Reads:** the list route returns the stored settings the caller can read, limited to `settingsIn` for the resource's kinds (`?path=` narrows to a branch, `isSettingKeyUnderPath`). The frontend decides what it can manage from each leaf's `manage`.
- **UI:** `assembleResourceSettings` joins `settingsIn` with the rows; `SettingTreeView` renders the tree with `settingChildrenFor` (labelled branches as headings, leaves as `SettingField`s), optionally one branch with `path`. `SettingField` offers `options` as a select or pills and shows a failing condition's message.

### Known holes

- No `json` settings: conditions can check fields of an object but not forbid other keys.
- A `date` value is any date the type parse reads; there is no stricter date format.

---

## API Surface (Parent-Scoped Raw `GET`, Atomic Batch `PATCH`, Single `DELETE`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/setting/info` | Public master-data discovery: `types.trees`, one setting tree per resource model, as written (`settingInfoRoute`). |
| `GET` | `/api/v1/{me\|organization/:id\|organizationUser/:id\|space/:id\|spaceUser/:id\|project/:id\|integration/:id\|projectIntegration/:id}/settings` | Returns **raw `Setting[]`** (`SettingScalarSchema`) for the parent resource, gated by `validatePermission('read')` on the parent, backed by Redis `fetchThroughCache` on `cacheKey('setting', { resourceModel, resourceId })` (automatically invalidated by `cacheKeysByModel.Setting`), and limited to what the resource's tree holds for its kinds, and filtered in memory per key via `readResourceSettings()` (`db:Setting:read`). Filterable by `path` (a key-path prefix) and `key`. |
| `PATCH` | `/api/v1/{me\|organization/:id\|organizationUser/:id\|space/:id\|spaceUser/:id\|project/:id\|integration/:id\|projectIntegration/:id}/settings` | Atomic batch upsert (`Array<{ key, value, disabled? }>`) via `upsertResourceSettings()`: rejects empty arrays and duplicate keys (422), authorizes all keys upfront (`db:Setting:manage`, 403; a key the resource's tree doesn't hold is 422), sorts keys lexicographically, locks via `db.findForUpdate(..., { upserting: true })` inside `db.txn`, and returns **raw `Setting[]`**. |
| `GET` | `/api/v1/setting/{id}` | Read a single raw stored setting row (`settingReadRoute`, `validatePermission('read')`). |
| `DELETE` | `/api/v1/setting/{id}` | Soft-delete a stored setting row to reset it to its default (`settingDeleteRoute`, `validatePermission('manage')`). |
| `GET` | `/api/admin/setting` | Superadmin paginated listing of all stored setting rows (`adminSettingReadManyRoute`). |
| `GET` / `POST` | `/api/v1/project/{id}/projectIntegrations` | List or link an Integration to a Project (`projectReadManyProjectIntegrations`, `projectCreateProjectIntegration`). |
| `GET` / `DELETE` | `/api/v1/projectIntegration/{id}` | Read or soft-delete a `ProjectIntegration` link (`projectIntegrationRead`, `projectIntegrationDelete`). |

---

## Frontend Cardi-Style Master Data & Settings UX (`packages/ui/`)

- **Client-side assembly (`packages/shared/src/settings/assemble.ts`)**: `assembleResourceSettings(catalog, rawRows, resourceModel, { kinds?, path?, keys? })` lists the resource tree's settings in declaration order with raw `Setting[]` values and defaults; `diffSettingDrafts(assembled, drafts)` computes the minimal dirty batch `PATCH` payload.
- **Master-data preload & hook (`packages/ui/src/lib/masterData/`)**: `setting` (`/api/v1/setting/info`) is registered in `MASTER_DATA_ENTRIES` so it preloads in the authenticated startup batch alongside other `/info` catalogs (`POST /api/v1/batch/execute`), consumed via `useSettingInfo()` / `useSettingCatalog()` with infinite `staleTime`/`gcTime` and individual fallback fetch.
- **Context & target queries (`packages/ui/src/lib/settingContextQueries.ts`)**: `settingContextQueries` (for `User`, `Organization`, `OrganizationUser`, `Space`, `SpaceUser`) + `settingQueriesForTarget()` (for `Project`, `Integration`, `ProjectIntegration`) + single-row `settingDelete`.
- **Reusable components (`packages/ui/src/components/settings/`)**: `<SettingField>` renders all 6 `AttributeValueType`s (`SearchableSelect` when enum options `> 12`, `Select` when `<= 12`, `Input`, checkbox, `datetime-local`, checkbox pills, validated JSON textarea) with read-only `disabledText` and single-row Reset (`DELETE`); `<SettingTreeView>` renders a resource's tree (or one branch with `path`) with raw rows, dirty-diff batch Save and each leaf's `manage` checked on the hydrated resource (`packages/ui/src/lib/hydrateRecordForPermissions.ts`). `SettingsPage` (Settings → Settings, `/settings/settings` in `web`, `admin` and `superadmin`) renders the tree of wherever you are, plus your membership's in an organization or space; Profile keeps name, password and two-factor. It is also mounted in `IntegrationsPage`, `ProjectDetailPage` and `ProjectIntegrationsSection`.
- **Projects & ProjectIntegrations UI (`packages/ui/src/pages/ProjectsPage.tsx`, `ProjectDetailPage.tsx`, `packages/ui/src/components/projects/ProjectIntegrationsSection.tsx`, `packages/ui/src/lib/projectContextQueries.ts`)**: 3-scope project listing/creation, nested routes (`/projects`, `/projects/$id/settings`, `/projects/$id/integrations`) across `web`, `admin`, and `superadmin`, containment-grouped connectable integrations, expandable per-link `<SettingTreeView>` + `renderProjectIntegrationResources` extension slot.
