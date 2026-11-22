# FEAT-026: Settings Primitive (Lightweight False-Polymorphic Configuration)

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-11-21
**Updated**: 2026-11-21
**Related**: [FEAT-020](./FEAT-020-custom-fields-eav.md) (custom fields EAV and when-to-EAV boundary), [FEAT-003](./FEAT-003-feature-flags.md) (typed value columns), `TRACKING.md` (Member settings, parked 2026-11-14)

---

## Goal

Provide a lightweight, false-polymorphic `Setting` primitive in Template (backported to Kingdom and Tribe) for app-owned configuration dials. Apps can add categorized settings on `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`, and `Project` without adding dozens of sparse columns to those tables or running schema migrations every time a configuration key is introduced or regrouped.

---

## Data model (`Setting`)

`Setting` uses Template's exclusive-arc false polymorphism (`packages/db/src/registries/falsePolymorphism.ts`), matching `TagAttachment` for the resource axis and `Project` / `Integration` for the composite-FK member arms (`OrganizationUser`, `Space`, `SpaceUser`):

```prisma
model Setting {
  id        String    @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  // Resource: exclusive-arc false polymorphism (enforced by falsePolymorphism hook + registry)
  resourceModel  SettingResourceModel
  userId         String?              @db.VarChar(36)
  organizationId String?              @db.VarChar(36)
  spaceId        String?              @db.VarChar(36)
  projectId      String?              @db.VarChar(36)

  user             User?             @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization     Organization?     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationUser OrganizationUser? @relation(fields: [organizationId, userId], references: [organizationId, userId], onDelete: Cascade)
  space            Space?            @relation(fields: [organizationId, spaceId], references: [organizationId, id], onDelete: Cascade)
  spaceUser        SpaceUser?        @relation(fields: [organizationId, spaceId, userId], references: [organizationId, spaceId, userId], onDelete: Cascade)
  project          Project?          @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Registry key (plain String, NOT a Prisma enum; validated against SETTING_DEFINITIONS)
  key      String  @db.VarChar(120)
  disabled Boolean @default(false)

  // Typed value columns (R-2026-11-21-11; multi-select uses deduplicated string[] in valueJson per R-2026-11-21-14)
  valueBoolean Boolean?
  valueText    String?
  valueNumber  Decimal? @db.Decimal(38, 10)
  valueJson    Json?

  // Generic AuditLog rail; no bespoke setting-history table.
  auditLogsAsSubject AuditLog[] @relation("AuditLogSubjectSetting")

  @@unique([userId, key], where: raw("\"resourceModel\" = 'User' AND \"deletedAt\" IS NULL"), map: "Setting_user_key_unique")
  @@unique([organizationId, key], where: raw("\"resourceModel\" = 'Organization' AND \"deletedAt\" IS NULL"), map: "Setting_organization_key_unique")
  @@unique([organizationId, userId, key], where: raw("\"resourceModel\" = 'OrganizationUser' AND \"deletedAt\" IS NULL"), map: "Setting_orguser_key_unique")
  @@unique([organizationId, spaceId, key], where: raw("\"resourceModel\" = 'Space' AND \"deletedAt\" IS NULL"), map: "Setting_space_key_unique")
  @@unique([organizationId, spaceId, userId, key], where: raw("\"resourceModel\" = 'SpaceUser' AND \"deletedAt\" IS NULL"), map: "Setting_spaceuser_key_unique")
  @@unique([projectId, key], where: raw("\"resourceModel\" = 'Project' AND \"deletedAt\" IS NULL"), map: "Setting_project_key_unique")
  @@index([resourceModel, key])
  @@index([userId])
  @@index([organizationId])
  @@index([spaceId])
  @@index([projectId])
  @@index([valueJson], type: Gin)
}

enum SettingResourceModel {
  User
  Organization
  Space
  OrganizationUser
  SpaceUser
  Project
}
```

### Design choices

