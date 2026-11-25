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

No `valueType` discriminator column is required on the row: the type and optional schema live in the definition layer above (`SETTING_DEFINITIONS` for `Setting`, or a future DB definition table via `locatorField`). Both `locatorField` and `valueTypeField` are optional on `AttributeModelConfig` so `Setting` (`locatorField: 'key'`) and future custom attribute value tables share the exact same capability.

- **Model registry (`packages/db/src/lib/attributes/registry.ts`)**: `ATTRIBUTE_MODELS` declares each model's optional `locatorField`, `valueTypeField`, `resourceModelField`, `disabledField`, and definition lookups (`resolveDefinition`, `definitionsForResourceModel`). Exposes `isAttributeModel()`, `attributeModelConfig()`, and `attributeFieldsByModel()` (mirroring `encryptedFieldsByModel()`).
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
- **Write-time invariant hook (`packages/db/src/lib/attributes/hook.ts`)**: `registerAttributeValidationHook()` uses shared `applyWriteDataOverPreviousRow` (`packages/db/src/utils/applyWriteDataOverPreviousRow.ts`) and generic `isTombstoneOnlyUpdate` (`packages/db/src/utils/isTombstoneOnlyUpdate.ts`, covering soft-deletes and revives `{ deletedAt: null }`) to enforce `validateAttributeWrite()`, canonicalize `multiSelect` arrays (including scoped `updateManyAndReturn`), and normalize `date` values on `create`, `createManyAndReturn`, `update`, `updateManyAndReturn`, and `upsert`. Each model's `locatorField` is refused on update via `ImmutableFieldsOverrides` (`apps/api/src/hooks/immutableFields/registry.ts`).
- **Browser-safe shared protocol (`packages/shared/src/attributes/`)**: split into atomic `typing/` (`ATTRIBUTE_VALUE_TYPES`, `ATTRIBUTE_FIELD_KIND_BY_VALUE_TYPE`, `AttributeFieldDefinition` with optional `schema`, `AttributeValidationError`), `parsing/` (`parseAttributeValue`, `parseAttributeDate`, `deduplicateMultiSelect`, `isStringArray`, `attributeColumnForValueType`, `decodeAttributeColumnValue`, `populatedAttributeColumns`, `attributePermissionForModel`), and `writing/` (`encodeAttributeValue`, `validateAttributeValue`, `validateAttributeTypedColumns`) with zero Prisma dependencies.

---

## `Setting` & `ProjectIntegration` Primitives

- **Dual polymorphism on `resourceModel` (`packages/db/prisma/schema/setting.prisma`)**: Attaches to all 8 resource models — `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`, `Project`, `Integration`, and `ProjectIntegration` — via `SettingResourceModel`, non-nullable `resourceId`, and typed FKs, registered in `PolymorphismRegistry` (`packages/db/src/registries/falsePolymorphism.ts`) and `ParentEdgeRegistry` (`packages/db/src/registries/parentEdges.ts`).
- **`ProjectIntegration` (`packages/db/prisma/schema/projectIntegration.prisma`)**: Links a `Project` to an `Integration` within the same tenant boundary (enforced by `projectIntegrationOwner` in `apps/api/src/hooks/projectIntegrationOwner/hook.ts` and tombstoned on cross-org space transfer in `apps/api/src/modules/inquiry/services/transferSpace/index.ts`). Registered in `ParentEdgeRegistry` (`ProjectIntegration → Project`), `AUDIT_ENABLED_MODELS`, and `db:ProjectIntegration` ReBAC (`create` requires `project:manage` + `integration:operate`; `delete` allows `project:manage` OR `integration:manage`). Linking is an upsert on a plain `(projectId, integrationId)` unique: linking twice returns the link, and linking a removed one revives it with what was deleted with it.
- **Partial unique indexes**: One active row per `(resource, key)` (`WHERE "resourceModel" = '...' AND "deletedAt" IS NULL`), isolating every arm and freeing keys immediately on soft-delete.
- **Code-first starter registry (`packages/shared/src/settings/registry.ts`)**: Ships the `general` category with `general.defaultTimezone` and `general.displayLocale`. Each definition declares `permission` and optional `readPermission` (default `'read'`) as a `SettingPermissionSpec` — either a single `SettingPermissionAction` or a per-`resourceModel` map with optional `default`, resolved by `settingPermissionForModel()`. Downstream apps add their own categories and settings below the `TEMPLATE ABOVE` markers.
- **Provider-scoped settings**: a definition may name `integrationProviders`. It is then listed, read and accepted only on an `Integration` of one of those providers, or on a `ProjectIntegration` linking to one (`settingAppliesToIntegrationProvider`, applied when listing and reading in `readResourceSettings` and `assembleResourceSettings`; the UI passes `integrationProvider` on a `SettingExplicitTarget`, and the Integrations page per integration). A definition without it applies to every provider, as before. Writing is refused with 422 by the `settingIntegrationProvider` hook on every Setting create and upsert, so the routes, services and seeds all meet the same check.
- **ReBAC permissions (`packages/permissions/src/rebac/settingResourcePermission.ts`)**: Mirrors `inquiryResourcePermission.ts`. `settingResourcePermissionFromDefinitions(SETTING_DEFINITIONS)` compiles `db:Setting` with exactly two actions — `manage` and `read` — mounted in `packages/permissions/src/rebac/schema.ts`.

