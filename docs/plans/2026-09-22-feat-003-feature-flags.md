# FEAT-003 Feature Flags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `tickets/FEAT-003-feature-flags.md` v1: platform and `custom:` flags whose typed value is chosen by ordered variant rows, each row's audience a FEAT-021 segment, resolved as a per-request fold.

**Architecture:** Three prerequisites first (the platform as a `ProviderModel`, provisioned platform `CustomerRef`s, variant-owned inline segments), then the two models, then hooks, resolver, routes. Nothing new is materialized; `SegmentMember` is the only stored audience. Every rule in this plan comes from the ticket; where the plan adds a mechanism it says so.

**Tech Stack:** Hono + zod-openapi route templates, Prisma (Postgres, partial uniques via `where:` / `raw()`), `@template/db` registries and `registerDbHook`, `@inixiative/json-rules` lens + `polymorphicIs`, app events → websocket refetch, bun test with `@template/db/test` factories.

**Conventions that bind every task**
- Tests create rows through factories (`packages/db/src/test/factories`), never `db.x.create`. Add a factory when one is missing.
- No `select` by reflex; plain `findMany` / `include`.
- No explanatory comments; no `createdBy`.
- Run the API suite from the repo root of this worktree: `bun run --cwd apps/api test -- <path>`. Prisma changes: `bun run --cwd packages/db db:generate` then a migration via `bun run --cwd packages/db db:migrate:dev --name <name>` (check `packages/db/package.json` for the exact script names before the first schema task).
- Commit after each task; the branch is `FEAT-003-feature-flags` (slot 1). Do not push until the stage is green.

---

## Stage A — the platform is a provider

Finding that shapes this stage: `polymorphicIs` (`packages/db/src/registries/polymorphicIs.ts`) already compiles one `any` arm per FK-bearing kind, and an *unbound* kind compiles to `key equals null`, i.e. matches nothing. A no-FK value gets the same treatment with the discriminator as its own key: `all: [{ ownerModel equals 'platform' }, { ownerModel equals bind 'platform', bindOptional }]`. Bound as `{ platform: 'platform' }` it matches platform rows; unbound it matches nothing. That is the entire tenancy change; every helper that returned an FK column just needs a "no column" arm.

### Task A1: `polymorphicIs` no-FK arm and `polymorphicBindings` for special owners

**Files:**
- Modify: `packages/db/src/registries/polymorphicIs.ts`
- Test: `packages/db/src/registries/polymorphicIs.test.ts`

**Step 1: failing tests**
- `polymorphicIs('Tag', 'ownerModel')` contains an arm `{ all: [{ field: 'ownerModel', operator: 'equals', value: 'platform' }, { field: 'ownerModel', operator: 'equals', bind: 'platform', bindOptional: true }] }`.
- `polymorphicBindings('platform', 'platform')` → `{ platform: 'platform' }`; `polymorphicBindings('Organization', 'o1')` unchanged.
- Compile a Tag rule through `toPrisma` with bindings `{ platform: 'platform' }` and assert the where admits `ownerModel = platform` rows; with `{ organizationId: 'o1' }` assert platform rows are not admitted (the existing "unbound arm matches nothing" property, now for the discriminator).

**Step 2:** run `bun run --cwd packages/db test -- src/registries/polymorphicIs.test.ts`; expect FAIL.

**Step 3: implementation**
- `POLYMORPHIC_BINDS` gains nothing; add `SPECIAL_OWNER_BINDS = { platform: 'platform', admin: 'admin', default: 'default' }` (the `SpecialOwner` union from `falsePolymorphism.ts`) and widen `PolymorphicKind` to `keyof POLYMORPHIC_BINDS | SpecialOwner`.
- `polymorphicBindings(kind, id)`: special owner → `{ [kind]: kind }` (id ignored); else as today.
- `polymorphicIs`: after the FK arms, for each `[value, fks]` with `fks.length === 0` push the arm above with `bind: value`. Do not touch the FK-arm validation loop.

**Step 4:** tests pass. `bun run --cwd packages/db test` all green (the `customerRefLens` boot probe still throws on missing source; the `communicationsReceived` narrowing gains never-matching arms, harmless).