1. **`SettingResourceModel` stays a Prisma enum.** The set of attachable models changes rarely and maps directly to physical FK columns and `PolymorphismRegistry.Setting` entries. Partial unique indexes filter on `"resourceModel" = '...' AND "deletedAt" IS NULL` so composite-FK arms (`OrganizationUser`, `Space`, `SpaceUser`) do not collide with `User` or `Organization` rows that share `userId` or `organizationId`.
2. **`key` is a plain `String`, not a Prisma enum.** `SettingKey` and `SettingCategory` live in a code registry instead of Postgres enums for three reasons:
   - SQL enums cannot express parent-to-child grouping (`category -> keys`).
   - Moving a key from one category to another becomes a data migration if categories live in SQL, instead of a one-line code edit.
   - Carrying 30 to 100+ setting keys across Template, Kingdom, and Tribe in Postgres enums causes constant enum churn and `ALTER TYPE` migrations.
   - Emitting OpenAPI `z.enum(...)` from the registry alongside `GET /api/v1/setting/info` gives `@template/sdk` strict key unions and automatic frontend category grouping with zero DB migrations.
3. **Typed value columns (`valueBoolean | valueText | valueNumber | valueJson`, locked by `R-2026-11-21-11`).** Matching `FEAT-003` (`FeatureFlagVariant`) and following `FEAT-020`'s typed-column discipline (`Decimal(38, 10)`; note `FEAT-020` carries `valueDate` instead of `valueBoolean`), storing values in typed columns allows `json-rules` lenses and database queries to compare numbers and booleans directly without lexicographic text comparisons or JSON casting. The `disabled` boolean lets an owner disable an override row without deleting its configured payload.
4. **Multi-select representation (`R-2026-11-21-14`).** Multi-select values on `Setting` (and Postgres EAVs in `FEAT-020`) are stored as a deduplicated `string[]` inside `valueJson` (`jsonb`) with a Postgres `GIN` index (`@@index([valueJson], type: Gin)`) and `array_contains` query support (`@>`). No multi-row or join table is added: preserving 1-row-per-`(resource, key)` atomicity keeps upserts and single-row `AuditLog` diffs straightforward without multi-table audit machinery.
5. **Generic `AuditLog` rail.** Every setting create, update, disable, and delete writes to `AuditLog` through the standard audit hook. No bespoke setting-history table is added.

---

## Code-first registry

The registry follows the same pattern as Template's `Inquiry` registry (`/api/v1/inquiry/info`) and Kingdom's `IntegrationResource.kind` catalog (`/api/v1/integration/info`).

- **`SETTING_CATEGORIES`:** Declares `{ key, label, description, order }` for UI grouping (for example `hosting`, `chorus`, `oracle`, `membership`).
- **`SETTING_DEFINITIONS`:** Declares each app-owned setting once in code:
  ```ts
  {
    key: string;                  // namespaced dot key, e.g. "hosting.idleSuspendMinutes"
    category: SettingCategoryKey;
    resourceModels: readonly SettingResourceModel[];
    valueType: 'boolean' | 'text' | 'number' | 'json' | 'multiSelect'; // multiSelect stores deduplicated string[] in valueJson
    schema: z.ZodType;            // exact runtime validator (bounds, enums, object shape)
    defaultValue: unknown;
    label: string;
    description: string;
    order: number;
    permission: Action;           // required ReBAC action on the target resource
  }
  ```
