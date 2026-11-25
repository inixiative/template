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

- **Flat node table (`Artifact`)** with 5-way ownership (`User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`), immutable `ArtifactKind` enum (`file`, `folder`, extensible below template marker), and `access` (`inherit` | `public` | `private`, defaulting to `private`).
- **Multi-parent placements (`ArtifactPlacement`)** supporting both same-owner organization (with inheritance) and cross-owner pointers (`inherits = false` across owner boundaries, independent permissions), bounded by `ARTIFACT_MAX_DEPTH = 50` and `ARTIFACT_MAX_CHILDREN = 500`.
- **ReBAC authorization (`db:Artifact`, `db:ArtifactPermission`, `db:ArtifactPlacement`)** with materialized tree tables (`ArtifactAncestor`, `ArtifactEffectivePermission`, synced by `artifactTree` hooks), 4-tier action ladder (`read`, `operate`, `manage`, `own`/`delete`), `tenantPermissionRules`, `roleHeldVia` grant ceiling, live `expiresAt` clock checks, and grantee `leave`.
- **Navigation & reflective sharing:**
  - `GET /{owner}/artifacts` — paginated + `filterLens`, defaults to owner root (`placements: { none: { containerArtifact: owner } }`), searches across the tree when filtered, includes `permissions` for managers.
  - `GET /{owner}/artifactPermissions` — paginated reflective "Shared with me" view (including `CustomerRelationship` shares) with each shared `artifact` inline.
  - `GET /artifact/:id` — 1-step resource-context includes (`effectiveAccess`, direct readable `parents` & `children` with their permissions for managers and `exclusive` flag on children, visible `placements` & `bindings`, direct & effective `permissions` for managers).
- **Explicit ownership transfer (`transferArtifact` Inquiry):** moves an object artifact between `User`, `Organization`, and `Space` under `withArtifactOwnersLock`, clearing old placements and grants, with optional `tracking` `ResourceBinding` + `viewer` grant (or sender copy if tracking is refused).
- **Forward-compatible schema columns:** `File`, `FileVersion`, `ResourceBinding`, `ArtifactPermission.{fromVersion,preserveOnRevoke}` land in the Prisma schema now so `FEAT-029` and `FEAT-030` build without destructive schema churn.

## 2. Checklist (PR #72)

- [x] Prisma models (`Artifact`, `ArtifactPlacement`, `ArtifactPermission`, `ArtifactAncestor`, `ArtifactEffectivePermission`, `File`, `FileVersion`, `ResourceBinding`) & `ArtifactKind` enum
- [x] Kind catalog (`ArtifactKinds`), loop/depth/child-count caps, cross-owner non-inheriting placements
- [x] ReBAC integration (`db:Artifact`, `db:ArtifactPermission` with `roleHeldVia` + `leave`, `db:ArtifactPlacement`), `tenantPermissionRules`, `artifactTree` hooks
- [x] 5-way owner create/list routes (`paginate` + `filterLens` + default root) + reflective `GET /{owner}/artifactPermissions` ("Shared with me")
- [x] `GET /artifact/:id` 1-step resource-context inclusion (parents, children + `exclusive`, permissions, bindings)
- [x] Place / move / copy / remove placement services (one service per file) & `DELETE /artifact/:id` + `/v1/batch`
- [x] `transferArtifact` Inquiry with `withArtifactOwnersLock`
- [x] Audit logging & soft-delete cascade wiring
