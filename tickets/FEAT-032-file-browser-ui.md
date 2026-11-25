# FEAT-032: File Browser & Sharing UI

> **Status:** Open (split from `tickets/FEAT-009-file-management.md`)
> **Depends on:** `tickets/FEAT-009-file-management.md`, `tickets/FEAT-029-file-storage-and-versioning.md`

## Scope

Frontend file management and sharing experience built on the `Artifact`, `ArtifactPlacement`, and `ArtifactPermission` APIs:

- **Split-pane file browser:** owner root view (`GET /{owner}/artifactPlacements`, returning both owned items and external pins/reshares with `placement.id` and `placement.access`), folder navigation (`GET /artifact/:id` 1-step `artifactPlacementsAsArtifact` + `artifactPlacementsAsContainer` with placement `id`/`access` and nested `artifact` / `containerArtifact`), flat search view (`GET /{owner}/artifacts`), and pinned **"Shared with me"** view (`GET /{owner}/artifactPermissions`) with place-into-folder / pin-at-root (`POST /artifact/:id/artifactPlacements`) and leave-share actions.
- **Inline hover permission/visibility toggle:** quick hover control on each row (placement in root or folder) to switch placement visibility (`inherit` / `private` / `tenant` / `public` — root rows omit `inherit`) via `PATCH /artifactPlacement/:id` and open a lightweight permissions popover (`POST/PATCH/DELETE /artifactPermission`).
- **Search & filtering:** global search (`GET /{owner}/artifacts?search=...` / `searchFields` via `filterLens`), sorting, pagination.
- **Sharing & permissions UI:** grant/update/revoke `ArtifactPermission`s (including `expiresAt`, `preserveOnRevoke`, `fromVersion`), placement visibility toggle (`inherit` / `private` / `tenant` / `public`), and ownership transfer (`transferArtifact` Inquiry).
- **Uploads, versions & previews:** presigned upload dropzone, version history/restore UI, metadata extraction & thumbnail/preview derivatives, bulk move/delete (using `exclusive` children + `/v1/batch`), notifications, and storage quotas.
