# COMM-007: Standardize orgId denormalization on space-bearing FP models

**Status**: 📋 Proposed — cross-app convention cleanup (decided in ZLT-3008 review)
**Priority**: Medium

---

**Decision (ZLT-3008):** every false-polymorphism owner row that carries a `spaceId` must
**also** carry its parent `organizationId` (and a `*User` composite carries
`organizationId` + `spaceId` + `userId`). Denormalizing the parent org lets the owner
cascade walk up by a cheap indexed read with no join — the same reason `Token` and the
email models already do it.

## Current state (audited 2026-06-21, `packages/db/src/registries/falsePolymorphism.ts`)

Comply — `Space → [organizationId, spaceId]`:
- **EmailTemplate**, **EmailComponent** (this PR), **Token**

Do NOT comply — `Space → [spaceId]` only (to fix):
- Contact, Tag, TagCategory, TagAttachment, WebhookSubscription
- CustomerRef (`customerSpaceId` only), Inquiry (`source/targetSpaceId` only)
- CommunicationLog (`senderSpaceId`; its `SpaceUser → [senderUserId, senderSpaceId]` also drops org)

## Work per model
1. Add `organizationId` to the `Space` (and any `SpaceUser`) entry of the model's `fkMap`
   in `falsePolymorphism.ts`.
2. Ensure the schema has the `organizationId` column + relation + index (most do — verify).
3. Backfill `organizationId` from `space.organizationId` for existing Space-owned rows (migration).
4. The FP validation rule then *requires* it on new writes — confirm every create site supplies it.

## Note — no auto-populate today
Denormalized FKs are **validated (required) but not auto-derived** — the caller must supply
them (email is caller-supplied). Decide here whether to add a populate-from-`spaceId` step or
keep it caller-supplied app-wide. Also fix the misleading `emailComponent.prisma` comment
claiming *"orgId also populated by polymorphism hook"* — no such hook exists.
