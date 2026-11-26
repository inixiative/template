# FEAT-009: Artifacts — Graph, Placements, Permissions & Ownership Transfer

> **Status:** In Progress (PR #72)
> **Split into follow-up tickets (2026-11-24):**
> - `tickets/FEAT-029-file-storage-and-versioning.md` — Storage buckets, presigned upload/download, `FileVersion` lifecycle, Cloudflare public serving
> - `tickets/FEAT-030-resource-bindings-and-lazy-copy.md` — `ResourceBinding` routes & invariants, copy-on-revoke lazy copy, orphan sweeper, `transferSpace` cascade
> - `tickets/FEAT-031-artifact-webhooks.md` — `WebhookModel.Artifact` & audience resolution
> - `tickets/FEAT-032-file-browser-ui.md` — Split-pane file browser, sharing UI, version history, previews, quotas
> - `tickets/AUTH-014-nested-down-list-walks.md` — Follow-up smell: remove `ArtifactEffectivePermission` once `@inixiative/permissions` supports nested `down` list walks

## 1. Overview

Foundation layer for files, folders, and fork-defined artifact kinds (`docs/claude/ARTIFACTS.md`):

- **Flat node table (`Artifact`)** with 5-way ownership (`User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`), immutable `ArtifactKind` enum (`root`, `file`, `folder`, extensible below template marker), eager per-owner `root` container (`ownerRootArtifact` hook), and materialized `effectiveAccess` (`private` | `tenant` | `public`).
- **Multi-parent placements (`ArtifactPlacement`)** carrying per-placement visibility (`access`: `inherit` | `private` | `tenant` | `public`; root placements default to `private` and reject `inherit`), supporting same-owner organization (with inheritance) and cross-owner bookmarks/reshares (`inherits = false` across owner boundaries, independent permissions), automatic orphan-to-root reparenting via DB hook (`reparentOrphanedArtifacts`), bounded by `ARTIFACT_MAX_DEPTH = 50` and `ARTIFACT_MAX_CHILDREN = 500`.
- **ReBAC authorization (`db:Artifact`, `db:ArtifactPermission`, `db:ArtifactPlacement`)** in `packages/permissions/src/artifacts/` with materialized tree state (`ArtifactAncestor`, `ArtifactEffectivePermission`, `Artifact.effectiveAccess`, synced by `artifactTree` hooks), 4-tier action ladder (`read`, `operate`, `manage`, `own`/`delete`), `tenantPermissionRules`, `roleHeldVia` grant ceiling, live `expiresAt` clock checks, `fromVersion >= 1` validation, and grantee `leave`.
- **Navigation & reflective sharing:**
  - `GET /{owner}/artifacts` — flat paginated + `filterLens` list of owned non-root artifacts with SQL access reflection (`effectiveAccess`), including `artifactPermissions` for managers.
  - `GET /{owner}/artifactPlacements` — paginated workspace root view by default (owned items + external bookmarks/reshares with `placement.id`, `placement.access`, `artifact`, and `containerArtifact` inline; public-callable for public/tenant root reshares).
  - `GET /{owner}/artifactPermissions` — paginated reflective "Shared with me" view (including `CustomerRelationship` shares) with each shared `artifact` inline.
  - `GET /artifact/:id` — 1-step includes keeping exact Prisma relation names (`effectiveAccess`, `effectiveRole`, `artifactPlacementsAsArtifact` with `containerArtifact`, `artifactPlacementsAsContainer` with `artifact` + `exclusive`, visible `resourceBindings`, and for managers `artifactPermissions` + `artifactEffectivePermissions`).
- **Explicit ownership transfer (`transferArtifact` Inquiry):** moves an object artifact between `User`, `Organization`, and `Space` under `withArtifactOwnersLock`, placing it into the receiver's root (`access: 'private'`) and clearing old placements and grants, with optional `tracking` `ResourceBinding` + `viewer` grant (or sender copy if tracking is refused).
- **Forward-compatible schema columns:** `File`, `FileVersion`, `ResourceBinding`, `ArtifactPermission.{fromVersion,preserveOnRevoke}` land in the Prisma schema now so `FEAT-029` and `FEAT-030` build without destructive schema churn.

## 2. Checklist (PR #72)

- [x] Prisma models (`Artifact`, `ArtifactPlacement`, `ArtifactPermission`, `ArtifactAncestor`, `ArtifactEffectivePermission`, `File`, `FileVersion`, `ResourceBinding`) & `ArtifactKind` enum (`root`, `file`, `folder`)
- [x] Kind catalog (`containerChildren`, `isContainerKind`, `isRootKind`, `canContain`), loop/depth/child-count caps, cross-owner non-inheriting placements
- [x] Per-placement visibility (`ArtifactPlacement.access`), `PATCH /artifactPlacement/:id`, lazy per-owner `root` container, materialized `Artifact.effectiveAccess`
- [x] ReBAC integration (`db:Artifact`, `db:ArtifactPermission` with `roleHeldVia` + `leave`, `db:ArtifactPlacement`), `tenantPermissionRules`, `artifactTree` hooks
- [x] 5-way owner flat artifact list (`GET /{owner}/artifacts`), root/workspace placement view (`GET /{owner}/artifactPlacements`), and reflective `GET /{owner}/artifactPermissions` ("Shared with me")
- [x] `GET /artifact/:id` 1-step resource-context inclusion (parents, children + `placementId`/`placementAccess`/`exclusive`, permissions, bindings)
- [x] Place / update placement / move / copy / remove placement services & `DELETE /artifact/:id` + `/v1/batch`
- [x] `transferArtifact` Inquiry with `withArtifactOwnersLock`
- [x] Audit logging & soft-delete cascade wiring