**Step 5:** commit `polymorphicIs: bind no-FK owners by discriminator`.

### Task A2: schema — `platform` in `ProviderModel`, platform uniques, registry arms

**Files:**
- Modify: `packages/db/prisma/schema/customerRef.prisma` (enum + 3 partial uniques `@@unique([customerUserId], where: raw("\"providerModel\" = 'platform'"))` etc., the `Tag` raw form)
- Modify: `packages/db/prisma/schema/segment.prisma` (`@@unique([name], where: raw("\"ownerModel\" = 'platform'"))`)
- Modify: `packages/db/src/registries/falsePolymorphism.ts` (`CustomerRef.providerModel.fkMap.platform: []`, `allowedCombinations.*` include `'platform'` as a provider for every customer kind; `Segment.ownerModel.fkMap.platform: []`)
- Test: `packages/db/src/registries/polymorphicIs.test.ts` (`polymorphicIs('Segment','ownerModel')` and `('CustomerRef','providerModel')` now carry a platform arm); `apps/api/src/hooks/falsePolymorphism/hook.test.ts` (a `CustomerRef` with `providerModel: 'platform'` and no provider FK passes; with `providerOrganizationId` set it fails)

**Steps:** write the two tests → fail → schema + registry → `db:generate` + migration `platform_provider` → tests pass → commit `platform as ProviderModel: enum, partial uniques, registry arms`.

### Task A3: segment-module owner helpers grow the platform arm

