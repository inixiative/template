# Model Capabilities & Registry Directory

<!-- toc:start -->

## Contents

- [Registry Directory](#registry-directory)
  - [Schema & DB Model Registries (`packages/db`)](#schema--db-model-registries-packagesdb)
  - [API Hook & Permission Registries (`apps/api` & `packages/permissions`)](#api-hook--permission-registries-appsapi--packagespermissions)
- [Model Capabilities Matrix](#model-capabilities-matrix)
- [Registry Standardization Standard](#registry-standardization-standard)

<!-- toc:end -->

Every cross-cutting behavior in `template` (soft delete, auditing, polymorphism, encryption, caching, webhooks, ReBAC) is opt-in through a flat, explicit registry rather than hidden framework magic. This page is the directory to every registry file, the generated matrix of what each Prisma model opts into, and the standardization rules for adding or updating a registry.

---

## Registry Directory

### Schema & DB Model Registries (`packages/db`)

| Capability | Registry file | Primary exports | Key convention | Enforced / consumed by |
|---|---|---|---|---|
| Audit logging | [auditEnabledModels.ts](../../packages/db/src/registries/auditEnabledModels.ts) | `AUDIT_ENABLED_MODELS`, `isAuditEnabled` | `ModelName` (PascalCase) | [auditLog/hook.ts](../../apps/api/src/hooks/auditLog/hook.ts), [softDeleteModels.ts](../../packages/db/src/registries/softDeleteModels.ts) |
| Soft delete | [softDeleteModels.ts](../../packages/db/src/registries/softDeleteModels.ts) | `SOFT_DELETE_MODELS`, `isSoftDeleteModel` | `ModelName` (PascalCase) | [preventHardDelete/hook.ts](../../apps/api/src/hooks/preventHardDelete/hook.ts), [softDeleteCascade/hook.ts](../../apps/api/src/hooks/softDeleteCascade/hook.ts) |
| Hard delete on parent tombstone | [hardDeleteOnTombstone.ts](../../packages/db/src/registries/hardDeleteOnTombstone.ts) | `HARD_DELETE_ON_TOMBSTONE`, `isHardDeletedOnTombstone` | `ModelName` (PascalCase) | [softDeleteCascade/cascade.ts](../../apps/api/src/hooks/softDeleteCascade/cascade.ts), [validateDeleteBehavior.ts](../../apps/api/src/hooks/softDeleteCascade/validateDeleteBehavior.ts) |
| Skip revive on parent revive | [skipRevive.ts](../../packages/db/src/registries/skipRevive.ts) | `SKIP_REVIVE`, `isSkippedOnRevive` | `ModelName` (PascalCase) | [softDeleteCascade/cascade.ts](../../apps/api/src/hooks/softDeleteCascade/cascade.ts) |
| False & dual polymorphism | [falsePolymorphism.ts](../../packages/db/src/registries/falsePolymorphism.ts) | `PolymorphismRegistry`, `polymorphismConfigForModel`, `polymorphicAxis` | `ModelName` (PascalCase) | [falsePolymorphism/toRules.ts](../../apps/api/src/hooks/falsePolymorphism/toRules.ts), [carriedOwnerKeysHook.ts](../../apps/api/src/hooks/falsePolymorphism/carriedOwnerKeysHook.ts), [polymorphicBodyRefinement.ts](../../apps/api/src/lib/routeTemplates/polymorphicBodyRefinement.ts), [carriedOwnerKeys.ts](../../packages/db/src/registries/carriedOwnerKeys.ts), [dualPolymorphismIds.ts](../../packages/db/src/registries/dualPolymorphismIds.ts) |
| Parent edges (tenancy, audit history, cache) | [parentEdges.ts](../../packages/db/src/registries/parentEdges.ts) | `ParentEdgeRegistry`, `parentEdgeOf`, `parentOf`, `childrenOf` | `ModelName` (PascalCase) | [auditLog/hook.ts](../../apps/api/src/hooks/auditLog/hook.ts), [cache/hook.ts](../../apps/api/src/hooks/cache/hook.ts) |
| Ordered lists (`position`) | [orderedList.ts](../../packages/db/src/registries/orderedList.ts) | `orderedListRegistry`, `orderedListFieldsByModel` | `ModelName` (PascalCase) | [orderedList/hook.ts](../../apps/api/src/hooks/orderedList/hook.ts) |
| Sensitive fields (audit mask, webhook drop) | [sensitiveFields.ts](../../packages/db/src/registries/sensitiveFields.ts) | `SENSITIVE_FIELDS`, `sensitiveFieldsOf` | `ModelName` (PascalCase) | [auditLog/hook.ts](../../apps/api/src/hooks/auditLog/hook.ts), [webhook/excludedFields.ts](../../packages/db/src/registries/webhook/excludedFields.ts) |
| Internal privilege fields | [internalFields.ts](../../packages/db/src/registries/internalFields.ts) | `INTERNAL_FIELDS` | `ModelName` (PascalCase) | [webhook/excludedFields.ts](../../packages/db/src/registries/webhook/excludedFields.ts) |
| No-op fields (skip audit & webhook noise) | [noopFields.ts](../../packages/db/src/registries/noopFields.ts) | `NOOP_FIELDS`, `omitRegisteredFields` | `ModelName` (PascalCase) | [auditLog/hook.ts](../../apps/api/src/hooks/auditLog/hook.ts), [webhook/excludedFields.ts](../../packages/db/src/registries/webhook/excludedFields.ts) |
| Webhook-enabled models & filters | [webhook/index.ts](../../packages/db/src/registries/webhook/index.ts) | `webhookEnabledModels`, `WEBHOOK_EXCLUDED_FIELDS`, `webhookOwnerAllowedModels`, `webhookRelatedModels` | `ModelName` (PascalCase) | [webhooks/hook.ts](../../apps/api/src/hooks/webhooks/hook.ts) |
| Column encryption | [encryption/registry.ts](../../packages/db/src/lib/encryption/registry.ts) | `ENCRYPTED_MODELS`, `encryptedFieldsByModel` | camelCase accessor *(legacy; see standard below)* | [encryption/validation.ts](../../packages/db/src/lib/encryption/validation.ts), [sensitiveFields.ts](../../packages/db/src/registries/sensitiveFields.ts) |
| Typed attributes (5-column + GIN) | [attributes/registry.ts](../../packages/db/src/lib/attributes/registry.ts) | `ATTRIBUTE_MODELS`, `isAttributeModel`, `attributeFieldsByModel` | camelCase accessor *(mirrors encryption)* | [attributes/hook.ts](../../packages/db/src/lib/attributes/hook.ts), [attributes/validation/validateAttributeModels.ts](../../packages/db/src/lib/attributes/validation/validateAttributeModels.ts) |

### API Hook & Permission Registries (`apps/api` & `packages/permissions`)

| Capability | Registry file | Primary exports | Key convention | Enforced / consumed by |
|---|---|---|---|---|
| Redis cache keys & invalidation | [cacheKeysByModel.ts](../../apps/api/src/hooks/cache/constants/cacheKeysByModel.ts) | `cacheKeysByModel`, `cacheKeysForRecord` | `ModelName` (PascalCase) | [cache/hook.ts](../../apps/api/src/hooks/cache/hook.ts) |
| Immutable field overrides | [immutableFields/registry.ts](../../apps/api/src/hooks/immutableFields/registry.ts) | `ImmutableFieldsOverrides` | `ModelName` (PascalCase) | [immutableFields/hook.ts](../../apps/api/src/hooks/immutableFields/hook.ts) |
| Close on parent delete | [closeOnParentDelete.ts](../../apps/api/src/hooks/softDeleteCascade/closeOnParentDelete.ts) | `CLOSE_ON_PARENT_DELETE`, `isClosedOnParentDelete` | `ModelName` (PascalCase) | [softDeleteCascade/cascade.ts](../../apps/api/src/hooks/softDeleteCascade/cascade.ts), [validateDeleteBehavior.ts](../../apps/api/src/hooks/softDeleteCascade/validateDeleteBehavior.ts) |
| Regenerate on parent revive | [regenerateOnRevive.ts](../../apps/api/src/hooks/softDeleteCascade/regenerateOnRevive.ts) | `REGENERATE_ON_REVIVE` | `ModelName` (PascalCase) | [softDeleteCascade/cascade.ts](../../apps/api/src/hooks/softDeleteCascade/cascade.ts) |
| Cascade-exempt FK relations | [cascadeExempt.ts](../../apps/api/src/hooks/softDeleteCascade/cascadeExempt.ts) | `CASCADE_EXEMPT` | `ModelName` (PascalCase) | [softDeleteCascade/childRelations.ts](../../apps/api/src/hooks/softDeleteCascade/childRelations.ts) |
| Write-time json-rules validation | [rules/registry.ts](../../apps/api/src/hooks/rules/registry.ts) | `RulesRegistry`, `ruleForModel` | `ModelName` (PascalCase) | [rules/hook.ts](../../apps/api/src/hooks/rules/hook.ts), [fullDelegateRules.ts](../../apps/api/src/hooks/rules/fullDelegateRules.ts) |
| RuleReference source surfaces | [ruleReference/surfaces.ts](../../apps/api/src/hooks/ruleReference/surfaces.ts) | `RULE_REFERENCE_SURFACES`, `isRuleReferenceSourceModel` | `RuleReferenceSourceModel` (PascalCase) | [ruleReference/hook.ts](../../apps/api/src/hooks/ruleReference/hook.ts), [ruleReference/targetHook.ts](../../apps/api/src/hooks/ruleReference/targetHook.ts) |
| ReBAC authorization schema | [schema.ts](../../packages/permissions/src/rebac/schema.ts) | `schemaMap` | `db:<accessor>` (ReBAC namespace) | [validatePermission.ts](../../apps/api/src/middleware/validations/validatePermission.ts), [validateSubmodelPermission.ts](../../apps/api/src/middleware/validations/validateSubmodelPermission.ts) |
| Inquiry party declarations | [inquiryTypes.ts](../../packages/permissions/src/rebac/inquiryTypes.ts) | `INQUIRY_TYPES`, `INQUIRY_READ_LEVELS` | `InquiryType` enum | [inquiryResourcePermission.ts](../../packages/permissions/src/rebac/inquiryResourcePermission.ts) |
| Setting trees | [settings/trees.ts](../../packages/shared/src/settings/trees.ts) | `SETTING_TREES` (one per resource model; compiled by [registry.ts](../../packages/shared/src/settings/registry.ts)) | Setting key = path in the tree | [settingResourcePermission.ts](../../packages/permissions/src/rebac/settingResourcePermission.ts), [settingInfo.ts](../../apps/api/src/modules/setting/controllers/settingInfo.ts) |

---

## Model Capabilities Matrix

Generated from `prismaMap` and the live registries above via `bun docs/scripts/modelCapabilities.ts` (verify with `--check`).

<!-- capabilities:start -->

| Model | Delete lifecycle | Audit | Polymorphic axes | Parent edge | Attribute | Encrypted | Ordered list | Field policies | Write rules | Rule ref source | Cached | Webhook | ReBAC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Account | - | - | - | - | - | - | - | sensitive | - | - | - | - | - |
| AppEvent | - | - | - | - | - | - | - | - | - | - | - | - | - |
| AuditLog | - | - | subjectModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| AuthProvider | soft | yes | - | - | - | yes | - | sensitive | - | - | - | - | yes |
| CommunicationComponentVersion | - | - | - | - | - | - | - | - | - | - | - | - | - |
| CommunicationLog | - | - | senderModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| Contact | soft | - | ownerModel | - | - | - | yes | noop, immutable-override | yes | - | - | - | yes |
| CronJob | - | - | - | - | - | - | - | - | - | - | - | - | - |
| CustomerRelationship | soft, cascade-exempt | yes | customerModel, providerModel | - | - | - | - | immutable-override | yes | - | yes | yes | - |
| EmailComponent | soft | yes | ownerModel | - | - | - | - | noop, immutable-override | yes | yes | - | - | - |
| EmailTemplate | soft | yes | ownerModel | - | - | - | - | noop, immutable-override | yes | yes | - | - | - |
| Entitlement | soft, cascade-exempt | yes | sourceModel, targetModel | axis: targetModel | - | - | - | immutable-override | yes | yes | - | - | - |
| Flow | hard-on-tombstone | - | - | - | - | - | - | - | - | - | - | - | yes |
| Inquiry | soft, close-on-parent-delete | yes | sourceModel, targetModel | - | - | - | - | immutable-override | yes | - | - | - | yes |
| Integration | soft | yes | ownerModel | - | - | - | - | immutable-override | yes | - | yes | - | yes |
| IntegrationRecord | soft | - | recordModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| IntegrationResource | soft | yes | - | - | - | - | - | - | - | - | - | - | yes |
| JobOutbox | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Jwks | - | - | - | - | - | yes | - | sensitive | - | - | - | - | - |
| Organization | soft | yes | - | - | - | - | - | - | - | - | yes | - | yes |
| OrganizationUser | soft | yes | - | - | - | - | - | - | - | - | yes | - | yes |
| Passkey | soft, skip-revive | yes | - | User (userId) | - | - | - | noop, immutable-override | - | - | - | - | - |
| Project | soft | yes | ownerModel | - | - | - | - | immutable-override | yes | - | - | - | yes |
| ProjectIntegration | soft | yes | - | Project (projectId) | - | - | - | immutable-override | - | - | - | - | yes |
| ProjectIntegrationResource | soft | yes | - | - | - | - | - | - | - | - | - | - | yes |
| RuleReference | hard-on-tombstone, regen-on-revive, cascade-exempt | - | sourceModel, targetModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| Segment | soft | yes | ownerModel | - | - | - | - | immutable-override | yes | yes | - | - | yes |
| SegmentMember | soft | - | - | - | - | - | - | - | - | - | - | - | yes |
| Session | hard-on-tombstone | - | - | - | - | - | - | - | - | - | - | - | - |
| Setting | soft | yes | resourceModel | axis: resourceModel | yes | - | - | immutable-override | yes | - | yes | - | yes |
| Space | soft | yes | - | - | - | - | - | immutable-override | - | - | yes | - | yes |
| SpaceUser | soft | yes | - | - | - | - | - | - | - | - | yes | - | yes |
| Tag | soft | - | ownerModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| TagAttachment | soft | - | resourceModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| TagCategory | soft | - | ownerModel | - | - | - | - | immutable-override | yes | - | - | - | - |
| Token | soft, skip-revive | yes | ownerModel | - | - | - | - | sensitive, noop, immutable-override | yes | - | yes | - | yes |
| TwoFactor | soft, skip-revive | yes | - | User (userId) | - | yes | - | sensitive | - | - | - | - | - |
| User | soft | yes | - | - | - | - | - | internal, noop | - | - | yes | - | yes |
| Verification | - | - | - | - | - | - | - | - | - | - | - | - | - |
| WebhookEvent | hard-on-tombstone | - | - | - | - | - | - | - | - | - | - | - | - |
| WebhookSubscription | hard-on-tombstone | - | ownerModel | - | - | - | - | immutable-override | yes | - | yes | - | yes |

<!-- capabilities:end -->

---

## Registry Standardization Standard

Keep registries flat, explicit, and owned by their capability rather than collapsing them into one monolithic model-manifest DSL. Follow these five rules for every new registry (and when touching an existing one):

1. **Key DB and hook registries by PascalCase `ModelName`:**
   Use `ModelName` from [modelNames.ts](../../packages/db/src/utils/modelNames.ts) everywhere a registry maps Prisma models (`User`, `Organization`, `Project`). That matches `prismaMap`, Prisma DMMF, `PolymorphismRegistry`, `ParentEdgeRegistry`, `SENSITIVE_FIELDS`, and `cacheKeysByModel` without `toModelName`/`toAccessor` glue.
   - *Exceptions:* ReBAC resource namespaces stay `'db:<accessor>'` (`@inixiative/permissions` contract). Existing camelCase registries (`ENCRYPTED_MODELS`) migrate incrementally when touched rather than in churn-heavy sweeps.

2. **Use one uniform export shape per registry:**
   ```ts
   // Constant registry object or readonly array (SCREAMING_SNAKE_CASE)
   export const <CAPABILITY>_MODELS = { ... } as const satisfies Partial<Record<ModelName, <Capability>Config>>;

   // Pure in-memory predicate and noun-phrase lookup (no `get*` prefix)
   export const is<Capability>Model = (model: string): model is <Capability>ModelName => ...;
   export const <capability>ConfigFor = (model: ModelName): <Capability>Config | undefined => ...;
   ```
   Follow [NAMING.md](./NAMING.md): `fetch*` is reserved for I/O; pure registry lookups use noun phrases or `is*` predicates, and `validate*` throws on failure while non-throwing issue collectors use noun names (`*Violations`, `*Issues`).

3. **Place each registry by its lowest valid dependency layer:**
   - **Pure schema/model facts** belong in `packages/db/src/registries/<capability>.ts` (or `packages/db/src/lib/<capability>/registry.ts` when paired with runtime codec/operator helpers and a DMMF validator).
   - **API-layer registries** that reference API hooks, services, or route modules (such as [closeOnParentDelete.ts](../../apps/api/src/hooks/softDeleteCascade/closeOnParentDelete.ts) or [cacheKeysByModel.ts](../../apps/api/src/hooks/cache/constants/cacheKeysByModel.ts)) live beside their hook in `apps/api/src/hooks/<hook>/`.

4. **Ship a schema/DMMF validation test with every registry:**
   Every registry that names models, columns, or relations must have a unit test verifying against `prismaMap` that every referenced model, column, type, or index actually exists (mirroring [parentEdges.test.ts](../../packages/db/src/registries/parentEdges.test.ts), [sensitiveFields.test.ts](../../packages/db/src/registries/sensitiveFields.test.ts), and [encryption/validation.ts](../../packages/db/src/lib/encryption/validation.ts)).

5. **Keep this directory current:**
   When adding a new capability registry or Prisma model, add its link to the directory table above and run:
   ```bash
   bun docs/scripts/modelCapabilities.ts
   bun scripts/docs/regenToc.ts docs/claude/MODEL_CAPABILITIES.md
   ```