- **Discovery endpoint (`GET /api/v1/setting/info`):** Uses `apps/api/src/lib/jsonSchema/infoResponseSchema.ts` (mirroring `apps/api/src/modules/inquiry/routes/inquiryInfo.ts` and Kingdom's `apps/api/src/modules/integration/routes/integrationInfo.ts`) to expose categories, definitions, applicable `resourceModels`, defaults, and JSON Schemas derived from each entry's Zod `schema`. Frontend settings screens render grouped forms directly from this endpoint without duplicating validation rules.
- **DB write hook:** Validates every create and update against `SETTING_DEFINITIONS` inside the write transaction:
  1. `key` exists in `SETTING_DEFINITIONS`.
  2. `resourceModel` is listed in `definition.resourceModels`.
  3. Exactly the typed column matching `definition.valueType` is populated (with `multiSelect` storing a deduplicated `string[]` in `valueJson`), and the other three are `null`.
  4. The value parses cleanly against `definition.schema`.

---

## Where project-level Chorus, Oracle, and Hosting settings live

In Kingdom, project-level Chorus, Oracle, and Hosting configuration dials (such as `hosting.mode`, `hosting.provider`, `hosting.idleSuspendMinutes`, Chorus cache tier, and L2 retention mode) attach as categorized `Setting` rows on **`Project`**:

- **Why not `ProjectIntegrationResource`:** `ProjectIntegrationResource` links a project to fine-grained sub-objects such as individual GitHub repositories or Foundry threads (`packages/db/prisma/schema/projectIntegrationResource.prisma`). Hosting providers like `railway` and `render` do not register `IntegrationResource` rows, and project-wide policy dials do not belong to a single sub-resource.
- **Why not a new `ProjectIntegration` join table:** Under dual hosting (`R-2026-11-21-02`), inixiative-managed workloads have no customer hosting `Integration` row at all. Hanging settings off a `ProjectIntegration` row breaks for managed hosting and orphans settings whenever a project switches providers (for example from Railway to Fly.io or from BYO to managed).
- **Strict EAV guardrail (`FEAT-020` §1):** Real foreign-key pointers (`Project.poolId`, `CloudWorkload.hostingIntegrationId` (planned in `INTEG-005`)) and runtime provisioning state (`CloudWorkload` (planned in `INTEG-005`), `ArchiveHosting`) stay real columns with `onDelete: Restrict` and dedicated write services. They are never stored inside `Setting`. A `Setting` row holds configuration intent; relational tables hold referential integrity and live state.

---

## Lightweight EAV abstraction and relationship to `FEAT-020`

`FEAT-026` borrows four specific patterns from `FEAT-020` and leaves the rest out:

- **Borrowed:** Exclusive-arc false polymorphism, typed value columns (`valueBoolean | valueText | valueNumber | valueJson`, with `multiSelect` as deduplicated `string[]` in `valueJson` + `GIN` index + `array_contains`), generic `AuditLog` instead of custom history tables, and the strict when-to-EAV boundary (app workflows and foreign keys stay real columns).
- **Left behind:** `IntegrationSource`, `IntegrationMap`, multi-source contribution precedence, materialized read tables, `EnrichmentVocabulary`, and DB-stored `CustomFieldDefinition` rows. Settings have one authoritative value per `(resource, key)` and are defined in code.
- **EAV as a clean protocol (`R-2026-11-21-14`):** Structure the lightweight EAV pattern as a clean protocol (typed value columns, `valueJson` array convention for multi-select, exclusive-arc polymorphism, single-row `AuditLog` tracking, and validation/upsert contract) rather than naming it `enrichment` in Template or Kingdom unless a consumer specifically warrants that name. Keep the protocol's validation and upsert helpers local to the `Setting` module initially, or extract them into a thin shared utility under `packages/db` (see Open Decision #3).

---

## Future delegated settings

Carde.io carried a `SettingKey` database table because tenant games needed to define delegated settings for their own customers and establishments. Template drops `SettingKey` now because all current settings are app-owned and code-defined. If organizations or spaces later need to define delegated settings for their customers (customer choices or customer-supplied data), `Setting` can add a nullable `delegatedDefinitionId` FK pointing to a tenant-defined definition table (or bridge directly into `FEAT-020`'s `CustomFieldDefinition`) without migrating or breaking existing app-owned `Setting` rows.

---

## Unblocks parked Member Settings

`TRACKING.md` tracks **Member settings: how you interact with your org (auto-accept, rules)** (parked 2026-11-14): per-membership settings on `OrganizationUser` and `SpaceUser` for conversation request auto-accept, host selection, and org interaction rules. Because `SettingResourceModel` includes `OrganizationUser` and `SpaceUser` with composite-FK partial unique indexes, `FEAT-026` supplies the storage, registry, audit, and `/api/v1/setting/info` surface those member settings need when Aron picks that design back up.

---

## Open decisions for Aron before coding

1. **Value storage (DECIDED, `R-2026-11-21-11`):** Typed columns (`valueBoolean | valueText | valueNumber | valueJson`), matching `FEAT-003` and following `FEAT-020`'s typed-column discipline so `json-rules` lenses and database queries filter directly without JSON casting. **Multi-select representation (DECIDED, `R-2026-11-21-14`):** Stored as a deduplicated `string[]` in `valueJson` (`jsonb`) with a Postgres `GIN` index (`@@index([valueJson], type: Gin)`) and `array_contains` query support, preserving 1-row-per-`(resource, key)` atomicity and single-row `AuditLog` diffs (no multi-table join).
2. **Overlap with Kingdom's `Integration.configuration` (`packages/db/prisma/schema/integration.prisma:37`):** Keep `Integration.configuration` for provider connection parameters (omitting `Integration` from `SettingResourceModel` for now), or migrate integration settings onto `Setting`?
3. **EAV protocol extraction timing:** Keep the EAV protocol's typed-column validation and upsert helpers local to the `Setting` module and extract on the second lightweight EAV caller, or introduce the shared EAV protocol utility in `packages/db` immediately?
