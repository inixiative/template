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

No `valueType` discriminator column is required on the row: the type and optional schema live in the definition layer above (the setting trees for `Setting`, or a future DB definition table via `locatorField`). Both `locatorField` and `valueTypeField` are optional on `AttributeModelConfig` so `Setting` (`locatorField: 'key'`) and future custom attribute value tables share the exact same capability.

- **Model registry (`packages/db/src/lib/attributes/registry.ts`)**: `ATTRIBUTE_MODELS` declares each model's optional `locatorField`, `valueTypeField`, `resourceModelField`, `disabledField`, and definition lookups: `resolveDefinition(locator)` (what a locator means, for reading and encoding) and optional `fetchDefinitionForRow(row)` (the definition the row's own resource holds, for the write check). Exposes `isAttributeModel()`, `attributeModelConfig()`, and `attributeFieldsByModel()` (mirroring `encryptedFieldsByModel()`).
- **Shared resolver (`packages/db/src/lib/attributes/resolveAttributeTarget.ts`)**: `resolveAttributeTarget()` is the single shared lookup used by both writers and query operators, resolving `{ config, definition, locatorFilter, valueType, column }` (supporting both code-defined registries and caller-supplied definitions).
- **Schema & index validator (`packages/db/src/lib/attributes/validation/`)**: atomic checks (`checkAttributeColumns`, `checkAttributeScalarIndexes`, `checkAttributeGinIndex`) composed into `attributeModelViolations()` and throwing `validateAttributeModels()`, verifying against `prismaMap` (`packages/db/src/generated/prismaMap.gen.ts`) and the Prisma schema (stripping comments) that every registered model has all 5 optional non-list typed columns with exact scalar types, leading scalar value indexes (`[column]` or `[locatorField, column]`), and a Postgres `GIN` index on `valueJson`.
- **Parsing (`packages/db/src/lib/attributes/parsing/`)**: `unpackAttributeValue(row, valueType?)`, `decodeStoredAttributeValue(model, row)`, and `decodeAttributeValue(model, row)` read the active typed value (falling back to `defaultValue` when disabled or unset).
- **Writing (`packages/db/src/lib/attributes/writing/`)**:
  - `packAttributeValue(valueType, value)`, `encodeAttributeColumns(model, locator, value)`, and `buildAttributeUpsertData(model, locator, value)` validate against `valueType` (`boolean`, `text`, `number`, `date`, `json`, `multiSelect`) and optional Zod `schema`, deduplicate & canonically sort `string[]` for `multiSelect` (while leaving plain `json` arrays untouched), populate the matching typed column, and clear sibling columns to `null` (`Prisma.DbNull` for `valueJson`; `Prisma.JsonNull` is rejected).
  - `validateAttributeWrite(model, row)` throws `AttributeValidationError` on invalid writes (mapped to HTTP 422 in `errorHandlerMiddleware`).
- **Typed Prisma operators (`packages/db/src/lib/attributes/operators/`)**: atomic operator modules (`whereEquals.ts`, `whereIn.ts`, `whereRange.ts`, `whereMultiSelect.ts`, `orderBy.ts`) reusing `resolveAttributeTarget()` + `parseAttributeValue()`:
  - `attributeWhereEquals(model, locator, value)` (canonical sorted set equality on `multiSelect`)
  - `attributeWhereIn(model, locator, values)`
  - `attributeWhereRange(model, locator, range)` (`gt`, `gte`, `lt`, `lte` for `number` and `date`)
  - `attributeWhereMultiSelectContains`, `attributeWhereMultiSelectContainsAll`, `attributeWhereMultiSelectContainsAny` (`valueJson: { array_contains: ... }`, utilizing Postgres `GIN`)
  - `attributeOrderBy(model, locator, direction)` (scalar `valueType`s: `boolean`, `text`, `number`, `date`)