**Files:**
- Modify: `apps/api/src/modules/segment/lib/segmentOwner.ts`
  - `segmentOwnerFk` / `customerRefProviderFk` return `string | null` (drop the `!`).
  - Add `providerWhere(ownerModel, ownerId): Prisma.CustomerRefWhereInput` → `{ providerModel: ownerModel, ...(fk ? { [fk]: ownerId } : {}) }`.
  - `segmentOwnerId(segment)` → `polymorphicTarget(...)?.id ?? segment.ownerModel` (a platform segment's owner id is the literal `'platform'`, which is also what `polymorphicBindings('platform', …)` expects).
  - Add `providerOf(customerRef)` (moved from `reconcileCustomerRef.ts`) returning `{ ownerModel: 'platform', ownerId: 'platform' }` for platform refs.
- Modify callers: `services/evaluateSegment.ts` (`compileSegmentWhere` uses `providerWhere`), `hooks/segmentMemberOwner/hook.ts` (`providerWhere`), `services/reconcileCustomerRef.ts` (import `providerOf`), `modules/customerRef/lib/customerRefLens.ts` (`polymorphicBindings` type now admits `'platform'`; no code change expected beyond types), `services/hydrateCustomerRefs.ts` and `services/estimateSegmentReach.ts` — grep `customerRefProviderFk|segmentOwnerFk|segmentOwnerId` and give each site the arm.
- Test: `apps/api/src/modules/segment/tests/segmentReconcile.test.ts` — new case: platform-owned dynamic segment (factory `createSegment({ ownerModel: 'platform' })`), two platform `CustomerRef`s (factory with `providerModel: 'platform'`, one User customer, one Organization customer) plus one org-owned ref that must **not** be admitted; `reconcileSegment` writes members for exactly the platform refs. Second case: `reconcileCustomerRef(platformRef.id)` evaluates the platform's dynamic segments.
- Test: `apps/api/src/modules/segment/tests/segmentConditionsHook.test.ts` — a platform segment referencing an org's segment is refused (owner mismatch already refuses; assert it still does for platform).

**Steps:** tests → fail (`polymorphicKeyColumn` null → `[undefined]: id` where) → implement → `bun run --cwd apps/api test -- src/modules/segment` green → commit `segment module: platform owner arm`.

### Task A4: `/admin/segments` routes and rebac for platform-owned rows

**Files:**
- Create: `apps/api/src/modules/admin/segment/routes/adminCreateSegment.ts`, `adminReadManySegments.ts`, `adminReachSegment.ts` + controllers, mirroring `apps/api/src/modules/me/{routes,controllers}/meCreateSegment.ts` etc. with `admin: true` and the owner fixed to `{ ownerModel: 'platform' }`. Follow how `apps/api/src/modules/admin/cronJob` mounts.
- Modify: `packages/permissions/src/rebac/schema.ts` — `'db:segment'` (and later `'db:featureFlag'`) get an explicit superadmin-only arm for platform rows. Read `packages/permissions/src/rebac/ownerActions.ts` and `docs/claude/PERMISSIONS.md` §rebac first: today a platform row passes only through the superadmin bypass; confirm with a test whether that bypass already covers `/admin` routes (it likely does — if so, record that in the plan and skip the schema change).
- Test: `apps/api/src/modules/segment/tests/segmentRoutes.test.ts` — superadmin creates a platform segment on `/admin/segments`, lists it, an org admin gets 403 on the same path, and the platform segment does not appear on `/organization/:id/segments`.

**Commit:** `admin segment routes for the platform owner`.

### Task A5: `SEGMENTS.md` + FEAT-021 note

- Modify: `docs/claude/SEGMENTS.md` (ownership paragraph: `platform` as an owner; API table gains `/admin/segments`).
- Commit `docs: platform-owned segments`.

## Stage B — platform `CustomerRef`s are provisioned

### Task B1: provisioning hook

**Files:**
- Create: `apps/api/src/hooks/platformCustomerRef/hook.ts` — after-create hook on `User`, `Organization`, `Space` (pattern: `apps/api/src/hooks/userEmailContact/hook.ts`): `db.customerRef.upsert` on the platform partial unique from A2 with `{ customerModel, [customerFk]: id, providerModel: 'platform' }`, `update: {}`. Restore-after-soft-delete: the upsert's `update` sets `deletedAt: null` (verify the soft-delete scoper lets an upsert see the tombstone; if not, `findFirst` with the tombstone included then `update`/`create`).
- Modify: `apps/api/src/hooks/index.ts` (register).
- Test: `apps/api/src/hooks/platformCustomerRef/hook.test.ts` — create user/org/space via factories → exactly one platform ref each; run the hook body again → still one; soft-delete the ref, re-run → revived, still one.
- Also: `apps/api/src/appEvents/handlers/customerRef/customerRefCreated.ts` exists with no production emitter (SEGMENTS.md "Remaining work"). Emit `customerRef.created` from the hook after a real create so platform dynamic segments pick the newcomer up. Check `makeAppEvent`/`emitAppEvent` import path from a hook (the observe/appEvents layer is designed to be non-failing).

**Commit:** `provision platform CustomerRefs on user/org/space create`.

### Task B2: backfill

**Files:**
- Create: `packages/db/scripts/backfillPlatformCustomerRefs.ts` (check `docs/claude/SCRIPTS.md` for where one-shot scripts live and how they are run) — iterate live users/orgs/spaces in pages, upsert as B1 does, print counts.
- Test: `packages/db/src/test/…backfill.test.ts` or under `apps/api` if it needs hooks — seed rows with the hook disabled (factory `ctx`) and assert the backfill creates exactly the missing refs and is idempotent on re-run.

**Commit:** `backfill platform CustomerRefs`.

## Stage C — models and registries

### Task C1: Prisma models

**Files:**
- Create: `packages/db/prisma/schema/featureFlag.prisma` (the `FeatureFlag` and `FeatureFlagVariant` models + `FeatureFlagValueType` enum exactly as in the ticket's Model section, plus owner relations `user/organization/space`, `segment Segment? @relation("FeatureFlagGate")`, `auditLogs AuditLog[]`; the variant's `segment Segment? @relation("FeatureFlagVariantAudience")` and `inlineSegment Segment? @relation("SegmentInlineForVariant")`).
- Modify: `packages/db/prisma/schema/segment.prisma` — `featureFlagVariantId String? @unique @db.VarChar(36)`, `inlineForVariant FeatureFlagVariant? @relation("SegmentInlineForVariant", fields: [featureFlagVariantId], references: [id], onDelete: Cascade)`, back-relations `featureFlagGates FeatureFlag[] @relation("FeatureFlagGate")`, `featureFlagVariants FeatureFlagVariant[] @relation("FeatureFlagVariantAudience")`.
- Modify: `user.prisma`, `organization.prisma`, `space.prisma` (`featureFlags FeatureFlag[]`), `auditLog.prisma` (`subjectFeatureFlagId`, `subjectFeatureFlagVariantId` following the existing subject columns).
- Flag uniqueness: `@@unique([userId, slug], where: { userId: { not: null } })` ×3 + `@@unique([slug], where: raw("\"ownerModel\" = 'platform'"))`. Variant: `@@unique([featureFlagId, label])`, `@@unique([featureFlagId], where: { isDefault: true })`.
- Migration `feature_flags`.

### Task C2: registries and factories

**Files:**
- Modify: `packages/db/src/registries/falsePolymorphism.ts` (`FeatureFlag.ownerModel` with `platform: []`; `AuditLog.subjectModel` gains `FeatureFlag`, `FeatureFlagVariant`), `orderedList.ts` (`FeatureFlagVariant: { position: ['featureFlagId'] }`), `auditEnabledModels.ts`, `softDeleteModels.ts` (FeatureFlag), `apps/api/src/hooks/immutableFields/registry.ts` (`FeatureFlag: { include: ['valueType', 'slug', 'subjectModel'] }` — slug/subjectModel immutability is this plan's addition: a slug rename or subject change silently changes every reader; flag it in the PR description for ratification), `apps/api/src/hooks/cache/constants/cacheReference.ts` (`FeatureFlag: r => [cacheKey(owner, ownerId, ['featureFlags'])]`, `FeatureFlagVariant: r => same key via `featureFlagId` → needs the parent; use the hook's `previous`/`result` row plus one `findUnique` on the flag, or denormalise nothing and let the resolver key on `featureFlag:<id>` too), `SegmentMember: r => [cacheKey('customerRef', r.customerRefId, ['segmentMembers'])]`, and the ignore-fields exemption so `position` writes bust (`packages/db/src/registries/ignoreFields.ts` — read it; the ticket says `HOOK_IGNORE_FIELDS` strips `position` by default).
- Create: `packages/db/src/test/factories/featureFlagFactory.ts`, `featureFlagVariantFactory.ts`; register in `factories/index.ts`.
- Test: `packages/db/src/registries/ignoreFields.test.ts` — a `FeatureFlagVariant` position-only change is not ignored.

**Commit:** `FeatureFlag / FeatureFlagVariant models, registries, factories`.

## Stage D — invariants

### Task D1: `featureFlag` hook (row-local invariants)

**Files:**
- Create: `apps/api/src/hooks/featureFlag/hook.ts`: before create/update/upsert on `FeatureFlag` — slug shape via the shared schema (Task G1; until then the regex from `CreateOrganizationModal`), bare slug ⇒ `ownerModel === 'platform'`, `custom:` ⇒ any owner; gate `segmentId` must be a live segment of the same owner and must not be inline for a variant (`featureFlagVariantId` null).
- Create: `apps/api/src/hooks/featureFlagVariant/hook.ts`: rule row ⇒ `segmentId` required, default row ⇒ `segmentId` null; exactly the value column for the flag's `valueType`; `segmentId` owner = flag owner; `segmentId` not inline for a *different* variant.
- Tests: `apps/api/src/hooks/featureFlag/hook.test.ts`, `apps/api/src/hooks/featureFlagVariant/hook.test.ts` — one case per refusal, one happy path each, through factories.

### Task D2: save-gate refusals on the segment side

**Files:**
- Modify: `apps/api/src/modules/segment/validations/validateSegmentReferences.ts` (or `assertSegmentReferencesOwned.ts`) — a referenced segment with `featureFlagVariantId` set is refused with 422 "inline segment".
- Modify: `apps/api/src/modules/segment/controllers/segmentUpdate.ts`, `segmentDelete.ts` — refuse inline rows (edit through the variant).
- Modify: `modules/{me,organization,space}/controllers/*ReadManySegments.ts` and `customerRefLens.ts` `ownedSegments` (the picker/source) — `featureFlagVariantId: null`.
- Tests in `segmentConditionsHook.test.ts`, `segmentRoutes.test.ts`.

**Commit:** `inline segments: owned by the variant, refused elsewhere`.

## Stage E — resolution

### Task E1: `resolveFlags` and `checkFlag`

**Files:**
- Create: `apps/api/src/modules/featureFlag/services/resolveFlags.ts` — `resolveFlags(refs: CustomerRef[])` → `Map<hopKey, Record<slug, value>>` where hopKey is `platform` or `<ProviderModel>:<id>`; reads `<owner>:featureFlags` (flags with variants ordered by position, live) and `customerRef:<id>:segmentMembers` through the cache layer used elsewhere (`cacheKey` + the get/set helper — find it in `apps/api/src/lib/cache`); folds per the ticket's four steps; soft-deleted segment reads as non-matching; `subjectModel` filter on the ref's `customerModel`.
- Create: `apps/api/src/modules/featureFlag/services/checkFlag.ts` — `checkFlag(ctx, owner, slug, type)` returns the value or `null`, logs mismatch once per slug (module-level `Set`); `checkFlag.explain` returns `{ step, variantLabel, variantId }` for owner reads only.
- Create: `apps/api/src/modules/featureFlag/services/zeroFor.ts` — `false | '' | 0 | null` by `valueType`.
- Tests: `apps/api/src/modules/featureFlag/tests/resolveFlags.test.ts` — disabled → zero (not default); gate miss → default else zero; ordered first-match with overlapping segments; reorder flips the overlap; wrong-kind member ignored; soft-deleted segment non-matching; missing flag → null; type mismatch → null.

### Task E2: request wiring and events

**Files:**
- Modify: `apps/api/src/middleware/prepareRequest.ts` — after the user's relations load, gather refs (own refs + for each org/space membership the org's/space's platform ref) and run `resolveFlags` once; put on `c.var.featureFlags`; add to `keysToClone`. Org/Space tokens: the token owner's own refs.
- Create: `apps/api/src/appEvents/handlers/featureFlag/featureFlagChanged.ts` (`websocket: sendToChannel(owner channel, refetch({ _id: 'meReadManyFeatureFlags' }))`); register in `handlers/index.ts`; emit from the flag/variant after-write hook (position writes included — same exemption as the cache entry).
- Modify: `customerRefSegmentsAdded.ts` / `customerRefSegmentsRemoved.ts` — add `refetch({ _id: 'meReadManyFeatureFlags' })` alongside the memberships refetch.
- Tests: `prepareRequest` test (existing file) asserts the fold runs once and the key is cloned into batch sub-requests; an app-event test asserts the emit on a position-only update.

**Commit:** `resolveFlags fold, checkFlag, request wiring, featureFlag.changed`.

## Stage F — API

### Task F1: flag routes

**Files:** `apps/api/src/modules/featureFlag/{routes,controllers,schemas,queries}` following `modules/segment` file-for-file: `featureFlagRead/Update/Delete`, `featureFlagReadManyVariants`, `featureFlagCreateVariant`; `modules/featureFlagVariant/{routes,controllers}`: `Update/Delete`; owner create + read-many on `me`, `organization`, `space`, `admin`; `meReadManyFeatureFlags` (subject-facing: `{ owner, slug, value }` only, from `c.var.featureFlags`). Register in `modules/modules.ts`, `tags.ts`, the router index.
- Variant create/update body: `segmentId` **xor** `inlineSegment: { type, conditions }` **xor** `sample: { percent, from?: segmentId }`; the service `apps/api/src/modules/featureFlag/services/writeVariant.ts` runs the row-local checks (nested creates bypass hooks — HOOKS.md) and writes the inline segment with `featureFlagVariantId`.
- `sample`: population = `providerWhere(owner)` refs of the flag's `subjectModel`, intersected with `from`'s members when given; sample `percent` of ids not already in the list (raising re-samples from the remainder into the same list); write/update the inline static segment with `{ field: 'id', operator: 'in', value: ids }`.
- Boolean flag create: the service also writes the `on` variant (`valueBoolean: true`) pointing at an inline dynamic open segment (`conditions: {}` — confirm the save gate accepts `{}` as the open rule; `feedback-default-open-not-a-bug`).
- `estimateSegmentReach` route: `GET /segment/:id/reach` (the ticket puts reach on the variant row).
- Tests: `apps/api/src/modules/featureFlag/tests/featureFlagRoutes.test.ts` — create per owner, bare slug refused for org, `custom:` accepted, variant with `segmentId` / `inlineSegment` / `sample`, position update reorders, delete cascades the inline segment, subject-facing read has no labels, superadmin read-many over all flags.

### Task F2: superadmin read-many

`GET /admin/featureFlags` over all owners, with `ownerModel` filter; the two tabs are a frontend concern (Stage H).

**Commit:** `feature flag routes`.

## Stage G — shared slug schema

### Task G1

- Create: `packages/shared/src/utils/slug.ts` — `slugSchema` (zod, `^[a-z0-9]+(?:-[a-z0-9]+)*$`), `normalizeSlug`, `featureFlagSlugSchema` (optional `custom:` prefix). Test alongside.
- Modify: `packages/ui/src/components/primitives/SlugInput.tsx` and `CreateOrganizationModal` to import them; `apps/api` org/space slug validation the same.

**Commit:** `shared slug schema`.

## Stage H — frontend (separate PR, planned here so the API shape is fixed)

- `useFeatureFlag(owner, slug, type)` over `meReadManyFeatureFlags` in `packages/ui`; ws handler names the query key.
- Superadmin: `apps/superadmin/app/routes/_authenticated/featureFlags.tsx` with two tabs on `/admin/featureFlags`.
- Owner pages (me / org / space): flags list, variants with reach, segment picker (excludes inline), `sample` form, JSON conditions textarea until the segment builder exists.

## Ratification notes for the PR description

- `valueNumber` is `Float`, not the ticket's `Decimal(38,10)`: Decimal breaks the db-wide `HydratedRecord` type the permissions walk reads, serialises as a string, and the repo has no Decimal column anywhere; the FEAT-020 reason for Decimal (exact ordered comparisons over enrichment data) does not apply to a flag's configuration value.
- Two row-shaped cache keys instead of the ticket's one: `<owner>:featureFlags` (flag rows) and `featureFlag:<id>:variants`. `cacheReference` is synchronous over the written row, and a variant row carries only `featureFlagId`, so it cannot name the owner key.
- Flag, variant and `Segment.name` uniques are partial on `deletedAt IS NULL` so a deleted slug, label or segment name can be reused. The segment change is a FEAT-021 model change made here because an inline segment is recreated under its variant's name whenever the audience is re-pointed.
- `featureFlag.changed` refetches `meReadManyFeatureFlagValues` on one global channel, not an owner channel: websocket channels are authorized by probing the route they name, and the values route carries no owner parameter. The payload is a refetch hint, so this is fan-out, not a leak; a per-owner channel needs a route shape that carries the owner.
- Lowering a `sample.percent` keeps the already-enrolled ids (the ticket specifies raising only); shrinking a rollout is a ruling to take.
- `slug` and `subjectModel` immutability on `FeatureFlag` (this plan's addition).
- Variant → inline segment → variant is the schema's first mutual-FK pair and `hydrate()` recursed forever on it, hanging every `validatePermission` on a variant. Resolved with prisma-map's annotation DSL: `/// @permissions(hydrate: false)` on `FeatureFlag.segment`, `FeatureFlagVariant.segment`, `Segment.inlineForVariant` and `SegmentMember.customerRef` keeps those edges out of the permissions tree (`isPermissionEdge`, honored by `hydrate` and `relationTargetsGen`); a cycle now throws instead of walking.
- One-audience-per-write is enforced in `writeVariant.ts` (422), not as a zod refine, because a refine on a create body breaks the route template's body schema shape.
- Frontend (Stage H) is not in this PR.
- Platform owner id is the literal string `'platform'` wherever an owner id is needed (`segmentOwnerId`, `polymorphicBindings`) — one convention across A3/E1.
- `customerRef.created` gains its first production emitter (B1).