---

## API Surface (Parent-Scoped Raw `GET`, Atomic Batch `PATCH`, Single `DELETE`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/setting/info` | Public master-data discovery of `SETTING_CATEGORIES` and `SETTING_DEFINITIONS` with JSON Schemas, `permission`, and `readPermission` (`settingInfoRoute`). |
| `GET` | `/api/v1/{me\|organization/:id\|organizationUser/:id\|space/:id\|spaceUser/:id\|project/:id\|integration/:id\|projectIntegration/:id}/settings` | Returns **raw `Setting[]`** (`SettingScalarSchema`) for the parent resource, gated by `validatePermission('read')` on the parent, backed by Redis `fetchThroughCache` on `cacheKey('setting', { resourceModel, resourceId })` (automatically invalidated by `cacheKeysByModel.Setting`), and filtered in memory per key via `readResourceSettings()` (`db:Setting:read`). Filterable by `category` and `key`. |
| `PATCH` | `/api/v1/{me\|organization/:id\|organizationUser/:id\|space/:id\|spaceUser/:id\|project/:id\|integration/:id\|projectIntegration/:id}/settings` | Atomic batch upsert (`Array<{ key, value, disabled? }>`) via `upsertResourceSettings()`: rejects empty arrays and duplicate keys (422), authorizes all keys upfront (`db:Setting:manage`), sorts keys lexicographically, locks via `db.findForUpdate(..., { upserting: true })` inside `db.txn`, and returns **raw `Setting[]`**. |
| `GET` | `/api/v1/setting/{id}` | Read a single raw stored setting row (`settingReadRoute`, `validatePermission('read')`). |
| `DELETE` | `/api/v1/setting/{id}` | Soft-delete a stored setting row to reset it to its default (`settingDeleteRoute`, `validatePermission('manage')`). |
| `GET` | `/api/admin/setting` | Superadmin paginated listing of all stored setting rows (`adminSettingReadManyRoute`). |
| `GET` / `POST` | `/api/v1/project/{id}/projectIntegrations` | List or link an Integration to a Project (`projectReadManyProjectIntegrations`, `projectCreateProjectIntegration`). |
| `GET` / `DELETE` | `/api/v1/projectIntegration/{id}` | Read or soft-delete a `ProjectIntegration` link (`projectIntegrationRead`, `projectIntegrationDelete`). |

---

## Frontend Cardi-Style Master Data & Settings UX (`packages/ui/`)

- **Client-side assembly (`packages/shared/src/settings/assemble.ts`)**: `assembleResourceSettings(catalog, rawRows, resourceModel, { category?, keys?, integrationProvider? })` merges master data with raw `Setting[]` rows and defaults; `diffSettingDrafts(assembled, drafts)` computes the minimal dirty batch `PATCH` payload.
- **Master-data preload & hook (`packages/ui/src/lib/masterData/`)**: `setting` (`/api/v1/setting/info`) is registered in `MASTER_DATA_ENTRIES` so it preloads in the authenticated startup batch alongside other `/info` catalogs (`POST /api/v1/batch/execute`), consumed via `useSettingInfo()` / `useSettingCatalog()` with infinite `staleTime`/`gcTime` and individual fallback fetch.
- **Context & target queries (`packages/ui/src/lib/settingContextQueries.ts`)**: `settingContextQueries` (for `User`, `Organization`, `OrganizationUser`, `Space`, `SpaceUser`) + `settingQueriesForTarget()` (for `Project`, `Integration`, `ProjectIntegration`) + single-row `settingDelete`.
- **Reusable components (`packages/ui/src/components/settings/`)**: `<SettingField>` renders all 6 `AttributeValueType`s (`SearchableSelect` when enum options `> 12`, `Select` when `<= 12`, `Input`, checkbox, `datetime-local`, checkbox pills, validated JSON textarea) with read-only `disabledText` and single-row Reset (`DELETE`); `<ResourceSettingsSection>` wires master data + raw rows + dirty diff batch Save + real hydrated ReBAC (`packages/ui/src/lib/hydrateRecordForPermissions.ts`), mounted consistently in `UserProfilePage`, `OrganizationProfilePage`, `SpaceProfilePage`, `IntegrationsPage`, `ProjectDetailPage`, and `ProjectIntegrationsSection`.
- **Projects & ProjectIntegrations UI (`packages/ui/src/pages/ProjectsPage.tsx`, `ProjectDetailPage.tsx`, `packages/ui/src/components/projects/ProjectIntegrationsSection.tsx`, `packages/ui/src/lib/projectContextQueries.ts`)**: 3-scope project listing/creation, nested routes (`/projects`, `/projects/$id/settings`, `/projects/$id/integrations`) across `web`, `admin`, and `superadmin`, containment-grouped connectable integrations, expandable per-link `<ResourceSettingsSection>` + `renderProjectIntegrationResources` extension slot.
