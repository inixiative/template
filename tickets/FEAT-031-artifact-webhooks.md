# FEAT-031: Artifact Webhooks

> **Status:** Open (split from `tickets/FEAT-009-file-management.md` during PR #72 review)
> **Depends on:** `tickets/FEAT-009-file-management.md`, `tickets/AUTH-006-webhook-tenant-isolation.md`

## Scope

Re-introduce webhook delivery for `Artifact` changes as a focused, independently reasoned PR:

- Enable `WebhookModel.Artifact` and `IntegrationRecord.recordArtifactId` (for poisoned-record tracking).
- Audience resolution (`webhookGrantedAudiences` / `webhookRelatedRowAudiences`): an `Artifact` change reaches subscriptions owned by its owner and active grantees (through inheriting containers), excluding org-level subscriptions for private `OrganizationUser` / `SpaceUser` artifacts.
- Child-row fanout (`ArtifactPermission`, `ArtifactPlacement` → parent `Artifact` `update` event, including notifying a revoked grantee on permission delete).
- Reference implementation preserved in git history on `feat/file-management` at commit `125200079`.