- **Write-time invariant hook (`packages/db/src/lib/attributes/hook.ts`)**: `registerAttributeValidationHook()` uses shared `applyWriteDataOverPreviousRow` (`packages/db/src/utils/applyWriteDataOverPreviousRow.ts`) and generic `isTombstoneOnlyUpdate` (`packages/db/src/utils/isTombstoneOnlyUpdate.ts`, covering soft-deletes and revives `{ deletedAt: null }`) to refuse a locator the row's resource doesn't hold (`fetchDefinitionForRow`), enforce `validateAttributeWrite()`, canonicalize `multiSelect` arrays (including scoped `updateManyAndReturn`), and normalize `date` values on `create`, `createManyAndReturn`, `update`, `updateManyAndReturn`, and `upsert`. Each model's `locatorField` is refused on update via `ImmutableFieldsOverrides` (`apps/api/src/hooks/immutableFields/registry.ts`).
- **Browser-safe shared protocol (`packages/shared/src/attributes/`)**: split into atomic `typing/` (`ATTRIBUTE_VALUE_TYPES`, `ATTRIBUTE_FIELD_KIND_BY_VALUE_TYPE`, `AttributeFieldDefinition` with optional `schema`, `AttributeValidationError`), `parsing/` (`parseAttributeValue`, `parseAttributeDate`, `deduplicateMultiSelect`, `isStringArray`, `attributeColumnForValueType`, `decodeAttributeColumnValue`, `populatedAttributeColumns`), and `writing/` (`encodeAttributeValue`, `validateAttributeValue`, `validateAttributeTypedColumns`) with zero Prisma dependencies.

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

A setting is a value a resource holds: a user's timezone, an organization's display language, a Chorus integration's L1 box limits. This layer does one job: **say which settings exist on which resource, under what key, with what type, and who may read and change them.** It does not cascade. A reader that wants "the link's value, else the integration's, else the default" builds that fallback itself. It does not check rules that span settings either (L1 minimum at most L1 maximum); the feature that owns them does.

**Why trees.** The flat registry before this tagged each definition with the models it applied to (`resourceModels`), the providers (`integrationProviders`), a category, and per-model permission maps. Four readers filtered on those tags, three checks guarded a write, the key was spelled twice, and nothing tied the key, category and provider together. A tree per model answers "which settings live here" by its shape: a key is either in the resource's tree or it isn't.

### The shape

One tree per resource model. A tree is a nested object. Every key in it is one of three shapes, and the shape says what it is:

| Key shape | Example | What it is |
|---|---|---|
| `__name` | `__read`, `__manage`, `__label` | The tree's own metadata for this branch. Never a setting. |
| `field:value` | `provider:chorus` | A **kind** branch: its contents apply only when the resource's `field` equals `value`. Adds nothing to the key. |
| anything else | `chorus`, `l1`, `boxesMax` | A setting branch, or a **leaf** if its value has a `valueType`. |

A setting's own name never starts with `__`, never contains `:`, and never looks like an integer. A registry test refuses all three.

```ts
// packages/shared/src/settings/pieces/localization.ts: plain consts
export const defaultTimezone = {
  valueType: 'text', schema: TimezoneIdSchema, defaultValue: 'UTC',
  label: 'Default Timezone', description: 'IANA timezone for dates, schedules, digests.',
} as const;
export const displayLocale = { valueType: 'text', schema: LanguageCodeSchema, /* … */ } as const;

// packages/shared/src/settings/trees.ts
export const SETTING_TREES = {
  User:         { __read: 'read', __manage: 'manage', general: { __label: 'General', defaultTimezone, displayLocale } },
  Organization: { __read: 'read', __manage: 'manage', general: { __label: 'General', defaultTimezone, displayLocale } },
  Space:        { __read: 'read', __manage: 'manage', general: { __label: 'General', defaultTimezone, displayLocale } },
  OrganizationUser: {
    __read: 'operate', __manage: 'operate',            // a member sets their own
    general: { __label: 'General', displayLocale },
  },
  SpaceUser: {
    __read: 'operate', __manage: 'operate',
    general: { __label: 'General', displayLocale },
  },
  Project: {
    __read: 'read', __manage: 'manage',
    general: { __label: 'General', defaultTimezone },
  },
  Integration:        { __read: 'read', __manage: 'manage' },
  ProjectIntegration: { __read: 'read', __manage: 'manage' },
  // ==========================================================================
  // TEMPLATE ABOVE: apps add their own branches and kinds below
  // ==========================================================================
};
```

An app (Kingdom) adds its own, for example Chorus:

```ts
const cacheBlock = {
  boxesMin: { valueType: 'number', schema: z.int().min(0), defaultValue: 0, label: 'Minimum boxes' },
  boxesMax: { valueType: 'number', schema: z.int().min(0), defaultValue: 1, label: 'Maximum boxes' },
};

const chorusScaling = {
  __label: 'Chorus',
  l1: { __label: 'L1 cache', ...cacheBlock },
  l2: { __label: 'L2 caches', keep: cacheBlock, full: cacheBlock },   // one piece, placed twice
};

Integration: {
  __read: 'read', __manage: 'manage',
  'provider:chorus': { chorus: chorusScaling },                       // the owner's defaults
},
ProjectIntegration: {
  __read: 'read', __manage: 'manage',
  'provider:chorus': {
    chorus: {
      ...chorusScaling,
      enabled: { valueType: 'boolean', defaultValue: true, label: 'Enabled', __manage: 'operate' },
    },
  },
},
```

### The rules

#### A key is the leaf's path
The path runs from the root to the leaf, joined with `.`, skipping `__` and `field:value` keys. The Chorus example above gives `chorus.enabled`, `chorus.l1.boxesMin`, `chorus.l2.keep.boxesMax`, `chorus.l2.full.boxesMax`. There is no `key:` field to keep in step.

#### A leaf
A leaf is any node with a `valueType`. It carries `valueType`, `schema`, `defaultValue`, `label`, `description`, and optionally its own `__read` / `__manage`. Leaves have no children.

#### Permissions pass down
Every leaf has a `read` and a `manage` permission: what it takes to see the value, and what it takes to set, change or clear it. They are written as `__read` and `__manage`, on the leaf or on any branch above it. The nearest one up the path wins, so a branch sets the default for everything under it and a leaf or deeper branch overrides it. Every root sets both, so every leaf ends up with both; a test checks this.

```
ProjectIntegration           __read: read   __manage: manage
└─ provider:chorus
   └─ chorus
      ├─ enabled             __manage: operate     → read: read, manage: operate
      └─ l1.boxesMin                               → read: read, manage: manage
```

The permissions are ReBAC actions on the resource the setting lives on (`read`, `operate`, `manage`, `own`). The `db:setting` rules are built from them, per key and per model.

#### Kinds: `field:value`
A `field:value` branch applies only when the resource's `field` has that value. It can sit at any depth, nest inside another kind, and pass permission defaults down like any branch. Integration and ProjectIntegration trees switch on two kind fields, given by `settingKindsOfProvider(provider)` (`packages/shared/src/settings/settingKindsOfProvider.ts`) and read on the server by `fetchSettingResourceKinds` (`packages/db/src/lib/settings/fetchSettingResourceKinds.ts`):

| Field | Value |
|---|---|
| `provider` | the integration's `provider`; a link's is its integration's |
| `family` | `providerFamily(provider)` from `@inixiative/integrations` (`google` for `drive` and `gmail`), the provider itself when it has no family |

So `'family:google'` holds settings for every Google product. Other kind fields and families: [FEAT-029](../../tickets/FEAT-029-settings-pages-and-provider-families.md).

A resource whose field is null, or has no matching kind branch, gets only the settings outside every kind branch.

#### Order is declaration order
The order the tree is written in is the order everywhere: the compiled list, `/setting/info` and the UI. JavaScript keeps string keys in insertion order through `Object.keys`, `JSON.stringify` / `JSON.parse` and zod's `z.record` (checked 2026-11-25). The one exception is integer-like keys, which JavaScript moves to the front, and those are refused. There is no `order` field.

#### One meaning per key
A key may appear in many trees (`general.defaultTimezone` on User and on Organization; `chorus.l1.boxesMax` on an integration and on its links). Wherever it appears it has the same `valueType`, `schema` and `defaultValue`, so a reader that falls back from one resource to another reads one key with one meaning. Permissions may differ by tree. A test checks this across all trees.

#### Shared pieces are just consts
`defaultTimezone`, `displayLocale`, `cacheBlock` and `chorusScaling` are exported objects placed with spread or by reference. There is no component registry: nothing looks them up by name. The same piece may be placed twice in one tree (`l2.keep` and `l2.full`); the keys differ by path.

### How it is read

