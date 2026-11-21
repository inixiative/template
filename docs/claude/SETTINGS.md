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

No `valueType` discriminator column is required on the row: the type and schema live in the definition layer above (`SETTING_DEFINITIONS` for `Setting`, or a future DB definition table via `locatorField`). Both `locatorField` and `valueTypeField` are optional on `AttributeModelConfig` so `Setting` (`locatorField: 'key'`) and future custom attribute value tables share the exact same capability.

- **Model registry (`packages/db/src/lib/attributes/registry.ts`)**: `ATTRIBUTE_MODELS` declares each model's optional `locatorField`, `valueTypeField`, `resourceModelField`, `disabledField`, and definition lookups (`resolveDefinition`, `definitionsForResourceModel`). Exposes `isAttributeModel()`, `attributeModelConfig()`, and `attributeFieldsByModel()` (mirroring `encryptedFieldsByModel()`).
- **Schema & index validator (`packages/db/src/lib/attributes/validation.ts`)**: `validateAttributeModels()` verifies against `prismaMap` (`packages/db/src/generated/prismaMap.gen.ts`) and the Prisma schema that every registered model has all 5 optional typed columns with exact scalar types, scalar value indexes, and a Postgres `GIN` index on `valueJson`.
- **Typed codec (`packages/db/src/lib/attributes/codec.ts`)**:
  - `packAttributeValue(valueType, value)` and `encodeAttributeColumns(model, locator, value)` validate against the definition's `valueType` (`boolean`, `text`, `number`, `date`, `json`, `multiSelect`) and Zod `schema`, deduplicate `string[]` for `multiSelect`, populate the matching typed column, and clear the four sibling columns to `null` (using `Prisma.DbNull` for `valueJson`).
  - `unpackAttributeValue(row, valueType?)`, `decodeStoredAttributeValue(model, row)`, and `decodeAttributeValue(model, row)` read the active typed value (falling back to `defaultValue` when disabled or unset).
  - `validateAttributeWrite(model, row)` enforces the at-most-one-populated-column invariant on every registered model, plus locator, `resourceModel`, and schema checks when `resolveDefinition` is configured.
- **Typed Prisma operators (`packages/db/src/lib/attributes/operators.ts`)**:
  - `attributeWhereEquals(model, locator, value)`
  - `attributeWhereIn(model, locator, values)`
  - `attributeWhereRange(model, locator, range)` (`gt`, `gte`, `lt`, `lte` for `number` and `date`)
  - `attributeWhereMultiSelectContains(model, locator, value)` (`valueJson: { array_contains: [value] }`, using the Postgres `GIN` index)
  - `attributeWhereMultiSelectContainsAll(model, locator, values)` and `attributeWhereMultiSelectContainsAny(model, locator, values)`
  - `attributeOrderBy(model, locator, direction)` (scalar `valueType`s: `boolean`, `text`, `number`, `date`)
- **Write-time invariant hook (`packages/db/src/lib/attributes/hook.ts`)**: `registerAttributeValidationHook()` enforces `validateAttributeWrite()`, deduplicates `multiSelect` arrays in `valueJson`, and normalizes `date` values on `create`, `createManyAndReturn`, `update`, `updateManyAndReturn`, and `upsert` for every model in `ATTRIBUTE_MODELS` (wired into `apps/api/src/hooks/index.ts` with 422 errors). Each model's `locatorField` is refused on update via `ImmutableFieldsOverrides` (`apps/api/src/hooks/immutableFields/registry.ts`).
- **Service utilities (`packages/db/src/lib/attributes/utils.ts`)**: `resolveEffectiveAttributeValues()` merges stored rows with code-defined defaults grouped by category, and `buildAttributeUpsertData()` builds validated 5-column write payloads.
- **Browser-safe shared protocol (`packages/shared/src/attributes/`)**: Exports `ATTRIBUTE_VALUE_TYPES`, `AttributeValueTypeSchema`, `ATTRIBUTE_COLUMN_NAMES`, `defineAttributeField`, `deduplicateMultiSelect`, `attributeColumnForValueType`, `encodeAttributeValue`, `decodeAttributeColumnValue`, `validateAttributeTypedColumns`, and `assertAttributeValueMatchesType` with zero Prisma dependencies.

---

## `Setting` Primitive (`packages/db/prisma/schema/setting.prisma`)

- **Dual polymorphism on `resourceModel`**: Attaches to `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`, or `Project` via `SettingResourceModel`, `resourceId`, and typed FKs (`resourceUserId`, `resourceOrganizationId`, `resourceSpaceId`, `resourceProjectId`), registered in `PolymorphismRegistry` (`packages/db/src/registries/falsePolymorphism.ts`) and `ParentEdgeRegistry` (`packages/db/src/registries/parentEdges.ts`).
- **Partial unique indexes**: One active row per `(resource, key)` (`WHERE "resourceModel" = '...' AND "deletedAt" IS NULL`), isolating composite-FK member arms from `User` and `Organization` rows and freeing keys immediately on soft-delete.
- **Multi-select storage**: Stored as a deduplicated `string[]` inside `valueJson` with `@@index([valueJson], type: Gin)` for `array_contains` queries.
- **Code-first registry (`packages/shared/src/settings/registry.ts`)**: Categories (`SETTING_CATEGORIES`) and setting definitions (`SETTING_DEFINITIONS`) live in code, not a database table or Postgres enum. Downstream apps add their own categories and settings below the `TEMPLATE ABOVE` markers using `defineSettingCategory` and `defineSetting`.
- **Generic `AuditLog` rail**: `Setting` is registered in `AUDIT_ENABLED_MODELS` (`packages/db/src/registries/auditEnabledModels.ts`), so every create, update, disable, and delete records in `AuditLog` with parent tenancy context resolved through `ParentEdgeRegistry`.
- **ReBAC permissions (`packages/permissions/src/rebac/schema.ts`)**: `db:setting` uses `settingResourceActions` (`packages/permissions/src/rebac/rebacSchemaRules.ts`), delegating through `resourceUser`, `resourceOrganization`, `resourceSpace`, `resourceOrganizationUser`, `resourceSpaceUser`, and `resourceProject`.

---

## API Surface (`apps/api/src/modules/setting/`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/setting/info` | Public discovery of `SETTING_CATEGORIES` and `SETTING_DEFINITIONS` with JSON Schemas (`settingInfoRoute`). |
| `GET` | `/api/v1/setting` | List effective settings for a target resource, merging stored rows with defaults, filterable by `category` and `key` (`settingReadManyRoute`). |
| `GET` | `/api/v1/setting/{id}` | Read a single stored setting row (`settingReadRoute`). |
| `PATCH` | `/api/v1/setting` | Atomically create or update a setting via `upsertSetting` (`db.findForUpdate(..., { upserting: true })`) with ReBAC check on `definition.permission` (`settingUpdateRoute`). |
| `DELETE` | `/api/v1/setting/{id}` | Soft-delete a stored setting row to reset it to its default (`settingDeleteRoute`). |
| `GET` | `/api/admin/setting` | Superadmin paginated listing of all stored setting rows (`adminSettingReadManyRoute`). |