```
SETTING_TREES ──walked per resource──▶ settingDefinitionsForResource(resourceModel, kinds)
                                       │   Record<key, { valueType, schema, defaultValue,
                                       │                 label, description, read, manage }>
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
attributes write check        db:setting ReBAC rules          /setting/info → UI
(packages/db attributes)      (packages/permissions)          (trees, rendered recursively)
```

- **Write check: one, in the attributes layer.** `ATTRIBUTE_MODELS.setting.fetchDefinitionForRow` (`fetchSettingDefinitionForRow`) takes the row being written, reads its resource's kinds, and returns the definition that resource's tree holds for the key. The attributes hook (`registerAttributeValidationHook`) refuses the write when there is none (`AttributeValidationError`, 422) and otherwise checks type and schema against it. Every writer meets it: routes, services, seeds. A revive (`{ deletedAt: null }` only, as the soft-delete cascade writes) skips it, so a revived row whose key a tree has since dropped comes back; readers list only what the tree holds, so it stays out of sight. `resolveDefinition(key)` stays for reading, which needs only what a key means.
- **ReBAC.** `settingResourcePermissionFromTrees(SETTING_TREES)` builds `db:setting`: per key, per model holding it, the leaf's resolved `manage` (and `read`, or `manage`) on `resource<Model>`. A key a model's tree doesn't hold has no rule there; the batch `PATCH` answers that denial with 422 (`fieldErrors['<n>.key']`) when the resource's tree doesn't hold the key, asking the same `fetchSettingDefinitionForRow` the hook uses, and 403 otherwise.
- **`/setting/info`** returns the trees, each leaf's zod schema as JSON Schema (`settingTreeWithJsonSchemas`). `assembleResourceSettings(catalog, rows, resourceModel, { kinds, path, keys })` lists a resource's settings with their values; `SettingTreeView` renders them by walking the tree with the resource's kinds (`settingTreeChildrenForKinds`: matching kind branches inlined, branches of one name merged, so `provider:drive` and `family:google` can both add to `google`): a branch with `__label` becomes a heading, a branch without one only groups, a leaf becomes the input for its `valueType`. It checks the leaf's `manage` action on the resource, the same check the `db:setting` rule makes. Depth doesn't matter.
- **A page renders one branch** with `path` (`<SettingTreeView path="billing" />`, and `?path=` on the list route), replacing the category filter: `isSettingKeyUnderPath`. A `path` naming a leaf shows that one field.

### What goes

`SETTING_DEFINITIONS`, `SETTING_CATEGORIES`, `defineSetting`, `defineSettingCategory`, the `category` field and filter; `resourceModels` and `integrationProviders` on definitions (and `resourceModels`, `category`, `order`, `permission`, `readPermission` on `AttributeFieldDefinition`); per-model permission maps (`{ default, OrganizationUser: 'operate' }`), `SettingPermissionSpec`, `AttributePermissionSpec`, `attributePermissionForModel` and `settingPermissionForModel`; `settingAppliesToIntegrationProvider`; the duplicate `key:` field; `order`; the route-level model check; `definitionsForResourceModel`; the `settingIntegrationProvider` hook and service. Storage does not change: a `Setting` row is still `(resource, key)` with typed value columns.

### What it does not do

- **No cascade.** Fallback across resources belongs to the reader.
- **No checks across keys.** Rules such as min ≤ max, or re-checking links when an integration default changes, belong to the feature that owns the settings.
- **No storage of trees.** Trees are code; only values are rows.

### Tests that hold it
1. Every key is a valid path: no `__` prefix, no `:`, not integer-like.
2. Every leaf resolves both `read` and `manage`.
3. One meaning per key across all trees (`valueType`, `schema`, `defaultValue`).
4. No resource holds two leaves with one key, whatever its kinds (a kind branch can't redeclare a key outside it).
5. A key placed under two kinds of one field gives each resource one definition (`provider:jira` and `provider:confluence` may share a key).
6. Within one model, a key has one permission across its kinds (the `db:setting` rule doesn't switch on kinds).
7. A write of a key not in the resource's tree, for its kinds, is refused (`settingTreeKinds.test.ts`, the attributes hook tests).

---

## API Surface (Parent-Scoped Raw `GET`, Atomic Batch `PATCH`, Single `DELETE`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/setting/info` | Public master-data discovery: `types.trees`, one setting tree per resource model, leaves' schemas as JSON Schema (`settingInfoRoute`). |
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
